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

/**
 * `resolve()` for a value of the whole `Path` union. TypeScript cannot check a union of more
 * than 25 paths against the overloads of `resolve()`, so the check happens on `Path` instead.
 */
export function resolvePath(path: Path): string {
	return resolve(path as 'konten');
}

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
	'geplant',
	'sparziele',
	'ruecklagen',
	'kategorien',
	'auswertungen',
	'einstellungen'
];

export function isActive(path: Path, pathname: string): boolean {
	const href = resolvePath(path);
	if (path === '') return pathname === href;
	return pathname === href || pathname.startsWith(href + '/');
}

export function isTabActive(path: Path, pathname: string): boolean {
	if (path === 'mehr') return MORE_PATHS.some((p) => isActive(p, pathname));
	return isActive(path, pathname);
}
