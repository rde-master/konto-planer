// Import reminder ("Import-Erinnerung") and the "Stand vom" date of a balance.
import { addDays } from './recurring.js';

/** No reminder while the last import is at most this many days old. */
export const FRESH_DAYS = 14;
/** A balance older than this many days is marked. */
export const STALE_DAYS = 30;

/** Reminder day of a month: the 30th, in February the last day. */
export function reminderDay(today: string): string {
	const [y, m] = today.split('-').map(Number);
	const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return `${today.slice(0, 8)}${String(Math.min(30, last)).padStart(2, '0')}`;
}

/**
 * Reminded from the reminder day to the end of the month, for accounts that were imported
 * before and whose last import (day it was taken over) is older than FRESH_DAYS.
 */
export function needsImport(today: string, lastImportDay: string | null): boolean {
	if (!lastImportDay) return false;
	return today >= reminderDay(today) && lastImportDay < addDays(today, -FRESH_DAYS);
}

export type BalanceAsOf = { date: string; source: 'import' | 'adjustment' | 'opening' };

/** "Stand vom": latest imported day, else latest adjustment, else the opening date. */
export function balanceAsOf(
	importDate: string | null,
	adjustmentDate: string | null,
	openingDate: string
): BalanceAsOf {
	if (importDate) return { date: importDate, source: 'import' };
	if (adjustmentDate && adjustmentDate >= openingDate)
		return { date: adjustmentDate, source: 'adjustment' };
	return { date: openingDate, source: 'opening' };
}

export function isStale(asOf: string, today: string): boolean {
	return asOf < addDays(today, -STALE_DAYS);
}
