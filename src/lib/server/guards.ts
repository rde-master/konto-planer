import { error } from '@sveltejs/kit';
import type { SessionUser } from './auth.js';

/** Throws 403 unless the signed-in user is an admin. */
export function requireAdmin(user: SessionUser | null): SessionUser {
	if (!user || user.role !== 'admin') error(403, 'Nur für Admins.');
	return user;
}
