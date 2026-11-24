// CSV import of the bank export (Volksbank, 19 columns, semicolon); see docs/PLAN.md "Import".
import { normalizeIban } from './iban.js';

export type ImportRow = {
	/** Line in the file (1 = header). */
	line: number;
	accountIban: string;
	bookingDate: string;
	valueDate: string | null;
	counterparty: string | null;
	counterpartyIban: string | null;
	bookingText: string | null;
	purpose: string | null;
	/** Signed cents. */
	amount: number;
	balanceAfter: number | null;
	note: string | null;
	bankCategory: string | null;
	creditorId: string | null;
	mandateReference: string | null;
};

export type ParsedFile = {
	encoding: 'UTF-8' | 'Windows-1252';
	dateFormat: string;
	numberFormat: string;
	rows: ImportRow[];
};

export class ImportFormatError extends Error {}

/** Text of the file: UTF-8 (with or without BOM), otherwise Windows-1252 (Excel, older banks). */
export function decode(bytes: Uint8Array): { text: string; encoding: ParsedFile['encoding'] } {
	try {
		const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
		return { text: text.replace(/^\uFEFF/, ''), encoding: 'UTF-8' };
	} catch {
		return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'Windows-1252' };
	}
}

/** Splits CSV text with `;` into records; quotes may contain `;`, line breaks and `""`. */
export function parseCsv(text: string, separator = ';'): string[][] {
	const out: string[][] = [];
	let record: string[] = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else quoted = false;
			} else field += c;
		} else if (c === '"' && field === '') quoted = true;
		else if (c === separator) {
			record.push(field);
			field = '';
		} else if (c === '\n' || c === '\r') {
			if (c === '\r' && text[i + 1] === '\n') i++;
			record.push(field);
			out.push(record);
			record = [];
			field = '';
		} else field += c;
	}
	if (field !== '' || record.length) {
		record.push(field);
		out.push(record);
	}
	return out.filter((r) => r.some((f) => f.trim() !== ''));
}

/** Header names (lower case, letters and digits only) of the columns we read. */
const COLUMNS = {
	accountIban: 'ibanauftragskonto',
	bookingDate: 'buchungstag',
	valueDate: 'valutadatum',
	counterparty: 'namezahlungsbeteiligter',
	counterpartyIban: 'ibanzahlungsbeteiligter',
	bookingText: 'buchungstext',
	purpose: 'verwendungszweck',
	amount: 'betrag',
	currency: 'waehrung',
	balanceAfter: 'saldonachbuchung',
	note: 'bemerkung',
	bankCategory: 'kategorie',
	creditorId: 'glaeubigerid',
	mandateReference: 'mandatsreferenz'
} as const;
const REQUIRED = ['accountIban', 'bookingDate', 'amount'] as const;

function key(name: string): string {
	return name
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]/g, '');
}

const DATE_FORMATS = [
	{ label: 'TT.MM.JJJJ', re: /^(\d{2})\.(\d{2})\.(\d{4})$/, order: [3, 2, 1] },
	{ label: 'JJJJ-MM-TT', re: /^(\d{4})-(\d{2})-(\d{2})$/, order: [1, 2, 3] },
	{ label: 'TT.MM.JJ', re: /^(\d{2})\.(\d{2})\.(\d{2})$/, order: [3, 2, 1] }
] as const;

function toDate(value: string, format: (typeof DATE_FORMATS)[number]): string | null {
	const m = format.re.exec(value.trim());
	if (!m) return null;
	const [yy, mo, d] = format.order.map((i) => m[i] ?? '') as [string, string, string];
	const y = yy.length === 2 ? `20${yy}` : yy;
	const iso = `${y}-${mo}-${d}`;
	const t = new Date(`${iso}T00:00:00Z`);
	return !Number.isNaN(t.getTime()) && t.toISOString().startsWith(iso) ? iso : null;
}

/** "1.234,56" (German) or "1,234.56"/"1234.56" (English) into cents; null if invalid. */
export function parseAmount(value: string, format: 'de' | 'en'): number | null {
	let s = value.replace(/\s|€|EUR/gi, '').replace('−', '-');
	if (!s) return null;
	s = format === 'de' ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
	if (!/^[+-]?\d+(\.\d{1,2})?$/.test(s)) return null;
	const negative = s.startsWith('-');
	const [int, frac = ''] = s.replace(/^[+-]/, '').split('.') as [string, string?];
	const cents = Number(int) * 100 + Number((frac ?? '').padEnd(2, '0'));
	if (!Number.isSafeInteger(cents)) return null;
	return negative ? -cents : cents;
}

function optional(value: string | undefined): string | null {
	const v = (value ?? '').replace(/\s+/g, ' ').trim();
	return v || null;
}

/**
 * Reads the export: finds the columns by their header, detects date and number format and
 * returns one row per booking. Throws ImportFormatError with a German message.
 */
export function parseExport(bytes: Uint8Array): ParsedFile {
	const { text, encoding } = decode(bytes);
	const records = parseCsv(text);
	if (records.length < 2) throw new ImportFormatError('Die Datei enthält keine Buchungen.');
	const header = records[0].map(key);
	const index = Object.fromEntries(
		Object.entries(COLUMNS).map(([field, name]) => [field, header.indexOf(name)])
	) as Record<keyof typeof COLUMNS, number>;
	const missing = REQUIRED.filter((f) => index[f] < 0);
	if (missing.length)
		throw new ImportFormatError(
			'Das ist kein bekannter Bankexport: Es fehlen die Spalten IBAN Auftragskonto, Buchungstag oder Betrag. Erwartet wird eine CSV-Datei mit Semikolon.'
		);
	const body = records.slice(1);
	const cell = (r: string[], f: keyof typeof COLUMNS) => (index[f] >= 0 ? (r[index[f]] ?? '') : '');

	const dates = body.map((r) => cell(r, 'bookingDate').trim()).filter(Boolean);
	const dateFormat = DATE_FORMATS.find((f) => dates.every((d) => toDate(d, f) !== null));
	if (!dateFormat) throw new ImportFormatError('Das Datumsformat der Datei ist unbekannt.');
	const amounts = body.flatMap((r) => [cell(r, 'amount'), cell(r, 'balanceAfter')]).filter(Boolean);
	const numberFormat: 'de' | 'en' =
		amounts.some((a) => /,\d{1,2}$/.test(a.trim())) ||
		amounts.some((a) => /\.\d{3}(,|$)/.test(a.trim()))
			? 'de'
			: 'en';

	const errors: string[] = [];
	const rows: ImportRow[] = [];
	body.forEach((r, i) => {
		const line = i + 2;
		const bookingDate = toDate(cell(r, 'bookingDate'), dateFormat);
		const amount = parseAmount(cell(r, 'amount'), numberFormat);
		const currency = cell(r, 'currency').trim().toUpperCase();
		const balanceText = cell(r, 'balanceAfter').trim();
		const balanceAfter = balanceText ? parseAmount(balanceText, numberFormat) : null;
		if (!bookingDate) errors.push(`Zeile ${line}: Buchungstag fehlt oder ist ungültig.`);
		if (amount === null) errors.push(`Zeile ${line}: Betrag ist ungültig.`);
		if (currency && currency !== 'EUR') errors.push(`Zeile ${line}: nur Euro wird unterstützt.`);
		if (balanceText && balanceAfter === null)
			errors.push(`Zeile ${line}: Saldo nach Buchung ist ungültig.`);
		if (!bookingDate || amount === null) return;
		const iban = optional(cell(r, 'counterpartyIban'));
		rows.push({
			line,
			accountIban: normalizeIban(cell(r, 'accountIban')),
			bookingDate,
			valueDate: toDate(cell(r, 'valueDate'), dateFormat),
			counterparty: optional(cell(r, 'counterparty')),
			counterpartyIban: iban ? normalizeIban(iban) : null,
			bookingText: optional(cell(r, 'bookingText')),
			purpose: optional(cell(r, 'purpose')),
			amount,
			balanceAfter,
			note: optional(cell(r, 'note')),
			bankCategory: optional(cell(r, 'bankCategory')),
			creditorId: optional(cell(r, 'creditorId')),
			mandateReference: optional(cell(r, 'mandateReference'))
		});
	});
	if (errors.length)
		throw new ImportFormatError(
			errors.slice(0, 5).join(' ') +
				(errors.length > 5 ? ` (und ${errors.length - 5} weitere)` : '')
		);
	return {
		encoding,
		dateFormat: dateFormat.label,
		numberFormat: numberFormat === 'de' ? '1.234,56' : '1,234.56',
		rows
	};
}

/** Text the duplicate check hashes: booking day, amount, counterparty IBAN, purpose, balance. */
export function checksumText(
	r: Pick<ImportRow, 'bookingDate' | 'amount' | 'counterpartyIban' | 'purpose' | 'balanceAfter'>
): string {
	return [
		r.bookingDate,
		r.amount,
		r.counterpartyIban ?? '',
		r.purpose ?? '',
		r.balanceAfter ?? ''
	].join('|');
}

export type RowStatus = 'new' | 'duplicate' | 'match';

export type MatchCandidate = {
	id: string;
	date: string;
	amount: number;
	source: 'manual' | 'provisional';
	label: string;
};

export type PreviewRow = ImportRow & {
	checksum: string;
	status: RowStatus;
	/** Booking replaced by this row (status "match"). */
	match: MatchCandidate | null;
};

function dayDiff(a: string, b: string): number {
	return Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
}

/**
 * Status of every row: rows whose checksum is already stored (or appeared earlier in the file)
 * are duplicates; a new row with the same amount as a manual or provisional booking up to three
 * days apart replaces it (closest date first, each booking once).
 */
export function previewRows(
	rows: (ImportRow & { checksum: string })[],
	known: Set<string>,
	candidates: MatchCandidate[]
): PreviewRow[] {
	const seen = new Set(known);
	const free = [...candidates];
	const ordered = [...rows].sort(
		(a, b) => a.bookingDate.localeCompare(b.bookingDate) || a.line - b.line
	);
	const result = new Map<number, PreviewRow>();
	for (const r of ordered) {
		if (seen.has(r.checksum)) {
			result.set(r.line, { ...r, status: 'duplicate', match: null });
			continue;
		}
		seen.add(r.checksum);
		const best = free
			.filter((c) => c.amount === r.amount && dayDiff(c.date, r.bookingDate) <= 3)
			.sort(
				(a, b) =>
					dayDiff(a.date, r.bookingDate) - dayDiff(b.date, r.bookingDate) ||
					Number(a.source === 'manual') - Number(b.source === 'manual')
			)[0];
		if (best) free.splice(free.indexOf(best), 1);
		result.set(r.line, { ...r, status: best ? 'match' : 'new', match: best ?? null });
	}
	return rows.map((r) => result.get(r.line)!);
}

/**
 * Row whose "Saldo nach Buchung" is the latest balance: the newest booking day; within that day
 * the first row if the file is sorted newest first, otherwise the last.
 */
export function latestBalanceRow(rows: ImportRow[]): ImportRow | null {
	const withBalance = rows.filter((r) => r.balanceAfter !== null);
	if (!withBalance.length) return null;
	const descending = rows[0].bookingDate > rows.at(-1)!.bookingDate;
	const newest = withBalance.reduce((m, r) => (r.bookingDate > m ? r.bookingDate : m), '');
	const sameDay = withBalance.filter((r) => r.bookingDate === newest);
	return descending ? sameDay[0] : sameDay.at(-1)!;
}
