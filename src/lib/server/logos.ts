import { eq, inArray } from 'drizzle-orm';
import * as icons from 'simple-icons';
import { db } from './db/index.js';
import { payeeLogos, webIcons } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { payeeKey } from '../import-match.js';
import {
	buildIndex,
	matchLogo,
	resolveLogo,
	words,
	NO_LOGO,
	WEB_PREFIX,
	type LogoEntry,
	type LogoRef
} from '../logos.js';

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

/** Whether Simple Icons knows the payee (then no web search is needed). */
export function hasBuiltinLogo(name: string): boolean {
	return matchLogo(index, name) !== null;
}

export type LogoChoice = { slug: string; auto: boolean };

/** Stored logos of the given payee keys: chosen by hand, or found by the web search (`auto`). */
export async function logoOverrides(keys: (string | null)[]): Promise<Map<string, LogoChoice>> {
	const list = [...new Set(keys.filter((k): k is string => !!k))];
	if (!list.length) return new Map();
	const rows = await db.select().from(payeeLogos).where(inArray(payeeLogos.key, list));
	return new Map(rows.map((r) => [r.key, { slug: r.slug, auto: r.auto }]));
}

/** The choice made by hand for a payee (null = automatic). */
export function chosenLogo(overrides: Map<string, LogoChoice>, key: string | null): string | null {
	const o = key ? overrides.get(key) : undefined;
	return o && !o.auto ? o.slug : null;
}

/** Logo of a payee: the one chosen by hand, otherwise matched by name. */
export function logoOf(
	overrides: Map<string, LogoChoice>,
	key: string | null,
	name: string | null
): LogoRef | null {
	const o = key ? overrides.get(key) : undefined;
	return resolveLogo(index, name, o && !o.auto ? o.slug : undefined, o?.auto ? o.slug : undefined);
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
	if (slug?.startsWith(WEB_PREFIX)) {
		const [icon] = await db
			.select({ id: webIcons.id })
			.from(webIcons)
			.where(eq(webIcons.id, slug.slice(WEB_PREFIX.length)));
		if (!icon) throw new LogoError('Dieses Logo gibt es nicht.');
	} else if (slug && slug !== NO_LOGO && !index.bySlug.has(slug))
		throw new LogoError('Dieses Logo gibt es nicht.');
	await db.transaction(async (tx) => {
		const [before] = await tx.select().from(payeeLogos).where(eq(payeeLogos.key, key));
		const show = (s: string | null | undefined) =>
			!s
				? 'automatisch'
				: s === NO_LOGO
					? 'keins'
					: s.startsWith(WEB_PREFIX)
						? `aus dem Web (${s.slice(WEB_PREFIX.length)})`
						: (index.bySlug.get(s)?.title ?? s);
		const manual = before && !before.auto ? before.slug : null;
		if (manual === slug && !(before?.auto && slug === null)) return;
		if (slug === null) await tx.delete(payeeLogos).where(eq(payeeLogos.key, key));
		else
			await tx
				.insert(payeeLogos)
				.values({ key, slug, auto: false })
				.onConflictDoUpdate({
					target: payeeLogos.key,
					set: { slug, auto: false, updatedAt: new Date() }
				});
		await audit(tx, {
			actor,
			entityType: 'settings',
			action: 'update',
			entityId: null,
			entityLabel: label,
			before: { logo: show(manual) },
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
					chosen: chosenLogo(overrides, key)
				}
			];
		})
	);
}
