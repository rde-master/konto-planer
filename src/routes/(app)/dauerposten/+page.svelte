<script lang="ts">
	import Icon from '@lucide/svelte/icons/repeat';
	import Page from '#lib/components/Page.svelte';
	import ComingSoon from '#lib/components/ComingSoon.svelte';
</script>

<Page title="Dauerposten">
	<ComingSoon
		icon={Icon}
		text="Regelmäßige Ausgaben, Einnahmen und Umbuchungen mit Betragsverlauf."
		version="0.8.0"
	/>
</Page>
