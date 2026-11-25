<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Page from '#lib/components/Page.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { dayLabel, formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const firstName = $derived(data.user.name.split(' ')[0]);
	const h = $derived(data.household);

	function signed(amount: number) {
		return `${amount > 0 ? '+' : ''}${formatEuro(amount)}`;
	}
</script>

<Page title="Übersicht">
	<p class="mb-6 text-[17px] text-label-2">Hallo {firstName}!</p>

	{#if h.accountCount === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Landmark class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Konten</p>
			<p class="mt-1 text-[15px] text-label-2">
				{data.user.role === 'admin'
					? 'Lege unter „Konten“ dein erstes Konto an.'
					: 'Sobald dir ein Konto freigegeben ist, erscheint es hier.'}
			</p>
		</div>
	{:else}
		<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Haushalt">
			<p class="text-[13px] text-label-2">
				Haushalt · {h.accountCount}
				{h.accountCount === 1 ? 'Konto' : 'Konten'}
			</p>
			<p class="text-[28px] font-bold tabular" aria-label="Summe aller Konten">
				{formatEuro(h.total)}
			</p>
			<dl class="mt-3 grid grid-cols-2 gap-3 text-[15px]">
				<div>
					<dt class="text-[13px] text-label-2">Verfügbar (Giro)</dt>
					<dd class={['tabular', h.available < 0 && 'text-danger']} aria-label="Verfügbar gesamt">
						{formatEuro(h.available)}
					</dd>
				</div>
				<div>
					<dt class="text-[13px] text-label-2">Sparbücher</dt>
					<dd class="tabular" aria-label="Sparbücher gesamt">{formatEuro(h.savings)}</dd>
				</div>
				{#if h.goalCount}
					<div class="col-span-2">
						<dt class="text-[13px] text-label-2">Sparziele ({h.goalCount})</dt>
						<dd class="tabular">
							<a href={resolve('sparziele')} class="text-accent">
								{formatEuro(h.goalsAllocated)} von {formatEuro(h.goalsTarget)} zurückgelegt
							</a>
						</dd>
					</div>
				{/if}
			</dl>
		</section>

		{#if data.giro.length}
			<section class="mb-8" aria-label="Verfügbar">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Verfügbar</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.giro as g (g.id)}
						<li>
							<a
								href={resolve(`konten/${g.id}`)}
								class="flex items-center gap-3 px-4 py-3 active:bg-fill"
								aria-label="{g.name} verfügbar"
							>
								<span
									class="size-3 shrink-0 rounded-full"
									style:background-color={accountColorCss(g.color)}
								></span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[17px]">{g.name}</span>
									<span class="block truncate text-[13px] text-label-2 tabular">
										Stand {formatEuro(g.balance)}{g.cutoff ? ` · bis ${formatDay(g.cutoff)}` : ''}
									</span>
									{#if g.minimum}
										<span class="block truncate text-[13px] text-label-2 tabular">
											Mindestbestand {formatEuro(g.minimum)}
										</span>
									{/if}
									{#if g.exceedsOverdraft || g.goesNegative}
										<span
											role="alert"
											class="mt-0.5 flex items-center gap-1 text-[13px] text-danger"
										>
											<TriangleAlert class="size-4" />
											{g.exceedsOverdraft
												? 'Dispo könnte überschritten werden'
												: 'Konto rutscht ins Minus'}
										</span>
									{/if}
								</span>
								<span
									class={[
										'shrink-0 text-[20px] font-semibold tabular',
										(g.available ?? 0) < 0 && 'text-danger'
									]}
								>
									{g.available !== null ? formatEuro(g.available) : '–'}
								</span>
								<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		<section class="mb-8" aria-label="Nächste 7 Tage">
			<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
				<span class="flex-1">Nächste 7 Tage</span>
				<a href={resolve('offene-zahlungen')} class="text-accent normal-case">Alle</a>
			</h2>
			{#if data.upcoming.length}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.upcoming as p (p.recurringId + p.dueDate + p.accountId)}
						<li>
							<a
								href={resolve(`dauerposten/${p.recurringId}`)}
								class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
							>
								<Logo name={p.name} logo={data.logos[p.recurringId]?.logo ?? null} />
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[17px]">{p.name}</span>
									<span class="block truncate text-[13px] text-label-2">
										{dayLabel(new Date(`${p.bookingDate}T12:00:00Z`))} · {p.accountName}
									</span>
								</span>
								<span class={['shrink-0 tabular', p.amount > 0 && 'text-income']}>
									{signed(p.amount)}
								</span>
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
					Keine Zahlungen in den nächsten 7 Tagen.
				</p>
			{/if}
		</section>

		{#if data.soon.length}
			<section class="mb-8" aria-label="Bald kündbar">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Bald kündbar</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.soon as c (c.id)}
						<li>
							<a
								href={resolve(`dauerposten/${c.id}`)}
								class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
							>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[17px]">{c.name}</span>
									<span class="block truncate text-[13px] text-label-2">
										{c.deadline
											? `kündigen bis ${formatDay(c.deadline)}, endet dann am ${formatDay(c.end)}`
											: `kündbar, endet frühestens am ${formatDay(c.end)}`}
									</span>
								</span>
								<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</Page>
