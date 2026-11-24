<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import BookingFields from '#lib/components/BookingFields.svelte';
	import FormField from '#lib/components/FormField.svelte';
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
		adjustment: 'Anpassung',
		provisional: 'Vorläufig aus Dauerposten',
		interest: 'Zinsen (berechnet)',
		goal: 'Umbuchung für Sparziel'
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

	let goalUndoOpen = $state(false);
	const due = $derived(data.due);
	let moveOpen = $state(false);
	let amountOpen = $state(false);
	let skipOpen = $state(false);
	let duePending = $state(false);
	const dueErrors = $derived(
		form?.action === 'changeDue' && 'errors' in form ? form.errors : undefined
	);
	const dueSaved = $derived(
		(form?.action === 'changeDue' || form?.action === 'creditAmount') && 'success' in form
	);
	const credit = $derived(data.credit);
	let creditOpen = $state(false);
	const creditErrors = $derived(
		form?.action === 'creditAmount' && 'errors' in form ? form.errors : undefined
	);

	const creditEnhance: SubmitFunction = () => {
		duePending = true;
		return async ({ result, update }) => {
			duePending = false;
			if (result.type === 'success') creditOpen = false;
			await update({ reset: false });
		};
	};

	const dueEnhance: SubmitFunction = () => {
		duePending = true;
		return async ({ result, update }) => {
			duePending = false;
			if (result.type === 'success') {
				moveOpen = false;
				amountOpen = false;
			}
			await update({ reset: false });
		};
	};

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
	{:else if dueSaved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Vorläufige Buchung geändert.
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
			{#if booking.purpose && booking.source !== 'provisional'}<ListRow
					label="Notiz"
					value={booking.purpose}
				/>{/if}
			<ListRow label="Quelle" value={SOURCE_LABELS[booking.source] ?? booking.source} />
		</ListGroup>
		{#if credit}
			<ListGroup
				header="Zinsgutschrift"
				footer={credit.amountSet
					? 'Betrag von Hand gesetzt; er bleibt, auch wenn sich die Berechnung ändert.'
					: 'Berechnet aus Stand und Zinssatz. Weicht die Bank ab, übernimm ihren Betrag.'}
			>
				<ListRow label="Periode bis" value={formatDay(credit.periodEnd)} />
			</ListGroup>
			{#if credit.canEdit}
				<ListGroup>
					<ListRow label="Betrag anpassen" onclick={() => (creditOpen = true)} />
					{#if credit.amountSet}
						<li>
							<form method="POST" action="?/creditAmount" use:enhance>
								<input type="hidden" name="reset" value="on" />
								<button
									type="submit"
									class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
								>
									Berechneten Betrag verwenden
								</button>
							</form>
						</li>
					{/if}
				</ListGroup>
			{/if}
		{/if}
		{#if data.goalTransfer}
			{@const gt = data.goalTransfer}
			<ListGroup
				header="Sparziel"
				footer="Am Tag der Zahlung vom Sparbuch aufs Girokonto gebucht, damit die Zahlung den Mindestbestand nicht belastet."
			>
				{#if gt.goalVisible && gt.goalId}
					<ListRow label="Sparziel" value={gt.goalName ?? ''} href={`sparziele/${gt.goalId}`} />
				{:else}
					<ListRow label="Sparziel" value={gt.goalName ?? 'gelöscht'} />
				{/if}
			</ListGroup>
			{#if gt.canUndo}
				<ListGroup>
					<ListRow
						label="Umbuchung zurücknehmen"
						destructive
						onclick={() => (goalUndoOpen = true)}
					/>
				</ListGroup>
			{/if}
		{/if}
		{#if due}
			<ListGroup
				header="Vorläufige Buchung"
				footer="Am Fälligkeitstag gebucht, damit der Kontostand stimmt. Der Import bestätigt sie später mit der echten Buchung."
			>
				<ListRow
					label="Dauerposten"
					value={due.recurringName}
					href={`dauerposten/${due.recurringId}`}
				/>
				<ListRow label="Fällig laut Plan" value={formatDay(due.dueDate)} />
				{#if due.moved}<ListRow label="Verschoben auf" value={formatDay(due.bookingDate)} />{/if}
				{#if due.amountSet}<ListRow label="Betrag" value="von Hand angepasst" />{/if}
			</ListGroup>
			{#if due.canManage}
				<ListGroup>
					<ListRow label="Verschieben" onclick={() => (moveOpen = true)} />
					<ListRow label="Betrag anpassen" onclick={() => (amountOpen = true)} />
					<ListRow label="Zurücknehmen" destructive onclick={() => (skipOpen = true)} />
				</ListGroup>
			{/if}
		{/if}
		<p class="mb-8 px-4 text-[13px] text-label-2">
			{booking.source === 'interest'
				? 'Zinsgutschriften berechnet die App selbst.'
				: booking.source === 'goal'
					? 'Umbuchungen für Sparziele bucht die App selbst.'
					: booking.source === 'provisional'
						? 'Vorläufige Buchungen ergeben sich aus dem Dauerposten.'
						: booking.source === 'adjustment'
							? 'Anpassungen entstehen beim Korrigieren des Kontostands. Ändern lassen sie sich nicht, nur löschen.'
							: 'Du kannst diese Buchung nur ansehen.'}
		</p>
		{#if booking.canDelete}
			<ListGroup header="Verwaltung">
				<ListRow label="Anpassung löschen" destructive onclick={() => (deleteOpen = true)} />
			</ListGroup>
		{/if}
		{#if data.templateAccounts.length && !['adjustment', 'interest', 'goal'].includes(booking.source)}
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

{#if data.goalTransfer?.canUndo}
	<Sheet bind:open={goalUndoOpen} title="Umbuchung zurücknehmen">
		<p class="mb-6 px-4 text-center text-[15px]">
			Beide Buchungen (Sparbuch und Girokonto) werden entfernt. Der Betrag gilt wieder als für das
			Sparziel zurückgelegt.
		</p>
		<form method="POST" action="?/goalUndo" use:enhance>
			<Button type="submit" variant="destructive">Zurücknehmen</Button>
		</form>
	</Sheet>
{/if}

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

{#if due?.canManage}
	<Sheet
		bind:open={moveOpen}
		title="Verschieben"
		confirmLabel="Sichern"
		formId="due-move"
		confirmDisabled={duePending}
	>
		<form id="due-move" method="POST" action="?/changeDue" use:enhance={dueEnhance}>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Gebucht am"
					name="bookingDate"
					type="date"
					value={due.bookingDate}
					required
					error={dueErrors?.bookingDate}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Z. B. wenn die Abbuchung später kam. Der Dauerposten selbst bleibt unverändert.
			</p>
		</form>
	</Sheet>

	<Sheet
		bind:open={amountOpen}
		title="Betrag anpassen"
		confirmLabel="Sichern"
		formId="due-amount"
		confirmDisabled={duePending}
	>
		<form id="due-amount" method="POST" action="?/changeDue" use:enhance={dueEnhance}>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Betrag in €"
					name="amount"
					value={formatEuroInput(due.amount)}
					inputmode="decimal"
					autocomplete="off"
					required
					error={dueErrors?.amount}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Nur für diese Fälligkeit, z. B. bei schwankenden Beträgen. Künftige Beträge änderst du am
				Dauerposten.
			</p>
		</form>
	</Sheet>

	<Sheet bind:open={skipOpen} title="Zurücknehmen">
		<p class="mb-6 px-4 text-center text-[15px]">
			Die vorläufige Buchung über {formatEuro(booking.amount)} wird entfernt; die Fälligkeit gilt als
			nicht gebucht. Am Dauerposten lässt sie sich wiederherstellen.
		</p>
		<form method="POST" action="?/skipDue" use:enhance>
			<Button type="submit" variant="destructive">Zurücknehmen</Button>
		</form>
	</Sheet>
{/if}

{#if credit?.canEdit}
	<Sheet
		bind:open={creditOpen}
		title="Betrag anpassen"
		confirmLabel="Sichern"
		formId="credit-amount"
		confirmDisabled={duePending}
	>
		<form id="credit-amount" method="POST" action="?/creditAmount" use:enhance={creditEnhance}>
			<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<FormField
					label="Zinsen laut Bank in €"
					name="amount"
					value={formatEuroInput(credit.amount)}
					inputmode="decimal"
					autocomplete="off"
					required
					error={creditErrors?.amount}
				/>
			</ul>
		</form>
	</Sheet>
{/if}
