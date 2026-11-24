<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import BookingFields from '#lib/components/BookingFields.svelte';
	import TemplateFields from '#lib/components/TemplateFields.svelte';
	import { templateValuesFromInput, type TemplateFormValues } from '#lib/templates.js';
	import Zap from '@lucide/svelte/icons/zap';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const booking = $derived(data.booking);
	const income = $derived(booking.amount > 0);
	const Icon = $derived(income ? ArrowDownLeft : ArrowUpRight);
	const title = $derived(
		booking.counterparty ?? booking.purpose ?? booking.category?.name ?? 'Buchung'
	);
	const categoryText = $derived(
		booking.category
			? booking.category.parentName
				? `${booking.category.parentName} › ${booking.category.name}`
				: booking.category.name
			: 'Ohne Kategorie'
	);
	const SOURCE_LABELS: Record<string, string> = {
		manual: 'Manuell erfasst',
		import: 'Import',
		adjustment: 'Anpassung'
	};

	let savePending = $state(false);
	let deleteOpen = $state(false);
	let templateOpen = $state(false);
	let templatePending = $state(false);
	let templateKey = $state(0);
	let templateErrors: Partial<Record<string, string>> | undefined = $state();
	let templateValues: TemplateFormValues = $state(fromBooking());

	/** Template prefilled from this booking (the account only if the user may book on it). */
	function fromBooking(): TemplateFormValues {
		const b = data.booking;
		return {
			name: (b.counterparty ?? b.category?.name ?? '').slice(0, 30),
			kind: b.amount > 0 ? 'income' : 'expense',
			amount: formatEuroInput(Math.abs(b.amount)),
			accountId: data.templateAccounts.some((a) => a.value === b.accountId) ? b.accountId : null,
			categoryId: b.categoryId,
			counterparty: b.counterparty,
			shared: false
		};
	}

	function openTemplate() {
		templateValues = fromBooking();
		templateErrors = undefined;
		templateKey++;
		templateOpen = true;
	}

	const templateSaved = $derived(
		form?.action === 'saveTemplate' && 'template' in form ? form.template : undefined
	);

	const updateInput = $derived(
		form?.action === 'update' && 'input' in form ? form.input : undefined
	);
	const updateErrors = $derived(
		form?.action === 'update' && 'errors' in form ? form.errors : undefined
	);
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const saved = $derived(form?.action === 'update' && 'success' in form);

	const values = $derived(
		updateInput ?? {
			kind: income ? 'income' : 'expense',
			amount: formatEuroInput(Math.abs(booking.amount)),
			accountId: booking.accountId,
			categoryId: booking.categoryId,
			bookingDate: booking.bookingDate,
			counterparty: booking.counterparty,
			purpose: booking.purpose
		}
	);
</script>

<Page {title} back={{ path: 'buchungen', label: 'Buchungen' }}>
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{:else if saved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Änderungen gesichert.
		</p>
	{:else if templateSaved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Vorlage „{templateSaved}“ gesichert. Sie steht jetzt in der Schnellerfassung.
		</p>
	{/if}

	<section class="mb-8 flex items-center gap-4 rounded-[var(--radius-card)] bg-card p-5">
		<span
			class="grid size-14 shrink-0 place-items-center rounded-full text-white"
			style:background-color={accountColorCss(booking.category?.color ?? 'gray')}
		>
			<Icon class="size-7" strokeWidth={2} />
		</span>
		<div class="min-w-0">
			<p class="text-[13px] text-label-2">
				{formatDay(booking.bookingDate)} · {booking.account.name}
			</p>
			<p class={['text-[28px] font-bold tabular', income && 'text-income']}>
				{income ? '+' : ''}{formatEuro(booking.amount)}
			</p>
			<p class="truncate text-[13px] text-label-2">{categoryText}</p>
		</div>
	</section>

	{#if !booking.counts}
		<p class="-mt-6 mb-8 px-4 text-[13px] text-label-2">
			Liegt vor dem Startsaldo des Kontos und zählt deshalb nicht zum Kontostand.
		</p>
	{/if}

	{#if booking.canEdit}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				savePending = true;
				return async ({ update }) => {
					await update({ reset: false });
					savePending = false;
				};
			}}
		>
			<BookingFields
				{values}
				errors={updateErrors}
				accounts={data.accounts}
				categories={data.categoryGroups}
				full
			/>
			<div class="mt-6 mb-8">
				<Button type="submit" disabled={savePending}>Sichern</Button>
			</div>
		</form>

		<ListGroup header="Verwaltung">
			<ListRow
				label="Als Vorlage sichern"
				icon={Zap}
				iconColor="bg-[#5856d6]"
				onclick={openTemplate}
			/>
			<ListRow label="Buchung löschen" destructive onclick={() => (deleteOpen = true)} />
		</ListGroup>
	{:else}
		<ListGroup header="Details">
			<ListRow label="Datum" value={formatDay(booking.bookingDate)} />
			<ListRow label="Konto" value={booking.account.name} />
			<ListRow label="Kategorie" value={categoryText} />
			{#if booking.counterparty}<ListRow
					label="Empfänger/Zahler"
					value={booking.counterparty}
				/>{/if}
			{#if booking.purpose}<ListRow label="Notiz" value={booking.purpose} />{/if}
			<ListRow label="Quelle" value={SOURCE_LABELS[booking.source] ?? booking.source} />
		</ListGroup>
		<p class="mb-8 px-4 text-[13px] text-label-2">
			{booking.source === 'adjustment'
				? 'Anpassungen entstehen beim Korrigieren des Kontostands. Ändern lassen sie sich nicht, nur löschen.'
				: 'Du kannst diese Buchung nur ansehen.'}
		</p>
		{#if booking.canDelete}
			<ListGroup header="Verwaltung">
				<ListRow label="Anpassung löschen" destructive onclick={() => (deleteOpen = true)} />
			</ListGroup>
		{/if}
		{#if data.templateAccounts.length && booking.source !== 'adjustment'}
			<ListGroup>
				<ListRow
					label="Als Vorlage sichern"
					icon={Zap}
					iconColor="bg-[#5856d6]"
					onclick={openTemplate}
				/>
			</ListGroup>
		{/if}
	{/if}
</Page>

{#if booking.canDelete}
	<Sheet
		bind:open={deleteOpen}
		title={booking.source === 'adjustment' ? 'Anpassung löschen' : 'Buchung löschen'}
	>
		<p class="mb-6 px-4 text-center text-[15px]">
			Die {booking.source === 'adjustment' ? 'Anpassung' : 'Buchung'} über {formatEuro(
				booking.amount
			)} wird endgültig gelöscht.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}

<Sheet
	bind:open={templateOpen}
	title="Als Vorlage sichern"
	confirmLabel="Sichern"
	formId="template-form"
	confirmDisabled={templatePending}
>
	<form
		id="template-form"
		method="POST"
		action="?/saveTemplate"
		use:enhance={() => {
			templatePending = true;
			return async ({ result, update }) => {
				templatePending = false;
				if (result.type === 'success') templateOpen = false;
				else if (result.type === 'failure') {
					const input = result.data?.input as Record<string, string> | undefined;
					if (input) templateValues = templateValuesFromInput(input);
					templateErrors = result.data?.errors as typeof templateErrors;
					templateKey++;
				}
				await update({ reset: false });
			};
		}}
	>
		{#key templateKey}
			<TemplateFields
				values={templateValues}
				errors={templateErrors}
				accounts={data.templateAccounts}
				categories={data.categoryGroups}
			/>
		{/key}
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Leere den Betrag, wenn er jedes Mal anders ist. Vorlagen verwaltest du unter Einstellungen ›
			Vorlagen.
		</p>
	</form>
</Sheet>
