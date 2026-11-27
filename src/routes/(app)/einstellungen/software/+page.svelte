<script lang="ts">
	import Page from '#lib/components/Page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const count = $derived(data.groups.reduce((n, g) => n + g.items.length, 0));
</script>

<Page title="Frameworks und Bibliotheken" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	<p class="kp-span mb-6 px-4 text-[15px] text-label-2">
		Konto Planer {data.version} baut auf freier Software auf. Hier stehen alle {count} direkt verwendeten
		Pakete mit der Version, mit der diese Ausgabe der App gebaut wurde, und ihrer Lizenz.
	</p>

	<section class="mb-8" aria-label="Laufzeit">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Laufzeit</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each data.runtime as r (r.label)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2" aria-label={r.label}>
					<span class="min-w-0 flex-1">
						<span class="block truncate">{r.label}</span>
						<span class="block text-[13px] text-label-2">{r.note}</span>
					</span>
					<span class="shrink-0 text-label-2 tabular" data-version>{r.version}</span>
				</li>
			{/each}
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Die Versionen, mit denen die App gerade läuft.
		</p>
	</section>

	{#each data.groups as group (group.key)}
		<section class="kp-flow mb-8" aria-label={group.title}>
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{group.title}</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each group.items as item (item.name)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2" aria-label={item.label}>
						<span class="min-w-0 flex-1">
							<a
								href={item.url}
								target="_blank"
								rel="noopener noreferrer external"
								class="block truncate text-accent"
							>
								{item.label}
							</a>
							<span class="block text-[13px] text-label-2">
								{#if item.label !== item.name}<span class="font-mono text-[12px]">
										{item.name}
									</span>{item.note ? ' · ' : ''}{/if}{item.note}
							</span>
						</span>
						<span class="shrink-0 text-right">
							<span class="block text-label-2 tabular" data-version>{item.version}</span>
							{#if item.license}
								<span class="block text-[12px] text-label-3">{item.license}</span>
							{/if}
						</span>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">{group.hint}</p>
		</section>
	{/each}

	<p class="kp-span mb-4 px-4 text-[13px] text-label-2">
		Ein Tipp auf den Namen öffnet die Seite des Pakets bei npm. Weitere Pakete, die diese ihrerseits
		mitbringen, sind hier nicht einzeln aufgeführt.
	</p>
</Page>
