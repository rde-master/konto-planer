import { formString } from './validation.js';
import type { GoalInput } from './goal-rules.js';

export function readGoalForm(data: FormData): GoalInput {
	return {
		name: formString(data, 'name'),
		targetAmount: formString(data, 'targetAmount'),
		targetDate: formString(data, 'targetDate'),
		recurringId: formString(data, 'recurringId'),
		allocated: formString(data, 'allocated')
	};
}
