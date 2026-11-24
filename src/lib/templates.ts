/** Values of the template form (client-safe; amount in German input format). */
export type TemplateFormValues = {
	name: string;
	kind: string;
	amount: string;
	accountId: string | null;
	categoryId: string | null;
	counterparty: string | null;
	shared: boolean;
};

/** Form values after a failed submit (the server echoes the raw input). */
export function templateValuesFromInput(input: Record<string, string>): TemplateFormValues {
	return {
		name: input.name ?? '',
		kind: input.kind ?? 'expense',
		amount: input.amount ?? '',
		accountId: input.accountId || null,
		categoryId: input.categoryId || null,
		counterparty: input.counterparty || null,
		shared: input.shared === 'on'
	};
}
