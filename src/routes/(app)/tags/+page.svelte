<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import Hash from '@lucide/svelte/icons/hash';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);
</script>

<Page title="Tags" back={{ path: 'mehr', label: 'Mehr' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Tag anlegen"
			onclick={() => {
				key++;
				open = true;
			}}
			class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
		>
			<Plus class="size-6" strokeWidth={2.2} />
		</button>
	{/snippet}

	{#if form && 'created' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Tag „{form.created}“ angelegt.
		</p>
	{/if}

	{#if data.tags.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Hash class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Tags</p>
			<p class="mt-1 text-[15px] text-label-2">
				Tags ergänzen die Kategorie, z. B. „Urlaub Italien“ oder „Hochzeit“. Die Jahresliste je Tag
				zeigt, was dafür ausgegeben wurde.
			</p>
		</div>
	{:else}
		<section aria-label="Alle Tags" class="mb-8">
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.tags as t (t.id)}
					<li>
						<a
							href={resolve(`tags/${t.id}`)}
							class="flex min-h-11 items-center gap-3 px-4 py-2.5 active:bg-fill"
						>
							<Hash class="size-5 shrink-0 text-accent" strokeWidth={2.2} />
							<span class="flex-1 truncate text-[17px]">{t.name}</span>
							<span class="text-[15px] text-label-2 tabular">
								{t.count}
								{t.count === 1 ? 'Buchung' : 'Buchungen'}
							</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">Anzahl der Buchungen in {data.year}.</p>
		</section>
	{/if}
</Page>

<Sheet
	bind:open
	title="Neuer Tag"
	confirmLabel="Anlegen"
	formId="tag-create"
	confirmDisabled={pending}
>
	<form
		id="tag-create"
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
			<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
				<FormField
					label="Name"
					name="name"
					value={form && 'input' in form ? form.input : ''}
					maxlength={30}
					autocomplete="off"
					placeholder="z. B. Urlaub Italien"
					error={form && 'error' in form ? form.error : undefined}
				/>
			</ul>
		{/key}
	</form>
</Sheet>
