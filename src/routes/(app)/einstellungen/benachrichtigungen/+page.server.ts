import { fail } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import {
	NotifyError,
	listRules,
	notifySettingsView,
	notifyUsers,
	recentNotifications,
	runNotifications,
	saveHomeAssistant,
	saveRule,
	saveSmtp,
	testEmail,
	testHomeAssistant
} from '#lib/server/notify.js';
import { formString } from '#lib/server/validation.js';
import { NOTIFICATION_TYPES, REPEATS } from '#lib/notify.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals.user);
	const [settings, rules, people, log] = await Promise.all([
		notifySettingsView(),
		listRules(),
		notifyUsers(),
		recentNotifications()
	]);
	return { settings, rules, people, log };
};

export const actions: Actions = {
	smtp: async ({ request, locals }) => {
		const user = requireAdmin(locals.user);
		const data = await request.formData();
		const errors = await saveSmtp(
			user,
			{
				host: formString(data, 'host'),
				port: formString(data, 'port'),
				secure: formString(data, 'secure') === 'on',
				user: formString(data, 'user'),
				password: formString(data, 'password'),
				from: formString(data, 'from')
			},
			formString(data, 'clearPassword') === 'on'
		);
		if (errors) return fail(400, { action: 'smtp' as const, errors });
		return { action: 'smtp' as const, success: 'E-Mail-Einstellungen gesichert.' };
	},

	testEmail: async ({ locals }) => {
		const user = requireAdmin(locals.user);
		try {
			await testEmail(user.email ?? null);
		} catch (e) {
			if (e instanceof NotifyError)
				return fail(400, { action: 'test' as const, message: e.message });
			throw e;
		}
		return { action: 'test' as const, success: 'Test-E-Mail verschickt.' };
	},

	ha: async ({ request, locals }) => {
		const user = requireAdmin(locals.user);
		const data = await request.formData();
		const errors = await saveHomeAssistant(user, {
			url: formString(data, 'url'),
			token: formString(data, 'token')
		});
		if (errors) return fail(400, { action: 'ha' as const, errors });
		return { action: 'ha' as const, success: 'Home-Assistant-Einstellungen gesichert.' };
	},

	testHa: async ({ locals }) => {
		requireAdmin(locals.user);
		try {
			await testHomeAssistant([]);
		} catch (e) {
			if (e instanceof NotifyError)
				return fail(400, { action: 'test' as const, message: e.message });
			throw e;
		}
		return { action: 'test' as const, success: 'Home Assistant ist erreichbar.' };
	},

	rule: async ({ request, locals }) => {
		const user = requireAdmin(locals.user);
		const data = await request.formData();
		const type = NOTIFICATION_TYPES.find((t) => t === formString(data, 'type'));
		if (!type) return fail(400, { action: 'rule' as const, message: 'Unbekannte Meldung.' });
		const chosen = data.getAll('recipient').filter((v): v is string => typeof v === 'string');
		await saveRule(user, {
			type,
			enabled: formString(data, 'enabled') === 'on',
			email: formString(data, 'email') === 'on',
			homeAssistant: formString(data, 'homeAssistant') === 'on',
			repeat: REPEATS.find((r) => r === formString(data, 'repeat')) ?? 'once',
			recipients: formString(data, 'recipientMode') === 'chosen' ? chosen : null
		});
		return { action: 'rule' as const, success: 'Meldungsregel gesichert.' };
	},

	run: async ({ locals }) => {
		requireAdmin(locals.user);
		const n = await runNotifications({ force: true });
		return {
			action: 'run' as const,
			success:
				n === 0
					? 'Keine Meldung fällig.'
					: n === 1
						? 'Eine Meldung verschickt.'
						: `${n} Meldungen verschickt.`
		};
	}
};
