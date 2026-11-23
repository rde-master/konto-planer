import { db } from './db/index.js';
import { auditLog } from './db/schema.js';
import { snapshot } from './audit-rules.js';
import type { AuditAction, EntityType } from '../audit.js';

/** Either the db or a transaction, so the entry is written atomically with the change. */
export type Executor = Pick<typeof db, 'insert'>;

export type Actor = { id: string; name: string } | null;

export type AuditEntry = {
	actor: Actor;
	entityType: EntityType;
	action: AuditAction;
	entityId?: string | null;
	entityLabel?: string | null;
	before?: Record<string, unknown> | null;
	after?: Record<string, unknown> | null;
};

export async function audit(executor: Executor, entry: AuditEntry) {
	await executor.insert(auditLog).values({
		actorId: entry.actor?.id ?? null,
		actorName: entry.actor?.name ?? null,
		entityType: entry.entityType,
		entityId: entry.entityId ?? null,
		entityLabel: entry.entityLabel ?? null,
		action: entry.action,
		before: entry.before ? snapshot(entry.before) : null,
		after: entry.after ? snapshot(entry.after) : null
	});
}
