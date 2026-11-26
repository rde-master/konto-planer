import { describe, expect, it } from 'vitest';
import { alarmTrigger, buildIcs, fold } from './ical';

describe('buildIcs', () => {
	const ics = buildIcs(
		'Konto Planer',
		[
			{
				uid: 'p1',
				date: '2026-12-01',
				title: 'Miete −850,00 €',
				description: 'Konto: Giro; Notiz'
			},
			{ uid: 'd1', date: '2027-01-31', title: 'Kündigen bis: Fitness', alarmDays: 14 }
		],
		new Date('2026-11-26T08:00:00Z')
	);
	it('has all-day events with escaped text and CRLF', () => {
		expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
		expect(ics).toContain('DTSTART;VALUE=DATE:20261201\r\nDTEND;VALUE=DATE:20261202');
		expect(ics).toContain('SUMMARY:Miete −850\\,00 €');
		expect(ics).toContain('DESCRIPTION:Konto: Giro\\; Notiz');
		expect(ics).toContain('DTSTAMP:20261126T080000Z');
		expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
	});
	it('adds a reminder', () => {
		expect(ics).toContain('BEGIN:VALARM\r\nACTION:DISPLAY');
		expect(ics).toContain('TRIGGER:-P13DT15H');
		expect(alarmTrigger(0)).toBe('PT9H');
		expect(alarmTrigger(1)).toBe('-P0DT15H');
	});
});

describe('fold', () => {
	it('folds at 75 octets', () => {
		const line = 'SUMMARY:' + 'ä'.repeat(60);
		const parts = fold(line).split('\r\n');
		expect(parts.length).toBeGreaterThan(1);
		for (const p of parts) expect(new TextEncoder().encode(p).length).toBeLessThanOrEqual(75);
		expect(parts.slice(1).every((p) => p.startsWith(' '))).toBe(true);
		expect(parts.map((p, i) => (i ? p.slice(1) : p)).join('')).toBe(line);
	});
});
