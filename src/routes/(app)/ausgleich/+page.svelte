<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import HandCoins from '@lucide/svelte/icons/hand-coins';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const o = $derived(data.overview);
	const me = $derived(data.user.id);
	let open = $state(false);
	let key = $state(0);
	let pending = $state(false);
	let preset = $state<{ from: string; to: string; amount: number } | null>(null);

	type SettleInput = {
		fromUserId: string;
		toUserId: string;
		amount: string;
		date: string;
		note: string;
	};
	const failed = $derived.by(
		(): { input: SettleInput; errors: Partial<Record<string, string>> } | null => {
			const f = form as {
				action?: string;
				input?: SettleInput;
				errors?: Partial<Record<string, string>>;
			} | null;
			return f?.action === 'settle' && f.input ? { input: f.input, errors: f.errors ?? {} } : null;
		}
	);
	const values = $derived<SettleInput>(
		failed?.input ?? {
			fromUserId: preset?.from ?? me,
			toUserId: preset?.to ?? data.people.find((p) => p.id !== me)?.id ?? '',
			amount: preset ? formatEuroInput(preset.amount) : '',
			date: data.today,
			note: ''
		}
	);
	const people = $derived(data.people.map((p) => ({ value: p.id, label: p.name })));

	function start(d: { fromUserId: string; toUserId: string; amount: number } | null) {
		preset = d ? { from: d.fromUserId, to: d.toUserId, amount: d.amount } : null;
		key++;
		open = true;
	}
</script>

<Page title="Ausgleich" back={{ path: 'mehr', label: 'Mehr' }}>
	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{:else if form && 'success' in form && form.success}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{form.success}
		</p>
	{/if}

	<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Dein Stand">
		<p class="text-[13px] text-label-2">
			{o.net > 0 ? 'Du bekommst' : o.net < 0 ? 'Du schuldest' : 'Alles ausgeglichen'}
		</p>
		<p
			class={['text-[28px] font-bold tabular', o.net > 0 && 'text-income']}
			aria-label="Dein Saldo"
		>
			{formatEuro(Math.abs(o.net))}
		</p>
	</section>

	{#if o.debts.length}
		<section class="mb-8" aria-label="Offen">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Offen</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each o.debts as d (d.fromUserId + d.toUserId)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
						<span class="flex-1">
							{d.fromUserId === me ? 'Du' : d.fromName} → {d.toUserId === me ? 'dich' : d.toName}
						</span>
						<span class="tabular">{formatEuro(d.amount)}</span>
						<button
							type="button"
							onclick={() => start(d)}
							class="kp-text-button text-[15px] text-accent active:opacity-60"
							aria-label="Ausgleich {d.fromName} an {d.toName} erfassen"
						>
							Ausgleichen
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<div class="mb-8">
		<Button type="button" variant="tinted" onclick={() => start(null)}>Ausgleich erfassen</Button>
	</div>

	{#if o.expenses.length}
		<section class="mb-8" aria-label="Gemeinsame Ausgaben">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Gemeinsame Ausgaben</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each o.expenses as e (e.bookingId)}
					<li>
						{#snippet body()}
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{e.label}</span>
								<span class="block truncate text-[13px] text-label-2">
									{formatDay(e.date)} · bezahlt von {e.payerName}{e.own
										? ` · dein Anteil ${formatEuro(e.own)}`
										: ''}
								</span>
							</span>
							<span class="tabular">{formatEuro(e.amount)}</span>
						{/snippet}
						{#if e.visible}
							<a
								href={resolve(`buchungen/${e.bookingId}`)}
								class="flex min-h-11 items-center gap-3 px-4 py-2 active:bg-fill"
							>
								{@render body()}
							</a>
						{:else}
							<div class="flex min-h-11 items-center gap-3 px-4 py-2">{@render body()}</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<div class="mb-8 rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<HandCoins class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Noch keine gemeinsamen Ausgaben</p>
			<p class="mt-1 text-[15px] text-label-2">
				Markiere an einer Buchung „Als gemeinsame Ausgabe“, wer bezahlt hat und wer beteiligt ist.
			</p>
		</div>
	{/if}

	{#if o.settlements.length}
		<section class="mb-8" aria-label="Ausgleiche">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Ausgleiche</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each o.settlements as s (s.id)}
					<li class="flex min-h-11 items-center gap-3 px-4 py-2.5">
						<span class="min-w-0 flex-1">
							<span class="block truncate">{s.fromName} → {s.toName}</span>
							<span class="block truncate text-[13px] text-label-2">
								{formatDay(s.date)}{s.note ? ` · ${s.note}` : ''}
							</span>
						</span>
						<span class="tabular">{formatEuro(s.amount)}</span>
						{#if s.canDelete}
							<form method="POST" action="?/delete" use:enhance>
								<input type="hidden" name="id" value={s.id} />
								<button
									type="submit"
									class="kp-text-button text-[15px] text-danger"
									aria-label="Ausgleich vom {formatDay(s.date)} löschen"
								>
									Löschen
								</button>
							</form>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}
</Page>

<Sheet
	bind:open
	title="Ausgleich erfassen"
	confirmLabel="Sichern"
	formId="settle-form"
	confirmDisabled={pending}
>
	<form
		id="settle-form"
		method="POST"
		action="?/settle"
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
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<SelectField
					label="Von"
					name="fromUserId"
					options={people}
					value={values.fromUserId}
					error={failed?.errors.fromUserId}
				/>
				<SelectField
					label="An"
					name="toUserId"
					options={people}
					value={values.toUserId}
					error={failed?.errors.toUserId}
				/>
				<FormField
					label="Betrag in €"
					name="amount"
					value={values.amount}
					inputmode="decimal"
					autocomplete="off"
					placeholder="0,00"
					error={failed?.errors.amount}
				/>
				<FormField
					label="Datum"
					name="date"
					type="date"
					value={values.date}
					error={failed?.errors.date}
				/>
				<FormField
					label="Notiz (optional)"
					name="note"
					value={values.note}
					maxlength={100}
					autocomplete="off"
					error={failed?.errors.note}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Der Ausgleich hält fest, dass Geld geflossen ist; gebucht wird dabei nichts.
			</p>
		{/key}
	</form>
</Sheet>
