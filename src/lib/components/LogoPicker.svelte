<script lang="ts">
	import { enhance } from '$app/forms';
	import Search from '@lucide/svelte/icons/search';
	import ListGroup from './ListGroup.svelte';
	import ListRow from './ListRow.svelte';
	import Sheet from './Sheet.svelte';
	import Logo from './Logo.svelte';
	import { NO_LOGO, type LogoRef } from '#lib/logos.js';

	/** "Logo ändern": search Simple Icons, or automatic / initials; applies to the payee. */
	let {
		name,
		logo,
		chosen
	}: {
		/** Payee name (for initials and the hint). */
		name: string;
		logo: LogoRef | null;
		/** Stored choice: a slug, "-" or null (automatic). */
		chosen: string | null;
	} = $props();

	let open = $state(false);
	let query = $state('');
	let results = $state<{ slug: string; title: string; hex: string }[]>([]);
	let timer: ReturnType<typeof setTimeout> | undefined;
	let form: HTMLFormElement | undefined = $state();
	let slug = $state('');

	function start() {
		query = name.split(/\s+/)[0] ?? '';
		open = true;
		void search();
	}

	async function search() {
		const q = query.trim();
		if (!q) {
			results = [];
			return;
		}
		const res = await fetch(`/api/logos?q=${encodeURIComponent(q)}`);
		if (res.ok) results = (await res.json()) as typeof results;
	}

	function typed() {
		clearTimeout(timer);
		timer = setTimeout(() => void search(), 250);
	}

	function choose(value: string) {
		slug = value;
		queueMicrotask(() => form?.requestSubmit());
	}
</script>

<ListGroup
	footer={chosen
		? 'Von Hand gewählt; gilt für alle Buchungen und Dauerposten dieses Empfängers.'
		: 'Automatisch nach dem Namen erkannt.'}
>
	<ListRow label="Logo ändern" onclick={start} />
</ListGroup>

<Sheet bind:open title="Logo" closeLabel="Fertig">
	<form
		method="POST"
		action="?/logo"
		bind:this={form}
		use:enhance={() =>
			async ({ result, update }) => {
				if (result.type === 'success') open = false;
				await update({ reset: false });
			}}
	>
		<input type="hidden" name="slug" value={slug} />
	</form>
	<div class="mb-4 flex items-center gap-2 rounded-[var(--radius-row)] bg-card px-4 py-2">
		<Search class="size-5 text-label-3" />
		<input
			bind:value={query}
			oninput={typed}
			aria-label="Logo suchen"
			placeholder="Firma suchen, z. B. Telekom"
			autocomplete="off"
			class="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-label-3"
		/>
	</div>
	<ul class="mb-4 grid grid-cols-3 gap-2" aria-label="Logos">
		{#each results as r (r.slug)}
			<li>
				<button
					type="button"
					onclick={() => choose(r.slug)}
					class={[
						'flex w-full flex-col items-center gap-1 rounded-[var(--radius-row)] bg-card p-3 text-center active:opacity-60',
						logo?.slug === r.slug && 'ring-2 ring-accent'
					]}
				>
					<Logo {name} logo={{ slug: r.slug, hex: r.hex }} />
					<span class="line-clamp-2 text-[13px]">{r.title}</span>
				</button>
			</li>
		{/each}
	</ul>
	{#if query.trim() && !results.length}
		<p class="mb-4 px-4 text-[15px] text-label-2">Kein Logo gefunden.</p>
	{/if}
	<ul class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card">
		<li>
			<button
				type="button"
				onclick={() => choose('')}
				class="flex min-h-11 w-full items-center px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
			>
				Automatisch erkennen
			</button>
		</li>
		<li>
			<button
				type="button"
				onclick={() => choose(NO_LOGO)}
				class="flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left text-[17px] text-accent active:bg-fill"
			>
				<Logo {name} logo={null} />
				Kein Logo (Initialen)
			</button>
		</li>
	</ul>
	<p class="mt-3 px-4 text-[13px] text-label-2">
		Logos: Simple Icons (CC0). Markennamen und Logos gehören ihren Inhabern.
	</p>
</Sheet>
