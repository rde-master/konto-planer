<script lang="ts">
	import { resolve } from '$app/paths';
	import AppShell from '#lib/components/AppShell.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import ChangeList from '#lib/components/ChangeList.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();

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

<AppShell quick={data.quickEntry}>{@render children()}</AppShell>

{#if data.whatsNew.length}
	<Sheet bind:open={newsOpen} title="Was ist neu" closeLabel="Fertig">
		<div class="max-h-[60vh] overflow-y-auto px-1">
			<ChangeList entries={data.whatsNew} />
		</div>
	</Sheet>
{/if}
