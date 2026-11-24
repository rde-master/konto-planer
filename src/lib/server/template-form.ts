import { formString } from './validation.js';
import { bookingFormContext } from './bookings.js';
import type { Viewer } from './account-rules.js';
import type { TemplateContext, TemplateInput } from './template-rules.js';

export function readTemplateForm(data: FormData): TemplateInput {
	return {
		name: formString(data, 'name'),
		kind: formString(data, 'kind'),
		amount: formString(data, 'amount'),
		accountId: formString(data, 'accountId'),
		categoryId: formString(data, 'categoryId'),
		counterparty: formString(data, 'counterparty'),
		shared: formString(data, 'shared')
	};
}

/** Select options (same as a manual booking) and validation context for templates. */
export async function templateFormContext(viewer: Viewer) {
	const { options, ctx } = await bookingFormContext(viewer);
	return {
		options,
		ctx: { accountIds: ctx.accountIds, categoryIds: ctx.categoryIds } satisfies TemplateContext
	};
}
