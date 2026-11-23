export type RoleValue = 'admin' | 'user';

export const ROLE_OPTIONS: { value: RoleValue; label: string }[] = [
	{ value: 'user', label: 'Benutzer' },
	{ value: 'admin', label: 'Admin' }
];

export function roleLabel(role: RoleValue): string {
	return role === 'admin' ? 'Admin' : 'Benutzer';
}
