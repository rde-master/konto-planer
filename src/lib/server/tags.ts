import { and, asc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import {
	bookingParts,
	bookingTags,
	bookings,
	recurringItems,
	recurringTags,
	tags,
	type Tag
} from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { canEditAccount, type Viewer } from './account-rules.js';
import { getAccountFor, listAccountsFor } from './accounts.js';
import { getRecurringFor } from './recurring.js';
import { categoryInfo } from './categories.js';
import { validateTagName, yearSummary, type YearSummary } from '../tags.js';

export class TagError extends Error {}

type Executor = Pick<typeof db, 'select'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(e: unknown): boolean {
	const err = e as { code?: string; cause?: { code?: string } };
	return err?.code === '23505' || err?.cause?.code === '23505';
}

const NAME_TAKEN = 'Diesen Tag gibt es schon.';

export async function listTags(): Promise<Tag[]> {
	return db
		.select()
		.from(tags)
		.orderBy(asc(sql`lower(${tags.name})`));
}

export async function getTag(id: string): Promise<Tag | null> {
	if (!UUID.test(id)) return null;
	const [row] = await db.select().from(tags).where(eq(tags.id, id));
	return row ?? null;
}

/** Creates a tag, or returns the existing one with that name (case ignored). */
export async function ensureTag(
	actor: NonNullable<Actor>,
	name: string,
	executor = db
): Promise<string> {
	const [existing] = await executor
		.select({ id: tags.id })
		.from(tags)
		.where(eq(sql`lower(${tags.name})`, name.toLowerCase()));
	if (existing) return existing.id;
	return createTag(actor, name);
}

export async function createTag(actor: NonNullable<Actor>, name: string): Promise<string> {
	try {
		return await db.transaction(async (tx) => {
			const [created] = await tx.insert(tags).values({ name, createdBy: actor.id }).returning();
			await audit(tx, {
				actor,
				entityType: 'tag',
				action: 'create',
				entityId: created.id,
				entityLabel: created.name,
				after: { name }
			});
			return created.id;
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new TagError(NAME_TAKEN);
		throw e;
	}
}

export async function renameTag(actor: NonNullable<Actor>, id: string, name: string) {
	const tag = await getTag(id);
	if (!tag) throw new TagError('Tag nicht gefunden.');
	if (tag.name === name) return;
	try {
		await db.transaction(async (tx) => {
			await tx.update(tags).set({ name, updatedAt: new Date() }).where(eq(tags.id, id));
			await audit(tx, {
				actor,
				entityType: 'tag',
				action: 'update',
				entityId: id,
				entityLabel: name,
				before: { name: tag.name },
				after: { name }
			});
		});
	} catch (e) {
		if (isUniqueViolation(e)) throw new TagError(NAME_TAKEN);
		throw e;
	}
}

/** Like categories: only the admin deletes; assignments go with it, bookings stay. */
export async function deleteTag(actor: NonNullable<Actor> & Viewer, id: string) {
	if (actor.role !== 'admin') throw new TagError('Tags löschen darf nur der Admin.');
	const tag = await getTag(id);
	if (!tag) throw new TagError('Tag nicht gefunden.');
	await db.transaction(async (tx) => {
		await tx.delete(tags).where(eq(tags.id, id));
		await audit(tx, {
			actor,
			entityType: 'tag',
			action: 'delete',
			entityId: id,
			entityLabel: tag.name,
			before: { name: tag.name }
		});
	});
}

/** Tag ids per booking (own) and per recurring item. */
export async function tagsOf(
	executor: Executor,
	bookingIds: string[],
	recurringIds: string[]
): Promise<{ booking: Map<string, string[]>; recurring: Map<string, string[]> }> {
	const [own, inherited] = await Promise.all([
		bookingIds.length
			? executor.select().from(bookingTags).where(inArray(bookingTags.bookingId, bookingIds))
			: [],
		recurringIds.length
			? executor
					.select()
					.from(recurringTags)
					.where(inArray(recurringTags.recurringId, recurringIds))
			: []
	]);
	const booking = new Map<string, string[]>();
	for (const r of own) booking.set(r.bookingId, [...(booking.get(r.bookingId) ?? []), r.tagId]);
	const recurring = new Map<string, string[]>();
	for (const r of inherited)
		recurring.set(r.recurringId, [...(recurring.get(r.recurringId) ?? []), r.tagId]);
	return { booking, recurring };
}

async function namesOf(executor: Executor, ids: string[]): Promise<string | null> {
	if (!ids.length) return null;
	const rows = await executor
		.select({ name: tags.name })
		.from(tags)
		.where(inArray(tags.id, ids))
		.orderBy(asc(sql`lower(${tags.name})`));
	return rows.map((r) => r.name).join(', ');
}

async function validIds(executor: Executor, ids: string[]): Promise<string[]> {
	const unique = [...new Set(ids.filter((id) => UUID.test(id)))];
	if (!unique.length) return [];
	const rows = await executor.select({ id: tags.id }).from(tags).where(inArray(tags.id, unique));
	return rows.map((r) => r.id);
}

/** Own tags of a booking (edit right on its account). */
export async function setBookingTags(
	actor: NonNullable<Actor> & Viewer,
	bookingId: string,
	tagIds: string[]
) {
	if (!UUID.test(bookingId)) throw new TagError('Buchung nicht gefunden.');
	const [booking] = await db.select().from(bookings).where(eq(bookings.id, bookingId));
	const account = booking ? await getAccountFor(actor, booking.accountId) : null;
	if (!booking || !account) throw new TagError('Buchung nicht gefunden.');
	if (!canEditAccount(account.level, account.archivedAt !== null))
		throw new TagError('Die Tags dieser Buchung darfst du nicht ändern.');
	await db.transaction(async (tx) => {
		const ids = await validIds(tx, tagIds);
		const before = (
			await tx.select().from(bookingTags).where(eq(bookingTags.bookingId, bookingId))
		).map((r) => r.tagId);
		await tx.delete(bookingTags).where(eq(bookingTags.bookingId, bookingId));
		if (ids.length) await tx.insert(bookingTags).values(ids.map((tagId) => ({ bookingId, tagId })));
		const changes = diff({ tags: await namesOf(tx, before) }, { tags: await namesOf(tx, ids) });
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'booking',
				action: 'update',
				entityId: bookingId,
				entityLabel: booking.counterparty ?? booking.purpose ?? 'Buchung',
				...changes
			});
	});
}

/** Tags of a recurring item (edit right on the item); they apply to all its bookings. */
export async function setRecurringTags(
	actor: NonNullable<Actor> & Viewer,
	recurringId: string,
	tagIds: string[]
) {
	const item = await getRecurringFor(actor, recurringId);
	if (!item) throw new TagError('Dauerposten nicht gefunden.');
	if (!item.canEdit) throw new TagError('Die Tags dieses Dauerpostens darfst du nicht ändern.');
	await db.transaction(async (tx) => {
		const ids = await validIds(tx, tagIds);
		const before = (
			await tx.select().from(recurringTags).where(eq(recurringTags.recurringId, recurringId))
		).map((r) => r.tagId);
		await tx.delete(recurringTags).where(eq(recurringTags.recurringId, recurringId));
		if (ids.length)
			await tx.insert(recurringTags).values(ids.map((tagId) => ({ recurringId, tagId })));
		const changes = diff({ tags: await namesOf(tx, before) }, { tags: await namesOf(tx, ids) });
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'recurring',
				action: 'update',
				entityId: recurringId,
				entityLabel: item.name,
				...changes
			});
	});
}

/** Number of visible bookings per tag in a year (directly or through their item). */
export async function tagCounts(viewer: Viewer, year: number): Promise<Map<string, number>> {
	const ids = (await listAccountsFor(viewer)).map((a) => a.id);
	if (!ids.length) return new Map();
	const rows = await db
		.select({ tagId: tags.id, n: sql<number>`count(distinct ${bookings.id})::int` })
		.from(tags)
		.innerJoin(
			bookings,
			or(
				sql`exists (select 1 from booking_tags bt where bt.booking_id = ${bookings.id} and bt.tag_id = ${tags.id})`,
				sql`exists (select 1 from recurring_tags rt where rt.recurring_id = ${bookings.recurringId} and rt.tag_id = ${tags.id})`
			)
		)
		.where(
			and(
				inArray(bookings.accountId, ids),
				gte(bookings.bookingDate, `${year}-01-01`),
				lte(bookings.bookingDate, `${year}-12-31`)
			)
		)
		.groupBy(tags.id);
	return new Map(rows.map((r) => [r.tagId, r.n]));
}

export type TagYear = YearSummary & {
	year: number;
	/** Years with bookings carrying the tag (for the selector). */
	years: number[];
	categoryNames: Record<string, string>;
	bookings: Record<
		string,
		{ counterparty: string | null; purpose: string | null; accountName: string; inherited: boolean }
	>;
};

/** "Jahresliste": visible bookings with the tag (own or through their item) in a year. */
export async function tagYear(viewer: Viewer, tagId: string, year: number): Promise<TagYear> {
	const accounts = await listAccountsFor(viewer);
	const ids = accounts.map((a) => a.id);
	const names = new Map(accounts.map((a) => [a.id, a.name]));
	const itemIds = (
		await db
			.select({ id: recurringTags.recurringId })
			.from(recurringTags)
			.where(eq(recurringTags.tagId, tagId))
	).map((r) => r.id);
	const own = (
		await db
			.select({ id: bookingTags.bookingId })
			.from(bookingTags)
			.where(eq(bookingTags.tagId, tagId))
	).map((r) => r.id);
	const tagged = or(
		own.length ? inArray(bookings.id, own) : sql`false`,
		itemIds.length ? inArray(bookings.recurringId, itemIds) : sql`false`
	);
	const empty: TagYear = {
		...yearSummary([]),
		year,
		years: [],
		categoryNames: {},
		bookings: {}
	};
	if (!ids.length || (!own.length && !itemIds.length)) return empty;
	const [rows, yearRows, category] = await Promise.all([
		db
			.select()
			.from(bookings)
			.where(
				and(
					inArray(bookings.accountId, ids),
					tagged,
					gte(bookings.bookingDate, `${year}-01-01`),
					lte(bookings.bookingDate, `${year}-12-31`)
				)
			),
		db
			.selectDistinct({ y: sql<number>`extract(year from ${bookings.bookingDate})::int` })
			.from(bookings)
			.where(and(inArray(bookings.accountId, ids), tagged)),
		categoryInfo(db)
	]);
	const parts = rows.length
		? await db
				.select()
				.from(bookingParts)
				.where(
					inArray(
						bookingParts.bookingId,
						rows.map((r) => r.id)
					)
				)
		: [];
	const ownSet = new Set(own);
	const summary = yearSummary(
		rows.map((b) => ({
			id: b.id,
			bookingDate: b.bookingDate,
			amount: b.amount,
			categoryId: b.categoryId,
			parts: parts
				.filter((p) => p.bookingId === b.id)
				.map((p) => ({ amount: p.amount, categoryId: p.categoryId }))
		}))
	);
	const categoryNames: Record<string, string> = {};
	for (const c of summary.byCategory)
		if (c.categoryId) {
			const info = category(c.categoryId);
			if (info)
				categoryNames[c.categoryId] = info.parentName
					? `${info.parentName} › ${info.name}`
					: info.name;
		}
	return {
		...summary,
		year,
		years: yearRows.map((r) => r.y).sort((a, b) => b - a),
		categoryNames,
		bookings: Object.fromEntries(
			rows.map((b) => [
				b.id,
				{
					counterparty: b.counterparty,
					purpose: b.purpose,
					accountName: names.get(b.accountId) ?? '',
					inherited: !ownSet.has(b.id)
				}
			])
		)
	};
}

/** Recurring items with a tag that the viewer can see (for the tag page). */
export async function itemsWithTag(viewer: Viewer, tagId: string) {
	const ids = (await listAccountsFor(viewer)).map((a) => a.id);
	if (!ids.length) return [];
	return db
		.select({ id: recurringItems.id, name: recurringItems.name })
		.from(recurringTags)
		.innerJoin(recurringItems, eq(recurringItems.id, recurringTags.recurringId))
		.where(
			and(
				eq(recurringTags.tagId, tagId),
				or(inArray(recurringItems.accountId, ids), inArray(recurringItems.targetAccountId, ids))
			)
		)
		.orderBy(asc(recurringItems.name));
}

/**
 * Reads the tag editor: checked tag ids plus an optional new tag (created if missing).
 * Returns the ids or a German error for the new tag's name.
 */
export async function readTagForm(
	actor: NonNullable<Actor>,
	data: FormData
): Promise<{ ids: string[]; error: null } | { ids: null; error: string }> {
	const ids = data.getAll('tag').filter((v): v is string => typeof v === 'string');
	const raw = data.get('newTag');
	if (typeof raw === 'string' && raw.trim()) {
		const { name, error } = validateTagName(raw);
		if (error !== null) return { ids: null, error };
		try {
			ids.push(await ensureTag(actor, name));
		} catch (e) {
			if (e instanceof TagError) return { ids: null, error: e.message };
			throw e;
		}
	}
	return { ids, error: null };
}
