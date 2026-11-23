<script lang="ts">
	import Icon from '@lucide/svelte/icons/receipt-text';
	import Page from '#lib/components/Page.svelte';
	import ComingSoon from '#lib/components/ComingSoon.svelte';
</script>

<Page title="Buchungen">
	<ComingSoon
		icon={Icon}
		text="Alle Buchungen, Schnellerfassung und Import der Bankexporte."
		version="0.14.0"
	/>
</Page>
