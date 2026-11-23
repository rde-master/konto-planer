<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import Page from '#lib/components/Page.svelte';
	import ComingSoon from '#lib/components/ComingSoon.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const firstName = $derived(data.user.name.split(' ')[0]);
</script>

<Page title="Übersicht">
	<p class="mb-6 text-[17px] text-label-2">Hallo {firstName}!</p>
	<ComingSoon
		icon={House}
		text="Hier siehst du bald für jedes Konto, wie viel bis zum nächsten Gehalt verfügbar ist."
		version="0.34.0"
	/>
</Page>
