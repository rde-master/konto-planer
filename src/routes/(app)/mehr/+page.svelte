<script lang="ts">
	import ChartPie from '@lucide/svelte/icons/chart-pie';
	import Settings from '@lucide/svelte/icons/settings';
	import Tags from '@lucide/svelte/icons/tags';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import Vault from '@lucide/svelte/icons/vault';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
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
		<ListRow
			label="Geplante Zahlungen"
			href="geplant"
			icon={CalendarPlus}
			iconColor="bg-[#34c759]"
		/>
		<ListRow label="Sparziele" href="sparziele" icon={PiggyBank} iconColor="bg-[#ff2d55]" />
		<ListRow label="Rücklagen" href="ruecklagen" icon={Vault} iconColor="bg-[#5856d6]" />
		<ListRow label="Kategorien" href="kategorien" icon={Tags} iconColor="bg-[#ff9500]" />
		<ListRow label="Auswertungen" href="auswertungen" icon={ChartPie} iconColor="bg-[#af52de]" />
		<ListRow label="Einstellungen" href="einstellungen" icon={Settings} iconColor="bg-[#8e8e93]" />
	</ListGroup>
	<LogoutButton />
</Page>
