import { describe, expect, it } from 'vitest';
import {
	chosenOption,
	importReply,
	importTarget,
	nothingNewReply,
	previewReply,
	shortcutAmount,
	shortcutFile,
	shortcutOptions,
	shortcutReply
} from './shortcut';

describe('shortcutOptions', () => {
	it('lists templates, then categories with their main category', () => {
		const o = shortcutOptions(
			[
				{
					id: 't1',
					name: 'Bäcker',
					kind: 'expense',
					accountId: null,
					categoryId: 'c2',
					counterparty: 'Bäckerei'
				}
			],
			[
				{ id: 'c2', name: 'Supermarkt', parentName: 'Lebensmittel' },
				{ id: 'c1', name: 'Lebensmittel', parentName: null },
				{ id: 'c3', name: 'Auto', parentName: null }
			]
		);
		expect(o.map((x) => x.label)).toEqual([
			'Vorlage: Bäcker',
			'Auto',
			'Lebensmittel',
			'Lebensmittel › Supermarkt',
			'Ohne Kategorie'
		]);
	});
});

describe('shortcutAmount', () => {
	it('reads numbers and German or decimal-point text', () => {
		expect(shortcutAmount(12.8)).toBe(-1280);
		expect(shortcutAmount('12,80')).toBe(-1280);
		expect(shortcutAmount('12.80')).toBe(-1280);
		expect(shortcutAmount('1.234,56 €')).toBe(-123456);
		expect(shortcutAmount('+50')).toBe(5000);
		expect(shortcutAmount('20', true)).toBe(2000);
	});
	it('rejects nonsense and zero', () => {
		expect(shortcutAmount('abc')).toBeNull();
		expect(shortcutAmount(0)).toBeNull();
		expect(shortcutAmount(null)).toBeNull();
	});
});

describe('shortcutReply', () => {
	it('confirms with budget and available amount', () => {
		expect(
			shortcutReply({
				amount: -1280,
				label: 'Lebensmittel',
				account: 'Giro',
				budget: 'Lebensmittel: noch 87,20 € diesen Monat',
				available: 61200
			}).replace(/\u00a0/g, ' ')
		).toBe(
			'12,80 € Lebensmittel gebucht (Giro) · Lebensmittel: noch 87,20 € diesen Monat · verfügbar 612,00 €'
		);
	});
});

describe('chosenOption', () => {
	const options = shortcutOptions(
		[
			{
				id: 't1',
				name: 'Bäcker',
				kind: 'expense',
				accountId: 'a1',
				categoryId: 'c1',
				counterparty: 'Bäckerei'
			}
		],
		[{ id: 'c1', name: 'Bäckerei', parentName: 'Lebensmittel' }]
	);

	it('finds the chosen entry by its label', () => {
		expect(chosenOption(options, ' Vorlage: Bäcker ')).toMatchObject({ type: 'template' });
		expect(chosenOption(options, 'Lebensmittel › Bäckerei')).toMatchObject({ categoryId: 'c1' });
	});

	it('is "Ohne Kategorie" without a choice: the simple shortcut asks for the amount only', () => {
		for (const none of [undefined, null, '', '  '])
			expect(chosenOption(options, none)).toMatchObject({ type: 'category', categoryId: null });
	});

	it('rejects a choice it does not know', () => {
		expect(chosenOption(options, 'Gibt es nicht')).toBeNull();
		expect(chosenOption(options, 5)).toBeNull();
	});
});

describe('shortcutFile', () => {
	const csv = 'IBAN Auftragskonto;Buchungstag;Betrag\nDE09123456780001234567;12.11.2026;-12,80\n';
	const text = (bytes: Uint8Array | null) => (bytes ? new TextDecoder().decode(bytes) : null);

	it('decodes Base64 byte for byte, with or without line breaks', () => {
		// Windows-1252: "ü" is one byte (0xfc) and must arrive as such.
		const bytes = Uint8Array.from([0x47, 0x72, 0xfc, 0xdf, 0x65, 0x3b, 0x31]);
		const encoded = btoa(String.fromCharCode(...bytes));
		expect(shortcutFile(encoded)).toEqual(bytes);
		expect(shortcutFile(`${encoded.slice(0, 4)}\r\n${encoded.slice(4)}\n`)).toEqual(bytes);
		expect(text(shortcutFile(btoa(csv)))).toBe(csv);
	});

	it('accepts the URL-safe alphabet', () => {
		const bytes = Uint8Array.from([0xfb, 0xff, 0xfe]);
		expect(shortcutFile('-__-')).toEqual(bytes);
	});

	it('takes text with semicolons as the export itself', () => {
		expect(text(shortcutFile(csv))).toBe(csv);
	});

	it('rejects everything else', () => {
		for (const bad of [undefined, null, 5, '', '   ', 'kein base64!', 'abc=def', {}])
			expect(shortcutFile(bad)).toBeNull();
		expect(shortcutFile('A'.repeat(7_500_001))).toBeNull();
	});
});

describe('importTarget', () => {
	const giro = { id: 'g', type: 'giro', iban: 'DE09123456780001234567', archived: false };
	const other = { id: 'o', type: 'giro', iban: 'DE25123456780007654321', archived: false };
	const card = { id: 'k', type: 'kreditkarte', iban: null, archived: false };

	it('is the account with the IBAN of the file, whatever the access books on', () => {
		expect(importTarget([giro.iban, giro.iban], [other, giro, card], 'o')).toEqual({
			accountId: 'g',
			certain: true
		});
	});

	it('does not take archived accounts or savings accounts', () => {
		expect(importTarget([giro.iban], [{ ...giro, archived: true }], null)).toEqual({
			error: 'unknown'
		});
		expect(importTarget([giro.iban], [{ ...giro, type: 'sparbuch' }], null)).toEqual({
			error: 'unknown'
		});
	});

	it('falls back to the card of the access only when the card has no IBAN – and is not certain', () => {
		expect(importTarget([''], [giro, card], 'k')).toEqual({ accountId: 'k', certain: false });
		expect(importTarget(['DE00UNBEKANNT'], [giro, card], 'k')).toEqual({
			accountId: 'k',
			certain: false
		});
		// A giro account never stands in for a file that names another account.
		expect(importTarget([other.iban], [giro, card], 'g')).toEqual({ error: 'unknown' });
		expect(importTarget([''], [giro, card], null)).toEqual({ error: 'unknown' });
	});

	it('refuses a file with several accounts', () => {
		expect(importTarget([giro.iban, other.iban], [giro, other], 'g')).toEqual({ error: 'several' });
	});
});

describe('replies after an import', () => {
	const plain = (s: string) => s.replace(/\u00a0/g, ' ');

	it('names new, replaced and known rows and the balance check', () => {
		expect(
			plain(
				importReply({
					account: 'Girokonto',
					created: 12,
					matched: 3,
					duplicates: 2,
					bankBalance: 123456,
					appBalance: 123456
				})
			)
		).toBe(
			'Girokonto importiert: 12 neu · 3 ersetzt · 2 schon vorhanden · Saldo stimmt: 1.234,56 €'
		);
	});

	it('points out a difference to the bank', () => {
		const reply = plain(
			importReply({
				account: 'Girokonto',
				created: 1,
				matched: 0,
				duplicates: 0,
				bankBalance: 10000,
				appBalance: 9000
			})
		);
		expect(reply).toBe(
			'Girokonto importiert: 1 neu · Saldo weicht ab: Bank 100,00 €, App 90,00 € – bitte in der App prüfen'
		);
	});

	it('leaves the balance out when the file has none', () => {
		expect(
			importReply({
				account: 'Karte',
				created: 4,
				matched: 0,
				duplicates: 0,
				bankBalance: null,
				appBalance: null
			})
		).toBe('Karte importiert: 4 neu');
	});

	it('tells that the file waits for the preview', () => {
		expect(previewReply({ account: 'Girokonto', fresh: 1, duplicates: 0 })).toBe(
			'Girokonto: 1 neue Buchung wartet auf deine Prüfung in der App'
		);
		expect(previewReply({ account: 'Girokonto', fresh: 5, duplicates: 2 })).toBe(
			'Girokonto: 5 neue Buchungen warten auf deine Prüfung in der App · 2 schon vorhanden'
		);
	});

	it('tells that nothing is new', () => {
		expect(nothingNewReply('Girokonto', 1)).toBe(
			'Girokonto: nichts Neues – die Buchung ist schon vorhanden'
		);
		expect(nothingNewReply('Girokonto', 14)).toBe(
			'Girokonto: nichts Neues – alle 14 Buchungen sind schon vorhanden'
		);
	});
});
