<script lang="ts">
	import { enhance } from '$app/forms';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import { formatDateTime } from '#lib/dates.js';
	import { TRASH_DAYS, TRASH_TYPE_LABELS, daysLeft, type TrashType } from '#lib/trash.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let emptyOpen = $state(false);

	function typeLabel(t: string) {
		return TRASH_TYPE_LABELS[t as TrashType] ?? t;
	}
</script>

<Page title="Papierkorb" back={{ path: 'mehr', label: 'Mehr' }}>
	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{:else if form && 'restored' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			„{form.restored}“ ist wiederhergestellt.
		</p>
	{:else if form && 'purged' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Endgültig gelöscht.
		</p>
	{/if}

	{#if data.items.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Trash2 class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Der Papierkorb ist leer</p>
			<p class="mt-1 text-[15px] text-label-2">
				Gelöschte Buchungen, Dauerposten, Kategorien, Sparziele, Vorlagen, Tags und Regeln lassen
				sich hier {TRASH_DAYS} Tage lang wiederherstellen.
			</p>
		</div>
	{:else}
		<section class="mb-8" aria-label="Gelöscht">
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.items as item (item.id)}
					<li class="flex items-center gap-3 px-4 py-2.5" aria-label={item.label}>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[17px]">{item.label}</span>
							<span class="block truncate text-[13px] text-label-2">
								{typeLabel(item.entityType)} · gelöscht {formatDateTime(
									item.deletedAt
								)}{data.isAdmin && item.deletedByName ? ` von ${item.deletedByName}` : ''} · noch {daysLeft(
									item.deletedAt
								)} Tage
							</span>
						</span>
						{#if item.canRestore}
							<form method="POST" action="?/restore" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<button
									type="submit"
									class="kp-text-button text-[15px] text-accent active:opacity-60"
									aria-label="{item.label} wiederherstellen"
								>
									Wiederherstellen
								</button>
							</form>
						{/if}
						{#if data.isAdmin}
							<form method="POST" action="?/purge" use:enhance>
								<input type="hidden" name="id" value={item.id} />
								<button
									type="submit"
									class="kp-text-button text-[15px] text-danger active:opacity-60"
									aria-label="{item.label} endgültig löschen"
								>
									Löschen
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Nach {TRASH_DAYS} Tagen wird Gelöschtes endgültig entfernt.
			</p>
		</section>
		{#if data.isAdmin}
			<Button
				type="button"
				variant="tinted"
				class="!text-danger"
				onclick={() => (emptyOpen = true)}
			>
				Papierkorb leeren
			</Button>
		{/if}
	{/if}
</Page>

{#if data.isAdmin}
	<Sheet bind:open={emptyOpen} title="Papierkorb leeren">
		<p class="mb-6 px-4 text-center text-[15px]">
			Alle Einträge werden endgültig gelöscht und lassen sich nicht mehr wiederherstellen.
		</p>
		<form
			method="POST"
			action="?/purge"
			use:enhance={() =>
				async ({ update }) => {
					emptyOpen = false;
					await update();
				}}
		>
			<Button type="submit" variant="destructive">Leeren</Button>
		</form>
	</Sheet>
{/if}
