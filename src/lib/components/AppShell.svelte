<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SECTIONS, TABS, isActive, isTabActive } from '#lib/navigation.js';

	let { children }: { children: Snippet } = $props();
</script>

<div class="min-h-dvh md:flex">
	<!-- Desktop sidebar -->
	<nav
		aria-label="Hauptnavigation"
		class="sticky top-3 m-3 hidden h-[calc(100dvh-1.5rem)] w-60 shrink-0 flex-col rounded-[1.75rem] p-3 glass md:flex"
	>
		<div class="flex items-center gap-2.5 px-3 pt-2 pb-5">
			<img src="/favicon.svg" alt="" class="size-8 rounded-[0.55rem]" />
			<span class="text-[17px] font-semibold">Konto Planer</span>
		</div>
		<ul class="flex flex-col gap-0.5">
			{#each SECTIONS as item (item.path)}
				{@const active = isActive(item.path, page.url.pathname)}
				<li>
					<a
						href={resolve(item.path)}
						aria-current={active ? 'page' : undefined}
						class={[
							'flex items-center gap-3 rounded-xl px-3 py-2 text-[15px] transition-colors',
							active ? 'bg-accent font-medium text-accent-contrast' : 'hover:bg-fill'
						]}
					>
						<item.icon class={['size-5', !active && 'text-accent']} strokeWidth={2} />
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<main class="min-w-0 flex-1 pb-32 md:pb-10">
		{@render children()}
	</main>

	<!-- Phone: floating tab bar -->
	<nav
		aria-label="Hauptnavigation"
		class="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden"
	>
		<ul class="flex w-full max-w-md items-stretch justify-around rounded-full p-1.5 glass">
			{#each TABS as tab (tab.path)}
				{@const active = isTabActive(tab.path, page.url.pathname)}
				<li class="flex-1">
					<a
						href={resolve(tab.path)}
						aria-current={active ? 'page' : undefined}
						class={[
							'flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition-colors',
							active ? 'bg-fill-strong text-accent' : 'text-label-2'
						]}
					>
						<tab.icon class="size-[22px]" strokeWidth={active ? 2.4 : 2} />
						{tab.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>
</div>
