<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Tag from '@lucide/svelte/icons/tag';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Page from '#lib/components/Page.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import Wand from '@lucide/svelte/icons/wand-sparkles';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import ColorPicker from '#lib/components/ColorPicker.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Main = (typeof data.tree)[number];
	type Editing = { id: string; name: string; parentId: string | null; color: string | null };

	let sheetOpen = $state(false);
	let deleteOpen = $state(false);
	let pending = $state(false);
	let formKey = $state(0);
	/** Category being edited; null while creating. */
	let editing: Editing | null = $state(null);
	/** Values the sheet opens with. */
	let initial = $state({ name: '', parentId: '', color: 'blue' });
	/** Current parent selection; the colour picker is only shown for main categories. */
	let parentId = $state('');

	const editingMain = $derived(editing ? data.tree.find((m) => m.id === editing!.id) : undefined);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);
	const status = $derived.by(() => {
		if (!form) return undefined;
		if ('saved' in form)
			return form.action === 'create'
				? `Kategorie „${form.saved}“ wurde angelegt.`
				: `Kategorie „${form.saved}“ wurde gesichert.`;
		if ('deleted' in form) return `Kategorie „${form.deleted}“ wurde gelöscht.`;
		if ('count' in form) return `${form.count} Kategorien wurden angelegt.`;
		return undefined;
	});

	const parentOptions = $derived([
		{ value: '', label: 'Keine' },
		...data.tree.filter((m) => m.id !== editing?.id).map((m) => ({ value: m.id, label: m.name }))
	]);
	const count = $derived(data.tree.reduce((n, m) => n + 1 + m.children.length, 0));

	function open(values: { name: string; parentId: string; color: string }, cat: Editing | null) {
		editing = cat;
		initial = values;
		parentId = values.parentId;
		formKey++;
		sheetOpen = true;
	}

	function setParent(value: string) {
		parentId = value;
	}

	function openCreate(parent?: Main) {
		open({ name: '', parentId: parent?.id ?? '', color: 'blue' }, null);
	}

	function openEdit(cat: Editing) {
		open({ name: cat.name, parentId: cat.parentId ?? '', color: cat.color ?? 'blue' }, cat);
	}
</script>

<Page title="Kategorien" back={{ path: 'mehr', label: 'Mehr' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Kategorie anlegen"
			onclick={() => openCreate()}
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

	{#if data.tree.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-10 text-center">
			<p class="text-[17px] font-semibold">Noch keine Kategorien</p>
			<p class="mt-1 mb-6 text-[15px] text-label-2">
				Übernimm eine Vorschlagsliste mit üblichen Haushaltskategorien oder lege mit „+“ eigene an.
				Alles lässt sich später ändern.
			</p>
			<form method="POST" action="?/defaults" use:enhance>
				<Button type="submit">Vorschläge übernehmen</Button>
			</form>
		</div>
	{:else}
		<p class="mb-4 px-4 text-[13px] text-label-2">
			{count} Kategorien, für alle Benutzer gleich. Unterkategorien haben die Farbe ihrer Hauptkategorie.
		</p>
	{/if}

	{#each data.tree as main (main.id)}
		<section class="mb-6" aria-label={main.name}>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<li>
					<button
						type="button"
						onclick={() => openEdit(main)}
						class="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-fill"
					>
						<span
							class="grid size-[29px] shrink-0 place-items-center rounded-[7px] text-white"
							style:background-color={accountColorCss(main.color ?? 'gray')}
						>
							<Tag class="size-[18px]" strokeWidth={2.2} />
						</span>
						<span class="min-w-0 flex-1 truncate text-[17px] font-semibold">{main.name}</span>
						<span class="shrink-0 text-[15px] text-label-2 tabular">
							{main.children.length || ''}
						</span>
						<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
					</button>
				</li>
				{#each main.children as sub (sub.id)}
					<li>
						<button
							type="button"
							onclick={() => openEdit(sub)}
							class="flex min-h-11 w-full items-center gap-3 py-2.5 pr-4 pl-[3.75rem] text-left active:bg-fill"
						>
							<span
								class="size-2.5 shrink-0 rounded-full"
								style:background-color={accountColorCss(main.color ?? 'gray')}
								aria-hidden="true"
							></span>
							<span class="min-w-0 flex-1 truncate text-[17px]">{sub.name}</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</button>
					</li>
				{/each}
				<li>
					<button
						type="button"
						onclick={() => openCreate(main)}
						class="flex min-h-11 w-full items-center gap-3 py-2.5 pr-4 pl-[3.75rem] text-left text-[15px] text-accent active:bg-fill"
					>
						<Plus class="size-4" strokeWidth={2.5} />
						Unterkategorie
					</button>
				</li>
			</ul>
		</section>
	{/each}
	<ListGroup
		footer="Regeln setzen beim Import die Kategorie, z. B. „Verwendungszweck enthält Miete → Wohnen“."
	>
		<ListRow
			label="Regeln für den Import"
			href="kategorien/regeln"
			icon={Wand}
			iconColor="bg-[#5856d6]"
		/>
	</ListGroup>
</Page>

<Sheet
	bind:open={sheetOpen}
	title={editing ? 'Kategorie' : 'Neue Kategorie'}
	confirmLabel={editing ? 'Sichern' : 'Anlegen'}
	formId="category-form"
	confirmDisabled={pending}
>
	<form
		id="category-form"
		method="POST"
		action={editing ? '?/update' : '?/create'}
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') sheetOpen = false;
				await update({ reset: false });
			};
		}}
	>
		{#key formKey}
			{#if editing}<input type="hidden" name="id" value={editing.id} />{/if}
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Name"
					name="name"
					value={initial.name}
					maxlength={40}
					required
					autocomplete="off"
					error={errors?.name}
				/>
				{#if !editingMain?.children.length}
					<SelectField
						label="Hauptkategorie"
						name="parentId"
						options={parentOptions}
						value={initial.parentId}
						error={errors?.parentId}
						onchange={setParent}
					/>
				{/if}
			</ul>
			{#if editingMain?.children.length}
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Hat Unterkategorien und bleibt deshalb eine Hauptkategorie.
				</p>
			{/if}
			{#if !parentId}
				<h3 class="mt-6 mb-1.5 px-4 text-[13px] text-label-2 uppercase">Farbe</h3>
				<div class="overflow-hidden rounded-[var(--radius-row)] bg-card">
					<ColorPicker name="color" initial={initial.color} error={errors?.color} />
				</div>
			{:else}
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Unterkategorien haben die Farbe ihrer Hauptkategorie.
				</p>
			{/if}
		{/key}
	</form>

	{#if editing && data.isAdmin}
		<Button
			type="button"
			variant="tinted"
			class="mt-8 !text-danger"
			onclick={() => {
				sheetOpen = false;
				deleteOpen = true;
			}}
		>
			Kategorie löschen
		</Button>
	{/if}
</Sheet>

{#if data.isAdmin}
	<Sheet bind:open={deleteOpen} title="Kategorie löschen">
		{#if editing}
			<p class="mb-6 px-4 text-center text-[15px]">
				„{editing.name}“{#if editingMain?.children.length}
					und {editingMain.children.length === 1
						? 'ihre Unterkategorie werden'
						: `ihre ${editingMain.children.length} Unterkategorien werden`}{:else}
					wird{/if} gelöscht. Buchungen und Dauerposten bleiben erhalten und gelten danach als unkategorisiert.
				Im Papierkorb lässt sich alles 30 Tage lang samt Zuordnungen wiederherstellen.
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
{/if}
