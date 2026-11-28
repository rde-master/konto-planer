<script lang="ts">
	/**
	 * Switch on pages with bookings: show the alternative name of the recurring item instead
	 * of the bank's payee name. Remembered per user; only offered where such a name exists.
	 */
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import ToggleField from './ToggleField.svelte';

	let {
		prefs,
		show = prefs.any,
		hint = 'statt der Namen von der Bank',
		class: klass = 'mb-6'
	}: {
		prefs: { on: boolean; any: boolean };
		/** What the alternative names stand in for on this page. */
		hint?: string;
		/** False hides the switch (nothing on the page it would change). */
		show?: boolean;
		class?: string;
	} = $props();

	/** Counts failed attempts: the switch is drawn anew in its saved position. */
	let attempt = $state(0);
	let failed = $state(false);

	async function set(on: boolean) {
		failed = false;
		try {
			const res = await fetch(resolve('api/bezeichnungen'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ on })
			});
			if (!res.ok) throw new Error(String(res.status));
			await invalidateAll();
		} catch {
			failed = true;
			attempt++;
		}
	}
</script>

{#if show}
	<div class={['kp-span', klass]}>
		<ul class="overflow-hidden rounded-[var(--radius-row)] bg-card">
			{#key attempt}
				<ToggleField
					label="Alternative Bezeichnungen"
					name="altNames"
					{hint}
					initial={prefs.on}
					onchange={set}
				/>
			{/key}
		</ul>
		{#if failed}
			<p role="alert" class="mt-1.5 px-4 text-[13px] text-danger">
				Die Einstellung ließ sich nicht sichern.
			</p>
		{/if}
	</div>
{/if}
