<script lang="ts">
	import { enhance } from '$app/forms';
	import ListGroup from './ListGroup.svelte';
	import ListRow from './ListRow.svelte';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import FormField from './FormField.svelte';
	import BalanceChart from './BalanceChart.svelte';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { formatRate } from '#lib/interest.js';
	import type { LoanInfo } from '#lib/loans.js';

	/** Loan data of an expense: remaining debt, end, repayment course and extra repayments. */
	let {
		loan,
		canEdit,
		endDate,
		loanInput,
		loanErrors,
		extraInput,
		extraErrors
	}: {
		loan: LoanInfo | null;
		canEdit: boolean;
		/** End date of the recurring item. */
		endDate: string | null;
		loanInput?: { principal: string; rate: string; startDate: string; termEnd: string };
		loanErrors?: Partial<Record<string, string>>;
		extraInput?: { date: string; amount: string };
		extraErrors?: Partial<Record<string, string>>;
	} = $props();

	let editOpen = $state(false);
	let editKey = $state(0);
	let extraOpen = $state(false);
	let extraKey = $state(0);
	let deleteOpen = $state(false);
	let pending = $state(false);

	const values = $derived(
		loanInput ??
			(loan
				? {
						principal: formatEuroInput(loan.principal),
						rate: formatRate(loan.rate).replace(/\s?%$/, ''),
						startDate: loan.startDate,
						termEnd: loan.termEnd ?? ''
					}
				: { principal: '', rate: '', startDate: '', termEnd: '' })
	);
	const extraValues = $derived(extraInput ?? { date: '', amount: '' });

	function openEdit() {
		editKey++;
		editOpen = true;
	}
	function openExtra() {
		extraKey++;
		extraOpen = true;
	}

	function submit(close: () => void) {
		return () => {
			pending = true;
			return async ({
				result,
				update
			}: {
				result: { type: string };
				update: (o?: { reset?: boolean }) => Promise<void>;
			}) => {
				pending = false;
				if (result.type === 'success') close();
				await update({ reset: false });
				editKey++;
				extraKey++;
			};
		};
	}
</script>

{#if loan}
	<section class="mb-8" aria-label="Darlehen">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Darlehen</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<li class="px-4 py-3">
				<div class="flex items-baseline gap-3">
					<span class="flex-1 text-[17px]">Restschuld heute</span>
					<span class="text-[22px] font-semibold tabular" aria-label="Restschuld">
						{formatEuro(loan.balance)}
					</span>
				</div>
				<div
					class="mt-2 h-1.5 overflow-hidden rounded-full bg-fill"
					role="progressbar"
					aria-label="Getilgt"
					aria-valuemin={0}
					aria-valuemax={100}
					aria-valuenow={Math.round(loan.repaid * 100)}
				>
					<div
						class="h-full rounded-full bg-accent"
						style:width="{Math.round(loan.repaid * 100)}%"
					></div>
				</div>
				<p class="mt-1 text-[13px] text-label-2">
					{Math.round(loan.repaid * 100)} % von {formatEuro(loan.principal)} getilgt
				</p>
			</li>
			<ListRow label="Zinssatz" value={`${formatRate(loan.rate)} p. a.`} />
			<ListRow label="Beginn" value={formatDay(loan.startDate)} />
			{#if loan.termEnd}<ListRow label="Laufzeitende" value={formatDay(loan.termEnd)} />{/if}
			<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
				<span class="flex-1">Abbezahlt am</span>
				<span class="text-label-2 tabular" aria-label="Abbezahlt am">
					{loan.paidOff ? formatDay(loan.paidOff) : 'nicht absehbar'}
				</span>
			</li>
			{#if loan.lastPayment !== null}
				<ListRow label="Letzte Rate" value={formatEuro(loan.lastPayment)} />
			{/if}
			{#if loan.termEndBalance !== null}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1">Restschuld zum Laufzeitende</span>
					<span class="text-label-2 tabular" aria-label="Restschuld zum Laufzeitende">
						{formatEuro(loan.termEndBalance)}
					</span>
				</li>
			{/if}
			<ListRow label="Zinsen bisher" value={formatEuro(loan.interestSoFar)} />
			<ListRow label="Zinsen gesamt" value={formatEuro(loan.totalInterest)} />
		</ul>
		{#if loan.growing}
			<p role="alert" class="mt-1.5 px-4 text-[13px] text-danger">
				Die Rate deckt die Zinsen nicht – die Schuld wächst.
			</p>
		{:else}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Jede Rate zahlt erst die Zinsen (30/360 auf die Restschuld), der Rest tilgt.
			</p>
		{/if}
	</section>

	{#if canEdit && loan.paidOff && loan.paidOff !== endDate}
		<ListGroup footer="Der Dauerposten endet dann mit der letzten Rate.">
			<li>
				<form method="POST" action="?/loanEnd" use:enhance>
					<button
						type="submit"
						class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
					>
						Ende übernehmen ({formatDay(loan.paidOff)})
					</button>
				</form>
			</li>
		</ListGroup>
	{/if}

	{#if loan.next.length}
		<section class="mb-8" aria-label="Nächste Raten">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Nächste Raten</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each loan.next as r (r.date)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2">
						<span class="flex-1">
							{formatDay(r.date)}
							<span class="block text-[13px] text-label-2 tabular">
								Zinsen {formatEuro(r.interest)} · Tilgung {formatEuro(r.repayment)}
							</span>
						</span>
						<span class="text-label-2 tabular">{formatEuro(r.balance)}</span>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">Rechts die Restschuld nach der Rate.</p>
		</section>
	{/if}

	{#if loan.series.length > 1}
		<section class="mb-8" aria-label="Tilgungsverlauf">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Tilgungsverlauf</h2>
			<BalanceChart series={loan.series} label="Restschuld im Verlauf" />
		</section>
	{/if}

	<section class="mb-8" aria-label="Sondertilgungen">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Sondertilgungen</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each loan.extras as x (x.id)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2">
					<span class="flex-1">{formatDay(x.date)}</span>
					<span class="tabular">{formatEuro(x.amount)}</span>
					{#if canEdit}
						<form method="POST" action="?/extraDelete" use:enhance>
							<input type="hidden" name="extraId" value={x.id} />
							<button
								type="submit"
								class="text-[15px] text-danger"
								aria-label="Sondertilgung vom {formatDay(x.date)} löschen"
							>
								Löschen
							</button>
						</form>
					{/if}
				</li>
			{:else}
				<li class="px-4 py-3 text-[15px] text-label-2">Keine.</li>
			{/each}
			{#if canEdit}
				<li>
					<button
						type="button"
						onclick={openExtra}
						class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
					>
						Sondertilgung erfassen
					</button>
				</li>
			{/if}
		</ul>
	</section>

	{#if canEdit}
		<ListGroup>
			<ListRow label="Darlehensdaten ändern" onclick={openEdit} />
			<ListRow label="Darlehensdaten entfernen" destructive onclick={() => (deleteOpen = true)} />
		</ListGroup>
	{/if}
{:else if canEdit}
	<ListGroup
		header="Darlehen"
		footer="Ist die Ausgabe die Rate eines Kredits, rechnet die App Restschuld und Ende aus."
	>
		<ListRow label="Darlehen erfassen" onclick={openEdit} />
	</ListGroup>
{/if}

{#if canEdit}
	<Sheet
		bind:open={editOpen}
		title="Darlehen"
		confirmLabel="Sichern"
		formId="loan-form"
		confirmDisabled={pending}
	>
		<form
			id="loan-form"
			method="POST"
			action="?/loan"
			use:enhance={submit(() => (editOpen = false))}
		>
			{#key editKey}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="Darlehenssumme in €"
						name="principal"
						value={values.principal}
						inputmode="decimal"
						autocomplete="off"
						placeholder="0,00"
						error={loanErrors?.principal}
					/>
					<FormField
						label="Zinssatz in % p. a. (Sollzins)"
						name="rate"
						value={values.rate}
						inputmode="decimal"
						autocomplete="off"
						placeholder="3,5"
						error={loanErrors?.rate}
					/>
					<FormField
						label="Beginn (Auszahlung)"
						name="startDate"
						type="date"
						value={values.startDate}
						error={loanErrors?.startDate}
					/>
					<FormField
						label="Laufzeitende / Zinsbindung (optional)"
						name="termEnd"
						type="date"
						value={values.termEnd}
						error={loanErrors?.termEnd}
					/>
				</ul>
			{/key}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Raten sind die Fälligkeiten dieses Dauerpostens nach dem Beginn, mit ihrem geplanten Betrag.
			</p>
		</form>
	</Sheet>

	<Sheet
		bind:open={extraOpen}
		title="Sondertilgung"
		confirmLabel="Sichern"
		formId="extra-form"
		confirmDisabled={pending}
	>
		<form
			id="extra-form"
			method="POST"
			action="?/extra"
			use:enhance={submit(() => (extraOpen = false))}
		>
			{#key extraKey}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="Datum"
						name="date"
						type="date"
						value={extraValues.date}
						error={extraErrors?.date}
					/>
					<FormField
						label="Betrag in €"
						name="amount"
						value={extraValues.amount}
						inputmode="decimal"
						autocomplete="off"
						placeholder="0,00"
						error={extraErrors?.amount}
					/>
				</ul>
			{/key}
		</form>
	</Sheet>

	<Sheet bind:open={deleteOpen} title="Darlehensdaten entfernen">
		<p class="mb-6 px-4 text-center text-[15px]">
			Darlehenssumme, Zinssatz und Sondertilgungen werden entfernt. Der Dauerposten bleibt.
		</p>
		<form
			method="POST"
			action="?/loanDelete"
			use:enhance={() =>
				async ({ update }) => {
					deleteOpen = false;
					await update();
				}}
		>
			<Button type="submit" variant="destructive">Entfernen</Button>
		</form>
	</Sheet>
{/if}
