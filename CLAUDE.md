# CLAUDE.md – Regeln für Claude Code

Konto Planer: Web-App, die je Girokonto den Mindestbestand bis zum nächsten Gehaltseingang und den frei verfügbaren Betrag zeigt.
Der vollständige, verbindliche Plan steht in [docs/PLAN.md](docs/PLAN.md). Bei Widerspruch gilt der Plan; Abweichungen nur nach Rückfrage.

## Arbeitsweise

- Selbstständig arbeiten bis zum Pull Request. **Nie direkt auf `main` committen oder pushen; nie selbst mergen.** Der Merge erfolgt nur durch den Repo-Besitzer.
- Eine Funktion = ein Feature-Branch = ein Pull Request, in der Reihenfolge des Releaseplans (docs/PLAN.md, Abschnitt „Releaseplan“).
- Branch-Namen: `feat/0.x-kurzname`, `fix/kurzname`.
- Im Repo ist nur Squash-Merge erlaubt: **der PR-Titel wird zur Commit-Nachricht auf `main`** und muss daher selbst ein Conventional Commit sein (z. B. `feat: foundation with login and PWA`).
- Commits nach Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`). `feat:` erzeugt beim Merge die nächste Unterversion 0.x.0, `fix:` die 0.x.1. Kein `BREAKING CHANGE` vor 1.0.0.
- **Release-Ablauf (Version im PR):** Jeder `feat`/`fix`-PR erhöht selbst die Version in `package.json` und ergänzt `CHANGELOG.md` um `## [x.y.z] – Titel` (deutsch, für Benutzer geschrieben). Die CI prüft das mit `scripts/check-pr.mjs`. Nach dem Merge erzeugt `release.yml` Tag, GitHub-Release und Docker-Image (`:x.y.z`, `:x.y`, `:latest`).
- Schemaänderungen: `src/lib/server/db/schema.ts` anpassen, dann `pnpm db:generate --name <name>`; die Migration wird mit eingecheckt. Vor jeder Migration sichert die App per `pg_dump` (`src/lib/server/backup.ts`). `scripts/upgrade-test.sh <altes-image> <neues-image>` prüft den Update-Weg (läuft in der CI gegen das letzte Release; lokal mit `TMPDIR` im Scratchpad).
- Vor jedem PR lokal: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, bei UI-Änderungen `pnpm test:e2e`.
- Abnahme je Version: läuft im Docker-Stack, am Handy-Format bedienbar, Rechenlogik durch Vitest-Tests abgedeckt.
- Unklare fachliche Fragen stellen statt raten.

## Technik

- TypeScript durchgängig, SvelteKit + Tailwind, PWA. PostgreSQL über Drizzle; Migrationen laufen beim App-Start.
- Node 24 LTS, Paketmanager **pnpm**. SvelteKit **3**: Konfiguration in `vite.config.ts`, Umgebungsvariablen über `src/env.ts` und `$app/env/private`, Hooks-Typen aus `@sveltejs/kit/hooks`, Service Worker in `src/service-worker/` mit eigener tsconfig.
- Importe aus `src/lib` über `#lib/...` **mit Endung** (`#lib/server/auth.js`, `#lib/components/Page.svelte`).
- Links über `resolve()` aus `$app/paths` mit typisierten Pfaden ohne führenden Schrägstrich (`resolve('konten')`).
- Formulare: klassische Form Actions mit `use:enhance`; Felder mit `formString()` aus `#lib/server/validation.js` lesen.
- Beträge immer als **ganze Cent (integer)**, nie als Float. Nur Euro.
- Zeitzone fest `Europe/Berlin`. Bankarbeitstage nach TARGET-Kalender.
- Grafiken mit Apache ECharts. Tests: Vitest (Logik), Playwright (Handy-Viewport).
- Code, Bezeichner und Commit-Nachrichten auf Englisch; Oberfläche und Dokumentation für Benutzer auf Deutsch.

## Design

iOS-Stil (Liquid Glass): schwebende Tab-Leiste am Handy, Seitenleiste am Desktop, große Titel, Blätter von unten, gruppierte Listen, iOS-Blau als Akzent, Hell/Dunkel nach System und umschaltbar. `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` beachten.
**Keine Apple-Schrift- oder Symboldateien ins Repo** – Systemschrift (`-apple-system, system-ui`) und ein frei lizenziertes Symbolset verwenden.

## UI-Bausteine (`src/lib/components`)

`Page` (großer Titel, `back`, `actions`), `ListGroup`/`ListRow` (gruppierte Listen; `href`, `onclick`, `value`), `FormField` (Eingabe als Listenzeile), `SegmentedField` (Radio-Segmente, `initial`), `Sheet` (Blatt von unten, Bestätigen-Knopf sendet `formId`), `Button` (`filled`, `tinted`, `plain`, `destructive`), `ComingSoon`. Admin-Seiten mit `requireAdmin()` aus `#lib/server/guards.js` schützen.

## Daten und Sicherheit

- Öffentliches Repo (MIT). **Nur erfundene Testdaten.** Echte Bankexporte (`*.csv` außerhalb von `tests/fixtures/`), `.env` und Zugangsdaten nie einchecken.
- Tokens nur als Hash speichern; SMTP- und Home-Assistant-Zugangsdaten verschlüsselt.
- Jede Änderung an Daten ins Protokoll (ab 0.5.0).

## Lokale Entwicklung

- Docker und Docker Compose sind installiert; Dev-Datenbank mit `pnpm db:up` (Postgres 17, `docker-compose.dev.yml`). E2E-Tests nutzen die Datenbank `kontoplaner_e2e`, die bei jedem Lauf neu angelegt wird.
- GitHub-Zugriff über `gh` (Konto rde-master), Repo `rde-master/konto-planer`. `main` ist geschützt: nur per PR, linearer Verlauf, kein Force-Push.
