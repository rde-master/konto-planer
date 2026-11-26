<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { TOKEN_PURPOSES, TOKEN_PURPOSE_LABELS, type TokenPurpose } from '#lib/api.js';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const created = $derived(form && 'token' in form ? form : null);
	const status = $derived(form && 'success' in form ? form.success : null);
	const message = $derived(form && 'message' in form ? form.message : null);
	let scope = $state('all');
	let purpose = $state('home_assistant');
	let copied = $state<string | null>(null);

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
		} catch {
			copied = null;
		}
	}
	const label = (p: string) => TOKEN_PURPOSE_LABELS[p as TokenPurpose] ?? p;
</script>

<Page title="API-Zugänge" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
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

	{#if created}
		<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Neues Token">
			<p class="mb-2 text-[17px] font-semibold">Dein Token</p>
			<p class="mb-2 font-mono text-[13px] break-all" data-testid="api-token">{created.token}</p>
			<p class="mb-3 text-[13px] text-label-2">
				Wird nur jetzt angezeigt. Abfrage: <span class="break-all">{created.endpoint}</span> mit dem Kopf
				„Authorization: Bearer …“.
			</p>
			<Button type="button" variant="tinted" onclick={() => copy(created.token ?? '', 'token')}>
				{copied === 'token' ? 'Kopiert' : 'Token kopieren'}
			</Button>
			{#if created.shortcutUrl}
				<div class="mt-4" aria-label="Kurzbefehl einrichten">
					<p class="mb-2 text-[15px] font-semibold">Kurzbefehl einrichten (App „Kurzbefehle“)</p>
					<ol class="mb-3 list-decimal space-y-1 pl-5 text-[13px] text-label-2">
						<li>
							Neuer Kurzbefehl › „Inhalte von URL abrufen“: URL unten, Methode GET, Header
							„Authorization“ = „Bearer “ + Token.
						</li>
						<li>„Wörterbuchwert abrufen“ für „options“, dann „Aus Liste wählen“.</li>
						<li>„Nach Eingabe fragen“ (Zahl) für den Betrag; Einnahmen mit „+“ davor.</li>
						<li>
							„Inhalte von URL abrufen“: dieselbe URL, Methode POST, Header wie oben, JSON-Text mit
							„amount“ (Betrag) und „choice“ (gewählter Eintrag), optional „payee“.
						</li>
						<li>„Wörterbuchwert abrufen“ für „message“ und „Mitteilung anzeigen“.</li>
					</ol>
					<p class="mb-2 font-mono text-[12px] break-all" data-testid="shortcut-url">
						{created.shortcutUrl}
					</p>
					<Button
						type="button"
						variant="tinted"
						onclick={() => copy(created.shortcutUrl ?? '', 'url')}
					>
						{copied === 'url' ? 'Kopiert' : 'URL kopieren'}
					</Button>
					<p class="mt-2 text-[13px] text-label-2">
						Gebucht wird heute; Konto und Empfänger kommen aus der Vorlage, sonst aus „Bucht auf“.
					</p>
				</div>
			{/if}
			{#if created.yaml}
				<p class="mt-4 mb-2 text-[15px] font-semibold">Für Home Assistant (configuration.yaml)</p>
				<pre
					class="mb-3 overflow-x-auto rounded-[var(--radius-row)] bg-fill p-3 text-[12px]"
					data-testid="ha-yaml">{created.yaml}</pre>
				<Button type="button" variant="tinted" onclick={() => copy(created.yaml ?? '', 'yaml')}>
					{copied === 'yaml' ? 'Kopiert' : 'YAML kopieren'}
				</Button>
			{/if}
		</section>
	{/if}

	<section class="mb-8" aria-label="Zugänge">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zugänge</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each data.tokens as t (t.id)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2" aria-label={t.name}>
					<span class="min-w-0 flex-1">
						<span class="block truncate">{t.name}</span>
						<span class="block truncate text-[13px] text-label-2">
							{label(t.purpose)} · {t.accounts ? t.accounts.join(', ') : 'alle Konten'} · {t.lastUsedAt
								? `zuletzt ${formatDateTime(t.lastUsedAt)}`
								: 'noch nicht benutzt'}
						</span>
					</span>
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="id" value={t.id} />
						<button type="submit" class="text-[15px] text-danger">Widerrufen</button>
					</form>
				</li>
			{:else}
				<li class="px-4 py-3 text-[15px] text-label-2">Noch kein Zugang.</li>
			{/each}
		</ul>
	</section>

	<form
		method="POST"
		action="?/create"
		use:enhance={() =>
			async ({ result, update }) =>
				update({ reset: result.type === 'success' })}
	>
		<section class="mb-6">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Neuer Zugang</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Name"
					name="name"
					placeholder="z. B. Home Assistant"
					maxlength={60}
					autocomplete="off"
				/>
				<SelectField
					label="Zweck"
					name="purpose"
					value={purpose}
					onchange={(v: string) => {
						purpose = v;
					}}
					options={TOKEN_PURPOSES.map((p) => ({ value: p, label: TOKEN_PURPOSE_LABELS[p] }))}
				/>
				{#if purpose === 'shortcut'}
					<SelectField
						label="Bucht auf"
						name="defaultAccountId"
						value={data.bookingAccounts[0]?.value ?? ''}
						options={data.bookingAccounts}
					/>
				{/if}
				<SelectField
					label="Konten"
					name="scope"
					value={scope}
					onchange={(v: string) => {
						scope = v;
					}}
					options={[
						{ value: 'all', label: 'Alle meine Konten' },
						{ value: 'chosen', label: 'Ausgewählte' }
					]}
				/>
				{#if scope === 'chosen'}
					{#each data.accounts as a (a.id)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
							<input
								id="acc-{a.id}"
								type="checkbox"
								name="account"
								value={a.id}
								class="size-5 accent-[var(--kp-accent)]"
							/>
							<label for="acc-{a.id}" class="flex-1 text-[17px]">{a.name}</label>
						</li>
					{/each}
				{/if}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Nur lesend: Kontostände, verfügbar und Mindestbestand, nächste Zahlungen, Budgets und
				Warnungen. Das Token wird nur als Hash gespeichert und lässt sich jederzeit widerrufen.
			</p>
		</section>
		<Button type="submit">Zugang anlegen</Button>
	</form>
</Page>
