import { eq } from 'drizzle-orm';
import { db } from './db/index.js';
import { appSettings } from './db/schema.js';
import { audit, type Actor } from './audit.js';
import { diff } from './audit-rules.js';
import { DEFAULT_LEAD_DAYS } from '../contracts.js';

export type Settings = { defaultLeadDays: number };

/** App-wide settings; defaults until the admin saves them the first time. */
export async function getSettings(): Promise<Settings> {
	const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
	return { defaultLeadDays: row?.defaultLeadDays ?? DEFAULT_LEAD_DAYS };
}

export async function updateSettings(actor: NonNullable<Actor>, values: Settings) {
	const current = await getSettings();
	await db.transaction(async (tx) => {
		await tx
			.insert(appSettings)
			.values({ id: 1, ...values })
			.onConflictDoUpdate({ target: appSettings.id, set: { ...values, updatedAt: new Date() } });
		const changes = diff(current, values);
		if (changes)
			await audit(tx, {
				actor,
				entityType: 'settings',
				action: 'update',
				entityLabel: 'Einstellungen',
				...changes
			});
	});
}
