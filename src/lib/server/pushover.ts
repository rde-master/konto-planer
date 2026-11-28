// Pushover as a notification channel: the admin stores the API token of an application made
// at pushover.net, every user their own user key. Both are kept encrypted.
import { eq, isNotNull } from 'drizzle-orm';
import { db } from './db/index.js';
import { appSettings, users } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { decrypt, encrypt } from './secrets.js';
import { getSettings } from './settings.js';
import { DEMO_DISABLED, isDemo } from './demo-mode.js';
import {
	isPushoverKey,
	pushoverFault,
	pushoverFields,
	pushoverProblem,
	pushoverUrl
} from '../pushover.js';

export class PushoverError extends Error {
	/** Set when the API refuses the token or the key: sending again would fail the same way. */
	fault: 'token' | 'user' | null = null;
}

const API = 'https://api.pushover.net';

/** Only for automated tests: a local stand-in for the Pushover API. */
function apiBase(): string {
	return process.env.PUSHOVER_TEST_BASE?.trim() || API;
}

/** The application's API token; null while Pushover is not set up. */
export async function pushoverToken(): Promise<string | null> {
	const [row] = await db
		.select({ token: appSettings.pushoverTokenEnc })
		.from(appSettings)
		.where(eq(appSettings.id, 1));
	return decrypt(row?.token ?? null);
}

/** The admin's part: `token` empty and `clear` removes the application. */
export async function savePushoverToken(
	actor: NonNullable<Actor>,
	token: string,
	clear: boolean
): Promise<string | null> {
	const clean = token.trim();
	if (!clean && !clear) return 'Bitte das API-Token der Anwendung eintragen.';
	if (clean && !isPushoverKey(clean))
		return 'Das API-Token hat 30 Zeichen (Buchstaben und Ziffern).';
	const { defaultLeadDays } = await getSettings();
	await db.insert(appSettings).values({ id: 1, defaultLeadDays }).onConflictDoNothing();
	await db.transaction(async (tx) => {
		await tx
			.update(appSettings)
			.set({ pushoverTokenEnc: clean ? encrypt(clean) : null, updatedAt: new Date() })
			.where(eq(appSettings.id, 1));
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityLabel: 'Pushover',
			after: { pushoverApp: clean ? 'eingetragen' : 'entfernt' }
		});
	});
	return null;
}

/** Whether the user has stored a key (the key itself is never shown again). */
export async function hasPushoverKey(userId: string): Promise<boolean> {
	const [row] = await db
		.select({ key: users.pushoverKeyEnc })
		.from(users)
		.where(eq(users.id, userId));
	return decrypt(row?.key ?? null) !== null;
}

/** A user's own key; empty removes it. */
export async function setPushoverKey(
	actor: NonNullable<Actor>,
	key: string
): Promise<string | null> {
	const clean = key.trim();
	if (clean && !isPushoverKey(clean))
		return 'Der Benutzerschlüssel hat 30 Zeichen (Buchstaben und Ziffern).';
	await db.transaction(async (tx) => {
		await tx
			.update(users)
			.set({ pushoverKeyEnc: clean ? encrypt(clean) : null, updatedAt: new Date() })
			.where(eq(users.id, actor.id));
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Benachrichtigungen',
			after: { pushoverUser: clean ? 'eingetragen' : 'entfernt' }
		});
	});
	return null;
}

/** Users with a readable key (for the notification job). */
export async function pushoverUsers(): Promise<Map<string, string>> {
	const rows = await db
		.select({ id: users.id, key: users.pushoverKeyEnc })
		.from(users)
		.where(isNotNull(users.pushoverKeyEnc));
	const out = new Map<string, string>();
	for (const r of rows) {
		const key = decrypt(r.key);
		if (key) out.set(r.id, key);
	}
	return out;
}

/**
 * Sends one message. `page` is a page of the app (relative); it becomes a link in the message
 * if the app knows its public address (ORIGIN).
 */
export async function sendPushover(
	token: string,
	userKey: string,
	title: string,
	message: string,
	page?: string
) {
	if (isDemo()) throw new PushoverError(DEMO_DISABLED);
	const fields = pushoverFields({
		token,
		user: userKey,
		title,
		message,
		url: page === undefined ? null : pushoverUrl(process.env.ORIGIN, page)
	});
	let res: Response;
	try {
		res = await fetch(`${apiBase()}/1/messages.json`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams(fields),
			signal: AbortSignal.timeout(10_000)
		});
	} catch {
		// The cause may quote the request: never pass it on.
		throw new PushoverError('Pushover ist nicht erreichbar.');
	}
	const body: unknown = await res.json().catch(() => null);
	const problem = pushoverProblem(res.status, body);
	if (problem) {
		const error = new PushoverError(problem);
		error.fault = pushoverFault(body);
		throw error;
	}
}

/** Test button: a message to the user's own key. */
export async function testPushover(userId: string) {
	const token = await pushoverToken();
	if (!token) throw new PushoverError('Pushover ist noch nicht eingerichtet.');
	const key = (await pushoverUsers()).get(userId);
	if (!key) throw new PushoverError('Bitte zuerst deinen Benutzerschlüssel eintragen und sichern.');
	await sendPushover(
		token,
		key,
		'Konto Planer',
		'Test: Benachrichtigungen über Pushover kommen an.',
		'einstellungen/meine-benachrichtigungen'
	);
}
