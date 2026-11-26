<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { INTERVAL_LABELS } from '#lib/recurring.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const view = $derived(data.view);
	const counts = $derived({
		new: view.rows.filter((r) => r.status === 'new').length,
		recurring: view.rows.filter((r) => r.status === 'recurring').length,
		replace: view.rows.filter((r) => r.status === 'replace').length,
		duplicate: view.rows.filter((r) => r.status === 'duplicate').length
	});
	const diff = $derived(
		view.bankBalance !== null && data.appBalance !== null
			? view.bankBalance - data.appBalance
			: null
	);
	let pending = $state(false);

	const VIA: Record<string, string> = {
		mandate: 'Mandat',
		iban: 'IBAN',
		name: 'Name und Fälligkeit',
		amount: 'Betrag und Datum'
	};

	function statusText(r: (typeof view.rows)[number]): string {
		if (r.status === 'duplicate') return 'schon vorhanden';
		if (r.status === 'recurring' && r.recurring)
			return `Dauerposten „${r.recurring.name}“ (${VIA[r.recurring.via]})`;
		if (r.status === 'replace' && r.replace)
			return r.replace.kind === 'manual'
				? `ersetzt manuelle Buchung vom ${formatDay(r.replace.date)}`
				: 'Gegenbuchung aus anderem Import';
		if (r.transfer)
			return r.transfer.counterBookingId
				? `Umbuchung, verknüpft mit ${r.transfer.accountName}`
				: `Umbuchung, Gegenbuchung auf ${r.transfer.accountName}`;
		return 'neu';
	}

	function signed(amount: number) {
		return `${amount > 0 ? '+' : ''}${formatEuro(amount)}`;
	}
</script>

{#snippet missingList()}
	{#if view.missing.length}
		<section class="mb-8" aria-label="Ohne echte Buchung">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Ohne echte Buchung</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each view.missing as m (m.id)}
					<li>
						<a
							href={resolve(`buchungen/${m.id}`)}
							class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate">{m.label}</span>
								<span class="block text-[13px] text-label-2">vorläufig am {formatDay(m.date)}</span>
							</span>
							<span class="tabular">{signed(m.amount)}</span>
						</a>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Diese vorläufigen Buchungen fehlen in der Datei. Sie bleiben stehen, bis du an der Buchung
				entscheidest: behalten, verschieben oder zurücknehmen.
			</p>
		</section>
	{/if}
{/snippet}

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
				<span aria-label="Dauerposten">{counts.recurring} zu Dauerposten</span> ·
				<span aria-label="Ersetzt">{counts.replace} ersetzen eine Buchung</span> ·
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
						aria-label="Zeile {r.line}"
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
							<span class="block text-[13px] text-label-2">
								{formatDay(r.bookingDate)} · {statusText(r)}
							</span>
							{#if r.purpose}
								<span class="block truncate text-[13px] text-label-2">{r.purpose}</span>
							{/if}
							{#if r.status !== 'duplicate' && r.categoryId}
								<span class="block truncate text-[13px] text-label-2">
									Kategorie: {view.categoryNames[r.categoryId] ?? '–'}
								</span>
							{/if}
							{#if r.recurring?.amountDiffers && r.recurring.due}
								<label class="mt-1 flex items-start gap-2 text-[13px]">
									<input
										type="checkbox"
										name="newAmount"
										value={r.line}
										class="mt-0.5 size-4 shrink-0 accent-[var(--kp-accent)]"
									/>
									<span>
										Betrag weicht ab (geplant {formatEuro(r.recurring.due.amount)}): neuen Betrag ab
										{formatDay(r.recurring.due.dueDate)} übernehmen
									</span>
								</label>
							{/if}
						</span>
						<span class={['shrink-0 tabular', r.amount > 0 && 'text-income']}>
							{signed(r.amount)}
						</span>
					</li>
				{/each}
			</ul>

			{#if view.suggestions.length}
				<section class="mb-6" aria-label="Neue Dauerposten">
					<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Neue Dauerposten</h2>
					<ul
						class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					>
						{#each view.suggestions as s (s.key)}
							<li class="px-4 py-2.5">
								<label class="flex items-start gap-3">
									<input
										type="checkbox"
										name="suggest"
										value={s.key}
										class="mt-1 size-5 shrink-0 accent-[var(--kp-accent)]"
										aria-label="{s.name} als Dauerposten anlegen"
									/>
									<span class="min-w-0 flex-1">
										<span class="block truncate text-[17px]">{s.name}</span>
										<span class="block text-[13px] text-label-2">
											{s.kind === 'income' ? 'Einnahme' : 'Ausgabe'}
											{INTERVAL_LABELS[s.interval]} · {s.count}× gefunden · zuletzt {formatDay(
												s.lastDate
											)}
										</span>
									</span>
									<span class={['shrink-0 tabular', s.kind === 'income' && 'text-income']}>
										{formatEuro(s.amount)}
									</span>
								</label>
								{#if s.kind === 'income'}
									<label class="mt-1 ml-8 flex items-center gap-2 text-[15px]">
										<input
											type="checkbox"
											name="salary"
											value={s.key}
											class="size-4 accent-[var(--kp-accent)]"
										/>
										Gehalt (bestimmt den Stichtag)
									</label>
								{/if}
							</li>
						{/each}
					</ul>
					<p class="mt-1.5 px-4 text-[13px] text-label-2">
						Wiederkehrende Zahlungen ohne Dauerposten. Mit Haken legt die App sie beim Übernehmen
						an; die Zahlungen aus der Datei gehören dann dazu.
					</p>
				</section>
			{/if}

			{@render missingList()}

			<Button
				type="submit"
				disabled={pending || counts.new + counts.recurring + counts.replace === 0}
			>
				Übernehmen
			</Button>
		</form>
		<form method="POST" action="?/discard" use:enhance class="mt-3 mb-8">
			<Button type="submit" variant="plain">Abbrechen</Button>
		</form>
	{:else}
		<section class="mb-6 rounded-[var(--radius-card)] bg-card p-5" aria-label="Ergebnis">
			<p class="text-[17px] font-semibold">{view.fileName}</p>
			<ul class="mt-2 text-[15px] tabular">
				<li>{view.newCount} neue Buchungen</li>
				<li>{view.matchedCount} Dauerposten oder Buchungen zugeordnet</li>
				<li>{view.skippedCount} übersprungen</li>
				{#if view.adjustmentsRemoved}<li>{view.adjustmentsRemoved} Anpassungen aufgelöst</li>{/if}
			</ul>
		</section>

		{@render missingList()}

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
