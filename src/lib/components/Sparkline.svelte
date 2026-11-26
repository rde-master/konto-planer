<script lang="ts">
	import { sparkPath } from '#lib/dashboard.js';

	/** Small step line of a balance (no axes): zero line when it goes negative, dot at the low. */
	let { points, label }: { points: [string, number][]; label: string } = $props();

	const W = 96;
	const H = 32;
	const s = $derived(sparkPath(points, W, H));
	const negative = $derived(points.some((p) => p[1] < 0));
</script>

{#if s.path}
	<svg
		viewBox="0 0 {W} {H}"
		class="h-8 w-24 shrink-0"
		role="img"
		aria-label={label}
		preserveAspectRatio="none"
	>
		{#if s.zeroY !== null}
			<line
				x1="0"
				x2={W}
				y1={s.zeroY}
				y2={s.zeroY}
				stroke="var(--kp-separator)"
				stroke-dasharray="2 2"
			/>
		{/if}
		<path
			d={s.path}
			fill="none"
			stroke={negative ? 'var(--kp-red)' : 'var(--kp-accent)'}
			stroke-width="1.75"
			stroke-linejoin="round"
			vector-effect="non-scaling-stroke"
		/>
		{#if s.low}
			<circle cx={s.low.x} cy={s.low.y} r="2.5" fill="var(--kp-red)" />
		{/if}
	</svg>
{/if}
