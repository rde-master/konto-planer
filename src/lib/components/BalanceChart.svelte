<script lang="ts">
	import { onMount } from 'svelte';
	import * as echarts from 'echarts/core';
	import { LineChart } from 'echarts/charts';
	import { GridComponent, TooltipComponent } from 'echarts/components';
	import { SVGRenderer } from 'echarts/renderers';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';

	echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

	/** Balance history as a step line (Apache ECharts). `series`: [day, cents]. */
	let { series, label }: { series: [string, number][]; label: string } = $props();

	let el: HTMLDivElement | undefined = $state();

	function css(name: string) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}

	onMount(() => {
		if (!el) return;
		const chart = echarts.init(el, undefined, { renderer: 'svg' });
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const render = () => {
			const accent = css('--kp-accent');
			const muted = css('--kp-label-2');
			const grid = css('--kp-separator');
			chart.setOption(
				{
					animation: !reduced.matches,
					grid: { left: 8, right: 8, top: 16, bottom: 8, containLabel: true },
					tooltip: {
						trigger: 'axis',
						valueFormatter: (v: unknown) => formatEuro(Number(v)),
						axisPointer: { type: 'line' }
					},
					xAxis: {
						type: 'time',
						axisLabel: {
							color: muted,
							formatter: (v: number) =>
								new Date(v).toLocaleDateString('de-DE', { month: 'short', year: '2-digit' })
						},
						axisLine: { lineStyle: { color: grid } },
						splitLine: { show: false }
					},
					yAxis: {
						type: 'value',
						scale: true,
						axisLabel: {
							color: muted,
							formatter: (v: number) => `${Math.round(v / 100).toLocaleString('de-DE')} €`
						},
						splitLine: { lineStyle: { color: grid } }
					},
					series: [
						{
							type: 'line',
							step: 'end',
							name: label,
							showSymbol: false,
							data: series,
							lineStyle: { color: accent, width: 2 },
							itemStyle: { color: accent },
							areaStyle: { color: accent, opacity: 0.12 }
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

	const last = $derived(series.at(-1));
	const first = $derived(series.at(0));
</script>

<figure class="overflow-hidden rounded-[var(--radius-row)] bg-card p-2">
	<div bind:this={el} class="h-48 w-full" role="img" aria-label={label}></div>
	{#if first && last}
		<figcaption class="px-2 pb-1 text-[13px] text-label-2">
			{formatDay(first[0])}: {formatEuro(first[1])} → {formatDay(last[0])}: {formatEuro(last[1])}
		</figcaption>
	{/if}
</figure>
