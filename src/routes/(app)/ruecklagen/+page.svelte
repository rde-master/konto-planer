<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Vault from '@lucide/svelte/icons/vault';
	import Page from '#lib/components/Page.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import ToggleField from '#lib/components/ToggleField.svelte';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro, formatEuroInput } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';
	import { intervalLabel } from '#lib/recurring.js';
	import { nextMonthStart } from '#lib/reserves.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Reserve = (typeof data.reserves)[number];

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);
	let current: Reserve | null = $state(null);
	let withTransfer = $state(false);

	const total = $derived(data.reserves.reduce((sum, r) => sum + r.rate, 0));
	const covered = $derived(
		data.reserves.filter((r) => r.goals.length).reduce((sum, r) => sum + r.rate, 0)
	);

	const failed = $derived(form && 'input' in form && form.input ? form.input : null);
	const errors = $derived<Partial<Record<string, string>> | undefined>(
		form && 'errors' in form ? form.errors : undefined
	);
	const created = $derived(form && 'created' in form ? form.created : undefined);

	const values = $derived.by(() => {
		const r = current;
		if (failed && r && failed.recurringId === r.id) return failed;
		return {
			recurringId: r?.id ?? '',
			accountId: data.savings[0]?.value ?? '',
			name: r?.name ?? '',
			allocated: r?.suggested ? formatEuroInput(r.suggested) : '',
			withTransfer: '',
			sourceAccountId: data.giro.some((g) => g.value === r?.account.id)
				? (r?.account.id ?? '')
				: (data.giro[0]?.value ?? ''),
			transferAmount: r ? formatEuroInput(r.rate) : '',
			transferStart: nextMonthStart(data.today)
		};
	});

	function start(r: Reserve) {
		current = r;
		withTransfer = false;
		key++;
		open = true;
	}

	function toggleTransfer(checked: boolean) {
		withTransfer = checked;
	}

	onMount(() => {
		const r = data.reserves.find((x) => x.id === data.preselect);
		if (r && data.savings.length) start(r);
	});
</script>

<Page title="Rücklagen" back={{ path: 'mehr', label: 'Mehr' }}>
	{#if created}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			Sparziel „{created}“ angelegt.
		</p>
	{/if}

	{#if data.reserves.length === 0}
		<div class="rounded-[var(--radius-card)] bg-card px-6 py-12 text-center">
			<Vault class="mx-auto mb-3 size-10 text-label-3" />
			<p class="text-[17px] font-semibold">Keine Jahreszahlungen</p>
			<p class="mt-1 text-[15px] text-label-2">
				Ausgaben, die vierteljährlich, halbjährlich, jährlich oder in noch größerem Abstand fällig
				sind, erscheinen hier mit ihrer Monatsrate.
			</p>
		</div>
	{:else}
		<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Summe">
			<p class="text-[13px] text-label-2">Rücklage im Monat</p>
			<p class="text-[28px] font-bold tabular" aria-label="Rücklage im Monat">
				{formatEuro(total)}
			</p>
			<p class="text-[15px] text-label-2 tabular">
				davon {formatEuro(covered)} mit Sparziel
			</p>
		</section>

		<section class="mb-8" aria-label="Jahreszahlungen">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Jahreszahlungen</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each data.reserves as r (r.id)}
					<li aria-label={r.name}>
						<a
							href={resolve(`dauerposten/${r.id}`)}
							class="flex min-h-14 items-center gap-3 px-4 py-2 active:bg-fill"
						>
							<span
								class="grid size-9 shrink-0 place-items-center rounded-full text-white"
								style:background-color={accountColorCss(r.account.color)}
							>
								<Vault class="size-5" strokeWidth={2.2} />
							</span>
							<span class="min-w-0 flex-1">
								<span class="block truncate text-[17px]">{r.name}</span>
								<span class="block truncate text-[13px] text-label-2">
									{intervalLabel(r)} · {formatEuro(r.next.amount)}
								</span>
								<span class="block truncate text-[13px] text-label-2">
									nächste am {formatDay(r.next.date)}
								</span>
							</span>
							<span class="shrink-0 text-right">
								<span class="block text-[17px] tabular">{formatEuro(r.rate)}</span>
								<span class="block text-[13px] text-label-2">im Monat</span>
							</span>
							<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
						</a>
						<div class="flex flex-wrap gap-x-4 gap-y-1 pr-4 pb-3 pl-16 text-[15px]">
							{#each r.goals as g (g.id)}
								<a
									href={resolve(`sparziele/${g.id}`)}
									class="text-accent"
									aria-label="Sparziel {g.name}"
								>
									Sparziel: {formatEuro(g.allocated)} / {formatEuro(g.targetAmount)}
								</a>
							{:else}
								{#if data.savings.length}
									<button type="button" class="kp-text-button text-accent" onclick={() => start(r)}>
										Als Sparziel anlegen
									</button>
								{:else}
									<span class="text-label-2">ohne Sparziel</span>
								{/if}
							{/each}
						</div>
					</li>
				{/each}
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Monatsrate = Betrag der nächsten Zahlung, verteilt auf die Monate des Intervalls. Mit einem
				Sparziel bucht die App das Zurückgelegte am Zahltag aufs Girokonto.
			</p>
		</section>
	{/if}
</Page>

{#if data.savings.length}
	<Sheet
		bind:open
		title="Als Sparziel anlegen"
		confirmLabel="Anlegen"
		formId="reserve-form"
		confirmDisabled={pending}
	>
		<form
			id="reserve-form"
			method="POST"
			action="?/create"
			use:enhance={() => {
				pending = true;
				return async ({ result, update }) => {
					pending = false;
					if (result.type === 'success') open = false;
					await update({ reset: false });
					withTransfer = !!failed && failed.withTransfer === 'on';
					key++;
				};
			}}
		>
			{#key key}
				{#if current}
					<p class="mb-4 px-4 text-[15px] text-label-2">
						Für „{current.name}“: {formatEuro(current.next.amount)} am {formatDay(
							current.next.date
						)}, {formatEuro(current.rate)} im Monat.
					</p>
					<input type="hidden" name="recurringId" value={current.id} />
					<ul
						class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					>
						<SelectField
							label="Sparbuch"
							name="accountId"
							options={data.savings}
							value={values.accountId}
							error={errors?.accountId}
						/>
						<FormField
							label="Name"
							name="name"
							value={values.name}
							maxlength={60}
							autocomplete="off"
							required
							error={errors?.name}
						/>
						<FormField
							label="Schon zurückgelegt in €"
							name="allocated"
							value={values.allocated}
							inputmode="decimal"
							autocomplete="off"
							placeholder="0,00"
							error={errors?.allocated}
						/>
					</ul>
					<p class="mt-1.5 mb-6 px-4 text-[13px] text-label-2">
						Vorschlag: was bei gleichmäßigem Sparen seit der letzten Zahlung schon da sein sollte ({formatEuro(
							current.suggested
						)}).
					</p>
					<ul
						class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					>
						<ToggleField
							label="Monatliche Umbuchung anlegen"
							name="withTransfer"
							hint="Dauerauftrag vom Girokonto aufs Sparbuch"
							initial={values.withTransfer === 'on'}
							onchange={toggleTransfer}
						/>
						{#if withTransfer}
							<SelectField
								label="Von Girokonto"
								name="sourceAccountId"
								options={data.giro}
								value={values.sourceAccountId}
								error={errors?.sourceAccountId}
							/>
							<FormField
								label="Betrag im Monat in €"
								name="transferAmount"
								value={values.transferAmount}
								inputmode="decimal"
								autocomplete="off"
								error={errors?.transferAmount}
							/>
							<FormField
								label="Erste Umbuchung"
								name="transferStart"
								type="date"
								value={values.transferStart}
								error={errors?.transferStart}
							/>
						{/if}
					</ul>
				{/if}
			{/key}
		</form>
	</Sheet>
{/if}
