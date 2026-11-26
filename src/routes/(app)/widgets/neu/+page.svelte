<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import WidgetEditor from '#lib/components/WidgetEditor.svelte';
	import ScriptBox from '#lib/components/ScriptBox.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const created = $derived(form && 'created' in form ? form.created : null);
	const message = $derived(form && 'message' in form ? form.message : null);
</script>

<Page title="Neues Widget" back={{ path: 'widgets', label: 'Widgets' }}>
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{/if}
	{#if created}
		<ScriptBox script={created.script} />
		<a
			href={resolve(`widgets/${created.id}`)}
			class="mb-8 block text-center text-[17px] text-accent"
		>
			Weiter bearbeiten
		</a>
	{:else}
		<form
			method="POST"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
		>
			<WidgetEditor data={data.data} initial={data.initial} />
			<Button type="submit">Widget anlegen</Button>
		</form>
	{/if}
</Page>
