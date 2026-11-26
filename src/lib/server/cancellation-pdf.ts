import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import type { Letter } from '../cancellation.js';

const MM = 72 / 25.4;
const PAGE = { width: 210 * MM, height: 297 * MM };
const LEFT = 25 * MM;
const RIGHT = 20 * MM;
const WIDTH = PAGE.width - LEFT - RIGHT;

/** Characters the standard font cannot show become "?" (WinAnsi only). */
function safe(font: PDFFont, text: string): string {
	const set = new Set(font.getCharacterSet());
	return [...text].map((c) => (set.has(c.codePointAt(0)!) ? c : '?')).join('');
}

function wrap(font: PDFFont, size: number, text: string, width: number): string[] {
	const out: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/)) {
		const next = line ? `${line} ${word}` : word;
		if (line && font.widthOfTextAtSize(next, size) > width) {
			out.push(line);
			line = word;
		} else line = next;
	}
	if (line) out.push(line);
	return out;
}

/** The letter as A4 PDF (DIN 5008, window envelope). */
export async function renderLetter(letter: Letter): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(letter.subject);
	doc.setProducer('Konto Planer');
	doc.setCreator('Konto Planer');
	const regular = await doc.embedFont(StandardFonts.Helvetica);
	const bold = await doc.embedFont(StandardFonts.HelveticaBold);
	let page = doc.addPage([PAGE.width, PAGE.height]);
	const black = rgb(0, 0, 0);
	const grey = rgb(0.35, 0.35, 0.35);
	// y measured from the top in mm.
	const at = (mm: number) => PAGE.height - mm * MM;
	const text = (s: string, x: number, y: number, size: number, font = regular, color = black) =>
		page.drawText(safe(font, s), { x, y, size, font, color });

	// Sender in the top right corner, return line above the window.
	letter.senderBlock.forEach((l, i) => {
		const w = regular.widthOfTextAtSize(safe(regular, l), 10);
		text(l, PAGE.width - RIGHT - w, at(20 + i * 5), 10);
	});
	text(letter.senderLine, LEFT, at(50), 7, regular, grey);
	letter.recipientBlock.forEach((l, i) => text(l, LEFT, at(60 + i * 5), 11));

	const dw = regular.widthOfTextAtSize(safe(regular, letter.dateLine), 11);
	text(letter.dateLine, PAGE.width - RIGHT - dw, at(98.46), 11);

	let y = at(105);
	const line = 11 * 1.45;
	for (const s of wrap(bold, 12, letter.subject, WIDTH)) {
		text(s, LEFT, y, 12, bold);
		y -= line;
	}
	for (const r of letter.references) {
		text(r, LEFT, y, 11);
		y -= line;
	}
	y -= line;
	const paragraph = (p: string) => {
		for (const s of wrap(regular, 11, safe(regular, p), WIDTH)) {
			if (y < 25 * MM) {
				page = doc.addPage([PAGE.width, PAGE.height]);
				y = at(25);
			}
			text(s, LEFT, y, 11);
			y -= line;
		}
		y -= line * 0.6;
	};
	paragraph(letter.salutation);
	letter.paragraphs.forEach(paragraph);
	paragraph(letter.closing);
	y -= line * 2.5;
	text(letter.signature, LEFT, y, 11);
	return doc.save();
}
