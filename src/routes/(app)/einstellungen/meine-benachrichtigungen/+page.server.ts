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
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	const user = locals.user!;
	const [{ smtp, ha }, [me]] = await Promise.all([
		notifySettings(),
		db.select({ targets: users.notifyTargets }).from(users).where(eq(users.id, user.id))
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
		targets
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
