<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import ToggleField from '#lib/components/ToggleField.svelte';
	import SegmentedField from '#lib/components/SegmentedField.svelte';
	import { formatDateTime } from '#lib/dates.js';
	import { NOTIFICATION_LABELS } from '#lib/notify.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.settings);
	type Errors = Partial<Record<string, string>>;
	const smtpErrors = $derived<Errors | undefined>(
		form?.action === 'smtp' && 'errors' in form ? (form.errors as Errors) : undefined
	);
	const haErrors = $derived<Errors | undefined>(
		form?.action === 'ha' && 'errors' in form ? (form.errors as Errors) : undefined
	);
	const status = $derived(form && 'success' in form ? form.success : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);

	let modes = $state<Record<string, string>>({});
</script>

<Page title="Benachrichtigungen" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
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

	<section class="mb-8" aria-label="E-Mail">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">E-Mail (SMTP)</h2>
		<form
			method="POST"
			action="?/smtp"
			use:enhance={() =>
				async ({ result, update }) =>
					update({ reset: result.type === 'success' })}
		>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Server"
					name="host"
					value={s.smtpHost}
					placeholder="smtp.example.org"
					autocomplete="off"
					error={smtpErrors?.host}
				/>
				<FormField
					label="Port"
					name="port"
					value={s.smtpPort}
					inputmode="numeric"
					placeholder="587"
					autocomplete="off"
					error={smtpErrors?.port}
				/>
				<ToggleField
					label="SSL/TLS (Port 465)"
					name="secure"
					initial={s.smtpSecure}
					hint="Aus: STARTTLS, falls der Server es anbietet"
				/>
				<FormField label="Benutzer" name="user" value={s.smtpUser} autocomplete="off" />
				<FormField
					label="Passwort"
					name="password"
					type="password"
					autocomplete="new-password"
					placeholder={s.smtpPasswordSet ? 'gespeichert – leer lassen zum Behalten' : ''}
				/>
				<FormField
					label="Absender"
					name="from"
					value={s.smtpFrom}
					placeholder="Konto Planer <konto@example.org>"
					autocomplete="off"
					error={smtpErrors?.from}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Das Passwort wird verschlüsselt gespeichert.
			</p>
			<div class="mt-3"><Button type="submit">E-Mail sichern</Button></div>
		</form>
		<form method="POST" action="?/testEmail" use:enhance class="mt-3">
			<Button type="submit" variant="tinted">
				Test-E-Mail an mich{data.user.email ? ` (${data.user.email})` : ''}
			</Button>
		</form>
	</section>

	<section class="mb-8" aria-label="Home Assistant">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Home Assistant</h2>
		<form
			method="POST"
			action="?/ha"
			use:enhance={() =>
				async ({ result, update }) =>
					update({ reset: result.type === 'success' })}
		>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Adresse"
					name="url"
					value={s.haUrl}
					placeholder="http://homeassistant.local:8123"
					autocomplete="off"
					error={haErrors?.url}
				/>
				<FormField
					label="Zugriffstoken (langlebig)"
					name="token"
					type="password"
					autocomplete="off"
					placeholder={s.haTokenSet ? 'gespeichert – leer lassen zum Behalten' : ''}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Das Token legst du in Home Assistant im Profil an; es wird verschlüsselt gespeichert. Welche
				Geräte benachrichtigt werden, wählt jeder unter „Meine Benachrichtigungen“.
			</p>
			<div class="mt-3"><Button type="submit">Home Assistant sichern</Button></div>
		</form>
		<form method="POST" action="?/testHa" use:enhance class="mt-3">
			<Button type="submit" variant="tinted">Verbindung testen</Button>
		</form>
	</section>

	{#each data.rules as rule (rule.type)}
		{@const mode = modes[rule.type] ?? (rule.recipients ? 'chosen' : 'editors')}
		<section class="mb-8" aria-label="Meldungsregel {NOTIFICATION_LABELS[rule.type]}">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
				Meldung: {NOTIFICATION_LABELS[rule.type]}
			</h2>
			<form
				method="POST"
				action="?/rule"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<input type="hidden" name="type" value={rule.type} />
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<ToggleField label="Aktiv" name="enabled" initial={rule.enabled} />
					<ToggleField label="Per E-Mail" name="email" initial={rule.email} />
					<ToggleField
						label="Über Home Assistant"
						name="homeAssistant"
						initial={rule.homeAssistant}
					/>
					<SegmentedField
						name="repeat"
						label="Wiederholung"
						initial={rule.repeat}
						options={[
							{ value: 'once', label: 'Einmal' },
							{ value: 'daily', label: 'Täglich bis erledigt' }
						]}
					/>
					<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
						<label for="mode-{rule.type}" class="flex-1 text-[17px]">Empfänger</label>
						<select
							id="mode-{rule.type}"
							name="recipientMode"
							value={mode}
							onchange={(e) => (modes[rule.type] = e.currentTarget.value)}
							class="bg-transparent text-right text-[17px] text-label-2"
						>
							<option value="editors">Alle mit „bearbeiten“ am Konto</option>
							<option value="chosen">Ausgewählte</option>
						</select>
					</li>
					{#if mode === 'chosen'}
						{#each data.people as p (p.id)}
							<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
								<input
									id="r-{rule.type}-{p.id}"
									type="checkbox"
									name="recipient"
									value={p.id}
									checked={rule.recipients?.includes(p.id)}
									class="size-5 accent-[var(--kp-accent)]"
								/>
								<label for="r-{rule.type}-{p.id}" class="flex-1 text-[17px]">{p.name}</label>
								<span class="text-[13px] text-label-2">{p.email ?? 'keine E-Mail'}</span>
							</li>
						{/each}
					{/if}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Gesendet wird ab 8 Uhr, wenn die Frist abzüglich Vorlauf erreicht ist; ausgewählte
					Empfänger bekommen die Meldung nur zu Konten, die sie bearbeiten dürfen.
				</p>
				<div class="mt-3"><Button type="submit">Regel sichern</Button></div>
			</form>
		</section>
	{/each}

	<section class="mb-8" aria-label="Versand">
		<form method="POST" action="?/run" use:enhance>
			<Button type="submit" variant="tinted">Jetzt prüfen und senden</Button>
		</form>
		{#if data.log.length}
			<h2 class="mt-6 mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zuletzt verschickt</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				aria-label="Zuletzt verschickt"
			>
				{#each data.log as l (l.id)}
					<li class="px-4 py-2.5">
						<span class="block truncate">{l.title}</span>
						<span class={['block truncate text-[13px]', l.ok ? 'text-label-2' : 'text-danger']}>
							{formatDateTime(l.sentAt)} · {l.channel === 'email' ? 'E-Mail' : 'Home Assistant'} · {l.userName ??
								'–'}{l.ok ? '' : ` · Fehler: ${l.error}`}
						</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</Page>
