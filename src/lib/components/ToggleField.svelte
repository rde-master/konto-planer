<script lang="ts">
	/** List row with an iOS-style switch, built on a native checkbox (submits "on"). */
	let {
		label,
		name,
		initial = false,
		hint,
		onchange
	}: {
		label: string;
		name: string;
		initial?: boolean;
		hint?: string;
		onchange?: (checked: boolean) => void;
	} = $props();

	const id = $props.id();
</script>

<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
	<label for={id} class="flex-1 text-[17px]">
		{label}
		{#if hint}<span class="block text-[13px] text-label-2">{hint}</span>{/if}
	</label>
	<input
		{id}
		{name}
		type="checkbox"
		role="switch"
		defaultChecked={initial}
		onchange={(e) => onchange?.(e.currentTarget.checked)}
		class="toggle relative h-[31px] w-[51px] shrink-0 cursor-pointer appearance-none rounded-full bg-fill-strong transition-colors checked:bg-success focus-visible:outline-3 focus-visible:outline-accent"
	/>
</li>

<style>
	.toggle::after {
		content: '';
		position: absolute;
		top: 2px;
		left: 2px;
		width: 27px;
		height: 27px;
		border-radius: 9999px;
		background: #fff;
		box-shadow:
			0 3px 8px rgb(0 0 0 / 0.15),
			0 3px 1px rgb(0 0 0 / 0.06);
		transition: transform 0.2s ease;
	}
	.toggle:checked::after {
		transform: translateX(20px);
	}
	@media (prefers-reduced-motion: reduce) {
		.toggle,
		.toggle::after {
			transition: none;
		}
	}
</style>
