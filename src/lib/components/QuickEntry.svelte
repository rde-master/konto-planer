<script lang="ts">
	import { applyAction, enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Plus from '@lucide/svelte/icons/plus';
	import Sheet from './Sheet.svelte';
	import BookingFields from './BookingFields.svelte';

	/**
	 * Quick entry: round plus button on every page (phone: above the tab bar, desktop: in the
	 * sidebar). Books amount, account and category for today. The last account is remembered
	 * per device.
	 */
	let {
		accounts,
		categories
	}: {
		accounts: { value: string; label: string }[];
		categories: { label: string; options: { value: string; label: string }[] }[];
	} = $props();

	const STORAGE_KEY = 'kontoplaner.quickAccount';

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);
	let errors: Partial<Record<string, string>> | undefined = $state();
	let values = $state({ kind: 'expense', amount: '', accountId: '', categoryId: '' });
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
		errors = undefined;
		key++;
		open = true;
	}

	function showToast(text: string) {
		toast = text;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = null), 4000);
	}
</script>

<button
	type="button"
	aria-label="Schnellerfassung"
	onclick={start}
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
		{#key key}
			<BookingFields {values} {errors} {accounts} {categories} />
		{/key}
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Gebucht wird mit dem heutigen Datum. Datum, Empfänger und Notiz kannst du danach unter
			„Buchungen“ ändern.
		</p>
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
