import { describe, expect, it } from 'vitest';
import { MAX_ATTACHMENT_BYTES, attachmentError, cleanFileName } from './attachment-rules';
import { formatSize } from '../files';

const pdf = new TextEncoder().encode('%PDF-1.7\n');

describe('attachmentError', () => {
	it('accepts PDFs up to 10 MB', () => {
		expect(attachmentError(1000, pdf)).toBeNull();
		expect(attachmentError(MAX_ATTACHMENT_BYTES, pdf)).toBeNull();
	});
	it('rejects empty, too large and non-PDF files', () => {
		expect(attachmentError(0, pdf)).toBe('Bitte eine PDF-Datei wählen.');
		expect(attachmentError(MAX_ATTACHMENT_BYTES + 1, pdf)).toBe('Die Datei ist größer als 10 MB.');
		expect(attachmentError(10, new TextEncoder().encode('<html>'))).toBe(
			'Nur PDF-Dateien sind erlaubt.'
		);
	});
});

describe('cleanFileName', () => {
	it('strips paths and control characters and keeps the extension', () => {
		expect(cleanFileName('C:\\Users\\x\\Vertrag 2026.pdf')).toBe('Vertrag 2026.pdf');
		expect(cleanFileName('../../etc/passwd')).toBe('passwd.pdf');
		expect(cleanFileName('a"b\nc.PDF')).toBe('abc.PDF');
		expect(cleanFileName('')).toBe('Dokument.pdf');
		expect(cleanFileName(`${'x'.repeat(200)}.pdf`)).toHaveLength(120);
	});
});

describe('formatSize', () => {
	it('uses KB and MB', () => {
		expect(formatSize(500)).toBe('1 KB');
		expect(formatSize(850 * 1024)).toBe('850 KB');
		expect(formatSize(1.25 * 1024 * 1024)).toBe('1,3 MB');
	});
});
