<script lang="ts">
	import Icon from '@lucide/svelte/icons/chart-pie';
	import Page from '#lib/components/Page.svelte';
	import ComingSoon from '#lib/components/ComingSoon.svelte';
</script>

<Page title="Auswertungen">
	<ComingSoon
		icon={Icon}
		text="Ausgaben nach Kategorie, Fixkosten und Einnahmen gegen Ausgaben."
		version="0.35.0"
	/>
</Page>
