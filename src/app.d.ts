// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '#lib/server/auth.js';

declare global {
	const __APP_VERSION__: string;
	/** Direct dependencies as installed at build time (vite.config.ts). */
	const __APP_LIBRARIES__: import('#lib/libraries.js').Library[];
	namespace App {
		interface Locals {
			user: SessionUser | null;
		}
	}
}

export {};
