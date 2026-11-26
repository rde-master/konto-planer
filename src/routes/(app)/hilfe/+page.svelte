<script lang="ts">
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import { searchHelp } from '#lib/help.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let query = $state('');
	const hits = $derived(searchHelp(data.chapters, query));
</script>

<Page title="Hilfe">
	<input
		type="search"
		bind:value={query}
		placeholder="Hilfe durchsuchen"
		aria-label="Hilfe durchsuchen"
		class="mb-6 w-full rounded-[var(--radius-row)] bg-fill px-4 py-2.5 text-[17px] outline-none"
	/>
	{#if query.trim().length > 1}
		<section class="mb-8" aria-label="Treffer">
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each hits as h (`${h.slug}#${h.anchor}`)}
					<li>
						<a
							href={resolve(`hilfe/${h.slug}#${h.anchor}`)}
							class="block px-4 py-2.5 active:bg-fill"
						>
							<span class="block text-[17px]">{h.heading}</span>
							<span class="block text-[13px] text-label-2">{h.chapter} · {h.text}</span>
						</a>
					</li>
				{:else}
					<li class="px-4 py-3 text-[15px] text-label-2">Nichts gefunden.</li>
				{/each}
			</ul>
		</section>
	{:else}
		<ListGroup header="Kapitel">
			{#each data.chapters as c (c.slug)}
				<ListRow label={c.title} href={`hilfe/${c.slug}`} />
			{/each}
		</ListGroup>
	{/if}
</Page>
