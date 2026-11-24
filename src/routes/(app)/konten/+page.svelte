<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import Landmark from '@lucide/svelte/icons/landmark';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import AccountFields from '#lib/components/AccountFields.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { shortIban } from '#lib/iban.js';
	import { todayBerlin } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let createOpen = $state(false);
	let pending = $state(false);
	let formKey = $state(0);

	const active = $derived(data.accounts.filter((a) => !a.archivedAt));
	const groups = $derived([
		{ title: 'Girokonten', items: active.filter((a) => a.type === 'giro') },
		{ title: 'Sparbücher', items: active.filter((a) => a.type === 'sparbuch') },
		{ title: 'Archiviert', items: data.accounts.filter((a) => a.archivedAt) }
	]);

	const emptyValues = () => ({
		name: '',
		type: 'giro' as const,
		color: 'blue',
		iban: '',
		openingBalance: '',
		openingDate: todayBerlin(),
		overdraftLimit: '',
		buffer: ''
	});
	const formValues = $derived(
		form && 'input' in form && form.input
			? {
					...form.input,
					type: form.input.type === 'sparbuch' ? ('sparbuch' as const) : ('giro' as const)
				}
			: emptyValues()
	);
	const formErrors = $derived(form && 'errors' in form ? form.errors : undefined);
</script>

<Page title="Konten">
	{#snippet actions()}
		{#if data.isAdmin}
			<button
				type="button"
				aria-label="Konto anlegen"
				onclick={() => {
					formKey++;
					createOpen = true;
				}}
				class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
			>
				<Plus class="size-6" strokeWidth={2.2} />
			</button>
		{/if}
	{/snippet}

	{#if form && 'created' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Konto „{form.created}“ wurde angelegt.
		</p>
	{/if}

	{#if data.accounts.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<p class="text-[17px] font-semibold">Noch keine Konten</p>
			<p class="mt-1 text-[15px] text-label-2">
				{data.isAdmin
					? 'Lege mit „+“ dein erstes Konto an.'
					: 'Dir wurde noch kein Konto freigegeben. Frag den Admin.'}
			</p>
		</div>
	{/if}

	{#each groups as group (group.title)}
		{#if group.items.length}
			<section class="mb-8">
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{group.title}</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each group.items as account (account.id)}
						{@const Icon = account.type === 'giro' ? Landmark : PiggyBank}
						<li>
							<a
								href={resolve(`konten/${account.id}`)}
								class={[
									'flex min-h-16 items-center gap-3 px-4 py-2.5 active:bg-fill',
									account.archivedAt && 'opacity-60'
								]}
							>
								<span
									class="grid size-10 shrink-0 place-items-center rounded-full text-white"
									style:background-color={accountColorCss(account.color)}
								>
									<Icon class="size-5" strokeWidth={2.2} />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[17px]">{account.name}</span>
									<span class="block truncate text-[13px] text-label-2">
										{[
											account.available !== null
												? `verfügbar ${formatEuro(account.available)}`
												: null,
											account.iban ? shortIban(account.iban) : null,
											account.level === 'view' ? 'Nur ansehen' : null
										]
											.filter(Boolean)
											.join(' · ') || (account.type === 'giro' ? 'Girokonto' : 'Sparbuch')}
									</span>
								</span>
								<span
									class={['shrink-0 text-[17px] tabular', account.balance < 0 && 'text-danger']}
								>
									{formatEuro(account.balance)}
								</span>
								<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/each}
</Page>

{#if data.isAdmin}
	<Sheet
		bind:open={createOpen}
		title="Neues Konto"
		confirmLabel="Anlegen"
		formId="create-account"
		confirmDisabled={pending}
	>
		<form
			id="create-account"
			method="POST"
			action="?/create"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') createOpen = false;
					await update({ reset: false });
				};
			}}
		>
			{#key formKey}
				<AccountFields values={formValues} errors={formErrors} typeEditable />
			{/key}
		</form>
	</Sheet>
{/if}
