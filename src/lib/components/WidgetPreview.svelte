<script lang="ts">
	import type { Block, Palette, Pair, WidgetSize } from '#lib/widgets.js';

	let { blocks, size, palette }: { blocks: Block[]; size: WidgetSize; palette?: Palette } =
		$props();

	const css = (p: Pair) => `light-dark(${p[0]}, ${p[1]})`;
	const color = (c: string | undefined) => {
		if (!palette) return undefined;
		const key = (c ?? 'text') as 'text' | 'sub' | 'red' | 'green' | 'accent';
		return css(palette[key] ?? palette.text);
	};
	const background = $derived(
		!palette
			? undefined
			: palette.gradient
				? `linear-gradient(${css(palette.gradient[0])}, ${css(palette.gradient[1])})`
				: css(palette.bg)
	);
	const scale = $derived(palette?.scale ?? 1);
	const box = $derived(
		size === 'small'
			? 'h-[170px] w-[170px]'
			: size === 'medium'
				? 'h-[170px] w-[340px]'
				: 'h-[355px] w-[340px]'
	);
	const DEFAULT: Record<string, string> = {
		text: 'text-label',
		sub: 'text-label-2',
		red: 'text-danger',
		green: 'text-income',
		accent: 'text-accent'
	};
</script>

<div
	class={[
		'flex flex-col overflow-hidden rounded-[22px] px-3.5 py-3 shadow-sm ring-1 ring-separator',
		!palette && 'bg-card',
		box
	]}
	style:background
	aria-label="Vorschau"
	role="img"
>
	{#each blocks as b, i (i)}
		{#if b.type === 'title'}
			<p
				class={['truncate font-semibold', !palette && 'text-label-2']}
				style:color={palette ? css(palette.sub) : undefined}
				style:font-size="{12 * scale}px"
			>
				{b.text}
			</p>
		{:else if b.type === 'big'}
			<p
				class={['truncate leading-tight font-bold tabular', !palette && DEFAULT[b.color]]}
				style:color={color(b.color)}
				style:font-size="{(size === 'small' ? 20 : 26) * scale}px"
			>
				{b.value}
			</p>
		{:else if b.type === 'row'}
			<p class="flex gap-2" style:font-size="{12 * scale}px">
				<span
					class={['min-w-0 flex-1 truncate', !palette && 'text-label-2']}
					style:color={palette ? css(palette.sub) : undefined}
				>
					{b.label}
				</span>
				<span
					class={['shrink-0 font-medium tabular', !palette && DEFAULT[b.color ?? 'text']]}
					style:color={color(b.color)}
				>
					{b.value}
				</span>
			</p>
		{:else if b.type === 'bar'}
			<div
				class={['my-1 h-1.5 w-full rounded-full', !palette && 'bg-fill']}
				style:background={palette ? css(palette.track) : undefined}
			>
				<div
					class={['h-1.5 rounded-full', !palette && 'bg-accent']}
					style:background={color(b.color)}
					style:width="{Math.max(4, b.value * 100)}%"
				></div>
			</div>
		{:else if b.type === 'spacer'}
			<div class="flex-1"></div>
		{/if}
	{/each}
	<p
		class={['mt-1 text-[9px]', !palette && 'text-label-2']}
		style:color={palette ? css(palette.sub) : undefined}
	>
		Stand jetzt
	</p>
</div>
