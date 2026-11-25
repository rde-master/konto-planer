<script lang="ts">
	import { onMount } from 'svelte';
	import * as echarts from 'echarts/core';
	import { BarChart as Bars } from 'echarts/charts';
	import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
	import { SVGRenderer } from 'echarts/renderers';
	import { formatEuro } from '#lib/money.js';

	echarts.use([Bars, GridComponent, TooltipComponent, LegendComponent, SVGRenderer]);

	/** Bar chart (Apache ECharts) of amounts in cents; colors are CSS variables. */
	let {
		labels,
		series,
		label,
		highlight
	}: {
		labels: string[];
		series: { name: string; values: number[]; color: string }[];
		label: string;
		/** Index of a bar to emphasise (e.g. the current month). */
		highlight?: number;
	} = $props();

	let el: HTMLDivElement | undefined = $state();

	function css(name: string) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}

	onMount(() => {
		if (!el) return;
		const chart = echarts.init(el, undefined, { renderer: 'svg' });
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const render = () => {
			const muted = css('--kp-label-2');
			const grid = css('--kp-separator');
			chart.setOption(
				{
					animation: !reduced.matches,
					grid: {
						left: 8,
						right: 8,
						top: series.length > 1 ? 28 : 12,
						bottom: 8,
						containLabel: true
					},
					legend: series.length > 1 ? { top: 0, textStyle: { color: muted } } : undefined,
					tooltip: {
						trigger: 'axis',
						valueFormatter: (v: unknown) => formatEuro(Number(v))
					},
					xAxis: {
						type: 'category',
						data: labels,
						axisLabel: { color: muted },
						axisLine: { lineStyle: { color: grid } }
					},
					yAxis: {
						type: 'value',
						axisLabel: {
							color: muted,
							formatter: (v: number) => `${Math.round(v / 100).toLocaleString('de-DE')} €`
						},
						splitLine: { lineStyle: { color: grid } }
					},
					series: series.map((s) => ({
						type: 'bar',
						name: s.name,
						// Series color for the legend; each bar may be dimmed.
						itemStyle: { color: css(s.color) },
						data: s.values.map((v, i) => ({
							value: v,
							itemStyle: {
								color: css(s.color),
								opacity: highlight === undefined || highlight === i ? 1 : 0.55,
								borderRadius: [4, 4, 0, 0]
							}
						}))
					}))
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

<figure class="overflow-hidden rounded-[var(--radius-row)] bg-card p-2">
	<div bind:this={el} class="h-56 w-full" role="img" aria-label={label}></div>
</figure>
