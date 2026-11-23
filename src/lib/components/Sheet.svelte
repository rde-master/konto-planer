<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * iOS-style sheet: slides up from the bottom on phones, centred dialog on larger screens.
	 * Header with "Abbrechen" (left), title, and an optional confirm button that submits `formId`.
	 */
	let {
		open = $bindable(false),
		title,
		confirmLabel,
		formId,
		confirmDisabled = false,
		destructive = false,
		children
	}: {
		open?: boolean;
		title: string;
		confirmLabel?: string;
		formId?: string;
		confirmDisabled?: boolean;
		destructive?: boolean;
		children: Snippet;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	const titleId = $props.id();

	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	});
</script>

<dialog
	bind:this={dialog}
	aria-labelledby={titleId}
	onclose={() => (open = false)}
	onclick={(e) => {
		// Tap on the backdrop closes the sheet.
		if (e.target === dialog) open = false;
	}}
	class="sheet m-0 mt-auto w-full max-w-none bg-transparent p-0 text-label backdrop:bg-black/40 md:m-auto md:max-w-lg"
>
	<div
		class="max-h-[92dvh] overflow-y-auto rounded-t-[1.75rem] bg-bg pb-[max(1.5rem,env(safe-area-inset-bottom))] md:rounded-[1.75rem] md:pb-6"
	>
		<div
			class="mx-auto mt-2 h-1.5 w-9 rounded-full bg-fill-strong md:hidden"
			aria-hidden="true"
		></div>
		<header class="grid grid-cols-[1fr_auto_1fr] items-center px-4 pt-2 pb-4">
			<button
				type="button"
				class="justify-self-start py-2 text-[17px] text-accent"
				onclick={() => (open = false)}
			>
				Abbrechen
			</button>
			<h2 id={titleId} class="text-[17px] font-semibold">{title}</h2>
			{#if confirmLabel && formId}
				<button
					type="submit"
					form={formId}
					disabled={confirmDisabled}
					class={[
						'justify-self-end py-2 text-[17px] font-semibold disabled:opacity-40',
						destructive ? 'text-danger' : 'text-accent'
					]}
				>
					{confirmLabel}
				</button>
			{:else}
				<span></span>
			{/if}
		</header>
		<div class="px-4">{@render children()}</div>
	</div>
</dialog>

<style>
	.sheet[open] {
		animation: sheet-in 0.32s cubic-bezier(0.32, 0.72, 0, 1);
	}
	.sheet[open]::backdrop {
		animation: fade-in 0.32s ease;
	}
	@keyframes sheet-in {
		from {
			transform: translateY(100%);
		}
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes dialog-in {
		from {
			transform: translateY(1.5rem);
			opacity: 0;
		}
	}
	@media (min-width: 48rem) {
		.sheet[open] {
			animation-name: dialog-in;
		}
	}
</style>
