import { formString } from './validation.js';
import type { RecurringInput } from './recurring-rules.js';

/** Reads the recurring-item form (shared by create and edit). */
export function readRecurringForm(data: FormData): RecurringInput {
	return {
		accountId: formString(data, 'accountId'),
		kind: formString(data, 'kind'),
		name: formString(data, 'name'),
		counterparty: formString(data, 'counterparty'),
		iban: formString(data, 'iban'),
		mandateReference: formString(data, 'mandateReference'),
		creditorId: formString(data, 'creditorId'),
		categoryId: formString(data, 'categoryId'),
		interval: formString(data, 'interval'),
		customEvery: formString(data, 'customEvery'),
		customUnit: formString(data, 'customUnit'),
		startDate: formString(data, 'startDate'),
		endDate: formString(data, 'endDate'),
		variable: formString(data, 'variable') === 'on',
		isSalary: formString(data, 'isSalary') === 'on',
		paymentMethod: formString(data, 'paymentMethod')
	};
}

/** Category options for the select: main categories as groups, each selectable itself. */
export function categoryGroups(
	tree: { id: string; name: string; children: { id: string; name: string }[] }[]
) {
	return tree.map((main) => ({
		label: main.name,
		options: [
			{ value: main.id, label: `${main.name} (allgemein)` },
			...main.children.map((c) => ({ value: c.id, label: c.name }))
		]
	}));
}
