import { describe, expect, it } from 'vitest';
import { berlinDay, dayLabel, groupByDay } from './dates';

describe('dates', () => {
	it('uses the Berlin calendar day (late UTC evening is the next day)', () => {
		expect(berlinDay(new Date(Date.UTC(2026, 10, 23, 23, 30)))).toBe('2026-11-24');
		expect(berlinDay(new Date(Date.UTC(2026, 6, 1, 22, 30)))).toBe('2026-07-02');
	});

	it('labels today and yesterday', () => {
		const now = new Date(Date.UTC(2026, 10, 23, 12));
		expect(dayLabel(new Date(Date.UTC(2026, 10, 23, 6)), now)).toBe('Heute');
		expect(dayLabel(new Date(Date.UTC(2026, 10, 22, 6)), now)).toBe('Gestern');
		expect(dayLabel(new Date(Date.UTC(2026, 10, 20, 6)), now)).toBe('Fr., 20. November 2026');
	});

	it('groups by day keeping order', () => {
		const items = [
			new Date(Date.UTC(2026, 10, 23, 10)),
			new Date(Date.UTC(2026, 10, 23, 8)),
			new Date(Date.UTC(2026, 10, 22, 8))
		];
		expect(groupByDay(items, (d) => d).map((g) => [g.day, g.items.length])).toEqual([
			['2026-11-23', 2],
			['2026-11-22', 1]
		]);
	});
});
