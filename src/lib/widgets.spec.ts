import { describe, expect, it } from 'vitest';
import {
	layoutBlocks,
	lockContent,
	compactEuro,
	TEMPLATE_LAYOUTS,
	parseLayout,
	widgetBlocks,
	widgetPalette,
	widgetScript,
	DEFAULT_STYLE,
	type WidgetData
} from './widgets';

const data: WidgetData = {
	accounts: [
		{
			name: 'Giro',
			type: 'giro',
			balance: 150_000,
			available: 60_000,
			minimum: 90_000,
			cutoff: '2026-11-30'
		},
		{
			name: 'Sparbuch',
			type: 'sparbuch',
			balance: 500_000,
			available: null,
			minimum: null,
			cutoff: null
		}
	],
	payments: [
		{ name: 'Miete', date: '2026-12-01', amount: -85_000 },
		{ name: 'Gehalt', date: '2026-11-30', amount: 300_000 }
	]
};
const text = (s: string) => s.replace(/\u00a0/g, ' ');

describe('widgetBlocks', () => {
	it('available: big number, minimum, balance; payments from medium on', () => {
		const small = widgetBlocks('available', 'small', data);
		expect(small[0]).toEqual({ type: 'title', text: 'Giro · bis 30.11.' });
		expect(small[1]).toMatchObject({ type: 'big', color: 'accent' });
		expect(text((small[1] as { value: string }).value)).toBe('600,00 €');
		expect(small.find((b) => b.type === 'bar')).toEqual({
			type: 'bar',
			value: 0.4,
			color: 'accent'
		});
		expect(small.filter((b) => b.type === 'row')).toHaveLength(2);
		expect(widgetBlocks('available', 'large', data).filter((b) => b.type === 'row')).toHaveLength(
			4
		);
	});
	it('payments: list limited by size', () => {
		const b = widgetBlocks('payments', 'small', data);
		expect(b).toHaveLength(3);
		expect(b[1]).toMatchObject({ type: 'row', label: '01.12. Miete', color: 'text' });
		expect(b[2]).toMatchObject({ color: 'green' });
		expect(widgetBlocks('payments', 'small', { ...data, payments: [] })[1]).toMatchObject({
			label: 'Nichts fällig'
		});
	});
	it('accounts: total and one row per account', () => {
		const b = widgetBlocks('accounts', 'medium', data);
		expect(text((b[1] as { value: string }).value)).toBe('6.500,00 €');
		expect(b.filter((x) => x.type === 'row').map((x) => (x as { label: string }).label)).toEqual([
			'Giro',
			'Sparbuch'
		]);
	});
});

describe('widgetScript', () => {
	it('is valid JavaScript with url and token', () => {
		const s = widgetScript({
			url: 'https://konto.example.org/api/widget',
			token: 'abc"def',
			id: '12345678-aaaa',
			name: 'Test'
		});
		expect(s).toContain('const URL = "https://konto.example.org/api/widget";');
		expect(s).toContain('const TOKEN = "abc\\"def";');
		expect(s).toContain('konto-planer-12345678.json');
		const proto = Object.getPrototypeOf(async () => {}) as {
			constructor: new (body: string) => unknown;
		};
		const AsyncFunction = proto.constructor;
		expect(() => new AsyncFunction(s)).not.toThrow();
	});
});

describe('layoutBlocks', () => {
	it('leaves out what does not fit the size', () => {
		const many = {
			...data,
			payments: Array.from({ length: 12 }, (_, i) => ({
				name: `P${i}`,
				date: '2026-12-01',
				amount: -100
			}))
		};
		const items = [
			{ kind: 'title' as const, text: 'Zahlungen' },
			{ kind: 'payments' as const, count: 12 }
		];
		expect(layoutBlocks(items, 'small', many)).toHaveLength(6);
		expect(layoutBlocks(items, 'large', many)).toHaveLength(13);
	});
	it('shows the next payment and a custom title', () => {
		const b = layoutBlocks(
			[{ kind: 'title', text: 'Mein Widget' }, { kind: 'nextPayment' }],
			'small',
			data
		);
		expect(b[0]).toEqual({ type: 'title', text: 'Mein Widget' });
		expect(b[1]).toMatchObject({ type: 'row', label: 'Nächste: Miete' });
	});
});

describe('parseLayout', () => {
	it('accepts editor JSON and clamps values', () => {
		const l = parseLayout({
			items: [
				{ kind: 'title', text: 'x'.repeat(60) },
				{ kind: 'payments', count: 99 }
			],
			style: { appearance: 'dark', accent: 'green', background: 'gradient', fontSize: 'large' }
		});
		expect(l?.items[0]).toEqual({ kind: 'title', text: 'x'.repeat(40) });
		expect(l?.items[1]).toEqual({ kind: 'payments', count: 12 });
		expect(l?.style).toEqual({
			appearance: 'dark',
			accent: 'green',
			background: 'gradient',
			fontSize: 'large'
		});
	});
	it('rejects unknown blocks and falls back for unknown style', () => {
		expect(parseLayout({ items: [{ kind: 'bild' }] })).toBeNull();
		expect(parseLayout({ items: [], style: { accent: 'neon' } })?.style).toEqual(DEFAULT_STYLE);
		expect(parseLayout('kaputt')).toBeNull();
	});
});

describe('widgetPalette', () => {
	it('uses the account colour and follows the system', () => {
		const p = widgetPalette(DEFAULT_STYLE, 'green');
		expect(p.accent).toEqual(['#34c759', '#30d158']);
		expect(p.bg).toEqual(['#ffffff', '#1c1c1e']);
		expect(p.gradient).toBeNull();
		expect(p.scale).toBe(1);
	});
	it('fixes light or dark and builds a gradient', () => {
		const p = widgetPalette(
			{ appearance: 'dark', accent: 'blue', background: 'gradient', fontSize: 'small' },
			null
		);
		expect(p.gradient?.[0]).toEqual(['#0a84ff', '#0a84ff']);
		expect(p.text).toEqual(['#ffffff', '#ffffff']);
		expect(p.scale).toBe(0.85);
		expect(widgetPalette({ ...DEFAULT_STYLE, appearance: 'light' }, 'red').bg).toEqual([
			'#ffffff',
			'#ffffff'
		]);
	});
});

describe('lockContent', () => {
	const items = TEMPLATE_LAYOUTS.available;
	it('rectangular: three short lines', () => {
		const c = lockContent(items, 'lockRect', data);
		expect(c.lines.map(text)).toEqual(['Giro · bis 30.11.', '600,00 €', 'Mindestbestand 900,00 €']);
		expect(c.gauge).toBeNull();
	});
	it('circular: ring and short number', () => {
		expect(lockContent(items, 'lockCircle', data).gauge).toEqual({ value: 0.4, label: '600' });
		expect(compactEuro(123_456)).toBe('1,2T');
		expect(compactEuro(-8_500)).toBe('−85');
		expect(compactEuro(100_000)).toBe('1T');
	});
	it('inline: one line with the cut-off day', () => {
		expect(lockContent(items, 'lockInline', data).lines.map(text)).toEqual([
			'600,00 € frei bis 30.11.'
		]);
	});
});
