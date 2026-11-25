<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import FlaskConical from '@lucide/svelte/icons/flask-conical';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let open = $state(false);
	let pending = $state(false);
</script>

<Page title="Was wäre wenn" back={{ path: 'mehr', label: 'Mehr' }}>
	{#snippet actions()}
		{#if data.accounts.length}
			<button
				type="button"
				aria-label="Szenario anlegen"
				onclick={() => (open = true)}
				class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
			>
				<Plus class="size-6" strokeWidth={2.2} />
			</button>
		{/if}
	{/snippet}

	{#if data.scenarios.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<FlaskConical class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Szenarien</p>
			<p class="mt-1 text-[15px] text-label-2">
				Probiere aus, was ein neuer Vertrag, eine Kündigung oder eine Preiserhöhung für verfügbaren
				Betrag, Mindestbestand und die nächsten 12 Monate bedeutet. An den echten Daten ändert sich
				nichts.
			</p>
		</div>
	{:else}
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			aria-label="Szenarien"
		>
			{#each data.scenarios as s (s.id)}
				<li>
					<a
						href={resolve(`was-waere-wenn/${s.id}`)}
						class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
					>
						<span class="min-w-0 flex-1">
							<span class="block truncate text-[17px]">{s.name}</span>
							<span class="block truncate text-[13px] text-label-2">
								{s.accountName} · {formatDateTime(s.updatedAt)}
							</span>
						</span>
						<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</Page>

<Sheet
	bind:open
	title="Neues Szenario"
	confirmLabel="Anlegen"
	formId="scenario-form"
	confirmDisabled={pending}
>
	<form
		id="scenario-form"
		method="POST"
		action="?/create"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				pending = false;
				await update({ reset: false });
			};
		}}
	>
		{#if form?.error}<p role="alert" class="mb-3 px-4 text-[13px] text-danger">{form.error}</p>{/if}
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<FormField
				label="Name"
				name="name"
				value={form?.input?.name ?? ''}
				placeholder="z. B. Neues Auto"
				maxlength={60}
				autocomplete="off"
			/>
			<SelectField
				label="Konto"
				name="accountId"
				options={data.accounts}
				value={form?.input?.accountId ?? data.accounts[0]?.value ?? ''}
			/>
		</ul>
	</form>
</Sheet>
