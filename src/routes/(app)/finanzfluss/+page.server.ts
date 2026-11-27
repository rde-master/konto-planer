import { flowFor } from '#lib/server/money-flow.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const view: 'plan' | 'past' = url.searchParams.get('ansicht') === 'ist' ? 'past' : 'plan';
	const flow = await flowFor(locals.user!, {
		mainId: url.searchParams.get('konto'),
		months: Number(url.searchParams.get('monate')) || null
	});
	// The account chosen by hand stays in the links; without one the salary account is shown.
	const chosenMain = flow && url.searchParams.get('konto') === flow.main.id ? flow.main.id : null;
	return { view, flow, chosenMain };
};
