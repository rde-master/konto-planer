// Pushover (pushover.net): messages to the Pushover app on phones and desktops. The request
// and the reading of the answer are pure; sending is in `server/pushover.ts`.

/** API tokens and user/group keys: 30 letters and digits, case-sensitive. */
export function isPushoverKey(value: string): boolean {
	return /^[A-Za-z0-9]{30}$/.test(value);
}

/** Limits of the API (characters). */
export const PUSHOVER_LIMITS = { title: 250, message: 1024, url: 512, urlTitle: 100 } as const;

/** Cuts a text to `max` characters (counted as the API does, by code point). */
export function clip(text: string, max: number): string {
	const chars = [...text];
	return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`;
}

export type PushoverMessage = {
	token: string;
	user: string;
	title: string;
	message: string;
	/** Absolute address of the page to open (left out if missing or too long). */
	url?: string | null;
};

/** Form fields of a message, within the limits of the API. */
export function pushoverFields(m: PushoverMessage): Record<string, string> {
	const fields: Record<string, string> = {
		token: m.token,
		user: m.user,
		title: clip(m.title.trim() || 'Konto Planer', PUSHOVER_LIMITS.title),
		// An empty message is refused by the API.
		message: clip(m.message.trim() || m.title.trim() || 'Konto Planer', PUSHOVER_LIMITS.message)
	};
	// A cut address would lead nowhere: rather none.
	if (m.url && /^https?:\/\//i.test(m.url) && m.url.length <= PUSHOVER_LIMITS.url) {
		fields.url = m.url;
		fields.url_title = 'Im Konto Planer öffnen';
	}
	return fields;
}

/** Address of an app page for the message; null without a public address of the app. */
export function pushoverUrl(origin: string | null | undefined, path: string): string | null {
	const base = origin?.trim().replace(/\/+$/, '');
	if (!base || !/^https?:\/\//i.test(base)) return null;
	return `${base}/${path.replace(/^\/+/, '')}`;
}

/**
 * What went wrong, in the user's words: null if the answer says the message was accepted.
 * `body` is the parsed JSON of the answer (anything else counts as no answer).
 */
export function pushoverProblem(status: number, body: unknown): string | null {
	const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
	if (status === 200 && b.status === 1) return null;
	if (status === 429) return 'Das Monatskontingent bei Pushover ist aufgebraucht.';
	if (b.token === 'invalid') return 'Pushover kennt das API-Token der Anwendung nicht.';
	if (b.user === 'invalid')
		return 'Pushover kennt den Benutzerschlüssel nicht, oder es ist kein Gerät angemeldet.';
	const errors = Array.isArray(b.errors)
		? b.errors.filter((e): e is string => typeof e === 'string')
		: [];
	if (errors.length) return `Pushover meldet: ${clip(errors.join('; '), 200)}`;
	return `Pushover antwortet mit ${status}.`;
}

/** What the API calls invalid: the application's token or the user's key (null: neither). */
export function pushoverFault(body: unknown): 'token' | 'user' | null {
	const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
	return b.token === 'invalid' ? 'token' : b.user === 'invalid' ? 'user' : null;
}
