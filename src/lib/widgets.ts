// iOS widgets via Scriptable: templates, the blocks the server sends and the generic script.
import { formatEuro } from './money.js';
import { formatDay } from './dates.js';

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

export type BlockColor = 'text' | 'sub' | 'red' | 'green' | 'blue';
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
		balance: number;
		available: number | null;
		minimum: number | null;
		cutoff: string | null;
	}[];
	payments: { name: string; date: string; amount: number; accountId?: string }[];
};

const short = (day: string) => formatDay(day).slice(0, 6);
const money = (cents: number) => formatEuro(cents);
const ROWS: Record<WidgetSize, number> = { small: 3, medium: 4, large: 11 };

/** Blocks of a template for the given data (amounts already formatted). */
export function widgetBlocks(template: WidgetTemplate, size: WidgetSize, d: WidgetData): Block[] {
	const giro = d.accounts.filter((a) => a.available !== null);
	if (template === 'available') {
		const available = giro.reduce((s, a) => s + (a.available ?? 0), 0);
		const minimum = giro.reduce((s, a) => s + (a.minimum ?? 0), 0);
		const balance = giro.reduce((s, a) => s + a.balance, 0);
		const cutoff =
			giro
				.map((a) => a.cutoff)
				.filter((c) => c !== null)
				.sort()[0] ?? null;
		const blocks: Block[] = [
			{
				type: 'title',
				text: `${giro.length === 1 ? giro[0].name : 'Verfügbar'}${cutoff ? ` · bis ${short(cutoff)}` : ''}`
			},
			{ type: 'big', value: money(available), color: available < 0 ? 'red' : 'text' },
			{
				type: 'bar',
				value: balance > 0 ? Math.max(0, Math.min(1, available / balance)) : 0,
				color: available < 0 ? 'red' : 'green'
			},
			{ type: 'spacer' },
			{ type: 'row', label: 'Mindestbestand', value: money(minimum) },
			{ type: 'row', label: 'Stand', value: money(balance) }
		];
		if (size !== 'small')
			for (const p of d.payments.slice(0, size === 'medium' ? 1 : 6))
				blocks.push({
					type: 'row',
					label: `${short(p.date)} ${p.name}`,
					value: money(p.amount),
					color: p.amount < 0 ? 'text' : 'green'
				});
		return blocks;
	}
	if (template === 'payments') {
		const rows = d.payments.slice(0, ROWS[size]);
		return [
			{ type: 'title', text: 'Offene Zahlungen' },
			...(rows.length
				? rows.map((p): Block => ({
						type: 'row',
						label: `${short(p.date)} ${p.name}`,
						value: money(p.amount),
						color: p.amount < 0 ? 'text' : 'green'
					}))
				: [{ type: 'row', label: 'Nichts fällig', value: '' } as Block])
		];
	}
	const total = d.accounts.reduce((s, a) => s + a.balance, 0);
	return [
		{ type: 'title', text: 'Konten' },
		{ type: 'big', value: money(total), color: total < 0 ? 'red' : 'text' },
		{ type: 'spacer' },
		...d.accounts.slice(0, ROWS[size]).map((a): Block => ({
			type: 'row',
			label: a.name,
			value: money(a.balance),
			color: a.balance < 0 ? 'red' : 'text'
		}))
	];
}

/** The Scriptable script: loads blocks from the server, keeps the last ones for offline use. */
export function widgetScript(o: { url: string; token: string; id: string; name: string }): string {
	return `// Konto Planer – Widget „${o.name.replace(/[\r\n]/g, ' ')}“
// Erstellt vom Konto Planer. Layout und Daten kommen vom Server.
const URL = ${JSON.stringify(o.url)};
const TOKEN = ${JSON.stringify(o.token)};
const fm = FileManager.local();
const CACHE = fm.joinPath(fm.documentsDirectory(), ${JSON.stringify(`konto-planer-${o.id.slice(0, 8)}.json`)});

const C = {
  text: Color.dynamic(new Color("#000000"), new Color("#ffffff")),
  sub: Color.dynamic(new Color("#6c6c70"), new Color("#98989f")),
  bg: Color.dynamic(new Color("#ffffff"), new Color("#1c1c1e")),
  track: Color.dynamic(new Color("#e5e5ea"), new Color("#3a3a3c")),
  red: Color.dynamic(new Color("#ff3b30"), new Color("#ff453a")),
  green: Color.dynamic(new Color("#34c759"), new Color("#30d158")),
  blue: Color.dynamic(new Color("#007aff"), new Color("#0a84ff"))
};

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
  dc.setFillColor(C[color] || C.green);
  dc.fillPath();
  return dc.getImage();
}

const { d, live, error } = await load();
const w = new ListWidget();
w.backgroundColor = C.bg;
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
      t.font = Font.semiboldSystemFont(12);
      t.textColor = C.sub;
      t.lineLimit = 1;
    } else if (b.type === "big") {
      const t = w.addText(b.value);
      t.font = Font.boldRoundedSystemFont(size === "small" ? 24 : 28);
      t.textColor = C[b.color] || C.text;
      t.minimumScaleFactor = 0.5;
      t.lineLimit = 1;
    } else if (b.type === "row") {
      const s = w.addStack();
      s.centerAlignContent();
      const l = s.addText(b.label);
      l.font = Font.systemFont(12);
      l.textColor = C.sub;
      l.lineLimit = 1;
      s.addSpacer();
      const v = s.addText(b.value);
      v.font = Font.mediumSystemFont(12);
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
