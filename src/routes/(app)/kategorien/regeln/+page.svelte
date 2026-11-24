<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import Wand from '@lucide/svelte/icons/wand-sparkles';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import {
		RULE_FIELDS,
		RULE_FIELD_LABELS,
		RULE_OPERATORS,
		RULE_OPERATOR_LABELS,
		ruleLabel
	} from '#lib/rules.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Rule = (typeof data.rules)[number];

	let open = $state(false);
	let key = $state(0);
	let pending = $state(false);
	let editing = $state<Rule | null>(null);

	type SaveResult = {
		action: 'save';
		id: string;
		input: { field: string; operator: string; value: string; categoryId: string };
		errors?: Partial<Record<string, string>>;
	};
	const failed = $derived.by((): SaveResult | null => {
		const f = form as Partial<SaveResult> | null | undefined;
		return f?.action === 'save' && f.input ? (f as SaveResult) : null;
	});
	const values = $derived(
		failed && failed.id === (editing?.id ?? '')
			? failed.input
			: {
					field: editing?.field ?? 'purpose',
					operator: editing?.operator ?? 'contains',
					value: editing?.value ?? '',
					categoryId: editing?.categoryId ?? ''
				}
	);
	const errors = $derived(failed?.errors);
	const status = $derived(form && 'success' in form ? form.success : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);

	function start(rule: Rule | null) {
		editing = rule;
		key++;
		open = true;
	}

	function categoryText(r: Rule) {
		if (!r.category) return 'Kategorie gelöscht – Regel greift nicht';
		return r.category.parentName
			? `${r.category.parentName} › ${r.category.name}`
			: r.category.name;
	}
</script>

<Page title="Regeln" back={{ path: 'kategorien', label: 'Kategorien' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Regel anlegen"
			onclick={() => start(null)}
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

	{#if data.rules.length === 0}
		<div class="mb-8 rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Wand class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Regeln</p>
			<p class="mt-1 text-[15px] text-label-2">
				Regeln wie „Verwendungszweck enthält Miete → Wohnen“ setzen beim Import die Kategorie, wenn
				die Buchung zu keinem Dauerposten gehört.
			</p>
		</div>
	{:else}
		<section class="mb-8" aria-label="Regeln">
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.rules as r, i (r.id)}
					<li class="flex items-center">
						<button
							type="button"
							onclick={() => start(r)}
							class="flex min-h-14 min-w-0 flex-1 items-center gap-3 px-4 py-2 text-left active:bg-fill"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full text-[15px] font-semibold text-white"
								style:background-color={accountColorCss(r.category?.color ?? 'gray')}
							>
								{i + 1}
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{ruleLabel(r)}</span>
								<span
									class={[
										'block truncate text-[13px]',
										r.category ? 'text-label-2' : 'text-danger'
									]}
								>
									→ {categoryText(r)}
								</span>
							</span>
						</button>
						<form method="POST" action="?/move" use:enhance class="flex shrink-0 pr-2">
							<input type="hidden" name="id" value={r.id} />
							<button
								type="submit"
								name="direction"
								value="up"
								aria-label="Regel {i + 1} nach oben"
								disabled={i === 0}
								class="grid size-11 place-items-center text-accent disabled:text-label-3"
							>
								<ChevronUp class="size-5" strokeWidth={2.5} />
							</button>
							<button
								type="submit"
								name="direction"
								value="down"
								aria-label="Regel {i + 1} nach unten"
								disabled={i === data.rules.length - 1}
								class="grid size-11 place-items-center text-accent disabled:text-label-3"
							>
								<ChevronDown class="size-5" strokeWidth={2.5} />
							</button>
						</form>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Die erste passende Regel gilt. Reihenfolge beim Import: Dauerposten, Regeln, zuletzt für den
				Empfänger gewählte Kategorie, Kategorie der Bank. Groß- und Kleinschreibung zählen nicht.
			</p>
		</section>

		<section class="mb-8" aria-label="Bisherige Buchungen">
			<form method="POST" action="?/apply" use:enhance>
				<Button type="submit" variant="tinted" disabled={data.applicable === 0}>
					Auf bisherige Buchungen anwenden
				</Button>
			</form>
			<p class="mt-1.5 px-4 text-[13px] text-label-2" aria-label="Passende Buchungen">
				{data.applicable === 0
					? 'Keine importierte Buchung ohne Kategorie passt zu einer Regel.'
					: data.applicable === 1
						? 'Eine importierte Buchung ohne Kategorie passt zu einer Regel.'
						: `${data.applicable} importierte Buchungen ohne Kategorie passen zu einer Regel.`}
			</p>
		</section>
	{/if}
</Page>

<Sheet
	bind:open
	title={editing ? 'Regel' : 'Neue Regel'}
	confirmLabel={editing ? 'Sichern' : 'Anlegen'}
	formId="rule-form"
	confirmDisabled={pending}
>
	<form
		id="rule-form"
		method="POST"
		action="?/save"
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
		<input type="hidden" name="id" value={editing?.id ?? ''} />
		{#key key}
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<SelectField
					label="Wenn"
					name="field"
					options={RULE_FIELDS.map((f) => ({ value: f, label: RULE_FIELD_LABELS[f] }))}
					value={values.field}
					error={errors?.field}
				/>
				<SelectField
					label="Bedingung"
					name="operator"
					options={RULE_OPERATORS.map((o) => ({ value: o, label: RULE_OPERATOR_LABELS[o] }))}
					value={values.operator}
					error={errors?.operator}
				/>
				<FormField
					label="Text"
					name="value"
					value={values.value}
					placeholder="z. B. Miete"
					maxlength={100}
					autocomplete="off"
					required
					error={errors?.value}
				/>
				<SelectField
					label="Dann Kategorie"
					name="categoryId"
					options={[{ value: '', label: 'Bitte wählen' }]}
					groups={data.categoryGroups}
					value={values.categoryId}
					error={errors?.categoryId}
				/>
			</ul>
		{/key}
	</form>
	{#if editing && data.isAdmin}
		<form
			method="POST"
			action="?/delete"
			class="mt-6"
			use:enhance={() =>
				async ({ update }) => {
					open = false;
					await update();
				}}
		>
			<input type="hidden" name="id" value={editing.id} />
			<Button type="submit" variant="tinted" class="!text-danger">Regel löschen</Button>
		</form>
	{:else if editing}
		<p class="mt-4 px-4 text-[13px] text-label-2">Regeln löschen kann nur der Admin.</p>
	{/if}
</Sheet>
