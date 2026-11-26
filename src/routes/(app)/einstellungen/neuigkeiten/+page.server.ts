import { allChanges, markSeen } from '#lib/server/changelog.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	await markSeen(locals.user!);
	return { entries: allChanges(20) };
};
