<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import PiggyBank from '@lucide/svelte/icons/piggy-bank';
	import { accountColorCss } from '#lib/colors.js';
	import { formatEuro } from '#lib/money.js';
	import { formatDay } from '#lib/dates.js';

	/** A savings goal in a grouped list: name, progress bar, date and monthly rate. */
	let {
		goal,
		showAccount = false
	}: {
		goal: {
			id: string;
			name: string;
			targetAmount: number;
			allocated: number;
			progress: number;
			date: string | null;
			rate: number | null;
			done: boolean;
			account: { name: string; color: string };
		};
		showAccount?: boolean;
	} = $props();

	const details = $derived(
		[
			showAccount ? goal.account.name : null,
			goal.done ? 'erledigt' : goal.date ? `bis ${formatDay(goal.date)}` : null,
			!goal.done && goal.rate ? `${formatEuro(goal.rate)} im Monat` : null,
			!goal.done && goal.rate === 0 ? 'erreicht' : null
		]
			.filter(Boolean)
			.join(' · ')
	);
</script>

<li>
	<a
		href={resolve(`sparziele/${goal.id}`)}
		class="flex min-h-14 items-center gap-3 px-4 py-2.5 active:bg-fill"
	>
		<span
			class="grid size-9 shrink-0 place-items-center rounded-full text-white"
			style:background-color={accountColorCss(goal.account.color)}
		>
			<PiggyBank class="size-5" strokeWidth={2.2} />
		</span>
		<span class="min-w-0 flex-1">
			<span class="flex items-baseline gap-2">
				<span class="flex-1 truncate text-[17px]">{goal.name}</span>
				<span class="shrink-0 text-[15px] text-label-2 tabular">
					{formatEuro(goal.allocated)} / {formatEuro(goal.targetAmount)}
				</span>
			</span>
			<span
				class="mt-1 block h-1.5 overflow-hidden rounded-full bg-fill"
				role="progressbar"
				aria-label="Fortschritt {goal.name}"
				aria-valuemin={0}
				aria-valuemax={100}
				aria-valuenow={Math.round(goal.progress * 100)}
			>
				<span
					class="block h-full rounded-full bg-accent"
					style:width="{Math.round(goal.progress * 100)}%"
				></span>
			</span>
			{#if details}
				<span class="mt-0.5 block truncate text-[13px] text-label-2">{details}</span>
			{/if}
		</span>
		<ChevronRight class="size-5 shrink-0 text-label-3" strokeWidth={2.5} />
	</a>
</li>
