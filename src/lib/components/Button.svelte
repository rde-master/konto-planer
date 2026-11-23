<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	let {
		variant = 'filled',
		children,
		class: className,
		...rest
	}: {
		variant?: 'filled' | 'tinted' | 'plain' | 'destructive';
		children: Snippet;
	} & HTMLButtonAttributes = $props();
</script>

<button
	{...rest}
	class={[
		'flex min-h-[50px] w-full items-center justify-center rounded-full px-5 text-[17px] font-semibold transition-opacity active:opacity-70 disabled:opacity-40',
		variant === 'filled' && 'bg-accent text-accent-contrast',
		variant === 'tinted' && 'bg-fill text-accent',
		variant === 'plain' && 'text-accent',
		variant === 'destructive' && 'bg-danger text-white',
		className
	]}
>
	{@render children()}
</button>
