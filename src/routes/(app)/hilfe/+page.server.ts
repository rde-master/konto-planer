import { HELP } from '#lib/server/help.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => ({ chapters: HELP });
