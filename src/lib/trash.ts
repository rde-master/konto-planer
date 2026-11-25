// Trash: deleted objects stay restorable for 30 days.
export const TRASH_DAYS = 30;

export const TRASH_TYPES = [
	'booking',
	'recurring',
	'category',
	'goal',
	'template',
	'tag',
	'rule'
] as const;
export type TrashType = (typeof TRASH_TYPES)[number];

export const TRASH_TYPE_LABELS: Record<TrashType, string> = {
	booking: 'Buchung',
	recurring: 'Dauerposten',
	category: 'Kategorie',
	goal: 'Sparziel',
	template: 'Vorlage',
	tag: 'Tag',
	rule: 'Kategorie-Regel'
};

/** Whole days left before an entry is removed for good (0 = today). */
export function daysLeft(deletedAt: Date, now = new Date()): number {
	const end = deletedAt.getTime() + TRASH_DAYS * 86_400_000;
	return Math.max(0, Math.ceil((end - now.getTime()) / 86_400_000));
}

/** Whether an entry is older than the retention period. */
export function expired(deletedAt: Date, now = new Date()): boolean {
	return now.getTime() - deletedAt.getTime() >= TRASH_DAYS * 86_400_000;
}
