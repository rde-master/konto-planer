// Settling shared expenses between users ("Ausgleich").
export const FULL = 10_000;

/** Equal shares in basis points; the remainder goes to the first ones (sum 10000). */
export function equalShares(userIds: string[]): Map<string, number> {
	const out = new Map<string, number>();
	if (!userIds.length) return out;
	const base = Math.floor(FULL / userIds.length);
	let rest = FULL - base * userIds.length;
	for (const id of userIds) {
		out.set(id, base + (rest > 0 ? 1 : 0));
		if (rest > 0) rest--;
	}
	return out;
}

/** "33,33" → 3333 basis points; null if invalid. */
export function parsePercent(input: string): number | null {
	const s = input.replace(/\s|%/g, '').replace(',', '.');
	if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
	const bp = Math.round(Number(s) * 100);
	return bp <= FULL ? bp : null;
}

/** 3333 → "33,33 %" */
export function formatPercent(bp: number): string {
	return `${(bp / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`;
}

/**
 * Cents owed per participant for an amount (positive cents), summing exactly to it
 * (largest remainder).
 */
export function owedAmounts(amount: number, shares: Map<string, number>): Map<string, number> {
	const total = [...shares.values()].reduce((s, v) => s + v, 0);
	const out = new Map<string, number>();
	if (!total) return out;
	const exact = [...shares].map(([id, bp]) => ({ id, value: (amount * bp) / total }));
	let given = 0;
	for (const e of exact) {
		const v = Math.floor(e.value);
		out.set(e.id, v);
		given += v;
	}
	const byRemainder = [...exact].sort(
		(a, b) => b.value - Math.floor(b.value) - (a.value - Math.floor(a.value))
	);
	for (let i = 0; given < amount; i++, given++) {
		const id = byRemainder[i % byRemainder.length].id;
		out.set(id, out.get(id)! + 1);
	}
	return out;
}

export type SharedExpense = { amount: number; payerId: string; shares: Map<string, number> };
export type SettlementEntry = { fromUserId: string; toUserId: string; amount: number };

/** Net balance per user: positive = gets money back, negative = owes. */
export function netBalances(
	expenses: SharedExpense[],
	settlementsList: SettlementEntry[]
): Map<string, number> {
	const net = new Map<string, number>();
	const add = (id: string, v: number) => net.set(id, (net.get(id) ?? 0) + v);
	for (const e of expenses) {
		add(e.payerId, e.amount);
		for (const [id, owed] of owedAmounts(e.amount, e.shares)) add(id, -owed);
	}
	for (const s of settlementsList) {
		add(s.fromUserId, s.amount);
		add(s.toUserId, -s.amount);
	}
	return net;
}

/** Who pays whom how much, with as few payments as possible (greedy on the largest amounts). */
export function debts(net: Map<string, number>): SettlementEntry[] {
	const owe = [...net].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }));
	const get = [...net].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }));
	owe.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
	get.sort((a, b) => b.v - a.v || a.id.localeCompare(b.id));
	const out: SettlementEntry[] = [];
	let i = 0;
	let j = 0;
	while (i < owe.length && j < get.length) {
		const amount = Math.min(owe[i].v, get[j].v);
		if (amount > 0) out.push({ fromUserId: owe[i].id, toUserId: get[j].id, amount });
		owe[i].v -= amount;
		get[j].v -= amount;
		if (owe[i].v === 0) i++;
		if (get[j].v === 0) j++;
	}
	return out;
}
