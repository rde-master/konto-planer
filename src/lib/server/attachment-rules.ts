/** Largest accepted attachment. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * Checks an uploaded attachment: PDF only (by content, not by name) and at most 10 MB.
 * Returns an error message or null.
 */
export function attachmentError(size: number, head: Uint8Array): string | null {
	if (size === 0) return 'Bitte eine PDF-Datei wählen.';
	if (size > MAX_ATTACHMENT_BYTES) return 'Die Datei ist größer als 10 MB.';
	const magic = new TextDecoder('latin1').decode(head.subarray(0, 5));
	if (magic !== '%PDF-') return 'Nur PDF-Dateien sind erlaubt.';
	return null;
}

/** Display name: no path, no control characters, at most 120 characters, ends in ".pdf". */
export function cleanFileName(raw: string): string {
	const base = raw.split(/[\\/]/).pop() ?? '';
	// eslint-disable-next-line no-control-regex
	let name = base.replace(/[\u0000-\u001f\u007f"]/g, '').trim();
	if (!/\.pdf$/i.test(name)) name = `${name || 'Dokument'}.pdf`;
	if (name.length > 120) name = `${name.slice(0, 116)}.pdf`;
	return name;
}
