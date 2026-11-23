// Client-safe helpers for files.

/** "1,2 MB", "830 KB" */
export function formatSize(bytes: number): string {
	if (bytes >= 1024 * 1024)
		return `${(bytes / 1024 / 1024).toLocaleString('de-DE', { maximumFractionDigits: 1 })} MB`;
	return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
