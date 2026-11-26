import { describe, expect, it } from 'vitest';
import { widgetBlocks, widgetScript, type WidgetData } from './widgets';

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
		expect(small[1]).toMatchObject({ type: 'big', color: 'text' });
		expect(text((small[1] as { value: string }).value)).toBe('600,00 €');
		expect(small.find((b) => b.type === 'bar')).toEqual({
			type: 'bar',
			value: 0.4,
			color: 'green'
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
