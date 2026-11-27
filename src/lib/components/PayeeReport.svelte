<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '$app/forms';
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { gotoReplace } from '#lib/back.svelte.js';
	import { formatDay } from '#lib/dates.js';
	import { formatEuro } from '#lib/money.js';
	import type { LogoRef } from '#lib/logos.js';
	import { matchesPayee, type PayeeMember, type PayeeTotal, type Period } from '#lib/payees.js';
	import FormField from './FormField.svelte';
	import Logo from './Logo.svelte';
	import Sheet from './Sheet.svelte';

	type Row = PayeeTotal & { logo: LogoRef | null };
	type Result = {
		payee?: {
			merged?: { name: string; count: number };
			renamed?: string;
			split?: { name: string; dissolved: boolean };
		};
		payeeError?: string;
	} | null;

	/**
	 * "Auswertungen › Empfänger": what was paid to whom in a period. Payees that are the same
	 * company under several names can be put together ("Zusammenfassen").
	 */
	let {
		rows,
		period,
		presets,
		account,
		query,
		result
	}: {
		rows: Row[];
		period: Period;
		presets: (Period & { label: string })[];
		/** Id of the one account the report is about (null for several). */
		account: string | null;
		/** Query string of the reports page with these parameters (keeps the account choice). */
		query: (params: Record<string, string | null>) => string;
		result: Result;
	} = $props();

	let text = $state('');
	let selecting = $state(false);
	let selected = $state<string[]>([]);
	let mergeOpen = $state(false);
	let mergeName = $state('');
	let renaming = $state<{ id: string; name: string } | null>(null);
	let renameOpen = $state(false);

	const visible = $derived(rows.filter((r) => matchesPayee(r, text)));
	const total = $derived(visible.reduce((s, r) => s + r.paid, 0));
	const largest = $derived(rows[0]?.paid ?? 0);
	const chosen = $derived(rows.filter((r) => selected.includes(r.id)));

	const message = $derived.by(() => {
		const done = result?.payee;
		if (done?.merged)
			return `„${done.merged.name}“ fasst jetzt ${done.merged.count} Namen zusammen.`;
		if (done?.renamed) return `Umbenannt in „${done.renamed}“.`;
		if (done?.split)
			return done.split.dissolved
				? `Zusammenfassung „${done.split.name}“ aufgelöst.`
				: `Name aus „${done.split.name}“ herausgelöst.`;
		return null;
	});

	function periodHref(p: Period) {
		return resolve(`auswertungen?${query({ ansicht: 'empfaenger', von: p.from, bis: p.to })}`);
	}

	/** Form action that keeps view, account and period in the address. */
	function action(name: string) {
		return `?/${name}&${query({ ansicht: 'empfaenger', von: period.from, bis: period.to })}`;
	}

	function setDay(change: Partial<Period>) {
		const next = { ...period, ...change };
		if (!next.from || !next.to) return;
		void gotoReplace(periodHref(next), { reset: false });
	}

	/** The payments behind a name in the booking list. */
	function bookingsHref(m: PayeeMember) {
		const pairs: [string, string | null][] = [
			['q', m.search],
			['konto', account],
			['von', period.from],
			['bis', period.to],
			['richtung', 'out']
		];
		const q = pairs
			.filter(([, v]) => v)
			.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
			.join('&');
		return resolve(`buchungen?${q}`);
	}

	function toggle(id: string) {
		selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
	}

	function stopSelecting() {
		selecting = false;
		selected = [];
	}

	function openMerge() {
		// The name of a group that is part of it, else that of the largest payee.
		mergeName = (chosen.find((r) => r.groupId) ?? chosen[0])?.label ?? '';
		mergeOpen = true;
	}

	const mergeEnhance: SubmitFunction = () => {
		return async ({ result: r, update }) => {
			await update();
			if (r.type === 'success') {
				mergeOpen = false;
				stopSelecting();
			}
		};
	};

	const renameEnhance: SubmitFunction = () => {
		return async ({ result: r, update }) => {
			await update();
			if (r.type === 'success') renameOpen = false;
		};
	};

	const names = (n: number) => `${n} ${n === 1 ? 'Name' : 'Namen'}`;

	function subtitle(r: { count: number; last: string; received: number }) {
		return [
			`${r.count} ${r.count === 1 ? 'Zahlung' : 'Zahlungen'}`,
			`zuletzt ${formatDay(r.last)}`,
			r.received ? `${formatEuro(r.received)} zurück` : null
		]
			.filter(Boolean)
			.join(' · ');
	}
</script>

{#snippet line(r: Row)}
	{#if r.id === 'p:'}
		<span class="size-9 shrink-0 rounded-full bg-fill" aria-hidden="true"></span>
	{:else}
		<Logo name={r.label} logo={r.logo} />
	{/if}
	<span class="min-w-0 flex-1">
		<span class="flex items-baseline gap-2">
			<span class="min-w-0 flex-1 truncate text-[17px]">{r.label}</span>
			<span class="shrink-0 tabular" data-paid>{formatEuro(r.paid)}</span>
		</span>
		<span class="block truncate text-[13px] text-label-2">
			{r.groupId ? `${names(r.members.length)} · ${subtitle(r)}` : subtitle(r)}
		</span>
		<span class="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-fill" aria-hidden="true">
			<span
				class="block h-full rounded-full bg-accent"
				style:width="{largest ? Math.max(1, (r.paid / largest) * 100) : 0}%"
			></span>
		</span>
	</span>
{/snippet}

<nav aria-label="Zeitraum" class="mb-3 flex gap-2 overflow-x-auto pb-1">
	{#each presets as p (p.label)}
		<a
			href={periodHref(p)}
			data-sveltekit-reset="false"
			aria-current={period.from === p.from && period.to === p.to ? 'page' : undefined}
			class={[
				'shrink-0 rounded-full px-3 py-1 text-[15px] whitespace-nowrap',
				period.from === p.from && period.to === p.to
					? 'bg-accent text-accent-contrast'
					: 'bg-card text-accent'
			]}
		>
			{p.label}
		</a>
	{/each}
</nav>

<div class="kp-span mb-4 grid grid-cols-2 gap-3">
	<label class="flex flex-col rounded-[var(--radius-row)] bg-card px-4 py-2">
		<span class="text-[13px] text-label-2">Von</span>
		<input
			type="date"
			value={period.from}
			max={period.to}
			onchange={(e) => setDay({ from: e.currentTarget.value })}
			class="min-w-0 bg-transparent text-[17px] outline-none"
		/>
	</label>
	<label class="flex flex-col rounded-[var(--radius-row)] bg-card px-4 py-2">
		<span class="text-[13px] text-label-2">Bis</span>
		<input
			type="date"
			value={period.to}
			min={period.from}
			onchange={(e) => setDay({ to: e.currentTarget.value })}
			class="min-w-0 bg-transparent text-[17px] outline-none"
		/>
	</label>
</div>

{#if result?.payeeError}
	<p role="alert" class="kp-span mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-danger">
		{result.payeeError}
	</p>
{:else if message}
	<p role="status" class="kp-span mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
		{message}
	</p>
{/if}

{#if rows.length}
	<div class="kp-span mb-4 flex items-center gap-3">
		<label class="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-row)] bg-card px-4">
			<SearchIcon class="size-5 shrink-0 text-label-3" />
			<span class="sr-only">Empfänger suchen</span>
			<input
				type="search"
				bind:value={text}
				placeholder="Empfänger"
				enterkeyhint="search"
				autocomplete="off"
				class="min-h-11 min-w-0 flex-1 bg-transparent text-[17px] outline-none"
			/>
		</label>
		{#if selecting}
			<button type="button" class="kp-text-button text-[15px] text-accent" onclick={stopSelecting}>
				Abbrechen
			</button>
		{:else if rows.length > 1}
			<button
				type="button"
				class="kp-text-button text-[15px] text-accent"
				onclick={() => (selecting = true)}
			>
				Zusammenfassen
			</button>
		{/if}
	</div>
{/if}

{#if selecting}
	<!-- Stays below the title bar while the list scrolls (phones; not inside desktop columns). -->
	<div
		class="kp-span sticky top-[calc(env(safe-area-inset-top)+3.75rem)] z-20 mb-4 flex items-center gap-3 rounded-[var(--radius-row)] bg-card px-4 py-2.5 shadow-md"
		aria-label="Auswahl"
		role="group"
	>
		<p class="min-w-0 flex-1 text-[15px]">
			{#if selected.length}
				{selected.length} ausgewählt
			{:else}
				Wähle die Empfänger, die derselbe sind.
			{/if}
		</p>
		<button
			type="button"
			class="kp-text-button shrink-0 text-[15px] font-semibold text-accent disabled:text-label-3"
			disabled={selected.length < 2}
			onclick={openMerge}
		>
			Als einen zählen
		</button>
	</div>
{/if}

<section class="kp-flow mb-8" aria-label="Zahlungen nach Empfänger">
	<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
		<span class="flex-1">{visible.length} Empfänger</span>
		<span class="tabular" aria-label="Gezahlt gesamt">{formatEuro(total)}</span>
	</h2>
	{#if visible.length}
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each visible as r (r.id)}
				<li aria-label={r.label}>
					{#if selecting}
						{#if r.id === 'p:'}
							<div class="flex items-center gap-3 px-4 py-2.5 opacity-50">
								<span class="size-5 shrink-0"></span>
								{@render line(r)}
							</div>
						{:else}
							<label class="flex cursor-pointer items-center gap-3 px-4 py-2.5 active:bg-fill">
								<input
									type="checkbox"
									class="size-5 shrink-0 accent-[var(--kp-accent)]"
									checked={selected.includes(r.id)}
									onchange={() => toggle(r.id)}
									aria-label="{r.label} auswählen"
								/>
								{@render line(r)}
							</label>
						{/if}
					{:else if r.groupId}
						<details class="group">
							<summary
								class="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 active:bg-fill [&::-webkit-details-marker]:hidden"
							>
								{@render line(r)}
								<ChevronRight
									class="size-5 shrink-0 text-label-3 transition-transform group-open:rotate-90"
									strokeWidth={2.5}
								/>
							</summary>
							<ul class="border-t-[0.5px] border-separator bg-fill/40 pb-1">
								{#each r.members as m (m.key)}
									<li class="flex items-start gap-3 py-2 pr-4 pl-16" aria-label={m.label}>
										<a href={bookingsHref(m)} class="min-w-0 flex-1 text-accent">
											<span class="block text-[15px] break-words">{m.label}</span>
											<span class="block text-[13px] text-label-2">{subtitle(m)}</span>
										</a>
										<span class="flex shrink-0 flex-col items-end">
											<span class="text-[15px] tabular">{formatEuro(m.paid)}</span>
											<form method="POST" action={action('payeeSplit')} use:enhance>
												<input type="hidden" name="groupId" value={r.groupId} />
												<input type="hidden" name="key" value={m.key} />
												<button
													type="submit"
													class="kp-text-button text-[13px] text-accent"
													aria-label="{m.label} herauslösen"
												>
													Herauslösen
												</button>
											</form>
										</span>
									</li>
								{/each}
								<li class="flex flex-wrap gap-x-6 gap-y-1 py-2 pr-4 pl-16">
									<button
										type="button"
										class="kp-text-button text-[15px] text-accent"
										onclick={() => {
											renaming = { id: r.groupId!, name: r.label };
											renameOpen = true;
										}}
									>
										Umbenennen
									</button>
									<form method="POST" action={action('payeeSplit')} use:enhance>
										<input type="hidden" name="groupId" value={r.groupId} />
										<button type="submit" class="kp-text-button text-[15px] text-danger">
											Zusammenfassung auflösen
										</button>
									</form>
								</li>
							</ul>
						</details>
					{:else if r.id === 'p:'}
						<div class="flex items-center gap-3 px-4 py-2.5">{@render line(r)}</div>
					{:else}
						<a
							href={bookingsHref(r.members[0])}
							class="flex items-center gap-3 px-4 py-2.5 active:bg-fill"
						>
							{@render line(r)}
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
					{/if}
				</li>
			{/each}
		</ul>
	{:else}
		<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-label-2">
			{rows.length ? 'Kein Empfänger passt zur Suche.' : 'Keine Zahlungen in diesem Zeitraum.'}
		</p>
	{/if}
	<p class="mt-2 px-4 text-[13px] text-label-2">
		Gezählt werden Ausgaben ohne Umbuchungen zwischen eigenen Konten. Bucht derselbe Empfänger unter
		mehreren Namen ab, fasse sie mit „Zusammenfassen“ zu einem zusammen.
	</p>
</section>

<Sheet bind:open={mergeOpen} title="Zusammenfassen" confirmLabel="Sichern" formId="payee-merge">
	<form id="payee-merge" method="POST" action={action('payeeMerge')} use:enhance={mergeEnhance}>
		{#each selected as id (id)}
			<input type="hidden" name="id" value={id} />
		{/each}
		<ul class="mb-2 overflow-hidden rounded-[var(--radius-row)] bg-card">
			<FormField
				label="Name des Empfängers"
				name="name"
				bind:value={mergeName}
				maxlength={60}
				required
				autocomplete="off"
			/>
		</ul>
		<p class="mb-4 px-4 text-[13px] text-label-2">
			{chosen.map((r) => r.label).join(', ')} – zählen künftig als ein Empfänger. Die Buchungen bleiben,
			wie sie sind.
		</p>
	</form>
</Sheet>

<Sheet bind:open={renameOpen} title="Umbenennen" confirmLabel="Sichern" formId="payee-rename">
	{#if renaming}
		<form
			id="payee-rename"
			method="POST"
			action={action('payeeRename')}
			use:enhance={renameEnhance}
		>
			<input type="hidden" name="groupId" value={renaming.id} />
			<ul class="mb-4 overflow-hidden rounded-[var(--radius-row)] bg-card">
				<FormField
					label="Name des Empfängers"
					name="name"
					bind:value={renaming.name}
					maxlength={60}
					required
					autocomplete="off"
				/>
			</ul>
		</form>
	{/if}
</Sheet>
