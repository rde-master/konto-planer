import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { db } from './db/index.js';
import {
	accountAccess,
	accounts,
	appSettings,
	bookings,
	contracts,
	dueItems,
	imports,
	notificationLog,
	notificationRules,
	recurringItems,
	subscriptionHints,
	users
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { decrypt, encrypt } from './secrets.js';
import { DEMO_DISABLED, isDemo } from './demo-mode.js';
import { getSettings } from './settings.js';
import { toContract } from './recurring.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import { pushToUser, pushUsers } from './push.js';
import { remindersFor } from './manual-transfers.js';
import { suggestionsFor } from './savings-suggestion.js';
import { forecastFor } from './forecast.js';
import { increasesOn } from './watch.js';
import { importInfo } from './import-reminder.js';
import { needsImport } from '../import-reminder.js';
import { addMonths } from '../recurring.js';
import { cancelSoon, contractStatus } from '../contracts.js';
import {
	NOTIFICATION_TYPES,
	SEND_HOUR,
	berlinHour,
	isMissing,
	shouldSend,
	type NotificationType,
	type Repeat
} from '../notify.js';
import { berlinDay, formatDay, todayBerlin } from '../dates.js';
import { formatEuro } from '../money.js';
import { formatIban } from '../iban.js';

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

export async function sendEmail(
	smtp: SmtpSettings,
	to: string,
	subject: string,
	text: string,
	html?: string
) {
	if (isDemo()) throw new NotifyError(DEMO_DISABLED);
	const transport = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.secure,
		auth: smtp.user ? { user: smtp.user, pass: smtp.password ?? '' } : undefined,
		connectionTimeout: 10_000,
		greetingTimeout: 10_000
	});
	await transport.sendMail({ from: smtp.from, to, subject, text, ...(html ? { html } : {}) });
}

async function haFetch(ha: HaSettings, path: string, init?: RequestInit) {
	if (isDemo()) throw new NotifyError(DEMO_DISABLED);
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

/** Sets the state of an entity (creates it if needed), e.g. "sensor.konto_planer_verfuegbar". */
export async function haSetState(
	ha: HaSettings,
	entity: string,
	state: string,
	attributes: Record<string, unknown>
) {
	if (!/^sensor\.[a-z0-9_]+$/.test(entity)) throw new NotifyError('Ungültiger Sensor.');
	await haFetch(ha, `/states/${entity}`, {
		method: 'POST',
		body: JSON.stringify({ state, attributes })
	});
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
	push: boolean;
	/** null = everyone with edit right on the account. */
	recipients: string[] | null;
	repeat: Repeat;
	/** Days until an expected payment counts as missing. */
	toleranceDays: number;
	/** Bank days before the bank day a manual transfer is reminded. */
	leadDays: number;
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
			push: r?.push ?? false,
			recipients: r?.recipients ?? null,
			repeat: (r?.repeat as Repeat) ?? 'once',
			toleranceDays: r?.toleranceDays ?? 3,
			leadDays: r?.leadDays ?? 1
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
				push: rule.push,
				repeat: rule.repeat,
				toleranceDays: rule.toleranceDays,
				transferLeadDays: rule.leadDays
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
	/** Page to open from a push message, relative to the app. */
	url: string;
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
			url: `dauerposten/${r.item.id}`,
			title: `Kündigungsfrist: ${r.item.name}`,
			message: `${r.item.name} (${r.accountName}) lässt sich bis ${formatDay(status.deadline)} kündigen; sonst läuft der Vertrag über den ${formatDay(status.end)} hinaus.`
		});
	}
	return out;
}

/** System view for the job: sees every account like an admin. */
const SYSTEM = { id: '00000000-0000-0000-0000-000000000000', role: 'admin' as const };

/** Minimum balance and overdraft of the active giro accounts. */
async function accountEvents(): Promise<Event[]> {
	const list = (await listAccountsFor(SYSTEM)).filter((a) => a.type === 'giro' && !a.archivedAt);
	if (!list.length) return [];
	const balances = await balancesOf(list);
	const plans = await plansFor(SYSTEM, list, balances);
	const out: Event[] = [];
	for (const a of list) {
		const plan = plans.get(a.id);
		const balance = balances.get(a.id) ?? a.openingBalance;
		if (!plan) continue;
		const until = plan.cutoff.date;
		if (plan.plan.available < 0)
			out.push({
				type: 'minimum_shortfall',
				key: `${a.id}:${until}`,
				accountId: a.id,
				url: `konten/${a.id}`,
				title: `Mindestbestand unterschritten: ${a.name}`,
				message: `Auf ${a.name} fehlen ${formatEuro(-plan.plan.available)} bis zum ${formatDay(until)} (Stand ${formatEuro(balance)}, Mindestbestand ${formatEuro(plan.plan.minimum)}).`
			});
		if (balance < 0)
			out.push({
				type: 'overdraft_reached',
				key: `${a.id}:${until}`,
				accountId: a.id,
				url: `konten/${a.id}`,
				title: `Dispo erreicht: ${a.name}`,
				message: `${a.name} steht mit ${formatEuro(balance)} im Minus${a.overdraftLimit ? ` (Dispo ${formatEuro(a.overdraftLimit)})` : ''}.`
			});
		if (plan.plan.exceedsOverdraft && plan.plan.lowest)
			out.push({
				type: 'overdraft_risk',
				key: `${a.id}:${until}`,
				accountId: a.id,
				url: `konten/${a.id}`,
				title: `Dispo in Gefahr: ${a.name}`,
				message: `Nach Plan sinkt ${a.name} am ${formatDay(plan.plan.lowest.date)} auf ${formatEuro(plan.plan.lowest.balance)}${a.overdraftLimit ? ` und damit unter den Dispo von ${formatEuro(a.overdraftLimit)}` : ''}.`
			});
	}
	return out;
}

/** Provisional bookings not confirmed by an import after the tolerance. */
export async function missingPayments(today: string, tolerance: number, accountIds?: string[]) {
	const imported = new Set(
		(
			await db
				.selectDistinct({ id: imports.accountId })
				.from(imports)
				.where(and(eq(imports.status, 'done'), isNull(imports.undoneAt)))
		).map((r) => r.id)
	);
	const rows = await db
		.select({
			dueId: dueItems.id,
			bookingId: bookings.id,
			bookingDate: bookings.bookingDate,
			amount: bookings.amount,
			accountId: bookings.accountId,
			accountName: accounts.name,
			name: recurringItems.name
		})
		.from(dueItems)
		.innerJoin(bookings, eq(bookings.id, dueItems.bookingId))
		.innerJoin(accounts, eq(accounts.id, bookings.accountId))
		.innerJoin(recurringItems, eq(recurringItems.id, dueItems.recurringId))
		.where(
			and(
				eq(dueItems.status, 'provisional'),
				eq(bookings.source, 'provisional'),
				isNull(accounts.archivedAt),
				accountIds ? inArray(bookings.accountId, accountIds.length ? accountIds : ['']) : undefined
			)
		);
	return rows.filter((r) => isMissing(r.bookingDate, today, tolerance, imported.has(r.accountId)));
}

async function missingEvents(today: string, tolerance: number): Promise<Event[]> {
	return (await missingPayments(today, tolerance)).map((r) => ({
		type: 'payment_missing' as const,
		key: r.dueId,
		accountId: r.accountId,
		url: `buchungen/${r.bookingId}`,
		title: `Zahlung ausgeblieben: ${r.name}`,
		message: `${r.name} (${formatEuro(Math.abs(r.amount))}) war am ${formatDay(r.bookingDate)} auf ${r.accountName} fällig, ist aber im Import nicht aufgetaucht. Behalten, verschieben oder zurücknehmen kannst du die vorläufige Buchung in der App.`
	}));
}

/** Manual transfers whose reminder day has come and that are not done yet. */
async function manualTransferEvents(today: string, lead: number): Promise<Event[]> {
	return (await remindersFor(SYSTEM, today, lead)).map((r) => {
		const to = r.targetName ?? r.payee;
		const due = r.overdue
			? `war am ${formatDay(r.bookingDate)} fällig`
			: r.bookingDate === today
				? 'ist heute fällig'
				: `ist am ${formatDay(r.bookingDate)} fällig`;
		return {
			type: 'manual_transfer' as const,
			key: `${r.recurringId}:${r.dueDate}`,
			accountId: r.accountId,
			url: '',
			title: `Überweisen: ${r.name}`,
			message: `${r.name} über ${formatEuro(r.amount)} von ${r.accountName}${to ? ` an ${to}` : ''}${r.iban ? ` (${formatIban(r.iban)})` : ''} ${due}. In der Übersicht als „Überwiesen“ abhaken.`
		};
	});
}

/** Payday: what can go to the savings account without touching the minimum balance. */
async function savingsEvents(today: string): Promise<Event[]> {
	return (await suggestionsFor(SYSTEM, today)).map((s) => ({
		type: 'savings_suggestion' as const,
		key: `${s.accountId}:${s.salaryDueDate}`,
		accountId: s.accountId,
		url: '',
		title: `Sparvorschlag: ${formatEuro(s.amount)} von ${s.accountName}`,
		message: `Das Gehalt ist auf ${s.accountName} gebucht. ${formatEuro(s.amount)} können aufs Sparbuch, ohne den Mindestbestand bis zum ${formatDay(s.cutoff)} zu gefährden. Umbuchen kannst du in der Übersicht.`
	}));
}

/** Credit cards whose limit is exceeded now or by the plan within the next two months. */
async function creditLimitEvents(today: string): Promise<Event[]> {
	const cards = (await listAccountsFor(SYSTEM)).filter(
		(a) => a.type === 'kreditkarte' && !a.archivedAt && a.overdraftLimit > 0
	);
	if (!cards.length) return [];
	const balances = await balancesOf(cards);
	const out: Event[] = [];
	for (const card of cards) {
		const balance = balances.get(card.id) ?? card.openingBalance;
		const f = await forecastFor(SYSTEM, card, balance, today);
		const soon = addMonths(today, 2);
		const low = [
			[today, balance] as [string, number],
			...f.series.filter(([d]) => d <= soon)
		].reduce((a, b) => (b[1] < a[1] ? b : a));
		if (low[1] >= -card.overdraftLimit) continue;
		out.push({
			type: 'credit_limit',
			key: `${card.id}:${today.slice(0, 7)}`,
			accountId: card.id,
			url: `konten/${card.id}`,
			title: `Kreditrahmen: ${card.name}`,
			message:
				low[0] === today
					? `${card.name} steht mit ${formatEuro(balance)} über dem Kreditrahmen von ${formatEuro(card.overdraftLimit)}.`
					: `Nach Plan erreicht ${card.name} am ${formatDay(low[0])} ${formatEuro(low[1])} und damit mehr als den Kreditrahmen von ${formatEuro(card.overdraftLimit)}.`
		});
	}
	return out;
}

/** Expenses that became more expensive (new amount or a higher imported debit). */
async function priceEvents(today: string): Promise<Event[]> {
	const ids = (await listAccountsFor(SYSTEM)).filter((a) => !a.archivedAt).map((a) => a.id);
	return (await increasesOn(ids, today)).map((x) => ({
		type: 'price_increase' as const,
		key: `${x.recurringId}:${x.from}:${x.source}`,
		accountId: x.accountId,
		url: `dauerposten/${x.recurringId}`,
		title: `Teurer: ${x.name} (+${x.percent} %)`,
		message:
			x.source === 'paid'
				? `${x.name} wurde am ${formatDay(x.from)} mit ${formatEuro(x.after)} statt ${formatEuro(x.before)} abgebucht (+${x.percent} %, ${formatEuro(x.perYear)} im Jahr mehr). Passe den Betrag am Dauerposten an, wenn das so bleibt.`
				: `${x.name} kostet ab ${formatDay(x.from)} ${formatEuro(x.after)} statt ${formatEuro(x.before)} (+${x.percent} %, ${formatEuro(x.perYear)} im Jahr mehr).`
	}));
}

/** New regular debits the import found and nobody has created or dismissed. */
async function subscriptionEvents(): Promise<Event[]> {
	const rows = await db
		.select({ hint: subscriptionHints, accountName: accounts.name })
		.from(subscriptionHints)
		.innerJoin(accounts, eq(accounts.id, subscriptionHints.accountId))
		.where(and(eq(subscriptionHints.status, 'open'), isNull(accounts.archivedAt)));
	return rows.map(({ hint, accountName }) => ({
		type: 'new_subscription' as const,
		key: hint.id,
		accountId: hint.accountId,
		url: '',
		title: `Neues Abo? ${hint.name}`,
		message: `${hint.name} wurde ${hint.count}-mal von ${accountName} abgebucht, zuletzt am ${formatDay(hint.lastDate)} über ${formatEuro(hint.amount)}, aber es gibt keinen Dauerposten dafür. In der Übersicht kannst du ihn anlegen oder den Hinweis ignorieren.`
	}));
}

/** Monthly reminder (the 30th, February the last day) for accounts imported before. */
async function importReminderEvents(today: string): Promise<Event[]> {
	const list = (await listAccountsFor(SYSTEM)).filter(
		(a) => a.type !== 'sparbuch' && !a.archivedAt
	);
	const info = await importInfo(list.map((a) => a.id));
	return list
		.filter((a) => needsImport(today, info.get(a.id)?.lastImportDay ?? null))
		.map((a) => {
			const i = info.get(a.id)!;
			return {
				type: 'import_reminder' as const,
				key: `${a.id}:${today.slice(0, 7)}`,
				accountId: a.id,
				url: `konten/${a.id}/import`,
				title: `Import fällig: ${a.name}`,
				message: `Zeit für den Umsatzimport von ${a.name}: der letzte Import war am ${formatDay(i.lastImportDay!)}${i.importDate ? `, Buchungen bis ${formatDay(i.importDate)}` : ''}. So bleiben Mindestbestand und verfügbarer Betrag genau.`
			};
		});
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
	if (isDemo() || (!force && berlinHour(now) < SEND_HOUR)) return 0;
	const today = todayBerlin(now);
	const { smtp, ha } = await notifySettings();
	const pushers = await pushUsers();
	if (!smtp && !ha && !pushers.size) return 0;
	const rules = new Map((await listRules()).map((r) => [r.type, r]));
	const on = (t: NotificationType) => rules.get(t)?.enabled ?? false;
	const events = [
		...(on('cancel_deadline') ? await cancelDeadlineEvents(today) : []),
		...(on('minimum_shortfall') || on('overdraft_reached') || on('overdraft_risk')
			? await accountEvents()
			: []),
		...(on('payment_missing')
			? await missingEvents(today, rules.get('payment_missing')!.toleranceDays)
			: []),
		...(on('manual_transfer')
			? await manualTransferEvents(today, rules.get('manual_transfer')!.leadDays)
			: []),
		...(on('savings_suggestion') ? await savingsEvents(today) : []),
		...(on('credit_limit') ? await creditLimitEvents(today) : []),
		...(on('price_increase') ? await priceEvents(today) : []),
		...(on('new_subscription') ? await subscriptionEvents() : []),
		...(on('import_reminder') ? await importReminderEvents(today) : [])
	].filter((e) => on(e.type));
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
				const channels: ('email' | 'ha' | 'push')[] = [];
				if (rule.email && smtp && person.email) channels.push('email');
				if (rule.homeAssistant && ha && person.targets.length) channels.push('ha');
				if (rule.push && pushers.has(userId)) channels.push('push');
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
						else if (channel === 'push') await pushToUser(userId, e.title, e.message, e.url);
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
