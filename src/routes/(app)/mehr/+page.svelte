<script lang="ts">
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import LogoutButton from '#lib/components/LogoutButton.svelte';
	import { APP_VERSION, MORE } from '#lib/navigation.js';
</script>

<Page title="Mehr">
	<ListGroup>
		{#each MORE as item (item.path)}
			<ListRow label={item.label} href={item.path} icon={item.icon} iconColor={item.color} />
		{/each}
	</ListGroup>
	<LogoutButton />
	<p class="mt-6 text-center text-[13px] text-label-2">Konto Planer {APP_VERSION}</p>
</Page>
