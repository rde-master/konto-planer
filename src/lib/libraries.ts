// "Frameworks und Bibliotheken": what the app is built with, in the versions of this build.

/** A direct dependency as installed when the app was built (see vite.config.ts). */
export type Library = { name: string; version: string; license: string | null; dev: boolean };

export type LibraryGroup = 'framework' | 'library' | 'tool';

/**
 * Display name, group and purpose of every direct dependency. A package missing here is
 * still listed (by `dev`), without a note – `libraries.spec.ts` asks for an entry.
 */
export const LIBRARY_INFO: Record<string, { label?: string; group: LibraryGroup; note: string }> = {
	svelte: { label: 'Svelte', group: 'framework', note: 'Oberfläche: Komponenten und Reaktivität' },
	'@sveltejs/kit': {
		label: 'SvelteKit',
		group: 'framework',
		note: 'Web-Framework: Seiten, Formulare, Server und Service Worker'
	},
	tailwindcss: { label: 'Tailwind CSS', group: 'framework', note: 'Gestaltung der Oberfläche' },
	vite: {
		label: 'Vite',
		group: 'framework',
		note: 'Baut die App und liefert sie beim Entwickeln aus'
	},
	'drizzle-orm': {
		label: 'Drizzle ORM',
		group: 'framework',
		note: 'Datenbankzugriff und Migrationen'
	},

	'@node-rs/argon2': { label: 'Argon2', group: 'library', note: 'Sichere Passwort-Hashes' },
	echarts: { label: 'Apache ECharts', group: 'library', note: 'Grafiken und Diagramme' },
	nodemailer: { label: 'Nodemailer', group: 'library', note: 'E-Mail-Versand' },
	'pdf-lib': { label: 'pdf-lib', group: 'library', note: 'Kündigungsschreiben als PDF' },
	postgres: { label: 'Postgres.js', group: 'library', note: 'Verbindung zur PostgreSQL-Datenbank' },
	'simple-icons': { label: 'Simple Icons', group: 'library', note: 'Firmenlogos' },
	'web-push': {
		label: 'web-push',
		group: 'library',
		note: 'Verschlüsselung der Push-Mitteilungen'
	},
	'@lucide/svelte': { label: 'Lucide', group: 'library', note: 'Symbole der Oberfläche' },
	'@sveltejs/adapter-node': {
		label: 'SvelteKit Adapter Node',
		group: 'library',
		note: 'Server der App unter Node.js'
	},

	'@sveltejs/vite-plugin-svelte': {
		group: 'tool',
		note: 'Svelte-Unterstützung für Vite'
	},
	'@tailwindcss/vite': { group: 'tool', note: 'Tailwind-Unterstützung für Vite' },
	typescript: { label: 'TypeScript', group: 'tool', note: 'Typprüfung des gesamten Codes' },
	'svelte-check': { group: 'tool', note: 'Typprüfung der Svelte-Komponenten' },
	'drizzle-kit': { label: 'Drizzle Kit', group: 'tool', note: 'Erzeugt die Datenbank-Migrationen' },
	vitest: { label: 'Vitest', group: 'tool', note: 'Tests der Rechenlogik' },
	'@playwright/test': {
		label: 'Playwright',
		group: 'tool',
		note: 'Tests der Oberfläche im Handy-Format'
	},
	eslint: { label: 'ESLint', group: 'tool', note: 'Prüft den Code auf Fehler' },
	'@eslint/js': { group: 'tool', note: 'Grundregeln für ESLint' },
	'typescript-eslint': { group: 'tool', note: 'ESLint-Regeln für TypeScript' },
	'eslint-plugin-svelte': { group: 'tool', note: 'ESLint-Regeln für Svelte' },
	'eslint-config-prettier': { group: 'tool', note: 'Stimmt ESLint auf Prettier ab' },
	globals: { group: 'tool', note: 'Bekannte globale Namen für ESLint' },
	prettier: { label: 'Prettier', group: 'tool', note: 'Einheitliche Formatierung des Codes' },
	'prettier-plugin-svelte': { group: 'tool', note: 'Prettier für Svelte-Dateien' },
	'prettier-plugin-tailwindcss': { group: 'tool', note: 'Sortiert Tailwind-Klassen' },
	sharp: { group: 'tool', note: 'Erzeugt die App-Symbole' },
	'smtp-server': { group: 'tool', note: 'Test-Mailserver für die Oberflächentests' },
	'@types/node': { group: 'tool', note: 'Typen für Node.js' },
	'@types/nodemailer': { group: 'tool', note: 'Typen für Nodemailer' },
	'@types/smtp-server': { group: 'tool', note: 'Typen für den Test-Mailserver' },
	'@types/web-push': { group: 'tool', note: 'Typen für web-push' }
};

export const LIBRARY_GROUPS: { key: LibraryGroup; title: string; hint: string }[] = [
	{ key: 'framework', title: 'Frameworks', hint: 'Das Gerüst der App.' },
	{
		key: 'library',
		title: 'Bibliotheken',
		hint: 'Laufen in der App mit und erledigen einzelne Aufgaben.'
	},
	{
		key: 'tool',
		title: 'Entwicklung und Tests',
		hint: 'Werden nur zum Bauen und Prüfen gebraucht und sind nicht Teil der laufenden App.'
	}
];

export type LibraryRow = {
	name: string;
	label: string;
	version: string;
	license: string | null;
	note: string;
	url: string;
};

/** The libraries by group; inside a group those with a display name first, then by name. */
export function libraryGroups(
	libraries: Library[]
): { key: LibraryGroup; title: string; hint: string; items: LibraryRow[] }[] {
	const groupOf = (l: Library) => LIBRARY_INFO[l.name]?.group ?? (l.dev ? 'tool' : 'library');
	return LIBRARY_GROUPS.map((g) => ({
		...g,
		items: libraries
			.filter((l) => groupOf(l) === g.key)
			.map((l) => ({
				name: l.name,
				label: LIBRARY_INFO[l.name]?.label ?? l.name,
				version: l.version,
				license: l.license,
				note: LIBRARY_INFO[l.name]?.note ?? '',
				url: `https://www.npmjs.com/package/${l.name}`
			}))
			.sort(
				(a, b) =>
					Number(a.label === a.name) - Number(b.label === b.name) ||
					a.label.localeCompare(b.label, 'de')
			)
	})).filter((g) => g.items.length);
}

/** "PostgreSQL 17.2 (Debian …)" → "17.2". */
export function shortVersion(text: string): string {
	return /\d+(\.\d+)+/.exec(text)?.[0] ?? text.trim();
}
