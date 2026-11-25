<script lang="ts">
	import { enhance } from '$app/forms';
	import ListGroup from './ListGroup.svelte';
	import ListRow from './ListRow.svelte';
	import Sheet from './Sheet.svelte';
	import { formatEuro } from '#lib/money.js';
	import { formatPercent } from '#lib/settle.js';

	/** Shared expense of a booking: who paid, who takes part and with which share. */
	let {
		shared,
		users,
		me,
		canEdit,
		errors
	}: {
		shared: {
			payerId: string;
			payerName: string;
			shares: { userId: string; name: string; share: number; owed: number }[];
		} | null;
		users: { id: string; name: string }[];
		me: string;
		canEdit: boolean;
		errors?: Partial<Record<string, string>>;
	} = $props();

	let open = $state(false);
	let key = $state(0);
	let pending = $state(false);

	function start() {
		key++;
		open = true;
	}

	function percentOf(userId: string) {
		const s = shared?.shares.find((x) => x.userId === userId);
		return s ? (s.share / 100).toLocaleString('de-DE', { maximumFractionDigits: 2 }) : '';
	}
</script>

{#if shared}
	<section class="mb-8" aria-label="Gemeinsame Ausgabe">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Gemeinsame Ausgabe</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
				<span class="flex-1">Bezahlt von</span>
				<span class="text-label-2">{shared.payerName}</span>
			</li>
			{#each shared.shares as s (s.userId)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
					<span class="flex-1 truncate">{s.name}</span>
					<span class="text-label-2 tabular">{formatPercent(s.share)} · {formatEuro(s.owed)}</span>
				</li>
			{/each}
		</ul>
	</section>
{/if}

{#if canEdit}
	<ListGroup
		footer={shared
			? undefined
			: 'Mit anderen geteilt? Die App rechnet aus, wer wem wie viel schuldet.'}
	>
		<ListRow
			label={shared ? 'Gemeinsame Ausgabe ändern' : 'Als gemeinsame Ausgabe markieren'}
			onclick={start}
		/>
		{#if shared}
			<li>
				<form method="POST" action="?/unshare" use:enhance>
					<button
						type="submit"
						class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-danger active:bg-fill"
					>
						Nicht mehr gemeinsam
					</button>
				</form>
			</li>
		{/if}
	</ListGroup>

	<Sheet
		bind:open
		title="Gemeinsame Ausgabe"
		confirmLabel="Sichern"
		formId="shared-form"
		confirmDisabled={pending}
	>
		<form
			id="shared-form"
			method="POST"
			action="?/share"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') open = false;
					await update({ reset: false });
				};
			}}
		>
			{#key key}
				{#if errors?.payerId || errors?.shares}
					<p role="alert" class="mb-3 px-4 text-[13px] text-danger">
						{errors.payerId ?? errors.shares}
					</p>
				{/if}
				<ul class="mb-6 overflow-hidden rounded-[var(--radius-row)] bg-card">
					<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
						<label for="payer" class="flex-1 text-[17px]">Bezahlt von</label>
						<select
							id="payer"
							name="payerId"
							class="bg-transparent text-right text-[17px] text-label-2"
						>
							{#each users as u (u.id)}
								<option value={u.id} selected={u.id === (shared?.payerId ?? me)}>{u.name}</option>
							{/each}
						</select>
					</li>
				</ul>
				<h3 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Beteiligt</h3>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each users as u (u.id)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
							<input
								id="p-{u.id}"
								type="checkbox"
								name="participant"
								value={u.id}
								checked={shared ? shared.shares.some((s) => s.userId === u.id) : true}
								class="size-5 accent-[var(--kp-accent)]"
							/>
							<label for="p-{u.id}" class="flex-1 text-[17px]">{u.name}</label>
							<input
								name="percent-{u.id}"
								value={shared ? percentOf(u.id) : ''}
								inputmode="decimal"
								autocomplete="off"
								placeholder="gleich"
								aria-label="Anteil {u.name} in %"
								class="w-20 bg-transparent text-right text-[17px] tabular outline-none placeholder:text-label-3"
							/>
							<span class="text-label-2">%</span>
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Ohne Prozentangaben wird gleich verteilt. Mit Angaben müssen sie zusammen 100 % ergeben.
				</p>
			{/key}
		</form>
	</Sheet>
{/if}
