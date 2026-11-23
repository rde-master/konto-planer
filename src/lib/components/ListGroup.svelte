<script lang="ts">
	import type { Snippet } from 'svelte';

	let { header, footer, children }: { header?: string; footer?: string; children: Snippet } =
		$props();
</script>

<section class="mb-8">
	{#if header}
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{header}</h2>
	{/if}
	<ul
		class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card [&>li]:ml-0"
	>
		{@render children()}
	</ul>
	{#if footer}
		<p class="mt-1.5 px-4 text-[13px] text-label-2">{footer}</p>
	{/if}
</section>
