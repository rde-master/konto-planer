<script lang="ts">
	import { enhance } from '$app/forms';
	import Landmark from '@lucide/svelte/icons/landmark';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import AccountFields from '#lib/components/AccountFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatIban } from '#lib/iban.js';
	import { formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const account = $derived(data.account);
	const archived = $derived(account.archivedAt !== null);
	const canEdit = $derived(account.level === 'edit' && !archived);
	const Icon = $derived(account.type === 'giro' ? Landmark : PiggyBank);

	let savePending = $state(false);
	let deleteOpen = $state(false);

	const updateInput = $derived(
		form?.action === 'update' && 'input' in form ? form.input : undefined
	);
	const updateErrors = $derived(
		form?.action === 'update' && 'errors' in form ? form.errors : undefined
	);
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const status = $derived.by(() => {
		if (!form || !('success' in form)) return undefined;
		return {
			update: 'Änderungen gesichert.',
			access: 'Zugriffe gesichert.',
			archive: 'Konto archiviert. Es ist jetzt schreibgeschützt.',
			restore: 'Konto wiederhergestellt.'
		}[form.action];
	});

	const fieldValues = $derived(
		updateInput ? { ...updateInput, type: account.type } : { ...account }
	);

	const ACCESS_OPTIONS = [
		{ value: '', label: 'Kein Zugriff' },
		{ value: 'view', label: 'Sehen' },
		{ value: 'edit', label: 'Bearbeiten' }
	];
</script>

<Page title={account.name} back={{ path: 'konten', label: 'Konten' }}>
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

	<!-- Balance card -->
	<section class="mb-8 flex items-center gap-4 rounded-[var(--radius-card)] bg-card p-5">
		<span
			class="grid size-14 shrink-0 place-items-center rounded-full text-white"
			style:background-color={accountColorCss(account.color)}
		>
			<Icon class="size-7" strokeWidth={2} />
		</span>
		<div class="min-w-0">
			<p class="text-[13px] text-label-2">
				{account.type === 'giro' ? 'Girokonto' : 'Sparbuch'}{archived ? ' · archiviert' : ''}
			</p>
			<p class={['text-[28px] font-bold tabular', account.openingBalance < 0 && 'text-danger']}>
				{formatEuro(account.openingBalance)}
			</p>
			<p class="text-[13px] text-label-2">Startsaldo am {formatDay(account.openingDate)}</p>
		</div>
	</section>

	{#if canEdit}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				savePending = true;
				return async ({ update }) => {
					await update({ reset: false });
					savePending = false;
				};
			}}
		>
			<AccountFields values={fieldValues} errors={updateErrors} />
			<Button type="submit" disabled={savePending} class="mb-8">Sichern</Button>
		</form>
	{:else}
		<ListGroup
			header="Kontodaten"
			footer={archived
				? 'Archivierte Konten sind schreibgeschützt.'
				: 'Du kannst dieses Konto nur ansehen.'}
		>
			<ListRow label="IBAN" value={account.iban ? formatIban(account.iban) : '–'} />
			{#if account.type === 'giro'}
				<ListRow
					label="Dispo"
					value={account.overdraftLimit ? formatEuro(account.overdraftLimit) : 'keiner'}
				/>
			{/if}
		</ListGroup>
	{/if}

	{#if data.isAdmin}
		{#if data.access.length}
			<form
				method="POST"
				action="?/access"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<section class="mb-8">
					<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Zugriff</h2>
					<ul
						class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					>
						{#each data.access as entry (entry.userId)}
							<SelectField
								label={entry.name}
								name={`access:${entry.userId}`}
								options={ACCESS_OPTIONS}
								value={entry.level ?? ''}
							/>
						{/each}
					</ul>
					<p class="mt-1.5 px-4 text-[13px] text-label-2">
						Admins sehen und bearbeiten alle Konten. „Bearbeiten“ erlaubt Buchungen, Dauerposten und
						Kontodaten.
					</p>
				</section>
				<Button type="submit" variant="tinted" class="mb-8">Zugriffe sichern</Button>
			</form>
		{:else}
			<p class="mb-8 px-4 text-[13px] text-label-2">
				Es gibt noch keine Benutzer ohne Admin-Rolle, denen du das Konto freigeben könntest.
			</p>
		{/if}

		<ListGroup header="Verwaltung">
			{#if archived}
				<li>
					<form method="POST" action="?/restore" use:enhance>
						<button
							type="submit"
							class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-accent active:bg-fill"
						>
							Wiederherstellen
						</button>
					</form>
				</li>
			{:else}
				<li>
					<form method="POST" action="?/archive" use:enhance>
						<button
							type="submit"
							class="flex min-h-11 w-full items-center px-4 py-2.5 text-left active:bg-fill"
						>
							Archivieren
						</button>
					</form>
				</li>
			{/if}
			{#if !data.hasData}
				<ListRow label="Konto löschen" destructive onclick={() => (deleteOpen = true)} />
			{/if}
		</ListGroup>
	{/if}
</Page>

{#if data.isAdmin}
	<Sheet bind:open={deleteOpen} title="Konto löschen">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{account.name}“ wird endgültig gelöscht. Das geht nur, solange das Konto keine Buchungen oder
			Dauerposten hat.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}
