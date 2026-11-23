<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		error,
		value = $bindable(),
		...rest
	}: { label: string; error?: string; value?: string } & Omit<
		HTMLInputAttributes,
		'value'
	> = $props();

	const id = $props.id();
</script>

<li class="flex flex-col px-4 py-2">
	<label for={id} class="text-[13px] text-label-2">{label}</label>
	<input
		{id}
		bind:value
		{...rest}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${id}-err` : undefined}
		class="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-label-3"
	/>
	{#if error}<span id="{id}-err" class="text-[13px] text-danger">{error}</span>{/if}
</li>
