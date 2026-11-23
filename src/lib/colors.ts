// Account colours: iOS system colours (light / dark variants).
export const ACCOUNT_COLORS = {
	blue: { label: 'Blau', light: '#007aff', dark: '#0a84ff' },
	green: { label: 'Grün', light: '#34c759', dark: '#30d158' },
	teal: { label: 'Türkis', light: '#30b0c7', dark: '#40c8e0' },
	indigo: { label: 'Indigo', light: '#5856d6', dark: '#5e5ce6' },
	purple: { label: 'Lila', light: '#af52de', dark: '#bf5af2' },
	pink: { label: 'Pink', light: '#ff2d55', dark: '#ff375f' },
	red: { label: 'Rot', light: '#ff3b30', dark: '#ff453a' },
	orange: { label: 'Orange', light: '#ff9500', dark: '#ff9f0a' },
	yellow: { label: 'Gelb', light: '#ffcc00', dark: '#ffd60a' },
	brown: { label: 'Braun', light: '#a2845e', dark: '#ac8e68' },
	gray: { label: 'Grau', light: '#8e8e93', dark: '#98989d' }
} as const;

export type AccountColor = keyof typeof ACCOUNT_COLORS;
export const COLOR_KEYS = Object.keys(ACCOUNT_COLORS) as AccountColor[];

export function isAccountColor(value: string): value is AccountColor {
	return value in ACCOUNT_COLORS;
}

/** CSS colour that follows light/dark mode via light-dark(). */
export function accountColorCss(color: string): string {
	const c = isAccountColor(color) ? ACCOUNT_COLORS[color] : ACCOUNT_COLORS.gray;
	return `light-dark(${c.light}, ${c.dark})`;
}
