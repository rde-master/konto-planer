# Widgets, Kurzbefehl, Kalender und API

## Widgets auf dem iPhone

Widgets laufen über die kostenlose App **Scriptable**. Unter **Mehr › Widgets** wählst du eine Vorlage („Verfügbar bis Gehalt“, „Offene Zahlungen“, „Alle Konten“) oder gestaltest im **Editor** ein eigenes: Bausteine, Reihenfolge, Größe, Farben, Schrift, hell oder dunkel.

1. **Widget anlegen** und **Skript kopieren** tippen.
2. In Scriptable mit **+** ein neues Skript anlegen und einfügen.
3. Auf dem Home-Bildschirm ein Scriptable-Widget hinzufügen, gedrückt halten › Widget bearbeiten › das Skript wählen.

Für den **Sperrbildschirm** (ab iOS 16) gibt es die Größen rechteckig, rund und als Zeile über der Uhr. Änderungen im Editor kommen ohne neues Kopieren an. Ohne Verbindung zeigt das Widget die zuletzt geladenen Werte mit Uhrzeit.

## Schnellerfassung per Kurzbefehl

Mit einem iOS-Kurzbefehl buchst du, ohne die App zu öffnen: Betrag eingeben, fertig – vom Home-Bildschirm, mit der Aktionstaste oder per Siri. Unter **iOS Kurzbefehle** (im Menü „Mehr“) legst du dafür einen Zugang an und wählst das Konto, auf das gebucht wird. Die Seite zeigt Adresse und Kopfzeile zum Kopieren und führt Schritt für Schritt durch die App „Kurzbefehle“.

Die einfache Fassung fragt nur nach dem Betrag; die Kategorie setzt die App dann über deine Regeln („Immer so einordnen“). Die erweiterte Fassung lässt dich vorher eine Vorlage oder Kategorie wählen. Gebucht wird immer am heutigen Tag.

Einen fertigen Kurzbefehl zum Laden gibt es nicht: iOS nimmt nur Kurzbefehle an, die Apple signiert hat (iCloud-Link oder Mac). Den Zugang kannst du auf der Seite jederzeit widerrufen – etwa wenn das iPhone verloren geht.

## Kalender-Abo

Unter **Einstellungen › Kalender-Abo** erzeugst du einen geheimen Link für Apple Kalender und Co. Wählbar: Fälligkeiten, Kündigungsfristen (mit Erinnerung), Kreditkarten-Abbuchungen und Sparziel-Termine. Auf dem iPhone: Einstellungen › Kalender › Accounts › Account hinzufügen › Andere › Kalenderabo hinzufügen.

## API und Home Assistant

Unter **Einstellungen › API-Zugänge** legst du lesende Zugänge an (alle oder ausgewählte Konten). Für Home Assistant zeigt die App einen fertigen REST-Sensor zum Kopieren. Alternativ sendet die App die Werte stündlich als Sensoren an Home Assistant (Admin, unter Benachrichtigungen). Jeder Zugang lässt sich einzeln widerrufen.
