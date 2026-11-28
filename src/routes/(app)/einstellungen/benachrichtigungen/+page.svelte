<script lang="ts">
	import HelpLink from '#lib/components/HelpLink.svelte';
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Tabs from '#lib/components/Tabs.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
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
	const pushoverErrors = $derived<Errors | undefined>(
		form?.action === 'pushover' && 'errors' in form ? (form.errors as Errors) : undefined
	);
	const status = $derived(form && 'success' in form ? form.success : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);

	let modes = $state<Record<string, string>>({});

	const tabs = [
		{ id: 'email', label: 'E-Mail' },
		{ id: 'ha', label: 'Home Assistant' },
		{ id: 'pushover', label: 'Pushover' },
		{ id: 'meldungen', label: 'Meldungen' },
		{ id: 'versand', label: 'Versand' }
	];
	/** Where the form of an action stands (the page opens there after a submit without JavaScript). */
	const ACTION_TABS: Record<string, string> = {
		smtp: 'email',
		ha: 'ha',
		pushover: 'pushover',
		rule: 'meldungen',
		run: 'versand'
	};
	// svelte-ignore state_referenced_locally
	let tab = $state((form?.action ? ACTION_TABS[form.action] : undefined) ?? 'email');

	/** "E-Mail, Pushover · täglich" – what a rule does, in one line. */
	function ruleSummary(rule: (typeof data.rules)[number]) {
		if (!rule.enabled) return 'aus';
		const ways = [
			rule.email ? 'E-Mail' : null,
			rule.homeAssistant ? 'Home Assistant' : null,
			rule.push ? 'Push' : null,
			rule.pushover ? 'Pushover' : null
		].filter(Boolean);
		return `${ways.join(', ') || 'kein Weg gewählt'}${rule.repeat === 'daily' ? ' · täglich' : ''}`;
	}

	const RULE_HINTS: Record<string, string> = {
		cancel_deadline: 'Sobald die Kündigungsfrist abzüglich Vorlauf erreicht ist.',
		minimum_shortfall: 'Wenn auf einem Girokonto weniger als der Mindestbestand ist.',
		payment_missing:
			'Wenn eine vorläufige Buchung nach der Toleranz nicht durch einen Import bestätigt ist (nur Konten mit Import).',
		overdraft_reached: 'Sobald ein Girokonto im Minus steht.',
		overdraft_risk: 'Wenn der Dispo bis zum Stichtag nach Plan nicht reicht.',
		manual_transfer:
			'Für Dauerposten mit Zahlart „manuell“ (Ausgaben und Umbuchungen), den Vorlauf vor dem Bankarbeitstag; 0 = am Fälligkeitstag. Erledigt mit „Überwiesen“ in der Übersicht oder durch den Import.',
		savings_suggestion:
			'Wenn das Gehalt gebucht ist (Stichtag „Gehalt“ am Girokonto) und mindestens 10 € frei verfügbar sind.',
		credit_limit:
			'Wenn eine Kreditkarte ihren Kreditrahmen jetzt oder nach Plan in den nächsten zwei Monaten überschreitet.',
		price_increase:
			'Wenn ein Dauerposten (Ausgabe) einen höheren Betrag bekommt oder der Import eine höhere Abbuchung findet; auch angekündigte Erhöhungen.',
		new_subscription:
			'Wenn der Import eine regelmäßige Abbuchung ohne Dauerposten findet (ab der zweiten Zahlung) und du sie nicht übernommen hast.',
		import_reminder:
			'Monatlich am 30. (im Februar am Monatsletzten) für Girokonten und Kreditkarten mit Import, wenn der letzte Import älter als 14 Tage ist.'
	};
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

	<Tabs {tabs} bind:active={tab} />

	{#if tab === 'email'}
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
	{/if}

	{#if tab === 'ha'}
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
					Das Token legst du in Home Assistant im Profil an; es wird verschlüsselt gespeichert.
					Welche Geräte benachrichtigt werden, wählt jeder unter „Meine Benachrichtigungen“.
				</p>
				<div class="mt-3"><Button type="submit">Home Assistant sichern</Button></div>
			</form>
			<form method="POST" action="?/testHa" use:enhance class="mt-3">
				<Button type="submit" variant="tinted">Verbindung testen</Button>
			</form>
			<form
				method="POST"
				action="?/haSensors"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
				class="mt-6"
			>
				<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
					<ToggleField
						label="Werte als Sensoren senden"
						name="haSensors"
						initial={data.haSensors}
						hint="Stündlich: verfügbar, Stand je Konto, nächste Zahlung, Warnungen"
					/>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Erscheinen in Home Assistant als sensor.konto_planer_… (alle Konten). Alternativ liest
					Home Assistant die Werte selbst über einen API-Zugang (Einstellungen › API-Zugänge).
				</p>
				<div class="mt-3"><Button type="submit">Sichern und senden</Button></div>
			</form>
		</section>
	{/if}

	{#if tab === 'pushover'}
		<section class="mb-8" aria-label="Pushover">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Pushover</h2>
			<form
				method="POST"
				action="?/pushover"
				use:enhance={() =>
					async ({ result, update }) =>
						update({ reset: result.type === 'success' })}
			>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					<FormField
						label="API-Token der Anwendung"
						name="token"
						type="password"
						autocomplete="off"
						placeholder={s.pushoverSet ? 'gespeichert – neu eintragen zum Ersetzen' : ''}
						error={pushoverErrors?.token}
					/>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Lege auf pushover.net eine Anwendung an („Create an Application/API Token“) und trage ihr
					Token hier ein; es wird verschlüsselt gespeichert. Seinen Benutzerschlüssel trägt jeder
					unter „Meine Benachrichtigungen“ ein. Die Meldungen laufen über die Server von Pushover.
				</p>
				<div class="mt-3"><Button type="submit">Pushover sichern</Button></div>
			</form>
			{#if s.pushoverSet}
				<form method="POST" action="?/testPushover" use:enhance class="mt-3">
					<Button type="submit" variant="tinted">Pushover-Test an mich</Button>
				</form>
				<form method="POST" action="?/pushoverRemove" use:enhance class="mt-3">
					<Button type="submit" variant="destructive">Pushover entfernen</Button>
				</form>
			{/if}
		</section>
	{/if}

	{#if tab === 'meldungen'}
		<p class="kp-span mb-4 px-4 text-[13px] text-label-2">
			Tippe auf eine Meldung, um sie einzustellen. Darunter steht, ob und über welche Wege sie
			gerade verschickt wird.
		</p>

		{#each data.rules as rule (rule.type)}
			{@const mode = modes[rule.type] ?? (rule.recipients ? 'chosen' : 'editors')}
			<section class="mb-3" aria-label="Meldungsregel {NOTIFICATION_LABELS[rule.type]}">
				<details class="kp-rule">
					<summary
						class="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-[var(--radius-row)] bg-card px-4 py-2.5 active:bg-fill"
					>
						<span class="min-w-0 flex-1">
							<span class="block text-[17px]">{NOTIFICATION_LABELS[rule.type]}</span>
							<span class="block truncate text-[13px] text-label-2">{ruleSummary(rule)}</span>
						</span>
						<ChevronRight
							class="kp-rule-arrow size-5 shrink-0 text-label-3 transition-transform"
							strokeWidth={2.5}
						/>
					</summary>
					<form
						method="POST"
						action="?/rule"
						class="mt-2 mb-6"
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
							<ToggleField
								label="Push aus der Web-App"
								name="push"
								initial={rule.push}
								hint="An die Geräte, die jeder unter „Meine Benachrichtigungen“ anmeldet"
							/>
							<ToggleField
								label="Über Pushover"
								name="pushover"
								initial={rule.pushover}
								hint="An alle, die ihren Benutzerschlüssel eingetragen haben"
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
							{#if rule.type === 'manual_transfer'}
								<FormField
									label="Vorlauf (Bankarbeitstage)"
									name="leadDays"
									value={String(rule.leadDays)}
									inputmode="numeric"
									autocomplete="off"
								/>
							{/if}
							{#if rule.type === 'payment_missing'}
								<FormField
									label="Als ausgeblieben nach (Tagen)"
									name="toleranceDays"
									value={String(rule.toleranceDays)}
									inputmode="numeric"
									autocomplete="off"
								/>
							{/if}
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
							{RULE_HINTS[rule.type]} Gesendet wird ab 8 Uhr; ausgewählte Empfänger bekommen die Meldung
							nur zu Konten, die sie bearbeiten dürfen.
						</p>
						<div class="mt-3"><Button type="submit">Regel sichern</Button></div>
					</form>
				</details>
			</section>
		{/each}

		<HelpLink chapter="benachrichtigungen" anchor="meldungen" label="Hilfe zu Meldungen" />
	{/if}

	{#if tab === 'versand'}
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
								{formatDateTime(l.sentAt)} · {l.channel === 'email'
									? 'E-Mail'
									: l.channel === 'push'
										? 'Push'
										: l.channel === 'pushover'
											? 'Pushover'
											: 'Home Assistant'} · {l.userName ?? '–'}{l.ok ? '' : ` · Fehler: ${l.error}`}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</Page>

<style>
	/* The arrow of an open rule points down; the browser's own marker is not shown. */
	.kp-rule > summary::-webkit-details-marker {
		display: none;
	}
	.kp-rule[open] :global(.kp-rule-arrow) {
		transform: rotate(90deg);
	}
</style>
