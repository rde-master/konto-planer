<script lang="ts">
	/**
	 * Tabs ("Reiter") that split a long page: only the chosen part is shown. The choice comes
	 * back when the user returns to the page through the history, and starts over on a new visit.
	 * The page renders the parts itself (`{#if active === …}`), without a wrapper element, so the
	 * desktop columns keep working.
	 */
	import { snapshot } from '$app/navigation';

	type Tab = { id: string; label: string };
	let {
		tabs,
		active = $bindable(),
		label = 'Bereich'
	}: {
		tabs: Tab[];
		active: string;
		/** Accessible name of the row of tabs. */
		label?: string;
	} = $props();

	snapshot<string>({
		id: 'kp-tabs',
		capture: () => active,
		restore: (value) => {
			if (tabs.some((t) => t.id === value)) active = value;
		},
		reset: () => {
			active = tabs[0]?.id ?? active;
		}
	});

	// A tab that is no longer offered (e.g. the right to edit is gone): back to the first.
	$effect(() => {
		if (tabs.length && !tabs.some((t) => t.id === active)) active = tabs[0].id;
	});

	let list: HTMLElement | undefined = $state();

	/** Arrow keys move between the tabs, as the pattern asks. */
	function onkeydown(e: KeyboardEvent) {
		const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
		const index = tabs.findIndex((t) => t.id === active);
		const next =
			e.key === 'Home'
				? 0
				: e.key === 'End'
					? tabs.length - 1
					: step
						? (index + step + tabs.length) % tabs.length
						: -1;
		if (next < 0 || next === index) return;
		e.preventDefault();
		active = tabs[next].id;
		list?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
	}
</script>

{#if tabs.length > 1}
	<div
		bind:this={list}
		role="tablist"
		aria-label={label}
		tabindex="-1"
		class="kp-span kp-tabs mb-6 flex gap-1 overflow-x-auto rounded-full bg-fill p-1"
		{onkeydown}
	>
		{#each tabs as t (t.id)}
			<button
				type="button"
				role="tab"
				aria-selected={active === t.id}
				tabindex={active === t.id ? 0 : -1}
				onclick={() => (active = t.id)}
				class={[
					'flex-1 shrink-0 rounded-full px-3 py-1.5 text-center text-[13px] font-medium whitespace-nowrap focus-visible:outline-3 focus-visible:outline-accent',
					active === t.id ? 'bg-card shadow-sm' : 'text-label-2'
				]}
			>
				{t.label}
			</button>
		{/each}
	</div>
{/if}

<style>
	/* The row scrolls sideways on narrow phones; a scrollbar would only add noise. */
	.kp-tabs {
		scrollbar-width: none;
	}
	.kp-tabs::-webkit-scrollbar {
		display: none;
	}
</style>
