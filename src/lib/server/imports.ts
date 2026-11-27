import { createHash } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	accounts,
	bookingParts,
	bookings,
	categories,
	counterpartyCategories,
	dueItems,
	imports,
	recurringAliases,
	recurringAmounts,
	recurringItems,
	subscriptionHints,
	type Booking,
	type BookingPart,
	type DueItem,
	type Import
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, type AccountWithLevel } from './accounts.js';
import {
	ImportFormatError,
	checksumText,
	latestBalanceRow,
	parseExport,
	type ImportRow
} from '../csv-import.js';
import {
	MANUAL_WINDOW,
	analyzeRows,
	payeeKey,
	sideOf,
	suggestItems,
	type AnalyzedRow,
	type Assignment,
	type ImportContext,
	type MatchItem,
	type StoredDue,
	type Suggestion
} from '../import-match.js';
import { syncDues } from './due.js';
import { syncWebLogos } from './web-logos.js';
import { activeRules } from './rules.js';
import { categoryByRules } from '../rules.js';
import { formatIban } from '../iban.js';
import { addDays } from '../recurring.js';
import { payeeCore } from '../payee-name.js';

export class ImportError extends Error {}

type Executor = Pick<typeof db, 'select'>;

/** Largest accepted file (a year of bookings is far below). */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type StoredRow = ImportRow & { checksum: string; assign?: Assignment };

/** Account the viewer may import into: giro (with IBAN) or credit card, edit right, active. */
export async function importableAccount(viewer: Viewer, accountId: string) {
	const account = await getAccountFor(viewer, accountId);
	if (!account) return null;
	const reason =
		account.type === 'sparbuch'
			? 'Importieren lassen sich nur Girokonten und Kreditkarten.'
			: !canEditAccount(account.level, account.archivedAt !== null)
				? 'Auf dieses Konto darfst du nicht importieren.'
				: !account.iban && account.type === 'giro'
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
	// Credit cards without an IBAN: the export's account column is not checked.
	const checkIban = ctx.account.type === 'giro' || ctx.account.iban !== null;
	const other = checkIban && parsed.rows.find((r) => r.accountIban !== ctx.account.iban);
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

/** Days around the file's period that are loaded: a row assigned by hand looks this far. */
const CONTEXT_DAYS = MANUAL_WINDOW + 4;

/** Everything the assignment needs: stored data around the file's period. */
export async function loadContext(executor: Executor, accountId: string, rows: StoredRow[]) {
	const dates = rows.map((r) => r.bookingDate).sort();
	const from = addDays(dates[0] ?? '2000-01-01', -CONTEXT_DAYS);
	const to = addDays(dates.at(-1) ?? '2000-01-01', CONTEXT_DAYS);
	const [stored, items, ownAccounts, near, others, mapping, cats, rules] = await Promise.all([
		rows.length
			? executor
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
					)
			: [],
		executor
			.select()
			.from(recurringItems)
			.where(
				and(
					isNull(recurringItems.archivedAt),
					or(eq(recurringItems.accountId, accountId), eq(recurringItems.targetAccountId, accountId))
				)
			),
		executor
			.select({
				id: accounts.id,
				name: accounts.name,
				iban: accounts.iban,
				archivedAt: accounts.archivedAt
			})
			.from(accounts),
		executor
			.select()
			.from(bookings)
			.where(
				and(
					eq(bookings.accountId, accountId),
					gte(bookings.bookingDate, from),
					lte(bookings.bookingDate, to)
				)
			),
		executor
			.select({
				id: bookings.id,
				accountId: bookings.accountId,
				date: bookings.bookingDate,
				amount: bookings.amount
			})
			.from(bookings)
			.where(
				and(
					ne(bookings.accountId, accountId),
					isNull(bookings.counterBookingId),
					inArray(bookings.source, ['manual', 'import']),
					gte(bookings.bookingDate, from),
					lte(bookings.bookingDate, to)
				)
			),
		executor.select().from(counterpartyCategories),
		executor.select({ id: categories.id, name: categories.name }).from(categories),
		activeRules(executor)
	]);
	const itemIds = items.map((i) => i.id);
	const [amounts, dues, aliases] = itemIds.length
		? await Promise.all([
				executor
					.select()
					.from(recurringAmounts)
					.where(inArray(recurringAmounts.recurringId, itemIds)),
				executor
					.select()
					.from(dueItems)
					.where(
						and(
							inArray(dueItems.recurringId, itemIds),
							gte(dueItems.dueDate, addDays(from, -CONTEXT_DAYS)),
							lte(dueItems.dueDate, to)
						)
					),
				executor
					.select({ recurringId: recurringAliases.recurringId, name: recurringAliases.name })
					.from(recurringAliases)
					.where(inArray(recurringAliases.recurringId, itemIds))
			])
		: [[], [], []];
	const sourceOf = new Map(near.map((b) => [b.id, b.source]));
	const itemById = new Map(items.map((i) => [i.id, i]));
	const matchItems: MatchItem[] = items.map((i) => ({
		...i,
		aliases: aliases.filter((a) => a.recurringId === i.id).map((a) => a.name),
		amounts: amounts
			.filter((a) => a.recurringId === i.id)
			.map(({ amount, validFrom }) => ({ amount, validFrom }))
			.sort((a, b) => a.validFrom.localeCompare(b.validFrom))
	}));
	const storedDues: StoredDue[] = dues.map((d) => {
		const item = itemById.get(d.recurringId)!;
		const side = item.accountId === accountId ? d.bookingId : d.targetBookingId;
		return {
			id: d.id,
			recurringId: d.recurringId,
			dueDate: d.dueDate,
			status: d.status,
			sideBookingId: side,
			sideProvisional: side !== null && sourceOf.get(side) === 'provisional'
		};
	});
	const ctx: ImportContext = {
		accountId,
		known: new Set(stored.map((s) => s.checksum).filter((c) => c !== null)),
		items: matchItems,
		dues: storedDues,
		replaceable: near
			.filter(
				(b) =>
					b.source === 'manual' ||
					// A computed credit card settlement is replaced by the real debit.
					b.source === 'settlement' ||
					(b.source === 'import' && b.checksum === null && b.counterBookingId !== null)
			)
			.map((b) => ({
				id: b.id,
				date: b.bookingDate,
				amount: b.amount,
				kind: b.source === 'manual' ? ('manual' as const) : ('counter' as const)
			})),
		ownAccounts: ownAccounts.map((a) => ({
			id: a.id,
			name: a.name,
			iban: a.iban,
			archived: a.archivedAt !== null
		})),
		counterCandidates: others
	};
	const byName = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));
	const remembered = new Map(mapping.map((m) => [m.key, m.categoryId]));
	/** Category of a row: recurring item, rules, remembered for the payee, the bank's name. */
	const categoryOf = (r: AnalyzedRow): string | null => {
		if (r.recurring) {
			const own = itemById.get(r.recurring.id)?.categoryId;
			if (own) return own;
		}
		const key = payeeKey(r);
		const byRule = categoryByRules(rules, {
			counterparty: r.counterparty,
			purpose: r.purpose,
			iban: r.counterpartyIban,
			bookingText: r.bookingText,
			bankCategory: r.bankCategory
		});
		if (byRule) return byRule;
		const rememberedId = key ? remembered.get(key) : undefined;
		if (rememberedId) return rememberedId;
		return r.bankCategory ? (byName.get(r.bankCategory.toLowerCase()) ?? null) : null;
	};
	return { ctx, categoryOf, itemById, near, ownAccounts };
}

/** Earlier imported payments without a recurring item (for suggestions). */
async function historyOf(executor: Executor, accountId: string, before: string) {
	return executor
		.select({
			date: bookings.bookingDate,
			amount: bookings.amount,
			counterparty: bookings.counterparty,
			counterpartyIban: bookings.iban
		})
		.from(bookings)
		.where(
			and(
				eq(bookings.accountId, accountId),
				eq(bookings.source, 'import'),
				isNull(bookings.recurringId),
				isNull(bookings.counterBookingId),
				gte(bookings.bookingDate, addDays(before, -400)),
				lte(bookings.bookingDate, before)
			)
		);
}

async function analyze(executor: Executor, accountId: string, rows: StoredRow[]) {
	const loaded = await loadContext(executor, accountId, rows);
	const analyzed = analyzeRows(rows, loaded.ctx);
	const dates = rows.map((r) => r.bookingDate).sort();
	const history = dates.length ? await historyOf(executor, accountId, dates[0]) : [];
	const suggestions = suggestItems(analyzed, history);
	return { ...loaded, analyzed, suggestions };
}

export type ViewRow = AnalyzedRow & { categoryId: string | null };

export type ImportView = Omit<Import, 'rows'> & {
	account: Pick<AccountWithLevel, 'id' | 'name'>;
	rows: ViewRow[];
	suggestions: (Suggestion & { categoryId: string | null })[];
	/** Period of the file. */
	from: string | null;
	to: string | null;
	/** Adjustments in the period that the import removes. */
	adjustments: number;
	/** Provisional bookings in the period without a real booking in the file. */
	missing: { id: string; date: string; amount: number; label: string }[];
	categoryNames: Record<string, string>;
	/** Recurring items a row can be assigned to by hand (`side`: -1 out, +1 in). */
	items: { id: string; name: string; side: -1 | 1 }[];
};

/** Draft with the assignment of each row, or the result of a finished import. */
export async function importView(
	viewer: Viewer,
	accountId: string,
	importId: string
): Promise<ImportView | null> {
	if (!UUID.test(importId)) return null;
	const access = await importableAccount(viewer, accountId);
	if (!access) return null;
	const [row] = await db
		.select()
		.from(imports)
		.where(and(eq(imports.id, importId), eq(imports.accountId, accountId)));
	if (!row || (row.status === 'draft' && row.userId !== viewer.id)) return null;
	const stored = (row.rows ?? []) as StoredRow[];
	const { analyzed, suggestions, categoryOf, near, ctx } = await analyze(db, accountId, stored);
	const dates = stored.map((r) => r.bookingDate).sort();
	const from = dates[0] ?? row.periodFrom;
	const to = dates.at(-1) ?? row.periodTo;
	const replaced = new Set(
		analyzed.map((r) => r.recurring?.due?.replaceBookingId).filter((id) => id)
	);
	const inPeriod = (d: string) => from !== null && to !== null && d >= from && d <= to;
	const provisional =
		row.status === 'draft'
			? near.filter((b) => b.source === 'provisional')
			: from && to
				? await db
						.select()
						.from(bookings)
						.where(
							and(
								eq(bookings.accountId, accountId),
								eq(bookings.source, 'provisional'),
								gte(bookings.bookingDate, from),
								lte(bookings.bookingDate, to)
							)
						)
				: [];
	const cats = await db.select({ id: categories.id, name: categories.name }).from(categories);
	return {
		...row,
		account: { id: access.account.id, name: access.account.name },
		rows: analyzed.map((r) => ({ ...r, categoryId: categoryOf(r) })),
		suggestions: suggestions.map((s) => {
			const latest = analyzed.find((r) => r.line === Math.max(...s.lines));
			return { ...s, categoryId: latest ? categoryOf(latest) : null };
		}),
		from,
		to,
		adjustments: near.filter((b) => b.source === 'adjustment' && inPeriod(b.bookingDate)).length,
		missing: provisional
			.filter((b) => inPeriod(b.bookingDate) && !replaced.has(b.id))
			.map((b) => ({
				id: b.id,
				date: b.bookingDate,
				amount: b.amount,
				label: b.purpose ?? b.counterparty ?? 'Buchung'
			}))
			.sort((a, b) => a.date.localeCompare(b.date)),
		categoryNames: Object.fromEntries(cats.map((c) => [c.id, c.name])),
		items: ctx.items
			.map((i) => ({ id: i.id, name: i.name, side: sideOf(i, accountId) }))
			.filter((i): i is { id: string; name: string; side: -1 | 1 } => i.side !== 0)
			.sort((a, b) => a.name.localeCompare(b.name, 'de'))
	};
}

function bookingValues(r: StoredRow, accountId: string, importId: string, actorId: string) {
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

function stripAnalysis(r: AnalyzedRow): StoredRow {
	const copy: Partial<AnalyzedRow> & { categoryId?: unknown } = { ...r };
	delete copy.status;
	delete copy.recurring;
	delete copy.replace;
	delete copy.transfer;
	delete copy.categoryId;
	return copy as StoredRow;
}

/** Snapshot of what an import changed besides its own bookings (`imports.undo`). */
type UndoData = {
	/** Replaced provisional and manual bookings and removed adjustments (full rows). */
	restoreBookings: Booking[];
	/** Due items before the import booked them. */
	dues: {
		id: string;
		status: DueItem['status'];
		bookingId: string | null;
		targetBookingId: string | null;
	}[];
	/** Due items the import created. */
	createdDues: string[];
	/** Amount entries set from the bank's amount (null = there was none). */
	amounts: { recurringId: string; validFrom: string; before: number | null }[];
	/** Recurring items created from suggestions. */
	items: string[];
	/** Bookings of other accounts whose counter booking link changed. */
	links: { id: string; counterBookingId: string | null }[];
	/** Parts of replaced manual bookings (moved to the imported booking). */
	parts?: BookingPart[];
	/** "Neues Abo?" hints the import created. */
	hints?: string[];
	/** Payee names learned from rows assigned by hand. */
	aliases?: string[];
};

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The booking fulfils the due item: it is marked as booked (created if not stored yet) and its
 * provisional booking on this account goes. `undo` collects what changed.
 */
export async function fulfilDue(
	tx: Tx,
	item: { id: string; accountId: string },
	accountId: string,
	bookingId: string,
	due: NonNullable<NonNullable<AnalyzedRow['recurring']>['due']>,
	undo?: Pick<UndoData, 'dues' | 'createdDues' | 'restoreBookings'>
) {
	const side = item.accountId === accountId ? 'bookingId' : 'targetBookingId';
	if (due.storedId) {
		const [before] = await tx.select().from(dueItems).where(eq(dueItems.id, due.storedId));
		if (undo && before && !undo.dues.some((d) => d.id === before.id))
			undo.dues.push({
				id: before.id,
				status: before.status,
				bookingId: before.bookingId,
				targetBookingId: before.targetBookingId
			});
		await tx
			.update(dueItems)
			.set({ [side]: bookingId, status: 'booked', updatedAt: new Date() })
			.where(eq(dueItems.id, due.storedId));
	} else {
		const [inserted] = await tx
			.insert(dueItems)
			.values({
				recurringId: item.id,
				dueDate: due.dueDate,
				bookingDate: due.bookingDate,
				amount: due.amount,
				status: 'booked',
				[side]: bookingId
			})
			.returning({ id: dueItems.id });
		undo?.createdDues.push(inserted.id);
	}
	if (due.replaceBookingId) {
		const gone = await tx
			.delete(bookings)
			.where(and(eq(bookings.id, due.replaceBookingId), eq(bookings.source, 'provisional')))
			.returning();
		undo?.restoreBookings.push(...gone);
	}
}

/**
 * Remembers the payee name of a booking assigned by hand, so the next import recognises the
 * item by it. Returns the id of a new entry (null if known already or without a name).
 */
export async function learnAlias(
	tx: Tx,
	actor: Actor,
	item: { id: string; name: string; counterparty: string | null },
	counterparty: string | null
): Promise<string | null> {
	const name = payeeCore(counterparty);
	if (!name || name === payeeCore(item.counterparty) || name === payeeCore(item.name)) return null;
	const [created] = await tx
		.insert(recurringAliases)
		.values({ recurringId: item.id, name })
		.onConflictDoNothing()
		.returning({ id: recurringAliases.id });
	if (!created) return null;
	await audit(tx, {
		actor,
		entityType: 'recurring',
		action: 'update',
		entityId: item.id,
		entityLabel: item.name,
		after: { importName: name }
	});
	return created.id;
}

export type CommitChoice = {
	/** Lines to take over. */
	lines: Set<number>;
	/** Lines whose amount becomes the recurring item's new amount from the due date on. */
	amountLines: Set<number>;
	/** Suggestions to create as recurring items, and which of them are salaries. */
	suggestions: Set<string>;
	salaries: Set<string>;
	/** Rows assigned by hand: line → recurring item, or null for "no recurring item". */
	assign?: Map<number, string | null>;
};

/**
 * "Übernehmen": stores the selected rows with their assignment (recurring item and due item,
 * replaced manual booking, transfer counter booking), creates chosen recurring items, removes
 * adjustments in the file's period and checks the balance against the bank.
 */
export async function commitImport(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	importId: string,
	choice: CommitChoice
) {
	const view = await importView(actor, accountId, importId);
	if (!view) throw new ImportError('Import nicht gefunden.');
	if (view.status !== 'draft') throw new ImportError('Der Import ist schon übernommen.');
	const access = await importableAccount(actor, accountId);
	if (!access || access.reason) throw new ImportError(access?.reason ?? 'Konto nicht gefunden.');
	const account = access.account;
	await db.transaction(async (tx) => {
		await tx.execute(sql`select id from accounts where id = ${accountId} for update`);
		// Re-check inside the lock (another import may have run meanwhile).
		const stored = view.rows.map(stripAnalysis).map((r) => {
			const assign = choice.assign?.get(r.line);
			return assign === undefined ? r : { ...r, assign };
		});
		const { analyzed, suggestions, categoryOf, itemById, ownAccounts } = await analyze(
			tx,
			accountId,
			stored
		);
		const createdByLine = new Map<number, string>();
		const undo: UndoData = {
			restoreBookings: [],
			dues: [],
			createdDues: [],
			amounts: [],
			items: [],
			links: [],
			parts: [],
			hints: [],
			aliases: []
		};
		let created = 0;
		let matched = 0;
		for (const r of analyzed) {
			if (r.status === 'duplicate' || !choice.lines.has(r.line)) continue;
			const values = {
				...bookingValues(r, accountId, importId, actor.id),
				// "Keiner" in the preview: the due sync must not assign the booking either.
				noRecurring: choice.assign?.get(r.line) === null
			};
			const categoryId = categoryOf(r);
			if (r.status === 'recurring' && r.recurring) {
				const item = itemById.get(r.recurring.id)!;
				const [booking] = await tx
					.insert(bookings)
					.values({ ...values, recurringId: item.id, categoryId })
					.returning({ id: bookings.id });
				createdByLine.set(r.line, booking.id);
				const due = r.recurring.due;
				if (r.recurring.via === 'manual') {
					const alias = await learnAlias(tx, actor, item, r.counterparty);
					if (alias) undo.aliases!.push(alias);
				}
				if (due) {
					await fulfilDue(tx, item, accountId, booking.id, due, undo);
					if (r.recurring.amountDiffers && choice.amountLines.has(r.line)) {
						const amount = Math.abs(r.amount);
						const [previous] = await tx
							.select({ amount: recurringAmounts.amount })
							.from(recurringAmounts)
							.where(
								and(
									eq(recurringAmounts.recurringId, item.id),
									eq(recurringAmounts.validFrom, due.dueDate)
								)
							);
						undo.amounts.push({
							recurringId: item.id,
							validFrom: due.dueDate,
							before: previous?.amount ?? null
						});
						await tx
							.insert(recurringAmounts)
							.values({ recurringId: item.id, amount, validFrom: due.dueDate })
							.onConflictDoUpdate({
								target: [recurringAmounts.recurringId, recurringAmounts.validFrom],
								set: { amount }
							});
						await audit(tx, {
							actor,
							entityType: 'recurring',
							action: 'amount_change',
							entityId: item.id,
							entityLabel: item.name,
							after: { amount, validFrom: due.dueDate }
						});
					}
				}
				matched++;
			} else if (r.status === 'replace' && r.replace) {
				const [old] = await tx.select().from(bookings).where(eq(bookings.id, r.replace.id));
				const [booking] = await tx
					.insert(bookings)
					.values({
						...values,
						categoryId: old?.categoryId ?? categoryId,
						recurringId: old?.recurringId ?? null
					})
					.returning({ id: bookings.id });
				createdByLine.set(r.line, booking.id);
				if (old) undo.restoreBookings.push(old);
				// A counter booking from the other account's import keeps its link.
				if (old?.counterBookingId) {
					undo.links.push({ id: old.counterBookingId, counterBookingId: old.id });
					await tx
						.update(bookings)
						.set({ counterBookingId: booking.id })
						.where(eq(bookings.id, old.counterBookingId));
					await tx
						.update(bookings)
						.set({ counterBookingId: old.counterBookingId })
						.where(eq(bookings.id, booking.id));
				}
				// A split stays with the real booking.
				const moved = await tx
					.update(bookingParts)
					.set({ bookingId: booking.id })
					.where(eq(bookingParts.bookingId, r.replace.id))
					.returning();
				undo.parts!.push(...moved.map((p) => ({ ...p, bookingId: r.replace!.id })));
				// A due date the old booking paid is paid by the real one now.
				const paid = await tx
					.select()
					.from(dueItems)
					.where(
						or(eq(dueItems.bookingId, r.replace.id), eq(dueItems.targetBookingId, r.replace.id))
					);
				for (const d of paid) {
					if (!undo.dues.some((u) => u.id === d.id))
						undo.dues.push({
							id: d.id,
							status: d.status,
							bookingId: d.bookingId,
							targetBookingId: d.targetBookingId
						});
					await tx
						.update(dueItems)
						.set({
							[d.bookingId === r.replace.id ? 'bookingId' : 'targetBookingId']: booking.id,
							updatedAt: new Date()
						})
						.where(eq(dueItems.id, d.id));
				}
				await tx.delete(bookings).where(eq(bookings.id, r.replace.id));
				matched++;
			} else {
				const [booking] = await tx
					.insert(bookings)
					.values({ ...values, categoryId })
					.returning({ id: bookings.id });
				createdByLine.set(r.line, booking.id);
				const other = r.transfer
					? ownAccounts.find((a) => a.id === r.transfer!.accountId)
					: undefined;
				let counterId = r.transfer?.counterBookingId ?? null;
				if (other && !counterId && !other.archivedAt) {
					const [counter] = await tx
						.insert(bookings)
						.values({
							accountId: other.id,
							bookingDate: r.bookingDate,
							valueDate: r.valueDate,
							amount: -r.amount,
							counterparty: account.name,
							iban: account.iban,
							purpose: r.purpose,
							bookingText: r.bookingText,
							source: 'import',
							importId,
							counterBookingId: booking.id,
							createdBy: actor.id
						})
						.returning({ id: bookings.id });
					counterId = counter.id;
				} else if (counterId) {
					undo.links.push({ id: counterId, counterBookingId: null });
					await tx
						.update(bookings)
						.set({ counterBookingId: booking.id })
						.where(eq(bookings.id, counterId));
				}
				if (counterId)
					await tx
						.update(bookings)
						.set({ counterBookingId: counterId })
						.where(eq(bookings.id, booking.id));
				created++;
			}
		}

		// New recurring items from the suggestions; the latest payment counts as booked due item.
		let itemsCreated = 0;
		for (const s of suggestions) {
			if (!choice.suggestions.has(s.key)) continue;
			const latestLine = analyzed
				.filter((r) => s.lines.includes(r.line) && r.bookingDate === s.lastDate)
				.map((r) => r.line)[0];
			const latestBooking = latestLine !== undefined ? createdByLine.get(latestLine) : undefined;
			if (!latestBooking) continue;
			const latestRow = analyzed.find((r) => r.line === latestLine)!;
			const [item] = await tx
				.insert(recurringItems)
				.values({
					accountId,
					kind: s.kind,
					name: s.name.slice(0, 60),
					counterparty: s.name.slice(0, 100),
					iban: s.iban,
					mandateReference: latestRow.mandateReference,
					creditorId: latestRow.creditorId,
					categoryId: categoryOf(latestRow),
					interval: s.interval,
					startDate: s.lastDate,
					isSalary: s.kind === 'income' && choice.salaries.has(s.key),
					paymentMethod: latestRow.mandateReference ? 'direct_debit' : null,
					createdBy: actor.id
				})
				.returning();
			undo.items.push(item.id);
			await tx
				.insert(recurringAmounts)
				.values({ recurringId: item.id, amount: s.amount, validFrom: s.lastDate });
			const linked = s.lines.map((l) => createdByLine.get(l)).filter((id) => id !== undefined);
			if (linked.length)
				await tx.update(bookings).set({ recurringId: item.id }).where(inArray(bookings.id, linked));
			await tx.insert(dueItems).values({
				recurringId: item.id,
				dueDate: s.lastDate,
				bookingDate: s.lastDate,
				amount: s.amount,
				status: 'booked',
				bookingId: latestBooking
			});
			await audit(tx, {
				actor,
				entityType: 'recurring',
				action: 'create',
				entityId: item.id,
				entityLabel: item.name,
				after: {
					kind: item.kind,
					interval: s.interval,
					amount: s.amount,
					startDate: s.lastDate,
					isSalary: item.isSalary
				}
			});
			itemsCreated++;
		}

		// Expense suggestions not taken over become "Neues Abo?" hints (dismissed ones stay so).
		for (const s of suggestions) {
			if (choice.suggestions.has(s.key) || s.kind !== 'expense') continue;
			const [hint] = await tx
				.insert(subscriptionHints)
				.values({
					accountId,
					key: s.key,
					name: s.name.slice(0, 60),
					iban: s.iban,
					amount: s.amount,
					interval: s.interval,
					lastDate: s.lastDate,
					count: s.count
				})
				.onConflictDoNothing()
				.returning({ id: subscriptionHints.id });
			if (hint) undo.hints!.push(hint.id);
			else
				await tx
					.update(subscriptionHints)
					.set({
						amount: s.amount,
						lastDate: s.lastDate,
						count: s.count,
						interval: s.interval,
						updatedAt: new Date()
					})
					.where(
						and(
							eq(subscriptionHints.accountId, accountId),
							eq(subscriptionHints.key, s.key),
							eq(subscriptionHints.status, 'open')
						)
					);
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
				.returning();
			undo.restoreBookings.push(...gone);
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
		const skipped = analyzed.length - created - matched;
		await tx
			.update(imports)
			.set({
				status: 'done',
				rows: null,
				newCount: created,
				matchedCount: matched,
				skippedCount: skipped,
				adjustmentsRemoved: removed,
				undo,
				periodFrom: view.from,
				periodTo: view.to,
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
				itemsCreated,
				adjustmentsRemoved: removed,
				...(check ? { bankBalance: check.bankBalance, appBalanceAfter: check.appBalance } : {})
			}
		});
	});
	// New and booked due items, counter bookings on savings accounts (interest).
	await syncDues();
	// Logos of new payees; in the background, the import does not wait for the web.
	void syncWebLogos().catch((e: unknown) => console.error('[logos] search failed', e));
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

/**
 * Uploaded files of the viewer that still wait for "Übernehmen" (from the app or a shortcut),
 * newest first; only on accounts the viewer may still import into.
 */
export async function openDrafts(viewer: Viewer, accountId?: string) {
	const rows = await db
		.select({
			id: imports.id,
			accountId: imports.accountId,
			fileName: imports.fileName,
			createdAt: imports.createdAt,
			rowCount: sql<number>`coalesce(jsonb_array_length(${imports.rows}), 0)::int`,
			account: accounts
		})
		.from(imports)
		.innerJoin(accounts, eq(accounts.id, imports.accountId))
		.where(
			and(
				eq(imports.status, 'draft'),
				eq(imports.userId, viewer.id),
				accountId ? eq(imports.accountId, accountId) : undefined
			)
		)
		.orderBy(desc(imports.createdAt));
	const out = [];
	for (const r of rows) {
		const access = await importableAccount(viewer, r.accountId);
		if (!access || access.reason) continue;
		out.push({
			id: r.id,
			accountId: r.accountId,
			accountName: r.account.name,
			fileName: r.fileName,
			createdAt: r.createdAt,
			rowCount: r.rowCount
		});
	}
	return out;
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
			skippedCount: imports.skippedCount,
			undoneAt: imports.undoneAt
		})
		.from(imports)
		.where(and(eq(imports.accountId, accountId), eq(imports.status, 'done')))
		.orderBy(desc(imports.completedAt))
		.limit(limit);
}

/** The import that can be taken back: the latest finished one of the account, with a snapshot. */
export async function undoableImportId(accountId: string): Promise<string | null> {
	const [latest] = await db
		.select({ id: imports.id, undo: imports.undo })
		.from(imports)
		.where(
			and(eq(imports.accountId, accountId), eq(imports.status, 'done'), isNull(imports.undoneAt))
		)
		.orderBy(desc(imports.completedAt))
		.limit(1);
	return latest?.undo ? latest.id : null;
}

/** JSON turns dates into strings; back to the row shape for the insert. */
function bookingRow(b: Booking): Booking {
	return {
		...b,
		createdAt: new Date(b.createdAt),
		updatedAt: new Date(b.updatedAt),
		counterBookingId: null
	};
}

/**
 * "Import rückgängig": removes the import's bookings (and counter bookings), restores replaced
 * and removed bookings, due items, amounts and links, and deletes recurring items it created.
 */
export async function undoImport(
	actor: NonNullable<Actor> & Viewer,
	accountId: string,
	importId: string
) {
	const access = await importableAccount(actor, accountId);
	if (!access || access.reason) throw new ImportError(access?.reason ?? 'Konto nicht gefunden.');
	await db.transaction(async (tx) => {
		await tx.execute(sql`select id from accounts where id = ${accountId} for update`);
		const [row] = await tx
			.select()
			.from(imports)
			.where(and(eq(imports.id, importId), eq(imports.accountId, accountId)));
		if (!row || row.status !== 'done' || row.undoneAt)
			throw new ImportError('Dieser Import lässt sich nicht zurücknehmen.');
		const [latest] = await tx
			.select({ id: imports.id })
			.from(imports)
			.where(
				and(eq(imports.accountId, accountId), eq(imports.status, 'done'), isNull(imports.undoneAt))
			)
			.orderBy(desc(imports.completedAt))
			.limit(1);
		if (latest?.id !== importId)
			throw new ImportError('Nur der letzte Import des Kontos lässt sich zurücknehmen.');
		const undo = row.undo as UndoData | null;
		if (!undo) throw new ImportError('Dieser Import ist älter und lässt sich nicht zurücknehmen.');

		// Due dates paid by a booking of this import outside the import (assigned by hand or by
		// the due sync): they are open again once the booking is gone.
		const paidLater = await tx
			.select({
				id: dueItems.id,
				bookingId: dueItems.bookingId,
				targetBookingId: dueItems.targetBookingId,
				paidBy: bookings.id
			})
			.from(dueItems)
			.innerJoin(
				bookings,
				or(eq(bookings.id, dueItems.bookingId), eq(bookings.id, dueItems.targetBookingId))
			)
			.where(eq(bookings.importId, importId));
		const removed = await tx
			.delete(bookings)
			.where(eq(bookings.importId, importId))
			.returning({ id: bookings.id });
		const snapshot = new Set([...undo.dues.map((d) => d.id), ...undo.createdDues]);
		for (const d of paidLater) {
			if (snapshot.has(d.id)) continue;
			const other = d.bookingId === d.paidBy ? d.targetBookingId : d.bookingId;
			// Without a booking on the other side the due date starts over (the sync books it).
			if (other === null) await tx.delete(dueItems).where(eq(dueItems.id, d.id));
		}
		if (undo.items.length) {
			const [used] = await tx
				.select({ id: bookings.id })
				.from(bookings)
				.where(inArray(bookings.recurringId, undo.items))
				.limit(1);
			if (used)
				throw new ImportError(
					'Ein beim Import angelegter Dauerposten hat inzwischen weitere Buchungen.'
				);
			await tx.delete(recurringItems).where(inArray(recurringItems.id, undo.items));
		}
		if (undo.createdDues.length)
			await tx.delete(dueItems).where(inArray(dueItems.id, undo.createdDues));
		if (undo.hints?.length)
			await tx.delete(subscriptionHints).where(inArray(subscriptionHints.id, undo.hints));
		if (undo.aliases?.length)
			await tx.delete(recurringAliases).where(inArray(recurringAliases.id, undo.aliases));
		if (undo.restoreBookings.length) {
			const restore = undo.restoreBookings.map(bookingRow);
			await tx.insert(bookings).values(restore).onConflictDoNothing();
		}
		if (undo.parts?.length)
			await tx
				.insert(bookingParts)
				.values(undo.parts.map((p) => ({ ...p, createdAt: new Date(p.createdAt) })))
				.onConflictDoNothing();
		for (const d of undo.dues)
			await tx
				.update(dueItems)
				.set({
					status: d.status,
					bookingId: d.bookingId,
					targetBookingId: d.targetBookingId,
					updatedAt: new Date()
				})
				.where(eq(dueItems.id, d.id));
		for (const a of undo.amounts) {
			const where = and(
				eq(recurringAmounts.recurringId, a.recurringId),
				eq(recurringAmounts.validFrom, a.validFrom)
			);
			if (a.before === null) await tx.delete(recurringAmounts).where(where);
			else await tx.update(recurringAmounts).set({ amount: a.before }).where(where);
		}
		// Links of restored rows and of other accounts' bookings.
		const links = [
			...undo.restoreBookings
				.filter((b) => b.counterBookingId)
				.map((b) => ({ id: b.id, counterBookingId: b.counterBookingId })),
			...undo.links
		];
		for (const l of links) {
			const [target] = l.counterBookingId
				? await tx
						.select({ id: bookings.id })
						.from(bookings)
						.where(eq(bookings.id, l.counterBookingId))
				: [];
			await tx
				.update(bookings)
				.set({ counterBookingId: target ? l.counterBookingId : null })
				.where(eq(bookings.id, l.id));
		}
		await tx
			.update(imports)
			.set({ undoneAt: new Date(), undo: null })
			.where(eq(imports.id, importId));
		await audit(tx, {
			actor,
			entityType: 'import',
			action: 'undo',
			entityId: importId,
			entityLabel: access.account.name,
			before: {
				fileName: row.fileName,
				bookingsRemoved: removed.length,
				bookingsRestored: undo.restoreBookings.length,
				itemsRemoved: undo.items.length
			}
		});
	});
	await syncDues();
}
