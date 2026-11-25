<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { monthLabel } from '#lib/tags.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const s = $derived(data.summary);
	let editOpen = $state(false);
	let deleteOpen = $state(false);
	let pending = $state(false);
	let key = $state(0);

	const renameError = $derived(
		form?.action === 'rename' && 'error' in form ? form.error : undefined
	);
	const message = $derived(form?.action === 'delete' && 'error' in form ? form.error : undefined);

	function signed(amount: number) {
		return `${amount > 0 ? '+' : ''}${formatEuro(amount)}`;
	}
</script>

<Page title={`#${data.tag.name}`} back={{ path: 'tags', label: 'Tags' }}>
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{:else if form?.action === 'rename' && 'success' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Tag umbenannt.
		</p>
	{/if}

	<nav aria-label="Jahr" class="mb-4 flex flex-wrap gap-2">
		{#each s.years as y (y)}
			<a
				href="{resolve(`tags/${data.tag.id}`)}?jahr={y}"
				aria-current={y === s.year ? 'page' : undefined}
				class={[
					'rounded-full px-4 py-1.5 text-[15px] tabular',
					y === s.year ? 'bg-accent text-accent-contrast' : 'bg-card text-accent'
				]}
			>
				{y}
			</a>
		{/each}
	</nav>

	<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Summe {s.year}">
		<div class="flex gap-6">
			<div>
				<p class="text-[13px] text-label-2">Ausgaben {s.year}</p>
				<p class="text-[24px] font-bold tabular" aria-label="Ausgaben">{formatEuro(s.expenses)}</p>
			</div>
			{#if s.income}
				<div>
					<p class="text-[13px] text-label-2">Einnahmen</p>
					<p class="text-[24px] font-bold text-income tabular" aria-label="Einnahmen">
						+{formatEuro(s.income)}
					</p>
				</div>
			{/if}
		</div>
	</section>

	{#if s.byCategory.length}
		<section class="mb-8" aria-label="Nach Kategorie">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Nach Kategorie</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each s.byCategory as c (c.categoryId ?? 'none')}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
						<span class="flex-1 truncate">
							{c.categoryId ? (s.categoryNames[c.categoryId] ?? '–') : 'Ohne Kategorie'}
						</span>
						<span class="tabular">{signed(c.amount)}</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#each s.months as m (m.month)}
		<section class="mb-8" aria-label={monthLabel(m.month)}>
			<h2 class="mb-1.5 flex px-4 text-[13px] text-label-2 uppercase">
				<span class="flex-1">{monthLabel(m.month)}</span>
				<span class="tabular">{signed(m.total)}</span>
			</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each m.bookings as b (b.id)}
					{@const info = s.bookings[b.id]}
					<li>
						<a
							href={resolve(`buchungen/${b.id}`)}
							class="flex min-h-11 items-center gap-3 px-4 py-2 active:bg-fill"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate">
									{info?.counterparty ?? info?.purpose ?? 'Buchung'}
								</span>
								<span class="block truncate text-[13px] text-label-2">
									{formatDay(b.bookingDate)} · {info?.accountName}{info?.inherited
										? ' · vom Dauerposten'
										: ''}
								</span>
							</span>
							<span class={['tabular', b.amount > 0 && 'text-income']}>{signed(b.amount)}</span>
						</a>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="mb-8 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
			Keine Buchungen mit diesem Tag in {s.year}.
		</p>
	{/each}

	{#if data.items.length}
		<ListGroup header="Dauerposten mit diesem Tag">
			{#each data.items as item (item.id)}
				<ListRow label={item.name} href={`dauerposten/${item.id}`} />
			{/each}
		</ListGroup>
	{/if}

	<ListGroup>
		<ListRow
			label="Umbenennen"
			onclick={() => {
				key++;
				editOpen = true;
			}}
		/>
		{#if data.isAdmin}
			<ListRow label="Tag löschen" destructive onclick={() => (deleteOpen = true)} />
		{/if}
	</ListGroup>
</Page>

<Sheet
	bind:open={editOpen}
	title="Umbenennen"
	confirmLabel="Sichern"
	formId="tag-rename"
	confirmDisabled={pending}
>
	<form
		id="tag-rename"
		method="POST"
		action="?/rename"
		use:enhance={() => {
			pending = true;
			return async ({ result, update }) => {
				pending = false;
				if (result.type === 'success') editOpen = false;
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
					value={form?.action === 'rename' && 'input' in form ? form.input : data.tag.name}
					maxlength={30}
					autocomplete="off"
					error={renameError}
				/>
			</ul>
		{/key}
	</form>
</Sheet>

{#if data.isAdmin}
	<Sheet bind:open={deleteOpen} title="Tag löschen">
		<p class="mb-6 px-4 text-center text-[15px]">
			„{data.tag.name}“ wird von allen Buchungen und Dauerposten entfernt und gelöscht. Die
			Buchungen bleiben.
		</p>
		<form method="POST" action="?/delete" use:enhance>
			<Button type="submit" variant="destructive">Löschen</Button>
		</form>
	</Sheet>
{/if}
