<script lang="ts">
	import { untrack } from 'svelte';
	import FormField from './FormField.svelte';
	import SegmentedField from './SegmentedField.svelte';
	import ColorPicker from './ColorPicker.svelte';
	import { formatEuroInput } from '#lib/money.js';
	import { formatIban } from '#lib/iban.js';

	type Values = {
		name: string;
		type: 'giro' | 'sparbuch';
		color: string;
		iban: string | null;
		openingBalance: number | string;
		openingDate: string;
		overdraftLimit: number | string;
	};

	/**
	 * Shared account form fields. `typeEditable` only on creation – the type is fixed afterwards.
	 * Amounts may come back from a failed submit as raw strings and are shown unchanged.
	 */
	let {
		values,
		errors,
		typeEditable = false,
		disabled = false
	}: {
		values: Values;
		errors?: Partial<Record<string, string>>;
		typeEditable?: boolean;
		disabled?: boolean;
	} = $props();

	// Start value only; afterwards the radio buttons drive it (form resets restore `initial`).
	let type = $state<string>(untrack(() => values.type));
	const amount = (v: number | string) => (typeof v === 'number' ? formatEuroInput(v) : v);
</script>

<fieldset {disabled} class="contents">
	<section class="mb-6">
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Name"
				name="name"
				value={values.name}
				autocomplete="off"
				error={errors?.name}
				required
			/>
			<FormField
				label="IBAN (optional)"
				name="iban"
				value={values.iban ? formatIban(values.iban) : ''}
				autocomplete="off"
				autocapitalize="characters"
				spellcheck={false}
				placeholder="DE00 0000 0000 0000 0000 00"
				error={errors?.iban}
			/>
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Mit der IBAN prüft der Import später, ob die Datei zum Konto passt.
		</p>
	</section>

	{#if typeEditable}
		<section
			class="mb-6"
			onchange={(e) => {
				const t = e.target as HTMLInputElement;
				if (t.name === 'type') type = t.value;
			}}
		>
			<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Art</h3>
			<div class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<SegmentedField
					name="type"
					label="Art"
					initial={values.type}
					error={errors?.type}
					options={[
						{ value: 'giro', label: 'Girokonto' },
						{ value: 'sparbuch', label: 'Sparbuch' }
					]}
				/>
			</div>
		</section>
	{/if}

	<section class="mb-6">
		<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Farbe</h3>
		<div class="overflow-hidden rounded-[var(--radius-row)] bg-card">
			<ColorPicker name="color" initial={values.color} error={errors?.color} />
		</div>
	</section>

	<section class="mb-6">
		<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Startsaldo</h3>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Betrag in €"
				name="openingBalance"
				value={amount(values.openingBalance)}
				inputmode="decimal"
				autocomplete="off"
				placeholder="0,00"
				error={errors?.openingBalance}
			/>
			<FormField
				label="Stand am"
				name="openingDate"
				type="date"
				value={values.openingDate}
				error={errors?.openingDate}
				required
			/>
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Kontostand laut Bank an diesem Tag. Buchungen ab diesem Tag kommen dazu, ältere zählen nicht.
		</p>
	</section>

	{#if type === 'giro'}
		<section class="mb-6">
			<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Dispo</h3>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Dispo-Rahmen in € (optional)"
					name="overdraftLimit"
					value={values.overdraftLimit ? amount(values.overdraftLimit) : ''}
					inputmode="decimal"
					autocomplete="off"
					placeholder="0,00"
					error={errors?.overdraftLimit}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Der Dispo zählt nie zum verfügbaren Betrag.
			</p>
		</section>
	{/if}
</fieldset>
