import { describe, expect, it } from 'vitest';
import { demoBookings, seededRandom } from './demo';

describe('demo data', () => {
	it('is the same for the same seed', () => {
		expect(demoBookings('2026-06-01', '2026-06-30', 7)).toEqual(
			demoBookings('2026-06-01', '2026-06-30', 7)
		);
		expect(seededRandom(1)()).not.toBe(seededRandom(2)());
	});
	it('stays in the range and never in the future', () => {
		const b = demoBookings('2026-05-29', '2026-11-26', 42);
		expect(b.length).toBeGreaterThan(150);
		for (const x of b) {
			expect(x.date <= '2026-11-26' && x.date >= '2026-05-29').toBe(true);
			expect(x.amount).toBeLessThan(0);
			expect(Math.abs(x.amount) % 10).toBe(0);
		}
		expect(b.some((x) => x.card)).toBe(true);
	});
});
