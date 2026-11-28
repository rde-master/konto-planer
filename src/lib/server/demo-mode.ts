/** Demo instance (DEMO_MODE=true): invented data, automatic login, nightly reset, no sending. */
export function isDemo(): boolean {
	return process.env.DEMO_MODE === 'true';
}

export const DEMO_DISABLED =
	'In der Demo sind E-Mail, Push, Pushover und Home Assistant abgeschaltet.';
