<script lang="ts">
	import { onMount } from 'svelte';
	import * as echarts from 'echarts/core';
	import { PieChart } from 'echarts/charts';
	import { TooltipComponent } from 'echarts/components';
	import { SVGRenderer } from 'echarts/renderers';
	import { ACCOUNT_COLORS, accountColorCss, isAccountColor } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import type { Slice } from '#lib/dashboard.js';

	echarts.use([PieChart, TooltipComponent, SVGRenderer]);

	/** Ring chart (Apache ECharts) with a legend beside it; colours are account colour names. */
	let { slices, label, center }: { slices: Slice[]; label: string; center: string } = $props();

	let el: HTMLDivElement | undefined = $state();
	const total = $derived(slices.reduce((s, x) => s + x.amount, 0));

	function dark() {
		const theme = document.documentElement.dataset.theme;
		return (
			theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
		);
	}
	function hex(color: string) {
		const c = isAccountColor(color) ? ACCOUNT_COLORS[color] : ACCOUNT_COLORS.gray;
		return dark() ? c.dark : c.light;
	}

	onMount(() => {
		if (!el) return;
		const chart = echarts.init(el, undefined, { renderer: 'svg' });
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const render = () => {
			const card = getComputedStyle(document.documentElement).getPropertyValue('--kp-card').trim();
			chart.setOption(
				{
					animation: !reduced.matches,
					tooltip: {
						trigger: 'item',
						valueFormatter: (v: unknown) => formatEuro(Number(v))
					},
					series: [
						{
							type: 'pie',
							radius: ['62%', '92%'],
							avoidLabelOverlap: false,
							label: { show: false },
							itemStyle: { borderColor: card || '#fff', borderWidth: 2, borderRadius: 4 },
							data: slices.map((s) => ({
								name: s.name,
								value: s.amount,
								itemStyle: { color: hex(s.color) }
							}))
						}
					]
				},
				true
			);
		};
		render();
		const scheme = window.matchMedia('(prefers-color-scheme: dark)');
		const observer = new MutationObserver(render);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ['data-theme']
		});
		scheme.addEventListener('change', render);
		const resize = new ResizeObserver(() => chart.resize());
		resize.observe(el);
		return () => {
			observer.disconnect();
			scheme.removeEventListener('change', render);
			resize.disconnect();
			chart.dispose();
		};
	});
</script>

<figure
	class="flex flex-col items-center gap-4 rounded-[var(--radius-row)] bg-card p-4 sm:flex-row"
>
	<div class="relative size-36 shrink-0">
		<div bind:this={el} class="size-36" role="img" aria-label={label}></div>
		<p class="pointer-events-none absolute inset-0 grid place-items-center text-center">
			<span class="text-[15px] leading-tight font-semibold tabular">{center}</span>
		</p>
	</div>
	<ul class="w-full min-w-0 flex-1 space-y-1 text-[13px]" aria-label="{label}: Kategorien">
		{#each slices as s (s.name)}
			<li class="flex items-center gap-2">
				<span
					class="size-2.5 shrink-0 rounded-full"
					style:background-color={accountColorCss(s.color)}
				></span>
				<span class="min-w-0 flex-1 truncate">{s.name}</span>
				<span class="shrink-0 text-label-2 tabular">
					{total ? Math.round((s.amount / total) * 100) : 0} %
				</span>
				<span class="w-20 shrink-0 text-right tabular">{formatEuro(s.amount)}</span>
			</li>
		{/each}
	</ul>
</figure>
