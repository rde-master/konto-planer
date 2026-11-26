import { error, json } from '@sveltejs/kit';
import { statusFor, tokenAuth } from '#lib/server/api.js';
import type { RequestHandler } from './$types';

// Read-only API: balances, available amounts, next payments, budgets and warnings.
export const GET: RequestHandler = async ({ request }) => {
	const auth = await tokenAuth(request);
	if (!auth) error(401, 'Ungültiges oder fehlendes Token.');
	return json(await statusFor(auth.viewer, auth.accountIds), {
		headers: { 'cache-control': 'no-store' }
	});
};
