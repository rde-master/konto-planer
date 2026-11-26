<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import FileText from '@lucide/svelte/icons/file-text';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import FormField from '#lib/components/FormField.svelte';
	import ToggleField from '#lib/components/ToggleField.svelte';
	import { LETTER_OPTIONS, LETTER_OPTION_LABELS } from '#lib/cancellation.js';
	import { formatDay } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	type Failed = { errors: Partial<Record<string, string>>; input: Record<string, string> };
	const failed = $derived.by((): Failed | null => {
		const f = form as Partial<Failed> | null | undefined;
		return f?.errors && f.input ? (f as Failed) : null;
	});
	const message = $derived(form && 'message' in form ? (form.message as string) : undefined);
	const value = (name: string, fallback: string) => failed?.input[name] ?? fallback;
	let pending = $state(false);
</script>

<Page title="Kündigung" back={{ path: `dauerposten/${data.item.id}`, label: data.item.name }}>
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{/if}

	{#if data.created}
		<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Schreiben erstellt">
			<div class="mb-3 flex items-center gap-3">
				<FileText class="size-6 shrink-0 text-accent" />
				<p class="text-[17px] font-semibold">Kündigungsschreiben erstellt</p>
			</div>
			<p class="mb-4 text-[15px] text-label-2">
				Das PDF liegt auch als Anhang am Dauerposten. Unterschreiben, versenden – am besten per
				Einschreiben{data.email ? ` oder an ${data.email}` : ''}.
			</p>
			<a
				href={resolve(`dauerposten/${data.item.id}/anhang/${data.created}`)}
				class="mb-3 flex min-h-[50px] w-full items-center justify-center rounded-full bg-accent px-5 text-[17px] font-semibold text-white active:opacity-70"
				download
			>
				PDF herunterladen
			</a>
			{#if !data.cancelled}
				<form method="POST" action="?/cancelled" use:enhance>
					<Button type="submit" variant="tinted">
						„Gekündigt am {formatDay(data.today)}“ eintragen
					</Button>
				</form>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Setzt das Ende des Dauerpostens auf das berechnete Vertragsende.
				</p>
			{/if}
		</section>
	{/if}

	<form
		class="kp-flow"
		method="POST"
		action="?/create"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				pending = false;
				await update({ reset: false });
			};
		}}
	>
		<section class="mb-6">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Absender</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Name"
					name="senderName"
					value={value('senderName', data.sender.name)}
					autocomplete="name"
					error={failed?.errors.senderName}
				/>
				<FormField
					label="Straße und Hausnummer"
					name="senderStreet"
					value={value('senderStreet', data.sender.street)}
					autocomplete="street-address"
				/>
				<FormField
					label="PLZ"
					name="senderPostalCode"
					value={value('senderPostalCode', data.sender.postalCode)}
					inputmode="numeric"
					autocomplete="postal-code"
				/>
				<FormField
					label="Ort"
					name="senderCity"
					value={value('senderCity', data.sender.city)}
					autocomplete="address-level2"
					error={failed?.errors.senderCity}
				/>
				<ToggleField label="Als meine Anschrift merken" name="remember" initial={true} />
			</ul>
		</section>

		<section class="mb-6">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Empfänger</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				<FormField
					label="Firma"
					name="recipientName"
					value={value('recipientName', data.recipient.name)}
					autocomplete="off"
					error={failed?.errors.recipientName}
				/>
				<FormField
					label="Straße oder Postfach"
					name="recipientStreet"
					value={value('recipientStreet', data.recipient.street)}
					autocomplete="off"
				/>
				<FormField
					label="PLZ"
					name="recipientPostalCode"
					value={value('recipientPostalCode', data.recipient.postalCode)}
					inputmode="numeric"
					autocomplete="off"
				/>
				<FormField
					label="Ort"
					name="recipientCity"
					value={value('recipientCity', data.recipient.city)}
					autocomplete="off"
					error={failed?.errors.recipientCity}
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Vorausgefüllt aus der Kündigungsadresse im Vertrag.
			</p>
		</section>

		<section class="mb-6">
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Inhalt</h2>
			<ul
				class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
			>
				{#each LETTER_OPTIONS as o (o)}
					<ToggleField label={LETTER_OPTION_LABELS[o]} name={o} initial={true} />
				{/each}
				<FormField
					label="Ort für die Datumszeile (optional)"
					name="place"
					value={value('place', '')}
					autocomplete="off"
					placeholder="sonst dein Wohnort"
				/>
			</ul>
			<p class="mt-1.5 px-4 text-[13px] text-label-2">
				Gekündigt wird ordentlich zum nächstmöglichen Zeitpunkt{data.end
					? `, laut Vertragsdaten zum ${formatDay(data.end)}`
					: ''}.
			</p>
		</section>

		<Button type="submit" disabled={pending}>Kündigungsschreiben erstellen (PDF)</Button>
	</form>
</Page>
