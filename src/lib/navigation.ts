import type { Component } from 'svelte';
import type { Path } from '$app/types';
import { resolve } from '$app/paths';
import House from '@lucide/svelte/icons/house';
import Landmark from '@lucide/svelte/icons/landmark';
import Repeat from '@lucide/svelte/icons/repeat';
import ReceiptText from '@lucide/svelte/icons/receipt-text';
import ChartPie from '@lucide/svelte/icons/chart-pie';
import Settings from '@lucide/svelte/icons/settings';
import Ellipsis from '@lucide/svelte/icons/ellipsis';
import CalendarClock from '@lucide/svelte/icons/calendar-clock';
import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
import PiggyBank from '@lucide/svelte/icons/piggy-bank';
import Vault from '@lucide/svelte/icons/vault';
import Tags from '@lucide/svelte/icons/tags';
import Hash from '@lucide/svelte/icons/hash';
import Trash2 from '@lucide/svelte/icons/trash-2';
import HandCoins from '@lucide/svelte/icons/hand-coins';
import Gauge from '@lucide/svelte/icons/gauge';
import FlaskConical from '@lucide/svelte/icons/flask-conical';
import LayoutGrid from '@lucide/svelte/icons/layout-grid';
import CircleHelp from '@lucide/svelte/icons/circle-help';
import Workflow from '@lucide/svelte/icons/workflow';
import Smartphone from '@lucide/svelte/icons/smartphone';

/**
 * `resolve()` for a value of the whole `Path` union. TypeScript cannot check a union of more
 * than 25 paths against the overloads of `resolve()`, so the check happens on `Path` instead.
 */
export function resolvePath(path: Path): string {
	return resolve(path as 'konten');
}

/** `path` is a typed app path without leading slash ('' = start page); use `resolve(path)` for links. */
export type NavItem = { path: Path; label: string; icon: Component };

/** Tab bar sections (phone) and top of the sidebar (desktop). */
const MAIN: NavItem[] = [
	{ path: '', label: 'Übersicht', icon: House },
	{ path: 'konten', label: 'Konten', icon: Landmark },
	{ path: 'dauerposten', label: 'Dauerposten', icon: Repeat },
	{ path: 'buchungen', label: 'Buchungen', icon: ReceiptText }
];

/** Sections reached through "Mehr" on phones; on the desktop they are in the sidebar. */
export const MORE: (NavItem & { color: string })[] = [
	{
		path: 'offene-zahlungen',
		label: 'Offene Zahlungen',
		icon: CalendarClock,
		color: 'bg-[#ff3b30]'
	},
	{ path: 'geplant', label: 'Geplante Zahlungen', icon: CalendarPlus, color: 'bg-[#34c759]' },
	{ path: 'sparziele', label: 'Sparziele', icon: PiggyBank, color: 'bg-[#ff2d55]' },
	{ path: 'ruecklagen', label: 'Rücklagen', icon: Vault, color: 'bg-[#5856d6]' },
	{ path: 'budgets', label: 'Budgets', icon: Gauge, color: 'bg-[#ff9500]' },
	{ path: 'ausgleich', label: 'Ausgleich', icon: HandCoins, color: 'bg-[#34c759]' },
	{ path: 'kategorien', label: 'Kategorien', icon: Tags, color: 'bg-[#ff9500]' },
	{ path: 'tags', label: 'Tags', icon: Hash, color: 'bg-[#30b0c7]' },
	{ path: 'auswertungen', label: 'Auswertungen', icon: ChartPie, color: 'bg-[#af52de]' },
	{ path: 'finanzfluss', label: 'Finanzfluss', icon: Workflow, color: 'bg-[#30b0c7]' },
	{ path: 'was-waere-wenn', label: 'Was wäre wenn', icon: FlaskConical, color: 'bg-[#5ac8fa]' },
	{ path: 'widgets', label: 'Widgets', icon: LayoutGrid, color: 'bg-[#007aff]' },
	{ path: 'kurzbefehle', label: 'iOS Kurzbefehle', icon: Smartphone, color: 'bg-[#5856d6]' },
	{ path: 'papierkorb', label: 'Papierkorb', icon: Trash2, color: 'bg-[#8e8e93]' },
	{ path: 'hilfe', label: 'Hilfe', icon: CircleHelp, color: 'bg-[#007aff]' },
	{ path: 'einstellungen', label: 'Einstellungen', icon: Settings, color: 'bg-[#8e8e93]' }
];

/** All sections in the sidebar (desktop). */
export const SECTIONS: NavItem[] = [...MAIN, ...MORE];

/** Tab bar on phones: four sections plus "Mehr". */
export const TABS: NavItem[] = [...MAIN, { path: 'mehr', label: 'Mehr', icon: Ellipsis }];

/** Sections reachable through "Mehr" on phones. */
const MORE_PATHS: Path[] = ['mehr', ...MORE.map((m) => m.path)];

/** Version of the app (package.json), e.g. "0.28.0". */
export const APP_VERSION = __APP_VERSION__;

export function isActive(path: Path, pathname: string): boolean {
	const href = resolvePath(path);
	if (path === '') return pathname === href;
	return pathname === href || pathname.startsWith(href + '/');
}

export function isTabActive(path: Path, pathname: string): boolean {
	if (path === 'mehr') return MORE_PATHS.some((p) => isActive(p, pathname));
	return isActive(path, pathname);
}
