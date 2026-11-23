<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SegmentedField from '#lib/components/SegmentedField.svelte';
	import { ROLE_OPTIONS, roleLabel } from '#lib/roles.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let createOpen = $state(false);
	let pending = $state(false);
	let formEl: HTMLFormElement | undefined = $state();

	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const values = $derived(form && 'values' in form ? form.values : undefined);
</script>

<Page title="Benutzer" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Benutzer anlegen"
			onclick={() => {
				formEl?.reset();
				createOpen = true;
			}}
			class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
		>
			<Plus class="size-6" strokeWidth={2.2} />
		</button>
	{/snippet}

	{#if form && 'created' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{form.created} wurde angelegt.
		</p>
	{/if}

	<ListGroup
		footer="Neue Benutzer sehen zunächst keine Konten. Zugriffe vergibst du später je Konto."
	>
		{#each data.users as user (user.id)}
			<ListRow
				label={user.id === data.user.id ? `${user.name} (du)` : user.name}
				value={`${user.username} · ${roleLabel(user.role)}`}
				href={`einstellungen/benutzer/${user.id}`}
			/>
		{/each}
	</ListGroup>
</Page>

<Sheet
	bind:open={createOpen}
	title="Neuer Benutzer"
	confirmLabel="Anlegen"
	formId="create-user"
	confirmDisabled={pending}
>
	<form
		bind:this={formEl}
		id="create-user"
		method="POST"
		action="?/create"
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') createOpen = false;
				await update({ reset: result.type === 'success' });
			};
		}}
	>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Name"
				name="name"
				value={values?.name ?? ''}
				autocomplete="off"
				error={errors?.name}
				required
			/>
			<FormField
				label="Benutzername"
				name="username"
				value={values?.username ?? ''}
				autocomplete="off"
				autocapitalize="none"
				spellcheck={false}
				error={errors?.username}
				required
			/>
			<FormField
				label="E-Mail (optional)"
				name="email"
				type="email"
				value={values?.email ?? ''}
				autocomplete="off"
				error={errors?.email}
			/>
		</ul>

		<h3 class="mt-6 mb-1.5 px-4 text-[13px] text-label-2 uppercase">Rolle</h3>
		<div class="overflow-hidden rounded-[var(--radius-row)] bg-card">
			<SegmentedField
				name="role"
				label="Rolle"
				options={ROLE_OPTIONS}
				initial="user"
				error={errors?.role}
			/>
		</div>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Admins verwalten Benutzer, Einstellungen und sehen alle Konten.
		</p>

		<h3 class="mt-6 mb-1.5 px-4 text-[13px] text-label-2 uppercase">Erstes Passwort</h3>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Passwort"
				name="password"
				type="password"
				autocomplete="new-password"
				error={errors?.password}
				required
			/>
			<FormField
				label="Passwort wiederholen"
				name="confirm"
				type="password"
				autocomplete="new-password"
				error={errors?.confirm}
				required
			/>
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Mindestens 10 Zeichen. Teile es der Person persönlich mit; sie kann es danach selbst ändern.
		</p>
	</form>
</Sheet>
