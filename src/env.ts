import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	DATABASE_URL: {
		description: 'PostgreSQL connection string.',
		// Optional at build time (Docker build has no database); required when the server starts, see runMigrations().
		schema: (value) => value
	}
});
