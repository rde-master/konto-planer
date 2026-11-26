<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import SegmentedField from '#lib/components/SegmentedField.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { INTERVAL_LABELS } from '#lib/recurring.js';
	import { describeChange, WHATIF_INTERVALS } from '#lib/whatif.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const v = $derived(data.view);
	const names = $derived(new Map(v.items.map((i) => [i.id, i.name])));
	const fmt = { day: formatDay, euro: formatEuro };

	type AddForm = {
		action: 'add';
		input: Record<string, string>;
		errors?: Partial<Record<string, string>>;
	};
	const failed = $derived.by((): AddForm | null => {
		const f = form as Partial<AddForm> | null | undefined;
		return f?.action === 'add' && f.input ? (f as AddForm) : null;
	});
	const status = $derived(form && 'success' in form ? form.success : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);

	let open = $state(false);
	let key = $state(0);
	let pending = $state(false);
	let kind = $state('add');
	let renameOpen = $state(false);
	let deleteOpen = $state(false);

	function start() {
		kind = 'add';
		key++;
		open = true;
	}
	function chooseKind(value: string) {
		kind = value;
	}

	function diff(after: number, before: number) {
		const d = after - before;
		if (d === 0) return '±0';
		return `${d > 0 ? '+' : '−'}${formatEuro(Math.abs(d))}`;
	}

	const rows = $derived([
		{
			label: 'Verfügbar',
			before: v.before.available,
			after: v.after.available,
			good: 'up' as const
		},
		{
			label: 'Mindestbestand',
			before: v.before.minimum,
			after: v.after.minimum,
			good: 'down' as const
		},
		{
			label: 'Fixkosten im Monat',
			before: v.before.fixedCosts,
			after: v.after.fixedCosts,
			good: 'down' as const
		},
		{
			label: 'Tiefster Stand (12 Monate)',
			before: v.before.lowest?.balance ?? v.balance,
			after: v.after.lowest?.balance ?? v.balance,
			good: 'up' as const
		},
		{ label: 'Stand in 12 Monaten', before: v.before.end, after: v.after.end, good: 'up' as const }
	]);
</script>

<Page title={v.scenario.name} back={{ path: 'was-waere-wenn', label: 'Was wäre wenn' }}>
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

	<p class="mb-4 px-4 text-[15px] text-label-2">
		{v.account.name} · Stand {formatEuro(v.balance)} · Stichtag {formatDay(v.after.cutoff)}
	</p>

	<section class="mb-8" aria-label="Wirkung">
		<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
			<span class="flex-1">Wirkung</span><span class="w-24 text-right">Heute</span><span
				class="w-28 text-right"
			>
				Mit Szenario
			</span>
		</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each rows as r (r.label)}
				{@const better = r.good === 'up' ? r.after > r.before : r.after < r.before}
				<li class="px-4 py-2.5" aria-label={r.label}>
					<div class="flex items-baseline gap-2">
						<span class="flex-1 truncate">{r.label}</span>
						<span class="w-24 text-right text-label-2 tabular">{formatEuro(r.before)}</span>
						<span class="w-28 text-right tabular">{formatEuro(r.after)}</span>
					</div>
					{#if r.after !== r.before}
						<p class={['text-right text-[13px] tabular', better ? 'text-income' : 'text-danger']}>
							{diff(r.after, r.before)}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
		{#if v.after.lowest && v.after.lowest.balance < 0}
			<p class="mt-1.5 px-4 text-[13px] text-danger">
				Mit dem Szenario rutscht das Konto am {formatDay(v.after.lowest.date)} ins Minus.
			</p>
		{/if}
	</section>

	<section class="mb-8" aria-label="Probeweise Änderungen">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Probeweise Änderungen</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each v.changes as c (c.id)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2">
					<span class="flex-1">{describeChange(c, names, fmt)}</span>
					<form method="POST" action="?/remove" use:enhance>
						<input type="hidden" name="changeId" value={c.id} />
						<button
							type="submit"
							class="kp-text-button text-[15px] text-danger"
							aria-label="Änderung entfernen"
						>
							Entfernen
						</button>
					</form>
				</li>
			{:else}
				<li class="px-4 py-3 text-[15px] text-label-2">Noch keine Änderung – füge eine hinzu.</li>
			{/each}
			<li>
				<button
					type="button"
					onclick={start}
					class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
				>
					Änderung hinzufügen
				</button>
			</li>
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">An den echten Daten ändert sich nichts.</p>
	</section>

	<ListGroup>
		<ListRow label="Umbenennen" onclick={() => (renameOpen = true)} />
		<ListRow label="Szenario löschen" destructive onclick={() => (deleteOpen = true)} />
	</ListGroup>
</Page>

<Sheet
	bind:open
	title="Änderung"
	confirmLabel="Hinzufügen"
	formId="change-form"
	confirmDisabled={pending}
>
	<form
		id="change-form"
		method="POST"
		action="?/add"
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') open = false;
				await update({ reset: false });
			};
		}}
	>
		{#key key}
			<ul class="mb-4 overflow-hidden rounded-[var(--radius-row)] bg-card">
				<SelectField
					label="Art"
					name="kind"
					value={kind}
					onchange={chooseKind}
					options={[
						{ value: 'add', label: 'Neuer Posten' },
						{ value: 'cancel', label: 'Posten kündigen' },
						{ value: 'amount', label: 'Betrag ändern' }
					]}
				/>
			</ul>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#if kind === 'add'}
					<SegmentedField
						name="direction"
						label="Richtung"
						initial="expense"
						options={[
							{ value: 'expense', label: 'Ausgabe' },
							{ value: 'income', label: 'Einnahme' }
						]}
					/>
					<FormField
						label="Bezeichnung"
						name="name"
						placeholder="z. B. Autokredit"
						maxlength={60}
						autocomplete="off"
						error={failed?.errors?.name}
					/>
					<SelectField
						label="Intervall"
						name="interval"
						value="monthly"
						options={WHATIF_INTERVALS.map((i) => ({ value: i, label: INTERVAL_LABELS[i] }))}
						error={failed?.errors?.interval}
					/>
				{:else}
					<SelectField
						label="Dauerposten"
						name="recurringId"
						options={[
							{ value: '', label: 'Bitte wählen' },
							...v.items.map((i) => ({
								value: i.id,
								label: `${i.name}${i.amount ? ` (${formatEuro(i.amount)})` : ''}`
							}))
						]}
						error={failed?.errors?.recurringId}
					/>
				{/if}
				{#if kind !== 'cancel'}
					<FormField
						label={kind === 'add' ? 'Betrag in €' : 'Neuer Betrag in €'}
						name="amount"
						inputmode="decimal"
						autocomplete="off"
						placeholder="0,00"
						error={failed?.errors?.amount}
					/>
				{/if}
				<FormField
					label={kind === 'cancel' ? 'Keine Zahlung mehr ab' : 'Ab'}
					name="date"
					type="date"
					value={data.today}
					error={failed?.errors?.date}
				/>
			</ul>
		{/key}
	</form>
</Sheet>

<Sheet bind:open={renameOpen} title="Umbenennen" confirmLabel="Sichern" formId="rename-form">
	<form
		id="rename-form"
		method="POST"
		action="?/rename"
		use:enhance={() =>
			async ({ update }) => {
				renameOpen = false;
				await update({ reset: false });
			}}
	>
		<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
			<FormField
				label="Name"
				name="name"
				value={v.scenario.name}
				maxlength={60}
				autocomplete="off"
			/>
		</ul>
	</form>
</Sheet>

<Sheet bind:open={deleteOpen} title="Szenario löschen">
	<p class="mb-6 px-4 text-center text-[15px]">
		„{v.scenario.name}“ und seine Änderungen werden gelöscht.
	</p>
	<form method="POST" action="?/delete" use:enhance>
		<Button type="submit" variant="destructive">Löschen</Button>
	</form>
</Sheet>
