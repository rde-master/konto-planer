<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import LogoutButton from '#lib/components/LogoutButton.svelte';
	import { THEMES, parseTheme, type Theme } from '#lib/theme.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const LABELS: Record<Theme, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' };
	// Optimistic local value so the switch reacts immediately; follows the server value otherwise.
	let selected = $derived<Theme>(data.theme);
</script>

<Page title="Einstellungen">
	<section class="mb-8">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Erscheinungsbild</h2>
		<form
			method="POST"
			action="?/theme"
			use:enhance={({ formData }) => {
				selected = parseTheme(formData.get('theme') as string | null);
				document.documentElement.dataset.theme = selected;
				return async ({ update }) => update({ reset: false, invalidateAll: false });
			}}
		>
			<div
				role="radiogroup"
				aria-label="Erscheinungsbild"
				class="grid grid-cols-3 gap-0.5 rounded-[10px] bg-fill p-0.5"
			>
				{#each THEMES as theme (theme)}
					<button
						type="submit"
						name="theme"
						value={theme}
						role="radio"
						aria-checked={selected === theme}
						class={[
							'min-h-9 rounded-[8px] text-[15px] font-medium transition-colors',
							selected === theme ? 'bg-bg-elevated shadow-sm' : 'text-label'
						]}
					>
						{LABELS[theme]}
					</button>
				{/each}
			</div>
		</form>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">„System“ folgt der Einstellung des Geräts.</p>
	</section>

	<ListGroup header="Angemeldet als">
		<ListRow label="Name" value={data.user.name} />
		<ListRow label="Benutzername" value={data.user.username} />
		<ListRow label="Rolle" value={data.user.role === 'admin' ? 'Admin' : 'Benutzer'} />
	</ListGroup>

	<LogoutButton />

	<p class="pb-4 text-center text-[13px] text-label-2">Konto Planer {__APP_VERSION__}</p>
</Page>
