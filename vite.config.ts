import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import pkg from './package.json' with { type: 'json' };
import { readFileSync } from 'node:fs';

/**
 * Direct dependencies in the versions installed for this build – for "Frameworks und
 * Bibliotheken" in the settings (the running image no longer has all of them on disk).
 */
function installedLibraries() {
	const read = (names: Record<string, string>, dev: boolean) =>
		Object.entries(names).map(([name, range]) => {
			try {
				const meta = JSON.parse(
					readFileSync(new URL(`./node_modules/${name}/package.json`, import.meta.url), 'utf8')
				) as { version?: string; license?: unknown };
				return {
					name,
					version: meta.version ?? range,
					license: typeof meta.license === 'string' ? meta.license : null,
					dev
				};
			} catch {
				return { name, version: range, license: null, dev };
			}
		});
	return [...read(pkg.dependencies, false), ...read(pkg.devDependencies, true)];
}

export default defineConfig({
	define: {
		__APP_VERSION__: JSON.stringify(pkg.version),
		__APP_LIBRARIES__: JSON.stringify(installedLibraries())
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
