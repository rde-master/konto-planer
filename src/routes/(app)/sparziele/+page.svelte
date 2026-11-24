<script lang="ts">
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import Plus from '@lucide/svelte/icons/plus';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import GoalFields from '#lib/components/GoalFields.svelte';
	import GoalRow from '#lib/components/GoalRow.svelte';
	import type { GoalFormValues } from '#lib/goal-form.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);
	let accountId = $state('');

	const empty = (): GoalFormValues => ({
		accountId: accountId || (data.accounts[0]?.value ?? ''),
		name: '',
		targetAmount: '',
		targetDate: '',
		recurringId: '',
		allocated: ''
	});
	const values = $derived<GoalFormValues>(
		form && 'input' in form && form.input ? form.input : empty()
	);
	const errors = $derived<Partial<Record<string, string>> | undefined>(
		form && 'errors' in form ? form.errors : undefined
	);
	const created = $derived(form && 'created' in form ? form.created : undefined);

	const groups = $derived.by(() => {
		const out: { name: string; goals: typeof data.goals }[] = [];
		for (const g of data.goals) {
			const group = out.find((o) => o.name === g.account.name);
			if (group) group.goals.push(g);
			else out.push({ name: g.account.name, goals: [g] });
		}
		return out.sort((a, b) => a.name.localeCompare(b.name, 'de'));
	});

	function start(id = '') {
		accountId = id;
		key++;
		open = true;
	}

	onMount(() => {
		if (data.preselect) start(data.preselect);
	});
</script>

<Page title="Sparziele" back={{ path: 'mehr', label: 'Mehr' }}>
	{#snippet actions()}
		{#if data.accounts.length}
			<button
				type="button"
				aria-label="Sparziel anlegen"
				onclick={() => start()}
				class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
			>
				<Plus class="size-6" strokeWidth={2.2} />
			</button>
		{/if}
	{/snippet}

	{#if created}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Sparziel „{created}“ angelegt.
		</p>
	{/if}

	{#if data.goals.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<PiggyBank class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Sparziele</p>
			<p class="mt-1 text-[15px] text-label-2">
				Lege auf einem Sparbuch Geld für ein Ziel zurück, etwa für den Urlaub oder eine
				Jahreszahlung. Mit einer verknüpften Zahlung bucht die App das Geld am Zahltag aufs
				Girokonto.
			</p>
			{#if !data.accounts.length}
				<p class="mt-3 text-[15px] text-label-2">
					Dafür brauchst du ein Sparbuch, das du bearbeiten darfst.
				</p>
			{/if}
		</div>
	{/if}

	{#each groups as group (group.name)}
		<section class="mb-8" aria-label={group.name}>
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{group.name}</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each group.goals as goal (goal.id)}<GoalRow {goal} />{/each}
			</ul>
		</section>
	{/each}
</Page>

{#if data.accounts.length}
	<Sheet
		bind:open
		title="Neues Sparziel"
		confirmLabel="Anlegen"
		formId="goal-form"
		confirmDisabled={pending}
	>
		<form
			id="goal-form"
			method="POST"
			action="?/create"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') open = false;
					await update({ reset: false });
					key++;
				};
			}}
		>
			{#key key}
				<GoalFields {values} {errors} payments={data.payments} accounts={data.accounts} />
			{/key}
		</form>
	</Sheet>
{/if}
