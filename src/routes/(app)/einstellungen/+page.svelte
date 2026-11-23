<script lang="ts">
	import { enhance } from '$app/forms';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Users from '@lucide/svelte/icons/users';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import LogoutButton from '#lib/components/LogoutButton.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import { THEMES, parseTheme, type Theme } from '#lib/theme.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const LABELS: Record<Theme, string> = { system: 'System', light: 'Hell', dark: 'Dunkel' };
	// Optimistic local value so the switch reacts immediately; follows the server value otherwise.
	let selected = $derived<Theme>(data.theme);

	let passwordOpen = $state(false);
	let passwordSaved = $state(false);
	let pending = $state(false);
	const pwErrors = $derived(
		form?.action === 'password' && 'errors' in form ? form.errors : undefined
	);
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
							selected === theme ? 'bg-segment shadow-sm' : 'text-label'
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

	<ListGroup
		header="Sicherheit"
		footer={passwordSaved ? 'Passwort geändert. Andere Geräte wurden abgemeldet.' : undefined}
	>
		<ListRow
			label="Passwort ändern"
			icon={KeyRound}
			iconColor="bg-[#8e8e93]"
			onclick={() => {
				passwordSaved = false;
				passwordOpen = true;
			}}
		/>
	</ListGroup>

	{#if data.user.role === 'admin'}
		<ListGroup header="Verwaltung">
			<ListRow label="Benutzer" href="einstellungen/benutzer" icon={Users} />
		</ListGroup>
	{/if}

	<LogoutButton />

	<p class="pb-4 text-center text-[13px] text-label-2">Konto Planer {__APP_VERSION__}</p>
</Page>

<Sheet
	bind:open={passwordOpen}
	title="Passwort ändern"
	confirmLabel="Sichern"
	formId="password-form"
	confirmDisabled={pending}
>
	<form
		id="password-form"
		method="POST"
		action="?/password"
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') {
					passwordOpen = false;
					passwordSaved = true;
				}
				await update();
			};
		}}
	>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Aktuelles Passwort"
				name="current"
				type="password"
				autocomplete="current-password"
				error={pwErrors?.current}
				required
			/>
		</ul>
		<ul
			class="mt-6 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Neues Passwort"
				name="password"
				type="password"
				autocomplete="new-password"
				error={pwErrors?.password}
				required
			/>
			<FormField
				label="Neues Passwort wiederholen"
				name="confirm"
				type="password"
				autocomplete="new-password"
				error={pwErrors?.confirm}
				required
			/>
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Mindestens 10 Zeichen. Andere Geräte werden danach abgemeldet.
		</p>
	</form>
</Sheet>
