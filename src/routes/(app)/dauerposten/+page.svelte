<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import RecurringFields from '#lib/components/RecurringFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatDay, todayBerlin } from '#lib/dates.js';
	import { intervalLabel, monthlyEquivalent } from '#lib/recurring.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Item = (typeof data.items)[number];

	let createOpen = $state(false);
	let pending = $state(false);
	let formKey = $state(0);

	const active = $derived(data.items.filter((i) => !i.archivedAt));
	const archived = $derived(data.items.filter((i) => i.archivedAt));

	/** Active items grouped by account (accounts in name order). */
	const groups = $derived.by(() => {
		const byAccount: Record<string, { account: Item['account']; items: Item[] }> = {};
		for (const item of active) {
			byAccount[item.account.id] ??= { account: item.account, items: [] };
			byAccount[item.account.id].items.push(item);
		}
		return Object.values(byAccount)
			.sort((a, b) => a.account.name.localeCompare(b.account.name, 'de'))
			.map((g) => ({
				...g,
				// Running items first by next due date, ended ones last.
				items: g.items.sort((a, b) => (a.nextDue ?? '9999').localeCompare(b.nextDue ?? '9999')),
				expense: total(g.items, 'expense'),
				income: total(g.items, 'income')
			}));
	});

	function total(items: Item[], kind: Item['kind']) {
		return items
			.filter((i) => i.kind === kind && i.nextDue !== null)
			.reduce((sum, i) => sum + monthlyEquivalent(i.amount ?? 0, i), 0);
	}

	const emptyValues = () => ({
		accountId: data.accountOptions[0]?.value ?? '',
		kind: 'expense',
		name: '',
		amount: '',
		counterparty: null,
		iban: null,
		mandateReference: null,
		creditorId: null,
		categoryId: null,
		interval: 'monthly',
		customEvery: null,
		customUnit: null,
		startDate: todayBerlin(),
		endDate: null,
		variable: false,
		isSalary: false,
		paymentMethod: null
	});
	const formValues = $derived(form && 'input' in form && form.input ? form.input : emptyValues());
	const formErrors = $derived(form && 'errors' in form ? form.errors : undefined);
</script>

{#snippet row(item: Item)}
	{@const Icon = item.kind === 'income' ? ArrowDownLeft : ArrowUpRight}
	<li>
		<a
			href={resolve(`dauerposten/${item.id}`)}
			class={[
				'flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-fill',
				(item.archivedAt || !item.nextDue) && 'opacity-60'
			]}
		>
			<span
				class="grid size-10 shrink-0 place-items-center rounded-full text-white"
				style:background-color={accountColorCss(item.category?.color ?? 'gray')}
			>
				<Icon class="size-5" strokeWidth={2.2} />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[17px]">{item.name}</span>
				<span class="block truncate text-[13px] text-label-2">
					{[intervalLabel(item), item.isSalary ? 'Gehalt' : null].filter(Boolean).join(' · ')}
				</span>
			</span>
			<span class="shrink-0 text-right">
				<span class={['block text-[17px] tabular', item.kind === 'income' && 'text-income']}>
					{item.variable ? '≈ ' : ''}{item.kind === 'income' ? '+' : '−'}{formatEuro(
						item.amount ?? 0
					)}
				</span>
				<span class="block text-[13px] text-label-2 tabular">
					{item.archivedAt ? 'archiviert' : item.nextDue ? formatDay(item.nextDue) : 'beendet'}
				</span>
			</span>
			<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
		</a>
	</li>
{/snippet}

<Page title="Dauerposten">
	{#snippet actions()}
		{#if data.accountOptions.length}
			<button
				type="button"
				aria-label="Dauerposten anlegen"
				onclick={() => {
					formKey++;
					createOpen = true;
				}}
				class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
			>
				<Plus class="size-6" strokeWidth={2.2} />
			</button>
		{/if}
	{/snippet}

	{#if form && 'created' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Dauerposten „{form.created}“ wurde angelegt.
		</p>
	{/if}

	{#if data.items.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Repeat class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Dauerposten</p>
			<p class="mt-1 text-[15px] text-label-2">
				{data.accountOptions.length
					? 'Lege mit „+“ regelmäßige Ausgaben und Einnahmen an, z. B. Miete oder Gehalt.'
					: 'Du brauchst ein Girokonto mit Recht „Bearbeiten“, um Dauerposten anzulegen.'}
			</p>
		</div>
	{/if}

	{#each groups as group (group.account.id)}
		<section class="mb-8" aria-label={group.account.name}>
			<h2 class="mb-1.5 flex items-center gap-2 px-4 text-[13px] text-label-2 uppercase">
				<span
					class="size-2.5 rounded-full"
					style:background-color={accountColorCss(group.account.color)}
					aria-hidden="true"
				></span>
				{group.account.name}
			</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each group.items as item (item.id)}
					{@render row(item)}
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2 tabular">
				Pro Monat: Ausgaben {formatEuro(group.expense)} · Einnahmen {formatEuro(group.income)}
			</p>
		</section>
	{/each}

	{#if archived.length}
		<section class="mb-8">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Archiviert</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each archived as item (item.id)}
					{@render row(item)}
				{/each}
			</ul>
		</section>
	{/if}
</Page>

{#if data.accountOptions.length}
	<Sheet
		bind:open={createOpen}
		title="Neuer Dauerposten"
		confirmLabel="Anlegen"
		formId="create-recurring"
		confirmDisabled={pending}
	>
		<form
			id="create-recurring"
			method="POST"
			action="?/create"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') createOpen = false;
					await update({ reset: false });
				};
			}}
		>
			{#key formKey}
				<RecurringFields
					values={formValues}
					errors={formErrors}
					accounts={data.accountOptions}
					categories={data.categoryGroups}
					withAmount
				/>
			{/key}
		</form>
	</Sheet>
{/if}
