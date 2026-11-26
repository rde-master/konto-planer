<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { formatEuro } from '#lib/money.js';
	import { dayLabel, formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Row = (typeof data.rows)[number];

	const days = $derived.by(() => {
		const groups: { day: string; items: Row[] }[] = [];
		for (const r of data.rows) {
			const last = groups.at(-1);
			if (last?.day === r.bookingDate) last.items.push(r);
			else groups.push({ day: r.bookingDate, items: [r] });
		}
		return groups;
	});
	const total = $derived(data.rows.reduce((sum, r) => sum + r.amount, 0));
	const out = $derived(data.rows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0));

	function query(accountId: string | null, tage: number) {
		const params = [accountId ? `konto=${accountId}` : null, tage !== 30 ? `tage=${tage}` : null]
			.filter(Boolean)
			.join('&');
		return params ? resolve(`offene-zahlungen?${params}`) : resolve('offene-zahlungen');
	}

	function filter(accountId: string) {
		void goto(query(accountId || null, data.days), { replace: true });
	}

	const RANGE_LABELS: Record<number, string> = { 30: '30 Tage', 90: '3 Monate', 365: '1 Jahr' };
</script>

<Page title="Offene Zahlungen" back={{ path: 'mehr', label: 'Mehr' }}>
	{#if data.accountFilter.length > 1}
		<ul class="kp-span mb-4 overflow-hidden rounded-[var(--radius-row)] bg-card">
			<SelectField
				label="Konto"
				name="konto"
				options={[{ value: '', label: 'Alle Konten' }, ...data.accountFilter]}
				value={data.accountId ?? ''}
				onchange={filter}
			/>
		</ul>
	{/if}

	<nav aria-label="Zeitraum" class="mb-6 grid grid-cols-3 gap-0.5 rounded-[10px] bg-fill p-0.5">
		{#each data.ranges as range (range)}
			<a
				href={query(data.accountId, range)}
				data-sveltekit-replacestate
				aria-current={range === data.days ? 'page' : undefined}
				class={[
					'grid min-h-9 place-items-center rounded-[8px] text-[15px] font-medium',
					range === data.days ? 'bg-segment shadow-sm' : 'text-label'
				]}
			>
				{RANGE_LABELS[range]}
			</a>
		{/each}
	</nav>

	{#if data.rows.length === 0}
		<div class="kp-span rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<CalendarClock class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Keine offenen Zahlungen</p>
			<p class="mt-1 text-[15px] text-label-2">
				Hier erscheinen die nächsten Fälligkeiten deiner Dauerposten.
			</p>
		</div>
	{:else}
		<p class="kp-span mb-4 px-4 text-[13px] text-label-2">
			Ausgänge {formatEuro(out)} · Saldo {total > 0 ? '+' : ''}{formatEuro(total)}. Termine am
			Wochenende oder Bankfeiertag stehen beim nächsten Bankarbeitstag.
		</p>
	{/if}

	{#each days as group (group.day)}
		<section class="mb-6" aria-label={formatDay(group.day)}>
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
				{dayLabel(new Date(`${group.day}T12:00:00Z`))}
			</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each group.items as r (r.recurringId + r.accountId + r.dueDate)}
					<li>
						<a
							href={resolve(`dauerposten/${r.recurringId}`)}
							class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{r.name}</span>
								<span class="block truncate text-[13px] text-label-2">
									{[
										data.accountId ? null : r.accountName,
										r.dueDate !== r.bookingDate ? `planmäßig ${formatDay(r.dueDate)}` : null
									]
										.filter(Boolean)
										.join(' · ') || 'Dauerposten'}
								</span>
							</span>
							<span class={['shrink-0 text-[17px] tabular', r.amount > 0 && 'text-income']}>
								{r.amount > 0 ? '+' : ''}{formatEuro(r.amount)}
							</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{/each}
</Page>
