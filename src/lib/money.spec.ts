import { describe, expect, it } from 'vitest';
import { formatEuro, formatEuroInput, parseEuro } from './money';

describe('parseEuro', () => {
	it.each([
		['1.234,56', 123456],
		['1234,56', 123456],
		['1234,5', 123450],
		['0,01', 1],
		[',50', null],
		['12', 1200],
		['1.234', 123400],
		['12.5', 1250],
		['12.50', 1250],
		['1.234.567,89', 123456789],
		['-12,34', -1234],
		['−12,34', -1234],
		['+5', 500],
		['  1 234,00 € ', 123400],
		['0', 0],
		['-0', 0]
	])('%s -> %s', (input, cents) => {
		expect(parseEuro(input)).toBe(cents);
	});

	it.each(['', 'abc', '1,2,3', '12,345', '1.23.4', '1,23.4', '12.345,6.7', '--5', '1e5', '1.2345'])(
		'rejects %s',
		(input) => {
			expect(parseEuro(input)).toBeNull();
		}
	);

	it('rejects absurdly large amounts', () => {
		expect(parseEuro('9.999.999.999.999,00')).toBeNull();
	});
});

describe('formatEuro', () => {
	it('formats German style with typographic minus', () => {
		expect(formatEuro(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
		expect(formatEuro(-1234).replace(/\s/g, ' ')).toBe('−12,34 €');
		expect(formatEuro(0).replace(/\s/g, ' ')).toBe('0,00 €');
	});

	it('formats input values that parse back to the same cents', () => {
		for (const cents of [0, 1, 99, 123456, -50, 100000000]) {
			expect(parseEuro(formatEuroInput(cents))).toBe(cents);
		}
	});
});
