<script lang="ts">
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import Settings from '@lucide/svelte/icons/settings';
	import Tags from '@lucide/svelte/icons/tags';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import LogoutButton from '#lib/components/LogoutButton.svelte';
</script>

<Page title="Mehr">
	<ListGroup>
		<ListRow
			label="Offene Zahlungen"
			href="offene-zahlungen"
			icon={CalendarClock}
			iconColor="bg-[#ff3b30]"
		/>
		<ListRow label="Kategorien" href="kategorien" icon={Tags} iconColor="bg-[#ff9500]" />
		<ListRow label="Auswertungen" href="auswertungen" icon={ChartPie} iconColor="bg-[#af52de]" />
		<ListRow label="Einstellungen" href="einstellungen" icon={Settings} iconColor="bg-[#8e8e93]" />
	</ListGroup>
	<LogoutButton />
</Page>
