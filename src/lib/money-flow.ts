// "Finanzfluss": the salary arrives on the main account and is passed on to the other accounts
// by transfers. Pure logic for the flow diagram and for the verdict whether what arrives on an
// account covers what leaves it.
import { formatEuro } from './money.js';
import { formatDay } from './dates.js';
import { monthName } from './monthly-report.js';
import { addDays, addMonths } from './recurring.js';
import { monthBounds } from './account-months.js';

export type FlowAccountType = 'giro' | 'sparbuch' | 'kreditkarte';

export type FlowAccount = {
	id: string;
	name: string;
	type: FlowAccountType;
	/** Account colour name (`src/lib/colors.ts`). */
	color: string;
	/** false: only the name is known (the other side of a transfer). */
	visible: boolean;
};

/**
 * Something that changes the balance of a visible account: a booking (past) or a due date
 * (plan). `amount` is the signed effect on the account; transfers name the other account.
 */
export type FlowMove = {
	accountId: string;
	date: string;
	amount: number;
	kind: 'salary' | 'income' | 'expense' | 'transfer';
	otherId: string | null;
	/**
	 * A savings goal paying its expense (savings account → giro): it counts as a transfer in the
	 * sums, but the diagram shows the expense as paid from the savings account – the money that
	 * was set aside there does not flow back in a circle.
	 */
	payout?: boolean;
	/** The booking belongs to a recurring item (a planned payment). */
	recurring?: boolean;
};

/** Ids of the nodes that are not accounts. */
export const FLOW_NODES = {
	salary: 'in:salary',
	income: 'in:income',
	stock: 'in:stock',
	expenses: 'out:expenses',
	saved: 'out:saved',
	left: 'out:left'
} as const;

const NODE_LABELS: Record<string, string> = {
	[FLOW_NODES.salary]: 'Gehalt',
	[FLOW_NODES.income]: 'Weitere Einnahmen',
	[FLOW_NODES.stock]: 'Aus dem Bestand',
	[FLOW_NODES.expenses]: 'Ausgaben',
	[FLOW_NODES.saved]: 'Gespart',
	[FLOW_NODES.left]: 'Bleibt übrig'
};

export type FlowNode = {
	id: string;
	label: string;
	/** Account colour name, or the role of a node that is not an account. */
	color: string;
	accountId: string | null;
	/** Cents per month passing through the node. */
	amount: number;
};

/** Cents per month from one node to another. */
export type FlowLink = { from: string; to: string; amount: number };

/** Sums of one account, cents per month (all ≥ 0). */
export type FlowSums = {
	accountId: string;
	salary: number;
	income: number;
	expenses: number;
	transfersIn: number;
	transfersOut: number;
	/** Everything that arrives. */
	inflow: number;
	/** Everything that leaves. */
	outflow: number;
};

export type FlowGraph = {
	nodes: FlowNode[];
	links: FlowLink[];
	/** Accounts the money of the main account reaches, the main account first. */
	reached: string[];
	sums: Map<string, FlowSums>;
};

const perMonth = (cents: number, months: number) => Math.round(cents / Math.max(1, months));

/** Sums per account over the whole period (not yet per month). */
function totals(moves: FlowMove[], known: Map<string, FlowAccount>) {
	const sums = new Map<string, FlowSums>();
	const of = (id: string) => {
		let s = sums.get(id);
		if (!s) {
			s = {
				accountId: id,
				salary: 0,
				income: 0,
				expenses: 0,
				transfersIn: 0,
				transfersOut: 0,
				inflow: 0,
				outflow: 0
			};
			sums.set(id, s);
		}
		return s;
	};
	/** Transfers: source → target → cents. */
	const pairs = new Map<string, Map<string, number>>();
	const pair = (from: string, to: string, amount: number) => {
		const row = pairs.get(from) ?? new Map<string, number>();
		row.set(to, (row.get(to) ?? 0) + amount);
		pairs.set(from, row);
	};
	/** Expenses as the diagram shows them (see `FlowMove.payout`). */
	const shown = new Map<string, number>();
	const show = (id: string, amount: number) => shown.set(id, (shown.get(id) ?? 0) + amount);
	for (const m of moves) {
		if (!m.amount) continue;
		const s = of(m.accountId);
		const other = m.kind === 'transfer' && m.otherId ? known.get(m.otherId) : undefined;
		if (m.amount > 0) s.inflow += m.amount;
		else s.outflow -= m.amount;
		if (other && other.id !== m.accountId) {
			if (m.payout && m.amount < 0) {
				s.transfersOut -= m.amount;
				show(m.accountId, -m.amount);
			} else if (m.payout && other.visible) {
				s.transfersIn += m.amount;
				show(m.accountId, -m.amount);
			} else if (m.amount < 0) {
				s.transfersOut -= m.amount;
				pair(m.accountId, other.id, -m.amount);
			} else {
				s.transfersIn += m.amount;
				// The paying side counts; the receiving side only where the payer is not visible.
				if (!other.visible) pair(other.id, m.accountId, m.amount);
			}
		} else if (m.amount > 0) {
			if (m.kind === 'salary') s.salary += m.amount;
			else s.income += m.amount;
		} else {
			s.expenses -= m.amount;
			show(m.accountId, -m.amount);
		}
	}
	return { sums, pairs, shown };
}

/** Whether `to` leads back to `from` over the links kept so far. */
function leadsTo(links: FlowLink[], from: string, to: string): boolean {
	const seen = new Set<string>();
	const stack = [from];
	while (stack.length) {
		const at = stack.pop()!;
		if (at === to) return true;
		if (seen.has(at)) continue;
		seen.add(at);
		for (const l of links) if (l.from === at) stack.push(l.to);
	}
	return false;
}

/**
 * The flow of money per month: income → main account → the accounts it feeds by transfers →
 * expenses, and what is left over or missing on each account. Transfers back and forth between
 * two accounts are netted; `months` is the length of the period the moves cover.
 */
export function buildFlow(
	accounts: FlowAccount[],
	moves: FlowMove[],
	mainId: string,
	months: number
): FlowGraph {
	const known = new Map(accounts.map((a) => [a.id, a]));
	const { sums, pairs, shown } = totals(moves, known);

	// Net transfer between each pair of accounts, per month.
	const net: FlowLink[] = [];
	const done = new Set<string>();
	for (const [from, row] of pairs)
		for (const [to, amount] of row) {
			const key = [from, to].sort().join('|');
			if (done.has(key)) continue;
			done.add(key);
			const diff = perMonth(amount - (pairs.get(to)?.get(from) ?? 0), months);
			if (diff > 0) net.push({ from, to, amount: diff });
			else if (diff < 0) net.push({ from: to, to: from, amount: -diff });
		}
	net.sort((a, b) => b.amount - a.amount);

	// Follow the money from the main account; a transfer that would close a circle is left out.
	const reached: string[] = known.has(mainId) ? [mainId] : [];
	const transfers: FlowLink[] = [];
	for (let i = 0; i < reached.length; i++) {
		if (!known.get(reached[i])?.visible) continue;
		for (const link of net) {
			if (link.from !== reached[i] || leadsTo(transfers, link.to, link.from)) continue;
			transfers.push(link);
			if (!reached.includes(link.to)) reached.push(link.to);
		}
	}
	// Accounts that only pay into this flow (a savings account paying a reserve, for example).
	for (const link of net)
		if (reached.includes(link.to) && !reached.includes(link.from)) transfers.push(link);

	const id = (accountId: string) => `acc:${accountId}`;
	const links: FlowLink[] = [];
	const add = (from: string, to: string, amount: number) => {
		if (amount > 0) links.push({ from, to, amount });
	};
	for (const accountId of reached) {
		const account = known.get(accountId)!;
		if (!account.visible) continue;
		const s = sums.get(accountId);
		const salary = perMonth(s?.salary ?? 0, months);
		const income = perMonth(s?.income ?? 0, months);
		const expenses = perMonth(Math.max(0, shown.get(accountId) ?? 0), months);
		add(FLOW_NODES.salary, id(accountId), salary);
		add(FLOW_NODES.income, id(accountId), income);
		const arriving = transfers.filter((l) => l.to === accountId).reduce((t, l) => t + l.amount, 0);
		const leaving = transfers.filter((l) => l.from === accountId).reduce((t, l) => t + l.amount, 0);
		for (const l of transfers) if (l.from === accountId) add(id(l.from), id(l.to), l.amount);
		add(id(accountId), FLOW_NODES.expenses, expenses);
		const rest = salary + income + arriving - leaving - expenses;
		if (rest > 0)
			add(id(accountId), account.type === 'sparbuch' ? FLOW_NODES.saved : FLOW_NODES.left, rest);
		else add(FLOW_NODES.stock, id(accountId), -rest);
	}
	for (const l of transfers) if (!reached.includes(l.from)) add(id(l.from), id(l.to), l.amount);

	const through = new Map<string, { in: number; out: number }>();
	for (const l of links) {
		const from = through.get(l.from) ?? { in: 0, out: 0 };
		from.out += l.amount;
		through.set(l.from, from);
		const to = through.get(l.to) ?? { in: 0, out: 0 };
		to.in += l.amount;
		through.set(l.to, to);
	}
	const nodes: FlowNode[] = [...through].map(([nodeId, t]) => {
		const account = nodeId.startsWith('acc:') ? known.get(nodeId.slice(4)) : undefined;
		return {
			id: nodeId,
			label: account?.name ?? NODE_LABELS[nodeId] ?? nodeId,
			color: account?.color ?? nodeId,
			accountId: account?.id ?? null,
			amount: Math.max(t.in, t.out)
		};
	});

	const monthly = new Map<string, FlowSums>();
	for (const [accountId, s] of sums)
		monthly.set(accountId, {
			accountId,
			salary: perMonth(s.salary, months),
			income: perMonth(s.income, months),
			expenses: perMonth(s.expenses, months),
			transfersIn: perMonth(s.transfersIn, months),
			transfersOut: perMonth(s.transfersOut, months),
			inflow: perMonth(s.inflow, months),
			outflow: perMonth(s.outflow, months)
		});
	return { nodes, links, reached, sums: monthly };
}

// --- verdict -------------------------------------------------------------------------------

export const FLOW_STATUSES = ['ok', 'draining', 'timing', 'short', 'none'] as const;
export type FlowStatus = (typeof FLOW_STATUSES)[number];

export const FLOW_STATUS_LABELS: Record<FlowStatus, string> = {
	ok: 'Reicht',
	draining: 'Zehrt vom Bestand',
	timing: 'Zeitweise knapp',
	short: 'Reicht nicht',
	none: ''
};

export type LowPoint = { date: string; balance: number };

export type Assessment = {
	status: FlowStatus;
	/** Cents per month. */
	inflow: number;
	outflow: number;
	/** What is left per month (negative = missing): against the outflow, or against `required`. */
	diff: number;
	/** Savings accounts: monthly rates of the reserves and savings goals (null = none). */
	required: number | null;
	/** Lowest balance in the period (null = unknown or not relevant). */
	lowest: LowPoint | null;
	/** The balance should not fall below this (buffer of a giro account, otherwise 0). */
	floor: number;
};

/**
 * Whether what arrives on an account is enough. Giro: the inflow covers the outflow on average
 * over the period **and** the balance never falls below the floor. Savings account: the inflow
 * covers the monthly rates of its reserves and goals. Credit cards are settled, not judged.
 */
export function assess(input: {
	type: FlowAccountType;
	inflow: number;
	outflow: number;
	lowest?: LowPoint | null;
	floor?: number;
	required?: number | null;
}): Assessment {
	const { type, inflow, outflow } = input;
	const floor = type === 'giro' ? (input.floor ?? 0) : 0;
	const base = { inflow, outflow, floor, required: null, lowest: null };
	if (type === 'kreditkarte') return { ...base, status: 'none', diff: inflow - outflow };
	if (type === 'sparbuch') {
		const required = input.required && input.required > 0 ? input.required : null;
		if (required !== null)
			return {
				...base,
				required,
				diff: inflow - required,
				status: inflow >= required ? 'ok' : 'short'
			};
		return { ...base, diff: inflow - outflow, status: outflow > inflow ? 'draining' : 'none' };
	}
	const lowest = input.lowest ?? null;
	const diff = inflow - outflow;
	if (!inflow && !outflow) return { ...base, lowest, diff, status: 'none' };
	const covers = diff >= 0;
	const safe = lowest === null || lowest.balance >= floor;
	return {
		...base,
		lowest,
		diff,
		status: covers ? (safe ? 'ok' : 'timing') : safe ? 'draining' : 'short'
	};
}

/** The verdict as a sentence: `plan` looks ahead twelve months, otherwise back. */
export function verdictText(a: Assessment, type: FlowAccountType, plan: boolean): string {
	if (type === 'kreditkarte') return 'Wird mit der Abrechnung ausgeglichen.';
	const missing = formatEuro(Math.abs(a.diff));
	if (type === 'sparbuch') {
		if (a.required !== null) {
			const need = `${formatEuro(a.required)} im Monat nötig`;
			return a.status === 'ok'
				? `Deckt Rücklagen und Sparziele (${need}).`
				: `${missing} im Monat zu wenig für Rücklagen und Sparziele (${need}).`;
		}
		if (a.status === 'draining')
			return plan
				? `Es gehen ${missing} im Monat mehr ab, als ankommen.`
				: `Es gingen ${missing} im Monat mehr ab, als ankamen.`;
		return a.diff > 0
			? plan
				? `${missing} im Monat werden gespart.`
				: `${missing} im Monat wurden gespart.`
			: '';
	}
	if (a.status === 'none') return plan ? 'Keine geplanten Bewegungen.' : 'Keine Bewegungen.';
	const low = a.lowest
		? plan
			? `am ${formatDay(a.lowest.date)} voraussichtlich nur ${formatEuro(a.lowest.balance)} auf dem Konto`
			: `am ${formatDay(a.lowest.date)} waren nur ${formatEuro(a.lowest.balance)} auf dem Konto`
		: '';
	const below = a.floor > 0 && a.lowest && a.lowest.balance >= 0 ? ' (unter dem Puffer)' : '';
	switch (a.status) {
		case 'ok':
			return plan
				? `Reicht voraussichtlich: im Schnitt bleiben ${missing} im Monat übrig.`
				: `Hat gereicht: im Schnitt blieben ${missing} im Monat übrig.`;
		case 'draining':
			return plan
				? `${missing} im Monat zu wenig – der Bestand gleicht das in den nächsten zwölf Monaten aus.`
				: `${missing} im Monat zu wenig – der Bestand hat es ausgeglichen.`;
		case 'timing':
			return `Im Schnitt genug, aber ${low}${below}.`;
		default:
			return `${missing} im Monat zu wenig; ${low}${below}.`;
	}
}

// --- periods and balances --------------------------------------------------------------------

export const PAST_MONTHS = [3, 6, 12] as const;
export type PastMonths = (typeof PAST_MONTHS)[number];

export type FlowPeriod = {
	/** "2026-08", oldest first. */
	months: string[];
	from: string;
	to: string;
	/** Only the running month so far (no complete month since the opening date yet). */
	partial: boolean;
};

/**
 * The last `count` complete months, not before the month of the main account's opening date.
 * Without a complete month the running month counts, up to today.
 */
export function pastPeriod(today: string, count: number, openingDate: string): FlowPeriod {
	const thisMonth = today.slice(0, 7);
	const first = openingDate.slice(0, 7);
	const months: string[] = [];
	for (let i = count; i >= 1; i--) {
		const month = addMonths(`${thisMonth}-01`, -i).slice(0, 7);
		if (month >= first) months.push(month);
	}
	if (!months.length)
		return {
			months: [thisMonth],
			from: openingDate > `${thisMonth}-01` ? openingDate : `${thisMonth}-01`,
			to: today,
			partial: true
		};
	const from = monthBounds(months[0]).from;
	return {
		months,
		from: openingDate > from ? openingDate : from,
		to: monthBounds(months.at(-1)!).to,
		partial: false
	};
}

/**
 * Lowest balance at the end of a day in [from, to], walked back from today's balance.
 * `moves` are all moves of the account from `from` up to today.
 */
export function lowestBalance(
	balanceToday: number,
	moves: Pick<FlowMove, 'date' | 'amount'>[],
	from: string,
	to: string
): LowPoint | null {
	if (from > to) return null;
	const byDay = new Map<string, number>();
	for (const m of moves) byDay.set(m.date, (byDay.get(m.date) ?? 0) + m.amount);
	const days = [...byDay.keys()].filter((d) => d >= from).sort((a, b) => b.localeCompare(a));
	// `running` is the balance at the end of the day the walk has reached.
	let running = balanceToday;
	let lowest: LowPoint | null = null;
	const see = (date: string) => {
		if (!lowest || running <= lowest.balance) lowest = { date, balance: running };
	};
	let atEnd = false;
	for (const day of days) {
		if (day <= to) {
			if (!atEnd) {
				atEnd = true;
				if (day < to) see(to);
			}
			see(day);
		}
		running -= byDay.get(day)!;
	}
	if (!atEnd) see(to);
	// The balance the period began with (before its first move).
	else if (days.at(-1)! > from) see(from);
	return lowest;
}

export type FlowMonth = {
	month: string;
	label: string;
	inflow: number;
	outflow: number;
	net: number;
};

/** What arrived and left per month of the period, newest first. */
export function flowMonths(
	moves: Pick<FlowMove, 'date' | 'amount'>[],
	months: string[]
): FlowMonth[] {
	const rows = new Map(
		months.map((month) => [
			month,
			{ month, label: monthName(month), inflow: 0, outflow: 0, net: 0 }
		])
	);
	for (const m of moves) {
		const row = rows.get(m.date.slice(0, 7));
		if (!row) continue;
		if (m.amount > 0) row.inflow += m.amount;
		else row.outflow -= m.amount;
		row.net += m.amount;
	}
	return [...rows.values()].reverse();
}

/** Length of the plan: the twelve months after today. */
export const PLAN_MONTHS = 12;

export function planPeriod(today: string): { from: string; to: string } {
	return { from: addDays(today, 1), to: addMonths(today, PLAN_MONTHS) };
}

/**
 * Everyday spending per month: expenses without a recurring item (groceries, fuel, card
 * payments) in [from, to], averaged over the days of the period. The plan only knows the
 * recurring items – this is what it adds for the rest.
 */
export function everydayRate(moves: FlowMove[], from: string, to: string): number {
	if (from > to) return 0;
	// At least a month: a few days of a new account would be multiplied to wild amounts.
	const days = Math.max(
		30,
		Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1
	);
	const spent = moves
		.filter((m) => m.kind === 'expense' && !m.recurring && m.date >= from && m.date <= to)
		.reduce((sum, m) => sum - m.amount, 0);
	return Math.max(0, Math.round(((spent / days) * 365) / 12));
}

/**
 * Lowest point of a forecast (`series`: balance after each day with events, starting today)
 * when `perMonth` cents of everyday spending leave the account evenly on top. Checked right
 * before and after the events of each day – in between the balance only falls.
 */
export function lowestWithSpending(
	series: [string, number][],
	perMonth: number,
	/** Lowest point within a day (outgoing payments before the incoming ones), if known. */
	within?: LowPoint | null
): LowPoint | null {
	if (!series.length) return null;
	const start = Date.parse(`${series[0][0]}T00:00:00Z`);
	const spentBy = (day: string) =>
		Math.round((((Date.parse(`${day}T00:00:00Z`) - start) / 86_400_000) * perMonth * 12) / 365);
	let lowest: LowPoint = { date: series[0][0], balance: series[0][1] };
	const see = (date: string, balance: number) => {
		if (balance < lowest.balance) lowest = { date, balance };
	};
	for (let i = 1; i < series.length; i++) {
		const [day, balance] = series[i];
		see(day, series[i - 1][1] - spentBy(day));
		see(day, balance - spentBy(day));
	}
	if (within) see(within.date, within.balance - spentBy(within.date));
	return lowest;
}
