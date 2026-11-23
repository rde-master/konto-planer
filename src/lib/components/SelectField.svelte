<script lang="ts">
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';

	/** List row with a native <select> (shows the iOS picker on phones). */
	let {
		label,
		name,
		options,
		value = ''
	}: {
		label: string;
		name: string;
		options: { value: string; label: string }[];
		value?: string;
	} = $props();

	const id = $props.id();
</script>

<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
	<label for={id} class="flex-1 text-[17px]">{label}</label>
	<span class="relative flex items-center">
		<select
			{id}
			{name}
			{value}
			class="max-w-48 appearance-none truncate bg-transparent py-1.5 pr-6 text-right text-[17px] text-label-2 outline-none"
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		<ChevronsUpDown class="pointer-events-none absolute right-0 size-4 text-label-3" />
	</span>
</li>
