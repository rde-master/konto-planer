<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolvePath } from '#lib/navigation.js';
	import type { Path } from '$app/types';

	let {
		label,
		value,
		href,
		icon: Icon,
		iconColor = 'bg-accent',
		destructive = false,
		onclick,
		trailing
	}: {
		label: string;
		value?: string;
		href?: Path;
		icon?: Component;
		iconColor?: string;
		destructive?: boolean;
		/** Renders the row as a button (e.g. to open a sheet). */
		onclick?: () => void;
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
		<!-- eslint-disable svelte/no-navigation-without-resolve -- resolvePath() wraps resolve() -->
		<a href={resolvePath(href)} class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill">
			{@render content()}
		</a>
	{:else if onclick}
		<button
			type="button"
			{onclick}
			class="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-fill"
		>
			{@render content()}
		</button>
	{:else}
		<div class="flex min-h-11 items-center gap-3 px-4 py-2.5">{@render content()}</div>
	{/if}
</li>
