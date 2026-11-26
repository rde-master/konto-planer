<script lang="ts">
	import type { ChangelogEntry } from '#lib/system.js';

	let { entries }: { entries: ChangelogEntry[] } = $props();
</script>

{#each entries as e (e.version)}
	<section class="mb-6" aria-label="Version {e.version}">
		<h2 class="mb-1 text-[17px] font-semibold">{e.title}</h2>
		<p class="mb-2 text-[13px] text-label-2">Version {e.version}</p>
		{#each e.sections as s, i (i)}
			{#if s.heading && s.heading !== 'Neu'}
				<p class="mt-2 mb-1 text-[13px] font-semibold text-label-2 uppercase">{s.heading}</p>
			{/if}
			<ul class="list-disc space-y-1 pl-5 text-[15px]">
				{#each s.items as item, k (k)}<li>{item}</li>{/each}
			</ul>
		{/each}
	</section>
{/each}
