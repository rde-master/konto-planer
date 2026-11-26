// Cancellation letter ("Kündigungsschreiben"): the text of the letter, independent of the PDF.
import { formatDay } from './dates.js';
import { formatIban } from './iban.js';

export type PostalAddress = { name: string; street: string; postalCode: string; city: string };

export const LETTER_OPTIONS = ['confirmation', 'debit', 'noContact'] as const;
export type LetterOption = (typeof LETTER_OPTIONS)[number];

export const LETTER_OPTION_LABELS: Record<LetterOption, string> = {
	confirmation: 'Schriftliche Bestätigung erbitten',
	debit: 'Lastschrift-Mandat zum Vertragsende widerrufen',
	noContact: 'Keine Rückgewinnung, Daten nach Vertragsende löschen'
};

export type LetterInput = {
	sender: PostalAddress;
	recipient: PostalAddress;
	/** Place for the date line ("Musterstadt, 26.11.2026"); empty = sender's city. */
	place: string;
	today: string;
	contractName: string;
	customerNumber: string | null;
	mandateReference: string | null;
	iban: string | null;
	/** Earliest end date if cancelled today. */
	end: string | null;
	options: Set<LetterOption>;
};

export type Letter = {
	senderLine: string;
	senderBlock: string[];
	recipientBlock: string[];
	dateLine: string;
	subject: string;
	references: string[];
	salutation: string;
	paragraphs: string[];
	closing: string;
	signature: string;
	fileName: string;
};

const lines = (a: PostalAddress) =>
	[a.name, a.street, `${a.postalCode} ${a.city}`.trim()].map((s) => s.trim()).filter(Boolean);

export function cancellationLetter(i: LetterInput): Letter {
	const end = i.end ? ` Laut meinen Unterlagen ist das der ${formatDay(i.end)}.` : '';
	const paragraphs = [
		`hiermit kündige ich den oben genannten Vertrag ordentlich und fristgerecht zum nächstmöglichen Zeitpunkt.${end}`
	];
	if (i.options.has('confirmation'))
		paragraphs.push(
			'Bitte bestätigen Sie mir den Eingang dieser Kündigung und das Datum der Vertragsbeendigung schriftlich.'
		);
	if (i.options.has('debit'))
		paragraphs.push(
			`Zum Vertragsende widerrufe ich die erteilte Einzugsermächtigung bzw. das SEPA-Lastschriftmandat${i.mandateReference ? ` (Mandatsreferenz ${i.mandateReference})` : ''}${i.iban ? ` für das Konto ${formatIban(i.iban)}` : ''}.`
		);
	if (i.options.has('noContact'))
		paragraphs.push(
			'Einer Kontaktaufnahme zur Rückgewinnung oder zu Werbezwecken widerspreche ich. Bitte löschen Sie meine personenbezogenen Daten nach Vertragsende, soweit keine gesetzlichen Aufbewahrungspflichten entgegenstehen.'
		);
	const place = i.place.trim() || i.sender.city.trim();
	const safe = i.contractName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
	return {
		senderLine: lines(i.sender).join(' · '),
		senderBlock: lines(i.sender),
		recipientBlock: lines(i.recipient),
		dateLine: `${place ? `${place}, ` : ''}${formatDay(i.today)}`,
		subject: `Kündigung: ${i.contractName}`,
		references: [i.customerNumber ? `Kundennummer: ${i.customerNumber}` : null].filter(
			(s): s is string => s !== null
		),
		salutation: 'Sehr geehrte Damen und Herren,',
		paragraphs,
		closing: 'Mit freundlichen Grüßen',
		signature: i.sender.name,
		fileName: `Kuendigung-${safe || 'Vertrag'}-${i.today}.pdf`
	};
}
