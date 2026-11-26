<script lang="ts">
	import Button from './Button.svelte';

	let { script }: { script: string } = $props();
	let copied = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(script);
			copied = true;
		} catch {
			copied = false;
		}
	}
</script>

<section class="mb-8 rounded-[var(--radius-card)] bg-card p-5" aria-label="Skript">
	<p class="mb-2 text-[17px] font-semibold">Skript für Scriptable</p>
	<p class="mb-3 text-[13px] text-label-2">
		In Scriptable mit + ein neues Skript anlegen und einfügen, dann auf dem Home-Bildschirm ein
		Scriptable-Widget hinzufügen und das Skript wählen. Das Skript enthält den Zugang – nicht
		weitergeben.
	</p>
	<Button type="button" onclick={copy}>{copied ? 'Kopiert' : 'Skript kopieren'}</Button>
	<textarea
		readonly
		class="mt-3 h-28 w-full rounded-[var(--radius-row)] bg-fill p-3 font-mono text-[11px]"
		aria-label="Skript für Scriptable"
		data-testid="widget-script">{script}</textarea
	>
</section>
