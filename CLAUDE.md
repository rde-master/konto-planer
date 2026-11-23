# CLAUDE.md – Regeln für Claude Code

Konto Planer: Web-App, die je Girokonto den Mindestbestand bis zum nächsten Gehaltseingang und den frei verfügbaren Betrag zeigt.
Der vollständige, verbindliche Plan steht in [docs/PLAN.md](docs/PLAN.md). Bei Widerspruch gilt der Plan; Abweichungen nur nach Rückfrage.

## Arbeitsweise

- Selbstständig arbeiten bis zum Pull Request. **Nie direkt auf `main` committen oder pushen; nie selbst mergen.** Der Merge erfolgt nur durch den Repo-Besitzer.
- Eine Funktion = ein Feature-Branch = ein Pull Request, in der Reihenfolge des Releaseplans (docs/PLAN.md, Abschnitt „Releaseplan“).
- Branch-Namen: `feat/0.x-kurzname`, `fix/kurzname`.
- Commits nach Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`). `feat:` erzeugt beim Merge die nächste Unterversion 0.x.0, `fix:` die 0.x.1. Kein `BREAKING CHANGE` vor 1.0.0.
- Vor jedem PR lokal: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, bei UI-Änderungen `pnpm test:e2e`.
- Abnahme je Version: läuft im Docker-Stack, am Handy-Format bedienbar, Rechenlogik durch Vitest-Tests abgedeckt.
- Unklare fachliche Fragen stellen statt raten.

## Technik

- TypeScript durchgängig, SvelteKit + Tailwind, PWA. PostgreSQL über Drizzle; Migrationen laufen beim App-Start.
- Node 24 LTS, Paketmanager **pnpm**.
- Beträge immer als **ganze Cent (integer)**, nie als Float. Nur Euro.
- Zeitzone fest `Europe/Berlin`. Bankarbeitstage nach TARGET-Kalender.
- Grafiken mit Apache ECharts. Tests: Vitest (Logik), Playwright (Handy-Viewport).
- Code, Bezeichner und Commit-Nachrichten auf Englisch; Oberfläche und Dokumentation für Benutzer auf Deutsch.

## Design

iOS-Stil (Liquid Glass): schwebende Tab-Leiste am Handy, Seitenleiste am Desktop, große Titel, Blätter von unten, gruppierte Listen, iOS-Blau als Akzent, Hell/Dunkel nach System und umschaltbar. `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` beachten.
**Keine Apple-Schrift- oder Symboldateien ins Repo** – Systemschrift (`-apple-system, system-ui`) und ein frei lizenziertes Symbolset verwenden.

## Daten und Sicherheit

- Öffentliches Repo (MIT). **Nur erfundene Testdaten.** Echte Bankexporte (`*.csv` außerhalb von `tests/fixtures/`), `.env` und Zugangsdaten nie einchecken.
- Tokens nur als Hash speichern; SMTP- und Home-Assistant-Zugangsdaten verschlüsselt.
- Jede Änderung an Daten ins Protokoll (ab 0.5.0).

## Lokale Entwicklung

- Docker und Docker Compose sind installiert; Dev-Datenbank über `docker compose` (Postgres 17).
- GitHub-Zugriff über `gh`.
