<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Path } from '$app/types';
	import { page } from '$app/state';
	import { resolvePath } from '#lib/navigation.js';
	import { previousPage, retitle } from '#lib/back.svelte.js';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';

	let {
		title,
		back,
		returns = false,
		actions,
		layout = 'columns',
		children
	}: {
		/**
		 * Desktop layout: "columns" = wide, sections flow in two columns (default); "wide" = wide
		 * single column (the page arranges itself); "narrow" = reading width.
		 */
		layout?: 'columns' | 'wide' | 'narrow';
		title: string;
		/**
		 * Parent page for the iOS-style back button. Used when the page was opened directly;
		 * otherwise the button returns to the page visited before.
		 */
		back?: { path: Path; label: string };
		/**
		 * For pages without a parent that are also reached from elsewhere (the booking list
		 * filtered by an account): show the back button when the user came from another page.
		 */
		returns?: boolean;
		actions?: Snippet;
		children: Snippet;
	} = $props();

	const width = $derived(
		layout === 'narrow' ? 'max-w-3xl' : 'max-w-3xl xl:max-w-[84rem] min-[120rem]:max-w-[112rem]'
	);
	// Where the user came from (e.g. the account whose booking this is), if anywhere.
	const previous = $derived(back || returns ? previousPage() : null);
	const hasBack = $derived(Boolean(back || previous));
	$effect(() => retitle(page.url.pathname + page.url.search, title));

	function goBack(event: MouseEvent) {
		if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
			return;
		event.preventDefault();
		history.back();
	}

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

<!--
	Compact bar: transparent at the top, glass with a small title once the large title scrolls
	away – centred, or on phones below the back button if the page has one.
-->
<header
	class={[
		'sticky top-0 z-30 pt-safe transition-[background-color,box-shadow] duration-200',
		collapsed ? 'rounded-none border-x-0 border-t-0 glass' : 'border-0 bg-transparent shadow-none'
	]}
>
	<div
		class={[
			'mx-auto grid h-13 items-center px-4 md:grid-cols-[1fr_auto_1fr] md:px-8',
			hasBack ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_auto_1fr]',
			width
		]}
	>
		<span class="flex min-w-0 flex-col justify-center md:block">
			{#if hasBack}
				<!-- eslint-disable svelte/no-navigation-without-resolve -- resolvePath() wraps resolve() -->
				<a
					href={previous ? previous.path : back ? resolvePath(back.path) : undefined}
					onclick={previous ? goBack : undefined}
					class={[
						'-ml-2 flex items-center text-accent active:opacity-60 md:py-2 md:text-[17px]',
						collapsed ? 'pt-1 text-[13px]' : 'py-2 text-[17px]'
					]}
				>
					<ChevronLeft
						class={['shrink-0 md:size-7', collapsed ? 'size-5' : 'size-7']}
						strokeWidth={2.2}
					/>
					<span class="truncate">{previous ? previous.title : back?.label}</span>
				</a>
				<!-- Phones: the small title stands below the back button, so neither is cut short. -->
				{#if collapsed}
					<span
						class="truncate pb-1 text-[15px] leading-5 font-semibold md:hidden"
						aria-hidden="true"
						data-compact-title
					>
						{title}
					</span>
				{/if}
			{/if}
		</span>
		<span
			aria-hidden={!collapsed}
			class={[
				'text-[17px] font-semibold transition-opacity duration-200',
				collapsed ? 'opacity-100' : 'opacity-0',
				// With a back button the phone shows the title below it instead.
				hasBack && 'hidden md:block'
			]}
		>
			{title}
		</span>
		<div class="flex justify-end gap-2">{@render actions?.()}</div>
	</div>
</header>

<div class={['mx-auto px-4 md:px-8', width]}>
	<h1 bind:this={titleEl} class="pt-1 pb-4 text-[34px] leading-tight font-bold tracking-tight">
		{title}
	</h1>
	<div class={layout === 'columns' ? 'kp-columns' : undefined}>
		{@render children()}
	</div>
</div>
