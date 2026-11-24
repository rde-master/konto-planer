<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const view = $derived(data.view);
	const counts = $derived({
		new: view.rows.filter((r) => r.status === 'new').length,
		match: view.rows.filter((r) => r.status === 'match').length,
		duplicate: view.rows.filter((r) => r.status === 'duplicate').length
	});
	const diff = $derived(
		view.bankBalance !== null && data.appBalance !== null
			? view.bankBalance - data.appBalance
			: null
	);
	let pending = $state(false);

	const STATUS: Record<string, string> = {
		new: 'neu',
		match: 'ersetzt',
		duplicate: 'schon vorhanden'
	};
	const SOURCE: Record<string, string> = {
		manual: 'manuelle Buchung',
		provisional: 'vorläufige Buchung'
	};
</script>

<Page
	title={view.status === 'draft' ? 'Vorschau' : 'Import übernommen'}
	back={{ path: `konten/${view.account.id}/import`, label: 'Import' }}
>
	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{/if}

	{#if view.status === 'draft'}
		<section class="mb-6 rounded-[var(--radius-card)] bg-card p-5" aria-label="Zusammenfassung">
			<p class="text-[17px] font-semibold">{view.fileName}</p>
			<p class="mt-1 text-[15px] text-label-2">
				{view.rows.length} Zeilen{view.from && view.to
					? ` vom ${formatDay(view.from)} bis ${formatDay(view.to)}`
					: ''}
			</p>
			<p class="mt-3 text-[15px] tabular">
				<span aria-label="Neu">{counts.new} neu</span> ·
				<span aria-label="Ersetzt">{counts.match} ersetzen eine Buchung</span> ·
				<span aria-label="Schon vorhanden">{counts.duplicate} schon vorhanden</span>
			</p>
			<p class="mt-2 text-[13px] text-label-2">
				Erkannt: Zeichensatz {view.encoding}, Datum {view.dateFormat}, Beträge {view.numberFormat}
			</p>
			{#if view.adjustments}
				<p class="mt-2 text-[13px] text-label-2">
					{view.adjustments === 1
						? 'Eine Anpassung im Zeitraum wird'
						: `${view.adjustments} Anpassungen im Zeitraum werden`} aufgelöst; danach gleicht die App
					den Stand mit dem Saldo der Bank ab.
				</p>
			{/if}
		</section>

		<form
			method="POST"
			action="?/commit"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
		>
			<ul
				class="mb-6 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				aria-label="Buchungen der Datei"
			>
				{#each view.rows as r (r.line)}
					<li
						class={['flex items-start gap-3 px-4 py-2.5', r.status === 'duplicate' && 'opacity-50']}
					>
						{#if r.status !== 'duplicate'}
							<input
								type="checkbox"
								name="line"
								value={r.line}
								checked
								class="mt-1 size-5 shrink-0 accent-[var(--kp-accent)]"
								aria-label="Zeile {r.line} übernehmen"
							/>
						{:else}
							<span class="size-5 shrink-0"></span>
						{/if}
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[17px]">
								{r.counterparty ?? r.bookingText ?? 'Buchung'}
							</span>
							<span class="block truncate text-[13px] text-label-2">
								{formatDay(r.bookingDate)} · {STATUS[r.status]}{r.match
									? ` (${SOURCE[r.match.source]} vom ${formatDay(r.match.date)})`
									: ''}
							</span>
							{#if r.purpose}
								<span class="block truncate text-[13px] text-label-2">{r.purpose}</span>
							{/if}
						</span>
						<span class={['shrink-0 tabular', r.amount > 0 && 'text-income']}>
							{r.amount > 0 ? '+' : ''}{formatEuro(r.amount)}
						</span>
					</li>
				{/each}
			</ul>
			<div class="flex flex-col gap-3">
				<Button type="submit" disabled={pending || counts.new + counts.match === 0}>
					Übernehmen
				</Button>
			</div>
		</form>
		<form method="POST" action="?/discard" use:enhance class="mt-3 mb-8">
			<Button type="submit" variant="plain">Abbrechen</Button>
		</form>
	{:else}
		<section class="mb-6 rounded-[var(--radius-card)] bg-card p-5" aria-label="Ergebnis">
			<p class="text-[17px] font-semibold">{view.fileName}</p>
			<ul class="mt-2 text-[15px] tabular">
				<li>{view.newCount} neue Buchungen</li>
				<li>{view.matchedCount} manuelle oder vorläufige Buchungen ersetzt</li>
				<li>{view.skippedCount} übersprungen</li>
				{#if view.adjustmentsRemoved}<li>{view.adjustmentsRemoved} Anpassungen aufgelöst</li>{/if}
			</ul>
		</section>

		{#if diff !== null && view.checkDate}
			<section class="mb-8" aria-label="Saldo">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
					Saldo am {formatDay(view.checkDate)}
				</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
						<span class="flex-1">Laut Bank</span>
						<span class="tabular">{formatEuro(view.bankBalance ?? 0)}</span>
					</li>
					<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
						<span class="flex-1">Laut App</span>
						<span class="tabular">{formatEuro(data.appBalance ?? 0)}</span>
					</li>
					<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
						<span class="flex-1">Differenz</span>
						<span class={['tabular', diff !== 0 && 'text-danger']} aria-label="Differenz">
							{diff === 0 ? 'stimmt' : formatEuro(diff)}
						</span>
					</li>
				</ul>
				{#if diff !== 0}
					<p class="mt-1.5 mb-4 px-4 text-[13px] text-label-2">
						Meist fehlen Buchungen vor dem Zeitraum der Datei oder der Startsaldo stimmt nicht.
					</p>
					<form method="POST" action="?/adjust" use:enhance>
						<Button type="submit" variant="tinted">Differenz als Anpassung buchen</Button>
					</form>
				{/if}
			</section>
		{/if}
	{/if}
</Page>
