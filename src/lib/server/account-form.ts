import { formString } from './validation.js';
import type { AccountInput } from './account-rules.js';

/** Reads the account form fields shared by create and edit. */
export function readAccountForm(data: FormData, fixedType?: string): AccountInput {
	return {
		name: formString(data, 'name'),
		type: fixedType ?? formString(data, 'type'),
		color: formString(data, 'color'),
		iban: formString(data, 'iban'),
		openingBalance: formString(data, 'openingBalance'),
		openingDate: formString(data, 'openingDate'),
		overdraftLimit: formString(data, 'overdraftLimit'),
		buffer: formString(data, 'buffer'),
		settlementAccountId: formString(data, 'settlementAccountId'),
		statementDay: formString(data, 'statementDay'),
		debitDay: formString(data, 'debitDay')
	};
}
