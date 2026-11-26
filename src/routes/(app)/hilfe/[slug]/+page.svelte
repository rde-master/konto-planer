<script lang="ts">
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<Page title={data.title} back={{ path: 'hilfe', label: 'Hilfe' }}>
	<article class="help rounded-[var(--radius-card)] bg-card p-5 text-[16px] leading-relaxed">
		<!-- Rendered from docs/hilfe in the repo; renderHelp() escapes all text. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html data.html}
	</article>
	{#if data.next}
		<a
			href={resolve(`hilfe/${data.next.slug}`)}
			class="mt-6 block text-center text-[17px] text-accent"
		>
			Weiter: {data.next.title}
		</a>
	{/if}
</Page>

<style>
	.help :global(h2) {
		margin: 1.5rem 0 0.5rem;
		font-size: 20px;
		font-weight: 700;
		scroll-margin-top: 5rem;
	}
	.help :global(h3) {
		margin: 1rem 0 0.25rem;
		font-size: 17px;
		font-weight: 600;
		scroll-margin-top: 5rem;
	}
	.help :global(h2:first-child) {
		margin-top: 0;
	}
	.help :global(p),
	.help :global(ul),
	.help :global(ol),
	.help :global(pre) {
		margin: 0.5rem 0;
	}
	.help :global(ul) {
		list-style: disc;
		padding-left: 1.25rem;
	}
	.help :global(ol) {
		list-style: decimal;
		padding-left: 1.25rem;
	}
	.help :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.9em;
	}
	.help :global(pre) {
		overflow-x: auto;
		border-radius: 10px;
		background: var(--color-fill);
		padding: 0.75rem;
		font-size: 13px;
	}
	.help :global(a) {
		color: var(--color-accent);
	}
</style>
