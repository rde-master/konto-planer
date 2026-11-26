<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { formatDateTime } from '#lib/dates.js';
	import { formatBytes, formatDuration } from '#lib/system.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const s = $derived(data.status);
	const status = $derived(form && 'success' in form ? form.success : null);
	const message = $derived(form && 'message' in form ? form.message : null);
	let pending = $state(false);
	const row = 'flex min-h-11 items-center gap-3 px-4 py-2.5';
	const list =
		'divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card';
	const head = 'mb-1.5 px-4 text-[13px] text-label-2 uppercase';
</script>

<Page title="Systemstatus" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
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

	<section class="mb-8" aria-label="Version">
		<h2 class={head}>Version</h2>
		<ul class={list}>
			<li class={row}>
				<span class="flex-1">Konto Planer</span><span class="text-label-2">{s.version}</span>
			</li>
			<li class={row}>
				<span class="flex-1">Update</span>
				{#if s.update}
					<a href={s.update.url} class="text-accent" rel="external noopener" target="_blank">
						{s.update.latest} verfügbar
					</a>
				{:else}
					<span class="text-label-2">{s.releaseChecked ? 'aktuell' : 'nicht geprüft'}</span>
				{/if}
			</li>
			<li class={row}>
				<span class="flex-1">Läuft seit</span><span class="text-label-2">
					{formatDateTime(s.startedAt)}
				</span>
			</li>
			<li class={row}>
				<span class="flex-1">Node.js</span><span class="text-label-2">{s.node}</span>
			</li>
		</ul>
		<form method="POST" action="?/update" use:enhance class="mt-3">
			<Button type="submit" variant="tinted">Auf Update prüfen</Button>
		</form>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Fragt nur die öffentliche Release-Liste auf GitHub ab. Update: docker compose pull &amp;&amp;
			docker compose up -d.
		</p>
	</section>

	<section class="mb-8" aria-label="Hintergrundjobs">
		<h2 class={head}>Hintergrundjobs (stündlich)</h2>
		<ul class={list}>
			{#each s.jobs as j (j.job)}
				<li class="px-4 py-2.5">
					<p class="flex gap-2">
						<span class="flex-1">{j.label}</span>
						<span
							class={!j.run ? 'text-label-2' : j.run.ok === false ? 'text-danger' : 'text-income'}
						>
							{!j.run
								? 'noch nicht gelaufen'
								: j.run.ok === false
									? 'Fehler'
									: j.run.ok
										? 'OK'
										: 'läuft'}
						</span>
					</p>
					{#if j.run}
						<p class="text-[13px] text-label-2">
							{formatDateTime(j.run.startedAt)}{j.run.durationMs !== null
								? ` · ${formatDuration(j.run.durationMs)}`
								: ''}{j.run.message ? ` · ${j.run.message}` : ''}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="mb-8" aria-label="Verbindungen">
		<h2 class={head}>Verbindungen</h2>
		<ul class={list}>
			{#each s.connections as c (c.name)}
				<li class="px-4 py-2.5">
					<p class="flex gap-2">
						<span class="flex-1">{c.name}</span>
						<span class={c.ready ? 'text-income' : 'text-label-2'}>
							{c.ready ? 'eingerichtet' : 'nicht eingerichtet'}{c.extra ? ` · ${c.extra}` : ''}
						</span>
					</p>
					{#if c.last}
						<p class={['text-[13px]', c.last.ok ? 'text-label-2' : 'text-danger']}>
							Zuletzt {formatDateTime(c.last.at)}{c.last.ok
								? ' erfolgreich'
								: ` – Fehler: ${c.last.error}`}
						</p>
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<section class="mb-8" aria-label="Datenbank und Speicher">
		<h2 class={head}>Datenbank und Speicher</h2>
		<ul class={list}>
			<li class={row}>
				<span class="flex-1">PostgreSQL</span><span class="text-label-2">{s.database.version}</span>
			</li>
			<li class={row}>
				<span class="flex-1">Größe der Datenbank</span><span class="text-label-2">
					{formatBytes(s.database.size)}
				</span>
			</li>
			<li class={row}>
				<span class="flex-1">Inhalt</span>
				<span class="text-right text-label-2">
					{s.database.accounts} Konten · {s.database.items} Dauerposten · {s.database.bookings} Buchungen
					·
					{s.database.users} Benutzer
				</span>
			</li>
			<li class={row}>
				<span class="flex-1">Anhänge</span>
				<span class="text-label-2">
					{s.storage.attachments.files} Dateien · {formatBytes(s.storage.attachments.bytes)}
				</span>
			</li>
			<li class={row}>
				<span class="flex-1">Sicherungen</span>
				<span class="text-label-2">
					{s.storage.backups.files} · {formatBytes(s.storage.backups.bytes)}
				</span>
			</li>
		</ul>
	</section>

	<section class="mb-8" aria-label="Sicherungen">
		<h2 class={head}>Sicherungen</h2>
		<ul class={list}>
			{#each s.backups as b (b.name)}
				<li class={row}>
					<span class="min-w-0 flex-1">
						<span class="block truncate">{formatDateTime(b.at)}</span>
						<span class="block truncate text-[13px] text-label-2">
							{b.manual ? 'von Hand' : 'vor Update'} · {formatBytes(b.size)}
						</span>
					</span>
					<a
						href={resolve(`einstellungen/system/sicherung/${b.name}`)}
						class="text-[15px] text-accent"
						download
						data-sveltekit-reload
					>
						Laden
					</a>
				</li>
			{:else}
				<li class="px-4 py-3 text-[15px] text-label-2">Noch keine Sicherung.</li>
			{/each}
		</ul>
		<form
			method="POST"
			action="?/backup"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
			class="mt-3"
		>
			<Button type="submit" disabled={pending}>{pending ? 'Sichere …' : 'Jetzt sichern'}</Button>
		</form>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			pg_dump im Datenvolume (data/backups); die neuesten zehn bleiben. Zurückspielen mit
			pg_restore.
		</p>
	</section>
</Page>
