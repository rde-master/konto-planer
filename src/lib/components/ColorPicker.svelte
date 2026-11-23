<script lang="ts">
	import { ACCOUNT_COLORS, COLOR_KEYS, accountColorCss } from '#lib/colors.js';

	/** Row of colour swatches built on native radios (works in plain forms, resets to `initial`). */
	let { name, initial, error }: { name: string; initial: string; error?: string } = $props();
</script>

<fieldset class="px-4 py-3">
	<legend class="sr-only">Farbe</legend>
	<div class="flex flex-wrap gap-3">
		{#each COLOR_KEYS as key (key)}
			<label
				class="relative grid size-9 cursor-pointer place-items-center rounded-full has-checked:ring-3 has-checked:ring-label-3 has-checked:ring-offset-2 has-checked:ring-offset-card has-focus-visible:outline-3 has-focus-visible:outline-accent"
				style:background-color={accountColorCss(key)}
				title={ACCOUNT_COLORS[key].label}
			>
				<input type="radio" {name} value={key} defaultChecked={key === initial} class="sr-only" />
				<span class="sr-only">{ACCOUNT_COLORS[key].label}</span>
			</label>
		{/each}
	</div>
	{#if error}<p class="mt-1.5 text-[13px] text-danger">{error}</p>{/if}
</fieldset>
