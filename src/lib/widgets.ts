// iOS widgets via Scriptable: templates, the blocks the server sends and the generic script.
import { formatEuro } from './money.js';
import { formatDay } from './dates.js';
import { ACCOUNT_COLORS, type AccountColor } from './colors.js';

export const WIDGET_TEMPLATES = ['available', 'payments', 'accounts'] as const;
export type WidgetTemplate = (typeof WIDGET_TEMPLATES)[number];
export const WIDGET_SIZES = ['small', 'medium', 'large'] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];

export const TEMPLATE_INFO: Record<WidgetTemplate, { title: string; text: string }> = {
	available: {
		title: 'Verfügbar bis Gehalt',
		text: 'Was bis zum Stichtag frei ist, mit Mindestbestand und Stand.'
	},
	payments: { title: 'Offene Zahlungen', text: 'Die nächsten Zahlungen mit Datum und Betrag.' },
	accounts: { title: 'Alle Konten', text: 'Stand aller gewählten Konten und die Summe.' }
};
export const SIZE_LABELS: Record<WidgetSize, string> = {
	small: 'Klein',
	medium: 'Mittel',
	large: 'Groß'
};

export type BlockColor = 'text' | 'sub' | 'red' | 'green' | 'accent';
export type Block =
	| { type: 'title'; text: string }
	| { type: 'big'; value: string; color: BlockColor }
	| { type: 'row'; label: string; value: string; color?: BlockColor }
	| { type: 'bar'; value: number; color: BlockColor }
	| { type: 'spacer' };

export type WidgetData = {
	accounts: {
		id?: string;
		name: string;
		type: string;
		color?: string;
		balance: number;
		available: number | null;
		minimum: number | null;
		cutoff: string | null;
	}[];
	payments: { name: string; date: string; amount: number; accountId?: string }[];
};

// --- layout (editor) ----------------------------------------------------------------------

export const ITEM_KINDS = [
	'title',
	'available',
	'progress',
	'minimum',
	'balance',
	'nextPayment',
	'payments',
	'accounts',
	'spacer'
] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
export const ITEM_LABELS: Record<ItemKind, string> = {
	title: 'Überschrift',
	available: 'Verfügbar bis Stichtag (groß)',
	progress: 'Fortschrittsbalken',
	minimum: 'Mindestbestand',
	balance: 'Kontostand (Summe)',
	nextPayment: 'Nächste Zahlung',
	payments: 'Offene Zahlungen (Liste)',
	accounts: 'Konten (je Zeile)',
	spacer: 'Abstand'
};

export type LayoutItem =
	| { kind: 'title'; text: string }
	| { kind: 'payments'; count: number }
	| { kind: Exclude<ItemKind, 'title' | 'payments'> };

export const APPEARANCES = ['system', 'light', 'dark'] as const;
export const BACKGROUNDS = ['default', 'gradient', 'mono'] as const;
export const FONT_SIZES = ['small', 'normal', 'large'] as const;
export type WidgetStyle = {
	appearance: (typeof APPEARANCES)[number];
	/** An account colour name or "account" (colour of the first account). */
	accent: string;
	background: (typeof BACKGROUNDS)[number];
	fontSize: (typeof FONT_SIZES)[number];
};
export const APPEARANCE_LABELS = {
	system: 'Wie iPhone',
	light: 'Immer hell',
	dark: 'Immer dunkel'
};
export const BACKGROUND_LABELS = { default: 'Standard', gradient: 'Verlauf', mono: 'Schwarz/Weiß' };
export const FONT_SIZE_LABELS = { small: 'Klein', normal: 'Normal', large: 'Groß' };

export const DEFAULT_STYLE: WidgetStyle = {
	appearance: 'system',
	accent: 'account',
	background: 'default',
	fontSize: 'normal'
};

export type WidgetLayout = { items: LayoutItem[]; style: WidgetStyle };

export const TEMPLATE_LAYOUTS: Record<WidgetTemplate, LayoutItem[]> = {
	available: [
		{ kind: 'title', text: '' },
		{ kind: 'available' },
		{ kind: 'progress' },
		{ kind: 'spacer' },
		{ kind: 'minimum' },
		{ kind: 'balance' },
		{ kind: 'payments', count: 6 }
	],
	payments: [
		{ kind: 'title', text: 'Offene Zahlungen' },
		{ kind: 'payments', count: 12 }
	],
	accounts: [
		{ kind: 'title', text: 'Konten' },
		{ kind: 'balance' },
		{ kind: 'spacer' },
		{ kind: 'accounts' }
	]
};

const MAX_ITEMS = 12;

/** Checks a layout from the editor (JSON); unknown parts fall back to defaults. */
export function parseLayout(value: unknown): WidgetLayout | null {
	if (!value || typeof value !== 'object') return null;
	const v = value as { items?: unknown; style?: Partial<WidgetStyle> };
	if (!Array.isArray(v.items) || v.items.length > MAX_ITEMS) return null;
	const items: LayoutItem[] = [];
	for (const raw of v.items as { kind?: unknown; text?: unknown; count?: unknown }[]) {
		const kind = ITEM_KINDS.find((k) => k === raw?.kind);
		if (!kind) return null;
		if (kind === 'title')
			items.push({ kind, text: typeof raw.text === 'string' ? raw.text.trim().slice(0, 40) : '' });
		else if (kind === 'payments') {
			const count = Number(raw.count);
			items.push({ kind, count: Number.isInteger(count) ? Math.min(12, Math.max(1, count)) : 3 });
		} else items.push({ kind });
	}
	const st = v.style ?? {};
	const pick = <T extends string>(list: readonly T[], x: unknown, d: T): T =>
		list.find((t) => t === x) ?? d;
	return {
		items,
		style: {
			appearance: pick(APPEARANCES, st.appearance, DEFAULT_STYLE.appearance),
			accent:
				st.accent === 'account' || (typeof st.accent === 'string' && st.accent in ACCOUNT_COLORS)
					? st.accent
					: DEFAULT_STYLE.accent,
			background: pick(BACKGROUNDS, st.background, DEFAULT_STYLE.background),
			fontSize: pick(FONT_SIZES, st.fontSize, DEFAULT_STYLE.fontSize)
		}
	};
}

const short = (day: string) => formatDay(day).slice(0, 6);
const money = (cents: number) => formatEuro(cents);
/** Room per size in lines (title and rows 1, big number 2, bar ½). */
const CAPACITY: Record<WidgetSize, number> = { small: 6, medium: 6, large: 14 };
const COST: Record<Block['type'], number> = { title: 1, big: 2, row: 1, bar: 0.5, spacer: 0 };

/** Blocks of a layout for the given data; what does not fit the size is left out. */
export function layoutBlocks(items: LayoutItem[], size: WidgetSize, d: WidgetData): Block[] {
	const giro = d.accounts.filter((a) => a.available !== null);
	const available = giro.reduce((s, a) => s + (a.available ?? 0), 0);
	const minimum = giro.reduce((s, a) => s + (a.minimum ?? 0), 0);
	const giroBalance = giro.reduce((s, a) => s + a.balance, 0);
	const total = d.accounts.reduce((s, a) => s + a.balance, 0);
	const cutoff =
		giro
			.map((a) => a.cutoff)
			.filter((c) => c !== null)
			.sort()[0] ?? null;
	const hasBig = items.some((i) => i.kind === 'available');
	const paymentRow = (p: WidgetData['payments'][number]): Extract<Block, { type: 'row' }> => ({
		type: 'row',
		label: `${short(p.date)} ${p.name}`,
		value: money(p.amount),
		color: p.amount < 0 ? 'text' : 'green'
	});
	const out: Block[] = [];
	let room = CAPACITY[size];
	const add = (b: Block) => {
		if (COST[b.type] > room) return false;
		room -= COST[b.type];
		out.push(b);
		return true;
	};
	for (const item of items) {
		switch (item.kind) {
			case 'title':
				add({
					type: 'title',
					text:
						item.text ||
						`${giro.length === 1 ? giro[0].name : 'Verfügbar'}${cutoff ? ` · bis ${short(cutoff)}` : ''}`
				});
				break;
			case 'available':
				add({ type: 'big', value: money(available), color: available < 0 ? 'red' : 'accent' });
				break;
			case 'progress':
				add({
					type: 'bar',
					value: giroBalance > 0 ? Math.max(0, Math.min(1, available / giroBalance)) : 0,
					color: available < 0 ? 'red' : 'accent'
				});
				break;
			case 'minimum':
				add({ type: 'row', label: 'Mindestbestand', value: money(minimum) });
				break;
			case 'balance':
				// Without the big "available" number the balance is the headline.
				if (!hasBig && !out.some((b) => b.type === 'big'))
					add({ type: 'big', value: money(total), color: total < 0 ? 'red' : 'accent' });
				else add({ type: 'row', label: 'Stand', value: money(giro.length ? giroBalance : total) });
				break;
			case 'nextPayment': {
				const p = d.payments[0];
				add(
					p
						? { ...paymentRow(p), label: `Nächste: ${p.name}` }
						: { type: 'row', label: 'Keine Zahlung fällig', value: '' }
				);
				break;
			}
			case 'payments': {
				const list = d.payments.slice(0, item.count);
				if (!list.length) add({ type: 'row', label: 'Nichts fällig', value: '' });
				for (const p of list) if (!add(paymentRow(p))) break;
				break;
			}
			case 'accounts':
				for (const a of d.accounts)
					if (
						!add({
							type: 'row',
							label: a.name,
							value: money(a.balance),
							color: a.balance < 0 ? 'red' : 'text'
						})
					)
						break;
				break;
			case 'spacer':
				add({ type: 'spacer' });
				break;
		}
	}
	return out;
}

/** Blocks of a template (the sample page). */
export function widgetBlocks(template: WidgetTemplate, size: WidgetSize, d: WidgetData): Block[] {
	return layoutBlocks(TEMPLATE_LAYOUTS[template], size, d);
}

// --- colours ------------------------------------------------------------------------------

/** [light, dark] hex pair. */
export type Pair = [string, string];
export type Palette = {
	bg: Pair;
	/** Background gradient (top, bottom) instead of `bg`. */
	gradient: [Pair, Pair] | null;
	text: Pair;
	sub: Pair;
	track: Pair;
	accent: Pair;
	red: Pair;
	green: Pair;
	/** Font scale. */
	scale: number;
};

function darken(hex: string, f: number): string {
	const n = parseInt(hex.slice(1), 16);
	const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((x) => Math.round(x * f));
	return `#${c.map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}

/** Colours for the widget; "light"/"dark" use the same value in both modes. */
export function widgetPalette(style: WidgetStyle, accountColor: string | null): Palette {
	const accentName = style.accent === 'account' ? (accountColor ?? 'blue') : style.accent;
	const a = ACCOUNT_COLORS[(accentName in ACCOUNT_COLORS ? accentName : 'blue') as AccountColor];
	let p: Palette = {
		bg: style.background === 'mono' ? ['#ffffff', '#000000'] : ['#ffffff', '#1c1c1e'],
		gradient: null,
		text: ['#000000', '#ffffff'],
		sub: ['#6c6c70', '#98989f'],
		track: ['#e5e5ea', '#3a3a3c'],
		accent: style.background === 'mono' ? ['#000000', '#ffffff'] : [a.light, a.dark],
		red: ['#ff3b30', '#ff453a'],
		green: ['#34c759', '#30d158'],
		scale: style.fontSize === 'small' ? 0.85 : style.fontSize === 'large' ? 1.2 : 1
	};
	if (style.background === 'gradient')
		p = {
			...p,
			gradient: [
				[a.light, a.dark],
				[darken(a.light, 0.65), darken(a.dark, 0.55)]
			],
			text: ['#ffffff', '#ffffff'],
			sub: ['#f2f2f7', '#e5e5ea'],
			track: ['#ffffff', '#ffffff'],
			accent: ['#ffffff', '#ffffff'],
			red: ['#ffd6d4', '#ffd6d4'],
			green: ['#ffffff', '#ffffff']
		};
	if (style.appearance !== 'system') {
		const i = style.appearance === 'light' ? 0 : 1;
		const fix = (x: Pair): Pair => [x[i], x[i]];
		p = {
			...p,
			bg: fix(p.bg),
			gradient: p.gradient ? [fix(p.gradient[0]), fix(p.gradient[1])] : null,
			text: fix(p.text),
			sub: fix(p.sub),
			track: fix(p.track),
			accent: fix(p.accent),
			red: fix(p.red),
			green: fix(p.green)
		};
	}
	return p;
}

/** The Scriptable script: loads blocks from the server, keeps the last ones for offline use. */
export function widgetScript(o: { url: string; token: string; id: string; name: string }): string {
	return `// Konto Planer – Widget „${o.name.replace(/[\r\n]/g, ' ')}“
// Erstellt vom Konto Planer. Layout und Daten kommen vom Server.
const URL = ${JSON.stringify(o.url)};
const TOKEN = ${JSON.stringify(o.token)};
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), ${JSON.stringify(`konto-planer-${o.id.slice(0, 8)}.json`)});

// Colours and font scale come from the server (editor); these are the defaults.
const DEFAULTS = {
  text: ["#000000", "#ffffff"], sub: ["#6c6c70", "#98989f"], bg: ["#ffffff", "#1c1c1e"],
  track: ["#e5e5ea", "#3a3a3c"], red: ["#ff3b30", "#ff453a"], green: ["#34c759", "#30d158"],
  accent: ["#007aff", "#0a84ff"]
};
function pair(p) { return Color.dynamic(new Color(p[0]), new Color(p[1])); }
let C = {};
let SCALE = 1;
function palette(style) {
  const s = style || {};
  C = {};
  for (const k of Object.keys(DEFAULTS)) C[k] = pair(s[k] || DEFAULTS[k]);
  SCALE = s.scale || 1;
  return s;
}
palette(null);

async function load() {
  try {
    const r = new Request(URL);
    r.headers = { Authorization: "Bearer " + TOKEN };
    r.timeoutInterval = 10;
    const d = await r.loadJSON();
    if (r.response.statusCode !== 200) throw new Error(d.message || "HTTP " + r.response.statusCode);
    fm.writeString(CACHE, JSON.stringify(d));
    return { d, live: true };
  } catch (e) {
    if (fm.fileExists(CACHE)) return { d: JSON.parse(fm.readString(CACHE)), live: false };
    return { d: null, live: false, error: String(e) };
  }
}

function bar(value, color, width) {
  const dc = new DrawContext();
  dc.size = new Size(width, 6);
  dc.opaque = false;
  dc.respectScreenScale = true;
  const track = new Path();
  track.addRoundedRect(new Rect(0, 0, width, 6), 3, 3);
  dc.addPath(track);
  dc.setFillColor(C.track);
  dc.fillPath();
  const fill = new Path();
  fill.addRoundedRect(new Rect(0, 0, Math.max(6, width * value), 6), 3, 3);
  dc.addPath(fill);
  dc.setFillColor(C[color] || C.accent);
  dc.fillPath();
  return dc.getImage();
}

const { d, live, error } = await load();
const style = palette(d && d.style);
const w = new ListWidget();
if (style.gradient) {
  const g = new LinearGradient();
  g.colors = [pair(style.gradient[0]), pair(style.gradient[1])];
  g.locations = [0, 1];
  w.backgroundGradient = g;
} else w.backgroundColor = C.bg;
w.setPadding(12, 14, 12, 14);
const size = (d && d.size) || config.widgetFamily || "small";
const width = size === "small" ? 130 : 300;
if (!d) {
  const t = w.addText("Konto Planer: keine Verbindung");
  t.textColor = C.red;
  t.font = Font.mediumSystemFont(12);
  const e = w.addText(error || "");
  e.textColor = C.sub;
  e.font = Font.systemFont(10);
} else {
  for (const b of d.blocks) {
    if (b.type === "title") {
      const t = w.addText(b.text);
      t.font = Font.semiboldSystemFont(12 * SCALE);
      t.textColor = C.sub;
      t.lineLimit = 1;
    } else if (b.type === "big") {
      const t = w.addText(b.value);
      t.font = Font.boldRoundedSystemFont((size === "small" ? 24 : 28) * SCALE);
      t.textColor = C[b.color] || C.text;
      t.minimumScaleFactor = 0.5;
      t.lineLimit = 1;
    } else if (b.type === "row") {
      const s = w.addStack();
      s.centerAlignContent();
      const l = s.addText(b.label);
      l.font = Font.systemFont(12 * SCALE);
      l.textColor = C.sub;
      l.lineLimit = 1;
      s.addSpacer();
      const v = s.addText(b.value);
      v.font = Font.mediumSystemFont(12 * SCALE);
      v.textColor = C[b.color] || C.text;
      v.lineLimit = 1;
    } else if (b.type === "bar") {
      w.addSpacer(4);
      w.addImage(bar(b.value, b.color, width));
      w.addSpacer(4);
    } else if (b.type === "spacer") {
      w.addSpacer();
    }
  }
  w.addSpacer(4);
  const at = new Date(d.generatedAt);
  const f = w.addText((live ? "" : "offline · ") + "Stand " + at.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  f.font = Font.systemFont(9);
  f.textColor = live ? C.sub : C.red;
  if (d.appUrl) w.url = d.appUrl;
}
w.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);
if (config.runsInWidget) Script.setWidget(w);
else if (size === "large") await w.presentLarge();
else if (size === "medium") await w.presentMedium();
else await w.presentSmall();
Script.complete();
`;
}
