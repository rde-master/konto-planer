<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import BarChart from '#lib/components/BarChart.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { monthLabel } from '#lib/tags.js';
	import { heatLevel, savingsRate } from '#lib/reports.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const VIEWS = [
		{ value: 'kategorien', label: 'Kategorien' },
		{ value: 'einaus', label: 'Ein/Aus' },
		{ value: 'fixkosten', label: 'Fixkosten' },
		{ value: 'preise', label: 'Preise' },
		{ value: 'kalender', label: 'Kalender' }
	] as const;

	/** Query string from pairs (empty values left out). */
	function qs(pairs: [string, string | number | null][]) {
		return pairs
			.filter(([, v]) => v !== null && v !== '')
			.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
			.join('&');
	}

	/** Query for this page; keeps the account choice. */
	function q(params: Record<string, string | number | null>) {
		return qs([
			['konto', data.accounts.value !== 'giro' ? data.accounts.value : null],
			...Object.entries(params)
		]);
	}

	function account(value: string) {
		const query = qs([
			['ansicht', data.view],
			['konto', value !== 'giro' ? value : null]
		]);
		void goto(resolve(`auswertungen?${query}`), { replace: true, reset: false });
	}

	function short(month: string) {
		return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('de-DE', { month: 'short' });
	}

	function percent(v: number) {
		const text = Math.abs(v * 100).toLocaleString('de-DE', { maximumFractionDigits: 1 });
		return `${v > 0 ? '+' : v < 0 ? '−' : ''}${text} %`;
	}

	let selectedDay = $state<string | null>(null);
	const maxHeat = $derived(
		'heat' in data && data.heat ? Math.max(0, ...data.heat.map((d) => d.amount)) : 0
	);
	/** Empty cells before the 1st (Monday first). */
	const offset = $derived(
		data.month ? (new Date(`${data.month}-01T12:00:00Z`).getUTCDay() + 6) % 7 : 0
	);
	const HEAT = ['bg-fill', 'bg-[#ff9500]/25', 'bg-[#ff9500]/45', 'bg-[#ff9500]/70', 'bg-[#ff3b30]'];
</script>

<Page title="Auswertungen">
	<nav aria-label="Ansicht" class="mb-4 flex gap-1 overflow-x-auto rounded-full bg-fill p-1">
		{#each VIEWS as v (v.value)}
			<a
				href={resolve(`auswertungen?${q({ ansicht: v.value })}`)}
				aria-current={data.view === v.value ? 'page' : undefined}
				class={[
					'flex-1 shrink-0 rounded-full px-3 py-1.5 text-center text-[13px] font-medium whitespace-nowrap',
					data.view === v.value ? 'bg-card shadow-sm' : 'text-label-2'
				]}
			>
				{v.label}
			</a>
		{/each}
	</nav>

	<ul class="mb-6 overflow-hidden rounded-[var(--radius-row)] bg-card">
		<SelectField
			label="Konten"
			name="konto"
			options={data.accounts.options}
			value={data.accounts.value}
			onchange={account}
		/>
	</ul>

	{#if data.categories}
		<nav aria-label="Zeitraum" class="mb-4 flex gap-2 overflow-x-auto pb-1">
			{#each data.periods ?? [] as p (p)}
				<a
					href={resolve(`auswertungen?${q({ ansicht: 'kategorien', zeitraum: p })}`)}
					aria-current={data.period === p ? 'page' : undefined}
					class={[
						'shrink-0 rounded-full px-3 py-1 text-[15px] whitespace-nowrap',
						data.period === p ? 'bg-accent text-accent-contrast' : 'bg-card text-accent'
					]}
				>
					{p.length === 4 ? `Jahr ${p}` : monthLabel(p)}
				</a>
			{/each}
		</nav>
		{@const total = data.categories.reduce((s, c) => s + c.amount, 0)}
		<section class="mb-8" aria-label="Ausgaben nach Kategorie">
			<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
				<span class="flex-1">Ausgaben nach Kategorie</span>
				<span class="tabular" aria-label="Ausgaben gesamt">{formatEuro(total)}</span>
			</h2>
			{#if data.categories.length}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.categories as c (c.id ?? 'none')}
						<li class="px-4 py-2.5" aria-label={c.name}>
							<div class="flex items-baseline gap-3">
								<span class="flex-1 truncate text-[17px]">{c.name}</span>
								<span class="tabular">{formatEuro(c.amount)}</span>
								<span class="w-12 text-right text-[13px] text-label-2 tabular">
									{Math.round((c.amount / total) * 100)} %
								</span>
							</div>
							<div class="mt-1.5 h-2 overflow-hidden rounded-full bg-fill">
								<div
									class="h-full rounded-full"
									style:width="{Math.max(1, (c.amount / data.categories[0].amount) * 100)}%"
									style:background-color={accountColorCss(c.color)}
								></div>
							</div>
							{#if c.children.length}
								<ul class="mt-1.5 text-[13px] text-label-2">
									{#each c.children as child (child.id)}
										<li class="flex">
											<span class="flex-1 truncate">{child.name}</span><span class="tabular">
												{formatEuro(child.amount)}
											</span>
										</li>
									{/each}
								</ul>
							{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
					Keine Ausgaben in diesem Zeitraum.
				</p>
			{/if}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Echte und vorläufige Buchungen; Umbuchungen zwischen eigenen Konten zählen nicht.
			</p>
		</section>
	{:else if data.inOut}
		{@const income = data.inOut.reduce((s, m) => s + m.income, 0)}
		{@const expenses = data.inOut.reduce((s, m) => s + m.expenses, 0)}
		{@const rate = savingsRate(income, expenses)}
		<section class="mb-6 rounded-[var(--radius-card)] bg-card p-5" aria-label="Letzte 12 Monate">
			<p class="text-[13px] text-label-2">Letzte 12 Monate</p>
			<dl class="mt-2 grid grid-cols-3 gap-3">
				<div>
					<dt class="text-[13px] text-label-2">Einnahmen</dt>
					<dd class="text-income tabular">{formatEuro(income)}</dd>
				</div>
				<div>
					<dt class="text-[13px] text-label-2">Ausgaben</dt>
					<dd class="tabular">{formatEuro(expenses)}</dd>
				</div>
				<div>
					<dt class="text-[13px] text-label-2">Übrig</dt>
					<dd class="tabular" aria-label="Übrig">{rate === null ? '–' : percent(rate)}</dd>
				</div>
			</dl>
		</section>
		<BarChart
			label="Einnahmen und Ausgaben je Monat"
			labels={data.inOut.map((m) => short(m.month))}
			series={[
				{ name: 'Einnahmen', values: data.inOut.map((m) => m.income), color: '--kp-green' },
				{ name: 'Ausgaben', values: data.inOut.map((m) => m.expenses), color: '--kp-red' }
			]}
		/>
		<ul
			class="mt-6 mb-8 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			aria-label="Monate"
		>
			{#each [...data.inOut].reverse() as m (m.month)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2">
					<span class="flex-1">{monthLabel(m.month)}</span>
					<span class="text-income tabular">+{formatEuro(m.income)}</span>
					<span class="w-28 text-right tabular">−{formatEuro(m.expenses)}</span>
				</li>
			{/each}
		</ul>
	{:else if data.fixed}
		{@const now = data.fixed.find((m) => m.month === data.current)}
		<section class="mb-6 rounded-[var(--radius-card)] bg-card p-5" aria-label="Fixkosten">
			<p class="text-[13px] text-label-2">Fixkosten im {monthLabel(data.current)}</p>
			<p class="text-[28px] font-bold tabular" aria-label="Fixkosten im Monat">
				{formatEuro(now?.amount ?? 0)}
			</p>
			<p class="text-[13px] text-label-2">
				Regelmäßige Ausgaben, auf den Monat umgerechnet (Jahresbeiträge ÷ 12).
			</p>
		</section>
		<BarChart
			label="Fixkosten je Monat"
			labels={data.fixed.map((m) => short(m.month))}
			series={[
				{ name: 'Fixkosten', values: data.fixed.map((m) => m.amount), color: '--kp-accent' }
			]}
			highlight={data.fixed.findIndex((m) => m.month === data.current)}
		/>
		{#if data.byCategory.length}
			<section class="mt-6 mb-8" aria-label="Nach Kategorie">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Nach Kategorie</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.byCategory as c (c.name)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-2">
							<span class="flex-1 truncate">{c.name}</span><span class="tabular">
								{formatEuro(c.amount)}
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{:else if data.prices}
		<section class="mb-8" aria-label="Preisverlauf">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Preisänderungen</h2>
			{#if data.prices.length}
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.prices as p (p.id)}
						<li>
							<a
								href={resolve(`dauerposten/${p.id}`)}
								class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
							>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[17px]">{p.name}</span>
									<span class="block truncate text-[13px] text-label-2 tabular">
										{formatEuro(p.first.amount)} ({formatDay(p.first.validFrom)}) → {formatEuro(
											p.current.amount
										)} ({formatDay(p.current.validFrom)})
									</span>
								</span>
								<span class="shrink-0 text-right">
									<span class={['block tabular', p.change > 0 ? 'text-danger' : 'text-income']}>
										{percent(p.change)}
									</span>
									{#if p.perYear !== null}<span class="block text-[13px] text-label-2 tabular">
											{percent(p.perYear)} / Jahr
										</span>{/if}
								</span>
								<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
					Noch keine Preisänderungen bei Dauerposten.
				</p>
			{/if}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Aus dem Betragsverlauf der Dauerposten; der Verlauf je Posten steht an seiner Seite.
			</p>
		</section>
	{:else if data.calendar}
		<nav aria-label="Jahr" class="mb-4 flex items-center gap-3">
			<a
				href={resolve(`auswertungen?${q({ ansicht: 'kalender', jahr: data.year - 1 })}`)}
				class="text-accent"
				aria-label="Vorjahr"
			>
				‹ {data.year - 1}
			</a>
			<span class="flex-1 text-center text-[17px] font-semibold">{data.year}</span>
			<a
				href={resolve(`auswertungen?${q({ ansicht: 'kalender', jahr: data.year + 1 })}`)}
				class="text-accent"
				aria-label="Folgejahr"
			>
				{data.year + 1} ›
			</a>
		</nav>
		{@const maxMonth = Math.max(1, ...data.calendar.map((m) => m.expenses))}
		<ul class="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Monate {data.year}">
			{#each data.calendar as m (m.month)}
				<li>
					<a
						href={resolve(
							`auswertungen?${q({ ansicht: 'kalender', jahr: data.year, monat: m.month })}`
						)}
						aria-current={data.month === m.month ? 'true' : undefined}
						aria-label="{monthLabel(m.month)}: {formatEuro(m.expenses)}"
						class={[
							'block rounded-[var(--radius-row)] bg-card p-3 active:opacity-70',
							data.month === m.month && 'ring-2 ring-accent'
						]}
					>
						<span class="block text-[13px] text-label-2">{monthLabel(m.month)}</span>
						<span class="block text-[17px] font-semibold tabular">{formatEuro(m.expenses)}</span>
						<span class="mt-1 block h-1.5 overflow-hidden rounded-full bg-fill">
							<span
								class="block h-full rounded-full bg-[#ff9500]"
								style:width="{(m.expenses / maxMonth) * 100}%"
							></span>
						</span>
						{#each m.top as t (t.id + t.date)}
							<span class="mt-1 block truncate text-[12px] text-label-2">
								{t.name}
								{formatEuro(t.amount)}
							</span>
						{/each}
					</a>
				</li>
			{/each}
		</ul>
		<p class="mb-6 px-4 text-[13px] text-label-2">
			Fällige Zahlungen der Dauerposten je Monat. Tippe einen Monat für die Tagesansicht.
		</p>

		{#if data.month && data.heat}
			{@const days = data.heat}
			<section class="mb-8" aria-label="Tage im {monthLabel(data.month)}">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{monthLabel(data.month)}</h2>
				<div class="rounded-[var(--radius-row)] bg-card p-3">
					<div class="grid grid-cols-7 gap-1 text-center text-[12px] text-label-2">
						{#each ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as d (d)}<span>{d}</span>{/each}
					</div>
					<div class="mt-1 grid grid-cols-7 gap-1">
						{#each Array.from({ length: offset }, (_, i) => i) as i (i)}<span></span>{/each}
						{#each days as d (d.date)}
							<button
								type="button"
								onclick={() => (selectedDay = selectedDay === d.date ? null : d.date)}
								aria-label="{formatDay(d.date)}: {formatEuro(d.amount)}{d.planned
									? ' geplant'
									: ''}"
								aria-pressed={selectedDay === d.date}
								class={[
									'aspect-square rounded-md text-[13px] tabular',
									HEAT[heatLevel(d.amount, maxHeat)],
									d.planned && 'border border-dashed border-label-3',
									selectedDay === d.date && 'ring-2 ring-accent'
								]}
							>
								{Number(d.date.slice(8))}
							</button>
						{/each}
					</div>
					<p class="mt-2 text-[12px] text-label-2">
						Dunkler = mehr ausgegeben; gestrichelt = geplant (Dauerposten).
					</p>
				</div>
				{#if selectedDay}
					{@const day = days.find((d) => d.date === selectedDay)}
					{#if day}
						<ul
							class="mt-3 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
							aria-label="Ausgaben am {formatDay(day.date)}"
						>
							{#each day.entries as e, i (i)}
								<li class="flex min-h-11 items-center gap-3 px-4 py-2">
									<span class="flex-1 truncate">{e.label}</span><span class="tabular">
										{formatEuro(e.amount)}
									</span>
								</li>
							{:else}
								<li class="px-4 py-3 text-[15px] text-label-2">
									Keine Ausgaben am {formatDay(day.date)}.
								</li>
							{/each}
						</ul>
					{/if}
				{/if}
			</section>
		{/if}
	{/if}
</Page>
