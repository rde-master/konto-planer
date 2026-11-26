<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import WidgetPreview from '#lib/components/WidgetPreview.svelte';
	import {
		SIZE_LABELS,
		TEMPLATE_INFO,
		WIDGET_SIZES,
		WIDGET_TEMPLATES,
		isLockSize,
		lockContent,
		TEMPLATE_LAYOUTS,
		widgetBlocks,
		type WidgetSize,
		type WidgetTemplate
	} from '#lib/widgets.js';
	import { formatDateTime } from '#lib/dates.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const created = $derived(form && 'created' in form ? form.created : null);
	const status = $derived(form && 'success' in form ? form.success : null);
	const message = $derived(form && 'message' in form ? form.message : null);

	let sizes = $state<Record<string, WidgetSize>>({
		available: 'small',
		payments: 'medium',
		accounts: 'medium'
	});
	let chosen = $state<Record<string, string[]>>({ available: [], payments: [], accounts: [] });
	let copied = $state(false);

	function preview(t: WidgetTemplate) {
		const ids = chosen[t];
		const accounts = ids.length
			? data.data.accounts.filter((a) => ids.includes(a.id ?? ''))
			: data.data.accounts;
		const payments = ids.length
			? data.data.payments.filter((p) => ids.includes(p.accountId ?? ''))
			: data.data.payments;
		return widgetBlocks(t, sizes[t], { accounts, payments });
	}
	function lockPreview(t: WidgetTemplate) {
		const ids = chosen[t];
		return lockContent(TEMPLATE_LAYOUTS[t], sizes[t], {
			accounts: ids.length
				? data.data.accounts.filter((a) => ids.includes(a.id ?? ''))
				: data.data.accounts,
			payments: ids.length
				? data.data.payments.filter((p) => ids.includes(p.accountId ?? ''))
				: data.data.payments
		});
	}
	function toggle(t: string, id: string, on: boolean) {
		chosen[t] = on ? [...chosen[t], id] : chosen[t].filter((x) => x !== id);
	}
	async function copy(script: string) {
		try {
			await navigator.clipboard.writeText(script);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<Page title="Widgets">
	{#if message}
		<p
			role="alert"
			class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px] text-danger"
		>
			{message}
		</p>
	{:else if status}
		<p role="status" class="mb-4 rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]">
			{status}
		</p>
	{/if}

	<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="So geht's">
		<p class="mb-2 text-[17px] font-semibold">In drei Schritten auf den Home-Bildschirm</p>
		<ol class="list-decimal space-y-1 pl-5 text-[15px] text-label-2">
			<li>Die kostenlose App <strong>Scriptable</strong> aus dem App Store laden.</li>
			<li>
				Hier eine Vorlage wählen, „Widget anlegen“ und „Skript kopieren“ tippen; in Scriptable mit +
				ein neues Skript anlegen und einfügen.
			</li>
			<li>
				Auf dem Home-Bildschirm ein Scriptable-Widget in der gewählten Größe hinzufügen, gedrückt
				halten › Widget bearbeiten › das Skript wählen.
			</li>
		</ol>
	</section>

	{#each WIDGET_TEMPLATES as t (t)}
		<section class="mb-8" aria-label={TEMPLATE_INFO[t].title}>
			<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">{TEMPLATE_INFO[t].title}</h2>
			<div class="rounded-[var(--radius-card)] bg-fill/50 p-4">
				<p class="mb-3 text-[15px] text-label-2">{TEMPLATE_INFO[t].text}</p>
				<div class="mb-4 flex justify-center">
					<WidgetPreview
						blocks={preview(t)}
						size={sizes[t]}
						lock={isLockSize(sizes[t]) ? lockPreview(t) : null}
					/>
				</div>
				<form
					method="POST"
					action="?/create"
					use:enhance={() =>
						async ({ update }) => {
							copied = false;
							await update({ reset: false });
						}}
				>
					<input type="hidden" name="template" value={t} />
					<div
						class="mb-3 flex flex-wrap gap-2"
						role="radiogroup"
						aria-label="Größe {TEMPLATE_INFO[t].title}"
					>
						{#each WIDGET_SIZES as s (s)}
							<label
								class={[
									'min-w-[30%] flex-1 cursor-pointer rounded-full px-3 py-1.5 text-center text-[15px]',
									sizes[t] === s ? 'bg-accent text-white' : 'bg-card'
								]}
							>
								<input
									type="radio"
									name="size"
									value={s}
									checked={sizes[t] === s}
									onchange={() => (sizes[t] = s)}
									class="sr-only"
								/>
								{SIZE_LABELS[s]}
							</label>
						{/each}
					</div>
					<details class="mb-3 rounded-[var(--radius-row)] bg-card">
						<summary class="cursor-pointer px-4 py-2.5 text-[15px]">
							Konten: {chosen[t].length ? `${chosen[t].length} gewählt` : 'alle'}
						</summary>
						<ul class="divide-y-[0.5px] divide-separator">
							{#each data.data.accounts as a (a.id)}
								<li class="flex min-h-11 items-center gap-3 px-4 py-1.5">
									<input
										id="w-{t}-{a.id}"
										type="checkbox"
										name="account"
										value={a.id}
										checked={chosen[t].includes(a.id ?? '')}
										onchange={(e) => toggle(t, a.id ?? '', e.currentTarget.checked)}
										class="size-5 accent-[var(--kp-accent)]"
									/>
									<label for="w-{t}-{a.id}" class="flex-1 text-[17px]">{a.name}</label>
								</li>
							{/each}
						</ul>
					</details>
					<Button type="submit">Widget anlegen</Button>
				</form>
				<a
					href={resolve(`widgets/neu?vorlage=${t}`)}
					class="mt-3 block text-center text-[15px] text-accent"
				>
					Im Editor anpassen
				</a>
				{#if created && created.template === t}
					<div class="mt-4" aria-label="Skript">
						<Button type="button" variant="tinted" onclick={() => copy(created.script)}>
							{copied ? 'Kopiert – jetzt in Scriptable einfügen' : 'Skript kopieren'}
						</Button>
						<textarea
							readonly
							class="mt-3 h-28 w-full rounded-[var(--radius-row)] bg-card p-3 font-mono text-[11px]"
							aria-label="Skript für Scriptable"
							data-testid="widget-script">{created.script}</textarea
						>
					</div>
				{/if}
			</div>
		</section>
	{/each}

	<a
		href={resolve('widgets/neu')}
		class="mb-8 flex min-h-[50px] w-full items-center justify-center rounded-full bg-card text-[17px] font-semibold text-accent active:opacity-70"
	>
		Eigenes Widget im Editor gestalten
	</a>

	<section class="mb-8" aria-label="Meine Widgets">
		<h2 class="mb-1.5 px-4 text-[13px] text-label-2 uppercase">Meine Widgets</h2>
		<ul
			class="divide-y-[0.5px] divide-separator overflow-hidden rounded-[var(--radius-row)] bg-card"
		>
			{#each data.widgets as w (w.id)}
				<li class="flex min-h-11 items-center gap-3 px-4 py-2" aria-label={w.name}>
					<a href={resolve(`widgets/${w.id}`)} class="min-w-0 flex-1">
						<span class="block truncate text-accent">
							{w.name} · {SIZE_LABELS[w.size as WidgetSize] ?? w.size}
						</span>
						<span class="block truncate text-[13px] text-label-2">
							{w.accounts ? w.accounts.join(', ') : 'alle Konten'} · {w.lastUsedAt
								? `zuletzt ${formatDateTime(w.lastUsedAt)}`
								: 'noch nicht abgerufen'}
						</span>
					</a>
					<form method="POST" action="?/revoke" use:enhance>
						<input type="hidden" name="id" value={w.id} />
						<button type="submit" class="text-[15px] text-danger">Widerrufen</button>
					</form>
				</li>
			{:else}
				<li class="px-4 py-3 text-[15px] text-label-2">Noch kein Widget angelegt.</li>
			{/each}
		</ul>
		<p class="mt-1.5 px-4 text-[13px] text-label-2">
			Jedes Widget hat ein eigenes, nur lesendes Token. Unterwegs ohne Verbindung zeigt es die
			zuletzt geladenen Werte mit Uhrzeit. Wie oft es sich aktualisiert, bestimmt iOS.
		</p>
	</section>
</Page>
