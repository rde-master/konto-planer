import { describe, expect, it } from 'vitest';
import { payeeCore, payeeLabel, samePayee } from './payee-name';

describe('payeeLabel', () => {
	it('drops dates and times', () => {
		expect(payeeLabel('NETFLIX.COM 24.11.')).toBe('NETFLIX.COM');
		expect(payeeLabel('NETFLIX.COM 24.11.2026')).toBe('NETFLIX.COM');
		expect(payeeLabel('Spotify AB 01.12.26 14:32')).toBe('Spotify AB');
		expect(payeeLabel('Streamingdienst 2026-11-24')).toBe('Streamingdienst');
		expect(payeeLabel('Fitness Beispiel 11/2026')).toBe('Fitness Beispiel');
		expect(payeeLabel('Kino Muster 24. Nov 2026')).toBe('Kino Muster');
		expect(payeeLabel('24.11. Tankstelle Muster')).toBe('Tankstelle Muster');
	});
	it('drops numbers and reference codes', () => {
		expect(payeeLabel('AMZN Mktp DE*2X4Y67890')).toBe('AMZN Mktp DE');
		expect(payeeLabel('REWE Markt 4711')).toBe('REWE Markt');
		expect(payeeLabel('PAYPAL *NETFLIX')).toBe('PAYPAL NETFLIX');
		expect(payeeLabel('Parkhaus 12 - 24.11.')).toBe('Parkhaus');
	});
	it('keeps names with digits', () => {
		expect(payeeLabel('1&1 Telecom GmbH')).toBe('1&1 Telecom GmbH');
		expect(payeeLabel('O2 Germany')).toBe('O2 Germany');
	});
	it('keeps the name when nothing else is left', () => {
		expect(payeeLabel('4711')).toBe('4711');
		expect(payeeLabel('  ')).toBe('');
		expect(payeeLabel(null)).toBe('');
	});
});

describe('payeeCore', () => {
	it('is the same for every month', () => {
		expect(payeeCore('NETFLIX.COM 24.11.')).toBe(payeeCore('Netflix.com  24.12.2026'));
		expect(payeeCore('Stadtwerke Musterstadt')).toBe('stadtwerke musterstadt');
	});
});

describe('samePayee', () => {
	it('ignores case, spaces, dates and numbers', () => {
		expect(samePayee('Netflix', 'NETFLIX.COM 24.11.')).toBe(true);
		expect(samePayee('Stadt Werke', 'STADTWERKE Musterstadt GmbH')).toBe(true);
		expect(samePayee('REWE Markt 4711', 'Rewe Markt 0815')).toBe(true);
	});
	it('needs a name on both sides and more than two letters to be part of another', () => {
		expect(samePayee(null, 'x')).toBe(false);
		expect(samePayee('', '')).toBe(false);
		expect(samePayee('AB', 'Abfallbetrieb')).toBe(false);
		expect(samePayee('AB', 'ab')).toBe(true);
		expect(samePayee('Netflix', 'Spotify')).toBe(false);
	});
});
