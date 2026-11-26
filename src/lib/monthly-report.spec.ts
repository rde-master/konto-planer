import { describe, expect, it } from 'vitest';
import { buildReport, monthName, reportMonth, type ReportData } from './monthly-report';

const data: ReportData = {
	userName: 'Erika <Muster>',
	month: '2026-10',
	income: 300_000,
	expenses: 180_000,
	largest: [{ label: 'Miete', date: '2026-10-01', amount: 90_000 }],
	categories: [
		{ name: 'Wohnen', amount: 90_000, previous: 90_000 },
		{ name: 'Freizeit', amount: 12_000, previous: 10_000 }
	],
	budgets: [{ name: 'Lebensmittel', limit: 40_000, spent: 45_000 }],
	accounts: [{ name: 'Giro', endBalance: 150_000, available: 80_000 }],
	saved: 30_000,
	savingsRate: 0.1,
	increases: [{ name: 'Streaming', before: 1299, after: 1499, percent: 15 }],
	deadlines: [],
	appUrl: 'https://konto.example.org'
};

describe('reportMonth', () => {
	it('is the previous month', () => {
		expect(reportMonth('2026-11-01')).toBe('2026-10');
		expect(reportMonth('2027-01-03')).toBe('2026-12');
		expect(monthName('2026-10')).toBe('Oktober 2026');
	});
});

describe('buildReport', () => {
	const r = buildReport(data);
	it('has subject and text', () => {
		expect(r.subject).toBe('Konto Planer: Monatsbericht Oktober 2026');
		const text = r.text.replace(/\u00a0/g, ' ');
		expect(text).toContain('- Einnahmen: 3.000,00 €');
		expect(text).toContain('- Saldo: 1.200,00 €');
		expect(text).toContain('Sparquote 10 %');
		expect(text).toContain('- Freizeit: 120,00 € (+20 % zum Vormonat)');
		expect(text).toContain('- Lebensmittel: 450,00 € von 400,00 € – überschritten');
		expect(text).toContain('- Streaming: 12,99 € → 14,99 € (+15 %)');
		expect(text).toContain('Keine in den nächsten Wochen.');
	});
	it('escapes HTML', () => {
		expect(r.html).toContain('Erika &lt;Muster&gt;');
		expect(r.html).not.toContain('<Muster>');
	});
});
