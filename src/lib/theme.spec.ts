import { describe, expect, it } from 'vitest';
import { parseTheme } from './theme';

describe('parseTheme', () => {
	it('accepts known themes and falls back to system', () => {
		expect(parseTheme('dark')).toBe('dark');
		expect(parseTheme('light')).toBe('light');
		expect(parseTheme('neon')).toBe('system');
		expect(parseTheme(undefined)).toBe('system');
	});
});
