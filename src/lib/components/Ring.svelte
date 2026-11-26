<script lang="ts">
	import { ringShare } from '#lib/dashboard.js';

	/** Progress ring with the per cent in the middle; red when the whole is exceeded. */
	let {
		part,
		whole,
		label,
		color = 'var(--kp-accent)',
		warnFrom
	}: {
		part: number;
		whole: number;
		label: string;
		color?: string;
		/** Share (0..1) from which the ring turns orange (budgets). */
		warnFrom?: number;
	} = $props();

	const R = 15.5;
	const C = 2 * Math.PI * R;
	const s = $derived(ringShare(part, whole));
	const percent = $derived(whole > 0 ? Math.round((part / whole) * 100) : 0);
	const stroke = $derived(
		s.over
			? 'var(--kp-red)'
			: warnFrom !== undefined && s.share >= warnFrom
				? 'var(--kp-orange)'
				: color
	);
</script>

<svg viewBox="0 0 36 36" class="size-12 shrink-0" role="img" aria-label="{label}: {percent} %">
	<circle cx="18" cy="18" r={R} fill="none" stroke="var(--kp-fill)" stroke-width="3.5" />
	<circle
		cx="18"
		cy="18"
		r={R}
		fill="none"
		{stroke}
		stroke-width="3.5"
		stroke-linecap="round"
		stroke-dasharray="{s.share * C} {C}"
		transform="rotate(-90 18 18)"
	/>
	<text
		x="18"
		y="18"
		text-anchor="middle"
		dominant-baseline="central"
		font-size="9"
		font-weight="600"
		fill={s.over ? 'var(--kp-red)' : 'var(--kp-label)'}
	>
		{percent}%
	</text>
</svg>
