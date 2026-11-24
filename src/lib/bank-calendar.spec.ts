import { describe, expect, it } from 'vitest';
import { easterSunday, isBankDay, nextBankDay } from './bank-calendar';

describe('easterSunday', () => {
	it('matches known dates', () => {
		expect(easterSunday(2024)).toBe('2024-03-31');
		expect(easterSunday(2025)).toBe('2025-04-20');
		expect(easterSunday(2026)).toBe('2026-04-05');
		expect(easterSunday(2027)).toBe('2027-03-28');
	});
});

describe('bank days (TARGET)', () => {
	it('weekends and TARGET holidays are closed', () => {
		expect(isBankDay('2026-11-24')).toBe(true); // Tuesday
		expect(isBankDay('2026-11-28')).toBe(false); // Saturday
		expect(isBankDay('2026-04-03')).toBe(false); // Good Friday
		expect(isBankDay('2026-04-06')).toBe(false); // Easter Monday
		expect(isBankDay('2026-05-01')).toBe(false);
		expect(isBankDay('2026-12-25')).toBe(false);
		expect(isBankDay('2026-12-26')).toBe(false);
	});
	it('regional holidays and Christmas Eve are bank days', () => {
		expect(isBankDay('2026-10-03')).toBe(false); // Saturday anyway
		expect(isBankDay('2025-10-03')).toBe(true); // German Unity Day, not TARGET
		expect(isBankDay('2026-12-24')).toBe(true);
		expect(isBankDay('2026-11-01')).toBe(false); // Sunday
	});
	it('shifts to the next bank day', () => {
		expect(nextBankDay('2026-11-24')).toBe('2026-11-24');
		expect(nextBankDay('2026-11-28')).toBe('2026-11-30');
		expect(nextBankDay('2026-04-03')).toBe('2026-04-07'); // Good Friday → after Easter Monday
		expect(nextBankDay('2026-12-25')).toBe('2026-12-28');
		expect(nextBankDay('2027-01-01')).toBe('2027-01-04');
	});
});
