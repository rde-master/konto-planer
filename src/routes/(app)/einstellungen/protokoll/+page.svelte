<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import {
		ACTIONS,
		ACTION_LABELS,
		ENTITY_LABELS,
		ENTITY_TYPES,
		entryTitle,
		fieldLabel,
		formatFieldValue
	} from '#lib/audit.js';
	import { dayLabel, formatDateTime, formatTime, groupByDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Entry = (typeof data.entries)[number];

	let filterOpen = $state(false);
	let detail: Entry | null = $state(null);
	let detailOpen = $state(false);

	const groups = $derived(groupByDay(data.entries, (e) => e.at));
	const base = resolve('einstellungen/protokoll');

	const activeFilters = $derived.by(() => {
		const f = data.filter;
		const chips: string[] = [];
		if (f.actor)
			chips.push(data.users.find((u) => u.id === f.actor)?.name ?? 'Gelöschter Benutzer');
		if (f.entity) chips.push(ENTITY_LABELS[f.entity as keyof typeof ENTITY_LABELS]);
		if (f.action) chips.push(ACTION_LABELS[f.action as keyof typeof ACTION_LABELS]);
		if (f.from) chips.push(`ab ${new Date(f.from).toLocaleDateString('de-DE')}`);
		if (f.to) chips.push(`bis ${new Date(f.to).toLocaleDateString('de-DE')}`);
		return chips;
	});

	/** Same filter, but only entries older than the last one shown. */
	const olderQuery = $derived(
		new URLSearchParams([
			...[...page.url.searchParams].filter(([key]) => key !== 'vor'),
			['vor', String(data.entries.at(-1)?.id ?? '')]
		]).toString()
	);

	const userOptions = $derived([
		{ value: '', label: 'Alle' },
		...data.users.map((u) => ({ value: u.id, label: u.name }))
	]);
	const entityOptions = [
		{ value: '', label: 'Alle' },
		...ENTITY_TYPES.map((e) => ({ value: e, label: ENTITY_LABELS[e] }))
	];
	const actionOptions = [
		{ value: '', label: 'Alle' },
		...ACTIONS.map((a) => ({ value: a, label: ACTION_LABELS[a] }))
	];

	function changedFields(entry: Entry): string[] {
		const before = (entry.before ?? {}) as Record<string, unknown>;
		const after = (entry.after ?? {}) as Record<string, unknown>;
		return [...new Set([...Object.keys(before), ...Object.keys(after)])];
	}
</script>

<Page title="Protokoll" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Filter"
			onclick={() => (filterOpen = true)}
			class={[
				'grid size-11 place-items-center rounded-full glass active:opacity-60',
				activeFilters.length ? '!bg-accent text-accent-contrast' : 'text-accent'
			]}
		>
			<SlidersHorizontal class="size-5" strokeWidth={2.2} />
		</button>
	{/snippet}

	{#if activeFilters.length}
		<div class="kp-span mb-5 flex flex-wrap items-center gap-2" aria-label="Aktive Filter">
			{#each activeFilters as chip (chip)}
				<span class="rounded-full bg-fill px-3 py-1 text-[13px] font-medium">{chip}</span>
			{/each}
			<a href={base} class="px-1 text-[15px] text-accent">Zurücksetzen</a>
		</div>
	{/if}

	{#if data.entries.length === 0}
		<p class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center text-[15px] text-label-2">
			Keine Einträge{activeFilters.length ? ' für diesen Filter' : ''}.
		</p>
	{/if}

	{#each groups as group (group.day)}
		<section class="kp-flow mb-8">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
				{dayLabel(group.items[0].at)}
			</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each group.items as entry (entry.id)}
					<li>
						<button
							type="button"
							onclick={() => {
								detail = entry;
								detailOpen = true;
							}}
							class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-fill"
						>
							<span class="min-w-0 flex-1">
								<span
									class={[
										'block truncate text-[17px]',
										(entry.action === 'login_failed' || entry.action === 'locked') && 'text-danger'
									]}
								>
									{entryTitle(entry.entityType, entry.action)}
								</span>
								<span class="block truncate text-[13px] text-label-2">
									{[entry.entityLabel, entry.actorName ? `von ${entry.actorName}` : null]
										.filter(Boolean)
										.join(' · ')}
								</span>
							</span>
							<span class="shrink-0 text-[15px] text-label-2 tabular">{formatTime(entry.at)}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/each}

	{#if data.hasMore}
		<a
			href={resolve(`einstellungen/protokoll?${olderQuery}`)}
			class="kp-span mb-8 flex min-h-11 items-center justify-center rounded-full bg-fill text-[17px] font-semibold text-accent"
		>
			Ältere Einträge
		</a>
	{/if}
</Page>

<Sheet bind:open={filterOpen} title="Filter" confirmLabel="Anwenden" formId="filter-form">
	<form id="filter-form" method="GET" action={base} onsubmit={() => (filterOpen = false)}>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<SelectField
				label="Benutzer"
				name="benutzer"
				options={userOptions}
				value={data.filter.actor ?? ''}
			/>
			<SelectField
				label="Bereich"
				name="bereich"
				options={entityOptions}
				value={data.filter.entity ?? ''}
			/>
			<SelectField
				label="Aktion"
				name="aktion"
				options={actionOptions}
				value={data.filter.action ?? ''}
			/>
		</ul>
		<ul
			class="mt-6 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField label="Von" name="von" type="date" value={data.filter.from ?? ''} />
			<FormField label="Bis" name="bis" type="date" value={data.filter.to ?? ''} />
		</ul>
	</form>
</Sheet>

<Sheet bind:open={detailOpen} title="Eintrag" closeLabel="Fertig">
	{#if detail}
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each [['Aktion', entryTitle(detail.entityType, detail.action)], ['Zeitpunkt', formatDateTime(detail.at)], ['Ausgeführt von', detail.actorName ?? 'Unbekannt'], ['Objekt', detail.entityLabel ?? '–']] as [label, value] (label)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1">{label}</span>
					<span class="truncate text-right text-label-2">{value}</span>
				</li>
			{/each}
		</ul>

		{#if changedFields(detail).length}
			<h3 class="mt-6 mb-1.5 px-4 text-[13px] text-label-2 uppercase">
				{detail.before && detail.after ? 'Änderungen' : 'Werte'}
			</h3>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each changedFields(detail) as field (field)}
					{@const before = (detail.before as Record<string, unknown> | null)?.[field]}
					{@const after = (detail.after as Record<string, unknown> | null)?.[field]}
					<li class="px-4 py-2.5">
						<span class="block text-[13px] text-label-2">{fieldLabel(field)}</span>
						{#if detail.before && detail.after}
							<span class="block text-[17px]">
								<span class="text-label-2 line-through">{formatFieldValue(field, before)}</span>
								<span aria-hidden="true"> → </span>
								<span class="sr-only">wurde zu</span>
								<span>{formatFieldValue(field, after)}</span>
							</span>
						{:else}
							<span class="block text-[17px]">{formatFieldValue(field, after ?? before)}</span>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</Sheet>
