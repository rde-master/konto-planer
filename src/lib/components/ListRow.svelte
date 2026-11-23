<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import type { Path } from '$app/types';

	let {
		label,
		value,
		href,
		icon: Icon,
		iconColor = 'bg-accent',
		destructive = false,
		trailing
	}: {
		label: string;
		value?: string;
		href?: Path;
		icon?: Component;
		iconColor?: string;
		destructive?: boolean;
		trailing?: Snippet;
	} = $props();
</script>

{#snippet content()}
	{#if Icon}
		<span
			class={['grid size-[29px] shrink-0 place-items-center rounded-[7px] text-white', iconColor]}
		>
			<Icon class="size-[18px]" strokeWidth={2.2} />
		</span>
	{/if}
	<span class={['flex-1 truncate', destructive && 'text-danger']}>{label}</span>
	{#if value}<span class="truncate text-label-2 tabular">{value}</span>{/if}
	{@render trailing?.()}
	{#if href}<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />{/if}
{/snippet}

<li>
	{#if href}
		<a href={resolve(href)} class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill">
			{@render content()}
		</a>
	{:else}
		<div class="flex min-h-11 items-center gap-3 px-4 py-2.5">{@render content()}</div>
	{/if}
</li>
