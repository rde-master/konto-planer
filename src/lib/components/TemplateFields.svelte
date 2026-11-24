<script lang="ts">
	import FormField from './FormField.svelte';
	import SelectField from './SelectField.svelte';
	import SegmentedField from './SegmentedField.svelte';
	import ToggleField from './ToggleField.svelte';
	import type { TemplateFormValues } from '../templates.js';

	/**
	 * Fields of a quick-entry template. Amount and account are optional. `sharedLocked`: a shared
	 * template that only the admin may make personal again.
	 */
	let {
		values,
		errors,
		accounts,
		categories,
		sharedLocked = false
	}: {
		values: TemplateFormValues;
		errors?: Partial<Record<string, string>>;
		accounts: { value: string; label: string }[];
		categories: { label: string; options: { value: string; label: string }[] }[];
		sharedLocked?: boolean;
	} = $props();
</script>

<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
	<FormField
		label="Name"
		name="name"
		value={values.name}
		maxlength={30}
		placeholder="z. B. Bäcker"
		autocomplete="off"
		required
		error={errors?.name}
	/>
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
		label="Betrag in € (optional)"
		name="amount"
		value={values.amount}
		inputmode="decimal"
		autocomplete="off"
		placeholder="leer = jedes Mal eingeben"
		error={errors?.amount}
	/>
	<SelectField
		label="Konto"
		name="accountId"
		options={[{ value: '', label: 'Zuletzt benutztes' }, ...accounts]}
		value={values.accountId ?? ''}
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
	<FormField
		label="Empfänger/Zahler (optional)"
		name="counterparty"
		value={values.counterparty ?? ''}
		maxlength={70}
		autocomplete="off"
		error={errors?.counterparty}
	/>
</ul>

<ul class="mt-6 overflow-hidden rounded-[var(--radius-row)] bg-card">
	{#if sharedLocked}
		<li class="px-4 py-2.5 text-[15px] text-label-2">
			<input type="hidden" name="shared" value="on" />
			Gemeinsame Vorlage – alle Benutzer sehen und nutzen sie.
		</li>
	{:else}
		<ToggleField
			label="Für alle Benutzer"
			name="shared"
			initial={values.shared}
			hint="Sonst siehst nur du die Vorlage."
		/>
	{/if}
</ul>
