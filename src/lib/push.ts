// Web push ("Push aus der Web-App"): which endpoints are accepted and what a message carries.

/** Hosts of the browser push services (Apple, Google, Mozilla, Microsoft). */
const PUSH_HOSTS = [
	'push.apple.com',
	'googleapis.com',
	'push.services.mozilla.com',
	'notify.windows.com'
];

/**
 * A subscription endpoint must be HTTPS on a known push service, so the server never posts to
 * arbitrary addresses. `testOrigin` (only for automated tests) allows one extra origin.
 */
export function isPushEndpoint(endpoint: string, testOrigin?: string | null): boolean {
	let url: URL;
	try {
		url = new URL(endpoint);
	} catch {
		return false;
	}
	if (endpoint.length > 1000) return false;
	if (testOrigin && url.origin === testOrigin) return true;
	if (url.protocol !== 'https:' || url.port) return false;
	const host = url.hostname.toLowerCase();
	return PUSH_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

/** Base64url without padding, as the browser hands out the subscription keys. */
const KEY = /^[A-Za-z0-9_-]{16,200}={0,2}$/;

export type SubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

export function parseSubscription(
	value: unknown,
	testOrigin?: string | null
): SubscriptionInput | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
	const endpoint = typeof v.endpoint === 'string' ? v.endpoint : '';
	const p256dh = typeof v.keys?.p256dh === 'string' ? v.keys.p256dh : '';
	const auth = typeof v.keys?.auth === 'string' ? v.keys.auth : '';
	if (!isPushEndpoint(endpoint, testOrigin) || !KEY.test(p256dh) || !KEY.test(auth)) return null;
	return { endpoint, keys: { p256dh, auth } };
}

/** A readable name for the device list ("iPhone · Safari"). */
export function deviceLabel(userAgent: string | null | undefined): string {
	const ua = userAgent ?? '';
	const device = /iPhone/.test(ua)
		? 'iPhone'
		: /iPad/.test(ua)
			? 'iPad'
			: /Android/.test(ua)
				? 'Android'
				: /Macintosh/.test(ua)
					? 'Mac'
					: /Windows/.test(ua)
						? 'Windows'
						: /Linux/.test(ua)
							? 'Linux'
							: 'Gerät';
	const browser = /Edg\//.test(ua)
		? 'Edge'
		: /Firefox\//.test(ua)
			? 'Firefox'
			: /Chrome\//.test(ua)
				? 'Chrome'
				: /Safari\//.test(ua)
					? 'Safari'
					: null;
	return browser ? `${device} · ${browser}` : device;
}

export type PushMessage = { title: string; body: string; url: string };

/** The JSON the service worker shows; texts are cut to what a notification can display. */
export function pushPayload(title: string, body: string, url: string): string {
	const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
	const message: PushMessage = { title: clip(title, 120), body: clip(body, 400), url };
	return JSON.stringify(message);
}
