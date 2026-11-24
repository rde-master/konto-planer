<script lang="ts">
	import AppShell from '#lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { children, data }: LayoutProps = $props();
</script>

<AppShell quick={data.quickEntry}>{@render children()}</AppShell>
