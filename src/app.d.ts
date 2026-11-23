// See https://svelte.dev/docs/kit/types#app.d.ts
import type { SessionUser } from '#lib/server/auth.js';

declare global {
	const __APP_VERSION__: string;
	namespace App {
		interface Locals {
			user: SessionUser | null;
		}
	}
}

export {};
