<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import BookingFields from '#lib/components/BookingFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
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
		const category = b.category
			? b.category.parentName
				? `${b.category.parentName} › ${b.category.name}`
				: b.category.name
			: 'Ohne Kategorie';
		return [
			b.source === 'provisional' ? 'vorläufig' : null,
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

	function filter(accountId: string) {
		void goto(accountId ? resolve(`buchungen?konto=${accountId}`) : resolve('buchungen'), {
			replace: true
		});
	}

	const moreHref = $derived(
		resolve(
			`buchungen?anzahl=${data.limit + 100}${data.accountId ? `&konto=${data.accountId}` : ''}`
		)
	);
</script>

<Page title="Buchungen">
	{#snippet actions()}
		{#if canCreate}
			<button
				type="button"
				aria-label="Buchung erfassen"
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

	{#if created}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{created}
		</p>
	{/if}

	{#if data.accountFilter.length > 1}
		<ul class="mb-8 overflow-hidden rounded-[var(--radius-row)] bg-card">
			<SelectField
				label="Konto"
				name="konto"
				options={[{ value: '', label: 'Alle Konten' }, ...data.accountFilter]}
				value={data.accountId ?? ''}
				onchange={filter}
			/>
		</ul>
	{/if}

	{#if data.bookings.length === 0}
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
					<li>
						<a
							href={resolve(`buchungen/${b.id}`)}
							class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full text-white"
								style:background-color={accountColorCss(b.category?.color ?? 'gray')}
							>
								<Icon class="size-5" strokeWidth={2.2} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{title(b)}</span>
								<span class="block truncate text-[13px] text-label-2">{subtitle(b)}</span>
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
			href={moreHref}
			class="block rounded-[var(--radius-row)] bg-card px-4 py-3 text-center text-accent"
			data-sveltekit-noscroll
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
					full
				/>
			{/key}
		</form>
	</Sheet>
{/if}
