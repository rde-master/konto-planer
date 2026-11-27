<script lang="ts" module>
	/** A template as the quick entry receives it (see `quickTemplates()`). */
	export type QuickTemplate = {
		id: string;
		name: string;
		kind: string;
		amount: string;
		accountId: string | null;
		categoryId: string | null;
		counterparty: string | null;
	};
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { fabTakeover } from '#lib/fab.svelte.js';
	import Plus from '@lucide/svelte/icons/plus';
	import Sheet from './Sheet.svelte';
	import BookingFields from './BookingFields.svelte';

	/**
	 * Quick entry: round plus button on every page (phone: above the tab bar, desktop: in the
	 * sidebar). Books amount, account and category for today. The last account is remembered
	 * per device. Templates above the fields fill everything in with one tap.
	 */
	let {
		accounts,
		categories,
		templates = []
	}: {
		accounts: { value: string; label: string }[];
		categories: { label: string; options: { value: string; label: string }[] }[];
		templates?: QuickTemplate[];
	} = $props();

	const STORAGE_KEY = 'kontoplaner.quickAccount';
	// A page may use the plus button for its own form (the booking list).
	const taken = $derived(fabTakeover());

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);
	let errors: Partial<Record<string, string>> | undefined = $state();
	let values = $state({ kind: 'expense', amount: '', accountId: '', categoryId: '' });
	/** Template applied last; its payee is booked along. */
	let chosen: QuickTemplate | null = $state(null);
	let toast: string | null = $state(null);
	let toastTimer: ReturnType<typeof setTimeout> | undefined;

	function rememberedAccount(): string {
		let stored: string | null = null;
		try {
			stored = localStorage.getItem(STORAGE_KEY);
		} catch {
			// Storage may be blocked (private mode); fall back to the first account.
		}
		return accounts.some((a) => a.value === stored) ? stored! : (accounts[0]?.value ?? '');
	}

	function remember(accountId: string) {
		try {
			localStorage.setItem(STORAGE_KEY, accountId);
		} catch {
			// Not essential.
		}
	}

	/** Opens the sheet (also called by the sidebar button on desktop). */
	export function start() {
		values = { kind: 'expense', amount: '', accountId: rememberedAccount(), categoryId: '' };
		chosen = null;
		errors = undefined;
		key++;
		open = true;
	}

	/** Fills the sheet from a template; tapping it again clears it. */
	async function apply(t: QuickTemplate) {
		const accountId = rememberedAccount();
		if (chosen?.id === t.id) {
			chosen = null;
			values = { kind: 'expense', amount: '', accountId, categoryId: '' };
		} else {
			chosen = t;
			values = {
				kind: t.kind,
				amount: t.amount,
				accountId: t.accountId ?? accountId,
				categoryId: t.categoryId ?? ''
			};
		}
		errors = undefined;
		key++;
		await tick();
		const amount = document.querySelector<HTMLInputElement>('#quick-entry input[name="amount"]');
		if (chosen && !chosen.amount) amount?.focus();
	}

	function showToast(text: string) {
		toast = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 4000);
	}
</script>

<button
	type="button"
	aria-label={taken?.label ?? 'Schnellerfassung'}
	onclick={taken ? taken.run : start}
	class="fixed right-4 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+4.5rem)] z-40 grid size-14 place-items-center rounded-full bg-accent text-accent-contrast shadow-lg active:opacity-80 md:hidden"
>
	<Plus class="size-7" strokeWidth={2.4} />
</button>

<Sheet
	bind:open
	title="Schnellerfassung"
	confirmLabel="Buchen"
	formId="quick-entry"
	confirmDisabled={pending}
>
	<form
		id="quick-entry"
		method="POST"
		action="{resolve('buchungen')}?/create"
		use:enhance={({ formData }) => {
			pending = true;
			const chosen = formData.get('accountId');
			const accountId = typeof chosen === 'string' ? chosen : '';
			return async ({ result }) => {
				pending = false;
				if (result.type === 'success') {
					remember(accountId);
					open = false;
					const created: unknown = result.data?.created;
					showToast(typeof created === 'string' ? created : 'Gebucht.');
					await invalidateAll();
				} else if (result.type === 'failure') {
					errors = result.data?.errors as typeof errors;
					const input = result.data?.input as typeof values | undefined;
					if (input) values = { ...input };
					key++;
				} else await applyAction(result);
			};
		}}
	>
		{#if templates.length}
			<div
				role="group"
				aria-label="Vorlagen"
				class="-mx-4 mb-4 flex [scrollbar-width:none] gap-2 overflow-x-auto px-4 pb-1"
			>
				{#each templates as t (t.id)}
					<button
						type="button"
						aria-pressed={chosen?.id === t.id}
						onclick={() => apply(t)}
						class={[
							'min-h-9 shrink-0 rounded-full px-4 text-[15px] font-medium whitespace-nowrap active:opacity-60',
							chosen?.id === t.id ? 'bg-accent text-accent-contrast' : 'bg-card text-accent'
						]}
					>
						{t.name}
					</button>
				{/each}
			</div>
		{/if}
		{#if chosen?.counterparty}
			<input type="hidden" name="counterparty" value={chosen.counterparty} />
		{/if}
		{#key key}
			<BookingFields {values} {errors} {accounts} {categories} />
		{/key}
		{#if chosen?.counterparty}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">Empfänger/Zahler: {chosen.counterparty}</p>
		{/if}
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Gebucht wird mit dem heutigen Datum. Datum, Empfänger und Notiz kannst du danach unter
			„Buchungen“ ändern.
		</p>
		<a
			href={resolve('einstellungen/vorlagen')}
			onclick={() => (open = false)}
			class="mt-4 block px-4 text-[15px] text-accent"
		>
			{templates.length ? 'Vorlagen verwalten' : 'Vorlagen anlegen'}
		</a>
	</form>
</Sheet>

{#if toast}
	<p
		role="status"
		class="fixed inset-x-4 top-[max(0.75rem,env(safe-area-inset-top))] z-50 mx-auto max-w-md rounded-2xl px-4 py-3 text-center text-[15px] shadow-lg glass"
	>
		{toast}
	</p>
{/if}
