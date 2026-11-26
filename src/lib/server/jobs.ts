import { db } from './db/index.js';
import { jobRuns } from './db/schema.js';

export const JOB_LABELS: Record<string, string> = {
	dues: 'Fälligkeiten, Abrechnungen, Zinsen',
	notifications: 'Meldungen',
	monthly_report: 'Monatsbericht',
	ha_sensors: 'Home-Assistant-Sensoren',
	trash: 'Papierkorb aufräumen',
	demo_reset: 'Demo zurücksetzen (nachts)'
};

/** Runs a background job and records start, duration and result (errors are logged, not thrown). */
export async function trackJob(job: string, fn: () => Promise<unknown>): Promise<void> {
	const startedAt = new Date();
	const save = (values: Partial<typeof jobRuns.$inferInsert>) =>
		db
			.insert(jobRuns)
			.values({ job, startedAt, ...values })
			.onConflictDoUpdate({ target: jobRuns.job, set: { startedAt, ...values } })
			.catch((e: unknown) => console.error(`[jobs] ${job}: status not saved`, e));
	let ok = true;
	let message: string | null = null;
	try {
		const result = await fn();
		if (typeof result === 'number') message = String(result);
	} catch (e) {
		ok = false;
		message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
		console.error(`[jobs] ${job} failed`, e);
	}
	await save({
		finishedAt: new Date(),
		ok,
		message,
		durationMs: Date.now() - startedAt.getTime()
	});
}

export async function listJobRuns() {
	return db.select().from(jobRuns);
}
