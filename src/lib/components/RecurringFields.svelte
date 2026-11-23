<script lang="ts">
	import { untrack } from 'svelte';
	import FormField from './FormField.svelte';
	import SelectField from './SelectField.svelte';
	import SegmentedField from './SegmentedField.svelte';
	import ToggleField from './ToggleField.svelte';
	import { formatIban } from '#lib/iban.js';
	import {
		INTERVALS,
		INTERVAL_LABELS,
		PAYMENT_METHODS,
		PAYMENT_METHOD_LABELS
	} from '#lib/recurring.js';

	export type RecurringFormValues = {
		accountId: string;
		kind: string;
		name: string;
		counterparty: string | null;
		iban: string | null;
		mandateReference: string | null;
		creditorId: string | null;
		categoryId: string | null;
		interval: string;
		customEvery: string | number | null;
		customUnit: string | null;
		startDate: string;
		endDate: string | null;
		variable: boolean;
		isSalary: boolean;
		paymentMethod: string | null;
		amount?: string;
	};

	/**
	 * Shared fields of a recurring item. Kind and interval drive which fields are shown.
	 * `withAmount` adds the first amount (creation only; later changes go to the amount history).
	 */
	let {
		values,
		errors,
		accounts,
		categories,
		withAmount = false
	}: {
		values: RecurringFormValues;
		errors?: Partial<Record<string, string>>;
		accounts: { value: string; label: string }[];
		categories: { label: string; options: { value: string; label: string }[] }[];
		withAmount?: boolean;
	} = $props();

	let kind = $state(untrack(() => values.kind));
	let interval = $state(untrack(() => values.interval));
	function chooseInterval(value: string) {
		interval = value;
	}

	const intervalOptions = INTERVALS.map((i) => ({
		value: i,
		label:
			i === 'custom'
				? 'Frei (alle …)'
				: INTERVAL_LABELS[i][0].toUpperCase() + INTERVAL_LABELS[i].slice(1)
	}));
	const paymentOptions = [
		{ value: '', label: 'Keine Angabe' },
		...PAYMENT_METHODS.map((p) => ({ value: p, label: PAYMENT_METHOD_LABELS[p] }))
	];
	const unitOptions = [
		{ value: 'day', label: 'Tage' },
		{ value: 'week', label: 'Wochen' },
		{ value: 'month', label: 'Monate' }
	];
</script>

<section
	class="mb-6"
	onchange={(e) => {
		const t = e.target as HTMLInputElement;
		if (t.name === 'kind') kind = t.value;
	}}
>
	<div class="overflow-hidden rounded-[var(--radius-row)] bg-card">
		<SegmentedField
			name="kind"
			label="Art"
			initial={values.kind}
			error={errors?.kind}
			options={[
				{ value: 'expense', label: 'Ausgabe' },
				{ value: 'income', label: 'Einnahme' }
			]}
		/>
	</div>
</section>

<section class="mb-6">
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<FormField
			label="Bezeichnung"
			name="name"
			value={values.name}
			autocomplete="off"
			placeholder={kind === 'income' ? 'z. B. Gehalt' : 'z. B. Miete'}
			maxlength={60}
			required
			error={errors?.name}
		/>
		{#if withAmount}
			<FormField
				label="Betrag in €"
				name="amount"
				value={values.amount ?? ''}
				inputmode="decimal"
				autocomplete="off"
				placeholder="0,00"
				required
				error={errors?.amount}
			/>
		{/if}
		<SelectField
			label="Konto"
			name="accountId"
			options={accounts}
			value={values.accountId}
			error={errors?.accountId}
		/>
		<SelectField
			label="Kategorie"
			name="categoryId"
			options={[{ value: '', label: 'Keine' }]}
			groups={categories}
			value={values.categoryId ?? ''}
			error={errors?.categoryId}
		/>
		<ToggleField
			label="Schwankender Betrag"
			name="variable"
			initial={values.variable}
			hint="Die Vorschau rechnet mit dem letzten bekannten Betrag."
		/>
	</ul>
</section>

<section class="mb-6">
	<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Rhythmus</h3>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<SelectField
			label="Intervall"
			name="interval"
			options={intervalOptions}
			value={values.interval}
			error={errors?.interval}
			onchange={chooseInterval}
		/>
		{#if interval === 'custom'}
			<FormField
				label="Alle"
				name="customEvery"
				value={values.customEvery?.toString() ?? '2'}
				inputmode="numeric"
				autocomplete="off"
				error={errors?.customEvery}
			/>
			<SelectField
				label="Einheit"
				name="customUnit"
				options={unitOptions}
				value={values.customUnit ?? 'month'}
				error={errors?.customUnit}
			/>
		{/if}
		<FormField
			label={interval === 'once' ? 'Datum' : 'Erste Fälligkeit'}
			name="startDate"
			type="date"
			value={values.startDate}
			required
			error={errors?.startDate}
		/>
		{#if interval !== 'once'}
			<FormField
				label="Ende (optional)"
				name="endDate"
				type="date"
				value={values.endDate ?? ''}
				error={errors?.endDate}
			/>
		{/if}
	</ul>
	<p class="mt-1.5 px-4 text-[13px] text-label-2">
		Fällt der Tag in einem Monat weg (z. B. der 31.), gilt der letzte Tag des Monats.
	</p>
</section>

<section class="mb-6">
	<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
		{kind === 'income' ? 'Zahler' : 'Empfänger'}
	</h3>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<FormField
			label={kind === 'income' ? 'Zahler (optional)' : 'Empfänger (optional)'}
			name="counterparty"
			value={values.counterparty ?? ''}
			autocomplete="off"
			placeholder="Name wie auf dem Kontoauszug"
			maxlength={70}
			error={errors?.counterparty}
		/>
		<FormField
			label="IBAN (optional)"
			name="iban"
			value={values.iban ? formatIban(values.iban) : ''}
			autocomplete="off"
			autocapitalize="characters"
			spellcheck={false}
			error={errors?.iban}
		/>
		{#if kind === 'expense'}
			<SelectField
				label="Zahlart"
				name="paymentMethod"
				options={paymentOptions}
				value={values.paymentMethod ?? ''}
				error={errors?.paymentMethod}
			/>
			<FormField
				label="Mandatsreferenz (optional)"
				name="mandateReference"
				value={values.mandateReference ?? ''}
				autocomplete="off"
				spellcheck={false}
				maxlength={35}
				error={errors?.mandateReference}
			/>
			<FormField
				label="Gläubiger-ID (optional)"
				name="creditorId"
				value={values.creditorId ?? ''}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck={false}
				error={errors?.creditorId}
			/>
		{:else}
			<ToggleField
				label="Gehalt"
				name="isSalary"
				initial={values.isSalary}
				hint="Gehaltseingänge bestimmen später den Stichtag."
			/>
		{/if}
	</ul>
	<p class="mt-1.5 px-4 text-[13px] text-label-2">
		Mit diesen Angaben ordnet der Import später Buchungen dem Dauerposten zu.
	</p>
</section>
