<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SegmentedField from '#lib/components/SegmentedField.svelte';
	import Button from '#lib/components/Button.svelte';
	import { ROLE_OPTIONS } from '#lib/roles.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const target = $derived(data.target);
	const isSelf = $derived(target.id === data.user.id);

	let savePending = $state(false);
	let resetOpen = $state(false);
	let resetPending = $state(false);
	let deleteOpen = $state(false);

	const updateErrors = $derived(
		form?.action === 'update' && 'errors' in form ? form.errors : undefined
	);
	const resetErrors = $derived(
		form?.action === 'reset' && 'errors' in form ? form.errors : undefined
	);
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const status = $derived.by(() => {
		if (form?.action === 'update' && 'success' in form) return 'Änderungen gesichert.';
		if (form?.action === 'unlock' && 'success' in form) return 'Sperre aufgehoben.';
		if (form?.action === 'reset' && 'success' in form)
			return 'Passwort zurückgesetzt. Alle Geräte dieses Benutzers wurden abgemeldet.';
		return undefined;
	});
</script>

<Page title={target.name} back={{ path: 'einstellungen/benutzer', label: 'Benutzer' }}>
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

	{#if data.lockedUntil}
		<section
			class="mb-8 rounded-[var(--radius-row)] bg-card px-4 py-3"
			aria-labelledby="lock-title"
		>
			<h2 id="lock-title" class="text-[17px] font-semibold text-warning">Anmeldung gesperrt</h2>
			<p class="mt-1 text-[15px] text-label-2">
				Nach zu vielen Fehlversuchen gesperrt bis {data.lockedUntil}.
			</p>
			<form method="POST" action="?/unlock" use:enhance class="mt-3">
				<Button type="submit" variant="tinted">Sperre aufheben</Button>
			</form>
		</section>
	{/if}

	<form
		method="POST"
		action="?/update"
		use:enhance={() => {
			savePending = true;
			return async ({ update }) => {
				await update({ reset: false });
				savePending = false;
			};
		}}
	>
		<ListGroup header="Profil">
			<ListRow label="Benutzername" value={target.username} />
			<FormField
				label="Name"
				name="name"
				value={target.name}
				autocomplete="off"
				error={updateErrors?.name}
				required
			/>
			<FormField
				label="E-Mail (optional)"
				name="email"
				type="email"
				value={target.email ?? ''}
				autocomplete="off"
				error={updateErrors?.email}
			/>
		</ListGroup>

		<section class="mb-8">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Rolle</h2>
			<div class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<SegmentedField
					name="role"
					label="Rolle"
					options={ROLE_OPTIONS}
					initial={target.role}
					error={updateErrors?.role}
				/>
			</div>
		</section>

		<Button type="submit" disabled={savePending} class="mb-8">Sichern</Button>
	</form>

	{#if isSelf}
		<p class="mb-8 px-4 text-[13px] text-label-2">
			Dein eigenes Passwort änderst du unter Einstellungen → Passwort ändern.
		</p>
	{:else}
		<ListGroup header="Zugang">
			<ListRow label="Passwort zurücksetzen" onclick={() => (resetOpen = true)} />
			<ListRow label="Benutzer löschen" destructive onclick={() => (deleteOpen = true)} />
		</ListGroup>
	{/if}
</Page>

<Sheet
	bind:open={resetOpen}
	title="Passwort zurücksetzen"
	confirmLabel="Sichern"
	formId="reset-form"
	confirmDisabled={resetPending}
>
	<form
		id="reset-form"
		method="POST"
		action="?/reset"
		use:enhance={() => {
			resetPending = true;
			return async ({ result, update }) => {
				resetPending = false;
				if (result.type === 'success') resetOpen = false;
				await update();
			};
		}}
	>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Neues Passwort"
				name="password"
				type="password"
				autocomplete="new-password"
				error={resetErrors?.password}
				required
			/>
			<FormField
				label="Neues Passwort wiederholen"
				name="confirm"
				type="password"
				autocomplete="new-password"
				error={resetErrors?.confirm}
				required
			/>
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Mindestens 10 Zeichen. {target.name} wird auf allen Geräten abgemeldet und meldet sich mit dem neuen
			Passwort an. Eine Login-Sperre wird dabei aufgehoben.
		</p>
	</form>
</Sheet>

<Sheet bind:open={deleteOpen} title="Benutzer löschen">
	<p class="mb-6 px-4 text-center text-[15px]">
		{target.name} wird gelöscht und auf allen Geräten abgemeldet. Das lässt sich nicht rückgängig machen.
	</p>
	<form method="POST" action="?/delete" use:enhance>
		<Button type="submit" variant="destructive">Löschen</Button>
	</form>
</Sheet>
