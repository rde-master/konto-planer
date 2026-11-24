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
	import FileText from '@lucide/svelte/icons/file-text';
	import Trash from '@lucide/svelte/icons/trash-2';
	import { resolve } from '$app/paths';
	import { formatSize } from '#lib/files.js';
	import FormField from '#lib/components/FormField.svelte';
	import RecurringFields from '#lib/components/RecurringFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput, parseEuro } from '#lib/money.js';
	import { amountBefore, changeDelta, formatDiff, formatPercent } from '#lib/planned.js';
	import { formatIban } from '#lib/iban.js';
	import { formatDay } from '#lib/dates.js';
	import { DUE_STATUS_LABELS } from '#lib/due.js';
	import {
		cancelSoon,
		contractStatus,
		periodLabel,
		reminderDay,
		renewalLabel
	} from '#lib/contracts.js';
	import {
		KIND_LABELS,
		PAYMENT_METHOD_LABELS,
		intervalLabel,
		monthlyEquivalent,
		pauseLabel,
		pauseRelevant
	} from '#lib/recurring.js';
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
	let uploading = $state(false);
	let attachmentDeleteOpen = $state(false);
	let attachmentToDelete: { id: string; fileName: string } | null = $state(null);
	function askDeleteAttachment(file: { id: string; fileName: string }) {
		attachmentToDelete = file;
		attachmentDeleteOpen = true;
	}
	let pauseOpen = $state(false);
	let pauseKey = $state(0);
	const paused = $derived(pauseRelevant(item, data.today));
	const pauseText = $derived(pauseLabel(item, data.today, formatDay));
	const pauseErrors = $derived(
		form?.action === 'pause' && 'errors' in form ? form.errors : undefined
	);
	function openPause() {
		pauseKey++;
		pauseOpen = true;
	}
	let amountOpen = $state(false);
	let amountKey = $state(0);
	/** Entry being edited in the amount sheet; null when adding. */
	let amountEntry: { id: string; amount: number; validFrom: string } | null = $state(null);
	let amountInput = $state('');
	let validFromInput = $state('');
	/** Old and new amount for the entered change, or null while the input is incomplete. */
	const preview = $derived.by(() => {
		const next = parseEuro(amountInput);
		if (next === null || next <= 0 || !validFromInput) return null;
		const others = item.amounts.filter((a) => a.id !== amountEntry?.id);
		const previous = amountBefore(others, validFromInput);
		if (previous === null) return null;
		return {
			previous,
			next,
			...changeDelta(previous, next),
			monthly: monthlyEquivalent(next, item) - monthlyEquivalent(previous, item)
		};
	});

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
			pause: 'Pause gesichert.',
			pauseEnd: 'Pause beendet.',
			attachmentAdd: 'PDF hinzugefügt.',
			attachmentDelete: 'PDF gelöscht.',
			archive: 'Dauerposten archiviert.',
			restore: 'Dauerposten wiederhergestellt.',
			restoreDue: 'Fälligkeit wieder vorläufig gebucht.'
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
		amountInput = entry ? formatEuroInput(entry.amount) : '';
		validFromInput = entry?.validFrom ?? data.today;
		amountKey++;
		amountOpen = true;
	}
</script>

<Page
	title={item.name}
	back={item.interval === 'once'
		? { path: 'geplant', label: 'Geplant' }
		: { path: 'dauerposten', label: 'Dauerposten' }}
>
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
				{[KIND_LABELS[item.kind], intervalLabel(item), item.archivedAt ? 'archiviert' : pauseText]
					.filter(Boolean)
					.join(' · ')}
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
		<ListGroup
			header="Nächste Fälligkeiten"
			footer="Fällt ein Termin auf ein Wochenende oder einen Bankfeiertag, gilt der nächste Bankarbeitstag."
		>
			{#each data.upcoming as due (due.dueDate)}
				<ListRow
					label={due.bookingDate === due.dueDate
						? formatDay(due.bookingDate)
						: `${formatDay(due.bookingDate)} (statt ${formatDay(due.dueDate)})`}
					value={`${sign}${formatEuro(due.amount)}`}
				/>
			{/each}
		</ListGroup>
	{:else if !item.archivedAt}
		<p class="mb-8 px-4 text-[15px] text-label-2">
			{paused
				? 'Keine Fälligkeiten – der Dauerposten ruht, bis die Pause beendet wird.'
				: 'Keine weiteren Fälligkeiten – der Dauerposten ist beendet.'}
		</p>
	{/if}

	{#if data.recent.length}
		<section class="mb-8" aria-label="Letzte Fälligkeiten">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Letzte Fälligkeiten</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.recent as due (due.id)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2">
						<span class="min-w-0 flex-1">
							{#if due.bookingId}
								<a
									href={resolve(`buchungen/${due.bookingId}`)}
									class="block text-[17px] text-accent"
								>
									{formatDay(due.bookingDate)}
								</a>
							{:else}
								<span class="block text-[17px]">{formatDay(due.bookingDate)}</span>
							{/if}
							<span class="block text-[13px] text-label-2">{DUE_STATUS_LABELS[due.status]}</span>
						</span>
						{#if due.status === 'skipped' && item.canManage}
							<form method="POST" action="?/restoreDue" use:enhance>
								<input type="hidden" name="dueId" value={due.id} />
								<button type="submit" class="text-[15px] text-accent">Wiederherstellen</button>
							</form>
						{:else}
							<span
								class={[
									'shrink-0 text-[17px] tabular',
									due.status === 'skipped' && 'text-label-3 line-through'
								]}
							>
								{sign}{formatEuro(due.amount)}
							</span>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Am Fälligkeitstag vorläufig gebucht; der Import bestätigt sie später.
			</p>
		</section>
	{/if}

	{#if paused || item.canEdit}
		<ListGroup header="Pause" footer="Während der Pause entstehen keine Fälligkeiten.">
			{#if paused}
				<ListRow label="Von" value={formatDay(item.pauseFrom ?? '')} />
				<ListRow
					label="Bis"
					value={item.pauseUntil ? formatDay(item.pauseUntil) : 'bis auf Weiteres'}
				/>
				{#if item.canEdit}
					<li>
						<button
							type="button"
							onclick={openPause}
							class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-accent active:bg-fill"
						>
							Pause ändern
						</button>
					</li>
					<li>
						<form method="POST" action="?/pauseEnd" use:enhance>
							<button
								type="submit"
								class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-accent active:bg-fill"
							>
								Pause beenden
							</button>
						</form>
					</li>
				{/if}
			{:else}
				<li>
					<button
						type="button"
						onclick={openPause}
						class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-accent active:bg-fill"
					>
						Pausieren
					</button>
				</li>
			{/if}
		</ListGroup>
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
						Änderung planen
					</button>
				</li>
			{/if}
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Jede Preisänderung bleibt erhalten. Eine Änderung mit künftigem „Gültig ab“ gilt erst ab dem
			Tag; bis dahin rechnet die App mit dem bisherigen Betrag.
		</p>
	</section>

	{#if data.attachments.length || item.canEdit}
		<section class="mb-8" aria-labelledby="documents-heading">
			<h2 id="documents-heading" class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
				Dokumente
			</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.attachments as file (file.id)}
					<li class="flex min-h-14 items-center gap-3 pr-2 pl-4">
						<a
							href={resolve(`dauerposten/${item.id}/anhang/${file.id}`)}
							target="_blank"
							rel="noopener"
							class="flex min-w-0 flex-1 items-center gap-3 py-2 active:opacity-60"
						>
							<FileText class="size-6 shrink-0 text-danger" strokeWidth={1.8} />
							<span class="min-w-0">
								<span class="block truncate text-[17px]">{file.fileName}</span>
								<span class="block text-[13px] text-label-2">
									{formatSize(file.size)} · {file.createdAt.toLocaleDateString('de-DE')}
								</span>
							</span>
						</a>
						{#if item.canEdit}
							<button
								type="button"
								aria-label={`${file.fileName} löschen`}
								onclick={() => askDeleteAttachment(file)}
								class="grid size-11 shrink-0 place-items-center text-danger active:opacity-60"
							>
								<Trash class="size-5" />
							</button>
						{/if}
					</li>
				{/each}
				{#if item.canEdit}
					<li>
						<form
							method="POST"
							action="?/attachmentAdd"
							enctype="multipart/form-data"
							use:enhance={() => {
								uploading = true;
								return async ({ update }) => {
									await update();
									uploading = false;
								};
							}}
						>
							<label
								class={[
									'flex min-h-11 w-full cursor-pointer items-center px-4 py-2.5 text-accent active:bg-fill',
									uploading && 'opacity-50'
								]}
							>
								{uploading ? 'Wird hochgeladen …' : 'PDF hinzufügen'}
								<input
									type="file"
									name="file"
									accept="application/pdf,.pdf"
									class="sr-only"
									disabled={uploading}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
								/>
							</label>
						</form>
					</li>
				{/if}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				{item.canEdit
					? 'Z. B. Vertrag oder Preiserhöhung, nur PDF bis 10 MB.'
					: data.attachments.length
						? 'Tippen zum Öffnen.'
						: ''}
			</p>
		</section>
	{/if}

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

	{#if !item.canEdit && (item.customerNumber || item.note || contract?.cancelName || contract?.cancelStreet || contract?.cancelCity || contract?.cancelEmail)}
		<ListGroup header="Details">
			{#if item.customerNumber}<ListRow label="Kundennummer" value={item.customerNumber} />{/if}
			{#if contract && (contract.cancelName || contract.cancelStreet || contract.cancelCity || contract.cancelEmail)}
				<li class="px-4 py-2.5">
					<p class="text-[13px] text-label-2">Kündigungsadresse</p>
					<p class="text-[17px] whitespace-pre-line">
						{[
							contract.cancelName,
							contract.cancelStreet,
							[contract.cancelPostalCode, contract.cancelCity].filter(Boolean).join(' '),
							contract.cancelEmail
						]
							.filter(Boolean)
							.join('\n')}
					</p>
				</li>
			{/if}
			{#if item.note}
				<li class="px-4 py-2.5">
					<p class="text-[13px] text-label-2">Notiz</p>
					<p class="text-[17px] whitespace-pre-line">{item.note}</p>
				</li>
			{/if}
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
		bind:open={pauseOpen}
		title={paused ? 'Pause ändern' : 'Pausieren'}
		confirmLabel="Sichern"
		formId="pause-form"
	>
		<form
			id="pause-form"
			method="POST"
			action="?/pause"
			use:enhance={() =>
				async ({ result, update }) => {
					if (result.type === 'success') pauseOpen = false;
					await update({ reset: false });
				}}
		>
			{#key pauseKey}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="Pause ab"
						name="pauseFrom"
						type="date"
						value={paused ? (item.pauseFrom ?? data.today) : data.today}
						required
						error={pauseErrors?.pauseFrom}
					/>
					<FormField
						label="Pause bis (optional)"
						name="pauseUntil"
						type="date"
						value={paused ? (item.pauseUntil ?? '') : ''}
						error={pauseErrors?.pauseUntil}
					/>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Beide Tage zählen zur Pause. Ohne Ende ruht der Dauerposten, bis du die Pause beendest.
					Danach geht es im gewohnten Rhythmus weiter.
				</p>
			{/key}
		</form>
	</Sheet>
{/if}

{#if item.canEdit}
	<Sheet
		bind:open={amountOpen}
		title={amountEntry ? 'Betrag bearbeiten' : 'Änderung planen'}
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
						bind:value={amountInput}
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
						bind:value={validFromInput}
						required
						error={amountErrors?.validFrom}
					/>
				</ul>
				<p class="mt-1.5 mb-8 px-4 text-[13px] text-label-2">
					Ab diesem Tag gilt der neue Betrag; frühere Fälligkeiten behalten den alten.
				</p>
				{#if preview}
					<ListGroup header="Vorschau">
						<ListRow label="Bisher" value={formatEuro(preview.previous)} />
						<ListRow label="Neu" value={formatEuro(preview.next)} />
						<ListRow
							label="Differenz"
							value={preview.percent === null
								? formatDiff(preview.diff)
								: `${formatDiff(preview.diff)} · ${formatPercent(preview.percent)}`}
						/>
						{#if item.interval !== 'once' && item.interval !== 'monthly'}
							<ListRow label="Pro Monat" value={formatDiff(preview.monthly)} />
						{/if}
					</ListGroup>
				{/if}
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
			„{item.name}“ wird mit Betragsverlauf und Dokumenten endgültig gelöscht. Hat er schon
			Buchungen, kann er nur archiviert werden.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			{#if item.interval === 'once'}<input type="hidden" name="once" value="on" />{/if}
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}

{#if item.canEdit}
	<Sheet bind:open={attachmentDeleteOpen} title="PDF löschen">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{attachmentToDelete?.fileName}“ wird endgültig gelöscht.
		</p>
		<form
			method="POST"
			action="?/attachmentDelete"
			use:enhance={() =>
				async ({ update }) => {
					attachmentDeleteOpen = false;
					await update();
				}}
		>
			<input type="hidden" name="attachmentId" value={attachmentToDelete?.id ?? ''} />
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}
