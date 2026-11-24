<script lang="ts">
	import { enhance } from '$app/forms';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import GoalFields from '#lib/components/GoalFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { goalValuesOf, type GoalFormValues } from '#lib/goal-form.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const goal = $derived(data.goal);
	const missing = $derived(Math.max(0, goal.targetAmount - goal.allocated));
	const percent = $derived(Math.round(goal.progress * 100));

	let editOpen = $state(false);
	let editKey = $state(0);
	let allocateOpen = $state(false);
	let allocateKey = $state(0);
	let deleteOpen = $state(false);
	let pending = $state(false);

	const editValues = $derived<GoalFormValues>(
		form?.action === 'update' && 'input' in form && form.input
			? { ...form.input, accountId: goal.accountId }
			: goalValuesOf(goal)
	);
	const editErrors = $derived<Partial<Record<string, string>> | undefined>(
		form?.action === 'update' && 'errors' in form ? form.errors : undefined
	);
	const allocateError = $derived(
		form?.action === 'allocate' && 'error' in form ? form.error : undefined
	);
	const allocateInput = $derived(
		form?.action === 'allocate' && 'input' in form && typeof form.input === 'string'
			? form.input
			: goal.allocated
				? formatEuroInput(goal.allocated)
				: ''
	);
	const status = $derived(form && 'success' in form ? form.success : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);

	function openEdit() {
		editKey++;
		editOpen = true;
	}
	function openAllocate() {
		allocateKey++;
		allocateOpen = true;
	}

	const TRANSFER_STATUS: Record<string, string> = {
		booked: 'umgebucht',
		skipped: 'zurückgenommen'
	};
</script>

<Page title={goal.name} back={{ path: 'sparziele', label: 'Sparziele' }}>
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

	<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5">
		<div class="flex items-center gap-4">
			<span
				class="grid size-14 shrink-0 place-items-center rounded-full text-white"
				style:background-color={accountColorCss(goal.account.color)}
			>
				<PiggyBank class="size-7" strokeWidth={2} />
			</span>
			<div class="min-w-0">
				<p class="text-[13px] text-label-2">
					{goal.done ? 'Erledigt' : `${percent} % zurückgelegt`}
				</p>
				<p class="text-[28px] font-bold tabular" aria-label="Zurückgelegt">
					{formatEuro(goal.allocated)}
				</p>
				<p class="text-[15px] text-label-2 tabular">von {formatEuro(goal.targetAmount)}</p>
			</div>
		</div>
		<div
			class="mt-4 h-2 overflow-hidden rounded-full bg-fill"
			role="progressbar"
			aria-label="Fortschritt"
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={percent}
		>
			<div class="h-full rounded-full bg-accent" style:width="{percent}%"></div>
		</div>
	</section>

	<ListGroup>
		<ListRow label="Sparbuch" value={goal.account.name} href={`konten/${goal.account.id}`} />
		{#if goal.payment}
			{#if data.paymentVisible}
				<ListRow
					label="Für Zahlung"
					value={`${goal.payment.name} · ${goal.payment.accountName}`}
					href={`dauerposten/${goal.payment.id}`}
				/>
			{:else}
				<ListRow label="Für Zahlung" value={`${goal.payment.name} · ${goal.payment.accountName}`} />
			{/if}
		{/if}
		<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
			<span class="flex-1">{goal.payment ? 'Nächste Zahlung' : 'Zieldatum'}</span>
			<span class="text-label-2 tabular" aria-label="Zieldatum">
				{goal.date ? formatDay(goal.date) : goal.done ? 'keine mehr' : 'keins'}
			</span>
		</li>
		<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
			<span class="flex-1">Fehlt noch</span>
			<span class="text-label-2 tabular" aria-label="Fehlt noch">{formatEuro(missing)}</span>
		</li>
		{#if !goal.done}
			<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
				<span class="flex-1">Sparrate</span>
				<span class="text-label-2 tabular" aria-label="Sparrate">
					{goal.rate === null
						? 'ohne Zieldatum keine'
						: goal.rate === 0
							? 'Ziel erreicht'
							: `${formatEuro(goal.rate)} im Monat`}
				</span>
			</li>
		{/if}
		<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
			<span class="flex-1">Frei auf dem Sparbuch</span>
			<span
				class={['tabular', goal.free - goal.allocated < 0 ? 'text-danger' : 'text-label-2']}
				aria-label="Frei"
			>
				{formatEuro(goal.free - goal.allocated)}
			</span>
		</li>
	</ListGroup>

	{#if goal.canEdit}
		<div class="mb-8 flex flex-col gap-3">
			<Button type="button" onclick={openAllocate}>Zurücklegen</Button>
			<Button type="button" variant="tinted" onclick={openEdit}>Bearbeiten</Button>
		</div>
	{/if}

	{#if goal.payment}
		<section class="mb-8" aria-label="Umbuchungen">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Umbuchungen</h2>
			{#if goal.transfers.length}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each goal.transfers as t (t.id)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
							<span class="flex-1">
								{formatDay(t.bookingDate)}
								<span class="block text-[13px] text-label-2">
									{t.amount === 0 ? 'nichts zurückgelegt' : TRANSFER_STATUS[t.status]}
								</span>
							</span>
							<span class="text-label-2 tabular">{formatEuro(t.amount)}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
					Noch keine Umbuchung.
				</p>
			{/if}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Am Tag der Zahlung bucht die App das Zurückgelegte vorläufig vom Sparbuch auf das Girokonto
				der Zahlung{goal.payment.once ? '' : '; danach spart das Ziel für die nächste Zahlung'}.
			</p>
		</section>
	{/if}

	{#if goal.canEdit}
		<ListGroup>
			<ListRow label="Sparziel löschen" destructive onclick={() => (deleteOpen = true)} />
		</ListGroup>
	{/if}
</Page>

{#if goal.canEdit}
	<Sheet
		bind:open={allocateOpen}
		title="Zurücklegen"
		confirmLabel="Sichern"
		formId="allocate-form"
		confirmDisabled={pending}
	>
		<form
			id="allocate-form"
			method="POST"
			action="?/allocate"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') allocateOpen = false;
					await update({ reset: false });
					allocateKey++;
				};
			}}
		>
			{#key allocateKey}
				<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
					<FormField
						label="Zurückgelegt in €"
						name="allocated"
						value={allocateInput}
						inputmode="decimal"
						autocomplete="off"
						placeholder="0,00"
						error={allocateError}
					/>
				</ul>
			{/key}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Der Teil des Sparbuchs, der für dieses Ziel reserviert ist; möglich sind bis zu
				{formatEuro(Math.min(Math.max(0, goal.free), goal.targetAmount))}.
			</p>
		</form>
	</Sheet>

	<Sheet
		bind:open={editOpen}
		title="Sparziel bearbeiten"
		confirmLabel="Sichern"
		formId="goal-edit-form"
		confirmDisabled={pending}
	>
		<form
			id="goal-edit-form"
			method="POST"
			action="?/update"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') editOpen = false;
					await update({ reset: false });
					editKey++;
				};
			}}
		>
			{#key editKey}
				<GoalFields
					values={editValues}
					errors={editErrors}
					payments={data.payments}
					withAllocation={false}
				/>
			{/key}
		</form>
	</Sheet>

	<Sheet bind:open={deleteOpen} title="Sparziel löschen">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{goal.name}“ wird gelöscht. Das zurückgelegte Geld bleibt auf dem Sparbuch und ist dann frei;
			bereits gebuchte Umbuchungen bleiben bestehen.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}
