<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	/** Multi-line input as a list row (label above, grows with its content). */
	let {
		label,
		error,
		value = $bindable(),
		...rest
	}: { label: string; error?: string; value?: string } & Omit<
		HTMLTextareaAttributes,
		'value'
	> = $props();

	const id = $props.id();
</script>

<li class="flex flex-col px-4 py-2">
	<label for={id} class="text-[13px] text-label-2">{label}</label>
	<textarea
		{id}
		bind:value
		rows="3"
		{...rest}
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={error ? `${id}-err` : undefined}
		class="field-sizing-content min-h-[4.5rem] w-full resize-none bg-transparent py-1 text-[17px] outline-none placeholder:text-label-3"
	></textarea>
	{#if error}<span id="{id}-err" class="text-[13px] text-danger">{error}</span>{/if}
</li>
