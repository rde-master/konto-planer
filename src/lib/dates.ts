// Date helpers for display in Europe/Berlin, independent of the device's time zone.
const TZ = 'Europe/Berlin';

const dayKeyFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, dateStyle: 'short' });
const dayLabelFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: TZ,
	weekday: 'short',
	day: 'numeric',
	month: 'long',
	year: 'numeric'
});
const timeFormat = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, timeStyle: 'short' });
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: TZ,
	dateStyle: 'medium',
	timeStyle: 'medium'
});

/** "2026-11-23" for the Berlin calendar day of the instant. */
export function berlinDay(date: Date): string {
	return dayKeyFormat.format(date);
}

/** "Heute", "Gestern" or e.g. "Mo., 23. November 2026". */
export function dayLabel(date: Date, now = new Date()): string {
	const day = berlinDay(date);
	if (day === berlinDay(now)) return 'Heute';
	if (day === berlinDay(new Date(now.getTime() - 24 * 3600 * 1000))) return 'Gestern';
	return dayLabelFormat.format(date);
}

export function formatTime(date: Date): string {
	return timeFormat.format(date);
}

export function formatDateTime(date: Date): string {
	return dateTimeFormat.format(date);
}

/** Groups items (newest first) by Berlin calendar day, keeping order. */
export function groupByDay<T>(items: T[], at: (item: T) => Date): { day: string; items: T[] }[] {
	const groups: { day: string; items: T[] }[] = [];
	for (const item of items) {
		const day = berlinDay(at(item));
		const last = groups.at(-1);
		if (last?.day === day) last.items.push(item);
		else groups.push({ day, items: [item] });
	}
	return groups;
}
