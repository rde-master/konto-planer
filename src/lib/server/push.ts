import { and, eq, isNull } from 'drizzle-orm';
import { generateRequestDetails, generateVAPIDKeys } from 'web-push';
import { db } from './db/index.js';
import { appSettings, pushSubscriptions } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { decrypt, encrypt } from './secrets.js';
import { getSettings } from './settings.js';
import { DEMO_DISABLED, isDemo } from './demo-mode.js';
import { deviceLabel, parseSubscription, pushPayload } from '../push.js';

export class PushError extends Error {}

/** Only for automated tests: one extra origin a subscription may point to. */
export function pushTestOrigin(): string | null {
	return process.env.PUSH_TEST_ORIGIN?.trim() || null;
}

type Vapid = { publicKey: string; privateKey: string };

/** The VAPID key pair; created and stored (private key encrypted) on first use. */
export async function vapidKeys(): Promise<Vapid> {
	const read = async () => {
		const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
		const privateKey = decrypt(row?.vapidPrivateKeyEnc ?? null);
		return row?.vapidPublicKey && privateKey ? { publicKey: row.vapidPublicKey, privateKey } : null;
	};
	const existing = await read();
	if (existing) return existing;
	const { defaultLeadDays } = await getSettings();
	await db.insert(appSettings).values({ id: 1, defaultLeadDays }).onConflictDoNothing();
	const keys = generateVAPIDKeys();
	// Only the first of two concurrent requests stores its pair.
	await db
		.update(appSettings)
		.set({ vapidPublicKey: keys.publicKey, vapidPrivateKeyEnc: encrypt(keys.privateKey) })
		.where(and(eq(appSettings.id, 1), isNull(appSettings.vapidPublicKey)));
	const stored = await read();
	if (!stored) throw new PushError('Die Push-Schlüssel konnten nicht angelegt werden.');
	return stored;
}

function subject(): string {
	const origin = process.env.ORIGIN?.trim();
	return origin?.startsWith('https://') ? origin : 'mailto:push@konto-planer.invalid';
}

export async function listDevices(userId: string) {
	return db
		.select({
			id: pushSubscriptions.id,
			label: pushSubscriptions.label,
			endpoint: pushSubscriptions.endpoint,
			createdAt: pushSubscriptions.createdAt,
			lastSentAt: pushSubscriptions.lastSentAt
		})
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.orderBy(pushSubscriptions.createdAt);
}

/** Stores the subscription of this device (a device used by someone else moves over). */
export async function subscribe(
	actor: NonNullable<Actor>,
	value: unknown,
	userAgent: string | null
) {
	const sub = parseSubscription(value, pushTestOrigin());
	if (!sub) throw new PushError('Dieses Gerät meldet keine gültige Push-Adresse.');
	const label = deviceLabel(userAgent);
	await db.transaction(async (tx) => {
		await tx
			.insert(pushSubscriptions)
			.values({
				userId: actor.id,
				endpoint: sub.endpoint,
				p256dh: sub.keys.p256dh,
				auth: sub.keys.auth,
				label
			})
			.onConflictDoUpdate({
				target: pushSubscriptions.endpoint,
				set: { userId: actor.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, label }
			});
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Benachrichtigungen',
			after: { pushDevice: label }
		});
	});
}

/** Removes one of the actor's devices, by id or by endpoint (browser unsubscribed). */
export async function unsubscribe(
	actor: NonNullable<Actor>,
	ref: { id?: string; endpoint?: string }
) {
	const where = ref.id
		? /^[0-9a-f-]{36}$/i.test(ref.id)
			? eq(pushSubscriptions.id, ref.id)
			: null
		: ref.endpoint
			? eq(pushSubscriptions.endpoint, ref.endpoint)
			: null;
	if (!where) return;
	await db.transaction(async (tx) => {
		const gone = await tx
			.delete(pushSubscriptions)
			.where(and(where, eq(pushSubscriptions.userId, actor.id)))
			.returning({ label: pushSubscriptions.label });
		if (!gone.length) return;
		await audit(tx, {
			actor,
			entityType: 'user',
			action: 'update',
			entityId: actor.id,
			entityLabel: 'Benachrichtigungen',
			before: { pushDevice: gone[0].label }
		});
	});
}

type Target = { id: string; endpoint: string; p256dh: string; auth: string };

/** Sends one message to one device. A device the push service no longer knows is removed. */
async function sendTo(target: Target, payload: string, vapid: Vapid) {
	const details = generateRequestDetails(
		{ endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
		payload,
		{
			vapidDetails: { subject: subject(), ...vapid },
			TTL: 24 * 60 * 60,
			urgency: 'normal'
		}
	);
	const headers: Record<string, string> = {};
	for (const [k, v] of Object.entries(details.headers))
		if (k.toLowerCase() !== 'content-length') headers[k] = String(v);
	const res = await fetch(details.endpoint, {
		method: details.method,
		headers,
		body: details.body ? new Uint8Array(details.body) : undefined,
		signal: AbortSignal.timeout(10_000)
	});
	if (res.status === 404 || res.status === 410) {
		await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, target.id));
		throw new PushError('Gerät ist nicht mehr angemeldet und wurde entfernt.');
	}
	if (!res.ok) throw new PushError(`Push-Dienst antwortet mit ${res.status}.`);
	await db
		.update(pushSubscriptions)
		.set({ lastSentAt: new Date() })
		.where(eq(pushSubscriptions.id, target.id));
}

/**
 * Sends a message to all devices of a user; `url` is the page to open, relative to the app
 * ("konten/…"). Fails only when no device got it.
 */
export async function pushToUser(userId: string, title: string, body: string, url: string) {
	const targets = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId));
	if (isDemo()) throw new PushError(DEMO_DISABLED);
	if (!targets.length) throw new PushError('Kein Gerät für Push angemeldet.');
	const vapid = await vapidKeys();
	const payload = pushPayload(title, body, url);
	const errors: string[] = [];
	let ok = 0;
	for (const t of targets)
		try {
			await sendTo(t, payload, vapid);
			ok++;
		} catch (e) {
			errors.push(e instanceof Error ? e.message : String(e));
		}
	if (!ok) throw new PushError(errors.join(' '));
	return ok;
}

/** Users with at least one push device. */
export async function pushUsers(): Promise<Set<string>> {
	const rows = await db.selectDistinct({ id: pushSubscriptions.userId }).from(pushSubscriptions);
	return new Set(rows.map((r) => r.id));
}
