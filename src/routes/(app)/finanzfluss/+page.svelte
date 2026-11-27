<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Workflow from '@lucide/svelte/icons/workflow';
	import { gotoReplace } from '#lib/back.svelte.js';
	import Page from '#lib/components/Page.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import FlowChart from '#lib/components/FlowChart.svelte';
	import HelpLink from '#lib/components/HelpLink.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { PAST_MONTHS, PLAN_MONTHS, type FlowStatus } from '#lib/money-flow.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const flow = $derived(data.flow);
	const past = $derived(data.view === 'past');
	const graph = $derived(flow ? (past ? flow.past : flow.plan) : null);

	/** Query of this page; the defaults (plan, six months, the salary account) are left out. */
	function query(change: { view?: 'plan' | 'past'; months?: number; main?: string }) {
		if (!flow) return '';
		const view = change.view ?? data.view;
		const months = change.months ?? flow.months;
		const main = change.main ?? data.chosenMain;
		return [
			view === 'past' ? 'ansicht=ist' : null,
			months !== 6 ? `monate=${months}` : null,
			main ? `konto=${main}` : null
		]
			.filter(Boolean)
			.join('&');
	}

	function pickMain(id: string) {
		void gotoReplace(resolve(`finanzfluss?${query({ main: id })}`), { reset: false });
	}

	/** The flows by name, largest first (also for screen readers: the chart is a picture). */
	const flows = $derived.by(() => {
		if (!graph) return [];
		const name = new Map(graph.nodes.map((n) => [n.id, n.label]));
		return graph.links
			.map((l) => ({
				from: name.get(l.from) ?? '',
				to: name.get(l.to) ?? '',
				amount: l.amount
			}))
			.sort((a, b) => b.amount - a.amount);
	});

	const STATUS_CLASS: Record<FlowStatus, string> = {
		ok: 'text-income',
		draining: 'text-warning',
		timing: 'text-warning',
		short: 'text-danger',
		none: 'text-label-2'
	};

	const pastTitle = $derived(
		flow
			? flow.period.partial
				? `${flow.period.label} bisher`
				: flow.period.count === 1
					? flow.period.label
					: `Letzte ${flow.period.count} Monate`
			: ''
	);
</script>

{#snippet verdict(
	title: string,
	v: { status: FlowStatus; label: string; text: string; inflow: number; outflow: number },
	everyday = 0
)}
	<div class="px-4 py-2.5">
		<p class="flex items-baseline gap-2 text-[13px] text-label-2 uppercase">
			<span class="flex-1">{title}</span>
			{#if v.label}
				<span class={['font-semibold normal-case', STATUS_CLASS[v.status]]}>{v.label}</span>
			{/if}
		</p>
		<p class="mt-0.5 text-[15px] tabular">
			kommt an {formatEuro(v.inflow)} · geht ab {formatEuro(v.outflow)}
			<span class="text-label-2">im Monat</span>
		</p>
		{#if everyday > 0}
			<p class="mt-0.5 text-[13px] text-label-2 tabular">
				darin {formatEuro(everyday)} Alltagsausgaben (Schnitt aus dem Rückblick)
			</p>
		{/if}
		{#if v.text}<p class="mt-0.5 text-[15px] text-label-2">{v.text}</p>{/if}
	</div>
{/snippet}

<Page title="Finanzfluss">
	{#if !flow || !graph}
		<div class="kp-span rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Workflow class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch kein Girokonto</p>
			<p class="mt-1 text-[15px] text-label-2">
				Der Finanzfluss zeigt, wie das Gehalt vom Girokonto auf deine anderen Konten verteilt wird.
			</p>
		</div>
	{:else}
		<nav aria-label="Ansicht" class="mb-4 flex gap-1 rounded-full bg-fill p-1">
			{#each [{ value: 'plan', label: 'Geplant' }, { value: 'past', label: 'Tatsächlich' }] as const as v (v.value)}
				<a
					href={resolve(`finanzfluss?${query({ view: v.value })}`)}
					aria-current={data.view === v.value ? 'page' : undefined}
					data-sveltekit-replacestate
					data-sveltekit-reset="false"
					class={[
						'flex-1 rounded-full px-3 py-1.5 text-center text-[13px] font-medium',
						data.view === v.value ? 'bg-card shadow-sm' : 'text-label-2'
					]}
				>
					{v.label}
				</a>
			{/each}
		</nav>

		{#if flow.mainOptions.length > 1}
			<ul class="kp-span mb-4 overflow-hidden rounded-[var(--radius-row)] bg-card">
				<SelectField
					label="Hauptkonto"
					name="konto"
					options={flow.mainOptions}
					value={flow.main.id}
					onchange={pickMain}
				/>
			</ul>
		{/if}

		<nav aria-label="Rückblick" class="mb-4 flex items-center gap-2 overflow-x-auto pb-1">
			<span class="shrink-0 pl-4 text-[13px] text-label-2 uppercase">Rückblick</span>
			{#each PAST_MONTHS as m (m)}
				<a
					href={resolve(`finanzfluss?${query({ months: m })}`)}
					aria-current={flow.months === m ? 'page' : undefined}
					data-sveltekit-replacestate
					data-sveltekit-reset="false"
					class={[
						'shrink-0 rounded-full px-3 py-1 text-[15px] whitespace-nowrap',
						flow.months === m ? 'bg-accent text-accent-contrast' : 'bg-card text-accent'
					]}
				>
					{m} Monate
				</a>
			{/each}
		</nav>

		<section class="kp-span mb-8" aria-label="Geldfluss">
			<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
				<span class="flex-1">Geldfluss je Monat</span>
				<span>{past ? pastTitle : `Nächste ${PLAN_MONTHS} Monate`}</span>
			</h2>
			{#if graph.links.length}
				{#key `${data.view}|${flow.months}|${flow.main.id}`}
					<FlowChart
						nodes={graph.nodes}
						links={graph.links}
						label={past
							? `Geldfluss je Monat, tatsächlich: ${flow.period.label}`
							: 'Geldfluss je Monat, geplant'}
					/>
				{/key}
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					{past
						? `Durchschnitt je Monat aus den Buchungen (${flow.period.label}${flow.period.partial ? ', bisher' : ''}).`
						: 'Durchschnitt je Monat aus den Dauerposten und geplanten Zahlungen der nächsten zwölf Monate, dazu die Alltagsausgaben wie im Rückblick.'}
					Von {flow.main.name} aus verteilt sich das Geld auf die Konten; „Aus dem Bestand“ ist, was ein
					Konto mehr ausgibt, als ankommt.
				</p>
				<details class="mt-2 overflow-hidden rounded-[var(--radius-row)] bg-card">
					<summary class="px-4 py-2.5 text-[15px] text-accent">Alle Flüsse als Liste</summary>
					<ul
						class="divide-y-[0.5px] divide-separator border-t-[0.5px] border-separator"
						aria-label="Flüsse"
					>
						{#each flows as f (`${f.from}|${f.to}`)}
							<li class="flex items-baseline gap-3 px-4 py-2 text-[15px]">
								<span class="min-w-0 flex-1">{f.from} → {f.to}</span>
								<span class="shrink-0 tabular">{formatEuro(f.amount)}</span>
							</li>
						{/each}
					</ul>
				</details>
			{:else}
				<p
					class="rounded-[var(--radius-row)] bg-card px-4 py-6 text-center text-[15px] text-label-2"
				>
					{past
						? 'In diesem Zeitraum gibt es keine Buchungen auf dem Hauptkonto.'
						: 'Für das Hauptkonto sind keine Dauerposten geplant.'}
				</p>
			{/if}
		</section>

		<section class="kp-flow mb-4" aria-label="Reichen die Beträge?">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Reichen die Beträge?</h2>
			{#each flow.accounts as a (a.id)}
				<article
					class="mb-4 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					aria-label={a.name}
				>
					<a
						href={resolve(`konten/${a.id}`)}
						class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
					>
						<span
							class="size-3 shrink-0 rounded-full"
							style:background-color={accountColorCss(a.color)}
						></span>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[17px] font-semibold">{a.name}</span>
							{#if a.main}<span class="block text-[13px] text-label-2">Hauptkonto</span>{/if}
						</span>
						<span class="shrink-0 text-[17px] tabular">{formatEuro(a.balance)}</span>
						<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
					</a>
					{@render verdict(`Geplant · nächste ${PLAN_MONTHS} Monate`, a.plan, a.everyday)}
					{@render verdict(`Tatsächlich · ${pastTitle}`, a.past)}
					{#if a.months.length > 1}
						<details>
							<summary class="px-4 py-2.5 text-[15px] text-accent">Monat für Monat</summary>
							<ul class="divide-y-[0.5px] divide-separator border-t-[0.5px] border-separator">
								{#each a.months as m (m.month)}
									<li class="flex items-baseline gap-3 px-4 py-2 text-[15px]">
										<span class="min-w-0 flex-1">
											<span class="block">{m.label}</span>
											<span class="block text-[13px] text-label-2 tabular">
												an {formatEuro(m.inflow)} · ab {formatEuro(m.outflow)}
											</span>
										</span>
										<span
											class={['shrink-0 tabular', m.net < 0 ? 'text-danger' : 'text-income']}
											aria-label="{m.label}: Saldo {formatEuro(m.net)}"
										>
											{m.net > 0 ? '+' : ''}{formatEuro(m.net)}
										</span>
									</li>
								{/each}
							</ul>
						</details>
					{/if}
				</article>
			{/each}
		</section>

		<HelpLink
			chapter="planen-und-sparen"
			anchor="finanzfluss"
			label="So liest du den Finanzfluss"
		/>
	{/if}
</Page>
