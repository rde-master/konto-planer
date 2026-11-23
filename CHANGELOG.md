# Changelog

Alle nennenswerten Änderungen an Konto Planer. Versionen folgen [SemVer](https://semver.org/lang/de/); jede Funktion erscheint als eigene Unterversion 0.x.0.

## [0.2.0] – Benutzerverwaltung

### Neu

- Benutzerverwaltung für Admins unter Einstellungen → Benutzer: Benutzer anlegen, Name, E-Mail und Rolle ändern, löschen
- Passwort zurücksetzen durch den Admin; der Benutzer wird dabei auf allen Geräten abgemeldet
- Eigenes Passwort ändern unter Einstellungen → Passwort ändern; andere Geräte werden abgemeldet, das aktuelle bleibt angemeldet
- Schutzregeln: Es bleibt immer mindestens ein Admin, niemand kann sich selbst löschen oder sich die Admin-Rolle entziehen
- Eingaben erscheinen als Blatt, das von unten einfährt; Unterseiten haben einen Zurück-Knopf wie in iOS

## [0.1.0] – Fundament

### Neu

- Erster Start im Browser: Einrichtung des ersten Admins, danach ist die Einrichtung gesperrt
- Anmeldung mit Benutzername und Passwort; ein Gerät bleibt bis zur Abmeldung angemeldet (Sitzung bis 400 Tage, verlängert sich bei Nutzung)
- Grundlayout im iOS-Stil: schwebende Tab-Leiste am Handy, Seitenleiste am Desktop, große Titel, die beim Scrollen schrumpfen, gruppierte Listen
- Hell- und Dunkelmodus nach Geräteeinstellung, in den Einstellungen umschaltbar; beachtet „Transparenz reduzieren“, „Kontrast erhöhen“ und „Bewegung reduzieren“
- Installierbar als Web-App auf dem Homescreen (PWA) mit eigenem Symbol
- Docker-Stack aus App und PostgreSQL; Datenbank-Migrationen laufen beim Start
- Statusabfrage unter `/api/health`

### Technik

- Prüf-Pipeline für Pull Requests (Lint, Typprüfung, Unit-Tests, Build, End-to-End-Tests im Handy-Format, Docker-Build)
- Release-Pipeline: Merge auf `main` erzeugt Tag, GitHub-Release und Docker-Image in der GitHub-Registry
