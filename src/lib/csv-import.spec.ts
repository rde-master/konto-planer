import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	ImportFormatError,
	checksumText,
	decode,
	latestBalanceRow,
	parseAmount,
	parseCsv,
	parseExport,
	previewRows,
	type ImportRow
} from './csv-import';

const fixture = new Uint8Array(readFileSync('tests/fixtures/volksbank-beispiel.csv'));
const utf8 = (s: string) => new TextEncoder().encode(s);

describe('decode and parseCsv', () => {
	it('detects Windows-1252 and UTF-8 with BOM', () => {
		expect(decode(fixture).encoding).toBe('Windows-1252');
		expect(decode(fixture).text).toContain('Café Übersee');
		expect(decode(utf8('﻿ä;b'))).toEqual({ text: 'ä;b', encoding: 'UTF-8' });
	});
	it('handles quotes, separators and line breaks inside quotes', () => {
		expect(parseCsv('a;"b;c";"d ""e"""\r\n"x\ny";z\n\n')).toEqual([
			['a', 'b;c', 'd "e"'],
			['x\ny', 'z']
		]);
	});
});

describe('parseAmount', () => {
	it('reads German and English numbers', () => {
		expect(parseAmount('-1.234,56', 'de')).toBe(-123456);
		expect(parseAmount('2.500,00', 'de')).toBe(250000);
		expect(parseAmount('12,8', 'de')).toBe(1280);
		expect(parseAmount('-1,234.56', 'en')).toBe(-123456);
		expect(parseAmount('abc', 'de')).toBeNull();
	});
});

describe('parseExport', () => {
	it('reads the fictional Volksbank export', () => {
		const file = parseExport(fixture);
		expect(file.encoding).toBe('Windows-1252');
		expect(file.dateFormat).toBe('TT.MM.JJJJ');
		expect(file.numberFormat).toBe('1.234,56');
		expect(file.rows).toHaveLength(11);
		const strom = file.rows.find((r) => r.mandateReference === 'MR-STROM-0815')!;
		expect(strom).toMatchObject({
			accountIban: 'DE09123456780001234567',
			amount: -6400,
			creditorId: 'DE98ZZZ09999999999',
			bookingText: 'Lastschrift',
			bankCategory: 'Wohnen'
		});
		expect(file.rows.find((r) => r.purpose === 'Einkauf; Lebensmittel')?.amount).toBe(-4567);
	});

	it('rejects files that are not a bank export', () => {
		expect(() => parseExport(utf8('Datum;Wert\n01.01.2026;1'))).toThrow(ImportFormatError);
		expect(() =>
			parseExport(utf8('IBAN Auftragskonto;Buchungstag;Betrag;Waehrung\nDE1;32.13.2026;1,00;EUR'))
		).toThrow('Das Datumsformat der Datei ist unbekannt.');
		expect(() =>
			parseExport(utf8('IBAN Auftragskonto;Buchungstag;Betrag;Waehrung\nDE1;01.01.2026;1,00;USD'))
		).toThrow('Zeile 2: nur Euro wird unterstützt.');
	});

	it('reads ISO dates and English numbers', () => {
		const file = parseExport(
			utf8('IBAN Auftragskonto;Buchungstag;Betrag\nDE09 1234;2026-01-31;-1234.5\n')
		);
		expect(file.dateFormat).toBe('JJJJ-MM-TT');
		expect(file.rows[0]).toMatchObject({ bookingDate: '2026-01-31', amount: -123450 });
	});
});

describe('previewRows', () => {
	const rows = parseExport(fixture).rows.map((r) => ({ ...r, checksum: checksumText(r) }));

	it('marks duplicates within the file and already stored rows', () => {
		const preview = previewRows(
			rows,
			new Set([checksumText(rows.find((r) => r.amount === 250000)!)]),
			[]
		);
		expect(preview.filter((r) => r.status === 'duplicate')).toHaveLength(2);
		expect(preview.filter((r) => r.status === 'new')).toHaveLength(9);
	});

	it('replaces a manual or provisional booking with the same amount up to three days apart', () => {
		const preview = previewRows(rows, new Set(), [
			{ id: 'p1', date: '2026-11-02', amount: -6400, source: 'provisional', label: 'Strom' },
			{ id: 'm1', date: '2026-11-20', amount: -1280, source: 'manual', label: 'Café' }
		]);
		const strom = preview.filter((r) => r.amount === -6400);
		expect(strom.map((r) => r.status)).toEqual(['match', 'new']);
		expect(strom[0].match?.id).toBe('p1');
		// 12.11. is 8 days before 20.11.: no match.
		expect(preview.find((r) => r.amount === -1280 && r.status !== 'duplicate')?.status).toBe('new');
	});
});

describe('latestBalanceRow', () => {
	it('takes the newest booking day; newest-first files use the first row of that day', () => {
		const file = parseExport(fixture);
		expect(latestBalanceRow(file.rows)?.balanceAfter).toBe(372353);
		const asc: ImportRow[] = [...file.rows].reverse();
		expect(latestBalanceRow(asc)?.balanceAfter).toBe(372353);
	});
});
