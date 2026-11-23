/** Only allow same-origin relative paths as post-login targets (no open redirects). */
export function safeRedirectTarget(target: string | null | undefined): string {
	if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
		return '/';
	}
	return target;
}
