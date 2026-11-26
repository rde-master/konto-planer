<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { CALENDAR_KINDS, CALENDAR_KIND_LABELS } from '#lib/ical.js';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const link = $derived(form && 'link' in form ? form.link : null);
	const status = $derived(form && 'success' in form ? form.success : null);
	const included = $derived(new Set<string>(data.feed?.include ?? CALENDAR_KINDS));
	let copied = $state(false);

	async function copy() {
		if (!link) return;
		try {
			await navigator.clipboard.writeText(link);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<Page title="Kalender-Abo" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	{#if status}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{status}
		</p>
	{/if}

	{#if link}
		<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Abo-Link">
			<p class="mb-2 text-[17px] font-semibold">Dein Abo-Link</p>
			<p class="mb-3 text-[13px] break-all text-label-2" data-testid="calendar-link">{link}</p>
			<div class="flex flex-col gap-2">
				<Button
					type="button"
					onclick={() => (window.location.href = (link ?? '').replace(/^https?:/, 'webcal:'))}
				>
					Im Kalender abonnieren
				</Button>
				<Button type="button" variant="tinted" onclick={copy}>
					{copied ? 'Kopiert' : 'Link kopieren'}
				</Button>
			</div>
			<p class="mt-3 text-[13px] text-label-2">
				Der Link wird nur jetzt angezeigt. Wer ihn kennt, sieht deine Termine samt Beträgen – gib
				ihn nicht weiter. Am iPhone: Einstellungen › Kalender › Accounts › Account hinzufügen ›
				Andere › Kalenderabo hinzufügen.
			</p>
		</section>
	{/if}

	<form
		method="POST"
		action={data.feed ? '?/save' : '?/create'}
		use:enhance={() =>
			async ({ update }) =>
				update({ reset: false })}
	>
		<section class="mb-6">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Inhalt</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each CALENDAR_KINDS as kind (kind)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
						<input
							id="k-{kind}"
							type="checkbox"
							name="include"
							value={kind}
							checked={included.has(kind)}
							class="size-5 accent-[var(--kp-accent)]"
						/>
						<label for="k-{kind}" class="flex-1 text-[17px]">{CALENDAR_KIND_LABELS[kind]}</label>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Für die Konten, die du siehst, von drei Monaten zurück bis zwölf Monate voraus;
				Kündigungsfristen mit Erinnerung zum Vorlauf. Der Kalender aktualisiert sich etwa alle sechs
				Stunden.
			</p>
		</section>
		<Button type="submit">{data.feed ? 'Inhalt sichern' : 'Abo-Link erzeugen'}</Button>
	</form>

	{#if data.feed}
		<p class="mt-6 px-4 text-[13px] text-label-2">
			Link erzeugt am {formatDateTime(data.feed.createdAt)}{data.feed.lastFetchedAt
				? `, zuletzt abgerufen ${formatDateTime(data.feed.lastFetchedAt)}`
				: ', noch nicht abgerufen'}.
		</p>
		<form method="POST" action="?/create" use:enhance class="mt-3">
			{#each [...included] as kind (kind)}<input type="hidden" name="include" value={kind} />{/each}
			<Button type="submit" variant="tinted">Neuen Link erzeugen</Button>
		</form>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Der bisherige Link funktioniert dann nicht mehr.
		</p>
		<form method="POST" action="?/delete" use:enhance class="mt-3">
			<Button type="submit" variant="destructive">Abo beenden</Button>
		</form>
	{/if}
</Page>
