export const PASSWORD_MIN_LENGTH = 10;

export type FieldErrors = Partial<Record<string, string>>;

export function normalizeUsername(raw: string): string {
	return raw.trim().toLowerCase();
}

export function validateUsername(username: string): string | undefined {
	if (username.length < 3) return 'Mindestens 3 Zeichen.';
	if (username.length > 32) return 'Höchstens 32 Zeichen.';
	if (!/^[a-z0-9._-]+$/.test(username))
		return 'Nur Kleinbuchstaben, Ziffern, Punkt, Bindestrich und Unterstrich.';
	return undefined;
}

export function validatePassword(password: string): string | undefined {
	if (password.length < PASSWORD_MIN_LENGTH) return `Mindestens ${PASSWORD_MIN_LENGTH} Zeichen.`;
	if (password.length > 256) return 'Höchstens 256 Zeichen.';
	return undefined;
}

export function validateEmail(email: string): string | undefined {
	if (email === '') return undefined;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Keine gültige E-Mail-Adresse.';
	return undefined;
}

/** Reads a text field from FormData; files and missing fields become ''. */
export function formString(data: FormData, key: string): string {
	const value = data.get(key);
	return typeof value === 'string' ? value : '';
}

/** Builds a FieldErrors object for a single field (keeps action return types uniform). */
export function fieldError(field: string, message: string): FieldErrors {
	return { [field]: message };
}
