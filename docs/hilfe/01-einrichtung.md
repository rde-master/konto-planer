# Einrichtung

Dieses Kapitel ist für den Admin, der Konto Planer auf einem eigenen Server betreibt. Alle anderen können direkt mit den [ersten Schritten](02-erste-schritte.md) beginnen.

## Voraussetzungen

- Ein Rechner im Heimnetz mit Docker und Docker Compose (z. B. NAS, Mini-PC, Raspberry Pi 4/5)
- Ein Reverse Proxy mit HTTPS (z. B. Nginx Proxy Manager, Caddy, Traefik). HTTPS ist nötig, damit Login, Web-App auf dem iPhone und Push funktionieren.
- Für Push-Mitteilungen braucht der Server Internetzugang (Push-Dienst von Apple).

## Installation

```
git clone https://github.com/rde-master/konto-planer.git
cd konto-planer
cp .env.example .env
docker compose up -d
```

In der Datei `.env` vorher anpassen:

- `POSTGRES_PASSWORD`: ein eigenes, langes Passwort für die Datenbank
- `ORIGIN`: die Adresse, unter der die App über den Reverse Proxy erreichbar ist, z. B. `https://konto.example.lan`
- `APP_PORT`: der Port auf dem Server, an den der Reverse Proxy weiterleitet (Standard 3000)
- `APP_SECRET` (optional): Schlüssel für gespeicherte Zugangsdaten. Ohne Angabe legt die App selbst eine Schlüsseldatei im Datenvolume an.

## Erster Start

Die Adresse aus `ORIGIN` im Browser öffnen. Beim ersten Aufruf legst du den Admin an (Name, Benutzername, Passwort). Danach unter **Einstellungen › Benutzer** weitere Personen anlegen und unter **Konten** festlegen, wer welches Konto sehen oder bearbeiten darf.

## Am iPhone installieren

Die Seite in Safari öffnen, **Teilen › Zum Home-Bildschirm** tippen. Die App startet dann ohne Browserleiste und kann Mitteilungen bekommen.

## Updates

```
docker compose pull
docker compose up -d
```

Vor jeder Änderung der Datenbank legt die App automatisch eine Sicherung an. Was sich geändert hat, zeigt die App nach dem Update einmal unter **Was ist neu**; der Admin sieht unter **Einstellungen › Systemstatus**, ob eine neuere Version verfügbar ist.

## Sicherung und Wiederherstellung

Sicherungen liegen im Volume `app-data` unter `backups/`. Unter **Einstellungen › Systemstatus** kannst du jederzeit **Jetzt sichern** tippen und Sicherungen herunterladen; die neuesten zehn bleiben erhalten. PDF-Anhänge liegen im selben Volume unter `attachments/` – für eine vollständige Sicherung das ganze Volume `app-data` mitsichern.

Wiederherstellen (ersetzt den aktuellen Stand vollständig; Benutzer und Datenbankname wie in `.env`):

```
docker compose stop app
docker compose cp app:/app/data/backups/<datei>.dump ./restore.dump
docker compose cp ./restore.dump db:/tmp/restore.dump
docker compose exec db dropdb -U kontoplaner kontoplaner
docker compose exec db createdb -U kontoplaner kontoplaner
docker compose exec db pg_restore -U kontoplaner -d kontoplaner --no-owner /tmp/restore.dump
docker compose up -d
```

Stammt die Sicherung von einer älteren Version, vorher in `docker-compose.yml` das passende Image eintragen (z. B. `:0.57.0` statt `:latest`).
