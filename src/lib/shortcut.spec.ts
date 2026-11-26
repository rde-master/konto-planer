import { describe, expect, it } from 'vitest';
import { shortcutAmount, shortcutOptions, shortcutReply } from './shortcut';

describe('shortcutOptions', () => {
	it('lists templates, then categories with their main category', () => {
		const o = shortcutOptions(
			[
				{
					id: 't1',
					name: 'Bäcker',
					kind: 'expense',
					accountId: null,
					categoryId: 'c2',
					counterparty: 'Bäckerei'
				}
			],
			[
				{ id: 'c2', name: 'Supermarkt', parentName: 'Lebensmittel' },
				{ id: 'c1', name: 'Lebensmittel', parentName: null },
				{ id: 'c3', name: 'Auto', parentName: null }
			]
		);
		expect(o.map((x) => x.label)).toEqual([
			'Vorlage: Bäcker',
			'Auto',
			'Lebensmittel',
			'Lebensmittel › Supermarkt',
			'Ohne Kategorie'
		]);
	});
});

describe('shortcutAmount', () => {
	it('reads numbers and German or decimal-point text', () => {
		expect(shortcutAmount(12.8)).toBe(-1280);
		expect(shortcutAmount('12,80')).toBe(-1280);
		expect(shortcutAmount('12.80')).toBe(-1280);
		expect(shortcutAmount('1.234,56 €')).toBe(-123456);
		expect(shortcutAmount('+50')).toBe(5000);
		expect(shortcutAmount('20', true)).toBe(2000);
	});
	it('rejects nonsense and zero', () => {
		expect(shortcutAmount('abc')).toBeNull();
		expect(shortcutAmount(0)).toBeNull();
		expect(shortcutAmount(null)).toBeNull();
	});
});

describe('shortcutReply', () => {
	it('confirms with budget and available amount', () => {
		expect(
			shortcutReply({
				amount: -1280,
				label: 'Lebensmittel',
				account: 'Giro',
				budget: 'Lebensmittel: noch 87,20 € diesen Monat',
				available: 61200
			}).replace(/\u00a0/g, ' ')
		).toBe(
			'12,80 € Lebensmittel gebucht (Giro) · Lebensmittel: noch 87,20 € diesen Monat · verfügbar 612,00 €'
		);
	});
});
