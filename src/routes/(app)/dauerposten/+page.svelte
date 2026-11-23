<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import RecurringFields from '#lib/components/RecurringFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatDay, todayBerlin } from '#lib/dates.js';
	import { effectOn, intervalLabel, monthlyEquivalent } from '#lib/recurring.js';
	import { cancelSoon, contractStatus } from '#lib/contracts.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Item = (typeof data.items)[number];
	type Account = Item['account'];
	/** An item seen from one account: a transfer is listed at its source and its target. */
	type Entry = { item: Item; accountId: string; effect: number };

	let createOpen = $state(false);
	let pending = $state(false);
	let formKey = $state(0);

	const active = $derived(data.items.filter((i) => !i.archivedAt));
	const archived = $derived(data.items.filter((i) => i.archivedAt));

	/** Accounts of an item the viewer can see (level null = name only). */
	function visibleAccounts(item: Item): Account[] {
		return [item.account, item.targetAccount].filter(
			(a): a is Account => a !== null && a.level !== null
		);
	}

	function entry(item: Item, accountId: string): Entry {
		return { item, accountId, effect: effectOn(item, accountId, item.amount ?? 0) };
	}

	/** Active items grouped by visible account (accounts in name order). */
	const groups = $derived.by(() => {
		const byAccount: Record<string, { account: Account; entries: Entry[] }> = {};
		for (const item of active) {
			for (const account of visibleAccounts(item)) {
				byAccount[account.id] ??= { account, entries: [] };
				byAccount[account.id].entries.push(entry(item, account.id));
			}
		}
		return Object.values(byAccount)
			.sort((a, b) => a.account.name.localeCompare(b.account.name, 'de'))
			.map((g) => ({
				...g,
				// Running items first by next due date, ended ones last.
				entries: g.entries.sort((a, b) =>
					(a.item.nextDue ?? '9999').localeCompare(b.item.nextDue ?? '9999')
				),
				expense: -total(g.entries.filter((e) => e.effect < 0)),
				income: total(g.entries.filter((e) => e.effect > 0))
			}));
	});

	/** Monthly equivalent of running entries, signed. */
	function total(entries: Entry[]) {
		return entries
			.filter((e) => e.item.nextDue !== null)
			.reduce((sum, e) => sum + monthlyEquivalent(e.effect, e.item), 0);
	}

	function subtitle({ item, accountId }: Entry) {
		const direction =
			item.kind !== 'transfer'
				? null
				: accountId === item.accountId
					? `auf ${item.targetAccount?.name ?? '–'}`
					: `von ${item.account.name}`;
		const cancelled =
			item.contract?.cancelledOn && item.endDate
				? `gekündigt zum ${formatDay(item.endDate)}`
				: null;
		return [intervalLabel(item), direction, item.isSalary ? 'Gehalt' : null, cancelled]
			.filter(Boolean)
			.join(' · ');
	}

	const hasGiro = $derived(data.accountOptions.some((a) => a.giro));
	const emptyValues = () => ({
		accountId: (data.accountOptions.find((a) => a.giro) ?? data.accountOptions[0])?.value ?? '',
		kind: hasGiro ? 'expense' : 'transfer',
		targetAccountId: null,
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
	const formContract = $derived(
		form && 'input' in form && form.input?.contract ? form.input : null
	);

	const today = todayBerlin();
	/** Running contracts whose notice deadline is within the lead time, earliest first. */
	const cancelSoonEntries = $derived(
		active
			.filter((i) => i.contract && cancelSoon(i.contract, today, data.defaultLeadDays))
			.map((i) => ({
				item: i,
				status: contractStatus(i.contract!, today)
			}))
			.sort((a, b) =>
				(a.status.state === 'fixed' ? a.status.deadline : '').localeCompare(
					b.status.state === 'fixed' ? b.status.deadline : ''
				)
			)
	);
</script>

{#snippet row({ item, accountId, effect }: Entry)}
	{@const Icon =
		item.kind === 'transfer'
			? ArrowLeftRight
			: item.kind === 'income'
				? ArrowDownLeft
				: ArrowUpRight}
	{@const color = item.kind === 'transfer' ? 'indigo' : (item.category?.color ?? 'gray')}
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
				style:background-color={accountColorCss(color)}
			>
				<Icon class="size-5" strokeWidth={2.2} />
			</span>
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[17px]">{item.name}</span>
				<span class="block truncate text-[13px] text-label-2">
					{subtitle({ item, accountId, effect })}
				</span>
			</span>
			<span class="shrink-0 text-right">
				<span class={['block text-[17px] tabular', effect > 0 && 'text-income']}>
					{item.variable ? '≈ ' : ''}{effect > 0 ? '+' : '−'}{formatEuro(item.amount ?? 0)}
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
					? 'Lege mit „+“ regelmäßige Ausgaben, Einnahmen und Umbuchungen an, z. B. Miete, Gehalt oder Sparrate.'
					: 'Du brauchst ein Konto mit Recht „Bearbeiten“, um Dauerposten anzulegen.'}
			</p>
		</div>
	{/if}

	{#if cancelSoonEntries.length}
		<section class="mb-8" aria-label="Bald kündbar">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Bald kündbar</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each cancelSoonEntries as { item, status } (item.id)}
					<li>
						<a
							href={resolve(`dauerposten/${item.id}`)}
							class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{item.name}</span>
								<span class="block truncate text-[13px] text-label-2">
									{status.state === 'fixed' ? `kündbar zum ${formatDay(status.end)}` : ''}
								</span>
							</span>
							<span class="shrink-0 text-right text-[15px] font-semibold tabular">
								{status.state === 'fixed' ? `bis ${formatDay(status.deadline)}` : ''}
							</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Kündigung muss bis zum genannten Tag beim Anbieter sein.
			</p>
		</section>
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
				{#each group.entries as e (e.item.id)}
					{@render row(e)}
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
					{@render row(entry(item, visibleAccounts(item)[0]?.id ?? item.accountId))}
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
					targets={data.targetOptions}
					categories={data.categoryGroups}
					contract={formContract}
					defaultLeadDays={data.defaultLeadDays}
					kinds={hasGiro ? ['expense', 'income', 'transfer'] : ['transfer']}
					withAmount
				/>
			{/key}
		</form>
	</Sheet>
{/if}
