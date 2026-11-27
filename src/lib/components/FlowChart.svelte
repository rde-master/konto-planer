<script lang="ts">
	import { onMount } from 'svelte';
	import * as echarts from 'echarts/core';
	import { SankeyChart } from 'echarts/charts';
	import { TooltipComponent } from 'echarts/components';
	import { SVGRenderer } from 'echarts/renderers';
	import { ACCOUNT_COLORS, isAccountColor } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { FLOW_NODES, type FlowLink, type FlowNode } from '#lib/money-flow.js';

	echarts.use([SankeyChart, TooltipComponent, SVGRenderer]);

	/** Flow diagram (Apache ECharts, Sankey) of cents per month between income, accounts and expenses. */
	let { nodes, links, label }: { nodes: FlowNode[]; links: FlowLink[]; label: string } = $props();

	let el: HTMLDivElement | undefined = $state();

	/** Phones: the money flows from top to bottom, there is no room for four columns of labels. */
	const NARROW = 560;
	let narrow = $state(false);
	/** Tall enough for the fullest column (wide) or for the four rows (narrow). */
	const height = $derived(narrow ? 460 : Math.min(560, Math.max(260, nodes.length * 34)));

	const ROLE_COLORS: Record<string, string> = {
		[FLOW_NODES.salary]: '--kp-green',
		[FLOW_NODES.income]: '--kp-green',
		[FLOW_NODES.stock]: '--kp-orange',
		[FLOW_NODES.expenses]: '--kp-red',
		[FLOW_NODES.saved]: '--kp-accent',
		[FLOW_NODES.left]: '--kp-green'
	};

	function css(name: string) {
		return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	}
	function dark() {
		const theme = document.documentElement.dataset.theme;
		return (
			theme === 'dark' || (theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches)
		);
	}
	function colorOf(node: FlowNode) {
		if (ROLE_COLORS[node.color]) return css(ROLE_COLORS[node.color]);
		const c = isAccountColor(node.color) ? ACCOUNT_COLORS[node.color] : ACCOUNT_COLORS.gray;
		return dark() ? c.dark : c.light;
	}
	const euro = (cents: number) => `${Math.round(cents / 100).toLocaleString('de-DE')} €`;

	onMount(() => {
		if (!el) return;
		narrow = el.clientWidth < NARROW;
		const chart = echarts.init(el, undefined, { renderer: 'svg', height });
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
		const render = () => {
			const text = css('--kp-label');
			const byId = new Map(nodes.map((n) => [n.id, n]));
			const sources = new Set(links.map((l) => l.from));
			// Narrow: a node is as wide as its share of the largest one; a label needs room.
			const widest = Math.max(1, ...nodes.map((n) => n.amount));
			const room = (n: FlowNode) => ((el?.clientWidth ?? 0) - 40) * (n.amount / widest);
			chart.setOption(
				{
					animation: !reduced.matches,
					tooltip: {
						trigger: 'item',
						confine: true,
						formatter: (p: {
							dataType?: string;
							name: string;
							value: number;
							data: { source?: string; target?: string };
						}) =>
							p.dataType === 'edge'
								? `${byId.get(p.data.source ?? '')?.label} → ${byId.get(p.data.target ?? '')?.label}<br>${formatEuro(p.value)} im Monat`
								: `${byId.get(p.name)?.label}<br>${formatEuro(p.value)} im Monat`
					},
					series: [
						{
							type: 'sankey',
							orient: narrow ? 'vertical' : 'horizontal',
							left: 4,
							right: 4,
							top: narrow ? 4 : 8,
							bottom: narrow ? 4 : 8,
							nodeWidth: narrow ? 8 : 10,
							nodeGap: narrow ? 10 : 16,
							nodeAlign: 'justify',
							// Small flows next to each other: rather no label than two on top of each other.
							labelLayout: { hideOverlap: true },
							draggable: false,
							emphasis: { focus: 'adjacency' },
							lineStyle: { color: 'gradient', opacity: 0.32, curveness: 0.5 },
							label: {
								color: text,
								fontSize: 12,
								lineHeight: 15,
								formatter: (p: { name: string; value: number }) =>
									`${byId.get(p.name)?.label}\n${euro(p.value)}`
							},
							data: nodes.map((n) => ({
								name: n.id,
								itemStyle: { color: colorOf(n), borderWidth: 0 },
								// The last column (row) has no room behind it.
								label: narrow
									? { position: sources.has(n.id) ? 'bottom' : 'top', show: room(n) >= 88 }
									: sources.has(n.id)
										? undefined
										: { position: 'left', align: 'right' }
							})),
							links: links.map((l) => ({ source: l.from, target: l.to, value: l.amount }))
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
		const resize = new ResizeObserver(() => {
			if (!el) return;
			const now = el.clientWidth < NARROW;
			if (now !== narrow) {
				narrow = now;
				chart.resize({ height });
				render();
			} else chart.resize();
		});
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
	<div bind:this={el} class="w-full" style:height="{height}px" role="img" aria-label={label}></div>
</figure>
