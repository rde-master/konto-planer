import { describe, expect, it } from 'vitest';
import { cancellationLetter, type LetterInput } from './cancellation';

const input: LetterInput = {
	sender: { name: 'Erika Muster', street: 'Musterweg 1', postalCode: '12345', city: 'Musterstadt' },
	recipient: {
		name: 'Fitness Beispiel GmbH',
		street: 'Hauptstr. 5',
		postalCode: '54321',
		city: 'Beispielhausen'
	},
	place: '',
	today: '2026-11-26',
	contractName: 'Fitnessstudio Beispiel',
	customerNumber: 'K-4711',
	mandateReference: 'MREF-1',
	iban: 'DE89370400440532013000',
	end: '2027-03-31',
	options: new Set(['confirmation', 'debit', 'noContact'])
};

describe('cancellationLetter', () => {
	it('builds all parts of the letter', () => {
		const l = cancellationLetter(input);
		expect(l.senderLine).toBe('Erika Muster · Musterweg 1 · 12345 Musterstadt');
		expect(l.recipientBlock).toEqual([
			'Fitness Beispiel GmbH',
			'Hauptstr. 5',
			'54321 Beispielhausen'
		]);
		expect(l.dateLine).toBe('Musterstadt, 26.11.2026');
		expect(l.subject).toBe('Kündigung: Fitnessstudio Beispiel');
		expect(l.references).toEqual(['Kundennummer: K-4711']);
		expect(l.paragraphs[0]).toContain(
			'zum nächstmöglichen Zeitpunkt. Laut meinen Unterlagen ist das der 31.03.2027.'
		);
		expect(l.paragraphs[2]).toContain(
			'(Mandatsreferenz MREF-1) für das Konto DE89 3704 0044 0532 0130 00'
		);
		expect(l.paragraphs).toHaveLength(4);
		expect(l.fileName).toBe('Kuendigung-Fitnessstudio-Beispiel-2026-11-26.pdf');
	});
	it('leaves out what is not chosen or unknown', () => {
		const l = cancellationLetter({
			...input,
			options: new Set(),
			end: null,
			customerNumber: null,
			place: 'Berlin'
		});
		expect(l.paragraphs).toHaveLength(1);
		expect(l.paragraphs[0]).not.toContain('Unterlagen');
		expect(l.references).toEqual([]);
		expect(l.dateLine).toBe('Berlin, 26.11.2026');
	});
});
