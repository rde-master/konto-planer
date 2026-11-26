<script lang="ts">
	import { untrack } from 'svelte';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import X from '@lucide/svelte/icons/x';
	import WidgetPreview from './WidgetPreview.svelte';
	import FormField from './FormField.svelte';
	import {
		APPEARANCES,
		APPEARANCE_LABELS,
		BACKGROUNDS,
		BACKGROUND_LABELS,
		FONT_SIZES,
		FONT_SIZE_LABELS,
		ITEM_KINDS,
		ITEM_LABELS,
		SIZE_LABELS,
		WIDGET_SIZES,
		isLockSize,
		layoutBlocks,
		lockContent,
		widgetPalette,
		type ItemKind,
		type LayoutItem,
		type WidgetData,
		type WidgetLayout,
		type WidgetSize
	} from '#lib/widgets.js';
	import { ACCOUNT_COLORS, COLOR_KEYS } from '#lib/colors.js';

	let {
		data,
		initial
	}: {
		data: WidgetData;
		initial: { name: string; size: WidgetSize; accountIds: string[]; layout: WidgetLayout };
	} = $props();

	// Start values only; afterwards the editor drives them.
	const start = untrack(() => initial);
	let name = $state(start.name);
	let size = $state<WidgetSize>(start.size);
	let accountIds = $state<string[]>([...start.accountIds]);
	let items = $state<LayoutItem[]>(start.layout.items.map((i) => ({ ...i })));
	let style = $state({ ...start.layout.style });
	let addKind = $state<ItemKind>('payments');

	const chosen = $derived(
		accountIds.length ? data.accounts.filter((a) => accountIds.includes(a.id ?? '')) : data.accounts
	);
	const preview = $derived({
		accounts: chosen,
		payments: accountIds.length
			? data.payments.filter((p) => accountIds.includes(p.accountId ?? ''))
			: data.payments
	});
	const blocks = $derived(layoutBlocks(items, size, preview));
	const lock = $derived(isLockSize(size) ? lockContent(items, size, preview) : null);
	const palette = $derived(widgetPalette(style, chosen[0]?.color ?? null));
	const layoutJson = $derived(JSON.stringify({ items, style }));

	function move(i: number, d: number) {
		const j = i + d;
		if (j < 0 || j >= items.length) return;
		const copy = [...items];
		[copy[i], copy[j]] = [copy[j], copy[i]];
		items = copy;
	}
	function remove(i: number) {
		items = items.filter((_, k) => k !== i);
	}
	function add() {
		if (items.length >= 12) return;
		const item: LayoutItem =
			addKind === 'title'
				? { kind: 'title', text: '' }
				: addKind === 'payments'
					? { kind: 'payments', count: 3 }
					: { kind: addKind };
		items = [...items, item];
	}
	function toggleAccount(id: string, on: boolean) {
		accountIds = on ? [...accountIds, id] : accountIds.filter((x) => x !== id);
	}
	const selectClass = 'bg-transparent text-right text-[17px] text-label-2';
</script>

<input type="hidden" name="layout" value={layoutJson} />
<input type="hidden" name="size" value={size} />
{#each accountIds as id (id)}<input type="hidden" name="account" value={id} />{/each}

<div class="mb-6 flex justify-center md:sticky md:top-16 md:z-10">
	<WidgetPreview {blocks} {size} {palette} {lock} />
</div>

<section class="mb-6">
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<FormField label="Name" name="name" bind:value={name} maxlength={40} autocomplete="off" />
		<li class="px-4 py-2">
			<div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Größe">
				{#each WIDGET_SIZES as s (s)}
					<button
						type="button"
						role="radio"
						aria-checked={size === s}
						onclick={() => (size = s)}
						class={[
							'min-w-[30%] flex-1 rounded-full px-3 py-1.5 text-[15px]',
							size === s ? 'bg-accent text-white' : 'bg-fill'
						]}
					>
						{SIZE_LABELS[s]}
					</button>
				{/each}
			</div>
		</li>
	</ul>
</section>

<section class="mb-6" aria-label="Bausteine">
	<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Bausteine</h2>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		{#each items as item, i (i)}
			<li class="flex min-h-11 items-center gap-2 px-4 py-1.5" aria-label={ITEM_LABELS[item.kind]}>
				<span class="min-w-0 flex-1">
					<span class="block truncate text-[17px]">{ITEM_LABELS[item.kind]}</span>
					{#if item.kind === 'title'}
						<input
							type="text"
							value={item.text}
							maxlength={40}
							placeholder="automatisch"
							aria-label="Text der Überschrift"
							oninput={(e) => (items[i] = { kind: 'title', text: e.currentTarget.value })}
							class="w-full bg-transparent text-[15px] text-label-2 outline-none"
						/>
					{:else if item.kind === 'payments'}
						<select
							value={String(item.count)}
							aria-label="Anzahl Zahlungen"
							onchange={(e) =>
								(items[i] = { kind: 'payments', count: Number(e.currentTarget.value) })}
							class="bg-transparent text-[15px] text-label-2"
						>
							{#each [1, 2, 3, 4, 5, 6, 8, 10, 12] as n (n)}<option value={String(n)}>
									{n} Zahlungen
								</option>{/each}
						</select>
					{/if}
				</span>
				<button
					type="button"
					aria-label="Nach oben"
					onclick={() => move(i, -1)}
					disabled={i === 0}
					class="p-1.5 text-accent disabled:opacity-30"
				>
					<ArrowUp class="size-5" />
				</button>
				<button
					type="button"
					aria-label="Nach unten"
					onclick={() => move(i, 1)}
					disabled={i === items.length - 1}
					class="p-1.5 text-accent disabled:opacity-30"
				>
					<ArrowDown class="size-5" />
				</button>
				<button
					type="button"
					aria-label="Entfernen"
					onclick={() => remove(i)}
					class="p-1.5 text-danger"
				>
					<X class="size-5" />
				</button>
			</li>
		{/each}
		<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
			<select
				bind:value={addKind}
				aria-label="Neuer Baustein"
				class="flex-1 bg-transparent text-[17px]"
			>
				{#each ITEM_KINDS as k (k)}<option value={k}>{ITEM_LABELS[k]}</option>{/each}
			</select>
			<button
				type="button"
				onclick={add}
				disabled={items.length >= 12}
				class="text-[17px] text-accent disabled:opacity-30"
			>
				Hinzufügen
			</button>
		</li>
	</ul>
	<p class="mt-1.5 px-4 text-[13px] text-label-2">
		Was nicht in die gewählte Größe passt, lässt das Widget unten weg.
	</p>
</section>

<section class="mb-6" aria-label="Gestaltung">
	<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Gestaltung</h2>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
			<label for="w-appearance" class="flex-1 text-[17px]">Erscheinungsbild</label>
			<select id="w-appearance" bind:value={style.appearance} class={selectClass}>
				{#each APPEARANCES as a (a)}<option value={a}>{APPEARANCE_LABELS[a]}</option>{/each}
			</select>
		</li>
		<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
			<label for="w-accent" class="flex-1 text-[17px]">Akzentfarbe</label>
			<select id="w-accent" bind:value={style.accent} class={selectClass}>
				<option value="account">Kontofarbe</option>
				{#each COLOR_KEYS as c (c)}<option value={c}>{ACCOUNT_COLORS[c].label}</option>{/each}
			</select>
		</li>
		<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
			<label for="w-bg" class="flex-1 text-[17px]">Hintergrund</label>
			<select id="w-bg" bind:value={style.background} class={selectClass}>
				{#each BACKGROUNDS as b (b)}<option value={b}>{BACKGROUND_LABELS[b]}</option>{/each}
			</select>
		</li>
		<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
			<label for="w-font" class="flex-1 text-[17px]">Schriftgröße</label>
			<select id="w-font" bind:value={style.fontSize} class={selectClass}>
				{#each FONT_SIZES as f (f)}<option value={f}>{FONT_SIZE_LABELS[f]}</option>{/each}
			</select>
		</li>
	</ul>
</section>

<section class="mb-6" aria-label="Konten">
	<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Konten</h2>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		{#each data.accounts as a (a.id)}
			<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
				<input
					id="we-{a.id}"
					type="checkbox"
					checked={accountIds.includes(a.id ?? '')}
					onchange={(e) => toggleAccount(a.id ?? '', e.currentTarget.checked)}
					class="size-5 accent-[var(--kp-accent)]"
				/>
				<label for="we-{a.id}" class="flex-1 text-[17px]">{a.name}</label>
			</li>
		{/each}
	</ul>
	<p class="mt-1.5 px-4 text-[13px] text-label-2">Keins gewählt = alle Konten, die du siehst.</p>
</section>
