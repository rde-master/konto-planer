import { describe, expect, it } from 'vitest';
import {
	cancelSoon,
	contractStatus,
	endDateAfterSave,
	noticeDeadline,
	periodLabel,
	reminderDay,
	terminationEnd,
	type Contract
} from './contracts';

const contract = (over: Partial<Contract>): Contract => ({
	termEnd: '2027-03-31',
	noticeEvery: 3,
	noticeUnit: 'month',
	renewal: 'period',
	renewalMonths: 12,
	leadDays: null,
	cancelledOn: null,
	cancelName: null,
	cancelStreet: null,
	cancelPostalCode: null,
	cancelCity: null,
	cancelEmail: null,
	...over
});

describe('noticeDeadline', () => {
	it('subtracts the notice period, clamping to month ends', () => {
		expect(noticeDeadline(contract({}), '2027-03-31')).toBe('2026-12-31');
		expect(noticeDeadline(contract({ noticeEvery: 1 }), '2027-03-31')).toBe('2027-02-28');
		expect(noticeDeadline(contract({ noticeEvery: 14, noticeUnit: 'day' }), '2027-03-31')).toBe(
			'2027-03-17'
		);
		expect(noticeDeadline(contract({ noticeEvery: 2, noticeUnit: 'week' }), '2027-03-31')).toBe(
			'2027-03-17'
		);
		expect(noticeDeadline(contract({ noticeEvery: 0 }), '2027-03-31')).toBe('2027-03-31');
	});
});

describe('terminationEnd', () => {
	it('ends at the term end when cancelled in time', () => {
		expect(terminationEnd(contract({}), '2026-12-31')).toBe('2027-03-31');
	});
	it('renews by the period when the deadline has passed, counted from the term end', () => {
		expect(terminationEnd(contract({}), '2027-01-01')).toBe('2028-03-31');
		expect(
			terminationEnd(contract({ termEnd: '2027-01-31', renewalMonths: 1 }), '2027-01-01')
		).toBe('2027-04-30');
	});
	it('indefinite: after the term the notice runs from the cancellation', () => {
		const c = contract({ renewal: 'indefinite', noticeEvery: 1 });
		expect(terminationEnd(c, '2027-02-28')).toBe('2027-03-31');
		expect(terminationEnd(c, '2027-03-15')).toBe('2027-04-15');
		expect(terminationEnd({ ...c, termEnd: null }, '2027-01-31')).toBe('2027-02-28');
	});
	it('no renewal always ends at the term end', () => {
		expect(terminationEnd(contract({ renewal: 'none' }), '2027-03-20')).toBe('2027-03-31');
	});
});

describe('contractStatus', () => {
	it('fixed term with deadline', () => {
		expect(contractStatus(contract({}), '2026-06-01')).toEqual({
			state: 'fixed',
			end: '2027-03-31',
			deadline: '2026-12-31'
		});
		expect(contractStatus(contract({}), '2027-01-02')).toEqual({
			state: 'fixed',
			end: '2028-03-31',
			deadline: '2027-12-31'
		});
	});
	it('indefinite contracts become cancellable any time after the minimum term', () => {
		const c = contract({ renewal: 'indefinite', noticeEvery: 1 });
		expect(contractStatus(c, '2027-01-10')).toEqual({
			state: 'fixed',
			end: '2027-03-31',
			deadline: '2027-02-28'
		});
		expect(contractStatus(c, '2027-03-10')).toEqual({ state: 'anytime', end: '2027-04-10' });
	});
	it('cancelled and non-renewing contracts', () => {
		expect(contractStatus(contract({ cancelledOn: '2027-01-15' }), '2027-02-01')).toEqual({
			state: 'cancelled',
			end: '2028-03-31'
		});
		expect(contractStatus(contract({ renewal: 'none' }), '2026-01-01')).toEqual({
			state: 'ends',
			end: '2027-03-31'
		});
	});
});

describe('reminders', () => {
	it('start lead days before the deadline; own lead overrides the default', () => {
		expect(reminderDay(contract({}), '2026-06-01', 30)).toBe('2026-12-01');
		expect(reminderDay(contract({ leadDays: 7 }), '2026-06-01', 30)).toBe('2026-12-24');
		expect(cancelSoon(contract({}), '2026-11-30', 30)).toBe(false);
		expect(cancelSoon(contract({}), '2026-12-01', 30)).toBe(true);
		expect(cancelSoon(contract({}), '2026-12-31', 30)).toBe(true);
	});
	it('nothing to remind for cancelled, non-renewing or anytime contracts', () => {
		expect(reminderDay(contract({ cancelledOn: '2026-01-01' }), '2026-06-01', 30)).toBeNull();
		expect(reminderDay(contract({ renewal: 'none' }), '2026-06-01', 30)).toBeNull();
		expect(
			reminderDay(contract({ renewal: 'indefinite', termEnd: null }), '2026-06-01', 30)
		).toBeNull();
	});
});

describe('endDateAfterSave', () => {
	it('a new cancellation sets the computed end', () => {
		expect(endDateAfterSave(null, contract({ cancelledOn: '2026-10-01' }), contract({}))).toBe(
			'2027-03-31'
		);
	});
	it('keeps a hand-edited end once the cancellation is stored', () => {
		const c = contract({ cancelledOn: '2026-10-01' });
		expect(endDateAfterSave('2027-02-28', c, c)).toBe('2027-02-28');
	});
	it('non-renewing contracts end at the term end when the term changes', () => {
		expect(endDateAfterSave(null, contract({ renewal: 'none' }), null)).toBe('2027-03-31');
		const c = contract({ renewal: 'none' });
		expect(endDateAfterSave('2027-01-31', c, c)).toBe('2027-01-31');
	});
	it('leaves the end alone without contract', () => {
		expect(endDateAfterSave('2030-01-01', null, contract({}))).toBe('2030-01-01');
	});
});

describe('periodLabel', () => {
	it('uses singular and plural', () => {
		expect(periodLabel(1, 'month')).toBe('1 Monat');
		expect(periodLabel(3, 'month')).toBe('3 Monate');
		expect(periodLabel(0, 'day')).toBe('ohne Frist');
	});
});
