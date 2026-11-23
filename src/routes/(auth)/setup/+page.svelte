<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head><title>Einrichtung · Konto Planer</title></svelte:head>

<h1 class="mb-1 text-center text-[22px] font-bold">Willkommen</h1>
<p class="mb-6 text-center text-[15px] text-label-2">
	Lege das erste Konto für den Admin an. Weitere Benutzer legt der Admin später selbst an.
</p>

<form
	method="POST"
	use:enhance={() => {
		pending = true;
		return async ({ update }) => {
			await update({ reset: false });
			pending = false;
		};
	}}
	class="flex flex-col gap-4"
>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<FormField
			label="Name"
			name="name"
			value={form?.name ?? ''}
			autocomplete="name"
			error={form?.errors?.name}
			required
		/>
		<FormField
			label="Benutzername"
			name="username"
			value={form?.username ?? ''}
			autocomplete="username"
			autocapitalize="none"
			spellcheck={false}
			error={form?.errors?.username}
			required
		/>
		<FormField
			label="E-Mail (optional)"
			name="email"
			type="email"
			value={form?.email ?? ''}
			autocomplete="email"
			error={form?.errors?.email}
		/>
	</ul>
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<FormField
			label="Passwort"
			name="password"
			type="password"
			autocomplete="new-password"
			error={form?.errors?.password}
			required
		/>
		<FormField
			label="Passwort wiederholen"
			name="confirm"
			type="password"
			autocomplete="new-password"
			error={form?.errors?.confirm}
			required
		/>
	</ul>
	<p class="-mt-2 px-4 text-[13px] text-label-2">Mindestens 10 Zeichen.</p>
	<Button type="submit" disabled={pending}>Admin anlegen</Button>
</form>
