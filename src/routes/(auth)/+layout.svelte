<script lang="ts">
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<main class="flex min-h-dvh items-center justify-center px-4 py-10 pt-safe pb-safe">
	<div class="w-full max-w-sm">
		<div class="mb-8 flex flex-col items-center gap-3">
			<img src="/favicon.svg" alt="" class="size-20 rounded-[1.25rem] shadow-lg" />
			<span class="text-[28px] font-bold tracking-tight">Konto Planer</span>
		</div>
		{@render children()}
	</div>
</main>
