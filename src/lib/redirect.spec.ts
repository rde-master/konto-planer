import { describe, expect, it } from 'vitest';
import { safeRedirectTarget } from './redirect';

describe('safeRedirectTarget', () => {
	it.each([
		['/konten', '/konten'],
		['/buchungen?jahr=2026', '/buchungen?jahr=2026'],
		[null, '/'],
		['', '/'],
		['https://evil.example', '/'],
		['//evil.example', '/'],
		['/\\evil.example', '/']
	])('%s -> %s', (input, expected) => {
		expect(safeRedirectTarget(input)).toBe(expected);
	});
});
