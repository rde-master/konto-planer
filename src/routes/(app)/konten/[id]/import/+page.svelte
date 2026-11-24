<script lang="ts">
	import { enhance } from '$app/forms';
	import FileUp from '@lucide/svelte/icons/file-up';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import { formatIban } from '#lib/iban.js';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
	let undoOpen = $state(false);
	const undoable = $derived(data.recent.find((r) => r.id === data.undoable));
</script>

<Page title="Import" back={{ path: `konten/${data.account.id}`, label: data.account.name }}>
	{#if form && 'undone' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Import zurückgenommen.
		</p>
	{/if}
	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{/if}

	{#if data.reason}
		<p class="mb-8 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">{data.reason}</p>
	{:else}
		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			class="mb-8"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
		>
			<div class="rounded-[var(--radius-card)] bg-card px-5 py-6 text-center">
				<FileUp class="mx-auto mb-3 size-10 text-accent" />
				<p class="text-[17px] font-semibold">Bankexport hochladen</p>
				<p class="mt-1 text-[15px] text-label-2">
					CSV-Datei der Volksbank (Semikolon) für {data.account.name}, IBAN
					{formatIban(data.account.iban ?? '')}. Zeichensatz, Datums- und Zahlenformat erkennt die
					App selbst; vor dem Speichern siehst du eine Vorschau.
				</p>
				<label class="mt-4 block">
					<span class="sr-only">CSV-Datei</span>
					<input
						type="file"
						name="file"
						accept=".csv,text/csv"
						required
						class="block w-full text-[15px] file:mr-3 file:rounded-full file:border-0 file:bg-fill file:px-4 file:py-2 file:text-accent"
					/>
				</label>
			</div>
			<div class="mt-4">
				<Button type="submit" disabled={pending}>Vorschau zeigen</Button>
			</div>
		</form>
	{/if}

	{#if data.recent.length}
		<section class="mb-8" aria-label="Letzte Importe">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Letzte Importe</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.recent as r (r.id)}
					<li class="px-4 py-2.5">
						<span class="block truncate text-[17px]">{r.fileName}</span>
						<span class="block text-[13px] text-label-2">
							{r.completedAt ? formatDateTime(r.completedAt) : ''} · {r.newCount} neu · {r.matchedCount}
							ersetzt · {r.skippedCount} übersprungen
						</span>
						{#if r.undoneAt}
							<span class="block text-[13px] text-label-2">rückgängig gemacht</span>
						{/if}
					</li>
				{/each}
			</ul>
			{#if undoable}
				<div class="mt-4">
					<Button type="button" variant="tinted" onclick={() => (undoOpen = true)}>
						Letzten Import rückgängig machen
					</Button>
				</div>
			{/if}
		</section>
	{/if}
</Page>

{#if undoable}
	<Sheet bind:open={undoOpen} title="Import rückgängig">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{undoable.fileName}“ wird zurückgenommen: seine Buchungen und Gegenbuchungen verschwinden,
			ersetzte vorläufige und manuelle Buchungen, aufgelöste Anpassungen und übernommene Beträge
			kommen zurück, beim Import angelegte Dauerposten werden gelöscht.
		</p>
		<form
			method="POST"
			action="?/undo"
			use:enhance={() =>
				async ({ update }) => {
					undoOpen = false;
					await update();
				}}
		>
			<input type="hidden" name="importId" value={undoable.id} />
			<Button type="submit" variant="destructive">Rückgängig machen</Button>
		</form>
	</Sheet>
{/if}
