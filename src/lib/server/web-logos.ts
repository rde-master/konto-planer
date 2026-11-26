import { createHash } from 'node:crypto';
import dns from 'node:dns';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import https from 'node:https';
import type { LookupFunction } from 'node:net';
import path from 'node:path';
import { and, desc, eq, gte, isNotNull, lt, ne, sql } from 'drizzle-orm';
import { db } from './db/index.js';
import { bookings, payeeLogos, recurringItems, webIcons } from './db/schema.js';
import { isDemo } from './demo-mode.js';
import type { Actor } from './audit.js';
import { LogoError, hasBuiltinLogo, setPayeeLogo } from './logos.js';
import { payeeKey } from '../import-match.js';
import {
	WEB_NONE,
	WEB_PREFIX,
	brandDomain,
	guessDomains,
	iconCandidates,
	isPrivateAddress,
	normalizeDomain,
	pageTitle,
	sniffImage,
	titleMatches
} from '../web-logos.js';
import { addDays } from '../recurring.js';
import { todayBerlin } from '../dates.js';

export class WebLogoError extends LogoError {}

/** Web logos need the internet; `WEB_LOGOS=false` switches them off (the demo never fetches). */
export function webLogosEnabled(): boolean {
	return process.env.WEB_LOGOS !== 'false' && !isDemo();
}

/** Only for automated tests: all requests go to this stand-in server. */
function testBase(): string | null {
	return process.env.LOGO_TEST_BASE?.trim() || null;
}

function logoDir(): string {
	return path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'), 'logos');
}

const ID = /^[a-z0-9][a-z0-9.-]{1,110}$/;

// --- fetching: public https hosts only -------------------------------------------------------

/** DNS lookup that refuses private, loopback and link-local addresses (checked at connect). */
const guardedLookup: LookupFunction = (hostname, options, callback) => {
	dns.lookup(hostname, { all: true }, (err, addresses) => {
		if (err) return callback(err, '', 4);
		const ok = addresses.filter((a) => !isPrivateAddress(a.address));
		if (!ok.length)
			return callback(new Error('Adresse im privaten Netz wird nicht abgerufen.'), '', 4);
		if (typeof options === 'object' && options.all)
			(callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, ok);
		else callback(null, ok[0].address, ok[0].family);
	});
};

type Fetched = { status: number; body: Uint8Array; url: string };

function httpsGet(url: URL, maxBytes: number): Promise<Fetched & { location: string | null }> {
	return new Promise((resolve, reject) => {
		const req = https.get(
			url,
			{
				lookup: guardedLookup,
				timeout: 6000,
				headers: {
					'user-agent': 'Mozilla/5.0 (compatible; KontoPlaner; icon fetch)',
					accept: 'text/html,image/*;q=0.9,*/*;q=0.5',
					'accept-language': 'de,en;q=0.7'
				}
			},
			(res) => {
				const chunks: Buffer[] = [];
				let size = 0;
				res.on('data', (c: Buffer) => {
					size += c.length;
					if (size > maxBytes) {
						res.destroy();
						// Enough for the icon links in the head of a page.
						resolve({
							status: res.statusCode ?? 0,
							body: new Uint8Array(Buffer.concat(chunks)),
							url: url.href,
							location: null
						});
					} else chunks.push(c);
				});
				res.on('end', () =>
					resolve({
						status: res.statusCode ?? 0,
						body: new Uint8Array(Buffer.concat(chunks)),
						url: url.href,
						location: typeof res.headers.location === 'string' ? res.headers.location : null
					})
				);
				res.on('error', reject);
			}
		);
		req.on('timeout', () => req.destroy(new Error('Zeitüberschreitung')));
		req.on('error', reject);
	});
}

/** GET of a public https address (redirects followed, size limited); null on any failure. */
async function get(address: string, maxBytes: number): Promise<Fetched | null> {
	try {
		const base = testBase();
		if (base) {
			// Tests: https://host/path → <base>/site/host/path
			const u = new URL(address);
			const res = await fetch(`${base}/site/${u.host}${u.pathname}${u.search}`, {
				signal: AbortSignal.timeout(5000)
			});
			return { status: res.status, body: new Uint8Array(await res.arrayBuffer()), url: address };
		}
		let url = new URL(address);
		for (let hop = 0; hop < 5; hop++) {
			if (url.protocol !== 'https:' || (url.port && url.port !== '443')) return null;
			if (!normalizeDomain(url.hostname)) return null;
			const res = await httpsGet(url, maxBytes);
			if (res.status >= 300 && res.status < 400 && res.location) {
				url = new URL(res.location, url);
				continue;
			}
			return res;
		}
		return null;
	} catch {
		return null;
	}
}

type Icon = { bytes: Uint8Array; contentType: string; source: 'site' | 'google' | 'url' };

const MAX_ICON = 300_000;

async function image(address: string): Promise<{ bytes: Uint8Array; contentType: string } | null> {
	const res = await get(address, MAX_ICON);
	if (!res || res.status !== 200 || res.body.length >= MAX_ICON) return null;
	const contentType = sniffImage(res.body);
	return contentType ? { bytes: res.body, contentType } : null;
}

/**
 * Icon of a website: the best icon the site names itself, otherwise Google's favicon service.
 * With `verifyName` (guessed websites) the page title must name the payee.
 */
async function fetchIcon(domain: string, verifyName?: string): Promise<Icon | null> {
	const page =
		(await get(`https://${domain}/`, 400_000)) ?? (await get(`https://www.${domain}/`, 400_000));
	const ok = page !== null && page.status === 200;
	const html = ok ? new TextDecoder().decode(page.body) : '';
	if (verifyName && (!ok || !titleMatches(pageTitle(html), verifyName))) return null;
	if (ok)
		for (const candidate of iconCandidates(html, page.url)) {
			const found = await image(candidate);
			if (found) return { ...found, source: 'site' };
		}
	const google = await image(
		`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`
	);
	return google ? { ...google, source: 'google' } : null;
}

async function store(id: string, icon: Icon, url: string | null) {
	const dir = logoDir();
	await mkdir(dir, { recursive: true });
	const tmp = path.join(dir, `${id}.${process.pid}.tmp`);
	await writeFile(tmp, icon.bytes, { mode: 0o600 });
	await rename(tmp, path.join(dir, id));
	const values = {
		contentType: icon.contentType,
		size: icon.bytes.length,
		source: icon.source,
		url,
		fetchedAt: new Date()
	};
	await db
		.insert(webIcons)
		.values({ id, ...values })
		.onConflictDoUpdate({ target: webIcons.id, set: values });
}

async function known(id: string): Promise<boolean> {
	const [row] = await db.select({ id: webIcons.id }).from(webIcons).where(eq(webIcons.id, id));
	return !!row;
}

/** Makes sure the icon of a website is stored; false if none could be found. */
export async function ensureIcon(domain: string, verifyName?: string): Promise<boolean> {
	if (await known(domain)) return true;
	const icon = await fetchIcon(domain, verifyName);
	if (!icon) return false;
	await store(domain, icon, null);
	return true;
}

/**
 * Icon from what the user typed: a website ("rewe.de") or the address of an image found in a
 * web search. Returns the id for "web:<id>".
 */
export async function iconFromInput(input: string): Promise<string> {
	if (!webLogosEnabled()) throw new WebLogoError('Logos aus dem Web sind hier abgeschaltet.');
	const text = input.trim();
	const url = URL.parse(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
	const domain = url ? normalizeDomain(url.hostname) : null;
	if (!url || !domain || url.protocol !== 'https:')
		throw new WebLogoError('Bitte eine Webseite wie rewe.de oder eine https-Bildadresse eingeben.');
	if (url.pathname.length > 1) {
		// A direct image address.
		const found = await image(url.href);
		if (found) {
			const id = `u-${createHash('sha256').update(url.href).digest('hex').slice(0, 20)}`;
			await store(id, { ...found, source: 'url' }, url.href.slice(0, 500));
			return id;
		}
	}
	if (!(await ensureIcon(domain)))
		throw new WebLogoError(`Auf ${domain} wurde kein Logo gefunden.`);
	return domain;
}

/** The stored image of a web icon. */
export async function readIcon(id: string) {
	if (!ID.test(id) || id.includes('..')) return null;
	const [row] = await db.select().from(webIcons).where(eq(webIcons.id, id));
	if (!row) return null;
	try {
		return { bytes: await readFile(path.join(logoDir(), id)), contentType: row.contentType };
	} catch {
		return null;
	}
}

// --- background search -----------------------------------------------------------------------

const RETRY_DAYS = 30;

/**
 * Looks for web logos of payees that have none: known brands first, then a cautious guess from
 * the name. Remembers misses, so a payee is searched once a month at most. Returns the number
 * of logos found.
 */
export async function syncWebLogos({ budgetMs = 40_000 } = {}): Promise<number> {
	if (!webLogosEnabled()) return 0;
	const started = Date.now();
	const since = addDays(todayBerlin(), -400);
	await db
		.delete(payeeLogos)
		.where(
			and(
				eq(payeeLogos.auto, true),
				eq(payeeLogos.slug, WEB_NONE),
				lt(payeeLogos.updatedAt, new Date(Date.now() - RETRY_DAYS * 86_400_000))
			)
		);
	const [booked, items, done] = await Promise.all([
		db
			.select({
				iban: bookings.iban,
				name: bookings.counterparty,
				n: sql<string>`count(*)::text`
			})
			.from(bookings)
			.where(and(isNotNull(bookings.counterparty), gte(bookings.bookingDate, since)))
			.groupBy(bookings.iban, bookings.counterparty)
			.orderBy(desc(sql`count(*)`))
			.limit(2000),
		db
			.select({
				iban: recurringItems.iban,
				name: recurringItems.counterparty,
				title: recurringItems.name
			})
			.from(recurringItems)
			.where(ne(recurringItems.kind, 'transfer')),
		db.select({ key: payeeLogos.key }).from(payeeLogos)
	]);
	const seen = new Set(done.map((d) => d.key));
	const payees = [
		...items.map((i) => ({ iban: i.iban, name: i.name ?? i.title })),
		...booked.map((b) => ({ iban: b.iban, name: b.name }))
	];
	// Payees still to look up, each key once.
	const todo: { key: string; name: string }[] = [];
	for (const p of payees) {
		const name = p.name?.trim();
		const key = payeeKey({ counterpartyIban: p.iban, counterparty: name ?? null });
		if (!name || !key || seen.has(key)) continue;
		seen.add(key);
		if (!hasBuiltinLogo(name)) todo.push({ key, name });
	}
	let found = 0;
	const lookUp = async ({ key, name }: { key: string; name: string }) => {
		let id: string | null = null;
		const brand = brandDomain(name);
		if (brand) id = (await ensureIcon(brand)) ? brand : null;
		else
			for (const guess of guessDomains(name)) {
				if (await ensureIcon(guess, name)) {
					id = guess;
					break;
				}
			}
		await db
			.insert(payeeLogos)
			.values({ key, slug: id ? `${WEB_PREFIX}${id}` : WEB_NONE, auto: true })
			.onConflictDoNothing();
		if (id) found++;
	};
	// A few websites at a time, until the time budget is used up.
	const PARALLEL = 4;
	for (let i = 0; i < todo.length && Date.now() - started < budgetMs; i += PARALLEL)
		await Promise.all(todo.slice(i, i + PARALLEL).map(lookUp));
	return found;
}

/**
 * "Logo ändern": the form sends either `web` (a website or image address to fetch) or `slug`
 * (Simple Icons, "web:<id>", "-" or empty for automatic).
 */
export async function setPayeeLogoFromForm(
	actor: NonNullable<Actor>,
	key: string,
	label: string,
	data: FormData
) {
	const text = (name: string) => {
		const v = data.get(name);
		return typeof v === 'string' ? v.trim() : '';
	};
	const web = text('web');
	const slug = web ? `${WEB_PREFIX}${await iconFromInput(web)}` : text('slug') || null;
	await setPayeeLogo(actor, key, label, slug);
}
