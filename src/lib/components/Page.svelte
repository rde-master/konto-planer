<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Path } from '$app/types';
	import { resolvePath } from '#lib/navigation.js';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	let {
		title,
		back,
		actions,
		children
	}: {
		title: string;
		/** Parent page for the iOS-style back button. */
		back?: { path: Path; label: string };
		actions?: Snippet;
		children: Snippet;
	} = $props();

	let titleEl: HTMLElement | undefined = $state();
	let collapsed = $state(false);

	$effect(() => {
		if (!titleEl) return;
		const observer = new IntersectionObserver(([entry]) => (collapsed = !entry.isIntersecting), {
			rootMargin: '-52px 0px 0px 0px'
		});
		observer.observe(titleEl);
		return () => observer.disconnect();
	});
</script>

<svelte:head>
	<title>{title} · Konto Planer</title>
</svelte:head>

<!-- Compact bar: transparent at the top, glass with a small centred title once the large title scrolls away. -->
<header
	class={[
		'sticky top-0 z-30 pt-safe transition-[background-color,box-shadow] duration-200',
		collapsed ? 'rounded-none border-x-0 border-t-0 glass' : 'border-0 bg-transparent shadow-none'
	]}
>
	<div class="mx-auto grid h-13 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-4 md:px-8">
		<span class="min-w-0">
			{#if back}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolvePath() wraps resolve() -->
				<a
					href={resolvePath(back.path)}
					class="-ml-2 flex items-center py-2 text-[17px] text-accent active:opacity-60"
				>
					<ChevronLeft class="size-7 shrink-0" strokeWidth={2.2} />
					<span class="truncate">{back.label}</span>
				</a>
			{/if}
		</span>
		<span
			aria-hidden={!collapsed}
			class={[
				'text-[17px] font-semibold transition-opacity duration-200',
				collapsed ? 'opacity-100' : 'opacity-0'
			]}
		>
			{title}
		</span>
		<div class="flex justify-end gap-2">{@render actions?.()}</div>
	</div>
</header>

<div class="mx-auto max-w-3xl px-4 md:px-8">
	<h1 bind:this={titleEl} class="pt-1 pb-4 text-[34px] leading-tight font-bold tracking-tight">
		{title}
	</h1>
	{@render children()}
</div>
