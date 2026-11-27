import { describe, expect, it } from 'vitest';
import {
	FLOW_NODES,
	assess,
	buildFlow,
	everydayRate,
	flowMonths,
	lowestBalance,
	lowestWithSpending,
	pastPeriod,
	planPeriod,
	verdictText,
	type FlowAccount,
	type FlowLink,
	type FlowMove
} from './money-flow';

const account = (id: string, type: FlowAccount['type'] = 'giro', visible = true): FlowAccount => ({
	id,
	name: id,
	type,
	color: 'blue',
	visible
});
const ACCOUNTS = [
	account('main'),
	account('haushalt'),
	account('spar', 'sparbuch'),
	account('karte', 'kreditkarte'),
	account('fremd', 'giro', false)
];

const MONTHS = ['2026-08', '2026-09', '2026-10'];
/** One move in each of the three months. */
function monthly(
	accountId: string,
	amount: number,
	kind: FlowMove['kind'],
	otherId: string | null = null
): FlowMove[] {
	return MONTHS.map((m) => ({ accountId, date: `${m}-05`, amount, kind, otherId }));
}
/** A transfer with both sides. */
const transfer = (from: string, to: string, amount: number) => [
	...monthly(from, -amount, 'transfer', to),
	...monthly(to, amount, 'transfer', from)
];
const link = (links: FlowLink[], from: string, to: string) =>
	links.find((l) => l.from === from && l.to === to)?.amount ?? 0;
const acc = (id: string) => `acc:${id}`;

describe('buildFlow', () => {
	const moves = [
		...monthly('main', 300_000, 'salary'),
		...monthly('main', 20_000, 'income'),
		...monthly('main', -100_000, 'expense'),
		...transfer('main', 'haushalt', 120_000),
		...transfer('main', 'spar', 30_000),
		...transfer('main', 'karte', 15_000),
		...monthly('haushalt', -130_000, 'expense'),
		...monthly('karte', -15_000, 'expense')
	];
	const flow = buildFlow(ACCOUNTS, moves, 'main', 3);

	it('leads the income through the main account to the accounts it feeds', () => {
		expect(link(flow.links, FLOW_NODES.salary, acc('main'))).toBe(300_000);
		expect(link(flow.links, FLOW_NODES.income, acc('main'))).toBe(20_000);
		expect(link(flow.links, acc('main'), acc('haushalt'))).toBe(120_000);
		expect(link(flow.links, acc('main'), acc('spar'))).toBe(30_000);
		expect(link(flow.links, acc('main'), acc('karte'))).toBe(15_000);
		expect(flow.reached).toEqual(['main', 'haushalt', 'spar', 'karte']);
	});

	it('shows per account what is spent, left over, saved or missing', () => {
		expect(link(flow.links, acc('main'), FLOW_NODES.expenses)).toBe(100_000);
		expect(link(flow.links, acc('main'), FLOW_NODES.left)).toBe(55_000);
		expect(link(flow.links, acc('haushalt'), FLOW_NODES.expenses)).toBe(130_000);
		// 100 € a month more leave the household account than arrive.
		expect(link(flow.links, FLOW_NODES.stock, acc('haushalt'))).toBe(10_000);
		expect(link(flow.links, acc('spar'), FLOW_NODES.saved)).toBe(30_000);
		expect(link(flow.links, acc('karte'), FLOW_NODES.expenses)).toBe(15_000);
	});

	it('balances every account node', () => {
		for (const id of flow.reached) {
			const into = flow.links.filter((l) => l.to === acc(id)).reduce((s, l) => s + l.amount, 0);
			const out = flow.links.filter((l) => l.from === acc(id)).reduce((s, l) => s + l.amount, 0);
			expect(into).toBe(out);
		}
		const main = flow.nodes.find((n) => n.id === acc('main'))!;
		expect(main).toMatchObject({ label: 'main', accountId: 'main', amount: 320_000 });
		expect(flow.nodes.find((n) => n.id === FLOW_NODES.expenses)?.label).toBe('Ausgaben');
	});

	it('gives the sums per month', () => {
		expect(flow.sums.get('haushalt')).toMatchObject({
			inflow: 120_000,
			outflow: 130_000,
			transfersIn: 120_000,
			expenses: 130_000
		});
		expect(flow.sums.get('main')).toMatchObject({
			salary: 300_000,
			income: 20_000,
			inflow: 320_000,
			outflow: 265_000,
			transfersOut: 165_000
		});
	});

	it('nets transfers back and forth', () => {
		const back = buildFlow(
			ACCOUNTS,
			[
				...monthly('main', 100_000, 'salary'),
				...transfer('main', 'spar', 30_000),
				...transfer('spar', 'main', 10_000)
			],
			'main',
			3
		);
		expect(link(back.links, acc('main'), acc('spar'))).toBe(20_000);
		expect(link(back.links, acc('spar'), acc('main'))).toBe(0);
		expect(link(back.links, acc('spar'), FLOW_NODES.saved)).toBe(20_000);
	});

	it('leaves out a transfer that would close a circle', () => {
		const circle = buildFlow(
			ACCOUNTS,
			[
				...monthly('main', 100_000, 'salary'),
				...transfer('main', 'haushalt', 50_000),
				...transfer('haushalt', 'spar', 20_000),
				...transfer('spar', 'main', 5_000)
			],
			'main',
			3
		);
		expect(link(circle.links, acc('main'), acc('haushalt'))).toBe(50_000);
		expect(link(circle.links, acc('haushalt'), acc('spar'))).toBe(20_000);
		expect(link(circle.links, acc('spar'), acc('main'))).toBe(0);
	});

	it('shows an account the viewer cannot see by its name only', () => {
		const flow = buildFlow(
			ACCOUNTS,
			[...monthly('main', 100_000, 'salary'), ...monthly('main', -40_000, 'transfer', 'fremd')],
			'main',
			3
		);
		expect(link(flow.links, acc('main'), acc('fremd'))).toBe(40_000);
		expect(flow.links.filter((l) => l.from === acc('fremd'))).toEqual([]);
		// Money from an account that is not visible counts by its receiving side.
		const into = buildFlow(ACCOUNTS, monthly('main', 25_000, 'transfer', 'fremd'), 'main', 3);
		expect(link(into.links, acc('fremd'), acc('main'))).toBe(25_000);
		expect(link(into.links, acc('main'), FLOW_NODES.left)).toBe(25_000);
	});

	it('shows an account that only pays in as a source', () => {
		const flow = buildFlow(
			ACCOUNTS,
			[...monthly('main', 100_000, 'salary'), ...transfer('haushalt', 'main', 10_000)],
			'main',
			3
		);
		expect(link(flow.links, acc('haushalt'), acc('main'))).toBe(10_000);
		expect(flow.reached).toEqual(['main']);
	});

	it('shows the expense a savings goal pays as paid from the savings account', () => {
		const payout = (accountId: string, amount: number, otherId: string): FlowMove => ({
			accountId,
			date: '2026-09-15',
			amount,
			kind: 'transfer',
			otherId,
			payout: true
		});
		const flow = buildFlow(
			ACCOUNTS,
			[
				...monthly('main', 100_000, 'salary'),
				...transfer('main', 'spar', 5_000),
				// The yearly insurance: 150 € from the giro account, paid by the reserve.
				{ accountId: 'main', date: '2026-09-15', amount: -15_000, kind: 'expense', otherId: null },
				payout('spar', -15_000, 'main'),
				payout('main', 15_000, 'spar')
			],
			'main',
			3
		);
		// The monthly reserve still flows to the savings account – no circle back.
		expect(link(flow.links, acc('main'), acc('spar'))).toBe(5_000);
		expect(link(flow.links, acc('spar'), acc('main'))).toBe(0);
		expect(link(flow.links, acc('spar'), FLOW_NODES.expenses)).toBe(5_000);
		expect(link(flow.links, acc('main'), FLOW_NODES.expenses)).toBe(0);
		// In the sums the payout is what it is on the bank statement.
		expect(flow.sums.get('main')).toMatchObject({ inflow: 105_000, outflow: 10_000 });
	});

	it('is empty without moves', () => {
		const flow = buildFlow(ACCOUNTS, [], 'main', 3);
		expect(flow.links).toEqual([]);
		expect(flow.nodes).toEqual([]);
		expect(flow.reached).toEqual(['main']);
	});
});

describe('assess', () => {
	it('is fine when the inflow covers the outflow and the balance stays above the floor', () => {
		const a = assess({
			type: 'giro',
			inflow: 120_000,
			outflow: 110_000,
			lowest: { date: '2026-09-03', balance: 5_000 }
		});
		expect(a).toMatchObject({ status: 'ok', diff: 10_000, floor: 0 });
	});

	it('tells apart too little on average and too little at times', () => {
		const low = { date: '2026-09-03', balance: -4_500 };
		const high = { date: '2026-09-03', balance: 80_000 };
		const giro = { type: 'giro' as const };
		expect(assess({ ...giro, inflow: 100, outflow: 130, lowest: high }).status).toBe('draining');
		expect(assess({ ...giro, inflow: 130, outflow: 100, lowest: low }).status).toBe('timing');
		expect(assess({ ...giro, inflow: 100, outflow: 130, lowest: low }).status).toBe('short');
		expect(assess({ ...giro, inflow: 0, outflow: 0, lowest: low }).status).toBe('none');
	});

	it('counts the buffer of a giro account as the floor', () => {
		const lowest = { date: '2026-09-03', balance: 20_000 };
		expect(assess({ type: 'giro', inflow: 5, outflow: 5, lowest, floor: 30_000 }).status).toBe(
			'timing'
		);
		expect(assess({ type: 'giro', inflow: 5, outflow: 5, lowest, floor: 20_000 }).status).toBe(
			'ok'
		);
	});

	it('measures a savings account by its reserves and goals', () => {
		const spar = { type: 'sparbuch' as const, outflow: 0 };
		expect(assess({ ...spar, inflow: 10_000, required: 12_000 })).toMatchObject({
			status: 'short',
			diff: -2_000,
			required: 12_000
		});
		expect(assess({ ...spar, inflow: 12_000, required: 12_000 }).status).toBe('ok');
		expect(assess({ ...spar, inflow: 12_000, required: 0 }).status).toBe('none');
		expect(assess({ type: 'sparbuch', inflow: 100, outflow: 300 }).status).toBe('draining');
	});

	it('does not judge a credit card', () => {
		expect(assess({ type: 'kreditkarte', inflow: 100, outflow: 500 }).status).toBe('none');
	});
});

describe('verdictText', () => {
	const lowest = { date: '2027-02-03', balance: -4_500 };
	const text = (a: Parameters<typeof assess>[0], plan: boolean) =>
		verdictText(assess(a), a.type, plan).replace(/\u00a0/g, ' ');

	it('says how much is left or missing per month', () => {
		expect(text({ type: 'giro', inflow: 120_000, outflow: 118_000 }, true)).toBe(
			'Reicht voraussichtlich: im Schnitt bleiben 20,00 € im Monat übrig.'
		);
		expect(text({ type: 'giro', inflow: 120_000, outflow: 118_000 }, false)).toBe(
			'Hat gereicht: im Schnitt blieben 20,00 € im Monat übrig.'
		);
		expect(text({ type: 'giro', inflow: 100_000, outflow: 103_000 }, true)).toContain(
			'30,00 € im Monat zu wenig – der Bestand gleicht das'
		);
	});

	it('names the day the balance is too low', () => {
		expect(text({ type: 'giro', inflow: 10, outflow: 5, lowest }, true)).toBe(
			'Im Schnitt genug, aber am 03.02.2027 voraussichtlich nur −45,00 € auf dem Konto.'
		);
		expect(text({ type: 'giro', inflow: 100_000, outflow: 103_000, lowest }, false)).toBe(
			'30,00 € im Monat zu wenig; am 03.02.2027 waren nur −45,00 € auf dem Konto.'
		);
		expect(
			text(
				{
					type: 'giro',
					inflow: 10,
					outflow: 5,
					lowest: { date: '2027-02-03', balance: 1_000 },
					floor: 5_000
				},
				true
			)
		).toContain('nur 10,00 € auf dem Konto (unter dem Puffer)');
	});

	it('compares a savings account with what its reserves need', () => {
		expect(text({ type: 'sparbuch', inflow: 10_000, outflow: 0, required: 12_000 }, true)).toBe(
			'20,00 € im Monat zu wenig für Rücklagen und Sparziele (120,00 € im Monat nötig).'
		);
		expect(text({ type: 'sparbuch', inflow: 12_000, outflow: 0, required: 12_000 }, true)).toBe(
			'Deckt Rücklagen und Sparziele (120,00 € im Monat nötig).'
		);
		expect(text({ type: 'sparbuch', inflow: 30_000, outflow: 0 }, false)).toBe(
			'300,00 € im Monat wurden gespart.'
		);
		expect(text({ type: 'kreditkarte', inflow: 1, outflow: 1 }, true)).toBe(
			'Wird mit der Abrechnung ausgeglichen.'
		);
	});
});

describe('pastPeriod', () => {
	it('takes the last complete months', () => {
		expect(pastPeriod('2026-11-27', 3, '2025-01-01')).toEqual({
			months: ['2026-08', '2026-09', '2026-10'],
			from: '2026-08-01',
			to: '2026-10-31',
			partial: false
		});
		expect(pastPeriod('2027-01-15', 3, '2025-01-01').months).toEqual([
			'2026-10',
			'2026-11',
			'2026-12'
		]);
	});

	it('does not reach back before the opening date', () => {
		expect(pastPeriod('2026-11-27', 6, '2026-09-15')).toEqual({
			months: ['2026-09', '2026-10'],
			from: '2026-09-15',
			to: '2026-10-31',
			partial: false
		});
	});

	it('falls back to the running month without a complete one', () => {
		expect(pastPeriod('2026-11-27', 6, '2026-11-10')).toEqual({
			months: ['2026-11'],
			from: '2026-11-10',
			to: '2026-11-27',
			partial: true
		});
	});
});

describe('lowestBalance', () => {
	const moves = [
		{ date: '2026-10-10', amount: -5_000 },
		{ date: '2026-10-20', amount: 20_000 },
		{ date: '2026-11-03', amount: -3_000 }
	];

	it('walks back from today’s balance to the lowest end of day in the period', () => {
		// Today 100 €: 130 € at the end of October, −70 € from the 10th to the 19th, −20 € before.
		expect(lowestBalance(10_000, moves, '2026-10-01', '2026-10-31')).toEqual({
			date: '2026-10-10',
			balance: -7_000
		});
	});

	it('counts the balance the period began with', () => {
		expect(lowestBalance(10_000, moves, '2026-10-15', '2026-10-31')).toEqual({
			date: '2026-10-15',
			balance: -7_000
		});
	});

	it('is the balance at the end without moves in the period', () => {
		expect(lowestBalance(10_000, moves.slice(2), '2026-10-01', '2026-10-31')).toEqual({
			date: '2026-10-31',
			balance: 13_000
		});
		expect(lowestBalance(10_000, [], '2026-11-02', '2026-11-01')).toBeNull();
	});
});

describe('flowMonths', () => {
	it('sums what arrived and left per month, newest first', () => {
		const rows = flowMonths(
			[
				{ date: '2026-09-01', amount: 120_000 },
				{ date: '2026-09-15', amount: -90_000 },
				{ date: '2026-10-01', amount: 120_000 },
				{ date: '2026-11-01', amount: 120_000 }
			],
			['2026-09', '2026-10']
		);
		expect(rows.map((r) => r.month)).toEqual(['2026-10', '2026-09']);
		expect(rows[1]).toMatchObject({
			label: 'September 2026',
			inflow: 120_000,
			outflow: 90_000,
			net: 30_000
		});
		expect(rows[0]).toMatchObject({ inflow: 120_000, outflow: 0, net: 120_000 });
	});
});

describe('planPeriod', () => {
	it('covers the twelve months after today', () => {
		expect(planPeriod('2026-11-27')).toEqual({ from: '2026-11-28', to: '2027-11-27' });
	});
});

describe('everydayRate', () => {
	const move = (date: string, amount: number, over: Partial<FlowMove> = {}): FlowMove => ({
		accountId: 'haushalt',
		date,
		amount,
		kind: amount < 0 ? 'expense' : 'income',
		otherId: null,
		...over
	});

	it('averages the expenses without recurring item per month', () => {
		const moves = [
			move('2026-09-03', -40_000),
			move('2026-09-20', -51_250),
			move('2026-10-11', -91_250),
			// Not everyday spending: a recurring item, a transfer, income, another period.
			move('2026-09-01', -90_000, { recurring: true }),
			move('2026-09-05', -30_000, { kind: 'transfer', otherId: 'spar' }),
			move('2026-09-06', 5_000),
			move('2026-11-02', -70_000)
		];
		// 1.825 € in 61 days are 10.950 € a year.
		expect(everydayRate(moves, '2026-09-01', '2026-10-31')).toBe(91_001);
		expect(everydayRate([], '2026-09-01', '2026-10-31')).toBe(0);
		// A few days of a new account count as a whole month.
		expect(everydayRate([move('2026-09-03', -3_000)], '2026-09-01', '2026-09-05')).toBe(3_042);
		expect(everydayRate(moves, '2026-11-01', '2026-10-31')).toBe(0);
	});
});

describe('lowestWithSpending', () => {
	const series: [string, number][] = [
		['2026-11-27', 100_000],
		['2026-12-01', 40_000],
		['2026-12-27', 160_000]
	];

	it('is the forecast’s lowest point without everyday spending', () => {
		expect(lowestWithSpending(series, 0)).toEqual({ date: '2026-12-01', balance: 40_000 });
		expect(lowestWithSpending([['2026-11-27', 5_000]], 60_000)).toEqual({
			date: '2026-11-27',
			balance: 5_000
		});
		expect(lowestWithSpending([], 60_000)).toBeNull();
	});

	it('counts a low within a day the forecast knows of', () => {
		// On the 1st the rent leaves before the salary arrives.
		const within = { date: '2026-12-01', balance: -20_000 };
		expect(lowestWithSpending(series, 0, within)).toEqual(within);
		expect(lowestWithSpending(series, 36_500, within)).toEqual({
			date: '2026-12-01',
			balance: -20_000 - 4_800
		});
	});

	it('lets the balance fall between the events', () => {
		// 365 € a month are 12 € a day: 30 days until the salary on the 27th.
		expect(lowestWithSpending(series, 36_500)).toEqual({
			date: '2026-12-27',
			balance: 40_000 - 36_000
		});
	});
});
