# Changelog

Alle nennenswerten Änderungen an Konto Planer. Versionen folgen [SemVer](https://semver.org/lang/de/); jede Funktion erscheint als eigene Unterversion 0.x.0.

## [0.9.0] – Umbuchungen zwischen Konten

### Neu

- Neue Art „Umbuchung“ bei den Dauerposten: Geld regelmäßig von einem Konto auf ein anderes Konto der App übertragen, z. B. die monatliche Sparrate
- Quelle kann ein Girokonto oder ein Sparbuch sein; Ziel kann jedes aktive Konto der App sein, auch das Konto eines anderen Benutzers, ohne dessen Bestätigung. Fremde Konten erscheinen dabei nur mit ihrem Namen
- Die Umbuchung erscheint auf dem Quellkonto als Ausgang und auf dem Zielkonto automatisch als Eingang, auch in den Monatssummen
- Wer nur das Zielkonto sieht, sieht die Umbuchung dort als Eingang „von …“, schreibgeschützt
- Ändern und löschen dürfen alle mit Recht „Bearbeiten“ auf dem Quellkonto, der Anleger und der Admin
- Konten, auf die eine Umbuchung zielt, lassen sich nur noch archivieren
- Das Protokoll zeigt das Zielkonto

## [0.8.0] – Dauerposten

### Neu

- Dauerposten für regelmäßige Ausgaben und Einnahmen auf Girokonten: Bezeichnung, Betrag, Konto, Kategorie, Empfänger oder Zahler, IBAN, Zahlart, Mandatsreferenz und Gläubiger-ID (mit Prüfziffer-Check)
- Alle Intervalle: wöchentlich, monatlich, vierteljährlich, halbjährlich, jährlich, einmalig und frei (alle N Tage, Wochen oder Monate), mit optionalem Ende
- Fällt der Tag in einem Monat weg (z. B. der 31.), gilt der letzte Tag des Monats
- Betragsverlauf: Jede Preisänderung bleibt mit „gültig ab“ erhalten, auch für künftige Änderungen; die nächsten Fälligkeiten zeigen den jeweils gültigen Betrag
- Kennzeichen für schwankende Beträge und für Gehaltseingänge
- Übersicht je Konto mit nächster Fälligkeit und Summe der Ausgaben und Einnahmen pro Monat
- Archivieren, Wiederherstellen und Löschen; Konten mit Dauerposten lassen sich nur noch archivieren
- Wer ein Konto nur sehen darf, sieht dessen Dauerposten schreibgeschützt
- Alle Änderungen stehen im Protokoll

## [0.7.0] – Kategorien

### Neu

- Kategorien unter „Mehr“: Hauptkategorien mit Farbe und Unterkategorien, für alle Benutzer gleich
- Bei leerer Liste lässt sich eine Vorschlagsliste mit üblichen Haushaltskategorien übernehmen
- Jeder Benutzer kann Kategorien anlegen, umbenennen und einer anderen Hauptkategorie zuordnen; löschen kann nur der Admin
- Wird eine Hauptkategorie gelöscht, verschwinden ihre Unterkategorien mit; Buchungen und Dauerposten bleiben erhalten und gelten dann als unkategorisiert
- Gleiche Namen innerhalb einer Hauptkategorie werden abgelehnt
- Alle Änderungen an Kategorien stehen im Protokoll

## [0.6.0] – Konten

### Neu

- Konten anlegen (Admin): Girokonto oder Sparbuch mit Name, Farbe, IBAN (optional, mit Prüfziffer-Check), Startsaldo mit „Stand am“ und bei Girokonten dem Dispo-Rahmen
- Kontenübersicht nach Girokonten, Sparbüchern und Archiviert; jeder sieht nur die Konten, die ihm freigegeben sind, der Admin sieht alle
- Zugriff je Konto und Benutzer: „Sehen“ oder „Bearbeiten“; mit „Bearbeiten“ lassen sich Kontodaten ändern, Konten ohne Zugriff sind nicht auffindbar
- Archivieren macht ein Konto schreibgeschützt, Wiederherstellen hebt das auf; Konten ohne Daten kann der Admin löschen
- Eine IBAN kann nur zu einem Konto gehören
- Beträge werden deutsch eingegeben („1.234,56“) und intern centgenau gespeichert
- Alle Änderungen an Konten und Zugriffen stehen im Protokoll

## [0.5.0] – Protokoll

### Neu

- Protokoll für Admins unter Einstellungen → Protokoll: wer hat wann was getan, nach Tagen gruppiert, neueste zuerst
- Erfasst werden Anlegen, Ändern und Löschen von Benutzern, Anmeldungen (auch fehlgeschlagene), Login-Sperren, Abmelden, Passwort zurücksetzen und ändern sowie aufgehobene Sperren
- Bei Änderungen zeigt ein Eintrag nur die geänderten Felder mit altem und neuem Wert
- Filter nach Benutzer, Bereich, Aktion und Zeitraum; lange Protokolle lassen sich blättern
- Passwörter, Passwort-Hashes und Tokens landen nie im Protokoll; Einträge bleiben lesbar, auch wenn der Benutzer gelöscht wurde

## [0.4.0] – Sicherung vor Update

### Neu

- Bevor ein Update die Datenbank ändert, legt die App automatisch eine vollständige Sicherung an (`pg_dump`, im Volume `app-data` unter `backups/`, Name mit Datum und Zielversion)
- Die neuesten 10 Sicherungen bleiben erhalten, ältere werden danach entfernt
- Schlägt die Sicherung fehl, startet die App nicht und die Datenbank bleibt unverändert; der Grund steht im Log
- Anleitung zum Wiederherstellen im README

### Technik

- Neue Pflichtprüfung „Upgrade from last release“: jeder Pull Request wird als Update auf die letzte veröffentlichte Version getestet – Migration, Anmeldung mit bestehendem Konto und, falls migriert wurde, ob sich die Sicherung wieder einspielen lässt

## [0.3.0] – Login-Sperre

### Neu

- Nach 5 Fehlversuchen ist die Anmeldung für diesen Benutzernamen 15 Minuten gesperrt, nach 10 Fehlversuchen 1 Stunde, danach jeweils 24 Stunden; die Login-Seite zeigt, ab wann es wieder geht
- Während der Sperre wird das Passwort gar nicht geprüft; unbekannte Benutzernamen werden genauso behandelt, damit nicht erkennbar ist, welche Namen es gibt
- Eine erfolgreiche Anmeldung setzt den Zähler zurück; Fehlversuche, die älter als 24 Stunden sind, zählen nicht mehr
- Der Admin sieht eine Sperre auf der Seite des Benutzers und kann sie aufheben; „Passwort zurücksetzen“ hebt sie ebenfalls auf

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
