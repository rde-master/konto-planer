<script lang="ts">
	import type { Block, WidgetSize } from '#lib/widgets.js';

	let { blocks, size }: { blocks: Block[]; size: WidgetSize } = $props();

	const COLORS: Record<string, string> = {
		text: 'text-label',
		sub: 'text-label-2',
		red: 'text-danger',
		green: 'text-income',
		blue: 'text-accent'
	};
	const box = $derived(
		size === 'small'
			? 'h-[170px] w-[170px]'
			: size === 'medium'
				? 'h-[170px] w-[340px]'
				: 'h-[355px] w-[340px]'
	);
</script>

<div
	class={[
		'flex flex-col overflow-hidden rounded-[22px] bg-card px-3.5 py-3 shadow-sm ring-1 ring-separator',
		box
	]}
	aria-label="Vorschau"
	role="img"
>
	{#each blocks as b, i (i)}
		{#if b.type === 'title'}
			<p class="truncate text-[12px] font-semibold text-label-2">{b.text}</p>
		{:else if b.type === 'big'}
			<p
				class={[
					'truncate leading-tight font-bold tabular',
					size === 'small' ? 'text-[20px]' : 'text-[26px]',
					COLORS[b.color]
				]}
			>
				{b.value}
			</p>
		{:else if b.type === 'row'}
			<p class="flex gap-2 text-[12px]">
				<span class="min-w-0 flex-1 truncate text-label-2">{b.label}</span>
				<span class={['shrink-0 font-medium tabular', COLORS[b.color ?? 'text']]}>{b.value}</span>
			</p>
		{:else if b.type === 'bar'}
			<div class="my-1 h-1.5 w-full rounded-full bg-fill">
				<div
					class={['h-1.5 rounded-full', b.color === 'red' ? 'bg-danger' : 'bg-income']}
					style:width="{Math.max(4, b.value * 100)}%"
				></div>
			</div>
		{:else if b.type === 'spacer'}
			<div class="flex-1"></div>
		{/if}
	{/each}
	<p class="mt-1 text-[9px] text-label-2">Stand jetzt</p>
</div>
