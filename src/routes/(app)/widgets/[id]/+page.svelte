<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import WidgetEditor from '#lib/components/WidgetEditor.svelte';
	import ScriptBox from '#lib/components/ScriptBox.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const script = $derived(form && 'script' in form ? form.script : null);
	const status = $derived(form && 'success' in form ? form.success : null);
	const message = $derived(form && 'message' in form ? form.message : null);
</script>

<Page title={data.initial.name} back={{ path: 'widgets', label: 'Widgets' }} layout="wide">
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{:else if status}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{status}
		</p>
	{/if}
	{#if script}<ScriptBox {script} />{/if}

	<form
		method="POST"
		action="?/save"
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		{#key data.id}
			<WidgetEditor data={data.data} initial={data.initial} />
		{/key}
		<Button type="submit">Sichern</Button>
	</form>

	<form method="POST" action="?/renew" use:enhance class="mt-6">
		<Button type="submit" variant="tinted">Neues Skript (neuer Zugang)</Button>
	</form>
	<p class="mt-1.5 px-4 text-[13px] text-label-2">
		Nötig, wenn das Skript verloren ging, und einmalig für Widgets aus 0.54, damit Farben und
		Schrift ankommen. Das alte Skript funktioniert danach nicht mehr.
	</p>
	<form method="POST" action="?/revoke" use:enhance class="mt-4">
		<Button type="submit" variant="destructive">Widget widerrufen</Button>
	</form>
</Page>
