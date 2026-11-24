<script lang="ts">
	import FormField from './FormField.svelte';
	import SelectField from './SelectField.svelte';
	import { formatEuroInput } from '#lib/money.js';
	import type { GoalFormValues } from '#lib/goal-form.js';

	/** Fields of a savings goal; the target date only without a linked payment. */
	let {
		values,
		errors,
		payments,
		accounts,
		withAllocation = true
	}: {
		values: GoalFormValues;
		errors?: Partial<Record<string, string>>;
		payments: { value: string; label: string; amount: number | null }[];
		/** Savings accounts to choose from (only when creating). */
		accounts?: { value: string; label: string }[];
		/** Creating only; later the amount is set with "Zurücklegen". */
		withAllocation?: boolean;
	} = $props();

	// svelte-ignore state_referenced_locally
	let recurringId = $state(values.recurringId);
	const payment = $derived(payments.find((p) => p.value === recurringId));

	function choose(value: string) {
		recurringId = value;
	}
</script>

<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
	{#if accounts}
		<SelectField
			label="Sparbuch"
			name="accountId"
			options={accounts}
			value={values.accountId}
			error={errors?.accountId}
		/>
	{/if}
	<FormField
		label="Name"
		name="name"
		value={values.name}
		placeholder="z. B. Urlaub, Notgroschen"
		maxlength={60}
		autocomplete="off"
		required
		error={errors?.name}
	/>
	<SelectField
		label="Für Zahlung"
		name="recurringId"
		options={[{ value: '', label: 'Keine' }, ...payments]}
		value={recurringId}
		error={errors?.recurringId}
		onchange={choose}
	/>
	<FormField
		label={payment ? 'Zielbetrag in € (leer = Betrag der Zahlung)' : 'Zielbetrag in €'}
		name="targetAmount"
		value={values.targetAmount}
		inputmode="decimal"
		autocomplete="off"
		placeholder={payment?.amount ? formatEuroInput(payment.amount) : '0,00'}
		error={errors?.targetAmount}
	/>
	{#if !payment}
		<FormField
			label="Zieldatum (optional)"
			name="targetDate"
			type="date"
			value={values.targetDate}
			error={errors?.targetDate}
		/>
	{/if}
	{#if withAllocation}
		<FormField
			label="Schon zurückgelegt in €"
			name="allocated"
			value={values.allocated}
			inputmode="decimal"
			autocomplete="off"
			placeholder="0,00"
			error={errors?.allocated}
		/>
	{/if}
</ul>
<p class="mt-1.5 px-4 text-[13px] text-label-2">
	{#if payment}
		Am Tag der Zahlung bucht die App das Zurückgelegte (höchstens den Zielbetrag) vom Sparbuch auf
		das Girokonto der Zahlung. So belastet sie den Mindestbestand dort nicht.
	{:else}
		Ohne Zahlung gibt es keine Umbuchung. Mit Zieldatum zeigt die App die nötige Sparrate.
	{/if}
</p>
