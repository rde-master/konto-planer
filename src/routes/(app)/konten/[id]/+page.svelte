<script lang="ts">
	import { enhance } from '$app/forms';
	import Landmark from '@lucide/svelte/icons/landmark';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import AccountFields from '#lib/components/AccountFields.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import BalanceChart from '#lib/components/BalanceChart.svelte';
	import { INTEREST_RHYTHMS, INTEREST_RHYTHM_LABELS, formatRate } from '#lib/interest.js';
	import { CUTOFF_MODE_LABELS, CUTOFF_MODES } from '#lib/minimum.js';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatIban } from '#lib/iban.js';
	import { formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const account = $derived(data.account);
	const archived = $derived(account.archivedAt !== null);
	const canEdit = $derived(account.level === 'edit' && !archived);
	const Icon = $derived(account.type === 'giro' ? Landmark : PiggyBank);

	let savePending = $state(false);
	let deleteOpen = $state(false);
	let adjustOpen = $state(false);
	let adjustPending = $state(false);
	let adjustKey = $state(0);
	let adjustValues = $state({ actual: '', date: '' });
	let adjustErrors: Partial<Record<string, string>> | undefined = $state();

	let cutoffOpen = $state(false);
	let cutoffPending = $state(false);
	let cutoffMode = $state('salary');
	let cutoffKey = $state(0);
	const cutoffErrors = $derived(
		form?.action === 'cutoff' && 'errors' in form ? form.errors : undefined
	);

	let rateOpen = $state(false);
	let ratePending = $state(false);
	let rateKey = $state(0);
	const rateErrors: Partial<Record<string, string>> | undefined = $derived(
		form?.action === 'rate' && 'errors' in form ? form.errors : undefined
	);
	const rateInput = $derived(form?.action === 'rate' && 'input' in form ? form.input : undefined);

	function openRate() {
		rateKey++;
		rateOpen = true;
	}

	function submitRhythm(e: Event) {
		(e.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}

	function chooseMode(value: string) {
		cutoffMode = value;
	}

	function openCutoff() {
		cutoffMode = account.cutoffMode;
		cutoffKey++;
		cutoffOpen = true;
	}

	const cutoffText = $derived.by(() => {
		const cut = data.plan?.cutoff;
		if (!cut) return '';
		if (cut.mode === 'salary') return `${cut.itemName ?? 'Gehalt'} · ${formatDay(cut.date)}`;
		return `${CUTOFF_MODE_LABELS[cut.mode]} · ${formatDay(cut.date)}`;
	});

	function openAdjust() {
		adjustValues = { actual: '', date: data.today };
		adjustErrors = undefined;
		adjustKey++;
		adjustOpen = true;
	}

	const updateInput = $derived(
		form?.action === 'update' && 'input' in form ? form.input : undefined
	);
	const updateErrors = $derived(
		form?.action === 'update' && 'errors' in form ? form.errors : undefined
	);
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const status = $derived.by(() => {
		if (!form || !('success' in form)) return undefined;
		if (form.action === 'adjust' && 'amount' in form && typeof form.amount === 'number')
			return `Kontostand korrigiert. Die Differenz von ${form.amount > 0 ? '+' : ''}${formatEuro(form.amount)} ist als Anpassung gebucht.`;
		return {
			update: 'Änderungen gesichert.',
			access: 'Zugriffe gesichert.',
			archive: 'Konto archiviert. Es ist jetzt schreibgeschützt.',
			restore: 'Konto wiederhergestellt.',
			cutoff: 'Stichtag gesichert.',
			rate: 'Zinssatz gesichert.',
			rateDelete: 'Zinssatz gelöscht.',
			rhythm: 'Rhythmus der Gutschrift gesichert.'
		}[form.action];
	});

	const fieldValues = $derived(
		updateInput ? { ...updateInput, type: account.type } : { ...account }
	);

	const ACCESS_OPTIONS = [
		{ value: '', label: 'Kein Zugriff' },
		{ value: 'view', label: 'Sehen' },
		{ value: 'edit', label: 'Bearbeiten' }
	];
</script>

<Page title={account.name} back={{ path: 'konten', label: 'Konten' }}>
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

	<!-- Balance card -->
	<section class="mb-8 flex items-center gap-4 rounded-[var(--radius-card)] bg-card p-5">
		<span
			class="grid size-14 shrink-0 place-items-center rounded-full text-white"
			style:background-color={accountColorCss(account.color)}
		>
			<Icon class="size-7" strokeWidth={2} />
		</span>
		<div class="min-w-0">
			<p class="text-[13px] text-label-2">
				{account.type === 'giro' ? 'Girokonto' : 'Sparbuch'}{archived ? ' · archiviert' : ''}
			</p>
			<p
				class={['text-[28px] font-bold tabular', data.balance < 0 && 'text-danger']}
				aria-label="Kontostand"
			>
				{formatEuro(data.balance)}
			</p>
			<p class="text-[13px] text-label-2">
				Startsaldo {formatEuro(account.openingBalance)} am {formatDay(account.openingDate)}
			</p>
		</div>
	</section>

	{#if data.plan}
		{@const p = data.plan.plan}
		{@const cut = data.plan.cutoff}
		{#if p.exceedsOverdraft}
			<div role="alert" class="mb-4 rounded-[var(--radius-card)] bg-danger px-5 py-4 text-white">
				<p class="text-[17px] font-semibold">
					{account.overdraftLimit ? 'Der Dispo reicht nicht' : 'Das Konto rutscht ins Minus'}
				</p>
				<p class="mt-1 text-[15px]">
					Am {formatDay(p.lowest!.date)} fällt der Stand auf {formatEuro(
						p.lowest!.balance
					)}{account.overdraftLimit
						? `, ${formatEuro(-p.lowest!.balance - account.overdraftLimit)} über dem Dispo von ${formatEuro(account.overdraftLimit)}`
						: ''}. Zahle vorher {formatEuro(-p.lowest!.balance - account.overdraftLimit)} ein.
				</p>
			</div>
		{:else if p.goesNegative}
			<p class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
				Bis zum Stichtag rutscht das Konto ins Minus: am {formatDay(p.lowest!.date)} auf {formatEuro(
					p.lowest!.balance
				)}. Der Dispo reicht dafür.
			</p>
		{/if}
		{#if p.overdraftInUse}
			<p class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
				Du nutzt den Dispo: {formatEuro(-data.balance)}{account.overdraftLimit
					? ` von ${formatEuro(account.overdraftLimit)}`
					: ' – für das Konto ist kein Dispo eingetragen'}.
			</p>
		{/if}

		<section class="mb-8" aria-label="Bis zum Stichtag">
			<div class="rounded-t-[var(--radius-row)] bg-card px-4 pt-4 pb-3">
				<p class="text-[13px] text-label-2">Verfügbar bis {formatDay(cut.date)}</p>
				<p
					class={['text-[28px] font-bold tabular', p.available < 0 ? 'text-danger' : 'text-income']}
					aria-label="Verfügbar"
				>
					{formatEuro(p.available)}
				</p>
			</div>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-b-[var(--radius-row)] border-t-[0.5px] border-separator bg-card"
			>
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1 text-[17px]">Mindestbestand</span>
					<span class="text-label-2 tabular" aria-label="Mindestbestand">
						{formatEuro(p.minimum)}
					</span>
				</li>
				{#if p.buffer}
					<li class="flex min-h-11 items-center gap-3 py-2.5 pr-4 pl-8">
						<span class="flex-1 text-[15px] text-label-2">davon Puffer</span>
						<span class="text-[15px] text-label-2 tabular">{formatEuro(p.buffer)}</span>
					</li>
				{/if}
				<li>
					<svelte:element
						this={canEdit ? 'button' : 'div'}
						type={canEdit ? 'button' : undefined}
						onclick={canEdit ? openCutoff : undefined}
						role={canEdit ? undefined : 'group'}
						class="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill"
					>
						<span class="flex-1 text-[17px]">Stichtag</span>
						<span class="min-w-0 truncate text-right text-label-2">{cutoffText}</span>
						{#if canEdit}<ChevronRight
								class="size-5 shrink-0 text-label-3"
								strokeWidth={2.5}
							/>{/if}
					</svelte:element>
				</li>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				{#if cut.fallback === 'no_salary'}
					Kein Gehaltseingang gefunden – gerechnet wird bis Monatsende. Markiere eine Einnahme als
					Gehalt oder wähle einen Eingang als Stichtag.
				{:else if cut.fallback === 'date_passed'}
					Das feste Datum ist vorbei – gerechnet wird bis Monatsende.
				{:else}
					So viel muss heute auf dem Konto sein, damit es bis zum Stichtag nicht ins Minus geht. Der
					Dispo zählt nie dazu.
				{/if}
			</p>
		</section>

		{#if data.plan.later.length}
			<section class="mb-8" aria-label="Danach geplant">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Danach geplant</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.plan.later as l (l.id)}
						<li>
							<a
								href={resolve(`dauerposten/${l.id}`)}
								class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
							>
								<span class="min-w-0 flex-1 truncate text-[17px]">{l.name}</span>
								<span class="text-[15px] text-label-2">{formatDay(l.date)}</span>
								<span class={['text-[17px] tabular', l.amount > 0 && 'text-income']}>
									{l.amount > 0 ? '+' : ''}{formatEuro(l.amount)}
								</span>
							</a>
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Liegt nach dem Stichtag und zählt noch nicht zum Mindestbestand.
				</p>
			</section>
		{/if}

		{#if p.steps.length}
			<section class="mb-8" aria-label="Bis zum Stichtag fällig">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Bis zum Stichtag</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each p.steps as step, i (i)}
						{@const low =
							p.lowest && step.date === p.lowest.date && step.balance === p.lowest.balance}
						<li class="flex min-h-14 items-center gap-3 px-4 py-2">
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{step.label}</span>
								<span class="block text-[13px] text-label-2">
									{formatDay(step.date)} · danach {formatEuro(step.balance)}{low
										? ' · tiefster Stand'
										: ''}
								</span>
							</span>
							<span class={['shrink-0 text-[17px] tabular', step.amount > 0 && 'text-income']}>
								{step.amount > 0 ? '+' : ''}{formatEuro(step.amount)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}

	{#if data.interest}
		{@const zi = data.interest}
		<section class="mb-8" aria-label="Zinsen">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zinsen</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1 text-[17px]">Zinssatz</span>
					<span class="text-label-2 tabular" aria-label="Zinssatz">
						{zi.currentRate ? `${formatRate(zi.currentRate)} p. a.` : 'keiner'}
					</span>
				</li>
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1 text-[17px]">Bisher in dieser Periode</span>
					<span class="text-label-2 tabular" aria-label="Bisher in dieser Periode">
						{formatEuro(zi.accrued)}
					</span>
				</li>
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1 text-[17px]">Gutschrift am {formatDay(zi.expected.date)}</span>
					<span class="text-income tabular" aria-label="Erwartete Gutschrift">
						+{formatEuro(zi.expected.amount)}
					</span>
				</li>
				<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
					{#if canEdit}
						<form method="POST" action="?/rhythm" use:enhance class="contents">
							<label for="interest-rhythm" class="flex-1 text-[17px]">Gutschrift</label>
							<select
								id="interest-rhythm"
								name="interestRhythm"
								onchange={submitRhythm}
								class="bg-transparent text-right text-label-2"
							>
								{#each INTEREST_RHYTHMS as r (r)}
									<option value={r} selected={r === zi.rhythm}>{INTEREST_RHYTHM_LABELS[r]}</option>
								{/each}
							</select>
						</form>
					{:else}
						<span class="flex-1 text-[17px]">Gutschrift</span>
						<span class="text-label-2">{INTEREST_RHYTHM_LABELS[zi.rhythm]}</span>
					{/if}
				</li>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Tagegenau auf den Stand am Ende jedes Tages (act/365), ohne Steuern. Am Ende der Periode
				bucht die App die Zinsen vorläufig; weicht die Bank ab, passe den Betrag an der Buchung an.
			</p>
		</section>

		{#if zi.rates.length || canEdit}
			<section class="mb-8" aria-label="Zinssätze">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zinssätze</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each [...zi.rates].reverse() as r (r.id)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-2">
							<span class="flex-1 text-[17px]">ab {formatDay(r.validFrom)}</span>
							<span class="tabular">{formatRate(r.rate)}</span>
							{#if canEdit}
								<form method="POST" action="?/rateDelete" use:enhance>
									<input type="hidden" name="rateId" value={r.id} />
									<button
										type="submit"
										class="text-[15px] text-danger"
										aria-label="Zinssatz ab {formatDay(r.validFrom)} löschen"
									>
										Löschen
									</button>
								</form>
							{/if}
						</li>
					{/each}
					{#if canEdit}
						<li>
							<button
								type="button"
								onclick={openRate}
								class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
							>
								Zinssatz ändern
							</button>
						</li>
					{/if}
				</ul>
			</section>
		{/if}

		{#if zi.series.length > 1}
			<section class="mb-8" aria-label="Verlauf">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Verlauf</h2>
				<BalanceChart series={zi.series} label="Kontostand im Verlauf" />
			</section>
		{/if}
	{/if}

	<ul class="mb-8 overflow-hidden rounded-[var(--radius-row)] bg-card">
		<li>
			<a
				href={resolve(`buchungen?konto=${account.id}`)}
				class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
			>
				<span class="flex-1 text-[17px]">Buchungen</span>
				<span class="text-label-2 tabular">{data.bookingCount}</span>
				<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
			</a>
		</li>
		<li class="border-t-[0.5px] border-separator">
			<a
				href={resolve(`offene-zahlungen?konto=${account.id}`)}
				class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
			>
				<span class="flex-1 text-[17px]">Offene Zahlungen</span>
				<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
			</a>
		</li>
		{#if canEdit}
			<li class="border-t-[0.5px] border-separator">
				<button
					type="button"
					onclick={openAdjust}
					class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
				>
					Kontostand korrigieren
				</button>
			</li>
		{/if}
	</ul>

	{#if canEdit}
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
			<AccountFields values={fieldValues} errors={updateErrors} />
			<Button type="submit" disabled={savePending} class="mb-8">Sichern</Button>
		</form>
	{:else}
		<ListGroup
			header="Kontodaten"
			footer={archived
				? 'Archivierte Konten sind schreibgeschützt.'
				: 'Du kannst dieses Konto nur ansehen.'}
		>
			<ListRow label="IBAN" value={account.iban ? formatIban(account.iban) : '–'} />
			{#if account.type === 'giro'}
				<ListRow
					label="Dispo"
					value={account.overdraftLimit ? formatEuro(account.overdraftLimit) : 'keiner'}
				/>
				<ListRow label="Puffer" value={account.buffer ? formatEuro(account.buffer) : 'keiner'} />
			{/if}
		</ListGroup>
	{/if}

	{#if data.isAdmin}
		{#if data.access.length}
			<form
				method="POST"
				action="?/access"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<section class="mb-8">
					<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zugriff</h2>
					<ul
						class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					>
						{#each data.access as entry (entry.userId)}
							<SelectField
								label={entry.name}
								name={`access:${entry.userId}`}
								options={ACCESS_OPTIONS}
								value={entry.level ?? ''}
							/>
						{/each}
					</ul>
					<p class="mt-1.5 px-4 text-[13px] text-label-2">
						Admins sehen und bearbeiten alle Konten. „Bearbeiten“ erlaubt Buchungen, Dauerposten und
						Kontodaten.
					</p>
				</section>
				<Button type="submit" variant="tinted" class="mb-8">Zugriffe sichern</Button>
			</form>
		{:else}
			<p class="mb-8 px-4 text-[13px] text-label-2">
				Es gibt noch keine Benutzer ohne Admin-Rolle, denen du das Konto freigeben könntest.
			</p>
		{/if}

		<ListGroup header="Verwaltung">
			{#if archived}
				<li>
					<form method="POST" action="?/restore" use:enhance>
						<button
							type="submit"
							class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-accent active:bg-fill"
						>
							Wiederherstellen
						</button>
					</form>
				</li>
			{:else}
				<li>
					<form method="POST" action="?/archive" use:enhance>
						<button
							type="submit"
							class="flex min-h-11 w-full items-center px-4 py-2.5 text-left active:bg-fill"
						>
							Archivieren
						</button>
					</form>
				</li>
			{/if}
			{#if !data.hasData}
				<ListRow label="Konto löschen" destructive onclick={() => (deleteOpen = true)} />
			{/if}
		</ListGroup>
	{/if}
</Page>

{#if data.isAdmin}
	<Sheet bind:open={deleteOpen} title="Konto löschen">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{account.name}“ wird endgültig gelöscht. Das geht nur, solange das Konto keine Buchungen oder
			Dauerposten hat.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}

{#if canEdit}
	<Sheet
		bind:open={adjustOpen}
		title="Kontostand korrigieren"
		confirmLabel="Korrigieren"
		formId="adjust-form"
		confirmDisabled={adjustPending}
	>
		<form
			id="adjust-form"
			method="POST"
			action="?/adjust"
			use:enhance={() => {
				adjustPending = true;
				return async ({ result, update }) => {
					adjustPending = false;
					if (result.type === 'success') adjustOpen = false;
					else if (result.type === 'failure') {
						const input = result.data?.input as typeof adjustValues | undefined;
						if (input) adjustValues = input;
						adjustErrors = result.data?.errors as typeof adjustErrors;
						adjustKey++;
					}
					await update({ reset: false });
				};
			}}
		>
			{#key adjustKey}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="Tatsächlicher Stand in €"
						name="actual"
						value={adjustValues.actual}
						autocomplete="off"
						placeholder="z. B. 1.234,56 oder -50,00"
						required
						error={adjustErrors?.actual}
					/>
					<FormField
						label="Stand am"
						name="date"
						type="date"
						value={adjustValues.date}
						required
						error={adjustErrors?.date}
					/>
				</ul>
			{/key}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Berechnet sind heute {formatEuro(data.balance)}. Die Differenz zum tatsächlichen Stand am
				gewählten Tag wird als Anpassung gebucht; der nächste Import gleicht sie ab.
			</p>
		</form>
	</Sheet>
{/if}

{#if canEdit && data.plan}
	<Sheet
		bind:open={cutoffOpen}
		title="Stichtag"
		confirmLabel="Sichern"
		formId="cutoff-form"
		confirmDisabled={cutoffPending}
	>
		<form
			id="cutoff-form"
			method="POST"
			action="?/cutoff"
			use:enhance={() => {
				cutoffPending = true;
				return async ({ result, update }) => {
					cutoffPending = false;
					if (result.type === 'success') cutoffOpen = false;
					await update({ reset: false });
				};
			}}
		>
			{#key cutoffKey}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<SelectField
						label="Rechnen bis"
						name="mode"
						options={CUTOFF_MODES.map((m) => ({ value: m, label: CUTOFF_MODE_LABELS[m] }))}
						value={cutoffMode}
						error={cutoffErrors?.mode}
						onchange={chooseMode}
					/>
					{#if cutoffMode === 'salary'}
						<SelectField
							label="Eingang"
							name="recurringId"
							options={[{ value: '', label: 'Nächstes Gehalt' }, ...data.plan.candidates]}
							value={account.cutoffRecurringId ?? ''}
							error={cutoffErrors?.recurringId}
						/>
					{:else if cutoffMode === 'date'}
						<FormField
							label="Datum"
							name="date"
							type="date"
							value={account.cutoffDate ?? ''}
							required
							error={cutoffErrors?.date}
						/>
					{/if}
				</ul>
			{/key}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Bis zu diesem Tag (einschließlich) muss das Geld reichen. „Nächstes Gehalt“ nimmt die
				nächste als Gehalt markierte Einnahme; auch eine Umbuchung auf dieses Konto kann Stichtag
				sein.
			</p>
		</form>
	</Sheet>
{/if}

{#if canEdit && data.interest}
	<Sheet
		bind:open={rateOpen}
		title="Zinssatz ändern"
		confirmLabel="Sichern"
		formId="rate-form"
		confirmDisabled={ratePending}
	>
		<form
			id="rate-form"
			method="POST"
			action="?/rate"
			use:enhance={() => {
				ratePending = true;
				return async ({ result, update }) => {
					ratePending = false;
					if (result.type === 'success') rateOpen = false;
					await update({ reset: false });
					rateKey++;
				};
			}}
		>
			{#key rateKey}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="Zinssatz in % p. a."
						name="rate"
						value={rateInput?.rate ?? ''}
						inputmode="decimal"
						autocomplete="off"
						placeholder="z. B. 2,75"
						required
						error={rateErrors?.rate}
					/>
					<FormField
						label="Gültig ab"
						name="validFrom"
						type="date"
						value={rateInput?.validFrom ?? data.today}
						required
						error={rateErrors?.validFrom}
					/>
				</ul>
			{/key}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Ein künftiges Datum plant eine Zinsänderung ein; bis dahin gilt der bisherige Satz.
			</p>
		</form>
	</Sheet>
{/if}
