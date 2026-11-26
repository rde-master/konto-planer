<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Landmark from '@lucide/svelte/icons/landmark';
	import Page from '#lib/components/Page.svelte';
	import Logo from '#lib/components/Logo.svelte';
	import SavingsSuggestion from '#lib/components/SavingsSuggestion.svelte';
	import BalanceChart from '#lib/components/BalanceChart.svelte';
	import BarChart from '#lib/components/BarChart.svelte';
	import DonutChart from '#lib/components/DonutChart.svelte';
	import Sparkline from '#lib/components/Sparkline.svelte';
	import Ring from '#lib/components/Ring.svelte';
	import { monthName } from '#lib/monthly-report.js';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { dayLabel, formatDay } from '#lib/dates.js';
	import { INTERVAL_LABELS } from '#lib/recurring.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const firstName = $derived(data.user.name.split(' ')[0]);
	const h = $derived(data.household);

	type SavingErrors = {
		action: 'saving';
		accountId: string;
		errors: Partial<Record<string, string>>;
	};
	const savingErrors = $derived.by(() => {
		const f = form as Partial<SavingErrors> | null | undefined;
		return f?.action === 'saving' ? (f as SavingErrors) : null;
	});

	function asOfText(a: { date: string; source: string }) {
		return `Stand vom ${formatDay(a.date)}${a.source === 'import' ? ' (Import)' : a.source === 'adjustment' ? ' (korrigiert)' : ' (Startsaldo)'}`;
	}

	function signed(amount: number) {
		return `${amount > 0 ? '+' : ''}${formatEuro(amount)}`;
	}
</script>

<Page title="Übersicht">
	<p class="mb-6 text-[17px] text-label-2">Hallo {firstName}!</p>

	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{:else if form && 'success' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{form.success}
		</p>
	{/if}

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
		{#each data.suggestions as suggestion (suggestion.accountId)}
			<SavingsSuggestion
				{suggestion}
				targets={data.targets}
				errors={savingErrors?.accountId === suggestion.accountId ? savingErrors.errors : undefined}
			/>
		{/each}

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
			{#if data.metrics && (data.metrics.fixedRatio !== null || data.metrics.savingsRate !== null)}
				<a
					href={resolve('auswertungen?ansicht=kennzahlen')}
					class="mt-3 block text-[15px] text-accent tabular"
					aria-label="Kennzahlen"
				>
					Fixkostenquote {data.metrics.fixedRatio === null
						? '–'
						: `${Math.round(data.metrics.fixedRatio * 100)} %`} · Sparquote {data.metrics
						.savingsRate === null
						? '–'
						: `${Math.round(data.metrics.savingsRate * 100)} %`}
				</a>
			{/if}
		</section>

		{#if data.charts}
			{@const nw = data.charts.netWorth}
			<section class="mb-8" aria-label="Vermögensverlauf">
				<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
					<span class="flex-1">Vermögen · 6 Monate und Vorschau</span>
					<span class={['normal-case tabular', nw.change < 0 ? 'text-danger' : 'text-income']}>
						{signed(nw.change)}
					</span>
				</h2>
				<BalanceChart
					series={nw.history}
					forecast={nw.outlook}
					label="Vermögensverlauf mit Vorschau"
				/>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Summe aller Konten; gestrichelt die erwarteten Zahlungen der nächsten 30 Tage.
				</p>
			</section>
		{/if}

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
									{#if g.asOf}
										<span
											class={[
												'block truncate text-[13px]',
												g.asOf.stale ? 'text-danger' : 'text-label-2'
											]}
										>
											{asOfText(g.asOf)}
										</span>
									{/if}
									{#if g.minimum}
										<span class="block truncate text-[13px] text-label-2 tabular">
											Mindestbestand {formatEuro(g.minimum)}
										</span>
									{/if}
									{#if data.charts?.sparks[g.id]}
										<span class="mt-1 block sm:hidden">
											<Sparkline
												points={data.charts.sparks[g.id]}
												label="Verlauf von {g.name} bis zum Stichtag"
											/>
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
								{#if data.charts?.sparks[g.id]}
									<!-- Phones show the line under the text, wider screens beside the amount. -->
									<span class="hidden sm:block">
										<Sparkline
											points={data.charts.sparks[g.id]}
											label="Verlauf von {g.name} bis zum Stichtag"
										/>
									</span>
								{/if}
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

		{#if data.hints.length}
			<section class="mb-8" aria-label="Neues Abo?">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Neues Abo?</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.hints as h (h.id)}
						<li class="px-4 py-2.5" aria-label={h.name}>
							<div class="flex items-center gap-3">
								<span class="min-w-0 flex-1">
									<span class="block truncate">{h.name}</span>
									<span class="block truncate text-[13px] text-label-2">
										{INTERVAL_LABELS[h.interval as keyof typeof INTERVAL_LABELS] ?? h.interval} · {h.count}
										Zahlungen, zuletzt {formatDay(h.lastDate)} · {h.accountName}
									</span>
								</span>
								<span class="tabular">{formatEuro(h.amount)}</span>
							</div>
							{#if h.canEdit}
								<div class="mt-2 flex gap-4">
									<form method="POST" action="?/hintCreate" use:enhance>
										<input type="hidden" name="id" value={h.id} />
										<button type="submit" class="text-[15px] text-accent">
											Als Dauerposten anlegen
										</button>
									</form>
									<form method="POST" action="?/hintDismiss" use:enhance>
										<input type="hidden" name="id" value={h.id} />
										<button type="submit" class="text-[15px] text-label-2">Ignorieren</button>
									</form>
								</div>
							{/if}
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Regelmäßige Abbuchungen aus dem Import ohne Dauerposten.
				</p>
			</section>
		{/if}

		{#if data.increases.length}
			<section class="mb-8" aria-label="Teurer geworden">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Teurer geworden</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.increases as x (`${x.recurringId}:${x.from}:${x.source}`)}
						<li>
							<a
								href={resolve(`dauerposten/${x.recurringId}`)}
								class="flex min-h-11 items-center gap-3 px-4 py-2 active:bg-fill"
								aria-label={x.name}
							>
								<span class="min-w-0 flex-1">
									<span class="block truncate">{x.name}</span>
									<span class="block truncate text-[13px] text-label-2">
										{x.source === 'paid' ? 'abgebucht am' : 'ab'}
										{formatDay(x.from)}: {formatEuro(x.before)} → {formatEuro(x.after)}
									</span>
								</span>
								<span class="text-right text-danger tabular">
									+{x.percent} %
									<span class="block text-[13px]">+{formatEuro(x.perYear)}/Jahr</span>
								</span>
								<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.transfers.length}
			<section class="mb-8" aria-label="Zu überweisen">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zu überweisen</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.transfers as t (`${t.recurringId}:${t.dueDate}`)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-2" aria-label={t.name}>
							<span class="min-w-0 flex-1">
								<span class="block truncate">{t.name}</span>
								<span
									class={['block truncate text-[13px]', t.overdue ? 'text-danger' : 'text-label-2']}
								>
									{t.overdue ? 'war fällig' : 'fällig'}
									{formatDay(t.bookingDate)} · {t.accountName}{t.to ? ` → ${t.to}` : ''}
								</span>
								{#if t.iban}
									<span class="block truncate text-[13px] text-label-2 tabular">{t.iban}</span>
								{/if}
							</span>
							<span class="tabular">{formatEuro(t.amount)}</span>
							{#if t.canEdit}
								<form method="POST" action="?/transferred" use:enhance>
									<input type="hidden" name="recurringId" value={t.recurringId} />
									<input type="hidden" name="dueDate" value={t.dueDate} />
									<button type="submit" class="text-[15px] text-accent">Überwiesen</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Dauerposten mit Zahlart „manuell“. Ein Import mit der Zahlung hakt sie ebenfalls ab.
				</p>
			</section>
		{/if}

		{#if data.missing.length}
			<section class="mb-8" aria-label="Ausgeblieben">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Ausgeblieben</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.missing as m (m.bookingId)}
						<li>
							<a
								href={resolve(`buchungen/${m.bookingId}`)}
								class="flex min-h-11 items-center gap-3 px-4 py-2 active:bg-fill"
							>
								<span class="min-w-0 flex-1">
									<span class="block truncate">{m.name}</span>
									<span class="block truncate text-[13px] text-label-2">
										fällig {formatDay(m.date)} · {m.accountName}
									</span>
								</span>
								<span class="tabular">{signed(m.amount)}</span>
								<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
							</a>
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Vorläufig gebucht, aber im Import nicht aufgetaucht. An der Buchung entscheidest du:
					behalten, verschieben oder zurücknehmen.
				</p>
			</section>
		{/if}

		{#if data.charts && data.charts.expenses.slices.length}
			{@const e = data.charts.expenses}
			<section class="mb-8" aria-label="Ausgaben nach Kategorie">
				<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
					<span class="flex-1">Ausgaben im {monthName(e.month)}</span>
					<a href={resolve('auswertungen')} class="text-accent normal-case">Mehr</a>
				</h2>
				<DonutChart
					slices={e.slices}
					label="Ausgaben nach Kategorie im {monthName(e.month)}"
					center={formatEuro(e.total)}
				/>
				{#if e.change !== null}
					<p class="mt-1.5 px-4 text-[13px] text-label-2">
						{e.change === 0
							? 'So viel wie im Vormonat bis zum gleichen Tag.'
							: `${Math.abs(e.change)} % ${e.change > 0 ? 'mehr' : 'weniger'} als im Vormonat bis zum gleichen Tag.`}
					</p>
				{/if}
			</section>
		{/if}

		{#if data.charts && data.charts.inOut.income.some((v, i) => v || data.charts?.inOut.expenses[i])}
			{@const io = data.charts.inOut}
			<section class="mb-8" aria-label="Einnahmen und Ausgaben">
				<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
					<span class="flex-1">Einnahmen und Ausgaben</span>
					<a href={resolve('auswertungen?ansicht=einaus')} class="text-accent normal-case">Mehr</a>
				</h2>
				<BarChart
					labels={io.months.map((m) => monthName(m).slice(0, 3))}
					series={[
						{ name: 'Einnahmen', values: io.income, color: '--kp-green' },
						{ name: 'Ausgaben', values: io.expenses, color: '--kp-red' }
					]}
					label="Einnahmen und Ausgaben der letzten sechs Monate"
					highlight={io.months.length - 1}
				/>
			</section>
		{/if}

		{#if data.budgets.length}
			<section class="mb-8" aria-label="Budgets">
				<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
					<span class="flex-1">Budgets</span>
					<a href={resolve('budgets')} class="text-accent normal-case">Alle</a>
				</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.budgets as b (b.id)}
						<li class="flex items-center gap-3 px-4 py-2">
							<Ring
								part={b.spent}
								whole={b.limit}
								label={b.categoryName}
								color={accountColorCss(b.color)}
								warnFrom={0.8}
							/>
							<span class="min-w-0 flex-1">
								<span class="block truncate">{b.categoryName}</span>
								<span class="block truncate text-[13px] text-label-2">{b.accountName}</span>
							</span>
							<span class="text-right">
								<span
									class={[
										'block tabular',
										b.state === 'over' ? 'text-danger' : b.state === 'warn' && 'text-[#c93400]'
									]}
								>
									{Math.round((b.spent / b.limit) * 100)} %
								</span>
								<span class="block text-[13px] text-label-2 tabular">
									{formatEuro(b.spent)} von {formatEuro(b.limit)}
								</span>
							</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.goals.length}
			<section class="mb-8" aria-label="Sparziele">
				<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
					<span class="flex-1">Sparziele</span>
					<a href={resolve('sparziele')} class="text-accent normal-case">Alle</a>
				</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each data.goals as g (g.id)}
						<li>
							<a
								href={resolve(`sparziele/${g.id}`)}
								class="flex items-center gap-3 px-4 py-2 active:bg-fill"
							>
								<Ring
									part={g.allocated}
									whole={g.targetAmount}
									label={g.name}
									color="var(--kp-green)"
								/>
								<span class="min-w-0 flex-1">
									<span class="block truncate">{g.name}</span>
									<span class="block truncate text-[13px] text-label-2">{g.accountName}</span>
								</span>
								<span class="text-right text-[13px] text-label-2 tabular">
									{formatEuro(g.allocated)}<br />von {formatEuro(g.targetAmount)}
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
