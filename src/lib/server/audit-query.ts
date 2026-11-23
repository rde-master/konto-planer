import { and, desc, eq, lt, sql, type SQL } from 'drizzle-orm';
import { db } from './db/index.js';
import { auditLog } from './db/schema.js';
import type { AuditFilter } from './audit-rules.js';

export const AUDIT_PAGE_SIZE = 50;

export type AuditRow = typeof auditLog.$inferSelect;

/** Newest first; day boundaries of from/to are Berlin days. */
export async function listAuditLog(filter: AuditFilter) {
	const conditions: SQL[] = [];
	if (filter.actor) conditions.push(eq(auditLog.actorId, filter.actor));
	if (filter.entity) conditions.push(eq(auditLog.entityType, filter.entity));
	if (filter.action) conditions.push(eq(auditLog.action, filter.action));
	if (filter.from) {
		conditions.push(
			sql`${auditLog.at} >= (${filter.from}::date)::timestamp at time zone 'Europe/Berlin'`
		);
	}
	if (filter.to) {
		conditions.push(
			sql`${auditLog.at} < (${filter.to}::date + 1)::timestamp at time zone 'Europe/Berlin'`
		);
	}
	if (filter.before) conditions.push(lt(auditLog.id, filter.before));

	const rows = await db
		.select()
		.from(auditLog)
		.where(conditions.length ? and(...conditions) : undefined)
		.orderBy(desc(auditLog.id))
		.limit(AUDIT_PAGE_SIZE + 1);
	const hasMore = rows.length > AUDIT_PAGE_SIZE;
	return { rows: rows.slice(0, AUDIT_PAGE_SIZE), hasMore };
}
