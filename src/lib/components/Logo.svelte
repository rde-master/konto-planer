<script lang="ts">
	import { ACCOUNT_COLORS, accountColorCss } from '#lib/colors.js';
	import { initials, initialsColor, type LogoRef } from '#lib/logos.js';

	/** Company logo on a white circle, otherwise colored initials of the payee. */
	let {
		name,
		logo,
		size = 'md'
	}: { name: string; logo: LogoRef | null; size?: 'md' | 'lg' } = $props();

	const palette = Object.keys(ACCOUNT_COLORS).filter((c) => c !== 'gray');
	const box = $derived(size === 'lg' ? 'size-14 text-[20px]' : 'size-9 text-[13px]');
</script>

{#if logo}
	<span
		class={['grid shrink-0 place-items-center rounded-full bg-white ring-1 ring-separator', box]}
	>
		<img
			src="/api/logos/{logo.slug}"
			alt=""
			class={size === 'lg' ? 'size-8' : 'size-5'}
			loading="lazy"
			decoding="async"
		/>
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
