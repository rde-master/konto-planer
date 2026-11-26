<script lang="ts">
	import { resolve } from '$app/paths';
	import { afterNavigate } from '$app/navigation';
	import { recordNavigation } from '#lib/back.svelte.js';
	import { plainTitle } from '#lib/back.js';
	import AppShell from '#lib/components/AppShell.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import ChangeList from '#lib/components/ChangeList.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

	// The way back: remember the pages visited so the back button returns to where we came from.
	afterNavigate((navigation) => {
		const url = navigation.to?.url;
		if (!url) return;
		const path = url.pathname + url.search;
		const title = plainTitle(document.title);
		if (navigation.type === 'enter') recordNavigation(data.user.id, { type: 'enter' }, path, title);
		else if (navigation.type === 'popstate')
			recordNavigation(data.user.id, { type: 'pop', delta: navigation.delta }, path, title);
		else {
			const source =
				navigation.type === 'link' || navigation.type === 'form' ? navigation.event.target : null;
			const replace = source instanceof Element && source.closest('[data-sveltekit-replacestate]');
			recordNavigation(data.user.id, { type: replace ? 'replace' : 'push' }, path, title);
		}
	});

	// Shown once after an update; closing remembers the version.
	let newsOpen = $state(false);
	let shown = false;
	$effect(() => {
		if (data.whatsNew.length && !shown) {
			shown = true;
			newsOpen = true;
		}
	});
	$effect(() => {
		if (shown && !newsOpen)
			void fetch(resolve('api/neuigkeiten'), { method: 'POST' }).catch(() => {});
	});
</script>

<AppShell quick={data.quickEntry}>
	{#if data.demo}
		<p
			role="note"
			class="mb-4 rounded-[var(--radius-row)] bg-accent/10 px-4 py-2 text-center text-[13px] text-accent"
		>
			Demo mit erfundenen Daten – Änderungen werden nachts zurückgesetzt.
		</p>
	{/if}
	{@render children()}
</AppShell>

{#if data.whatsNew.length}
	<Sheet bind:open={newsOpen} title="Was ist neu" closeLabel="Fertig">
		<div class="max-h-[60vh] overflow-y-auto px-1">
			<ChangeList entries={data.whatsNew} />
		</div>
	</Sheet>
{/if}
