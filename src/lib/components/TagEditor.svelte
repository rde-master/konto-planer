<script lang="ts">
	import { enhance } from '$app/forms';
	import Hash from '@lucide/svelte/icons/hash';
	import Sheet from './Sheet.svelte';
	import { resolve } from '$app/paths';

	/** Tags of a booking or recurring item; inherited ones (from the item) are shown, not editable. */
	let {
		allTags,
		selected,
		inherited = [],
		canEdit,
		error
	}: {
		allTags: { id: string; name: string }[];
		selected: string[];
		/** Tags of the recurring item (they apply to the booking). */
		inherited?: string[];
		canEdit: boolean;
		error?: string;
	} = $props();

	let open = $state(false);
	let pending = $state(false);
	let key = $state(0);

	const byId = $derived(new Map(allTags.map((t) => [t.id, t])));
	const shown = $derived([
		...selected.map((id) => ({ id, name: byId.get(id)?.name ?? '', inherited: false })),
		...inherited
			.filter((id) => !selected.includes(id))
			.map((id) => ({ id, name: byId.get(id)?.name ?? '', inherited: true }))
	]);

	function start() {
		key++;
		open = true;
	}
</script>

{#if shown.length || canEdit}
	<section class="mb-8" aria-label="Tags">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Tags</h2>
		<div class="rounded-[var(--radius-row)] bg-card px-4 py-3">
			{#if shown.length}
				<ul class="flex flex-wrap gap-2">
					{#each shown as t (t.id)}
						<li>
							<a
								href={resolve(`tags/${t.id}`)}
								class={[
									'inline-flex items-center gap-1 rounded-full px-3 py-1 text-[15px]',
									t.inherited ? 'bg-fill text-label-2' : 'bg-accent/15 text-accent'
								]}
								title={t.inherited ? 'vom Dauerposten' : undefined}
							>
								<Hash class="size-3.5" strokeWidth={2.5} />{t.name}
							</a>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-[15px] text-label-2">Keine Tags.</p>
			{/if}
			{#if canEdit}
				<button
					type="button"
					onclick={start}
					class="kp-text-button mt-2 text-[17px] text-accent active:opacity-60"
				>
					Tags ändern
				</button>
			{/if}
		</div>
		{#if inherited.length}
			<p class="mt-1.5 px-4 text-[13px] text-label-2">Graue Tags kommen vom Dauerposten.</p>
		{/if}
	</section>
{/if}

{#if canEdit}
	<Sheet bind:open title="Tags" confirmLabel="Sichern" formId="tag-form" confirmDisabled={pending}>
		<form
			id="tag-form"
			method="POST"
			action="?/tags"
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
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
				>
					{#each allTags as t (t.id)}
						<li>
							<label class="flex min-h-11 items-center gap-3 px-4 py-2">
								<input
									type="checkbox"
									name="tag"
									value={t.id}
									checked={selected.includes(t.id)}
									class="size-5 accent-[var(--kp-accent)]"
								/>
								<span class="flex-1 text-[17px]">{t.name}</span>
								{#if inherited.includes(t.id)}
									<span class="text-[13px] text-label-2">vom Dauerposten</span>
								{/if}
							</label>
						</li>
					{/each}
					<li class="flex flex-col px-4 py-2">
						<label for="new-tag" class="text-[13px] text-label-2">Neuer Tag</label>
						<input
							id="new-tag"
							name="newTag"
							maxlength={30}
							autocomplete="off"
							placeholder="z. B. Urlaub Italien"
							aria-invalid={error ? 'true' : undefined}
							class="w-full bg-transparent py-1 text-[17px] outline-none placeholder:text-label-3"
						/>
						{#if error}<span class="text-[13px] text-danger">{error}</span>{/if}
					</li>
				</ul>
			{/key}
		</form>
	</Sheet>
{/if}
