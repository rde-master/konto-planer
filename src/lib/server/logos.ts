import { eq, inArray } from 'drizzle-orm';
import * as icons from 'simple-icons';
import { db } from './db/index.js';
import { payeeLogos } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { payeeKey } from '../import-match.js';
import { buildIndex, resolveLogo, words, NO_LOGO, type LogoEntry, type LogoRef } from '../logos.js';

export class LogoError extends Error {}

type SimpleIcon = { title: string; slug: string; hex: string; path: string };

const all = Object.values(icons as unknown as Record<string, SimpleIcon>).filter(
	(i) => typeof i === 'object' && i !== null && 'slug' in i && 'path' in i
);
const paths = new Map(all.map((i) => [i.slug, i.path]));
const index = buildIndex(all.map(({ slug, title, hex }) => ({ slug, title, hex })));

/** SVG of a logo in its brand color, or null for an unknown slug. */
export function logoSvg(slug: string): string | null {
	const path = paths.get(slug);
	const entry = index.bySlug.get(slug);
	if (!path || !entry) return null;
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img"><title>${entry.title.replace(/[<&>]/g, '')}</title><path fill="#${entry.hex}" d="${path}"/></svg>`;
}

/** Logos whose title contains all words of the query (best: title starts with it). */
export function searchLogos(query: string, limit = 40): LogoEntry[] {
	const q = words(query);
	if (!q.length) return [];
	const joined = q.join(' ');
	return index.entries
		.filter(({ words: w }) => q.every((part) => w.some((x) => x.startsWith(part))))
		.sort(
			(a, b) =>
				Number(!a.words.join(' ').startsWith(joined)) -
					Number(!b.words.join(' ').startsWith(joined)) ||
				a.entry.title.localeCompare(b.entry.title, 'de')
		)
		.slice(0, limit)
		.map((e) => e.entry);
}

/** Logos chosen by hand for the given payee keys. */
export async function logoOverrides(keys: (string | null)[]): Promise<Map<string, string>> {
	const list = [...new Set(keys.filter((k): k is string => !!k))];
	if (!list.length) return new Map();
	const rows = await db.select().from(payeeLogos).where(inArray(payeeLogos.key, list));
	return new Map(rows.map((r) => [r.key, r.slug]));
}

/** Logo of a payee: the one chosen by hand, otherwise matched by name. */
export function logoOf(
	overrides: Map<string, string>,
	key: string | null,
	name: string | null
): LogoRef | null {
	return resolveLogo(index, name, key ? overrides.get(key) : undefined);
}

/** Title of a logo (for the picker). */
export function logoTitle(slug: string): string | null {
	return index.bySlug.get(slug)?.title ?? null;
}

/**
 * Sets the logo of a payee for all its bookings and recurring items: a slug, NO_LOGO, or null
 * for the automatic match.
 */
export async function setPayeeLogo(
	actor: NonNullable<Actor>,
	key: string,
	label: string,
	slug: string | null
) {
	if (slug && slug !== NO_LOGO && !index.bySlug.has(slug))
		throw new LogoError('Dieses Logo gibt es nicht.');
	await db.transaction(async (tx) => {
		const [before] = await tx.select().from(payeeLogos).where(eq(payeeLogos.key, key));
		const show = (s: string | null | undefined) =>
			!s ? 'automatisch' : s === NO_LOGO ? 'keins' : (index.bySlug.get(s)?.title ?? s);
		if ((before?.slug ?? null) === slug) return;
		if (slug === null) await tx.delete(payeeLogos).where(eq(payeeLogos.key, key));
		else
			await tx
				.insert(payeeLogos)
				.values({ key, slug })
				.onConflictDoUpdate({ target: payeeLogos.key, set: { slug, updatedAt: new Date() } });
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityId: null,
			entityLabel: label,
			before: { logo: show(before?.slug) },
			after: { logo: show(slug) }
		});
	});
}

export type ItemLogo = { logo: LogoRef | null; key: string | null; chosen: string | null };

/** Logos of recurring items (by payee, else by name); transfers have none. */
export async function itemLogos(
	items: {
		id: string;
		kind: string;
		iban: string | null;
		counterparty: string | null;
		name: string;
	}[]
): Promise<Record<string, ItemLogo>> {
	const keyOf = (i: (typeof items)[number]) =>
		i.kind === 'transfer'
			? null
			: payeeKey({ counterpartyIban: i.iban, counterparty: i.counterparty ?? i.name });
	const overrides = await logoOverrides(items.map(keyOf));
	return Object.fromEntries(
		items.map((i) => {
			const key = keyOf(i);
			return [
				i.id,
				{
					logo: key ? logoOf(overrides, key, i.counterparty ?? i.name) : null,
					key,
					chosen: key ? (overrides.get(key) ?? null) : null
				}
			];
		})
	);
}
