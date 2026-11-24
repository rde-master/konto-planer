import { listAccountsFor } from '#lib/server/accounts.js';
import { listRecurringFor } from '#lib/server/recurring.js';
import { openPayments } from '#lib/due.js';
import { addDays } from '#lib/recurring.js';
import { todayBerlin } from '#lib/dates.js';
import type { PageServerLoad } from './$types';

const RANGES = [30, 90, 365] as const;

export const load: PageServerLoad = async ({ locals, url }) => {
	const user = locals.user!;
	const [accounts, items] = await Promise.all([listAccountsFor(user), listRecurringFor(user)]);
	const filter = url.searchParams.get('konto');
	const accountId = accounts.some((a) => a.id === filter) ? filter : null;
	const days = RANGES.find((d) => String(d) === url.searchParams.get('tage')) ?? 30;
	const today = todayBerlin();
	const ids = new Set(
		accounts.filter((a) => !a.archivedAt && (!accountId || a.id === accountId)).map((a) => a.id)
	);
	const names = new Map(accounts.map((a) => [a.id, a.name]));
	// Today's due items are already booked provisionally; open ones start tomorrow.
	const rows = openPayments(
		items.filter((i) => !i.archivedAt),
		ids,
		addDays(today, 1),
		addDays(today, days)
	).map((r) => ({ ...r, accountName: names.get(r.accountId) ?? '' }));
	return {
		rows,
		days,
		ranges: RANGES,
		accountId,
		accountFilter: accounts.map((a) => ({ value: a.id, label: a.name }))
	};
};
