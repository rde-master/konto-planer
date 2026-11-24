<script lang="ts">
	import { enhance } from '$app/forms';
	import Plus from '@lucide/svelte/icons/plus';
	import X from '@lucide/svelte/icons/x';
	import ListGroup from './ListGroup.svelte';
	import ListRow from './ListRow.svelte';
	import Sheet from './Sheet.svelte';
	import Button from './Button.svelte';
	import { formatEuro, formatEuroInput, parseEuro } from '#lib/money.js';
	import { MAX_PARTS } from '#lib/splits.js';

	/** Split of a booking into categories; the rest stays with the booking's category. */
	let {
		amount,
		categoryName,
		parts,
		canSplit,
		categoryGroups,
		errors
	}: {
		/** Signed amount of the booking. */
		amount: number;
		/** Category of the booking (gets the rest). */
		categoryName: string;
		parts: {
			id: string;
			amount: number;
			category: { name: string; parentName: string | null } | null;
			categoryId: string | null;
		}[];
		canSplit: boolean;
		categoryGroups: { label: string; options: { value: string; label: string }[] }[];
		/** Errors of the last save. */
		errors?: string[];
	} = $props();

	type Row = { key: number; amount: string; categoryId: string };

	let open = $state(false);
	let pending = $state(false);
	let rows = $state<Row[]>([]);
	let next = 0;

	const rest = $derived(parts.reduce((r, p) => r - p.amount, amount));
	const sign = $derived(amount < 0 ? -1 : 1);
	/** Rest while editing (amounts typed positive). */
	const draftRest = $derived(
		rows.reduce((r, row) => r - sign * Math.max(0, parseEuro(row.amount) ?? 0), amount)
	);

	function row(amountText = '', categoryId = ''): Row {
		return { key: next++, amount: amountText, categoryId };
	}

	function start() {
		rows = parts.length
			? parts.map((p) => row(formatEuroInput(Math.abs(p.amount)), p.categoryId ?? ''))
			: [row(), row()];
		open = true;
	}

	function add() {
		if (rows.length < MAX_PARTS) rows.push(row());
	}

	function remove(key: number) {
		rows = rows.filter((r) => r.key !== key);
	}

	function label(p: (typeof parts)[number]) {
		if (!p.category) return 'Ohne Kategorie';
		return p.category.parentName
			? `${p.category.parentName} › ${p.category.name}`
			: p.category.name;
	}
</script>

{#if parts.length}
	<section class="mb-8" aria-label="Aufteilung">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Aufteilung</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each parts as p (p.id)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1 truncate">{label(p)}</span>
					<span class="tabular">{formatEuro(p.amount)}</span>
				</li>
			{/each}
			{#if rest !== 0}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5 text-label-2">
					<span class="flex-1 truncate">Rest · {categoryName}</span>
					<span class="tabular" aria-label="Rest">{formatEuro(rest)}</span>
				</li>
			{/if}
		</ul>
	</section>
{/if}

{#if canSplit}
	<ListGroup
		footer={parts.length
			? undefined
			: 'Teile eine Buchung auf mehrere Kategorien auf, z. B. Einkauf mit Lebensmitteln und Drogerie.'}
	>
		<ListRow label={parts.length ? 'Aufteilung ändern' : 'Aufteilen'} onclick={start} />
	</ListGroup>

	<Sheet
		bind:open
		title="Aufteilen"
		confirmLabel="Sichern"
		formId="split-form"
		confirmDisabled={pending}
	>
		<form
			id="split-form"
			method="POST"
			action="?/split"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') open = false;
					await update({ reset: false });
				};
			}}
		>
			{#if errors?.length}
				<ul role="alert" class="mb-4 px-4 text-[13px] text-danger">
					{#each errors as e (e)}<li>{e}</li>{/each}
				</ul>
			{/if}
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each rows as r, i (r.key)}
					<li class="flex items-center gap-2 px-4 py-2">
						<input
							name="partAmount"
							bind:value={r.amount}
							inputmode="decimal"
							autocomplete="off"
							placeholder="0,00"
							aria-label="Betrag Teil {i + 1}"
							class="w-24 shrink-0 bg-transparent py-1 text-[17px] tabular outline-none placeholder:text-label-3"
						/>
						<select
							name="partCategory"
							bind:value={r.categoryId}
							aria-label="Kategorie Teil {i + 1}"
							class="min-w-0 flex-1 truncate bg-transparent py-1 text-[17px] text-label-2 outline-none"
						>
							<option value="">Kategorie wählen</option>
							{#each categoryGroups as g (g.label)}
								<optgroup label={g.label}>
									{#each g.options as o (o.value)}
										<option value={o.value}>{o.label}</option>
									{/each}
								</optgroup>
							{/each}
						</select>
						<button
							type="button"
							onclick={() => remove(r.key)}
							aria-label="Teil {i + 1} entfernen"
							class="grid size-9 shrink-0 place-items-center text-label-3"
						>
							<X class="size-5" />
						</button>
					</li>
				{/each}
				{#if rows.length < MAX_PARTS}
					<li>
						<button
							type="button"
							onclick={add}
							class="flex min-h-11 w-full items-center gap-2 px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
						>
							<Plus class="size-5" /> Teil hinzufügen
						</button>
					</li>
				{/if}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2" aria-label="Rest beim Aufteilen">
				Rest für {categoryName}: {formatEuro(draftRest)}
				{#if Math.sign(draftRest) === -Math.sign(amount) && draftRest !== 0}
					<span class="text-danger"> – die Teile sind größer als der Betrag.</span>
				{/if}
			</p>
		</form>
		{#if parts.length}
			<form
				method="POST"
				action="?/split"
				class="mt-6"
				use:enhance={() =>
					async ({ update }) => {
						open = false;
						await update();
					}}
			>
				<Button type="submit" variant="tinted" class="!text-danger">Aufteilung entfernen</Button>
			</form>
		{/if}
	</Sheet>
{/if}
