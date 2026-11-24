<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import SegmentedField from '#lib/components/SegmentedField.svelte';
	import TextAreaField from '#lib/components/TextAreaField.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { DUE_STATUS_LABELS } from '#lib/due.js';
	import { addDays } from '#lib/recurring.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Row = (typeof data.upcoming)[number];

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);

	const empty = () => ({
		kind: 'expense',
		name: '',
		amount: '',
		startDate: addDays(data.today, 1),
		accountId: data.accounts[0]?.value ?? '',
		categoryId: '',
		note: ''
	});
	const values = $derived(form && 'input' in form && form.input ? form.input : empty());
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const created = $derived(form && 'created' in form ? form.created : undefined);

	function start() {
		key++;
		open = true;
	}

	function signed(r: Row) {
		return `${r.kind === 'income' ? '+' : '−'}${formatEuro(r.amount)}`;
	}
</script>

{#snippet row(r: Row, past: boolean)}
	<li>
		<a
			href={resolve(`dauerposten/${r.id}`)}
			class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
		>
			<span
				class="grid size-9 shrink-0 place-items-center rounded-full text-white"
				style:background-color={accountColorCss(r.category?.color ?? 'gray')}
			>
				<CalendarPlus class="size-5" strokeWidth={2.2} />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[17px]">{r.name}</span>
				<span class="block truncate text-[13px] text-label-2">
					{[
						formatDay(r.bookingDate),
						r.accountName,
						past
							? r.status
								? DUE_STATUS_LABELS[r.status]
								: r.archived
									? 'archiviert'
									: null
							: null
					]
						.filter(Boolean)
						.join(' · ')}
				</span>
			</span>
			<span class={['shrink-0 text-[17px] tabular', r.kind === 'income' && 'text-income']}>
				{signed(r)}
			</span>
			<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
		</a>
	</li>
{/snippet}

<Page title="Geplante Zahlungen" back={{ path: 'mehr', label: 'Mehr' }}>
	{#snippet actions()}
		{#if data.accounts.length}
			<button
				type="button"
				aria-label="Zahlung planen"
				onclick={start}
				class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
			>
				<Plus class="size-6" strokeWidth={2.2} />
			</button>
		{/if}
	{/snippet}

	{#if created}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			„{created}“ ist geplant.
		</p>
	{/if}

	{#if data.upcoming.length === 0 && data.past.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<CalendarPlus class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Nichts geplant</p>
			<p class="mt-1 text-[15px] text-label-2">
				Plane einmalige Ausgaben wie Urlaub oder eine Anschaffung, oder erwartete Eingänge wie eine
				Steuererstattung. Liegen sie vor dem Stichtag, zählen sie im Mindestbestand mit.
			</p>
		</div>
	{/if}

	{#if data.upcoming.length}
		<section class="mb-8" aria-label="Anstehend">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Anstehend</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.upcoming as r (r.id)}{@render row(r, false)}{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Am Tag der Zahlung (nächster Bankarbeitstag) wird sie vorläufig gebucht.
			</p>
		</section>
	{/if}

	{#if data.past.length}
		<section class="mb-8" aria-label="Vergangen">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Vergangen</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.past as r (r.id)}{@render row(r, true)}{/each}
			</ul>
		</section>
	{/if}
</Page>

{#if data.accounts.length}
	<Sheet
		bind:open
		title="Zahlung planen"
		confirmLabel="Planen"
		formId="planned-form"
		confirmDisabled={pending}
	>
		<form
			id="planned-form"
			method="POST"
			action="?/create"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') open = false;
					await update({ reset: false });
					key++;
				};
			}}
		>
			{#key key}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<SegmentedField
						name="kind"
						label="Art"
						initial={values.kind}
						options={[
							{ value: 'expense', label: 'Ausgabe' },
							{ value: 'income', label: 'Einnahme' }
						]}
					/>
					<FormField
						label="Bezeichnung"
						name="name"
						value={values.name}
						placeholder="z. B. Urlaub, Waschmaschine"
						maxlength={60}
						autocomplete="off"
						required
						error={errors?.name}
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
					<FormField
						label="Datum"
						name="startDate"
						type="date"
						value={values.startDate}
						required
						error={errors?.startDate}
					/>
					<SelectField
						label="Konto"
						name="accountId"
						options={data.accounts}
						value={values.accountId}
						error={errors?.accountId}
					/>
					<SelectField
						label="Kategorie"
						name="categoryId"
						options={[{ value: '', label: 'Keine' }]}
						groups={data.categoryGroups}
						value={values.categoryId}
						error={errors?.categoryId}
					/>
				</ul>
				<ul class="mt-6 overflow-hidden rounded-[var(--radius-row)] bg-card">
					<TextAreaField
						label="Notiz (optional)"
						name="note"
						value={values.note}
						error={errors?.note}
					/>
				</ul>
			{/key}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Liegt die Zahlung vor dem Stichtag des Kontos, zählt sie im Mindestbestand mit. Fällt das
				Datum auf ein Wochenende oder einen Bankfeiertag, gilt der nächste Bankarbeitstag.
			</p>
		</form>
	</Sheet>
{/if}
