<script lang="ts">
	import type { Component } from 'svelte';

	let { icon: Icon, text, version }: { icon: Component; text: string; version: string } = $props();
</script>

<div
	class="flex flex-col items-center gap-3 rounded-[var(--radius-card)] bg-card px-6 py-12 text-center"
>
	<span class="grid size-16 place-items-center rounded-full bg-fill text-accent">
		<Icon class="size-8" strokeWidth={1.8} />
	</span>
	<p class="max-w-xs text-[15px]">{text}</p>
	<p class="text-[13px] text-label-2">Kommt mit Version {version}</p>
</div>
