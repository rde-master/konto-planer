<script lang="ts">
	import { untrack } from 'svelte';
	import HelpLink from '#lib/components/HelpLink.svelte';
	import { nextBankDay } from '#lib/bank-calendar.js';
	import { enhance } from '$app/forms';
	import { gotoReplace } from '#lib/back.svelte.js';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { takeFab } from '#lib/fab.svelte.js';
	import SearchIcon from '@lucide/svelte/icons/search';
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
	import Logo from '#lib/components/Logo.svelte';
	import { formatEuro } from '#lib/money.js';
	import { formatDay, todayBerlin } from '#lib/dates.js';
	import {
		effectOn,
		intervalLabel,
		isPausedOn,
		monthlyEquivalent,
		pauseLabel
	} from '#lib/recurring.js';
	import { cancelSoon, contractStatus } from '#lib/contracts.js';
	import {
		formatDiff,
		formatPercent,
		monthlySteps,
		plannedChanges,
		type AmountChange
	} from '#lib/planned.js';
	import {
		EMPTY_LIST_FILTER,
		INTERVAL_COLORS,
		LIST_KIND_LABELS,
		LIST_SORTS,
		LIST_SORT_LABELS,
		NO_CATEGORY,
		categoryLabel,
		compareList,
		isFiltered,
		listOptions,
		listQuery,
		matchesList,
		parseListFilter,
		type ListFilter
	} from '#lib/recurring-list.js';
	import { INTERVAL_LABELS } from '#lib/recurring.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Item = (typeof data.items)[number];
	type Account = Item['account'];
	/** An item seen from one account: a transfer is listed at its source and its target. */
	type Entry = { item: Item; accountId: string; effect: number };

	const today = todayBerlin();

	// Coming from a booking ("Dauerposten daraus machen") the form is open and filled.
	let createOpen = $state(untrack(() => data.fromBooking !== null));
	// Until "+" starts an empty form, the booking's values are used.
	let useBooking = $state(true);
	const fromBooking = $derived(useBooking ? data.fromBooking : null);
	let pending = $state(false);
	let formKey = $state(0);

	// Search, filter and order live in the address, so they survive a visit to an item. The
	// search text filters at once and reaches the address a moment later.
	const urlFilter = $derived(parseListFilter(page.url.searchParams));
	let text = $state(untrack(() => urlFilter.text));
	const filter = $derived<ListFilter>({ ...urlFilter, text });
	const filtered = $derived(isFiltered(filter));
	const options = $derived(listOptions(data.items));
	let timer: ReturnType<typeof setTimeout> | undefined;

	function go(f: ListFilter) {
		clearTimeout(timer);
		const q = listQuery(f);
		void gotoReplace(q ? resolve(`dauerposten?${q}`) : resolve('dauerposten'), { reset: false });
	}
	function search(value: string) {
		text = value;
		clearTimeout(timer);
		timer = setTimeout(() => go({ ...urlFilter, text: value }), 400);
	}
	function set(patch: Partial<ListFilter>) {
		go({ ...filter, ...patch });
	}
	function resetFilter() {
		text = '';
		go({ ...EMPTY_LIST_FILTER, sort: filter.sort });
	}

	function openCreate() {
		useBooking = false;
		formKey++;
		createOpen = true;
	}
	// On the phone the round plus above the tab bar creates an item here (one plus per screen).
	$effect(() =>
		data.accountOptions.length ? takeFab('Dauerposten anlegen', openCreate) : undefined
	);

	const shown = $derived(data.items.filter((i) => matchesList(i, filter)));
	const active = $derived(shown.filter((i) => !i.archivedAt));
	const archived = $derived(
		shown.filter((i) => i.archivedAt).sort((a, b) => compareList(a, b, filter.sort))
	);

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
			.map((g) => {
				const expense = -total(g.entries.filter((e) => e.effect < 0));
				const income = total(g.entries.filter((e) => e.effect > 0));
				const runningEntries = g.entries.filter((e) => running(e.item));
				return {
					...g,
					// By default running items first by next due date, ended ones last.
					entries: g.entries.sort((a, b) => compareList(a.item, b.item, filter.sort)),
					expense,
					income,
					steps: monthlySteps(
						runningEntries.map((e) => ({
							amounts: e.item.amounts,
							endDate: e.item.endDate,
							schedule: e.item,
							sign: effectOn(e.item, e.accountId, 1) < 0 ? -1 : 1
						})),
						today,
						{ expense, income }
					)
				};
			});
	});

	/** Next planned change of a running item. */
	function nextChange(item: Item): AmountChange | null {
		if (item.archivedAt || !item.nextDue) return null;
		return plannedChanges(item.amounts, today, item.endDate)[0] ?? null;
	}

	/** All planned changes of running items, earliest first (transfers once). */
	const changes = $derived(
		active
			.filter((i) => i.nextDue !== null)
			.flatMap((item) =>
				plannedChanges(item.amounts, today, item.endDate).map((change) => ({ item, change }))
			)
			.sort(
				(a, b) =>
					a.change.validFrom.localeCompare(b.change.validFrom) ||
					a.item.name.localeCompare(b.item.name, 'de')
			)
	);

	/** "870,00 € (+60,00 €)" – the difference only when there is one. */
	function withDiff(total: number, diff: number) {
		return diff ? `${formatEuro(total)} (${formatDiff(diff)})` : formatEuro(total);
	}

	/** Has due dates ahead and is not paused today. */
	function running(item: Item) {
		return item.nextDue !== null && !isPausedOn(item, today);
	}

	/** Monthly equivalent of running entries, signed. */
	function total(entries: Entry[]) {
		return entries
			.filter((e) => running(e.item))
			.reduce((sum, e) => sum + monthlyEquivalent(e.effect, e.item), 0);
	}

	/** What follows the rhythm in the second line: direction and notes. */
	function notes({ item, accountId }: Entry) {
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
		return [
			direction,
			item.isSalary ? 'Gehalt' : null,
			cancelled,
			item.archivedAt ? null : pauseLabel(item, today, formatDay)
		]
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
		paymentMethod: null,
		customerNumber: null,
		note: null
	});
	const formValues = $derived(
		form && 'input' in form && form.input ? form.input : (fromBooking?.values ?? emptyValues())
	);
	const formErrors = $derived(form && 'errors' in form ? form.errors : undefined);
	const formContract = $derived(
		form && 'input' in form && form.input?.contract ? form.input : null
	);

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
	{@const change = nextChange(item)}
	{@const rest = notes({ item, accountId, effect })}
	{@const category = categoryLabel(item)}
	<li>
		<a
			href={resolve(`dauerposten/${item.id}`)}
			class={[
				'relative flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-fill',
				(item.archivedAt || !running(item)) && 'opacity-60'
			]}
		>
			{#if item.category}
				<!-- As in the booking list: the colour of the category; its name is in the second line. -->
				<span
					class="absolute top-1.5 left-1.5 size-2 rounded-full"
					style:background-color={accountColorCss(item.category.color ?? 'gray')}
					aria-hidden="true"
					data-category-dots
				></span>
			{/if}
			{#if item.kind !== 'transfer'}
				<Logo name={item.counterparty ?? item.name} logo={data.logos[item.id]?.logo ?? null} />
			{:else}
				<span
					class="grid size-10 shrink-0 place-items-center rounded-full text-white"
					style:background-color={accountColorCss(color)}
				>
					<Icon class="size-5" strokeWidth={2.2} />
				</span>
			{/if}
			<span class="min-w-0 flex-1">
				<span class="block truncate text-[17px]">{item.name}</span>
				<!-- On a phone the category gets its own line; from tablet width on it follows. -->
				<span class="flex flex-wrap items-center gap-x-1 text-[13px] text-label-2 md:flex-nowrap">
					<span class="min-w-0 truncate">
						<span
							class="rounded-full px-1.5 py-px text-[12px] font-medium text-label"
							style:background-color="color-mix(in srgb, {accountColorCss(
								INTERVAL_COLORS[item.interval]
							)} 24%, transparent)"
							data-interval={item.interval}
						>
							{intervalLabel(item)}
						</span>{rest ? ` · ${rest}` : ''}
					</span>
					{#if category}
						<span class="min-w-0 basis-full truncate md:basis-auto" data-category>
							<span class="hidden md:inline" aria-hidden="true">· </span>{category}
						</span>
					{/if}
				</span>
				{#if change}
					<span class="block truncate text-[13px] text-accent tabular">
						ab {formatDay(change.validFrom)}: {formatEuro(change.amount)}
					</span>
				{/if}
			</span>
			<span class="shrink-0 text-right">
				<span class={['block text-[17px] tabular', effect > 0 && 'text-income']}>
					{item.variable ? '≈ ' : ''}{effect > 0 ? '+' : '−'}{formatEuro(item.amount ?? 0)}
				</span>
				<span class="block text-[13px] text-label-2 tabular">
					{item.archivedAt
						? 'archiviert'
						: item.nextDue
							? formatDay(nextBankDay(item.nextDue))
							: isPausedOn(item, today) || (item.pauseFrom && !item.pauseUntil)
								? 'pausiert'
								: 'beendet'}
				</span>
			</span>
			<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
		</a>
	</li>
{/snippet}

{#snippet pick(
	label: string,
	name: string,
	value: string,
	choices: { value: string; label: string }[],
	onpick: (value: string) => void,
	on = value !== ''
)}
	<label
		class={[
			'flex shrink-0 items-center rounded-full px-3 py-1.5 text-[15px] text-accent',
			on ? 'bg-accent/15 font-medium' : 'bg-card'
		]}
	>
		<span class="sr-only">{label}</span>
		<select
			{name}
			{value}
			onchange={(e) => onpick(e.currentTarget.value)}
			class="max-w-44 cursor-pointer appearance-none truncate bg-transparent outline-none"
		>
			{#each choices as c (c.value)}
				<option value={c.value}>{c.label}</option>
			{/each}
		</select>
	</label>
{/snippet}

<Page title="Dauerposten">
	{#snippet actions()}
		{#if data.accountOptions.length}
			<button
				type="button"
				aria-label="Dauerposten anlegen"
				onclick={openCreate}
				class="hidden size-11 place-items-center rounded-full text-accent glass active:opacity-60 md:grid"
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

	{#if data.items.length}
		<form
			method="GET"
			role="search"
			aria-label="Dauerposten filtern"
			class="kp-span mb-6"
			onsubmit={(e) => {
				e.preventDefault();
				set({});
			}}
		>
			<label class="flex items-center gap-2 rounded-[var(--radius-row)] bg-card px-4">
				<SearchIcon class="size-5 shrink-0 text-label-3" />
				<span class="sr-only">Dauerposten suchen</span>
				<input
					type="search"
					name="q"
					value={text}
					oninput={(e) => search(e.currentTarget.value)}
					placeholder="Name, Empfänger oder Kategorie"
					enterkeyhint="search"
					autocomplete="off"
					class="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] outline-none placeholder:text-label-3"
				/>
			</label>
			<div class="mt-2 flex flex-wrap gap-2">
				{#if options.kinds.length > 1}
					{@render pick(
						'Nach Art filtern',
						'art',
						filter.kind ?? '',
						[
							{ value: '', label: 'Alle Arten' },
							...options.kinds.map((k) => ({ value: k, label: LIST_KIND_LABELS[k] }))
						],
						(v) => set({ kind: options.kinds.find((k) => k === v) ?? null })
					)}
				{/if}
				{#if options.categories.length}
					{@render pick(
						'Nach Kategorie filtern',
						'kategorie',
						filter.category ?? '',
						[
							{ value: '', label: 'Alle Kategorien' },
							...options.categories.map((c) => ({ value: c, label: c })),
							...(options.uncategorized ? [{ value: NO_CATEGORY, label: 'Ohne Kategorie' }] : [])
						],
						(v) => set({ category: v || null })
					)}
				{/if}
				{#if options.intervals.length > 1}
					{@render pick(
						'Nach Rhythmus filtern',
						'rhythmus',
						filter.interval ?? '',
						[
							{ value: '', label: 'Jeder Rhythmus' },
							...options.intervals.map((i) => ({ value: i, label: INTERVAL_LABELS[i] }))
						],
						(v) => set({ interval: options.intervals.find((i) => i === v) ?? null })
					)}
				{/if}
				{@render pick(
					'Sortieren nach',
					'sortierung',
					filter.sort,
					LIST_SORTS.map((o) => ({ value: o, label: `Sortiert: ${LIST_SORT_LABELS[o]}` })),
					(v) => set({ sort: LIST_SORTS.find((o) => o === v) ?? 'due' }),
					filter.sort !== 'due'
				)}
			</div>
		</form>
	{/if}

	{#if filtered && shown.length === 0}
		<div class="mb-8 rounded-[var(--radius-card)] bg-card px-6 py-8 text-center" role="status">
			<p class="text-[17px] font-semibold">Kein Dauerposten passt</p>
			<p class="mt-1 text-[15px] text-label-2">Ändere die Suche oder die Filter.</p>
			<button
				type="button"
				class="kp-text-button mt-3 text-[17px] text-accent"
				onclick={resetFilter}
			>
				Filter zurücksetzen
			</button>
		</div>
	{:else if filtered}
		<p class="kp-span mb-4 flex items-center gap-3 px-4 text-[13px] text-label-2" role="status">
			<span class="flex-1">
				{shown.length} von {data.items.length} Dauerposten – die Summen gelten für die Auswahl.
			</span>
			<button type="button" class="kp-text-button text-[15px] text-accent" onclick={resetFilter}>
				Filter zurücksetzen
			</button>
		</p>
	{/if}

	{#if data.items.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Repeat class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Dauerposten</p>
			<p class="mt-1 text-[15px] text-label-2">
				{#if data.accountOptions.length}
					Lege mit „+“ regelmäßige Ausgaben, Einnahmen und Umbuchungen an, z. B. Miete, Gehalt oder
					Sparrate.
				{:else if data.user.role === 'admin'}
					Lege zuerst unter <a href={resolve('konten')} class="text-accent">Konten</a> ein Girokonto an;
					danach kannst du hier Dauerposten anlegen.
				{:else}
					Du brauchst ein Konto mit Recht „Bearbeiten“, um Dauerposten anzulegen. Den Zugriff
					vergibt der Admin.
				{/if}
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

	{#if changes.length}
		<section class="mb-8" aria-label="Geplante Änderungen">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Geplante Änderungen</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each changes as { item, change } (`${item.id}-${change.validFrom}`)}
					<li>
						<a
							href={resolve(`dauerposten/${item.id}`)}
							class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{item.name}</span>
								<span class="block truncate text-[13px] text-label-2 tabular">
									ab {formatDay(change.validFrom)}
								</span>
								<span class="block truncate text-[13px] text-label-2 tabular">
									{formatEuro(change.previous)} → {formatEuro(change.amount)}
								</span>
							</span>
							<span class="shrink-0 text-right tabular">
								<span class="block text-[15px] font-semibold">{formatDiff(change.diff)}</span>
								{#if change.percent !== null}
									<span class="block text-[13px] text-label-2">
										{formatPercent(change.percent)}
									</span>
								{/if}
							</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Ab dem Datum rechnen Fälligkeiten und Monatssummen mit dem neuen Betrag.
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
			{#each group.steps as step (step.from)}
				<p class="px-4 text-[13px] text-label-2 tabular">
					Ab {formatDay(step.from)}: Ausgaben {withDiff(step.expense, step.expenseDiff)} · Einnahmen {withDiff(
						step.income,
						step.incomeDiff
					)}
				</p>
			{/each}
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
	<a
		href={resolve('geplant')}
		class="mb-8 flex min-h-11 items-center gap-3 rounded-[var(--radius-row)] bg-card px-4 py-2.5 active:bg-fill"
	>
		<span class="flex-1 text-[17px]">Geplante Zahlungen</span>
		<span class="text-label-2 tabular">{data.plannedCount || ''}</span>
		<span class="text-label-3" aria-hidden="true">›</span>
	</a>
	<p class="-mt-6 mb-8 px-4 text-[13px] text-label-2">
		Einmalige Ausgaben und Einnahmen wie Urlaub, Anschaffungen oder eine Steuererstattung.
	</p>
	<HelpLink chapter="erste-schritte" anchor="dauerposten-erfassen" label="Hilfe zu Dauerposten" />
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
					if (result.type === 'redirect' && fromBooking) {
						// The prefilled form is no page to come back to: the new item takes its place.
						await gotoReplace(result.location, { invalidateAll: true });
					} else await update({ reset: false });
				};
			}}
		>
			{#if fromBooking}
				<input type="hidden" name="fromBooking" value={fromBooking.id} />
				<p class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
					Aus der Buchung übernommen. Bitte Intervall und Bezeichnung prüfen – die Buchung zählt als
					erste Zahlung.
				</p>
			{/if}
			{#key formKey}
				<RecurringFields
					values={formValues}
					errors={formErrors}
					accounts={data.accountOptions}
					targets={data.targetOptions}
					categories={data.categoryGroups}
					contract={formContract}
					defaultLeadDays={data.defaultLeadDays}
					withOnce={false}
					kinds={hasGiro ? ['expense', 'income', 'transfer'] : ['transfer']}
					withAmount
				/>
			{/key}
		</form>
	</Sheet>
{/if}
