import { fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '#lib/server/db/index.js';
import { users } from '#lib/server/db/schema.js';
import {
	NotifyError,
	haServices,
	notifySettings,
	setNotifyTargets,
	testHomeAssistant
} from '#lib/server/notify.js';
import { PushError, listDevices, pushToUser, unsubscribe, vapidKeys } from '#lib/server/push.js';
import {
	PushoverError,
	hasPushoverKey,
	pushoverToken,
	setPushoverKey,
	testPushover
} from '#lib/server/pushover.js';
import { formString } from '#lib/server/validation.js';
import { sendReportNow } from '#lib/server/monthly-report.js';
import { audit } from '#lib/server/audit.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [{ smtp, ha }, [me], devices, vapid, pushover, pushoverKeySet] = await Promise.all([
		notifySettings(),
		db
			.select({ targets: users.notifyTargets, monthlyReport: users.monthlyReport })
			.from(users)
			.where(eq(users.id, user.id)),
		listDevices(user.id),
		vapidKeys(),
		pushoverToken(),
		hasPushoverKey(user.id)
	]);
	let services: string[] = [];
	let haError: string | null = null;
	if (ha)
		try {
			services = await haServices(ha);
		} catch (e) {
			haError = e instanceof Error ? e.message : 'Home Assistant ist nicht erreichbar.';
		}
	const targets = me?.targets ?? [];
	return {
		email: user.email,
		smtpReady: !!smtp,
		haReady: !!ha,
		haError,
		// Saved devices stay selectable even if Home Assistant does not list them right now.
		services: [...new Set([...services, ...targets])].sort(),
		targets,
		monthlyReport: me?.monthlyReport ?? false,
		vapidPublicKey: vapid.publicKey,
		devices,
		pushoverReady: pushover !== null,
		pushoverKeySet
	};
};

export const actions: Actions = {
	targets: async ({ request, locals }) => {
		const chosen = (await request.formData())
			.getAll('target')
			.filter((v): v is string => typeof v === 'string' && /^[a-z0-9_]+$/.test(v));
		await setNotifyTargets(locals.user!, chosen);
		return { success: 'Geräte gesichert.' };
	},

	report: async ({ request, locals }) => {
		const on = formString(await request.formData(), 'monthlyReport') === 'on';
		const actor = locals.user!;
		await db.transaction(async (tx) => {
			await tx
				.update(users)
				.set({ monthlyReport: on, updatedAt: new Date() })
				.where(eq(users.id, actor.id));
			await audit(tx, {
				actor,
				entityType: 'user',
				action: 'update',
				entityId: actor.id,
				entityLabel: 'Benachrichtigungen',
				after: { monthlyReport: on }
			});
		});
		return { success: on ? 'Monatsbericht eingeschaltet.' : 'Monatsbericht ausgeschaltet.' };
	},

	reportNow: async ({ locals }) => {
		try {
			await sendReportNow(locals.user!);
		} catch (e) {
			if (e instanceof NotifyError) return fail(400, { message: e.message });
			throw e;
		}
		return { success: 'Monatsbericht verschickt.' };
	},

	pushoverKey: async ({ request, locals }) => {
		const key = formString(await request.formData(), 'key');
		if (!key.trim())
			return fail(400, { message: 'Bitte deinen Benutzerschlüssel von Pushover eintragen.' });
		const error = await setPushoverKey(locals.user!, key);
		if (error) return fail(400, { message: error });
		return { success: 'Benutzerschlüssel gesichert.' };
	},

	pushoverKeyRemove: async ({ locals }) => {
		await setPushoverKey(locals.user!, '');
		return { success: 'Benutzerschlüssel entfernt.' };
	},

	testPushover: async ({ locals }) => {
		try {
			await testPushover(locals.user!.id);
		} catch (e) {
			if (e instanceof PushoverError) return fail(400, { message: e.message });
			throw e;
		}
		return { success: 'Pushover-Testnachricht verschickt.' };
	},

	removeDevice: async ({ request, locals }) => {
		const id = formString(await request.formData(), 'id');
		await unsubscribe(locals.user!, { id });
		return { success: 'Gerät entfernt.' };
	},

	testPush: async ({ locals }) => {
		try {
			await pushToUser(
				locals.user!.id,
				'Konto Planer',
				'Test: Push-Mitteilungen kommen an.',
				'einstellungen/meine-benachrichtigungen'
			);
		} catch (e) {
			if (e instanceof PushError) return fail(400, { message: e.message });
			throw e;
		}
		return { success: 'Push-Testnachricht verschickt.' };
	},

	test: async ({ locals }) => {
		const [me] = await db
			.select({ targets: users.notifyTargets })
			.from(users)
			.where(eq(users.id, locals.user!.id));
		if (!me?.targets.length)
			return fail(400, { message: 'Bitte zuerst mindestens ein Gerät wählen und sichern.' });
		try {
			await testHomeAssistant(me.targets);
		} catch (e) {
			if (e instanceof NotifyError) return fail(400, { message: e.message });
			throw e;
		}
		return { success: 'Testnachricht verschickt.' };
	}
};
