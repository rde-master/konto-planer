import { describe, expect, it } from 'vitest';

// SvelteKit 3 dropped `data-sveltekit-noscroll` and `data-sveltekit-keepfocus` (and the `goto`
// options `noScroll`/`keepFocus`) for `data-sveltekit-reset="false"` / `reset: false`. The old
// spellings are ignored without a word in production – the page then jumps to the top.
const sources = import.meta.glob<string>('/src/**/*.{svelte,ts}', {
	query: '?raw',
	import: 'default',
	eager: true
});

describe('link options', () => {
	it('uses no option the router ignores', () => {
		const removed = /data-sveltekit-(noscroll|keepfocus)|\b(noScroll|keepFocus)\s*:/;
		const hits = Object.entries(sources)
			.filter(([path, text]) => !path.endsWith('link-options.spec.ts') && removed.test(text))
			.map(([path]) => path);
		expect(hits).toEqual([]);
	});
});
