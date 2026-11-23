import { describe, expect, it } from 'vitest';
import { formatIban, isValidIban, normalizeIban, shortIban } from './iban';

describe('IBAN', () => {
	it('accepts valid IBANs in any spacing and case', () => {
		expect(isValidIban('DE89 3704 0044 0532 0130 00')).toBe(true);
		expect(isValidIban('de89370400440532013000')).toBe(true);
		expect(isValidIban('AT611904300234573201')).toBe(true);
		expect(isValidIban('GB82WEST12345698765432')).toBe(true);
	});

	it('rejects wrong checksums, lengths and garbage', () => {
		expect(isValidIban('DE89 3704 0044 0532 0130 01')).toBe(false);
		expect(isValidIban('DE89 3704 0044 0532 0130')).toBe(false);
		expect(isValidIban('12345')).toBe(false);
		expect(isValidIban('')).toBe(false);
	});

	it('formats for display', () => {
		expect(normalizeIban(' de89 3704 ')).toBe('DE893704');
		expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00');
		expect(shortIban('DE89370400440532013000')).toBe('•• 3000');
	});
});
