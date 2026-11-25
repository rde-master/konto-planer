// Credit cards ("Kreditkarte"): the balance on the statement day is debited from a giro account
// on the debit day. Settlements already booked are stored; the others are computed here.
import { nextBankDay } from './bank-calendar.js';

const pad = (n: number) => String(n).padStart(2, '0');

function lastDay(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The given day of a month; a missing day becomes the last of the month. */
export function dayIn(year: number, month: number, day: number): string {
	let y = year;
	let m = month;
	while (m > 12) {
		m -= 12;
		y++;
	}
	return `${y}-${pad(m)}-${pad(Math.min(day, lastDay(y, m)))}`;
}

function parts(day: string): [number, number, number] {
	const [y, m, d] = day.split('-').map(Number);
	return [y, m, d];
}

/** Statement dates in [from, to]. */
export function statementDates(statementDay: number, from: string, to: string): string[] {
	const out: string[] = [];
	let [y, m] = parts(from);
	for (;;) {
		const s = dayIn(y, m, statementDay);
		if (s > to) break;
		if (s >= from) out.push(s);
		m++;
		if (m > 12) {
			m = 1;
			y++;
		}
	}
	return out;
}

/** Debit day after a statement (same month if the day is later, else the next), as a bank day. */
export function debitDateFor(statementDate: string, debitDay: number): string {
	const [y, m] = parts(statementDate);
	const same = dayIn(y, m, debitDay);
	return nextBankDay(same > statementDate ? same : dayIn(y, m + 1, debitDay));
}

export type CardSetup = {
	statementDay: number;
	debitDay: number;
	openingDate: string;
	openingBalance: number;
};

export type CardEvent = { date: string; amount: number };

export type Settlement = {
	statementDate: string;
	debitDate: string;
	/** Positive cents moved from the giro account to the card (0 = card not in debit). */
	amount: number;
};

/**
 * Settlements not stored yet, from the first statement on or after the opening date up to
 * `until`. `events` are all card movements from the opening date on (bookings, also future
 * ones, and expected payments); stored settlements are already among them.
 */
export function pendingSettlements(
	card: CardSetup,
	events: CardEvent[],
	stored: Set<string>,
	until: string
): Settlement[] {
	const sorted = events
		.filter((e) => e.date >= card.openingDate)
		.sort((a, b) => a.date.localeCompare(b.date));
	const out: Settlement[] = [];
	let i = 0;
	let balance = card.openingBalance;
	const credits: Settlement[] = [];
	for (const s of statementDates(card.statementDay, card.openingDate, until)) {
		while (i < sorted.length && sorted[i].date <= s) balance += sorted[i++].amount;
		// Computed settlements debited by this statement count, too.
		for (const c of credits.splice(0)) {
			if (c.debitDate <= s) balance += c.amount;
			else credits.push(c);
		}
		if (stored.has(s)) continue;
		const settlement = {
			statementDate: s,
			debitDate: debitDateFor(s, card.debitDay),
			amount: balance < 0 ? -balance : 0
		};
		out.push(settlement);
		if (settlement.amount) credits.push(settlement);
	}
	return out;
}

/** Statement and debit day text for the account page ("Abrechnung am 20., Abbuchung am 28."). */
export function settlementText(statementDay: number, debitDay: number): string {
	return `Abrechnung am ${statementDay}., Abbuchung am ${debitDay}.`;
}
