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
	import SelectField from '#lib/components/SelectField.svelte';
	import SplitSection from '#lib/components/SplitSection.svelte';
	import TagEditor from '#lib/components/TagEditor.svelte';
	import SharedSection from '#lib/components/SharedSection.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import LogoPicker from '#lib/components/LogoPicker.svelte';
	import { formatIban } from '#lib/iban.js';
	import TemplateFields from '#lib/components/TemplateFields.svelte';
	import { templateValuesFromInput, type TemplateFormValues } from '#lib/templates.js';
	import Zap from '@lucide/svelte/icons/zap';
	import Repeat from '@lucide/svelte/icons/repeat';
	import Link2 from '@lucide/svelte/icons/link-2';
	import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
	import WandSparkles from '@lucide/svelte/icons/wand-sparkles';
	import { transferLabel } from '#lib/transfers.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
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
		goal: 'Umbuchung für Sparziel',
		settlement: 'Kreditkartenabrechnung (berechnet)'
	};

	let savePending = $state(false);
	let deleteOpen = $state(false);
	let assignOpen = $state(false);
	let unassignOpen = $state(false);
	let assignPending = $state(false);
	let transferOpen = $state(false);
	let untransferOpen = $state(false);
	const assignEnhance: SubmitFunction = () => {
		assignPending = true;
		return async ({ update }) => {
			assignPending = false;
			assignOpen = false;
			unassignOpen = false;
			transferOpen = false;
			untransferOpen = false;
			await update();
		};
	};
	// "Immer so einordnen": a category rule from this booking.
	let alwaysOpen = $state(false);
	let alwaysPending = $state(false);
	let alwaysKey = $state(0);
	let alwaysField = $state('');
	let alwaysText = $state('');
	function openAlways() {
		const first = data.ruleOptions[0];
		alwaysField = first?.field ?? '';
		alwaysText = first?.value ?? '';
		alwaysKey++;
		alwaysOpen = true;
	}
	function pickAlwaysField(field: string) {
		alwaysField = field;
		alwaysText = data.ruleOptions.find((o) => o.field === field)?.value ?? '';
	}
	const alwaysErrors = $derived(
		form?.action === 'always' && 'errors' in form ? form.errors : undefined
	);
	const alwaysDone = $derived(
		form?.action === 'always' && 'success' in form
			? { rule: form.rule, category: form.category, applied: form.applied }
			: undefined
	);
	const alwaysEnhance: SubmitFunction = () => {
		alwaysPending = true;
		return async ({ result, update }) => {
			alwaysPending = false;
			if (result.type === 'success') alwaysOpen = false;
			await update({ reset: false });
		};
	};
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
	let categoryForm: HTMLFormElement | undefined = $state();
	function submitCategory() {
		categoryForm?.requestSubmit();
	}
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
	const assignDone = $derived(
		form?.action === 'assign' && 'success' in form
			? { name: form.name, dueDate: form.dueDate }
			: undefined
	);
	const unassignDone = $derived(
		form?.action === 'unassign' && 'success' in form ? form.name : undefined
	);
	const transferDone = $derived(
		form?.action === 'transfer' && 'success' in form
			? { accountName: form.accountName, created: form.created }
			: undefined
	);
	const untransferDone = $derived(
		form?.action === 'untransfer' && 'success' in form
			? { accountName: form.accountName, removed: form.removed }
			: undefined
	);
	const splitSaved = $derived(form?.action === 'split' && 'success' in form);
	const tagsSaved = $derived(form?.action === 'tags' && 'success' in form);
	const logoSaved = $derived(form?.action === 'logo' && 'success' in form);
	const sharedSaved = $derived(
		(form?.action === 'share' || form?.action === 'unshare') && 'success' in form
	);

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

{#snippet assignRows()}
	{#if data.transfer}
		<ListRow
			label="Umbuchung"
			value={transferLabel(booking.amount, data.transfer.accountName)}
			href={data.transfer.bookingId ? `buchungen/${data.transfer.bookingId}` : undefined}
		/>
		{#if data.transfer.canRelease}
			<ListRow label="Umbuchung auflösen" onclick={() => (untransferOpen = true)} />
		{/if}
	{:else if data.transferTargets.length}
		<ListRow
			label="Als Umbuchung kennzeichnen"
			icon={ArrowLeftRight}
			iconColor="bg-[#007aff]"
			onclick={() => (transferOpen = true)}
		/>
	{/if}
	{#if data.assigned}
		<ListRow
			label="Dauerposten"
			value={data.assigned.name}
			href={`dauerposten/${data.assigned.id}`}
		/>
		{#if data.canUnassign}
			<ListRow label="Zuordnung lösen" onclick={() => (unassignOpen = true)} />
		{/if}
	{:else if data.assignOptions.length}
		<ListRow
			label="Dauerposten zuordnen"
			icon={Link2}
			iconColor="bg-[#ff9500]"
			onclick={() => (assignOpen = true)}
		/>
	{/if}
	{#if data.ruleOptions.length}
		<ListRow
			label="Immer so einordnen"
			icon={WandSparkles}
			iconColor="bg-[#af52de]"
			onclick={openAlways}
		/>
	{/if}
{/snippet}

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
	{:else if assignDone}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Dem Dauerposten „{assignDone.name}“ zugeordnet.
			{assignDone.dueDate
				? `Die Fälligkeit vom ${formatDay(assignDone.dueDate)} gilt als bezahlt.`
				: 'In der Nähe liegt keine offene Fälligkeit.'}
		</p>
	{:else if alwaysDone}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Regel gesichert: {alwaysDone.rule} → {alwaysDone.category}.
			{alwaysDone.applied === 0
				? 'Keine weitere Buchung ohne Kategorie passt dazu.'
				: alwaysDone.applied === 1
					? 'Eine weitere Buchung ohne Kategorie wurde eingeordnet.'
					: `${alwaysDone.applied} weitere Buchungen ohne Kategorie wurden eingeordnet.`}
		</p>
	{:else if transferDone}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Als Umbuchung gekennzeichnet.
			{transferDone.created
				? `Die Gegenbuchung auf ${transferDone.accountName} wurde angelegt.`
				: `Verknüpft mit der passenden Buchung auf ${transferDone.accountName}.`}
		</p>
	{:else if untransferDone}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Umbuchung aufgelöst.
			{untransferDone.removed
				? `Die Gegenbuchung auf ${untransferDone.accountName} liegt im Papierkorb.`
				: `Die Buchung auf ${untransferDone.accountName} bleibt stehen.`}
		</p>
	{:else if unassignDone}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Zuordnung zu „{unassignDone}“ gelöst. Die Fälligkeit ist wieder offen.
		</p>
	{:else if sharedSaved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Gemeinsame Ausgabe gesichert.
		</p>
	{:else if logoSaved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Logo gesichert.
		</p>
	{:else if tagsSaved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Tags gesichert.
		</p>
	{:else if splitSaved}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Aufteilung gesichert.
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
		{#if booking.logo || booking.counterparty || (booking.recurringId && booking.purpose)}
			<Logo name={booking.counterparty ?? booking.purpose ?? '?'} logo={booking.logo} size="lg" />
		{:else}
			<span
				class="grid size-14 shrink-0 place-items-center rounded-full text-white"
				style:background-color={accountColorCss(booking.category?.color ?? 'gray')}
			>
				<Icon class="size-7" strokeWidth={2} />
			</span>
		{/if}
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

		<SplitSection
			amount={booking.amount}
			categoryName={categoryText}
			parts={booking.parts}
			canSplit={booking.canSplit}
			categoryGroups={data.categoryGroups}
			errors={form?.action === 'split' && 'splitErrors' in form ? form.splitErrors : undefined}
		/>
		<TagEditor
			allTags={data.tags.all}
			selected={data.tags.selected}
			inherited={data.tags.inherited}
			canEdit={booking.canTag}
			error={form?.action === 'tags' && 'tagError' in form ? form.tagError : undefined}
		/>
		<SharedSection
			shared={data.shared}
			users={data.settleUsers}
			me={data.user.id}
			canEdit={data.canShare}
			errors={form?.action === 'share' && 'shareErrors' in form ? form.shareErrors : undefined}
		/>
		{#if booking.payeeKey && booking.canTag}
			<LogoPicker
				name={booking.counterparty ?? booking.purpose ?? '?'}
				logo={booking.logo}
				chosen={booking.logoChosen}
			/>
		{/if}
		<ListGroup
			header="Verwaltung"
			footer={data.canMakeRecurring
				? 'Kommt die Zahlung regelmäßig? Dann wird daraus ein Dauerposten – diese Buchung zählt als erste Zahlung.'
				: undefined}
		>
			{@render assignRows()}
			{#if data.canMakeRecurring}
				<ListRow
					label="Dauerposten daraus machen"
					icon={Repeat}
					iconColor="bg-[#34c759]"
					onclick={() => goto(resolve(`dauerposten?aus=${booking.id}`))}
				/>
			{/if}
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
			{#if booking.canCategorize}
				<form
					method="POST"
					action="?/category"
					use:enhance
					bind:this={categoryForm}
					class="contents"
				>
					<SelectField
						label="Kategorie"
						name="categoryId"
						options={[{ value: '', label: 'Ohne Kategorie' }]}
						groups={data.categoryGroups}
						value={booking.categoryId ?? ''}
						onchange={submitCategory}
					/>
				</form>
			{:else}
				<ListRow label="Kategorie" value={categoryText} />
			{/if}
			{#if booking.iban}<ListRow label="IBAN" value={formatIban(booking.iban)} />{/if}
			{#if booking.bookingText}<ListRow label="Buchungstext" value={booking.bookingText} />{/if}
			{#if booking.bankCategory}<ListRow
					label="Kategorie der Bank"
					value={booking.bankCategory}
				/>{/if}
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
		<SplitSection
			amount={booking.amount}
			categoryName={categoryText}
			parts={booking.parts}
			canSplit={booking.canSplit}
			categoryGroups={data.categoryGroups}
			errors={form?.action === 'split' && 'splitErrors' in form ? form.splitErrors : undefined}
		/>
		<TagEditor
			allTags={data.tags.all}
			selected={data.tags.selected}
			inherited={data.tags.inherited}
			canEdit={booking.canTag}
			error={form?.action === 'tags' && 'tagError' in form ? form.tagError : undefined}
		/>
		<SharedSection
			shared={data.shared}
			users={data.settleUsers}
			me={data.user.id}
			canEdit={data.canShare}
			errors={form?.action === 'share' && 'shareErrors' in form ? form.shareErrors : undefined}
		/>
		{#if booking.payeeKey && booking.canTag}
			<LogoPicker
				name={booking.counterparty ?? booking.purpose ?? '?'}
				logo={booking.logo}
				chosen={booking.logoChosen}
			/>
		{/if}
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
		{#if data.templateAccounts.length && !['adjustment', 'interest', 'goal', 'settlement'].includes(booking.source)}
			<ListGroup
				footer={data.canMakeRecurring
					? 'Kommt die Zahlung regelmäßig? Dann wird daraus ein Dauerposten – diese Buchung zählt als erste Zahlung.'
					: undefined}
			>
				{@render assignRows()}
				{#if data.canMakeRecurring}
					<ListRow
						label="Dauerposten daraus machen"
						icon={Repeat}
						iconColor="bg-[#34c759]"
						onclick={() => goto(resolve(`dauerposten?aus=${booking.id}`))}
					/>
				{/if}
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

{#if data.transferTargets.length}
	<Sheet
		bind:open={transferOpen}
		title="Umbuchung"
		confirmLabel="Kennzeichnen"
		formId="transfer-form"
		confirmDisabled={assignPending}
	>
		<form id="transfer-form" method="POST" action="?/transfer" use:enhance={assignEnhance}>
			<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<SelectField
					label={booking.amount < 0 ? 'Umbuchung auf' : 'Umbuchung von'}
					name="counterAccountId"
					options={data.transferTargets}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				{booking.amount < 0
					? 'Das Geld ist auf ein anderes eigenes Konto gegangen: hier Ausgang, dort Eingang.'
					: 'Das Geld kam von einem anderen eigenen Konto: hier Eingang, dort Ausgang.'}
				Steht dort schon eine Buchung über denselben Betrag (bis drei Tage davor oder danach), werden
				beide verknüpft; sonst legt die App die Gegenbuchung an. Umbuchungen zählen in den Auswertungen
				nicht als Ausgabe oder Einnahme.
			</p>
		</form>
	</Sheet>
{/if}

{#if data.transfer?.canRelease}
	<Sheet
		bind:open={untransferOpen}
		title="Umbuchung auflösen"
		confirmLabel="Auflösen"
		formId="untransfer-form"
		confirmDisabled={assignPending}
	>
		<form id="untransfer-form" method="POST" action="?/untransfer" use:enhance={assignEnhance}>
			<p class="mb-4 px-4 text-center text-[15px]">
				Diese Buchung und die Buchung auf {data.transfer.accountName} sind dann wieder zwei einzelne Buchungen
				und zählen als Ausgabe und Einnahme.
			</p>
			{#if data.transfer.canRemove}
				<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
					<li>
						<label class="flex min-h-11 items-center gap-3 px-4 py-2.5 text-[17px]">
							<span class="flex-1">Buchung auf {data.transfer.accountName} löschen</span>
							<input
								type="checkbox"
								name="remove"
								checked
								class="size-5 accent-[var(--kp-accent)]"
							/>
						</label>
					</li>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Die Gegenbuchung hat die App angelegt. Gelöscht liegt sie 30 Tage im Papierkorb.
				</p>
			{/if}
		</form>
	</Sheet>
{/if}

{#if data.ruleOptions.length}
	<Sheet
		bind:open={alwaysOpen}
		title="Immer so einordnen"
		confirmLabel="Sichern"
		formId="always-form"
		confirmDisabled={alwaysPending}
	>
		{#key alwaysKey}
			<form id="always-form" method="POST" action="?/always" use:enhance={alwaysEnhance}>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<SelectField
						label="Erkennen an"
						name="field"
						options={data.ruleOptions.map((o) => ({ value: o.field, label: o.label }))}
						value={alwaysField}
						onchange={pickAlwaysField}
					/>
					<FormField
						label="Text"
						name="value"
						bind:value={alwaysText}
						error={alwaysErrors?.value}
						maxlength={100}
						autocapitalize="off"
						autocomplete="off"
					/>
					<SelectField
						label="Kategorie"
						name="categoryId"
						options={[{ value: '', label: 'Bitte wählen' }]}
						groups={data.categoryGroups}
						value={booking.categoryId ?? ''}
						error={alwaysErrors?.categoryId}
					/>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Jede Buchung, auf die das zutrifft, bekommt diese Kategorie: neue Buchungen beim Import
					und beim Erfassen ohne Kategorie, dazu sofort alle vorhandenen ohne Kategorie. Buchungen,
					die schon eine Kategorie haben, bleiben unverändert. Kürze den Text, wenn er Teile
					enthält, die sich ändern. Die Regel steht danach unter Kategorien › Regeln.
				</p>
			</form>
		{/key}
	</Sheet>
{/if}

{#if data.assignOptions.length}
	<Sheet
		bind:open={assignOpen}
		title="Dauerposten zuordnen"
		confirmLabel="Zuordnen"
		formId="assign-form"
		confirmDisabled={assignPending}
	>
		<form id="assign-form" method="POST" action="?/assign" use:enhance={assignEnhance}>
			<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<SelectField label="Dauerposten" name="recurringId" options={data.assignOptions} />
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Die nächstgelegene offene Fälligkeit gilt damit als bezahlt; eine vorläufige Buchung dafür
				wird entfernt. Die App merkt sich den Namen für den nächsten Import.
			</p>
		</form>
	</Sheet>
{/if}

{#if data.canUnassign && data.assigned}
	<Sheet bind:open={unassignOpen} title="Zuordnung lösen">
		<p class="mb-6 px-4 text-center text-[15px]">
			Die Buchung gehört dann nicht mehr zu „{data.assigned.name}“. Die Fälligkeit, die sie bezahlt
			hat, ist wieder offen und wird vorläufig gebucht, wenn ihr Tag erreicht ist.
		</p>
		<form method="POST" action="?/unassign" use:enhance={assignEnhance}>
			<Button type="submit" variant="destructive" disabled={assignPending}>Lösen</Button>
		</form>
	</Sheet>
{/if}

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
			)} wird gelöscht. Im Papierkorb lässt sie sich 30 Tage lang wiederherstellen.
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
