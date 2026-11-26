<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	let {
		label,
		error,
		value = $bindable(),
		signed = false,
		...rest
	}: {
		label: string;
		error?: string;
		value?: string;
		/** Amount that may be negative: adds a +/− button, the phone's number pad has no minus key. */
		signed?: boolean;
	} & Omit<HTMLInputAttributes, 'value'> = $props();

	const id = $props.id();
	let input: HTMLInputElement | undefined = $state();

	const negative = $derived(/^\s*[-−]/.test(value ?? ''));

	function flipSign() {
		const text = (value ?? '').trim();
		value = negative ? text.replace(/^[-−]\s*/, '') : `-${text}`;
		// Keep the keyboard open so the amount can be typed right after the sign.
		input?.focus();
	}
</script>

<li class="flex flex-col px-4 py-2">
	<label for={id} class="text-[13px] text-label-2">{label}</label>
	<div class="flex items-center gap-2">
		<input
			{id}
			bind:this={input}
			bind:value
			{...rest}
			aria-invalid={error ? 'true' : undefined}
			aria-describedby={error ? `${id}-err` : undefined}
			class="w-full min-w-0 flex-1 bg-transparent py-1 text-[17px] outline-none placeholder:text-label-3"
		/>
		{#if signed}
			<button
				type="button"
				class="shrink-0 rounded-full bg-fill px-3.5 py-1 text-[17px] font-medium text-accent tabular active:opacity-60"
				aria-label="Vorzeichen wechseln"
				aria-pressed={negative}
				title={negative ? 'Betrag ist negativ' : 'Betrag ist positiv'}
				onclick={flipSign}
			>
				+/−
			</button>
		{/if}
	</div>
	{#if error}<span id="{id}-err" class="text-[13px] text-danger">{error}</span>{/if}
</li>
