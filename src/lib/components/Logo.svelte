<script lang="ts">
	import { ACCOUNT_COLORS, accountColorCss } from '#lib/colors.js';
	import { WEB_PREFIX, initials, initialsColor, logoSrc, type LogoRef } from '#lib/logos.js';

	/** Company logo on a white circle, otherwise colored initials of the payee. */
	let {
		name,
		logo,
		size = 'md'
	}: { name: string; logo: LogoRef | null; size?: 'md' | 'lg' } = $props();

	const palette = Object.keys(ACCOUNT_COLORS).filter((c) => c !== 'gray');
	const box = $derived(size === 'lg' ? 'size-14 text-[20px]' : 'size-9 text-[13px]');
	// Icons from the web are full pictures (often with their own background): show them larger.
	const web = $derived(logo?.slug.startsWith(WEB_PREFIX) ?? false);
	const img = $derived(
		web
			? size === 'lg'
				? 'size-10 rounded-[9px] object-contain'
				: 'size-6.5 rounded-[6px] object-contain'
			: size === 'lg'
				? 'size-8'
				: 'size-5'
	);
</script>

{#if logo}
	<span
		class={['grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-separator', box]}
	>
		<img src={logoSrc(logo.slug)} alt="" class={img} loading="lazy" decoding="async" />
	</span>
{:else}
	<span
		class={['grid shrink-0 place-items-center rounded-full font-semibold text-white', box]}
		style:background-color={accountColorCss(initialsColor(name, palette))}
		aria-hidden="true"
	>
		{initials(name)}
	</span>
{/if}
