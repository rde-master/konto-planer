<script lang="ts">
	import { enhance } from '$app/forms';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import ListGroup from '#lib/components/ListGroup.svelte';
	import ListRow from '#lib/components/ListRow.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<Page title="Meine Benachrichtigungen" back={{ path: 'einstellungen', label: 'Einstellungen' }}>
	{#if form && 'message' in form && form.message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{form.message}
		</p>
	{:else if form && 'success' in form}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{form.success}
		</p>
	{/if}

	<ListGroup
		header="E-Mail"
		footer={data.smtpReady
			? 'Die Adresse trägt der Admin unter „Benutzer“ ein.'
			: 'Der E-Mail-Versand ist noch nicht eingerichtet.'}
	>
		<ListRow label="Adresse" value={data.email ?? 'keine'} />
	</ListGroup>

	<section class="mb-8" aria-label="Home Assistant">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Home Assistant</h2>
		{#if !data.haReady}
			<p class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-label-2">
				Home Assistant ist noch nicht eingerichtet.
			</p>
		{:else}
			{#if data.haError}
				<p class="mb-3 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger">
					{data.haError}
				</p>
			{/if}
			<form
				method="POST"
				action="?/targets"
				use:enhance={() =>
					async ({ update }) =>
						update({ reset: false })}
			>
				<ul
					class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
					aria-label="Geräte"
				>
					{#each data.services as service (service)}
						<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
							<input
								id="t-{service}"
								type="checkbox"
								name="target"
								value={service}
								checked={data.targets.includes(service)}
								class="size-5 accent-[var(--kp-accent)]"
							/>
							<label for="t-{service}" class="flex-1 text-[17px]">{service}</label>
						</li>
					{:else}
						<li class="px-4 py-3 text-[15px] text-label-2">
							Home Assistant meldet keine Benachrichtigungsdienste.
						</li>
					{/each}
				</ul>
				<p class="mt-1.5 px-4 text-[13px] text-label-2">
					Die Dienste heißen meist „mobile_app_…“ nach deinem Handy (Home-Assistant-App).
				</p>
				<div class="mt-3"><Button type="submit">Geräte sichern</Button></div>
			</form>
			<form method="POST" action="?/test" use:enhance class="mt-3">
				<Button type="submit" variant="tinted">Testnachricht senden</Button>
			</form>
		{/if}
	</section>
</Page>
