<script lang="ts">
	import { onMount } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Button from './Button.svelte';

	let { publicKey }: { publicKey: string } = $props();

	type Mode = 'checking' | 'install' | 'unsupported' | 'denied' | 'off' | 'on';
	let mode = $state<Mode>('checking');
	let busy = $state(false);
	let error = $state<string | null>(null);

	function isIos() {
		return /iPhone|iPad/.test(navigator.userAgent);
	}

	function keyBytes(base64url: string) {
		const b64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4))
			.replace(/-/g, '+')
			.replace(/_/g, '/');
		return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
	}

	async function registration() {
		return navigator.serviceWorker.ready;
	}

	onMount(async () => {
		if (
			!('serviceWorker' in navigator) ||
			!('PushManager' in window) ||
			!('Notification' in window)
		) {
			// On iPhone and iPad push needs the app on the home screen (iOS 16.4 or newer).
			mode = isIos() ? 'install' : 'unsupported';
			return;
		}
		if (Notification.permission === 'denied') {
			mode = 'denied';
			return;
		}
		const sub = await (await registration()).pushManager.getSubscription();
		mode = sub ? 'on' : 'off';
	});

	async function enable() {
		busy = true;
		error = null;
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				mode = permission === 'denied' ? 'denied' : 'off';
				return;
			}
			const reg = await registration();
			const sub =
				(await reg.pushManager.getSubscription()) ??
				(await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: keyBytes(publicKey)
				}));
			const res = await fetch(resolve('api/push'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(sub.toJSON())
			});
			if (!res.ok) {
				const body = (await res.json().catch(() => null)) as { message?: string } | null;
				throw new Error(body?.message ?? res.statusText);
			}
			mode = 'on';
			await invalidateAll();
		} catch (e) {
			error = `Push ließ sich nicht einschalten: ${e instanceof Error ? e.message : String(e)}`;
		} finally {
			busy = false;
		}
	}

	async function disable() {
		busy = true;
		error = null;
		try {
			const sub = await (await registration()).pushManager.getSubscription();
			if (sub) {
				await fetch(resolve('api/push'), {
					method: 'DELETE',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				await sub.unsubscribe();
			}
			mode = 'off';
			await invalidateAll();
		} finally {
			busy = false;
		}
	}
</script>

<div class="rounded-[var(--radius-row)] bg-card px-4 py-3 text-[15px]" data-testid="push-mode">
	{#if mode === 'checking'}
		<span class="text-label-2">Wird geprüft …</span>
	{:else if mode === 'install'}
		Auf dem iPhone kommen Mitteilungen nur in der installierten App an: in Safari über
		<strong>Teilen › Zum Home-Bildschirm</strong> hinzufügen (ab iOS 16.4), die App vom Homescreen öffnen
		und hier Push einschalten.
	{:else if mode === 'unsupported'}
		<span class="text-label-2">Dieser Browser unterstützt keine Push-Mitteilungen.</span>
	{:else if mode === 'denied'}
		<span class="text-label-2">
			Mitteilungen sind für diese App blockiert. Erlaube sie in den Einstellungen des Geräts
			(iPhone: Einstellungen › Mitteilungen › Konto Planer).
		</span>
	{:else if mode === 'on'}
		Push ist auf diesem Gerät eingeschaltet.
	{:else}
		Push ist auf diesem Gerät aus.
	{/if}
</div>
{#if error}
	<p role="alert" class="mt-1.5 px-4 text-[13px] text-danger">{error}</p>
{/if}
{#if mode === 'off' || mode === 'on'}
	<div class="mt-3">
		{#if mode === 'off'}
			<Button type="button" onclick={enable} disabled={busy}>
				Push auf diesem Gerät einschalten
			</Button>
		{:else}
			<Button type="button" variant="tinted" onclick={disable} disabled={busy}>
				Push auf diesem Gerät ausschalten
			</Button>
		{/if}
	</div>
{/if}
