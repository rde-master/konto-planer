<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Zap from '@lucide/svelte/icons/zap';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import TemplateFields from '#lib/components/TemplateFields.svelte';
	import { templateValuesFromInput, type TemplateFormValues } from '#lib/templates.js';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Template = (typeof data.templates)[number];

	let sheetOpen = $state(false);
	let deleteOpen = $state(false);
	let pending = $state(false);
	let ordering = $state(false);
	let formKey = $state(0);
	let editing = $state<Template | null>(null);
	let initial: TemplateFormValues = $state(empty());

	function empty(): TemplateFormValues {
		return {
			name: '',
			kind: 'expense',
			amount: '',
			accountId: null,
			categoryId: null,
			counterparty: null,
			shared: false
		};
	}

	const own = $derived(data.templates.filter((t) => !t.shared));
	const shared = $derived(data.templates.filter((t) => t.shared));

	let errors: Partial<Record<string, string>> | undefined = $state();
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const status = $derived.by(() => {
		if (!form) return undefined;
		if ('saved' in form)
			return form.action === 'create'
				? `Vorlage „${form.saved}“ wurde angelegt.`
				: `Vorlage „${form.saved}“ wurde gesichert.`;
		if ('deleted' in form) return `Vorlage „${form.deleted}“ wurde gelöscht.`;
		return undefined;
	});

	/** Accounts of the sheet; a template's account the editor cannot book on stays selectable. */
	const accountOptions = $derived.by(() => {
		const id = editing?.accountId;
		if (!id || data.accounts.some((a) => a.value === id)) return data.accounts;
		return [...data.accounts, { value: id, label: editing?.accountName ?? 'Konto ohne Zugriff' }];
	});

	function openCreate() {
		editing = null;
		errors = undefined;
		initial = empty();
		formKey++;
		sheetOpen = true;
	}

	function openEdit(t: Template) {
		editing = t;
		errors = undefined;
		initial = {
			name: t.name,
			kind: t.kind,
			amount: t.amount ? formatEuroInput(t.amount) : '',
			accountId: t.accountId,
			categoryId: t.categoryId,
			counterparty: t.counterparty,
			shared: t.shared
		};
		formKey++;
		sheetOpen = true;
	}

	function subtitle(t: Template) {
		const amount = t.amount
			? `${t.kind === 'income' ? '+' : '−'}${formatEuro(t.amount)}`
			: 'Betrag offen';
		const category = t.category
			? t.category.parentName
				? `${t.category.parentName} › ${t.category.name}`
				: t.category.name
			: null;
		return [amount, category, t.accountName].filter(Boolean).join(' · ');
	}
</script>

<Page title="Vorlagen" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Vorlage anlegen"
			onclick={openCreate}
			class="grid size-11 place-items-center rounded-full text-accent glass active:opacity-60"
		>
			<Plus class="size-6" strokeWidth={2.2} />
		</button>
	{/snippet}

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

	{#if data.templates.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Zap class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Vorlagen</p>
			<p class="mt-1 text-[15px] text-label-2">
				Vorlagen erscheinen oben in der Schnellerfassung. Ein Tipp füllt Art, Betrag, Konto und
				Kategorie aus. Lege sie mit „+“ an oder an einer Buchung mit „Als Vorlage sichern“.
			</p>
		</div>
	{:else}
		<div class="mb-4 flex items-center justify-between gap-3 px-4">
			<p class="text-[13px] text-label-2">
				Erscheinen in dieser Reihenfolge in der Schnellerfassung.
			</p>
			{#if data.templates.length > 1}
				<button
					type="button"
					class="shrink-0 text-[17px] text-accent"
					onclick={() => (ordering = !ordering)}
				>
					{ordering ? 'Fertig' : 'Ordnen'}
				</button>
			{/if}
		</div>
	{/if}

	{#each [{ title: 'Meine Vorlagen', items: own }, { title: 'Für alle', items: shared }] as group (group.title)}
		{#if group.items.length}
			<section class="mb-8" aria-label={group.title}>
				<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{group.title}</h2>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each group.items as t, i (t.id)}
						<li class="flex items-center">
							<button
								type="button"
								onclick={() => openEdit(t)}
								class="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-fill"
							>
								<span
									class="grid size-9 shrink-0 place-items-center rounded-full text-white"
									style:background-color={accountColorCss(t.category?.color ?? 'gray')}
								>
									<Zap class="size-5" strokeWidth={2.2} />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate text-[17px]">{t.name}</span>
									<span class="block truncate text-[13px] text-label-2">{subtitle(t)}</span>
								</span>
								{#if !ordering}
									<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
								{/if}
							</button>
							{#if ordering && t.canEdit}
								<form method="POST" action="?/move" use:enhance class="flex shrink-0 pr-2">
									<input type="hidden" name="id" value={t.id} />
									<button
										type="submit"
										name="direction"
										value="up"
										aria-label="{t.name} nach oben"
										disabled={i === 0}
										class="grid size-11 place-items-center text-accent disabled:text-label-3"
									>
										<ChevronUp class="size-5" strokeWidth={2.5} />
									</button>
									<button
										type="submit"
										name="direction"
										value="down"
										aria-label="{t.name} nach unten"
										disabled={i === group.items.length - 1}
										class="grid size-11 place-items-center text-accent disabled:text-label-3"
									>
										<ChevronDown class="size-5" strokeWidth={2.5} />
									</button>
								</form>
							{/if}
						</li>
					{/each}
				</ul>
				{#if group.items === shared && !data.isAdmin}
					<p class="mt-1.5 px-4 text-[13px] text-label-2">
						Gemeinsame Vorlagen kann jeder ändern; löschen kann sie nur der Admin.
					</p>
				{/if}
			</section>
		{/if}
	{/each}
</Page>

<Sheet
	bind:open={sheetOpen}
	title={editing ? 'Vorlage' : 'Neue Vorlage'}
	confirmLabel={editing ? 'Sichern' : 'Anlegen'}
	formId="template-form"
	confirmDisabled={pending}
>
	<form
		id="template-form"
		method="POST"
		action={editing ? '?/update' : '?/create'}
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') sheetOpen = false;
				else if (result.type === 'failure') {
					// Keep what was typed and show the errors.
					const input = result.data?.input as Record<string, string> | undefined;
					if (input) initial = templateValuesFromInput(input);
					errors = result.data?.errors as typeof errors;
					formKey++;
				}
				await update({ reset: false });
			};
		}}
	>
		{#key formKey}
			{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
			<TemplateFields
				values={initial}
				{errors}
				accounts={accountOptions}
				categories={data.categoryGroups}
				sharedLocked={!!editing?.shared && !data.isAdmin}
			/>
		{/key}
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Ohne Betrag fragt die Schnellerfassung nur noch den Betrag ab. Ohne Konto gilt das zuletzt
			benutzte.
		</p>
	</form>

	{#if editing?.canDelete}
		<Button
			type="button"
			variant="tinted"
			class="mt-8 !text-danger"
			onclick={() => {
				sheetOpen = false;
				deleteOpen = true;
			}}
		>
			Vorlage löschen
		</Button>
	{/if}
</Sheet>

<Sheet bind:open={deleteOpen} title="Vorlage löschen">
	{#if editing}
		<p class="mb-6 px-4 text-center text-[15px]">
			„{editing.name}“ wird endgültig gelöscht. Bereits erfasste Buchungen bleiben erhalten.
		</p>
		<form
			method="POST"
			action="?/delete"
			use:enhance={() =>
				async ({ update }) => {
					deleteOpen = false;
					await update();
				}}
		>
			<input type="hidden" name="id" value={editing.id} />
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	{/if}
</Sheet>
