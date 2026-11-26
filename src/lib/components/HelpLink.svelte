<script lang="ts">
	import { resolve } from '$app/paths';
	import CircleHelp from '@lucide/svelte/icons/circle-help';

	/** Link to a help chapter (and section), e.g. chapter="erste-schritte" anchor="mindestbestand-verstehen". */
	let {
		chapter,
		anchor = '',
		label
	}: { chapter: string; anchor?: string; label: string } = $props();
</script>

<a
	href={resolve(`hilfe/${chapter}#${anchor}`)}
	class="mt-2 mb-8 flex items-center justify-center gap-1.5 text-[15px] text-accent"
>
	<CircleHelp class="size-4" />
	{label}
</a>
