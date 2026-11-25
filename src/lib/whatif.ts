// "Was wäre wenn": apply probing changes to recurring items (nothing real changes).
import { addDays, type AmountEntry, type Interval, type Schedule } from './recurring.js';

export const CHANGE_KINDS = ['add', 'cancel', 'amount'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];

export const CHANGE_LABELS: Record<ChangeKind, string> = {
	add: 'Neuer Posten',
	cancel: 'Kündigen',
	amount: 'Neuer Betrag'
};

export const WHATIF_INTERVALS = ['monthly', 'quarterly', 'semiannual', 'yearly', 'once'] as const;

export type Change = {
	id: string;
	kind: ChangeKind;
	recurringId: string | null;
	name: string | null;
	direction: 'expense' | 'income' | null;
	interval: Interval | null;
	amount: number | null;
	date: string;
};

/** What the scenario needs of an item (a subset of the recurring summary). */
export type WhatIfItem = Schedule & {
	id: string;
	name: string;
	kind: 'expense' | 'income' | 'transfer';
	accountId: string;
	targetAccountId: string | null;
	isSalary: boolean;
	amounts: AmountEntry[];
};

/**
 * Items as they would be: cancelled ones end the day before the cancel date, new amounts apply
 * from their date, new items are added on the scenario's account (starting on their date).
 * `make` builds a full item from the template fields of a new one.
 */
export function applyChanges<T extends WhatIfItem>(
	items: T[],
	changes: Change[],
	accountId: string,
	make: (fields: WhatIfItem) => T
): T[] {
	const out = items.map((i) => ({ ...i, amounts: [...i.amounts] }));
	for (const c of changes) {
		if (c.kind === 'add' && c.amount && c.direction && c.interval) {
			out.push(
				make({
					id: `whatif-${c.id}`,
					name: c.name ?? 'Neuer Posten',
					kind: c.direction,
					accountId,
					targetAccountId: null,
					isSalary: false,
					interval: c.interval,
					customEvery: null,
					customUnit: null,
					startDate: c.date,
					endDate: null,
					pauseFrom: null,
					pauseUntil: null,
					amounts: [{ amount: c.amount, validFrom: c.date }]
				})
			);
			continue;
		}
		const item = out.find((i) => i.id === c.recurringId);
		if (!item) continue;
		if (c.kind === 'cancel') {
			const end = addDays(c.date, -1);
			if (!item.endDate || item.endDate > end) item.endDate = end;
		}
		if (c.kind === 'amount' && c.amount) {
			item.amounts = [
				...item.amounts.filter((a) => a.validFrom !== c.date),
				{ amount: c.amount, validFrom: c.date }
			].sort((a, b) => a.validFrom.localeCompare(b.validFrom));
		}
	}
	return out;
}

/** One line per change, e.g. "Kündigen: Fitnessstudio ab 01.01.2027". */
export function describeChange(
	c: Change,
	names: Map<string, string>,
	format: { day: (d: string) => string; euro: (c: number) => string }
): string {
	if (c.kind === 'add')
		return `${c.direction === 'income' ? 'Neue Einnahme' : 'Neue Ausgabe'}: ${c.name ?? ''} ${format.euro(c.amount ?? 0)} ab ${format.day(c.date)}`;
	const name = (c.recurringId && names.get(c.recurringId)) || 'Posten';
	if (c.kind === 'cancel') return `Kündigen: ${name} ab ${format.day(c.date)}`;
	return `Neuer Betrag: ${name} ${format.euro(c.amount ?? 0)} ab ${format.day(c.date)}`;
}
