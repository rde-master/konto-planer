import { formatEuroInput } from './money.js';

/** Values of the savings goal form (as typed; amounts as German text). */
export type GoalFormValues = {
	accountId: string;
	name: string;
	targetAmount: string;
	targetDate: string;
	recurringId: string;
	allocated: string;
};

export function goalValuesOf(g: {
	accountId: string;
	name: string;
	targetAmount: number;
	targetDate: string | null;
	recurringId: string | null;
	allocated: number;
}): GoalFormValues {
	return {
		accountId: g.accountId,
		name: g.name,
		targetAmount: formatEuroInput(g.targetAmount),
		targetDate: g.targetDate ?? '',
		recurringId: g.recurringId ?? '',
		allocated: g.allocated ? formatEuroInput(g.allocated) : ''
	};
}
