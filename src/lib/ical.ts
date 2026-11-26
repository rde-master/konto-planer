// iCalendar (RFC 5545) for the calendar subscription: all-day events, optional reminder.
import { addDays } from './recurring.js';

export const CALENDAR_KINDS = ['payments', 'deadlines', 'cards', 'goals'] as const;
export type CalendarKind = (typeof CALENDAR_KINDS)[number];

export const CALENDAR_KIND_LABELS: Record<CalendarKind, string> = {
	payments: 'Fälligkeiten der Dauerposten',
	deadlines: 'Kündigungsfristen',
	cards: 'Kreditkarten-Abbuchungen',
	goals: 'Sparziel-Termine'
};

export type CalendarEvent = {
	uid: string;
	date: string;
	title: string;
	description?: string;
	/** Reminder this many days before (at 9 o'clock). */
	alarmDays?: number;
};

function escapeText(s: string): string {
	return s
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\r?\n/g, '\\n');
}

/** Lines longer than 75 octets are folded (continuation starts with a space). */
export function fold(line: string): string {
	const bytes = new TextEncoder();
	const out: string[] = [];
	let current = '';
	for (const ch of line) {
		const limit = out.length ? 74 : 75;
		if (bytes.encode(current + ch).length > limit) {
			out.push(current);
			current = ch;
		} else current += ch;
	}
	out.push(current);
	return out.join('\r\n ');
}

/** Relative to the start of the all-day event (midnight): N days before, at 9 o'clock. */
export function alarmTrigger(days: number): string {
	return days <= 0 ? 'PT9H' : `-P${days - 1}DT15H`;
}

const compact = (day: string) => day.replace(/-/g, '');

export function buildIcs(name: string, events: CalendarEvent[], stamp: Date): string {
	const dtstamp = stamp
		.toISOString()
		.replace(/[-:]/g, '')
		.replace(/\.\d{3}/, '');
	const lines = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Konto Planer//Kalender//DE',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeText(name)}`,
		'X-WR-TIMEZONE:Europe/Berlin',
		'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
		'X-PUBLISHED-TTL:PT6H'
	];
	for (const e of events) {
		lines.push(
			'BEGIN:VEVENT',
			`UID:${e.uid}@konto-planer`,
			`DTSTAMP:${dtstamp}`,
			`DTSTART;VALUE=DATE:${compact(e.date)}`,
			`DTEND;VALUE=DATE:${compact(addDays(e.date, 1))}`,
			`SUMMARY:${escapeText(e.title)}`,
			'TRANSP:TRANSPARENT'
		);
		if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
		if (e.alarmDays !== undefined)
			lines.push(
				'BEGIN:VALARM',
				'ACTION:DISPLAY',
				`DESCRIPTION:${escapeText(e.title)}`,
				`TRIGGER:${alarmTrigger(e.alarmDays)}`,
				'END:VALARM'
			);
		lines.push('END:VEVENT');
	}
	lines.push('END:VCALENDAR');
	return lines.map(fold).join('\r\n') + '\r\n';
}
