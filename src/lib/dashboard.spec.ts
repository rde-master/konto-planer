import { describe, expect, it } from 'vitest';
import {
	changePercent,
	donutSlices,
	historySeries,
	ringShare,
	sparkPath,
	sparkPoints
} from './dashboard';

describe('historySeries', () => {
	it('walks back from today through the booked days', () => {
		expect(
			historySeries(
				10_000,
				[
					{ date: '2026-11-20', amount: -2_000 },
					{ date: '2026-11-20', amount: 500 },
					{ date: '2026-11-10', amount: 3_000 },
					{ date: '2026-10-01', amount: 999 }
				],
				'2026-11-01',
				'2026-11-26'
			)
		).toEqual([
			['2026-11-01', 8_500],
			['2026-11-10', 11_500],
			['2026-11-20', 10_000],
			['2026-11-26', 10_000]
		]);
	});
	it('is flat without bookings', () => {
		expect(historySeries(500, [], '2026-11-01', '2026-11-26')).toEqual([
			['2026-11-01', 500],
			['2026-11-26', 500]
		]);
	});
});

describe('donutSlices', () => {
	const cats = [5, 40, 10, 30, 2, 8, 1, 4].map((amount, i) => ({
		name: `K${i}`,
		amount,
		color: 'blue'
	}));
	it('keeps the largest and sums the rest', () => {
		const s = donutSlices(cats, 4);
		expect(s.map((x) => x.name)).toEqual(['K1', 'K3', 'K2', 'Sonstige']);
		expect(s[3].amount).toBe(20);
		expect(s.reduce((a, x) => a + x.amount, 0)).toBe(100);
	});
	it('leaves a short list alone', () => {
		expect(donutSlices(cats.slice(0, 2))).toHaveLength(2);
	});
});

describe('helpers', () => {
	it('change in per cent', () => {
		expect(changePercent(112, 100)).toBe(12);
		expect(changePercent(92, 100)).toBe(-8);
		expect(changePercent(50, 0)).toBeNull();
	});
	it('ring share', () => {
		expect(ringShare(30, 120)).toEqual({ share: 0.25, over: false });
		expect(ringShare(150, 100)).toEqual({ share: 1, over: true });
		expect(ringShare(5, 0)).toEqual({ share: 0, over: false });
	});
});

describe('sparkline', () => {
	const points = sparkPoints(
		1_000,
		[
			{ date: '2026-11-28', balance: 200 },
			{ date: '2026-11-28', balance: -300 },
			{ date: '2026-11-30', balance: 2_000 }
		],
		'2026-11-26',
		'2026-11-30'
	);
	it('takes the balance at the end of each day', () => {
		expect(points).toEqual([
			['2026-11-26', 1_000],
			['2026-11-28', -300],
			['2026-11-30', 2_000]
		]);
	});
	it('draws a step line, the zero line and the lowest point', () => {
		const s = sparkPath(points, 100, 30, 0);
		expect(s.path.startsWith('M0 ')).toBe(true);
		expect(s.path).toContain('H50 V30');
		expect(s.zeroY).toBeCloseTo(26.1, 1);
		expect(s.low).toEqual({ x: 50, y: 30 });
		expect(sparkPath([['2026-11-26', 5]], 100, 30).path).toBe('');
	});
	it('extends to the cut-off day', () => {
		expect(sparkPoints(500, [], '2026-11-26', '2026-11-30')).toEqual([
			['2026-11-26', 500],
			['2026-11-30', 500]
		]);
	});
});
