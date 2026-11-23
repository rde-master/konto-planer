# Konto Planer

Zeigt für jedes Girokonto, wie viel Geld bis zum nächsten Gehaltseingang mindestens drauf sein muss – und wie viel davon frei verfügbar ist.

Selbst gehostete Web-App für das Heimnetz: SvelteKit und PostgreSQL als Docker-Stack, am iPhone als Web-App auf dem Homescreen installierbar. Status: in Entwicklung, siehe [Plan](docs/PLAN.md) und [Changelog](CHANGELOG.md).

## Installation

Voraussetzung: Docker mit Compose und ein Reverse Proxy mit HTTPS.

```sh
git clone https://github.com/rde-master/konto-planer.git
cd konto-planer
cp .env.example .env   # Passwort, ORIGIN und Port anpassen
docker compose up -d
```

Dann die Adresse aus `ORIGIN` im Browser öffnen und den ersten Admin anlegen. Updates: `docker compose pull && docker compose up -d` – Migrationen laufen beim Start automatisch.

Am iPhone: Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Entwicklung

Voraussetzungen: Node 24, pnpm, Docker.

```sh
pnpm install
pnpm db:up          # Postgres für die Entwicklung auf localhost:5432
echo 'DATABASE_URL=postgres://kontoplaner:kontoplaner@localhost:5432/kontoplaner' > .env
pnpm dev
```

| Befehl                           | Zweck                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| `pnpm lint` / `pnpm format`      | Prettier und ESLint                                                                |
| `pnpm check`                     | Typprüfung (App und Service Worker)                                                |
| `pnpm test`                      | Unit-Tests (Vitest)                                                                |
| `pnpm build && pnpm test:e2e`    | End-to-End-Tests im iPhone-Format (Playwright, eigene Datenbank `kontoplaner_e2e`) |
| `pnpm db:generate --name <name>` | Migration aus dem Schema erzeugen                                                  |

## Lizenz

[MIT](LICENSE). Symbole: [Lucide](https://lucide.dev) (ISC).
