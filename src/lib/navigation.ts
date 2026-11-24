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

/** `path` is a typed app path without leading slash ('' = start page); use `resolve(path)` for links. */
export type NavItem = { path: Path; label: string; icon: Component };

/** Main sections shown in the sidebar (desktop). */
export const SECTIONS: NavItem[] = [
	{ path: '', label: 'Übersicht', icon: House },
	{ path: 'konten', label: 'Konten', icon: Landmark },
	{ path: 'dauerposten', label: 'Dauerposten', icon: Repeat },
	{ path: 'buchungen', label: 'Buchungen', icon: ReceiptText },
	{ path: 'auswertungen', label: 'Auswertungen', icon: ChartPie },
	{ path: 'einstellungen', label: 'Einstellungen', icon: Settings }
];

/** Tab bar on phones: four sections plus "Mehr". */
export const TABS: NavItem[] = [
	...SECTIONS.slice(0, 4),
	{ path: 'mehr', label: 'Mehr', icon: Ellipsis }
];

/** Sections reachable through "Mehr" on phones. */
const MORE_PATHS: Path[] = [
	'mehr',
	'offene-zahlungen',
	'kategorien',
	'auswertungen',
	'einstellungen'
];

export function isActive(path: Path, pathname: string): boolean {
	const href = resolve(path);
	if (path === '') return pathname === href;
	return pathname === href || pathname.startsWith(href + '/');
}

export function isTabActive(path: Path, pathname: string): boolean {
	if (path === 'mehr') return MORE_PATHS.some((p) => isActive(p, pathname));
	return isActive(path, pathname);
}
