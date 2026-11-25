import { formString } from './validation.js';
import type { ContractInput, RecurringContext, RecurringInput } from './recurring-rules.js';
import { accountsForNewItems, transferTargets, type RecurringDetail } from './recurring.js';
import { listCategories } from './categories.js';
import { buildTree } from './category-rules.js';
import type { Viewer } from './account-rules.js';

/** Reads the recurring-item form (shared by create and edit). */
export function readRecurringForm(data: FormData): RecurringInput {
	return {
		accountId: formString(data, 'accountId'),
		kind: formString(data, 'kind'),
		targetAccountId: formString(data, 'targetAccountId'),
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
		paymentMethod: formString(data, 'paymentMethod'),
		customerNumber: formString(data, 'customerNumber'),
		note: formString(data, 'note')
	};
}

/** Reads the contract fields of the recurring form. */
export function readContractForm(data: FormData): ContractInput {
	return {
		contract: formString(data, 'contract') === 'on',
		termEnd: formString(data, 'termEnd'),
		noticeEvery: formString(data, 'noticeEvery'),
		noticeUnit: formString(data, 'noticeUnit'),
		renewal: formString(data, 'renewal'),
		renewalMonths: formString(data, 'renewalMonths'),
		leadDays: formString(data, 'leadDays'),
		cancelledOn: formString(data, 'cancelledOn'),
		cancelName: formString(data, 'cancelName'),
		cancelStreet: formString(data, 'cancelStreet'),
		cancelPostalCode: formString(data, 'cancelPostalCode'),
		cancelCity: formString(data, 'cancelCity'),
		cancelEmail: formString(data, 'cancelEmail')
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

/**
 * Select options and validation context for the recurring form. The current source and target
 * of an edited item stay selectable even if the user could not choose them for a new item.
 */
export async function recurringFormContext(
	viewer: Viewer,
	current?: Pick<RecurringDetail, 'account' | 'targetAccount'>
) {
	const [accounts, targets, categories] = await Promise.all([
		accountsForNewItems(viewer),
		transferTargets(),
		listCategories()
	]);
	const accountOptions = accounts.map((a) => ({
		value: a.id,
		label: a.name,
		giro: a.type !== 'sparbuch'
	}));
	if (current && !accountOptions.some((a) => a.value === current.account.id))
		accountOptions.unshift({
			value: current.account.id,
			label: current.account.name,
			giro: current.account.type !== 'sparbuch'
		});
	const targetOptions = targets.map((t) => ({ value: t.id, label: t.name }));
	const currentTarget = current?.targetAccount;
	if (currentTarget && !targetOptions.some((t) => t.value === currentTarget.id))
		targetOptions.unshift({ value: currentTarget.id, label: currentTarget.name });
	return {
		options: {
			accountOptions,
			targetOptions,
			categoryGroups: categoryGroups(buildTree(categories))
		},
		ctx: {
			accountIds: new Set(accountOptions.filter((a) => a.giro).map((a) => a.value)),
			transferSourceIds: new Set(accountOptions.map((a) => a.value)),
			targetAccountIds: new Set(targetOptions.map((t) => t.value)),
			categoryIds: new Set(categories.map((c) => c.id))
		} satisfies RecurringContext
	};
}
