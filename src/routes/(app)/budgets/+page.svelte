<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import Gauge from '@lucide/svelte/icons/gauge';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { addMonths } from '#lib/recurring.js';
	import { monthLabel } from '#lib/tags.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Row = (typeof data.budgets)[number];
	type SaveForm = {
		action: 'save';
		id: string | null;
		input: { categoryId: string; accountId: string; amount: string };
		errors?: Partial<Record<string, string>>;
	};

	let open = $state(false);
	let key = $state(0);
	let pending = $state(false);
	let editing = $state<Row | null>(null);

	const failed = $derived.by((): SaveForm | null => {
		const f = form as Partial<SaveForm> | null | undefined;
		return f?.action === 'save' && f.input ? (f as SaveForm) : null;
	});
	const values = $derived(
		failed && failed.id === (editing?.id ?? null)
			? failed.input
			: {
					categoryId: editing?.categoryId ?? '',
					accountId: editing?.accountId ?? '',
					amount: editing ? formatEuroInput(editing.limit) : ''
				}
	);
	const status = $derived(form && 'success' in form ? form.success : undefined);
	const message = $derived(form && 'message' in form ? form.message : undefined);

	const prev = $derived(addMonths(`${data.month}-01`, -1).slice(0, 7));
	const next = $derived(addMonths(`${data.month}-01`, 1).slice(0, 7));

	function start(row: Row | null) {
		editing = row;
		key++;
		open = true;
	}

	const BAR: Record<string, string> = {
		ok: 'bg-accent',
		warn: 'bg-[#ff9500]',
		over: 'bg-[#ff3b30]'
	};
</script>

<Page title="Budgets" back={{ path: 'mehr', label: 'Mehr' }}>
	{#snippet actions()}
		<button
			type="button"
			aria-label="Budget anlegen"
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

	<nav aria-label="Monat" class="mb-4 flex items-center gap-3">
		<a href={resolve(`budgets?monat=${prev}`)} class="text-accent" aria-label="Vormonat">
			‹ {monthLabel(prev)}
		</a>
		<span class="flex-1 text-center text-[17px] font-semibold">{monthLabel(data.month)}</span>
		<a href={resolve(`budgets?monat=${next}`)} class="text-accent" aria-label="Folgemonat">
			{monthLabel(next)} ›
		</a>
	</nav>

	{#if data.budgets.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Gauge class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine Budgets</p>
			<p class="mt-1 text-[15px] text-label-2">
				Lege für eine Kategorie eine Monatsgrenze fest, z. B. 400 € für Lebensmittel. Die App zeigt,
				wie viel davon schon ausgegeben ist.
			</p>
		</div>
	{:else}
		<section class="mb-8" aria-label="Budgets im Monat">
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.budgets as b (b.id)}
					{@const share = Math.min(1, b.spent / b.limit)}
					<li aria-label="{b.categoryName} · {b.accountName}">
						<button
							type="button"
							onclick={() => b.canEdit && start(b)}
							disabled={!b.canEdit}
							class="block w-full px-4 py-3 text-left active:bg-fill disabled:active:bg-transparent"
						>
							<span class="flex items-baseline gap-2">
								<span
									class="size-2.5 shrink-0 rounded-full"
									style:background-color={accountColorCss(b.color)}
								></span>
								<span class="min-w-0 flex-1 truncate text-[17px]">{b.categoryName}</span>
								<span class="tabular">{formatEuro(b.spent)} / {formatEuro(b.limit)}</span>
							</span>
							<span class="relative mt-2 block h-2 overflow-hidden rounded-full bg-fill">
								<span
									class={['block h-full rounded-full', BAR[b.state]]}
									style:width="{share * 100}%"
								></span>
								{#if data.month === data.thisMonth}
									<span
										class="absolute top-0 h-full w-0.5 bg-label-2"
										style:left="{data.pace * 100}%"
										aria-hidden="true"
									></span>
								{/if}
							</span>
							<span class="mt-1 flex text-[13px] text-label-2">
								<span class="flex-1 truncate">{b.accountName}</span>
								<span class={['tabular', b.state === 'over' && 'text-danger']}>
									{b.spent > b.limit
										? `${formatEuro(b.spent - b.limit)} drüber`
										: `noch ${formatEuro(b.limit - b.spent)}`}
								</span>
							</span>
						</button>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Echte und vorläufige Ausgaben des Monats, Unterkategorien und Teile aufgeteilter Buchungen
				eingerechnet. Der Strich zeigt, wie weit der Monat ist.
			</p>
		</section>
	{/if}
</Page>

<Sheet
	bind:open
	title={editing ? 'Budget' : 'Neues Budget'}
	confirmLabel={editing ? 'Sichern' : 'Anlegen'}
	formId="budget-form"
	confirmDisabled={pending}
>
	<form
		id="budget-form"
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
					label="Kategorie"
					name="categoryId"
					options={[{ value: '', label: 'Bitte wählen' }]}
					groups={data.categoryGroups}
					value={values.categoryId}
					error={failed?.errors?.categoryId}
				/>
				<SelectField
					label="Konto"
					name="accountId"
					options={data.accounts}
					value={values.accountId}
					error={failed?.errors?.accountId}
				/>
				<FormField
					label="Grenze im Monat in €"
					name="amount"
					value={values.amount}
					inputmode="decimal"
					autocomplete="off"
					placeholder="0,00"
					error={failed?.errors?.amount}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Eine Hauptkategorie umfasst ihre Unterkategorien. „Alle Konten“ zählt alle Konten, die du
				siehst.
			</p>
		{/key}
	</form>
	{#if editing}
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
			<Button type="submit" variant="tinted" class="!text-danger">Budget löschen</Button>
		</form>
	{/if}
</Sheet>
