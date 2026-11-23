<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Anmelden · Konto Planer</title></svelte:head>

<form
	method="POST"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	}}
	class="flex flex-col gap-4"
>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<FormField
			label="Benutzername"
			name="username"
			value={form?.username ?? ''}
			autocomplete="username"
			autocapitalize="none"
			spellcheck={false}
			required
		/>
		<FormField
			label="Passwort"
			name="password"
			type="password"
			autocomplete="current-password"
			required
		/>
	</ul>
	{#if form?.error}
		<p role="alert" class="px-4 text-[15px] text-danger">{form.error}</p>
	{/if}
	<Button type="submit" disabled={pending}>Anmelden</Button>
	<p class="px-4 text-center text-[13px] text-label-2">
		Passwort vergessen? Der Admin kann es zurücksetzen.
	</p>
</form>
