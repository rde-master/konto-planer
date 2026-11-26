// Company logos from the web: the firm's website icon (or Google's favicon service) for payees
// Simple Icons does not know. Pure parts: brand → website, cautious guesses, icon links, checks.
import { WEB_PREFIX, hasLegalForm, payeeWords } from './logos.js';

/** Stored logo choice for a web icon: "web:<id>", id = domain or "u-<hash>" for an image URL. */
export { WEB_PREFIX };
/** Stored by the background job when nothing was found (do not retry soon). */
export const WEB_NONE = '~';

/**
 * Well-known payees in Germany → website. Keys are the first words of the cleaned payee name
 * (lower case, umlauts spelled out, "&" = "and", legal forms removed).
 */
export const BRAND_DOMAINS: Record<string, string> = {
	// Supermarkets and drugstores
	rewe: 'rewe.de',
	edeka: 'edeka.de',
	lidl: 'lidl.de',
	'aldi nord': 'aldi-nord.de',
	'aldi sued': 'aldi-sued.de',
	'aldi talk': 'alditalk.de',
	aldi: 'aldi-sued.de',
	kaufland: 'kaufland.de',
	penny: 'penny.de',
	netto: 'netto-online.de',
	norma: 'norma-online.de',
	globus: 'globus.de',
	tegut: 'tegut.com',
	famila: 'famila.de',
	marktkauf: 'marktkauf.de',
	denns: 'denns-biomarkt.de',
	alnatura: 'alnatura.de',
	dm: 'dm.de',
	rossmann: 'rossmann.de',
	mueller: 'mueller.de',
	budni: 'budni.de',
	// Home, DIY, electronics
	obi: 'obi.de',
	bauhaus: 'bauhaus.info',
	hornbach: 'hornbach.de',
	toom: 'toom.de',
	hagebau: 'hagebau.de',
	hagebaumarkt: 'hagebau.de',
	ikea: 'ikea.com',
	poco: 'poco.de',
	roller: 'roller.de',
	xxxlutz: 'xxxlutz.de',
	hoeffner: 'hoeffner.de',
	jysk: 'jysk.de',
	mediamarkt: 'mediamarkt.de',
	'media markt': 'mediamarkt.de',
	saturn: 'saturn.de',
	conrad: 'conrad.de',
	cyberport: 'cyberport.de',
	notebooksbilliger: 'notebooksbilliger.de',
	alternate: 'alternate.de',
	// Fashion and retail
	'h and m': 'hm.com',
	'c and a': 'c-and-a.com',
	zalando: 'zalando.de',
	'about you': 'aboutyou.de',
	aboutyou: 'aboutyou.de',
	deichmann: 'deichmann.com',
	kik: 'kik.de',
	takko: 'takko.com',
	'tk maxx': 'tkmaxx.de',
	primark: 'primark.com',
	tchibo: 'tchibo.de',
	decathlon: 'decathlon.de',
	intersport: 'intersport.de',
	tedi: 'tedi.com',
	action: 'action.com',
	woolworth: 'woolworth.de',
	thalia: 'thalia.de',
	hugendubel: 'hugendubel.de',
	douglas: 'douglas.de',
	fielmann: 'fielmann.de',
	apollo: 'apollo.de',
	fressnapf: 'fressnapf.de',
	// Online
	amazon: 'amazon.de',
	amzn: 'amazon.de',
	ebay: 'ebay.de',
	otto: 'otto.de',
	paypal: 'paypal.com',
	klarna: 'klarna.com',
	check24: 'check24.de',
	idealo: 'idealo.de',
	lieferando: 'lieferando.de',
	hellofresh: 'hellofresh.de',
	flaschenpost: 'flaschenpost.de',
	picnic: 'picnic.app',
	wolt: 'wolt.com',
	uber: 'uber.com',
	booking: 'booking.com',
	airbnb: 'airbnb.de',
	eventim: 'eventim.de',
	'shop apotheke': 'shop-apotheke.com',
	docmorris: 'docmorris.de',
	// Telecom and energy
	telekom: 'telekom.de',
	'deutsche telekom': 'telekom.de',
	vodafone: 'vodafone.de',
	o2: 'o2online.de',
	telefonica: 'o2online.de',
	'1und1': '1und1.de',
	'1 und 1': '1und1.de',
	'1 and 1': '1und1.de',
	congstar: 'congstar.de',
	freenet: 'freenet.de',
	pyur: 'pyur.com',
	eon: 'eon.de',
	'e on': 'eon.de',
	vattenfall: 'vattenfall.de',
	enbw: 'enbw.com',
	rwe: 'rwe.com',
	eprimo: 'eprimo.de',
	yello: 'yello.de',
	lichtblick: 'lichtblick.de',
	naturstrom: 'naturstrom.de',
	octopus: 'octopusenergy.de',
	tibber: 'tibber.com',
	beitragsservice: 'rundfunkbeitrag.de',
	rundfunk: 'rundfunkbeitrag.de',
	'ard zdf': 'rundfunkbeitrag.de',
	// Banks, insurance, health
	sparkasse: 'sparkasse.de',
	volksbank: 'vr.de',
	raiffeisenbank: 'vr.de',
	ing: 'ing.de',
	dkb: 'dkb.de',
	comdirect: 'comdirect.de',
	commerzbank: 'commerzbank.de',
	'deutsche bank': 'deutsche-bank.de',
	postbank: 'postbank.de',
	targobank: 'targobank.de',
	santander: 'santander.de',
	n26: 'n26.com',
	'american express': 'americanexpress.com',
	barclays: 'barclays.de',
	allianz: 'allianz.de',
	huk: 'huk.de',
	huk24: 'huk24.de',
	ergo: 'ergo.de',
	axa: 'axa.de',
	debeka: 'debeka.de',
	generali: 'generali.de',
	'r v': 'ruv.de',
	lvm: 'lvm.de',
	devk: 'devk.de',
	'signal iduna': 'signal-iduna.de',
	gothaer: 'gothaer.de',
	cosmosdirekt: 'cosmosdirekt.de',
	hdi: 'hdi.de',
	provinzial: 'provinzial.de',
	adac: 'adac.de',
	techniker: 'tk.de',
	aok: 'aok.de',
	barmer: 'barmer.de',
	dak: 'dak.de',
	// Mobility
	db: 'bahn.de',
	'deutsche bahn': 'bahn.de',
	bvg: 'bvg.de',
	hvv: 'hvv.de',
	mvg: 'mvg.de',
	flixbus: 'flixbus.de',
	flix: 'flixbus.de',
	aral: 'aral.de',
	shell: 'shell.de',
	esso: 'esso.de',
	totalenergies: 'totalenergies.de',
	total: 'totalenergies.de',
	sixt: 'sixt.de',
	europcar: 'europcar.de',
	lufthansa: 'lufthansa.com',
	eurowings: 'eurowings.com',
	ryanair: 'ryanair.com',
	easyjet: 'easyjet.com',
	atu: 'atu.de',
	dekra: 'dekra.de',
	// Streaming and software
	netflix: 'netflix.com',
	spotify: 'spotify.com',
	disney: 'disneyplus.com',
	apple: 'apple.com',
	google: 'google.com',
	microsoft: 'microsoft.com',
	adobe: 'adobe.com',
	dazn: 'dazn.com',
	sky: 'sky.de',
	audible: 'audible.de',
	strato: 'strato.de',
	ionos: 'ionos.de',
	hetzner: 'hetzner.com',
	// Food and delivery
	mcdonalds: 'mcdonalds.com',
	'mcdonald s': 'mcdonalds.com',
	'burger king': 'burgerking.de',
	subway: 'subway.com',
	kfc: 'kfc.de',
	starbucks: 'starbucks.de',
	nordsee: 'nordsee.com',
	kamps: 'kamps.de',
	dominos: 'dominos.de',
	// Parcels, fitness, public bodies
	dhl: 'dhl.de',
	'deutsche post': 'deutschepost.de',
	hermes: 'myhermes.de',
	dpd: 'dpd.com',
	gls: 'gls-pakete.de',
	ups: 'ups.com',
	mcfit: 'mcfit.com',
	fitx: 'fitx.de',
	'clever fit': 'clever-fit.com',
	'urban sports': 'urbansportsclub.com',
	bundesagentur: 'arbeitsagentur.de',
	familienkasse: 'arbeitsagentur.de',
	'deutsche rentenversicherung': 'deutsche-rentenversicherung.de'
};

/** Brands that are also names or everyday words: only for companies or the bare brand. */
const AMBIGUOUS = new Set([
	'otto',
	'mueller',
	'norma',
	'action',
	'roller',
	'apollo',
	'total',
	'sky',
	'flix',
	'ing',
	'db',
	'dm',
	'ups',
	'google',
	'apple'
]);

/** Website of a known brand the payee name starts with, or null. */
export function brandDomain(name: string | null): string | null {
	if (!name) return null;
	const w = payeeWords(name);
	for (const n of [3, 2, 1]) {
		if (w.length < n) continue;
		const key = w.slice(0, n).join(' ');
		const domain = BRAND_DOMAINS[key];
		if (!domain) continue;
		if (n === 1 && AMBIGUOUS.has(key) && w.length > 1 && !hasLegalForm(name)) continue;
		return domain;
	}
	return null;
}

/** First words that say what a business is, not who ("Stadtwerke …", "Apotheke …"). */
const GENERIC = new Set([
	'stadtwerke',
	'apotheke',
	'baeckerei',
	'praxis',
	'restaurant',
	'hotel',
	'gasthaus',
	'gasthof',
	'autohaus',
	'kreissparkasse',
	'stadtsparkasse',
	'gemeinde',
	'stadt',
	'landkreis',
	'verein',
	'tankstelle',
	'kiosk',
	'cafe',
	'pizzeria',
	'metzgerei',
	'fleischerei',
	'friseur',
	'blumen',
	'taxi',
	'zahnarzt',
	'kita',
	'schule',
	'hausverwaltung',
	'wohnungsbau',
	'die',
	'der',
	'das',
	'deutsche',
	'deutscher',
	'erste',
	'neue',
	'international',
	'getraenke',
	'markt',
	'shop'
]);

/**
 * Websites worth trying for a payee without a known brand – only for names that look like one
 * company (a single word, or with a legal form), never for people.
 */
export function guessDomains(name: string | null): string[] {
	if (!name) return [];
	const w = payeeWords(name).filter((x) => /^[a-z0-9]+$/.test(x));
	if (!w.length || w.length > 4) return [];
	if (w.length > 1 && !hasLegalForm(name)) return [];
	const bases: string[] = [];
	if (w.length > 1) bases.push(w.join(''), w.join('-'));
	if (!GENERIC.has(w[0]) && w[0].length >= 3) bases.push(w[0]);
	const out: string[] = [];
	for (const b of bases)
		for (const tld of ['de', 'com']) if (b.length >= 3 && b.length <= 40) out.push(`${b}.${tld}`);
	return [...new Set(out)];
}

/** "https://www.rewe.de/angebote" → "rewe.de"; null for anything that is not a public host name. */
export function normalizeDomain(input: string): string | null {
	let v = input.trim().toLowerCase();
	v = v
		.replace(/^[a-z]+:\/\//, '')
		.replace(/[/?#].*$/, '')
		.replace(/:\d+$/, '')
		.replace(/^www\./, '');
	if (v.length > 100 || !/^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(v)) return null;
	if (/\.(local|lan|internal|localhost|home|arpa|test|invalid|example)$/.test(v)) return null;
	return v;
}

/** Addresses the server must never fetch from (loopback, private networks, link-local …). */
export function isPrivateAddress(ip: string): boolean {
	const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
	const v4 = mapped ? mapped[1] : ip;
	const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(v4);
	if (m) {
		const [a, b] = [Number(m[1]), Number(m[2])];
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			(a === 192 && b === 0) ||
			(a === 198 && (b === 18 || b === 19)) ||
			a >= 224
		);
	}
	const v6 = ip.toLowerCase();
	return (
		v6 === '::' ||
		v6 === '::1' ||
		v6.startsWith('fc') ||
		v6.startsWith('fd') ||
		v6.startsWith('fe8') ||
		v6.startsWith('fe9') ||
		v6.startsWith('fea') ||
		v6.startsWith('feb') ||
		v6.startsWith('ff')
	);
}

/** Icon links of a page, best first (touch icons, then large icons), plus the usual defaults. */
export function iconCandidates(html: string, pageUrl: string): string[] {
	const found: { url: string; score: number }[] = [];
	for (const tag of html.slice(0, 300_000).match(/<link\b[^>]*>/gi) ?? []) {
		const attr = (name: string) =>
			new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
				.exec(tag)
				?.slice(1)
				.find((x) => x !== undefined) ?? '';
		const rel = attr('rel').toLowerCase();
		const href = attr('href');
		if (!href || !/\bicon\b/.test(rel) || rel.includes('mask-icon')) continue;
		const size = Math.max(
			0,
			...[...attr('sizes').matchAll(/(\d+)x\d+/gi)].map((s) => Number(s[1]))
		);
		let score = rel.includes('apple-touch-icon') ? 180 : size || 32;
		if (/svg/i.test(attr('type')) || /\.svg(\?|$)/i.test(href)) score = Math.max(score, 100);
		// Very large images are slow and not needed for a small circle.
		if (score > 512) score = 60;
		try {
			const url = new URL(href, pageUrl);
			if (url.protocol === 'https:') found.push({ url: url.href, score });
		} catch {
			/* broken link */
		}
	}
	const base = new URL(pageUrl).origin;
	const ordered = found.sort((a, b) => b.score - a.score).map((f) => f.url);
	return [...new Set([...ordered, `${base}/apple-touch-icon.png`, `${base}/favicon.ico`])].slice(
		0,
		6
	);
}

/** Page title (or site name), to check that a guessed website belongs to the payee. */
export function pageTitle(html: string): string {
	const head = html.slice(0, 100_000);
	const site =
		/<meta[^>]+property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']+)["']/i.exec(head);
	const title = /<title[^>]*>([^<]*)<\/title>/i.exec(head);
	return `${site?.[1] ?? ''} ${title?.[1] ?? ''}`.trim();
}

/** Image type from the first bytes; null for anything that is not a harmless image. */
export function sniffImage(bytes: Uint8Array): string | null {
	const b = bytes;
	if (b.length < 12) return null;
	if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
	if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
	if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return 'image/gif';
	if (
		b[0] === 0x52 &&
		b[1] === 0x49 &&
		b[2] === 0x46 &&
		b[3] === 0x46 &&
		b[8] === 0x57 &&
		b[9] === 0x45
	)
		return 'image/webp';
	if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'image/x-icon';
	const text = new TextDecoder().decode(b.slice(0, 4000)).toLowerCase();
	if (/^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)?(<!doctype svg[^>]*>\s*)?<svg[\s>]/.test(text)) {
		const all = new TextDecoder().decode(b).toLowerCase();
		if (!/<script|\son\w+\s*=|javascript:|<foreignobject/.test(all)) return 'image/svg+xml';
	}
	return null;
}

/** Whether the page title names the payee (first word), for guessed websites. */
export function titleMatches(title: string, name: string): boolean {
	const first = payeeWords(name)[0];
	return !!first && payeeWords(title).join('').includes(first);
}
