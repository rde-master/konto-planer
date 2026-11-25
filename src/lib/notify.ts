// Notifications ("Meldungen"): rules, timing and repetition.
export const NOTIFICATION_TYPES = ['cancel_deadline'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
	cancel_deadline: 'Kündigungsfrist endet bald'
};

export const REPEATS = ['once', 'daily'] as const;
export type Repeat = (typeof REPEATS)[number];

/** From this hour (Berlin) notifications are sent. */
export const SEND_HOUR = 8;

/** Hour of the day in Berlin. */
export function berlinHour(now: Date): number {
	const part = new Intl.DateTimeFormat('en-GB', {
		hour: '2-digit',
		hourCycle: 'h23',
		timeZone: 'Europe/Berlin'
	})
		.formatToParts(now)
		.find((p) => p.type === 'hour');
	return Number(part?.value ?? 0);
}

/**
 * Whether a notification goes out again: never sent, or (daily) not yet sent today. `lastDay` is
 * the Berlin day of the last successful send.
 */
export function shouldSend(lastDay: string | null, repeat: Repeat, today: string): boolean {
	if (!lastDay) return true;
	return repeat === 'daily' && lastDay < today;
}
