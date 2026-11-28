<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import PushSetup from '#lib/components/PushSetup.svelte';
	import ToggleField from '#lib/components/ToggleField.svelte';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Page title="Meine Benachrichtigungen" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{:else if form && 'success' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{form.success}
		</p>
	{/if}

	<ListGroup
		header="E-Mail"
		footer={data.smtpReady
			? 'Die Adresse trägt der Admin unter „Benutzer“ ein.'
			: 'Der E-Mail-Versand ist noch nicht eingerichtet.'}
	>
		<ListRow label="Adresse" value={data.email ?? 'keine'} />
	</ListGroup>

	<section class="mb-8" aria-label="Monatsbericht">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Monatsbericht</h2>
		<form
			method="POST"
			action="?/report"
			use:enhance={() =>
				async ({ update }) =>
					update({ reset: false })}
		>
			<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<ToggleField
					label="Monatsbericht per E-Mail"
					name="monthlyReport"
					initial={data.monthlyReport}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Am 1. eines Monats ab 8 Uhr: Einnahmen, Ausgaben, Kategorien, größte Posten, Budgets,
				Kontostände, Sparquote, Preiserhöhungen und anstehende Kündigungsfristen des Vormonats – für
				die Konten, die du siehst.
			</p>
			<div class="mt-3"><Button type="submit">Sichern</Button></div>
		</form>
		{#if data.smtpReady && data.email}
			<form method="POST" action="?/reportNow" use:enhance class="mt-3">
				<Button type="submit" variant="tinted">Bericht für den Vormonat jetzt senden</Button>
			</form>
		{/if}
	</section>

	<section class="mb-8" aria-label="Push">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Push aus der Web-App</h2>
		<PushSetup publicKey={data.vapidPublicKey} />
		{#if data.devices.length}
			<ul
				class="mt-4 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				aria-label="Meine Push-Geräte"
			>
				{#each data.devices as d (d.id)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2">
						<span class="min-w-0 flex-1">
							<span class="block truncate">{d.label}</span>
							<span class="block truncate text-[13px] text-label-2">
								angemeldet {formatDateTime(d.createdAt)}{d.lastSentAt
									? ` · zuletzt ${formatDateTime(d.lastSentAt)}`
									: ''}
							</span>
						</span>
						<form method="POST" action="?/removeDevice" use:enhance>
							<input type="hidden" name="id" value={d.id} />
							<button
								type="submit"
								class="kp-text-button text-[15px] text-danger"
								aria-label="{d.label} entfernen"
							>
								Entfernen
							</button>
						</form>
					</li>
				{/each}
			</ul>
			<form method="POST" action="?/testPush" use:enhance class="mt-3">
				<Button type="submit" variant="tinted">Push-Test an meine Geräte</Button>
			</form>
		{/if}
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Welche Meldungen per Push kommen, legt der Admin je Meldungsregel fest. Antippen öffnet die
			passende Seite.
		</p>
	</section>

	<section class="mb-8" aria-label="Pushover">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Pushover</h2>
		{#if !data.pushoverReady}
			<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
				Pushover ist noch nicht eingerichtet.
			</p>
		{:else}
			<form
				method="POST"
				action="?/pushoverKey"
				use:enhance={() =>
					async ({ result, update }) =>
						update({ reset: result.type === 'success' })}
			>
				<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
					<FormField
						label="Benutzerschlüssel (User Key)"
						name="key"
						type="password"
						autocomplete="off"
						placeholder={data.pushoverKeySet ? 'gespeichert – neu eintragen zum Ersetzen' : ''}
					/>
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Den Schlüssel findest du in der Pushover-App und auf pushover.net („Your User Key“); er
					wird verschlüsselt gespeichert. Welche Meldungen über Pushover kommen, legt der Admin je
					Meldungsregel fest.
				</p>
				<div class="mt-3"><Button type="submit">Schlüssel sichern</Button></div>
			</form>
			{#if data.pushoverKeySet}
				<form method="POST" action="?/testPushover" use:enhance class="mt-3">
					<Button type="submit" variant="tinted">Pushover-Test an mich</Button>
				</form>
				<form method="POST" action="?/pushoverKeyRemove" use:enhance class="mt-3">
					<Button type="submit" variant="destructive">Schlüssel entfernen</Button>
				</form>
			{/if}
		{/if}
	</section>

	<section class="mb-8" aria-label="Home Assistant">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Home Assistant</h2>
		{#if !data.haReady}
			<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
				Home Assistant ist noch nicht eingerichtet.
			</p>
		{:else}
			{#if data.haError}
				<p class="mb-3 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger">
					{data.haError}
				</p>
			{/if}
			<form
				method="POST"
				action="?/targets"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					aria-label="Geräte"
				>
					{#each data.services as service (service)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
							<input
								id="t-{service}"
								type="checkbox"
								name="target"
								value={service}
								checked={data.targets.includes(service)}
								class="size-5 accent-[var(--kp-accent)]"
							/>
							<label for="t-{service}" class="flex-1 text-[17px]">{service}</label>
						</li>
					{:else}
						<li class="px-4 py-3 text-[15px] text-label-2">
							Home Assistant meldet keine Benachrichtigungsdienste.
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Die Dienste heißen meist „mobile_app_…“ nach deinem Handy (Home-Assistant-App).
				</p>
				<div class="mt-3"><Button type="submit">Geräte sichern</Button></div>
			</form>
			<form method="POST" action="?/test" use:enhance class="mt-3">
				<Button type="submit" variant="tinted">Testnachricht senden</Button>
			</form>
		{/if}
	</section>
</Page>
