import { and, gte, inArray } from 'drizzle-orm';
import { db } from './db/index.js';
import { manualTransfersDone } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import type { Viewer } from './account-rules.js';
import { listRecurringFor } from './recurring.js';
import { isValidDate } from './recurring-rules.js';
import { storedDues } from './due.js';
import { duesBetween } from '../due.js';
import { addDays } from '../recurring.js';
import { formatDay } from '../dates.js';
import { LOOKBACK_DAYS, isManualTransfer, manualReminders } from '../manual-transfers.js';

export class ManualTransferError extends Error {}

/** Open manual transfers of the items the viewer sees (reminder day reached). */
export async function remindersFor(viewer: Viewer, today: string, lead: number) {
	const items = (await listRecurringFor(viewer)).filter(
		(i) => !i.archivedAt && !i.account.archivedAt && isManualTransfer(i)
	);
	if (!items.length) return [];
	const ids = items.map((i) => i.id);
	const since = addDays(today, -LOOKBACK_DAYS - 7);
	const [stored, done] = await Promise.all([
		storedDues(ids, since),
		db
			.select({
				recurringId: manualTransfersDone.recurringId,
				dueDate: manualTransfersDone.dueDate
			})
			.from(manualTransfersDone)
			.where(
				and(inArray(manualTransfersDone.recurringId, ids), gte(manualTransfersDone.dueDate, since))
			)
	]);
	const byId = new Map(items.map((i) => [i.id, i]));
	return manualReminders(
		items,
		stored,
		new Set(done.map((d) => `${d.recurringId}:${d.dueDate}`)),
		today,
		lead
	).map((r) => {
		const item = byId.get(r.recurringId)!;
		return {
			...r,
			accountName: item.account.name,
			targetName: item.targetAccount?.name ?? null,
			payee: item.counterparty,
			iban: item.iban,
			canEdit: item.canEdit
		};
	});
}

/** "Überwiesen": silences the reminder of one due date (an import confirms the payment later). */
export async function markTransferred(
	actor: NonNullable<Actor> & Viewer,
	recurringId: string,
	dueDate: string
) {
	const item = (await listRecurringFor(actor)).find((i) => i.id === recurringId);
	if (!item || !isManualTransfer(item))
		throw new ManualTransferError('Dauerposten nicht gefunden.');
	if (!item.canEdit) throw new ManualTransferError('Du darfst auf diesem Konto nichts ändern.');
	const known =
		isValidDate(dueDate) &&
		duesBetween(item, item.amounts, addDays(dueDate, -7), addDays(dueDate, 14)).some(
			(d) => d.dueDate === dueDate
		);
	if (!known) throw new ManualTransferError('Diese Fälligkeit gibt es nicht.');
	await db.transaction(async (tx) => {
		const created = await tx
			.insert(manualTransfersDone)
			.values({ recurringId, dueDate, doneBy: actor.id })
			.onConflictDoNothing()
			.returning({ id: manualTransfersDone.id });
		if (!created.length) return;
		await audit(tx, {
			actor,
			entityType: 'recurring',
			action: 'update',
			entityId: recurringId,
			entityLabel: item.name,
			after: { manualTransferDone: formatDay(dueDate) }
		});
	});
	return item.name;
}
