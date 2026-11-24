import { createHash } from 'node:crypto';
import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, dueItems, imports, type Import } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, type AccountWithLevel } from './accounts.js';
import {
	ImportFormatError,
	checksumText,
	latestBalanceRow,
	parseExport,
	previewRows,
	type ImportRow,
	type MatchCandidate,
	type PreviewRow
} from '../csv-import.js';
import { formatIban } from '../iban.js';
import { addDays } from '../recurring.js';

export class ImportError extends Error {}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Executor = Pick<typeof db, 'select'>;

/** Largest accepted file (a year of bookings is far below). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StoredRow = ImportRow & { checksum: string };

/** Giro account the viewer may import into (edit right, active, with IBAN). */
export async function importableAccount(viewer: Viewer, accountId: string) {
	const account = await getAccountFor(viewer, accountId);
	if (!account) return null;
	const reason =
		account.type !== 'giro'
			? 'Importieren lassen sich nur Girokonten.'
			: !canEditAccount(account.level, account.archivedAt !== null)
				? 'Auf dieses Konto darfst du nicht importieren.'
				: !account.iban
					? 'Bitte erst die IBAN des Kontos eintragen; der Import prüft sie.'
					: null;
	return { account, reason };
}

function hash(text: string): string {
	return createHash('sha256').update(text).digest('hex');
}

/** Reads the file and stores a draft for the preview. Returns the import id. */
export async function createDraft(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	file: File
): Promise<string> {
	const ctx = await importableAccount(actor, accountId);
	if (!ctx) throw new ImportError('Konto nicht gefunden.');
	if (ctx.reason) throw new ImportError(ctx.reason);
	if (file.size > MAX_IMPORT_BYTES) throw new ImportError('Die Datei ist größer als 5 MB.');
	let parsed;
	try {
		parsed = parseExport(new Uint8Array(await file.arrayBuffer()));
	} catch (e) {
		if (e instanceof ImportFormatError) throw new ImportError(e.message);
		throw e;
	}
	const other = parsed.rows.find((r) => r.accountIban !== ctx.account.iban);
	if (other)
		throw new ImportError(
			`Die Datei gehört zum Konto ${formatIban(other.accountIban) || 'ohne IBAN'}, nicht zu ${ctx.account.name}. Der Import wurde abgebrochen.`
		);
	const rows: StoredRow[] = parsed.rows.map((r) => ({ ...r, checksum: hash(checksumText(r)) }));
	return db.transaction(async (tx) => {
		// Older drafts of this user on the account are replaced.
		await tx
			.delete(imports)
			.where(
				and(
					eq(imports.accountId, accountId),
					eq(imports.userId, actor.id),
					eq(imports.status, 'draft')
				)
			);
		const [created] = await tx
			.insert(imports)
			.values({
				accountId,
				userId: actor.id,
				fileName: file.name.slice(0, 200) || 'Export.csv',
				encoding: parsed.encoding,
				dateFormat: parsed.dateFormat,
				numberFormat: parsed.numberFormat,
				rows
			})
			.returning({ id: imports.id });
		return created.id;
	});
}

/** Stored checksums and replaceable bookings (manual, provisional) around the file's period. */
async function existing(executor: Executor, accountId: string, rows: StoredRow[]) {
	if (!rows.length) return { known: new Set<string>(), candidates: [] as MatchCandidate[] };
	const dates = rows.map((r) => r.bookingDate).sort();
	const [stored, replaceable] = await Promise.all([
		executor
			.select({ checksum: bookings.checksum })
			.from(bookings)
			.where(
				and(
					eq(bookings.accountId, accountId),
					inArray(
						bookings.checksum,
						rows.map((r) => r.checksum)
					)
				)
			),
		executor
			.select({
				id: bookings.id,
				date: bookings.bookingDate,
				amount: bookings.amount,
				source: bookings.source,
				purpose: bookings.purpose,
				counterparty: bookings.counterparty
			})
			.from(bookings)
			.where(
				and(
					eq(bookings.accountId, accountId),
					inArray(bookings.source, ['manual', 'provisional']),
					gte(bookings.bookingDate, addDays(dates[0], -3)),
					lte(bookings.bookingDate, addDays(dates.at(-1)!, 3))
				)
			)
	]);
	return {
		known: new Set(stored.map((s) => s.checksum).filter((c) => c !== null)),
		candidates: replaceable.map((b) => ({
			id: b.id,
			date: b.date,
			amount: b.amount,
			source: b.source as 'manual' | 'provisional',
			label: b.counterparty ?? b.purpose ?? 'Buchung'
		}))
	};
}

export type ImportView = Omit<Import, 'rows'> & {
	account: Pick<AccountWithLevel, 'id' | 'name'>;
	rows: PreviewRow[];
	/** Period of the file. */
	from: string | null;
	to: string | null;
	/** Adjustments in the period that the import removes. */
	adjustments: number;
};

/** Draft with the status of each row, or the result of a finished import. */
export async function importView(
	viewer: Viewer,
	accountId: string,
	importId: string
): Promise<ImportView | null> {
	if (!UUID.test(importId)) return null;
	const ctx = await importableAccount(viewer, accountId);
	if (!ctx) return null;
	const [row] = await db
		.select()
		.from(imports)
		.where(and(eq(imports.id, importId), eq(imports.accountId, accountId)));
	if (!row || (row.status === 'draft' && row.userId !== viewer.id)) return null;
	const stored = (row.rows ?? []) as StoredRow[];
	const { known, candidates } = await existing(db, accountId, stored);
	const dates = stored.map((r) => r.bookingDate).sort();
	const from = dates[0] ?? null;
	const to = dates.at(-1) ?? null;
	const [adj] =
		from && to
			? await db
					.select({ n: sql<number>`count(*)::int` })
					.from(bookings)
					.where(
						and(
							eq(bookings.accountId, accountId),
							eq(bookings.source, 'adjustment'),
							gte(bookings.bookingDate, from),
							lte(bookings.bookingDate, to)
						)
					)
			: [{ n: 0 }];
	return {
		...row,
		account: { id: ctx.account.id, name: ctx.account.name },
		rows: previewRows(stored, known, candidates),
		from,
		to,
		adjustments: adj?.n ?? 0
	};
}

function bookingValues(r: PreviewRow, accountId: string, importId: string, actorId: string) {
	return {
		accountId,
		bookingDate: r.bookingDate,
		valueDate: r.valueDate,
		amount: r.amount,
		counterparty: r.counterparty,
		iban: r.counterpartyIban,
		purpose: r.purpose,
		bookingText: r.bookingText,
		balanceAfter: r.balanceAfter,
		checksum: r.checksum,
		bankCategory: r.bankCategory,
		creditorId: r.creditorId,
		mandateReference: r.mandateReference,
		source: 'import' as const,
		importId,
		createdBy: actorId
	};
}

/** Replaces a manual or provisional booking by the imported one (keeps category and due item). */
async function replace(tx: Tx, oldId: string, values: ReturnType<typeof bookingValues>) {
	const [old] = await tx.select().from(bookings).where(eq(bookings.id, oldId));
	if (!old) return false;
	const [created] = await tx
		.insert(bookings)
		.values({ ...values, categoryId: old.categoryId, recurringId: old.recurringId })
		.returning({ id: bookings.id });
	if (old.source === 'provisional') {
		const [due] = await tx
			.select()
			.from(dueItems)
			.where(sql`${dueItems.bookingId} = ${oldId} or ${dueItems.targetBookingId} = ${oldId}`);
		if (due) {
			const ids = {
				bookingId: due.bookingId === oldId ? created.id : due.bookingId,
				targetBookingId: due.targetBookingId === oldId ? created.id : due.targetBookingId
			};
			const other = due.bookingId === oldId ? due.targetBookingId : due.bookingId;
			const [otherBooking] = other
				? await tx.select({ source: bookings.source }).from(bookings).where(eq(bookings.id, other))
				: [];
			await tx
				.update(dueItems)
				.set({
					...ids,
					status: otherBooking?.source === 'provisional' ? 'provisional' : 'booked',
					updatedAt: new Date()
				})
				.where(eq(dueItems.id, due.id));
		}
	}
	await tx.delete(bookings).where(eq(bookings.id, oldId));
	return true;
}

/**
 * "Übernehmen": stores the selected new rows, replaces matched manual and provisional bookings,
 * removes adjustments in the file's period and checks the balance against the bank.
 */
export async function commitImport(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	importId: string,
	selected: Set<number>
) {
	const view = await importView(actor, accountId, importId);
	if (!view) throw new ImportError('Import nicht gefunden.');
	if (view.status !== 'draft') throw new ImportError('Der Import ist schon übernommen.');
	const ctx = await importableAccount(actor, accountId);
	if (!ctx || ctx.reason) throw new ImportError(ctx?.reason ?? 'Konto nicht gefunden.');
	const account = ctx.account;
	await db.transaction(async (tx) => {
		await tx.execute(sql`select id from accounts where id = ${accountId} for update`);
		// Re-check inside the lock (another import may have run meanwhile).
		const stored: StoredRow[] = view.rows.map((r) => {
			const copy: Partial<PreviewRow> = { ...r };
			delete copy.status;
			delete copy.match;
			return copy as StoredRow;
		});
		const { known, candidates } = await existing(tx, accountId, stored);
		const rows = previewRows(stored, known, candidates);
		let created = 0;
		let matched = 0;
		for (const r of rows) {
			if (r.status === 'duplicate' || !selected.has(r.line)) continue;
			const values = bookingValues(r, accountId, importId, actor.id);
			if (r.status === 'match' && r.match && (await replace(tx, r.match.id, values))) matched++;
			else {
				await tx.insert(bookings).values(values);
				created++;
			}
		}
		let removed = 0;
		if (view.from && view.to) {
			const gone = await tx
				.delete(bookings)
				.where(
					and(
						eq(bookings.accountId, accountId),
						eq(bookings.source, 'adjustment'),
						gte(bookings.bookingDate, view.from),
						lte(bookings.bookingDate, view.to)
					)
				)
				.returning({ id: bookings.id });
			removed = gone.length;
		}
		// Balance check: the bank's balance after the latest row against ours on that day.
		const latest = latestBalanceRow(stored);
		let check: { checkDate: string; bankBalance: number; appBalance: number } | null = null;
		if (latest && latest.bookingDate >= account.openingDate) {
			const [sum] = await tx
				.select({ s: sql<string | null>`sum(${bookings.amount})` })
				.from(bookings)
				.where(
					and(
						eq(bookings.accountId, accountId),
						gte(bookings.bookingDate, account.openingDate),
						lte(bookings.bookingDate, latest.bookingDate)
					)
				);
			check = {
				checkDate: latest.bookingDate,
				bankBalance: latest.balanceAfter!,
				appBalance: account.openingBalance + Number(sum?.s ?? 0)
			};
		}
		const skipped = rows.length - created - matched;
		await tx
			.update(imports)
			.set({
				status: 'done',
				rows: null,
				newCount: created,
				matchedCount: matched,
				skippedCount: skipped,
				adjustmentsRemoved: removed,
				...(check ?? {}),
				completedAt: new Date()
			})
			.where(eq(imports.id, importId));
		await audit(tx, {
			actor,
			entityType: 'import',
			action: 'create',
			entityId: importId,
			entityLabel: account.name,
			after: {
				fileName: view.fileName,
				importNew: created,
				importMatched: matched,
				importSkipped: skipped,
				adjustmentsRemoved: removed,
				...(check ? { bankBalance: check.bankBalance, appBalanceAfter: check.appBalance } : {})
			}
		});
	});
}

/** Drops a draft ("Abbrechen"). */
export async function discardDraft(actor: Viewer, accountId: string, importId: string) {
	if (!UUID.test(importId)) return;
	await db
		.delete(imports)
		.where(
			and(
				eq(imports.id, importId),
				eq(imports.accountId, accountId),
				eq(imports.userId, actor.id),
				eq(imports.status, 'draft')
			)
		);
}

/** Finished imports of an account, newest first. */
export async function recentImports(accountId: string, limit = 5) {
	return db
		.select({
			id: imports.id,
			fileName: imports.fileName,
			completedAt: imports.completedAt,
			newCount: imports.newCount,
			matchedCount: imports.matchedCount,
			skippedCount: imports.skippedCount
		})
		.from(imports)
		.where(and(eq(imports.accountId, accountId), eq(imports.status, 'done')))
		.orderBy(desc(imports.completedAt))
		.limit(limit);
}
