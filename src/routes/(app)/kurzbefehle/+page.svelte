<script lang="ts">
	import { enhance } from '$app/forms';
	import Smartphone from '@lucide/svelte/icons/smartphone';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import HelpLink from '#lib/components/HelpLink.svelte';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const token = $derived(form && 'token' in form ? form.token : null);
	const status = $derived(form && 'success' in form ? form.success : null);
	const message = $derived(form && 'message' in form ? form.message : null);
	/** What goes into the "Authorization" header of the shortcut. */
	const header = $derived(token ? `Bearer ${token}` : 'Bearer …');
	let copied = $state<string | null>(null);

	async function copy(text: string, what: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = what;
		} catch {
			copied = null;
		}
	}
</script>

{#snippet value(label: string, text: string, what: string, testid: string)}
	<div class="px-4 py-2.5">
		<p class="text-[13px] text-label-2">{label}</p>
		<p class="font-mono text-[13px] break-all" data-testid={testid}>{text}</p>
		<button
			type="button"
			class="kp-text-button mt-1 text-[15px] text-accent"
			onclick={() => copy(text, what)}
		>
			{copied === what ? 'Kopiert' : `${label} kopieren`}
		</button>
	</div>
{/snippet}

<Page title="iOS Kurzbefehle" layout="narrow">
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

	<p class="mb-6 px-4 text-[15px] text-label-2">
		Mit einem Kurzbefehl buchst du am iPhone, ohne die App zu öffnen: Betrag eintippen, fertig – vom
		Home-Bildschirm, mit der Aktionstaste oder per Siri. Dafür braucht der Kurzbefehl einen eigenen
		Zugang; den legst du hier an und baust den Kurzbefehl dann nach der Anleitung unten.
	</p>

	{#if token}
		<section class="mb-8" aria-label="Neuer Zugang">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Dein neuer Zugang</h2>
			<div
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{@render value('Adresse', data.url, 'url', 'shortcut-url')}
				{@render value('Kopfzeile', header, 'header', 'shortcut-header')}
			</div>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Die Kopfzeile enthält den Zugang und wird <strong>nur jetzt</strong> angezeigt. Kopiere sie gleich
				in den Kurzbefehl (Schritt 3) und gib sie nicht weiter. Verloren? Dann lege einfach einen neuen
				Zugang an und widerrufe den alten.
			</p>
		</section>
	{/if}

	<section class="mb-8" aria-label="Zugänge">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Meine Kurzbefehl-Zugänge</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each data.shortcuts as s (s.id)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2" aria-label={s.name}>
					<span class="min-w-0 flex-1">
						<span class="block truncate">{s.name}</span>
						<span class="block truncate text-[13px] text-label-2">
							{s.account ? `bucht auf ${s.account}` : 'Konto nicht mehr verfügbar'} · {s.lastUsedAt
								? `zuletzt ${formatDateTime(s.lastUsedAt)}`
								: 'noch nicht benutzt'}
						</span>
					</span>
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="id" value={s.id} />
						<button type="submit" class="kp-text-button text-[15px] text-danger">Widerrufen</button>
					</form>
				</li>
			{:else}
				<li class="flex items-center gap-3 px-4 py-3 text-[15px] text-label-2">
					<Smartphone class="size-5 shrink-0" />
					Noch kein Zugang für einen Kurzbefehl.
				</li>
			{/each}
		</ul>
	</section>

	{#if data.accounts.length}
		<form
			method="POST"
			action="?/create"
			class="mb-8"
			use:enhance={() =>
				async ({ result, update }) =>
					update({ reset: result.type === 'success' })}
		>
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zugang anlegen</h2>
			<ul
				class="mb-4 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Name"
					name="name"
					placeholder="z. B. Mein iPhone"
					maxlength={60}
					autocomplete="off"
				/>
				<SelectField
					label="Bucht auf"
					name="defaultAccountId"
					value={data.accounts[0]?.value ?? ''}
					options={data.accounts}
				/>
			</ul>
			<Button type="submit">Zugang anlegen</Button>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Der Zugang darf nur buchen und die Auswahlliste lesen. Gebucht wird am heutigen Tag auf
				dieses Konto – oder auf das Konto einer gewählten Vorlage.
			</p>
		</form>
	{:else}
		<p class="mb-8 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
			Du brauchst ein Konto, auf das du buchen darfst, um einen Kurzbefehl einzurichten.
		</p>
	{/if}

	<section class="mb-8" aria-label="Anleitung: nur Betrag">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
			Anleitung: Kurzbefehl „Ausgabe buchen“
		</h2>
		<div class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			<p class="mb-2 text-label-2">
				Die einfache Fassung fragt nur nach dem Betrag. Die Kategorie setzt die App über deine
				Regeln („Immer so einordnen“), sonst bleibt die Buchung ohne Kategorie.
			</p>
			<ol class="list-decimal space-y-2 pl-5">
				<li>
					App <strong>Kurzbefehle</strong> öffnen, oben rechts auf <strong>+</strong> tippen und den Kurzbefehl
					benennen, z. B. „Ausgabe buchen“.
				</li>
				<li>
					Aktion <strong>Nach Eingabe fragen</strong> hinzufügen: Eingabetyp <strong>Zahl</strong>,
					Frage z. B. „Betrag?“.
				</li>
				<li>
					Aktion <strong>Inhalte von URL abrufen</strong> hinzufügen. Als URL die
					<strong>Adresse</strong> von oben einfügen, dann den Pfeil daneben aufklappen:
					<ul class="mt-1 list-disc space-y-1 pl-5 text-label-2">
						<li>Methode: <strong>POST</strong></li>
						<li>
							Header: neuer Header mit Schlüssel <code>Authorization</code> und als Wert die
							<strong>Kopfzeile</strong> von oben („Bearer …“)
						</li>
						<li>
							Haupttext der Anfrage: <strong>JSON</strong>, neues Feld vom Typ Text mit Schlüssel
							<code>amount</code>; als Wert die Variable <strong>Bereitgestellte Eingabe</strong>
							wählen
						</li>
					</ul>
				</li>
				<li>
					Aktion <strong>Wörterbuchwert abrufen</strong>: Wert für den Schlüssel
					<code>message</code> aus „Inhalt der URL“.
				</li>
				<li>
					Aktion <strong>Mitteilung anzeigen</strong> (oder „Ergebnis anzeigen“) mit dem Wörterbuchwert
					– dort steht dann z. B. „12,80 € Supermarkt gebucht · verfügbar 412,00 €“.
				</li>
			</ol>
			<p class="mt-3 text-[13px] text-label-2">
				Die Namen der Aktionen können je nach iOS-Version leicht abweichen. Eine Einnahme buchst du
				mit einem „+“ vor dem Betrag (dafür in Schritt 2 den Eingabetyp „Text“ wählen).
			</p>
		</div>
	</section>

	<section class="mb-8" aria-label="Anleitung: mit Auswahl">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
			Erweitert: Vorlage oder Kategorie wählen
		</h2>
		<div class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			<p class="mb-2 text-label-2">
				Soll der Kurzbefehl nach Vorlage oder Kategorie fragen, kommen vor Schritt 2 drei Aktionen
				dazu:
			</p>
			<ol class="list-decimal space-y-2 pl-5">
				<li>
					<strong>Inhalte von URL abrufen</strong> mit derselben Adresse und demselben Header,
					Methode <strong>GET</strong>.
				</li>
				<li>
					<strong>Wörterbuchwert abrufen</strong>: Wert für den Schlüssel <code>options</code>.
				</li>
				<li>
					<strong>Aus Liste auswählen</strong> – die Liste zeigt deine Vorlagen („Vorlage: Bäcker“) und
					Kategorien.
				</li>
			</ol>
			<p class="mt-2 text-label-2">
				Im JSON der Buchung (Schritt 3 oben) dann ein zweites Feld <code>choice</code> mit der
				Variable <strong>Ausgewähltes Objekt</strong> ergänzen. Optional nimmt
				<code>payee</code> einen Empfänger auf. Eine Vorlage bringt Konto, Kategorie und Empfänger mit.
			</p>
		</div>
	</section>

	<section class="mb-8" aria-label="Tipps">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Schnell starten</h2>
		<ul
			class="list-disc space-y-1.5 rounded-[var(--radius-row)] bg-card py-3 pr-4 pl-9 text-[15px]"
		>
			<li>
				<strong>Home-Bildschirm:</strong> im Kurzbefehl auf den Namen tippen › „Zum Home-Bildschirm“.
			</li>
			<li>
				<strong>Aktionstaste</strong> (iPhone 15 Pro und neuer): Einstellungen › Aktionstaste › Kurzbefehl.
			</li>
			<li><strong>Siri:</strong> „Hey Siri, Ausgabe buchen“ – der Name ist das Kommando.</li>
			<li>
				<strong>Auf Rückseite tippen:</strong> Einstellungen › Bedienungshilfen › Tippen › Auf Rückseite
				tippen.
			</li>
		</ul>
	</section>

	<section class="mb-4" aria-label="Fertiger Kurzbefehl">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">
			Warum gibt es keinen fertigen Kurzbefehl zum Laden?
		</h2>
		<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
			iOS nimmt nur Kurzbefehle an, die Apple signiert hat – über einen iCloud-Link oder von einem
			Mac aus. Eine Datei, die dein eigener Server erzeugt, lehnt das iPhone ab. Außerdem müsste sie
			deinen Zugang enthalten. Deshalb baust du den Kurzbefehl einmal von Hand; mit den Knöpfen zum
			Kopieren oben sind es fünf Aktionen.
		</p>
	</section>

	<HelpLink
		chapter="widgets-und-mehr"
		anchor="schnellerfassung-per-kurzbefehl"
		label="Mehr zum Kurzbefehl in der Hilfe"
	/>
</Page>
