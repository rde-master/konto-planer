import { BookingError, adjustBalance, balanceOf, countBookings } from '#lib/server/bookings.js';
import { validateAdjustment } from '#lib/server/booking-rules.js';
import { todayBerlin } from '#lib/dates.js';
import {
	InterestError,
	addRate,
	deleteRate,
	interestInfo,
	setRhythm
} from '#lib/server/interest.js';
import { INTEREST_RHYTHMS, parseRate } from '#lib/interest.js';
import { isValidDate } from '#lib/server/recurring-rules.js';
import { listGoalsFor } from '#lib/server/goals.js';
import { forecastFor } from '#lib/server/forecast.js';
import {
	CutoffError,
	cutoffCandidates,
	plansFor,
	setCutoff,
	validateCutoff
} from '#lib/server/minimum.js';
import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '#lib/server/guards.js';
import {
	AccountError,
	accountHasData,
	listAccountsFor,
	deleteAccount,
	getAccountFor,
	listAccess,
	setAccess,
	setArchived,
	updateAccount
} from '#lib/server/accounts.js';
import { ACCESS_LEVELS, validateAccount, type AccessLevel } from '#lib/server/account-rules.js';
import { readAccountForm } from '#lib/server/account-form.js';
import { fieldError, formString } from '#lib/server/validation.js';
import { nextSettlements } from '#lib/server/credit-cards.js';
import { balanceDates } from '#lib/server/import-reminder.js';
import { accountMonths } from '#lib/server/account-months.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = locals.user!;
	const account = await getAccountFor(user, params.id);
	if (!account) error(404, 'Konto nicht gefunden.');
	const isAdmin = user.role === 'admin';
	const balance = await balanceOf(account);
	const goals =
		account.type === 'sparbuch' ? await listGoalsFor(user, { accountId: account.id }) : null;
	const forecast = account.archivedAt ? null : await forecastFor(user, account, balance);
	const isCard = account.type === 'kreditkarte';
	const visible = isCard ? await listAccountsFor(user) : [];
	const card = isCard
		? {
				settlements: account.archivedAt ? [] : await nextSettlements(account.id),
				giroName: visible.find((a) => a.id === account.settlementAccountId)?.name ?? null,
				giroAccounts: visible
					.filter(
						(a) => a.type === 'giro' && (!a.archivedAt || a.id === account.settlementAccountId)
					)
					.map((a) => ({ value: a.id, label: a.name }))
			}
		: null;
	const asOf = (await balanceDates([account])).get(account.id) ?? null;
	return {
		asOf,
		card,
		forecast,
		goals,
		account,
		isAdmin,
		access: isAdmin ? await listAccess(account.id) : [],
		hasData: isAdmin ? await accountHasData(account.id) : true,
		bookingCount: await countBookings(account.id),
		/** What came in and went out in each of the last twelve months. */
		months: await accountMonths(account),
		balance,
		interest:
			account.type === 'sparbuch' && !account.archivedAt ? await interestInfo(user, account) : null,
		plan:
			(await plansFor(user, [account], new Map([[account.id, balance]]))).get(account.id) ?? null,
		today: todayBerlin()
	};
};

function accountError(action: string, e: unknown) {
	if (e instanceof AccountError) return fail(400, { action, message: e.message });
	throw e;
}

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const user = locals.user!;
		const account = await getAccountFor(user, params.id);
		if (!account) error(404, 'Konto nicht gefunden.');
		const input = readAccountForm(await request.formData(), account.type);
		const { values, errors } = validateAccount(input);
		if (!values) return fail(400, { action: 'update' as const, input, errors });
		try {
			await updateAccount(user, params.id, values);
		} catch (e) {
			if (e instanceof AccountError && e.message.includes('IBAN')) {
				return fail(400, {
					action: 'update' as const,
					input,
					errors: fieldError('iban', e.message)
				});
			}
			return accountError('update', e);
		}
		return { action: 'update' as const, success: true };
	},

	/** "Kontostand korrigieren": the difference is booked as an adjustment. */
	adjust: async ({ request, locals, params }) => {
		const user = locals.user!;
		const account = await getAccountFor(user, params.id);
		if (!account) error(404, 'Konto nicht gefunden.');
		const data = await request.formData();
		const input = { actual: formString(data, 'actual'), date: formString(data, 'date') };
		const { values, errors } = validateAdjustment(input, {
			today: todayBerlin(),
			openingDate: account.openingDate
		});
		if (!values) return fail(400, { action: 'adjust' as const, input, errors });
		try {
			const amount = await adjustBalance(user, account.id, values);
			return { action: 'adjust' as const, success: true, amount };
		} catch (e) {
			if (e instanceof BookingError)
				return fail(400, {
					action: 'adjust' as const,
					input,
					errors: fieldError('actual', e.message)
				});
			throw e;
		}
	},

	/** Cut-off day of the minimum balance ("Stichtag"). */
	cutoff: async ({ request, locals, params }) => {
		const user = locals.user!;
		const account = await getAccountFor(user, params.id);
		if (!account) error(404, 'Konto nicht gefunden.');
		const data = await request.formData();
		const input = {
			mode: formString(data, 'mode'),
			recurringId: formString(data, 'recurringId'),
			date: formString(data, 'date')
		};
		const candidates = await cutoffCandidates(user, account.id);
		const { values, errors } = validateCutoff(input, {
			candidateIds: new Set(candidates.map((c) => c.id)),
			today: todayBerlin()
		});
		if (!values) return fail(400, { action: 'cutoff' as const, input, errors });
		try {
			await setCutoff(user, account.id, values);
		} catch (e) {
			if (e instanceof CutoffError)
				return fail(400, {
					action: 'cutoff' as const,
					input,
					errors: fieldError('mode', e.message)
				});
			throw e;
		}
		return { action: 'cutoff' as const, success: true };
	},

	/** Savings: a new interest rate valid from a day. */
	rate: async ({ request, locals, params }) => {
		const data = await request.formData();
		const input = { rate: formString(data, 'rate'), validFrom: formString(data, 'validFrom') };
		const rate = parseRate(input.rate);
		const errors: Record<string, string> = {};
		if (rate === null) errors.rate = 'Bitte einen Zinssatz wie 2,75 eingeben.';
		if (!isValidDate(input.validFrom)) errors.validFrom = 'Bitte ein Datum wählen.';
		if (rate === null || Object.keys(errors).length)
			return fail(400, { action: 'rate' as const, input, errors });
		try {
			await addRate(locals.user!, params.id, { rate, validFrom: input.validFrom });
		} catch (e) {
			if (e instanceof InterestError)
				return fail(400, {
					action: 'rate' as const,
					input,
					errors: { validFrom: e.message }
				});
			throw e;
		}
		return { action: 'rate' as const, success: true };
	},

	rateDelete: async ({ request, locals, params }) => {
		try {
			await deleteRate(locals.user!, params.id, formString(await request.formData(), 'rateId'));
		} catch (e) {
			if (e instanceof InterestError)
				return fail(400, { action: 'rateDelete' as const, message: e.message });
			throw e;
		}
		return { action: 'rateDelete' as const, success: true };
	},

	rhythm: async ({ request, locals, params }) => {
		const value = formString(await request.formData(), 'interestRhythm');
		const rhythm = INTEREST_RHYTHMS.find((r) => r === value);
		if (!rhythm)
			return fail(400, { action: 'rhythm' as const, message: 'Bitte einen Rhythmus wählen.' });
		try {
			await setRhythm(locals.user!, params.id, rhythm);
		} catch (e) {
			if (e instanceof InterestError)
				return fail(400, { action: 'rhythm' as const, message: e.message });
			throw e;
		}
		return { action: 'rhythm' as const, success: true };
	},

	access: async ({ request, locals, params }) => {
		const actor = requireAdmin(locals.user);
		const data = await request.formData();
		const wanted: Record<string, AccessLevel | null> = {};
		for (const [key, value] of data) {
			if (!key.startsWith('access:') || typeof value !== 'string') continue;
			wanted[key.slice('access:'.length)] = ACCESS_LEVELS.find((l) => l === value) ?? null;
		}
		try {
			await setAccess(actor, params.id, wanted);
		} catch (e) {
			return accountError('access', e);
		}
		return { action: 'access' as const, success: true };
	},

	archive: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await setArchived(actor, params.id, true);
		} catch (e) {
			return accountError('archive', e);
		}
		return { action: 'archive' as const, success: true };
	},

	restore: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await setArchived(actor, params.id, false);
		} catch (e) {
			return accountError('restore', e);
		}
		return { action: 'restore' as const, success: true };
	},

	delete: async ({ locals, params }) => {
		const actor = requireAdmin(locals.user);
		try {
			await deleteAccount(actor, params.id);
		} catch (e) {
			return accountError('delete', e);
		}
		redirect(303, '/konten');
	}
};
