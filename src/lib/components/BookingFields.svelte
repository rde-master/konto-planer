<script lang="ts">
	import FormField from './FormField.svelte';
	import SelectField from './SelectField.svelte';
	import SegmentedField from './SegmentedField.svelte';

	export type BookingFormValues = {
		kind: string;
		amount: string;
		accountId: string;
		categoryId: string | null;
		bookingDate?: string;
		counterparty?: string | null;
		purpose?: string | null;
	};

	/**
	 * Fields of a manual booking. The quick entry shows only kind, amount, account and category
	 * (date = today); `full` adds date, payee and note.
	 */
	let {
		values,
		errors,
		accounts,
		categories,
		full = false,
		onaccountchange
	}: {
		values: BookingFormValues;
		errors?: Partial<Record<string, string>>;
		accounts: { value: string; label: string }[];
		categories: { label: string; options: { value: string; label: string }[] }[];
		full?: boolean;
		onaccountchange?: (accountId: string) => void;
	} = $props();
</script>

<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
	<SegmentedField
		name="kind"
		label="Art"
		initial={values.kind}
		options={[
			{ value: 'expense', label: 'Ausgabe' },
			{ value: 'income', label: 'Einnahme' }
		]}
		error={errors?.kind}
	/>
	<FormField
		label="Betrag in €"
		name="amount"
		value={values.amount}
		inputmode="decimal"
		autocomplete="off"
		placeholder="0,00"
		required
		error={errors?.amount}
	/>
	<SelectField
		label="Konto"
		name="accountId"
		options={accounts}
		value={values.accountId}
		error={errors?.accountId}
		onchange={onaccountchange}
	/>
	<SelectField
		label="Kategorie"
		name="categoryId"
		options={[{ value: '', label: 'Keine' }]}
		groups={categories}
		value={values.categoryId ?? ''}
		error={errors?.categoryId}
	/>
</ul>

{#if full}
	<ul
		class="mt-8 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
	>
		<FormField
			label="Datum"
			name="bookingDate"
			type="date"
			value={values.bookingDate ?? ''}
			required
			error={errors?.bookingDate}
		/>
		<FormField
			label="Empfänger/Zahler (optional)"
			name="counterparty"
			value={values.counterparty ?? ''}
			autocomplete="off"
			error={errors?.counterparty}
		/>
		<FormField
			label="Notiz (optional)"
			name="purpose"
			value={values.purpose ?? ''}
			autocomplete="off"
			error={errors?.purpose}
		/>
	</ul>
{/if}
