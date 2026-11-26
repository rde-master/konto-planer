import { error, json } from '@sveltejs/kit';
import { statusFor, tokenAuth } from '#lib/server/api.js';
import type { RequestHandler } from './$types';

// One account of the status document (404 if the token may not read it).
export const GET: RequestHandler = async ({ request, params }) => {
	const auth = await tokenAuth(request);
	if (!auth) error(401, 'Ungültiges oder fehlendes Token.');
	if (auth.accountIds && !auth.accountIds.includes(params.id)) error(404, 'Konto nicht gefunden.');
	const status = await statusFor(auth.viewer, [params.id]);
	const account = status.accounts[0];
	if (!account) error(404, 'Konto nicht gefunden.');
	return json(
		{
			generatedAt: status.generatedAt,
			account,
			budgets: status.budgets,
			warnings: status.warnings
		},
		{ headers: { 'cache-control': 'no-store' } }
	);
};
