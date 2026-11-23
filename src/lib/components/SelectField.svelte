<script lang="ts">
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';

	/** List row with a native <select> (shows the iOS picker on phones). */
	let {
		label,
		name,
		options,
		value = '',
		error,
		onchange
	}: {
		label: string;
		name: string;
		options: { value: string; label: string }[];
		value?: string;
		error?: string;
		onchange?: (value: string) => void;
	} = $props();

	const id = $props.id();
</script>

<li class="flex min-h-11 flex-wrap items-center gap-x-3 px-4 py-1.5">
	<label for={id} class="flex-1 text-[17px]">{label}</label>
	<span class="relative flex items-center">
		<select
			{id}
			{name}
			{value}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-err` : undefined}
			onchange={(e) => onchange?.(e.currentTarget.value)}
			class="max-w-48 appearance-none truncate bg-transparent py-1.5 pr-6 text-right text-[17px] text-label-2 outline-none"
		>
			{#each options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
		<ChevronsUpDown class="pointer-events-none absolute right-0 size-4 text-label-3" />
	</span>
	{#if error}<span id="{id}-err" class="w-full pb-1 text-[13px] text-danger">{error}</span>{/if}
</li>
