<script lang="ts">
	import { enhance } from '$app/forms';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import FormField from './FormField.svelte';
	import SelectField from './SelectField.svelte';
	import Button from './Button.svelte';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';

	type Target = { id: string; name: string; goals: { id: string; name: string }[] };
	let {
		suggestion,
		targets,
		errors
	}: {
		suggestion: {
			accountId: string;
			accountName: string;
			salaryDueDate: string;
			salaryDate: string;
			cutoff: string;
			amount: number;
			canEdit: boolean;
		};
		targets: Target[];
		errors?: Partial<Record<string, string>>;
	} = $props();

	// svelte-ignore state_referenced_locally
	let targetId = $state(targets[0]?.id ?? '');
	const goals = $derived(targets.find((t) => t.id === targetId)?.goals ?? []);
	let pending = $state(false);
</script>

<section
	class="mb-8 rounded-[var(--radius-card)] bg-card p-5"
	aria-label="Sparvorschlag {suggestion.accountName}"
>
	<div class="mb-3 flex items-start gap-3">
		<PiggyBank class="mt-0.5 size-6 shrink-0 text-accent" />
		<div>
			<p class="text-[17px] font-semibold">
				{formatEuro(suggestion.amount)} können aufs Sparbuch
			</p>
			<p class="text-[15px] text-label-2">
				Gehalt auf {suggestion.accountName} am {formatDay(suggestion.salaryDate)} gebucht; der Mindestbestand
				bis {formatDay(suggestion.cutoff)} bleibt gedeckt.
			</p>
		</div>
	</div>
	{#if suggestion.canEdit && targets.length}
		<form
			method="POST"
			action="?/saveTransfer"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update({ reset: false });
				};
			}}
		>
			<input type="hidden" name="accountId" value={suggestion.accountId} />
			<input type="hidden" name="salaryDueDate" value={suggestion.salaryDueDate} />
			<ul
				class="mb-3 divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-fill"
			>
				<FormField
					label="Betrag in €"
					name="amount"
					value={formatEuroInput(suggestion.amount)}
					inputmode="decimal"
					autocomplete="off"
					error={errors?.amount}
				/>
				<SelectField
					label="Sparbuch"
					name="targetId"
					value={targetId}
					options={targets.map((t) => ({ value: t.id, label: t.name }))}
					onchange={(v: string) => {
						targetId = v;
					}}
					error={errors?.target}
				/>
				{#if goals.length}
					<SelectField
						label="Sparziel"
						name="goalId"
						options={[
							{ value: '', label: 'keinem zuteilen' },
							...goals.map((g) => ({ value: g.id, label: g.name }))
						]}
					/>
				{/if}
			</ul>
			<Button type="submit" disabled={pending}>Umbuchen</Button>
		</form>
	{:else if suggestion.canEdit}
		<p class="text-[13px] text-label-2">Lege ein Sparbuch an, um den Betrag umzubuchen.</p>
	{/if}
	{#if suggestion.canEdit}
		<form method="POST" action="?/saveDismiss" use:enhance class="mt-2">
			<input type="hidden" name="accountId" value={suggestion.accountId} />
			<input type="hidden" name="salaryDueDate" value={suggestion.salaryDueDate} />
			<Button type="submit" variant="plain">Nicht jetzt</Button>
		</form>
	{/if}
</section>
