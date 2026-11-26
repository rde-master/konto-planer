import { describe, expect, it } from 'vitest';
import { canLinkTransfer, pickCounter, transferLabel } from './transfers';

describe('canLinkTransfer', () => {
	const base = { source: 'manual', recurringId: null, counterBookingId: null, amount: -50_00 };
	it('takes entered and imported payments', () => {
		expect(canLinkTransfer(base)).toBe(true);
		expect(canLinkTransfer({ ...base, source: 'import', amount: 50_00 })).toBe(true);
	});
	it('not what is a transfer already, belongs to an item or was computed', () => {
		expect(canLinkTransfer({ ...base, counterBookingId: 'x' })).toBe(false);
		expect(canLinkTransfer({ ...base, recurringId: 'x' })).toBe(false);
		for (const source of ['provisional', 'adjustment', 'interest', 'goal', 'settlement'])
			expect(canLinkTransfer({ ...base, source })).toBe(false);
		expect(canLinkTransfer({ ...base, amount: 0 })).toBe(false);
	});
});

describe('pickCounter', () => {
	const booking = { date: '2026-11-10', amount: -200_00 };
	it('finds the opposite amount nearby, the nearest day first', () => {
		const hit = pickCounter(booking, [
			{ id: 'a', date: '2026-11-13', amount: 200_00 },
			{ id: 'b', date: '2026-11-11', amount: 200_00 },
			{ id: 'c', date: '2026-11-10', amount: 199_99 }
		]);
		expect(hit?.id).toBe('b');
	});
	it('ignores the same direction and days too far away', () => {
		expect(
			pickCounter(booking, [
				{ date: '2026-11-10', amount: -200_00 },
				{ date: '2026-11-14', amount: 200_00 },
				{ date: '2026-11-06', amount: 200_00 }
			])
		).toBeUndefined();
	});
});

describe('transferLabel', () => {
	it('names the direction', () => {
		expect(transferLabel(-1, 'Sparbuch')).toBe('Auf Sparbuch');
		expect(transferLabel(1, 'Girokonto')).toBe('Von Girokonto');
	});
});
