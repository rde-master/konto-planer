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
