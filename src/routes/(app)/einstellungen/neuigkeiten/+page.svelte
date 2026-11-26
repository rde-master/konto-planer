<script lang="ts">
	import Page from '#lib/components/Page.svelte';
	import ChangeList from '#lib/components/ChangeList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title="Was ist neu" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	<div class="rounded-[var(--radius-card)] bg-card p-5">
		<ChangeList entries={data.entries} />
	</div>
</Page>
