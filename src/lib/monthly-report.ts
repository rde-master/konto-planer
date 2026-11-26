// Monthly report by e-mail ("Monatsbericht"): the previous month's numbers as text and HTML.
import { formatEuro } from './money.js';
import { formatDay } from './dates.js';
import { addMonths } from './recurring.js';

const MONTHS = [
	'Januar',
	'Februar',
	'März',
	'April',
	'Mai',
	'Juni',
	'Juli',
	'August',
	'September',
	'Oktober',
	'November',
	'Dezember'
];

/** Month the report on `today` is about ("2026-10" in November). */
export function reportMonth(today: string): string {
	return addMonths(`${today.slice(0, 7)}-01`, -1).slice(0, 7);
}

export function monthName(month: string): string {
	return `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;
}

/** Reports go out in the first days of a month only (a late start still sends it). */
export const SEND_UNTIL_DAY = 7;

export type ReportData = {
	userName: string;
	month: string;
	income: number;
	expenses: number;
	largest: { label: string; date: string; amount: number }[];
	categories: { name: string; amount: number; previous: number }[];
	budgets: { name: string; limit: number; spent: number }[];
	accounts: { name: string; endBalance: number; available: number | null }[];
	saved: number;
	savingsRate: number | null;
	increases: { name: string; before: number; after: number; percent: number }[];
	deadlines: { name: string; deadline: string }[];
	appUrl: string | null;
};

function escape(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

function diffText(now: number, before: number): string {
	if (!before) return 'neu';
	const d = Math.round(((now - before) / before) * 100);
	return d === 0 ? '±0 %' : `${d > 0 ? '+' : '−'}${Math.abs(d)} %`;
}

type Section = { title: string; rows: [string, string][]; empty?: string };

function sections(d: ReportData): Section[] {
	const net = d.income - d.expenses;
	return [
		{
			title: 'Überblick',
			rows: [
				['Einnahmen', formatEuro(d.income)],
				['Ausgaben', formatEuro(d.expenses)],
				['Saldo', formatEuro(net)],
				[
					'Gespart (aufs Sparbuch)',
					`${formatEuro(d.saved)}${d.savingsRate !== null ? ` · Sparquote ${Math.round(d.savingsRate * 100)} %` : ''}`
				]
			]
		},
		{
			title: 'Ausgaben je Kategorie',
			rows: d.categories.map((c) => [
				c.name,
				`${formatEuro(c.amount)} (${diffText(c.amount, c.previous)} zum Vormonat)`
			]),
			empty: 'Keine Ausgaben.'
		},
		{
			title: 'Größte Posten',
			rows: d.largest.map((l) => [`${l.label} (${formatDay(l.date)})`, formatEuro(l.amount)]),
			empty: 'Keine Ausgaben.'
		},
		{
			title: 'Budgets',
			rows: d.budgets.map((b) => [
				b.name,
				`${formatEuro(b.spent)} von ${formatEuro(b.limit)}${b.spent > b.limit ? ' – überschritten' : ''}`
			]),
			empty: 'Keine Budgets.'
		},
		{
			title: 'Konten',
			rows: d.accounts.map((a) => [
				a.name,
				`Monatsende ${formatEuro(a.endBalance)}${a.available !== null ? ` · verfügbar heute ${formatEuro(a.available)}` : ''}`
			])
		},
		{
			title: 'Teurer geworden',
			rows: d.increases.map((x) => [
				x.name,
				`${formatEuro(x.before)} → ${formatEuro(x.after)} (+${x.percent} %)`
			]),
			empty: 'Keine Preiserhöhungen.'
		},
		{
			title: 'Anstehende Kündigungsfristen',
			rows: d.deadlines.map((x) => [x.name, `kündbar bis ${formatDay(x.deadline)}`]),
			empty: 'Keine in den nächsten Wochen.'
		}
	];
}

export function buildReport(d: ReportData): { subject: string; text: string; html: string } {
	const title = `Monatsbericht ${monthName(d.month)}`;
	const list = sections(d);
	const text = [
		`Hallo ${d.userName},`,
		'',
		`hier ist dein ${title}.`,
		...list.flatMap((s) => [
			'',
			s.title.toUpperCase(),
			...(s.rows.length ? s.rows.map(([k, v]) => `- ${k}: ${v}`) : [s.empty ?? '–'])
		]),
		'',
		d.appUrl ? `Mehr in der App: ${d.appUrl}` : '',
		'Abbestellen unter Einstellungen › Meine Benachrichtigungen.'
	].join('\n');
	const row = ([k, v]: [string, string]) =>
		`<tr><td style="padding:8px 12px;border-top:1px solid #e5e5ea">${escape(k)}</td><td style="padding:8px 12px;border-top:1px solid #e5e5ea;text-align:right;white-space:nowrap">${escape(v)}</td></tr>`;
	const html = `<!doctype html><html lang="de"><body style="margin:0;padding:16px;background:#f2f2f7;font-family:-apple-system,system-ui,sans-serif;color:#000">
<div style="max-width:560px;margin:0 auto">
<h1 style="font-size:28px;margin:8px 0 4px">${escape(title)}</h1>
<p style="color:#6c6c70;margin:0 0 16px">Hallo ${escape(d.userName)}, das war dein Monat.</p>
${list
	.map(
		(
			s
		) => `<h2 style="font-size:13px;text-transform:uppercase;color:#6c6c70;margin:20px 12px 6px;font-weight:normal">${escape(s.title)}</h2>
<table style="width:100%;border-collapse:collapse;background:#fff;border-radius:10px;font-size:15px">${
			s.rows.length
				? s.rows
						.map(row)
						.join('')
						.replace('border-top:1px solid #e5e5ea', 'border-top:0')
						.replace('border-top:1px solid #e5e5ea', 'border-top:0')
				: `<tr><td style="padding:8px 12px;color:#6c6c70">${escape(s.empty ?? '–')}</td></tr>`
		}</table>`
	)
	.join('\n')}
<p style="color:#6c6c70;font-size:13px;margin:20px 12px">${d.appUrl ? `<a href="${escape(d.appUrl)}" style="color:#007aff">Konto Planer öffnen</a> · ` : ''}Abbestellen unter Einstellungen › Meine Benachrichtigungen.</p>
</div></body></html>`;
	return { subject: `Konto Planer: ${title}`, text, html };
}
