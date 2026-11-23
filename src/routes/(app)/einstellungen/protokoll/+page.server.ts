import { requireAdmin } from '#lib/server/guards.js';
import { listAuditLog } from '#lib/server/audit-query.js';
import { parseAuditFilter } from '#lib/server/audit-rules.js';
import { listUsers } from '#lib/server/users.js';
import { ACTIONS, ENTITY_TYPES } from '#lib/audit.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	requireAdmin(locals.user);
	const filter = parseAuditFilter(url.searchParams, { entities: ENTITY_TYPES, actions: ACTIONS });
	const [{ rows, hasMore }, users] = await Promise.all([listAuditLog(filter), listUsers()]);
	return {
		filter,
		entries: rows,
		hasMore,
		users: users.map((u) => ({ id: u.id, name: u.name }))
	};
};
