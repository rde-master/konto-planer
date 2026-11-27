<script lang="ts">
	import { enhance } from '$app/forms';
	import { gotoReplace } from '#lib/back.svelte.js';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import SearchIcon from '@lucide/svelte/icons/search';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import X from '@lucide/svelte/icons/x';
	import FormField from '#lib/components/FormField.svelte';
	import SegmentedField from '#lib/components/SegmentedField.svelte';
	import Button from '#lib/components/Button.svelte';
	import {
		filterChips,
		filterQuery,
		isFiltered,
		EMPTY_FILTER,
		type BookingFilter
	} from '#lib/search.js';
	import { formatEuroInput } from '#lib/money.js';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import BookingFields from '#lib/components/BookingFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import Logo from '#lib/components/Logo.svelte';
	import { categoryDots, recurringNote } from '#lib/booking-list.js';
	import { takeFab } from '#lib/fab.svelte.js';
	import { formatEuro } from '#lib/money.js';
	import { dayLabel, todayBerlin } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Booking = (typeof data.bookings)[number];

	let createOpen = $state(false);
	let pending = $state(false);
	let formKey = $state(0);

	const options = $derived(data.quickEntry);
	const canCreate = $derived(options.bookingAccounts.length > 0);

	function openCreate() {
		formKey++;
		createOpen = true;
	}
	// Phones: the round plus at the bottom opens this page's form – one plus, not two.
	$effect(() => (canCreate ? takeFab('Buchung erfassen', openCreate) : undefined));

	/** Bookings grouped by day, newest first (the list is already sorted). */
	const days = $derived.by(() => {
		const groups: { day: string; items: Booking[] }[] = [];
		for (const b of data.bookings) {
			const last = groups.at(-1);
			if (last?.day === b.bookingDate) last.items.push(b);
			else groups.push({ day: b.bookingDate, items: [b] });
		}
		return groups;
	});

	function title(b: Booking) {
		return b.counterparty ?? b.purpose ?? b.category?.name ?? 'Buchung';
	}

	function subtitle(b: Booking) {
		const category = b.parts.length
			? `aufgeteilt in ${b.parts.length + (b.parts.reduce((r, p) => r - p.amount, b.amount) !== 0 ? 1 : 0)} Kategorien`
			: b.category
				? b.category.parentName
					? `${b.category.parentName} › ${b.category.name}`
					: b.category.name
				: 'Ohne Kategorie';
		// "vorläufig" stands in front of this, in its own colour.
		return [
			recurringNote(title(b), b.recurringName),
			category,
			data.accountId ? null : b.account.name
		]
			.filter(Boolean)
			.join(' · ');
	}

	const emptyValues = () => ({
		kind: 'expense',
		amount: '',
		accountId: data.accountId ?? options.bookingAccounts[0]?.value ?? '',
		categoryId: '',
		bookingDate: todayBerlin(),
		counterparty: '',
		purpose: ''
	});
	const formValues = $derived(form && 'input' in form && form.input ? form.input : emptyValues());
	const formErrors = $derived(form && 'errors' in form ? form.errors : undefined);
	const created = $derived(form && 'created' in form ? form.created : undefined);

	/** Query without the leading "?" ('' = none). */
	function query(f: BookingFilter, extra: Record<string, string> = {}) {
		return filterQuery(f, extra).slice(1);
	}

	function go(f: BookingFilter) {
		const q = query(f);
		void gotoReplace(q ? resolve(`buchungen?${q}`) : resolve('buchungen'), { reset: false });
	}

	function filter(accountId: string) {
		go({ ...data.filter, accountId: accountId || null });
	}

	const moreQuery = $derived(query(data.filter, { anzahl: String(data.limit + 100) }));

	/** Active filters except the text, as form fields. */
	const hiddenParams = $derived([
		...new URLSearchParams(query({ ...data.filter, text: '' })).entries()
	]);
	/** The field is not bound: text typed before the page is interactive must survive. */
	function search(e: SubmitEvent) {
		e.preventDefault();
		const value = new FormData(e.currentTarget as HTMLFormElement).get('q');
		go({ ...data.filter, text: typeof value === 'string' ? value.trim() : '' });
	}

	const chips = $derived(
		filterChips(data.filter, {
			category: (id) => data.categoryNames[id] ?? 'Kategorie',
			tag: (id) => data.tags.find((t) => t.value === id)?.label ?? 'Tag'
		})
	);
	const filtered = $derived(isFiltered(data.filter));

	let filterOpen = $state(false);
	let filterKey = $state(0);
	let filterForm: HTMLFormElement | undefined = $state();
	function openFilter() {
		filterKey++;
		filterOpen = true;
	}
	function applyFilter(e: SubmitEvent) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const v = (k: string) => {
			const x = fd.get(k);
			return typeof x === 'string' && x ? x : null;
		};
		const pairs: string[] = [];
		for (const [k, val] of [
			['q', data.filter.text],
			['konto', data.filter.accountId],
			['von', v('von')],
			['bis', v('bis')],
			['min', v('min')],
			['max', v('max')],
			['richtung', v('richtung')],
			['kategorie', v('kategorie')],
			['tag', v('tag')]
		] as const)
			if (val && !(k === 'richtung' && val === 'all'))
				pairs.push(`${k}=${encodeURIComponent(val)}`);
		filterOpen = false;
		const q = pairs.join('&');
		void gotoReplace(q ? resolve(`buchungen?${q}`) : resolve('buchungen'), { reset: false });
	}
</script>

<Page title="Buchungen" returns={filtered || !!data.filter.accountId}>
	{#snippet actions()}
		{#if canCreate}
			<button
				type="button"
				aria-label="Buchung erfassen"
				onclick={openCreate}
				class="hidden size-11 place-items-center rounded-full text-accent glass active:opacity-60 md:grid"
			>
				<Plus class="size-6" strokeWidth={2.2} />
			</button>
		{/if}
	{/snippet}

	{#if created}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{created}
		</p>
	{/if}

	<form
		role="search"
		method="GET"
		action={resolve('buchungen')}
		class="kp-span mb-3 flex gap-2"
		onsubmit={search}
	>
		<!-- Without JavaScript the form submits the other filters, too. -->
		{#each hiddenParams as [name, value] (name)}
			<input type="hidden" {name} {value} />
		{/each}
		<label class="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-row)] bg-card px-4">
			<SearchIcon class="size-5 shrink-0 text-label-3" />
			<span class="sr-only">Suchen</span>
			{#key data.filter.text}
				<input
					type="search"
					name="q"
					defaultValue={data.filter.text}
					placeholder="Empfänger, Zweck oder IBAN"
					enterkeyhint="search"
					class="min-w-0 flex-1 bg-transparent py-2.5 text-[17px] outline-none placeholder:text-label-3"
				/>
			{/key}
		</label>
		<button
			type="button"
			onclick={openFilter}
			class="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-row)] bg-card px-4 text-[17px] text-accent active:opacity-60"
		>
			<SlidersHorizontal class="size-5" />
			Filter{#if chips.length - (data.filter.text ? 1 : 0) > 0}
				<span class="tabular">({chips.length - (data.filter.text ? 1 : 0)})</span>
			{/if}
		</button>
	</form>

	{#if chips.length}
		<ul class="kp-span mb-3 flex flex-wrap gap-2" aria-label="Aktive Filter">
			{#each chips as chip (chip.label)}
				{@const q = query(chip.without)}
				<li>
					<a
						href={q ? resolve(`buchungen?${q}`) : resolve('buchungen')}
						aria-label="Filter {chip.label} entfernen"
						data-sveltekit-replacestate
						data-sveltekit-reset="false"
						class="inline-flex items-center gap-1 rounded-full bg-accent/15 px-3 py-1 text-[15px] text-accent"
					>
						{chip.label}
						<X class="size-4" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	{#if data.total}
		<p class="kp-span mb-3 px-4 text-[15px] text-label-2 tabular" aria-label="Treffer">
			{`${data.total.count} ${data.total.count === 1 ? 'Buchung' : 'Buchungen'} · Summe ${formatEuro(data.total.sum)}`}
		</p>
	{/if}

	{#if data.accountFilter.length > 1}
		<ul class="kp-span mb-8 overflow-hidden rounded-[var(--radius-row)] bg-card">
			<SelectField
				label="Konto"
				name="konto"
				options={[{ value: '', label: 'Alle Konten' }, ...data.accountFilter]}
				value={data.accountId ?? ''}
				onchange={filter}
			/>
		</ul>
	{/if}

	{#if data.bookings.length === 0 && filtered}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<SearchIcon class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Keine Buchungen gefunden</p>
			<p class="mt-1 text-[15px] text-label-2">Ändere die Suche oder entferne einen Filter.</p>
		</div>
	{:else if data.bookings.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<ReceiptText class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Buchungen</p>
			<p class="mt-1 text-[15px] text-label-2">
				{canCreate
					? 'Erfasse Ausgaben unterwegs mit dem runden Plus-Knopf. Der Import der Bankexporte folgt.'
					: 'Hier erscheinen die Buchungen deiner Konten.'}
			</p>
		</div>
	{/if}

	{#each days as group (group.day)}
		<section class="mb-6" aria-label={dayLabel(new Date(`${group.day}T12:00:00Z`))}>
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
				{dayLabel(new Date(`${group.day}T12:00:00Z`))}
			</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each group.items as b (b.id)}
					{@const Icon = b.amount > 0 ? ArrowDownLeft : ArrowUpRight}
					{@const dots = categoryDots(b)}
					<li>
						<a
							href={resolve(`buchungen/${b.id}`)}
							class={[
								'relative flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill',
								// Payments of recurring items stand out by their background.
								b.recurringName !== null && 'bg-accent/10'
							]}
						>
							{#if dots.length}
								<span
									class="absolute top-1.5 left-1.5 flex gap-0.5"
									aria-hidden="true"
									data-category-dots
								>
									{#each dots as color (color)}
										<span
											class="size-2 rounded-full"
											style:background-color={accountColorCss(color)}
										></span>
									{/each}
								</span>
							{/if}
							<span class="relative flex shrink-0">
								{#if b.logo || b.counterparty || (b.recurringId && b.purpose)}
									<Logo name={b.counterparty ?? b.purpose ?? '?'} logo={b.logo} />
								{:else}
									<span
										class="grid size-9 shrink-0 place-items-center rounded-full text-white"
										style:background-color={accountColorCss(b.category?.color ?? 'gray')}
									>
										<Icon class="size-5" strokeWidth={2.2} />
									</span>
								{/if}
								{#if b.source === 'provisional'}
									<!-- Not confirmed by the bank yet; the word stands in the line below. -->
									<span
										class="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-provisional text-[11px] leading-none font-bold text-black shadow-sm"
										aria-hidden="true"
										data-provisional-mark
									>
										?
									</span>
								{/if}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{title(b)}</span>
								<span class="block truncate text-[13px] text-label-2">
									{#if b.source === 'provisional'}
										<span class="font-medium text-provisional-text">vorläufig</span> ·
									{/if}
									{subtitle(b)}
								</span>
							</span>
							<span class={['shrink-0 text-[17px] tabular', b.amount > 0 && 'text-income']}>
								{b.amount > 0 ? '+' : ''}{formatEuro(b.amount)}
							</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	{#if data.more}
		<a
			href={resolve(`buchungen?${moreQuery}`)}
			class="kp-span block rounded-[var(--radius-row)] bg-card px-4 py-3 text-center text-accent"
			data-sveltekit-reset="false"
		>
			Ältere Buchungen anzeigen
		</a>
	{/if}
</Page>

{#if canCreate}
	<Sheet
		bind:open={createOpen}
		title="Neue Buchung"
		confirmLabel="Buchen"
		formId="create-booking"
		confirmDisabled={pending}
	>
		<form
			id="create-booking"
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
				<BookingFields
					values={formValues}
					errors={formErrors}
					accounts={options.bookingAccounts}
					categories={options.categoryGroups}
					counterAccounts={data.counterAccounts}
					full
				/>
			{/key}
		</form>
	</Sheet>
{/if}

<Sheet bind:open={filterOpen} title="Filter" confirmLabel="Anwenden" formId="filter-form">
	<form id="filter-form" bind:this={filterForm} onsubmit={applyFilter}>
		{#key filterKey}
			<ul
				class="mb-6 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<SegmentedField
					name="richtung"
					label="Art"
					initial={data.filter.direction}
					options={[
						{ value: 'all', label: 'Alle' },
						{ value: 'out', label: 'Ausgaben' },
						{ value: 'in', label: 'Einnahmen' }
					]}
				/>
				<FormField label="Von (Datum)" name="von" type="date" value={data.filter.from ?? ''} />
				<FormField label="Bis (Datum)" name="bis" type="date" value={data.filter.to ?? ''} />
				<FormField
					label="Betrag ab in €"
					name="min"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0,00"
					value={data.filter.min !== null ? formatEuroInput(data.filter.min) : ''}
				/>
				<FormField
					label="Betrag bis in €"
					name="max"
					inputmode="decimal"
					autocomplete="off"
					placeholder="0,00"
					value={data.filter.max !== null ? formatEuroInput(data.filter.max) : ''}
				/>
				<SelectField
					label="Kategorie"
					name="kategorie"
					options={[{ value: '', label: 'Alle' }]}
					groups={data.categoryGroups}
					value={data.filter.categoryId ?? ''}
				/>
				<SelectField
					label="Tag"
					name="tag"
					options={[{ value: '', label: 'Alle' }, ...data.tags]}
					value={data.filter.tagId ?? ''}
				/>
			</ul>
		{/key}
		<p class="mb-4 px-4 text-[13px] text-label-2">
			Beträge ohne Vorzeichen; eine Hauptkategorie umfasst ihre Unterkategorien und Teile
			aufgeteilter Buchungen.
		</p>
	</form>
	{#if filtered}
		<Button
			type="button"
			variant="tinted"
			onclick={() => {
				filterOpen = false;
				go({ ...EMPTY_FILTER, accountId: data.filter.accountId });
			}}
		>
			Alle Filter entfernen
		</Button>
	{/if}
</Sheet>
