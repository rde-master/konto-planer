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

### Sicherung vor Updates

Bevor ein Update die Datenbank ändert, legt die App automatisch eine Sicherung im Volume `app-data` unter `backups/` ab (z. B. `2026-11-23_12-08-34_vor-0.5.0.dump`); die neuesten 10 bleiben erhalten. Schlägt die Sicherung fehl, startet die App nicht und die Datenbank bleibt unverändert – im Log steht der Grund. Regelmäßige Sicherungen ersetzt das nicht.

Sicherung wiederherstellen (ersetzt den aktuellen Stand vollständig; Benutzer und Datenbankname wie in `.env`):

```sh
docker compose stop app
docker compose cp app:/app/data/backups/<datei>.dump ./restore.dump
docker compose cp ./restore.dump db:/tmp/restore.dump
docker compose exec db dropdb -U kontoplaner kontoplaner
docker compose exec db createdb -U kontoplaner kontoplaner
docker compose exec db pg_restore -U kontoplaner -d kontoplaner --no-owner /tmp/restore.dump
```

Danach das Image der Version vor dem Update in `docker-compose.yml` eintragen (z. B. `:0.4.0` statt `:latest`) und `docker compose up -d` – eine neuere Version würde sonst sofort wieder migrieren.

### Dokumente

PDF-Anhänge an Dauerposten (bis 10 MB je Datei) liegen im Volume `app-data` unter `attachments/`, nicht in der Datenbank. Die Sicherung vor Updates enthält sie nicht – bei eigenen Sicherungen das Volume `app-data` mitsichern.

Am iPhone: Seite in Safari öffnen → Teilen → „Zum Home-Bildschirm“.

## Lesende API und Home Assistant

Unter Einstellungen › API-Zugänge legt jeder Benutzer eigene Tokens an (alle oder ausgewählte Konten, jederzeit widerrufbar). Abfrage:

```sh
curl -H "Authorization: Bearer <token>" https://konto.example.lan/api/v1/status
```

Die Antwort enthält Kontostände („Stand vom“), verfügbar und Mindestbestand je Girokonto, nächste Zahlungen, Budgets des Monats und Warnungen; `/api/v1/accounts/<id>` liefert ein Konto. Für Home Assistant zeigt die App beim Anlegen einen fertigen REST-Sensor (YAML). Alternativ sendet die App die Werte stündlich als `sensor.konto_planer_…` an Home Assistant (Einstellungen › Benachrichtigungen, Admin).

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

[MIT](LICENSE). Symbole: [Lucide](https://lucide.dev) (ISC). Firmenlogos: [Simple Icons](https://simpleicons.org) (CC0); Markennamen und Logos gehören ihren Inhabern und werden nur zur Kennzeichnung von Zahlungen angezeigt.
