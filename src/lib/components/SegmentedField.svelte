<script lang="ts">
	/**
	 * iOS segmented control built on native radio inputs, so it works inside plain forms.
	 * `initial` is the default selection; a form reset returns to it (defaultChecked).
	 */
	let {
		name,
		label,
		options,
		initial,
		error,
		disabled = false
	}: {
		name: string;
		label: string;
		options: { value: string; label: string }[];
		initial: string;
		error?: string;
		disabled?: boolean;
	} = $props();
</script>

<fieldset class="px-4 py-2.5" {disabled}>
	<legend class="sr-only">{label}</legend>
	<div class="grid auto-cols-fr grid-flow-col gap-0.5 rounded-[9px] bg-fill p-0.5">
		{#each options as option (option.value)}
			<label
				class="relative flex min-h-8 cursor-pointer items-center justify-center rounded-[7px] text-[13px] font-medium has-checked:bg-segment has-checked:shadow-sm has-focus-visible:outline-3 has-focus-visible:outline-accent"
			>
				<input
					type="radio"
					{name}
					value={option.value}
					defaultChecked={option.value === initial}
					class="sr-only"
				/>
				{option.label}
			</label>
		{/each}
	</div>
	{#if error}<p class="mt-1.5 text-[13px] text-danger">{error}</p>{/if}
</fieldset>
