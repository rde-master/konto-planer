import {
	normalizeUsername,
	validateEmail,
	validatePassword,
	validateUsername,
	type FieldErrors
} from './validation';

export const ROLES = ['admin', 'user'] as const;
export type Role = (typeof ROLES)[number];

export function parseRole(value: string): Role | undefined {
	return ROLES.includes(value as Role) ? (value as Role) : undefined;
}

export type UserInput = { name: string; email: string; role: string };
export type NewUserInput = UserInput & { username: string; password: string; confirm: string };

function hasErrors(errors: FieldErrors): boolean {
	return Object.values(errors).some(Boolean);
}

/** Validates the editable profile fields (name, e-mail, role). */
export function validateProfile(input: UserInput): FieldErrors | null {
	const errors: FieldErrors = {
		name: input.name.trim() ? undefined : 'Bitte einen Namen angeben.',
		email: validateEmail(input.email.trim()),
		role: parseRole(input.role) ? undefined : 'Unbekannte Rolle.'
	};
	return hasErrors(errors) ? errors : null;
}

export function validatePasswordPair(password: string, confirm: string): FieldErrors | null {
	const errors: FieldErrors = {
		password: validatePassword(password),
		confirm: password === confirm ? undefined : 'Die Passwörter stimmen nicht überein.'
	};
	return hasErrors(errors) ? errors : null;
}

export function validateNewUser(input: NewUserInput): FieldErrors | null {
	const errors: FieldErrors = {
		...validateProfile(input),
		username: validateUsername(normalizeUsername(input.username)),
		...validatePasswordPair(input.password, input.confirm)
	};
	return hasErrors(errors) ? errors : null;
}

/**
 * Guards that keep at least one admin and stop admins from locking themselves out.
 * Returns an error message, or undefined if the change is allowed.
 */
export function checkRoleChange(opts: {
	actorId: string;
	targetId: string;
	currentRole: Role;
	newRole: Role;
	adminCount: number;
}): string | undefined {
	const { actorId, targetId, currentRole, newRole, adminCount } = opts;
	if (currentRole !== 'admin' || newRole === 'admin') return undefined;
	if (adminCount <= 1) return 'Es muss mindestens einen Admin geben.';
	if (actorId === targetId) return 'Du kannst dir die Admin-Rolle nicht selbst entziehen.';
	return undefined;
}

export function checkDelete(opts: {
	actorId: string;
	targetId: string;
	targetRole: Role;
	adminCount: number;
}): string | undefined {
	if (opts.actorId === opts.targetId) return 'Du kannst dich nicht selbst löschen.';
	if (opts.targetRole === 'admin' && opts.adminCount <= 1)
		return 'Der letzte Admin kann nicht gelöscht werden.';
	return undefined;
}
