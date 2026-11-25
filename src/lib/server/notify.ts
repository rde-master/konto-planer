import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { db } from './db/index.js';
import {
	accountAccess,
	accounts,
	appSettings,
	contracts,
	notificationLog,
	notificationRules,
	recurringItems,
	users
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { decrypt, encrypt } from './secrets.js';
import { getSettings } from './settings.js';
import { toContract } from './recurring.js';
import { cancelSoon, contractStatus } from '../contracts.js';
import {
	NOTIFICATION_TYPES,
	SEND_HOUR,
	berlinHour,
	shouldSend,
	type NotificationType,
	type Repeat
} from '../notify.js';
import { berlinDay, formatDay, todayBerlin } from '../dates.js';

export class NotifyError extends Error {}

// --- settings: SMTP and Home Assistant --------------------------------------------------------

export type SmtpSettings = {
	host: string;
	port: number;
	secure: boolean;
	user: string | null;
	password: string | null;
	from: string;
};
export type HaSettings = { url: string; token: string };

/** Connection settings, with decrypted secrets (server only). */
export async function notifySettings(): Promise<{
	smtp: SmtpSettings | null;
	ha: HaSettings | null;
}> {
	const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
	const smtp =
		row?.smtpHost && row.smtpFrom
			? {
					host: row.smtpHost,
					port: row.smtpPort ?? (row.smtpSecure ? 465 : 587),
					secure: row.smtpSecure,
					user: row.smtpUser,
					password: decrypt(row.smtpPasswordEnc),
					from: row.smtpFrom
				}
			: null;
	const token = decrypt(row?.haTokenEnc ?? null);
	const ha = row?.haUrl && token ? { url: row.haUrl, token } : null;
	return { smtp, ha };
}

/** What the settings page shows (never the secrets themselves). */
export async function notifySettingsView() {
	const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
	return {
		smtpHost: row?.smtpHost ?? '',
		smtpPort: row?.smtpPort ? String(row.smtpPort) : '',
		smtpSecure: row?.smtpSecure ?? false,
		smtpUser: row?.smtpUser ?? '',
		smtpFrom: row?.smtpFrom ?? '',
		smtpPasswordSet: !!row?.smtpPasswordEnc,
		haUrl: row?.haUrl ?? '',
		haTokenSet: !!row?.haTokenEnc
	};
}

async function ensureRow() {
	const defaults = await getSettings();
	await db
		.insert(appSettings)
		.values({ id: 1, defaultLeadDays: defaults.defaultLeadDays })
		.onConflictDoNothing();
}

export type SmtpInput = {
	host: string;
	port: string;
	secure: boolean;
	user: string;
	password: string;
	from: string;
};

export function validateSmtp(input: SmtpInput) {
	const errors: Partial<Record<string, string>> = {};
	const host = input.host.trim();
	const from = input.from.trim();
	const port = input.port.trim() ? Number(input.port) : null;
	if (host && !/^[a-z0-9.-]+$/i.test(host))
		errors.host = 'Bitte einen gültigen Servernamen eingeben.';
	if (port !== null && (!Number.isInteger(port) || port < 1 || port > 65535))
		errors.port = 'Port von 1 bis 65535.';
	if (host && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$|<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/.test(from))
		errors.from = 'Bitte eine Absender-Adresse eingeben.';
	return {
		errors,
		values: {
			host: host || null,
			port,
			secure: input.secure,
			user: input.user.trim() || null,
			from: from || null
		}
	};
}

export async function saveSmtp(
	actor: NonNullable<Actor>,
	input: SmtpInput,
	clearPassword: boolean
) {
	const { errors, values } = validateSmtp(input);
	if (Object.keys(errors).length) return errors;
	await ensureRow();
	await db.transaction(async (tx) => {
		await tx
			.update(appSettings)
			.set({
				smtpHost: values.host,
				smtpPort: values.port,
				smtpSecure: values.secure,
				smtpUser: values.user,
				smtpFrom: values.from,
				...(input.password
					? { smtpPasswordEnc: encrypt(input.password) }
					: clearPassword
						? { smtpPasswordEnc: null }
						: {}),
				updatedAt: new Date()
			})
			.where(eq(appSettings.id, 1));
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityLabel: 'E-Mail (SMTP)',
			after: {
				smtpHost: values.host,
				smtpPort: values.port,
				smtpUser: values.user,
				smtpFrom: values.from,
				passwordChanged: !!input.password || clearPassword
			}
		});
	});
	return null;
}

export async function saveHomeAssistant(
	actor: NonNullable<Actor>,
	input: { url: string; token: string }
) {
	const url = input.url.trim().replace(/\/+$/, '');
	if (url && !/^https?:\/\/[^\s]+$/i.test(url))
		return { url: 'Bitte eine Adresse wie http://homeassistant.local:8123 eingeben.' };
	await ensureRow();
	await db.transaction(async (tx) => {
		await tx
			.update(appSettings)
			.set({
				haUrl: url || null,
				...(input.token
					? { haTokenEnc: encrypt(input.token.trim()) }
					: !url
						? { haTokenEnc: null }
						: {}),
				updatedAt: new Date()
			})
			.where(eq(appSettings.id, 1));
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityLabel: 'Home Assistant',
			after: { haUrl: url || null, tokenChanged: !!input.token }
		});
	});
	return null;
}

// --- channels ---------------------------------------------------------------------------------

export async function sendEmail(smtp: SmtpSettings, to: string, subject: string, text: string) {
	const transport = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.secure,
		auth: smtp.user ? { user: smtp.user, pass: smtp.password ?? '' } : undefined,
		connectionTimeout: 10_000,
		greetingTimeout: 10_000
	});
	await transport.sendMail({ from: smtp.from, to, subject, text });
}

async function haFetch(ha: HaSettings, path: string, init?: RequestInit) {
	const res = await fetch(`${ha.url}/api${path}`, {
		...init,
		headers: { Authorization: `Bearer ${ha.token}`, 'Content-Type': 'application/json' },
		signal: AbortSignal.timeout(10_000)
	});
	if (!res.ok) throw new NotifyError(`Home Assistant antwortet mit ${res.status}.`);
	return res;
}

/** Notify services of Home Assistant ("mobile_app_iphone_erika", …). */
export async function haServices(ha: HaSettings): Promise<string[]> {
	const res = await haFetch(ha, '/services');
	const domains = (await res.json()) as { domain: string; services: Record<string, unknown> }[];
	const notify = domains.find((d) => d.domain === 'notify');
	return notify
		? Object.keys(notify.services)
				.filter((s) => s !== 'notify')
				.sort()
		: [];
}

export async function haNotify(ha: HaSettings, service: string, title: string, message: string) {
	if (!/^[a-z0-9_]+$/.test(service)) throw new NotifyError('Ungültiger Dienst.');
	await haFetch(ha, `/services/notify/${service}`, {
		method: 'POST',
		body: JSON.stringify({ title, message })
	});
}

function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

/** Test buttons: a message to the given address / the user's devices. */
export async function testEmail(to: string | null) {
	const { smtp } = await notifySettings();
	if (!smtp) throw new NotifyError('Bitte zuerst den SMTP-Zugang eintragen.');
	if (!to) throw new NotifyError('Für deinen Benutzer ist keine E-Mail-Adresse eingetragen.');
	try {
		await sendEmail(
			smtp,
			to,
			'Konto Planer: Test',
			'Diese Test-E-Mail kommt vom Konto Planer. Der E-Mail-Versand funktioniert.'
		);
	} catch (e) {
		throw new NotifyError(`E-Mail konnte nicht gesendet werden: ${errorText(e)}`);
	}
}

export async function testHomeAssistant(targets: string[]) {
	const { ha } = await notifySettings();
	if (!ha) throw new NotifyError('Bitte zuerst Adresse und Token von Home Assistant eintragen.');
	try {
		await haFetch(ha, '/');
		for (const t of targets)
			await haNotify(ha, t, 'Konto Planer', 'Test: Benachrichtigungen kommen an.');
	} catch (e) {
		throw new NotifyError(`Home Assistant ist nicht erreichbar: ${errorText(e)}`);
	}
}

// --- rules ------------------------------------------------------------------------------------

export type Rule = {
	type: NotificationType;
	enabled: boolean;
	email: boolean;
	homeAssistant: boolean;
	/** null = everyone with edit right on the account. */
	recipients: string[] | null;
	repeat: Repeat;
};

export async function listRules(): Promise<Rule[]> {
	const rows = await db.select().from(notificationRules);
	return NOTIFICATION_TYPES.map((type) => {
		const r = rows.find((x) => x.type === type);
		return {
			type,
			enabled: r?.enabled ?? true,
			email: r?.email ?? true,
			homeAssistant: r?.homeAssistant ?? false,
			recipients: r?.recipients ?? null,
			repeat: (r?.repeat as Repeat) ?? 'once'
		};
	});
}

export async function saveRule(actor: NonNullable<Actor>, rule: Rule) {
	await db.transaction(async (tx) => {
		const { type, ...set } = rule;
		await tx
			.insert(notificationRules)
			.values({ type, ...set })
			.onConflictDoUpdate({
				target: notificationRules.type,
				set: { ...set, updatedAt: new Date() }
			});
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityLabel: 'Meldungsregel',
			after: {
				notificationType: type,
				enabled: rule.enabled,
				email: rule.email,
				homeAssistant: rule.homeAssistant,
				repeat: rule.repeat
			}
		});
	});
}

/** Home Assistant devices of a user. */
export async function setNotifyTargets(actor: NonNullable<Actor>, targets: string[]) {
	await db.transaction(async (tx) => {
		await tx
			.update(users)
			.set({ notifyTargets: targets, updatedAt: new Date() })
			.where(eq(users.id, actor.id));
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Benachrichtigungen',
			after: { notifyTargets: targets.join(', ') || null }
		});
	});
}

// --- the job ----------------------------------------------------------------------------------

type Event = {
	type: NotificationType;
	key: string;
	accountId: string;
	title: string;
	message: string;
};

/** Contracts whose notice deadline is near ("bald kündbar"). */
async function cancelDeadlineEvents(today: string): Promise<Event[]> {
	const { defaultLeadDays } = await getSettings();
	const rows = await db
		.select({ item: recurringItems, contract: contracts, accountName: accounts.name })
		.from(contracts)
		.innerJoin(recurringItems, eq(recurringItems.id, contracts.recurringId))
		.innerJoin(accounts, eq(accounts.id, recurringItems.accountId))
		.where(and(isNull(recurringItems.archivedAt), isNull(accounts.archivedAt)));
	const out: Event[] = [];
	for (const r of rows) {
		const c = toContract(r.contract);
		if (!cancelSoon(c, today, defaultLeadDays)) continue;
		const status = contractStatus(c, today);
		if (status.state !== 'fixed') continue;
		out.push({
			type: 'cancel_deadline',
			key: `${r.item.id}:${status.deadline}`,
			accountId: r.item.accountId,
			title: `Kündigungsfrist: ${r.item.name}`,
			message: `${r.item.name} (${r.accountName}) lässt sich bis ${formatDay(status.deadline)} kündigen; sonst läuft der Vertrag über den ${formatDay(status.end)} hinaus.`
		});
	}
	return out;
}

/** Users with edit right on the account (admins included). */
async function editorsOf(accountId: string): Promise<string[]> {
	const [admins, editors] = await Promise.all([
		db.select({ id: users.id }).from(users).where(eq(users.role, 'admin')),
		db
			.select({ id: accountAccess.userId })
			.from(accountAccess)
			.where(and(eq(accountAccess.accountId, accountId), eq(accountAccess.level, 'edit')))
	]);
	return [...new Set([...admins, ...editors].map((u) => u.id))];
}

/**
 * Sends due notifications: from 8 o'clock Berlin (or always with `force`), once or once a day
 * per notification, user and channel. Returns the number of messages sent.
 */
export async function runNotifications({ force = false, now = new Date() } = {}): Promise<number> {
	if (!force && berlinHour(now) < SEND_HOUR) return 0;
	const today = todayBerlin(now);
	const { smtp, ha } = await notifySettings();
	if (!smtp && !ha) return 0;
	const rules = new Map((await listRules()).map((r) => [r.type, r]));
	const events = (await cancelDeadlineEvents(today)).filter((e) => rules.get(e.type)?.enabled);
	if (!events.length) return 0;
	const people = await db
		.select({ id: users.id, email: users.email, targets: users.notifyTargets })
		.from(users);
	const byId = new Map(people.map((p) => [p.id, p]));
	let sent = 0;
	await db.transaction(async (tx) => {
		// One run at a time (hourly job, "Jetzt prüfen").
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext('kontoplaner.notify'))`);
		for (const e of events) {
			const rule = rules.get(e.type)!;
			const editors = await editorsOf(e.accountId);
			const recipients = rule.recipients
				? rule.recipients.filter((id) => editors.includes(id))
				: editors;
			for (const userId of recipients) {
				const person = byId.get(userId);
				if (!person) continue;
				const channels: ('email' | 'ha')[] = [];
				if (rule.email && smtp && person.email) channels.push('email');
				if (rule.homeAssistant && ha && person.targets.length) channels.push('ha');
				for (const channel of channels) {
					const [last] = await tx
						.select({ sentAt: notificationLog.sentAt })
						.from(notificationLog)
						.where(
							and(
								eq(notificationLog.type, e.type),
								eq(notificationLog.key, e.key),
								eq(notificationLog.userId, userId),
								eq(notificationLog.channel, channel),
								eq(notificationLog.ok, true)
							)
						)
						.orderBy(desc(notificationLog.sentAt))
						.limit(1);
					if (!shouldSend(last ? berlinDay(last.sentAt) : null, rule.repeat, today)) continue;
					let error: string | null = null;
					try {
						if (channel === 'email')
							await sendEmail(smtp!, person.email!, `Konto Planer: ${e.title}`, e.message);
						else for (const t of person.targets) await haNotify(ha!, t, e.title, e.message);
						sent++;
					} catch (err) {
						error = errorText(err).slice(0, 300);
					}
					await tx.insert(notificationLog).values({
						type: e.type,
						key: e.key,
						userId,
						channel,
						title: e.title,
						ok: error === null,
						error
					});
				}
			}
		}
	});
	return sent;
}

/** Latest sent notifications (admin view). */
export async function recentNotifications(limit = 20) {
	return db
		.select({
			id: notificationLog.id,
			title: notificationLog.title,
			channel: notificationLog.channel,
			ok: notificationLog.ok,
			error: notificationLog.error,
			sentAt: notificationLog.sentAt,
			userName: users.name
		})
		.from(notificationLog)
		.leftJoin(users, eq(users.id, notificationLog.userId))
		.orderBy(desc(notificationLog.sentAt))
		.limit(limit);
}

/** Users for the recipient choice. */
export async function notifyUsers() {
	return db
		.select({ id: users.id, name: users.name, email: users.email })
		.from(users)
		.where(inArray(users.role, ['admin', 'user']));
}
