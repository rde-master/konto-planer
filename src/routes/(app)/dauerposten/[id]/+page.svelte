<script lang="ts">
	import { enhance } from '$app/forms';
	import ArrowDownLeft from '@lucide/svelte/icons/arrow-down-left';
	import ArrowUpRight from '@lucide/svelte/icons/arrow-up-right';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import RecurringFields from '#lib/components/RecurringFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatIban } from '#lib/iban.js';
	import { formatDay } from '#lib/dates.js';
	import {
		cancelSoon,
		contractStatus,
		periodLabel,
		reminderDay,
		renewalLabel
	} from '#lib/contracts.js';
	import { KIND_LABELS, PAYMENT_METHOD_LABELS, amountOn, intervalLabel } from '#lib/recurring.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const item = $derived(data.item);
	const transfer = $derived(item.kind === 'transfer');
	const Icon = $derived(
		transfer ? ArrowLeftRight : item.kind === 'income' ? ArrowDownLeft : ArrowUpRight
	);
	const iconColor = $derived(transfer ? 'indigo' : (item.category?.color ?? 'gray'));
	/** May archive, restore and delete (decided on the server). */
	const canManage = $derived(item.canManage);
	/** Entry valid today (amounts are sorted newest first). */
	const currentId = $derived(
		(item.amounts.find((a) => a.validFrom <= data.today) ?? item.amounts.at(-1))?.id
	);
	// A transfer is out and in at the same time, so it is shown without sign.
	const sign = $derived(transfer ? '' : item.kind === 'income' ? '+' : '−');

	let savePending = $state(false);
	let deleteOpen = $state(false);
	let amountOpen = $state(false);
	let amountKey = $state(0);
	/** Entry being edited in the amount sheet; null when adding. */
	let amountEntry: { id: string; amount: number; validFrom: string } | null = $state(null);

	const updateInput = $derived(
		form?.action === 'update' && 'input' in form ? form.input : undefined
	);
	const updateErrors = $derived(
		form?.action === 'update' && 'errors' in form ? form.errors : undefined
	);
	const amountErrors = $derived(
		form?.action === 'amount' && 'errors' in form ? form.errors : undefined
	);
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const status = $derived.by(() => {
		if (!form || !('success' in form)) return undefined;
		return {
			update: 'Änderungen gesichert.',
			amount: 'Betragsverlauf gesichert.',
			amountDelete: 'Betrag gelöscht.',
			archive: 'Dauerposten archiviert.',
			restore: 'Dauerposten wiederhergestellt.'
		}[form.action];
	});

	const fieldValues = $derived(updateInput ?? { ...item, amount: undefined });
	const contractValues = $derived(
		updateInput ? (updateInput.contract ? updateInput : null) : item.contract
	);
	const contract = $derived(item.contract);
	const contractState = $derived(contract ? contractStatus(contract, data.today) : null);
	const reminder = $derived(
		contract ? reminderDay(contract, data.today, data.defaultLeadDays) : null
	);
	const soon = $derived(
		contract !== null && !item.archivedAt && cancelSoon(contract, data.today, data.defaultLeadDays)
	);

	function openAmount(entry: { id: string; amount: number; validFrom: string } | null) {
		amountEntry = entry;
		amountKey++;
		amountOpen = true;
	}
</script>

<Page title={item.name} back={{ path: 'dauerposten', label: 'Dauerposten' }}>
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{:else if status}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{status}
		</p>
	{/if}

	<section class="mb-8 flex items-center gap-4 rounded-[var(--radius-card)] bg-card p-5">
		<span
			class="grid size-14 shrink-0 place-items-center rounded-full text-white"
			style:background-color={accountColorCss(iconColor)}
		>
			<Icon class="size-7" strokeWidth={2} />
		</span>
		<div class="min-w-0">
			<p class="text-[13px] text-label-2">
				{KIND_LABELS[item.kind]} · {intervalLabel(item)}{item.archivedAt ? ' · archiviert' : ''}
			</p>
			<p
				class={['text-[28px] font-bold tabular', item.kind === 'income' && 'text-income']}
				data-testid="current-amount"
			>
				{item.variable ? '≈ ' : ''}{sign}{formatEuro(item.amount ?? 0)}
			</p>
			<p class="truncate text-[13px] text-label-2">
				{transfer
					? `${item.account.name} → ${item.targetAccount?.name ?? '–'}`
					: [
							item.category
								? item.category.parentName
									? `${item.category.parentName} › ${item.category.name}`
									: item.category.name
								: 'Ohne Kategorie',
							item.account.name
						].join(' · ')}
			</p>
		</div>
	</section>

	{#if data.upcoming.length}
		<ListGroup header="Nächste Fälligkeiten" footer="Noch ohne Verschiebung auf Bankarbeitstage.">
			{#each data.upcoming as day (day)}
				<ListRow
					label={formatDay(day)}
					value={`${sign}${formatEuro(amountOn(item.amounts, day) ?? 0)}`}
				/>
			{/each}
		</ListGroup>
	{:else if !item.archivedAt}
		<p class="mb-8 px-4 text-[15px] text-label-2">
			Keine weiteren Fälligkeiten – der Dauerposten ist beendet.
		</p>
	{/if}

	{#if contract && contractState}
		<ListGroup
			header="Vertrag"
			footer={soon
				? 'Die Kündigungsfrist läuft bald ab. Die Kündigung muss bis zum genannten Tag beim Anbieter sein.'
				: undefined}
		>
			{#if contractState.state === 'fixed'}
				<ListRow label="Kündigen bis" value={formatDay(contractState.deadline)} />
				<ListRow label="Vertragsende dann" value={formatDay(contractState.end)} />
			{:else if contractState.state === 'anytime'}
				<ListRow label="Kündbar" value="jederzeit" />
				<ListRow label="Frühestes Ende" value={formatDay(contractState.end)} />
			{:else if contractState.state === 'ends'}
				<ListRow label="Endet am" value={`${formatDay(contractState.end)} (ohne Kündigung)`} />
			{:else}
				<ListRow label="Gekündigt am" value={formatDay(contract.cancelledOn ?? '')} />
				<ListRow label="Vertragsende" value={formatDay(contractState.end)} />
			{/if}
			<ListRow
				label="Kündigungsfrist"
				value={periodLabel(contract.noticeEvery, contract.noticeUnit)}
			/>
			<ListRow label="Verlängerung" value={renewalLabel(contract)} />
			{#if contract.termEnd}<ListRow
					label="Laufzeit bis"
					value={formatDay(contract.termEnd)}
				/>{/if}
			{#if reminder}<ListRow label="Bald kündbar ab" value={formatDay(reminder)} />{/if}
		</ListGroup>
	{/if}

	<section class="mb-8">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Betragsverlauf</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			aria-label="Betragsverlauf"
		>
			{#each item.amounts as entry (entry.id)}
				{@const state =
					entry.id === currentId ? 'aktuell' : entry.validFrom > data.today ? 'geplant' : null}
				{#if item.canEdit}
					<ListRow
						label={`ab ${formatDay(entry.validFrom)}`}
						value={`${state ? `${state} · ` : ''}${formatEuro(entry.amount)}`}
						onclick={() => openAmount(entry)}
					/>
				{:else}
					<ListRow
						label={`ab ${formatDay(entry.validFrom)}`}
						value={`${state ? `${state} · ` : ''}${formatEuro(entry.amount)}`}
					/>
				{/if}
			{/each}
			{#if item.canEdit}
				<li>
					<button
						type="button"
						onclick={() => openAmount(null)}
						class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-accent active:bg-fill"
					>
						Betrag ändern
					</button>
				</li>
			{/if}
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Jede Preisänderung bleibt erhalten. „Gültig ab“ darf auch in der Zukunft liegen.
		</p>
	</section>

	{#if item.canEdit}
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
			<RecurringFields
				values={fieldValues}
				errors={updateErrors}
				accounts={data.accountOptions}
				targets={data.targetOptions}
				categories={data.categoryGroups}
				contract={contractValues}
				defaultLeadDays={data.defaultLeadDays}
				kinds={transfer ? ['transfer'] : ['expense', 'income']}
			/>
			<Button type="submit" disabled={savePending} class="mb-8">Sichern</Button>
		</form>
	{:else}
		<ListGroup
			header="Angaben"
			footer={item.archivedAt
				? 'Archivierte Dauerposten sind schreibgeschützt.'
				: 'Du kannst diesen Dauerposten nur ansehen.'}
		>
			{#if transfer}
				<ListRow label="Von Konto" value={item.account.name} />
				<ListRow label="Auf Konto" value={item.targetAccount?.name ?? '–'} />
			{:else}
				<ListRow label="Konto" value={item.account.name} />
			{/if}
			<ListRow label="Start" value={formatDay(item.startDate)} />
			{#if item.endDate}<ListRow label="Ende" value={formatDay(item.endDate)} />{/if}
			{#if item.counterparty}
				<ListRow
					label={item.kind === 'income' ? 'Zahler' : 'Empfänger'}
					value={item.counterparty}
				/>
			{/if}
			{#if item.iban}<ListRow label="IBAN" value={formatIban(item.iban)} />{/if}
			{#if item.paymentMethod}
				<ListRow label="Zahlart" value={PAYMENT_METHOD_LABELS[item.paymentMethod]} />
			{/if}
			{#if item.mandateReference}<ListRow
					label="Mandatsreferenz"
					value={item.mandateReference}
				/>{/if}
			{#if item.creditorId}<ListRow label="Gläubiger-ID" value={item.creditorId} />{/if}
			{#if item.isSalary}<ListRow label="Gehalt" value="Ja" />{/if}
		</ListGroup>
	{/if}

	{#if item.createdByName}
		<p class="mb-8 px-4 text-[13px] text-label-2">Angelegt von {item.createdByName}.</p>
	{/if}

	{#if canManage}
		<ListGroup header="Verwaltung">
			<li>
				<form method="POST" action={item.archivedAt ? '?/restore' : '?/archive'} use:enhance>
					<button
						type="submit"
						class={[
							'flex min-h-11 w-full items-center px-4 py-2.5 text-left active:bg-fill',
							item.archivedAt && 'text-accent'
						]}
					>
						{item.archivedAt ? 'Wiederherstellen' : 'Archivieren'}
					</button>
				</form>
			</li>
			{#if !data.hasData}
				<ListRow label="Dauerposten löschen" destructive onclick={() => (deleteOpen = true)} />
			{/if}
		</ListGroup>
	{/if}
</Page>

{#if item.canEdit}
	<Sheet
		bind:open={amountOpen}
		title={amountEntry ? 'Betrag bearbeiten' : 'Betrag ändern'}
		confirmLabel="Sichern"
		formId="amount-form"
	>
		<form
			id="amount-form"
			method="POST"
			action={amountEntry ? '?/amountUpdate' : '?/amountAdd'}
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') amountOpen = false;
					await update({ reset: false });
				}}
		>
			{#key amountKey}
				{#if amountEntry}<input type="hidden" name="amountId" value={amountEntry.id} />{/if}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="Betrag in €"
						name="amount"
						value={amountEntry ? formatEuroInput(amountEntry.amount) : ''}
						inputmode="decimal"
						autocomplete="off"
						placeholder="0,00"
						required
						error={amountErrors?.amount}
					/>
					<FormField
						label="Gültig ab"
						name="validFrom"
						type="date"
						value={amountEntry?.validFrom ?? data.today}
						required
						error={amountErrors?.validFrom}
					/>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Ab diesem Tag gilt der neue Betrag; frühere Fälligkeiten behalten den alten.
				</p>
			{/key}
		</form>
		{#if amountEntry && item.amounts.length > 1}
			<form
				method="POST"
				action="?/amountDelete"
				class="mt-8"
				use:enhance={() =>
					async ({ update }) => {
						amountOpen = false;
						await update();
					}}
			>
				<input type="hidden" name="amountId" value={amountEntry.id} />
				<Button type="submit" variant="tinted" class="!text-danger">Betrag löschen</Button>
			</form>
		{/if}
	</Sheet>
{/if}

{#if canManage}
	<Sheet bind:open={deleteOpen} title="Dauerposten löschen">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{item.name}“ wird mit seinem Betragsverlauf endgültig gelöscht. Hat er schon Buchungen, kann
			er nur archiviert werden.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}
