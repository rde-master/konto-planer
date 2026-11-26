# Konto Planer – Umsetzungsplan

Nov 23, 2026 · @Daniel

## Ziel und Rahmen

Konto Planer zeigt für jedes Girokonto, wie viel Geld bis zum nächsten Gehaltseingang mindestens drauf sein muss und wie viel davon frei verfügbar ist. Grundlage sind regelmäßige Zahlungen, Einnahmen, Umbuchungen und die importierten Bankbuchungen.

**Im Umfang**

- Web-App, zuerst für das Handy gestaltet, dazu eine Desktop-Ansicht; Deutsch, Dark Mode, nur Euro; Gestaltung nach aktuellem iOS
- Etwa 4 Benutzer mit lokalem Login, Sichtbarkeit je Konto einstellbar
- Betrieb als Docker-Stack im Heimnetz, Zugriff nur aus Heimnetz und VPN
- Widgets auf iOS über Scriptable, gestaltet in einem Editor auf der Webseite
- Entwicklung durch Claude Code auf eigenem Harness, Veröffentlichung über GitHub

**Nicht im Umfang**

- Eigene Apps für iOS, Android, Windows oder macOS
- Direkte Bankanbindung (nur Dateiimport)
- 2FA, SSO, mehrere Währungen, Export der Buchungen
- Regelmäßiges Backup (läuft über Proxmox); die App sichert nur vor Updates

## Architektur und Stack

Der Stack besteht aus zwei Containern: der App und der Datenbank. Durchgängig TypeScript, weil auch die Scriptable-Widgets JavaScript sind und der Widget-Editor so denselben Code erzeugen und in der Vorschau ausführen kann.

| Baustein | Technik | Aufgabe |
| --- | --- | --- |
| Web-App | SvelteKit, Tailwind, als PWA installierbar | Oberfläche und Server-API in einem Container |
| Datenbank | PostgreSQL | Alle Daten; Beträge als ganze Cent |
| Datenzugriff | Drizzle | Schema und Migrationen, laufen beim Start automatisch |
| Grafiken | Apache ECharts | Dashboard und Auswertungen |
| Hintergrundjobs | Zeitplaner in der App, täglich | Fälligkeiten erzeugen und vorläufig buchen, Zinsen berechnen, Fristen und Meldungen prüfen, Benachrichtigungen senden |
| Externe API | Token je Zugang; lesend für Widgets, Kalender und Home Assistant, schreibend nur für den Kurzbefehl | Daten und Layout für Scriptable, Sensorwerte, Kalender, Schnellerfassung |
| Tests | Vitest, Playwright | Rechenlogik und Bedienung im Handy-Format |

Zeitzone ist fest Europe/Berlin. Der Zugriff läuft über den vorhandenen Reverse Proxy mit HTTPS. Die Basis-Adresse ist in den Einstellungen konfigurierbar und wird in die Widget-Skripte übernommen.

## Design

Die Oberfläche orientiert sich am aktuellen iOS-Design (Liquid Glass, Stand iOS 27), damit sich die Web-App am iPhone wie eine System-App anfühlt.

- **Navigation:** schwebende Tab-Leiste unten am Handy, große Seitentitel, die beim Scrollen schrumpfen; am Desktop eine Seitenleiste in derselben Formensprache
- **Flächen:** durchscheinende Leisten und Menüs mit Glas-Effekt, Inhalte auf gerundeten Karten, gruppierte Listen wie in den iOS-Einstellungen
- **Bedienung:** Eingaben als Blätter, die von unten einfahren; Wischgesten in Listen; große Tippflächen; die Schnellerfassung als runder Plus-Knopf
- **Schrift und Symbole:** Systemschrift des Geräts, Symbole im Stil der iOS-Systemsymbole
- **Hell und Dunkel:** folgt der Geräteeinstellung, in der App umschaltbar; Akzentfarbe ist das iOS-Blau
- **Lesbarkeit:** Text steht nie direkt auf unruhigem Glas; die Systemeinstellungen für weniger Transparenz, mehr Kontrast und weniger Bewegung werden beachtet
- **Widgets:** die Vorlagen im Widget-Editor folgen demselben Stil

Apples eigene Schrift- und Symboldateien werden nicht ins öffentliche Repo übernommen; die App nutzt die auf dem Gerät vorhandene Systemschrift und ein frei lizenziertes Symbolset.

## Datenmodell

Kern sind drei Dinge: der Dauerposten (was regelmäßig passiert), die Fälligkeit (wann es das nächste Mal passiert) und die Buchung (was wirklich passiert ist).

| Tabelle | Wichtige Felder | Hinweis |
| --- | --- | --- |
| Benutzer | Name, E-Mail, Passwort-Hash, Rolle, Benachrichtigungsziele | Rollen: Admin, Benutzer |
| Konto | Name, Typ (Giro, Sparbuch, Kreditkarte), IBAN, Dispo bzw. Kreditrahmen, Abrechnungskonto, Abrechnungs- und Abbuchungstag (Kreditkarte), Zinssatz, Zinsrhythmus, Startsaldo, Stichtag-Modus, Stichtag-Eingang, Puffer, archiviert | IBAN dient der Prüfung beim Import |
| Kontozugriff | Konto, Benutzer, Stufe (sehen, bearbeiten) | Steuert, wer was sieht |
| Kategorie | Name, Übergeordnete Kategorie, Farbe | Global, mit Unterkategorien |
| Dauerposten | Konto, Art (Ausgabe, Einnahme, Umbuchung), Zielkonto, Empfänger, IBAN, Mandatsreferenz, Gläubiger-ID, Kategorie, Intervall, Start, Ende, schwankend, Gehalt-Kennzeichen, Anleger, Zahlart, Pause von und bis, archiviert | Intervalle: wöchentlich, monatlich, quartalsweise, halbjährlich, jährlich, frei, einmalig |
| Vertragsdaten | Laufzeit bis, Kündigungsfrist, automatische Verlängerung, Vorlauf, gekündigt am | Am Dauerposten, nur bei kündbaren Zahlungen |
| Betragsverlauf | Dauerposten, Betrag, gültig ab | Jede Preisänderung bleibt erhalten |
| Fälligkeit | Dauerposten, Datum, erwarteter Betrag, Status (offen, vorläufig gebucht, gebucht, übersprungen), Buchung | Grundlage für offene Zahlungen |
| Buchung | Konto, Buchungstag, Valuta, Betrag, Empfänger, IBAN, Verwendungszweck, Buchungstext, Kategorie, Quelle (Import, manuell, Anpassung), Saldo danach, Prüfsumme | Verknüpft mit Dauerposten und Gegenbuchung |
| Import | Konto, Datei, Benutzer, Zeitpunkt, Anzahl neu und übersprungen | Jeder Import ist nachvollziehbar |
| Protokoll | Benutzer, Zeitpunkt, Objekt, Aktion, vorher, nachher | Nur für Admin sichtbar |
| Widget | Besitzer, Konten, Layout, Token-Hash | Token einzeln widerrufbar |
| Einstellungen | SMTP, Home-Assistant-Adresse und Token, Standard-Vorlauf | Zugangsdaten verschlüsselt gespeichert |
| Sparziel | Sparbuch, Name, Zielbetrag, Zieldatum, verknüpfte Zahlung (einmalig oder Dauerposten) | Mehrere Ziele je Sparbuch möglich |
| Meldungsregel | Art der Meldung, Konto, Empfänger, Kanal, Wiederholung, Toleranztage | Je Meldung einstellbar |
| Kategorieregel | Bedingung (Empfänger, Verwendungszweck, IBAN), Kategorie, Reihenfolge | Global für alle Benutzer; greift beim Import |
| Tag | Name; Zuordnung zu Buchungen und Dauerposten | Global für alle Benutzer, zusätzlich zur Kategorie |
| Buchungsteil | Buchung, Betrag, Kategorie | Für Splitbuchungen; die Teile ergeben den Buchungsbetrag |
| Budget | Kategorie, Konto, Monatsgrenze | Je Kategorie und Konto |
| Darlehen | Dauerposten, Darlehenssumme, Zinssatz, Beginn, Laufzeitende | Restschuld wird berechnet |
| Anhang | Dauerposten, Dateiname, Datei | PDF zu den Vertragsdetails, liegt im Docker-Volume |
| API-Token | Besitzer, Zweck (Kalender, Home Assistant, Kurzbefehl), Konten, Token-Hash | Einzeln widerrufbar; nur das Kurzbefehl-Token darf schreiben |

## Fachlogik

**Mindestbestand.** Der Mindestbestand ist der Betrag, der heute auf dem Konto sein muss, damit es bis zum Stichtag an keinem Tag ins Minus geht. Die App geht alle offenen Fälligkeiten bis zum Stichtag der Reihe nach durch und nimmt den tiefsten Punkt. Verfügbar ist der Kontostand minus Mindestbestand. Ein einstellbarer Puffer je Konto kommt zum Mindestbestand dazu.

- Stichtag ist standardmäßig der nächste Gehaltseingang, umschaltbar auf Monatsende oder ein freies Datum, direkt in der Kontoübersicht
- Gehalt ist eine Einnahme mit Kennzeichen, gesetzt von Hand oder beim Import
- Erwartete Eingänge vor dem Stichtag, auch Umbuchungen von anderen Konten, werden zum jeweiligen Datum gegengerechnet

* Bei mehreren Gehaltseingängen auf einem Konto ist wählbar, welcher den Stichtag bestimmt; auch eine Umbuchung oder andere Einnahme kann Stichtag sein
* Schwankende Beträge gehen mit dem letzten bekannten Wert in die Vorschau ein
* Fälligkeiten am Wochenende oder Feiertag rutschen auf den nächsten Bankarbeitstag, auch das Gehalt; maßgeblich ist der bundesweite Bankkalender (TARGET), nicht die Feiertage eines Bundeslands
* Einmalige geplante Zahlungen (Urlaub, Anschaffung) lassen sich mit Datum erfassen und zählen im Mindestbestand mit

**Kontostand.** Der Stand ergibt sich aus Startsaldo plus allen Buchungen. Den Startsaldo gibt man beim Anlegen des Kontos von Hand ein. Eine manuelle Korrektur bucht die Differenz als Anpassung. Der nächste Import löst Anpassungen im importierten Zeitraum auf und gleicht den Stand mit der Spalte „Saldo nach Buchung“ ab. Eine verbleibende Differenz wird angezeigt.

**Vorläufig gebucht.** Am Fälligkeitstag gilt jede Fälligkeit automatisch als vorläufig gebucht und verändert den berechneten Kontostand. Das gilt für Zahlungen, Umbuchungen und Einnahmen wie das Gehalt. Der nächste Import bestätigt sie mit der echten Buchung. Fehlt die echte Buchung im Import, zeigt die App beim Import einen Hinweis; die vorläufige Buchung bleibt stehen, bis jemand entscheidet, ob sie bleibt, verschoben oder zurückgenommen wird.

**Dispo.** Der Dispo zählt nie zum verfügbaren Betrag. Die App zeigt einen Hinweis, sobald der Dispo erreicht ist, und eine große Warnung, wenn er bis zum Stichtag überschritten werden könnte.

**Umbuchungen.** Eine Umbuchung ist ein Dauerposten mit Quell- und Zielkonto. Sie zählt auf dem Quellkonto als Ausgang und auf dem Zielkonto automatisch als Eingang, auch wenn die Konten verschiedenen Benutzern gehören. Als Ziel sind alle Konten der App wählbar, angezeigt wird dabei nur der Kontoname. Geld an ein Konto außerhalb der App ist immer eine Zahlung.

**Sparbuch.** Sparkonten haben keine Abbuchungen und keine Mindestbestand-Planung. Eingänge sind Umbuchungen, Geld geht nur per Umbuchung wieder raus. Der Eingang wird automatisch gebucht, sobald die Umbuchung auf dem Girokonto fällig oder importiert ist. Ein Import wird für Sparbücher nicht erwartet; die Zinsen berechnet die App aus Stand und Zinssatz voraus, der Rhythmus der Gutschrift ist einstellbar. Angezeigt werden Stand, Verlauf und Zinssatz.

**Kreditkarte.** Umsätze, Dauerposten und Import wie beim Girokonto, dazu ein Kreditrahmen mit Warnung. Am Abrechnungstag wird der Saldo festgestellt und am Abbuchungstag (nächster Bankarbeitstag) vom gewählten Girokonto ausgeglichen; fehlt der Tag im Monat, gilt der Monatsletzte. Die künftige Abbuchung (Saldo plus geplante Kartenzahlungen bis zum Abrechnungstag) zählt in Mindestbestand, verfügbarem Betrag und Vorschau des Girokontos. Gebuchte Abrechnungen folgen nachträglich erfassten Umsätzen, bis ein Import sie durch die echte Buchung ersetzt.

**Sparziel.** Eine einmalige geplante Zahlung lässt sich mit einem Sparziel auf einem Sparbuch verknüpfen. Die App zeigt Zielbetrag, Zieldatum, Fortschritt und die nötige Sparrate. Zum Fälligkeitstag plant sie eine Umbuchung vom Sparbuch aufs Girokonto ein, sodass der Mindestbestand dort nicht belastet wird.

**Archivieren.** Konten und Dauerposten mit Buchungen werden archiviert statt gelöscht. Wird eine Kategorie gelöscht, bleiben ihre Buchungen erhalten und gelten als unkategorisiert.

**Historie je Eintrag.** Jeder Dauerposten zeigt seinen Betragsverlauf und alle zugeordneten echten Buchungen als Liste und als Kurve. Weicht eine importierte Buchung vom Plan ab, schlägt die App vor, den Betrag ab diesem Datum zu übernehmen.

**Schnellerfassung.** Ein Plus-Knopf auf jeder Seite: Betrag, Konto, Kategorie, fertig. Datum ist heute. Beim nächsten Import wird die manuelle Buchung der echten zugeordnet statt doppelt gezählt.

## Import

Der Import nimmt den Volksbank-Export je Konto entgegen, speichert alle Buchungen und lässt auswählen, welche als Dauerposten angelegt werden. Der Export ist eine CSV-Datei mit Semikolon als Trennzeichen. Zeichensatz, Datums- und Zahlenformat erkennt der Import selbst und zeigt das Ergebnis in der Vorschau.

**Spalten laut Muster (19):** Bezeichnung Auftragskonto, IBAN Auftragskonto, BIC Auftragskonto, Bankname Auftragskonto, Buchungstag, Valutadatum, Name Zahlungsbeteiligter, IBAN Zahlungsbeteiligter, BIC (SWIFT-Code) Zahlungsbeteiligter, Buchungstext, Verwendungszweck, Betrag, Waehrung, Saldo nach Buchung, Bemerkung, Kategorie, Gekennzeichneter Umsatz, Glaeubiger ID, Mandatsreferenz.

**Ablauf**

1. Konto wählen und Datei hochladen. Die IBAN des Auftragskontos muss zum Konto passen, sonst bricht der Import ab.
2. Dubletten erkennen: Prüfsumme aus Buchungstag, Betrag, IBAN des Zahlungsbeteiligten, Verwendungszweck und Saldo nach Buchung. Gleiche Zeilen gelten als schon vorhanden.
3. Dauerposten zuordnen: zuerst über Mandatsreferenz und Gläubiger-ID, dann über IBAN und Name, zuletzt über Betrag und Datum mit Toleranz.
4. Umbuchungen erkennen: Ist die Gegen-IBAN ein Konto in der App, wird die Buchung mit der Gegenseite verknüpft.
5. Vorschau zeigen, je Zeile mit Status: neu, schon vorhanden, passt zu Dauerposten, passt zu manueller Buchung, Umbuchung; dazu ein Hinweis auf vorläufige Buchungen ohne echte Gegenbuchung.
6. Auswählen: Wiederkehrende Empfänger werden als neue Dauerposten mit erkanntem Intervall vorgeschlagen und per Haken angelegt. Hier lässt sich auch das Gehalt markieren.
7. Übernehmen: Buchungen speichern, Fälligkeiten als gebucht setzen, Anpassungen auflösen, Saldo prüfen.

Die Bank-Kategorie aus der Datei dient als Vorschlag. Die App merkt sich, welcher Empfänger welcher eigenen Kategorie zugeordnet wurde.

**Testdaten.** Der Agent erstellt eine erfundene CSV-Datei mit genau diesen 19 Spalten und Semikolon als Trennzeichen, mit Gehalt, Lastschriften, Umbuchungen und Dubletten. Sie liegt als Testdatei im Repo.

## Benutzer, Rechte und Logging

Jeder Benutzer sieht nur die Konten, die ihm zugewiesen sind. Der Admin legt Benutzer an; eine freie Registrierung gibt es nicht. Den ersten Admin legt man beim ersten Aufruf im Browser an, nicht über die Docker-Konfiguration.

- **Login:** lokal mit Benutzername und Passwort, ohne 2FA und ohne SSO
- **Rollen:** Admin (Benutzer, Einstellungen, Protokoll, Kategorien löschen) und Benutzer (Kategorien anlegen und ändern)
- **Kontozugriff:** je Konto und Benutzer die Stufe „sehen“ oder „bearbeiten“
- **Protokoll:** jede Anlage, Änderung, Löschung, jeder Import und jeder Login mit Benutzer, Zeitpunkt und Vorher-Nachher-Werten; filterbar, nur für Admin

* **Admin:** sieht alle Konten, legt Konten an und vergibt die Zugriffe
* **Umbuchungen:** auf das Konto eines anderen Benutzers ohne dessen Bestätigung; ändern und löschen dürfen der Anleger und der Admin
* **Sitzung:** ein Gerät bleibt so lange wie möglich eingeloggt, bis zur Abmeldung
* **Passwort vergessen:** der Admin setzt es zurück

## Benachrichtigungen

Die App meldet kündbare Zahlungen rechtzeitig vor Ablauf der Kündigungsfrist, per E-Mail und über Home Assistant.

- **Auslöser:** letzter Kündigungstermin minus Vorlauf; der Vorlauf ist je Dauerposten einstellbar, mit einem Standardwert in den Einstellungen
- **E-Mail:** SMTP-Zugang in den Einstellungen (Server, Port, Benutzer, Passwort, Absender), mit Test-Knopf
- **Home Assistant:** Adresse und Zugriffstoken in den Einstellungen; je Benutzer wählbar, welche Geräte und Personen benachrichtigt werden, mit Test-Knopf
- **In der App:** Liste „Bald kündbar“ auf dem Dashboard; „Gekündigt“ setzt das Enddatum des Dauerpostens

**Weitere Meldungen** auf denselben Wegen und im Dashboard: Mindestbestand unterschritten, erwartete Zahlung ausgeblieben, Dispo erreicht, Dispo könnte bis zum Stichtag überschritten werden.

**Einstellbar je Meldung:** wer sie bekommt, ob sie einmalig kommt oder sich bis zur Erledigung wiederholt, und nach wie vielen Tagen eine Zahlung als ausgeblieben gilt.

## Widgets

Widgets werden im Browser gestaltet und als fertiges Scriptable-Skript kopiert. Das Skript ist allgemein gehalten und lädt Layout und Daten vom Server, sodass spätere Änderungen im Editor ohne erneutes Kopieren ankommen.

- **Editor:** Größe (klein, mittel, groß und Sperrbildschirm, soweit Scriptable es unterstützt), Konten, Bausteine, Farben, Schriftgröße, hell oder dunkel, mit Live-Vorschau
- **Bausteine:** verfügbar bis zum nächsten Gehalt, Mindestbestand, Kontostand, offene Zahlungen als Liste, nächste Zahlung, Fortschrittsbalken
- **Musterseite:** fertige Vorlagen wie „Verfügbar bis Gehalt“, „Offene Zahlungen“ und „Alle Konten“, jede mit Kopier-Knopf und einer Anleitung in drei Schritten
- **Zugriff:** eigenes Token je Widget, nur lesend, nur für die gewählten Konten, einzeln widerrufbar
- **Unterwegs ohne VPN:** das Widget zeigt die zuletzt geladenen Werte mit Zeitstempel

Wie oft ein Widget aktualisiert, bestimmt iOS.

## Repo, Versionierung und Deployment

Der Agent arbeitet selbstständig bis zum Pull Request; auf main kommt nichts ohne deine Freigabe.

- **Repo:** öffentlich auf GitHub, MIT-Lizenz, wird bei der Umsetzung angelegt
- **Ablauf:** Feature-Branch, Pull Request, automatische Prüfung (Lint, Tests, Build), Merge nur durch dich; main ist geschützt
- **Versionierung:** SemVer aus den Commit-Nachrichten (Conventional Commits). Jede Funktion kommt als eigener Pull Request; dein Merge erzeugt automatisch die nächste Unterversion 0.x.0 mit Tag, Changelog und Release
- **Image:** GitHub Actions baut bei jedem Release das Image und legt es mit Versionsnummer und `latest` in der GitHub-Registry ab
- **Deployment:** `docker-compose.yml` liegt im Repo; dein Docker-Management holt den Stack per Git und zieht neue Images automatisch. Datenbank-Migrationen laufen beim Start
- **Daten im Repo:** nur erfundene Testdaten. Echte Bankexporte und Zugangsdaten werden nie eingecheckt; `.gitignore` und `.env.example` sichern das ab
- **Agent-Regeln:** eine `CLAUDE.md` im Repo hält diese Regeln und diesen Plan für Claude Code fest

## Zusatzfunktionen

35 Erweiterungen sind beschlossen. Wann jede kommt, steht im Releaseplan.

| Funktion | Was sie tut |
| --- | --- |
| Sicherung vor Update | Vor jeder Datenbank-Migration legt die App einen Datenbank-Abzug ab |
| Login-Sperre | Nach mehreren Fehlversuchen wird der Login zeitweise gesperrt |
| Vertragsdetails | Kundennummer, Kündigungsadresse, Notiz und PDF am Dauerposten |
| Rücklagen für Jahreszahlungen | Jährliche und quartalsweise Posten werden in eine Monatsrate umgerechnet und auf Wunsch als Sparziel angelegt |
| Darlehen | Restschuld, Laufzeitende und Tilgungsverlauf bei Ratenzahlungen |
| Import rückgängig | Ein kompletter Import lässt sich mit einem Klick zurücknehmen |
| Regel-Editor für Kategorien | Eigene Regeln wie „Verwendungszweck enthält X, dann Kategorie Y“, die beim Import greifen |
| Splitbuchung | Eine Buchung auf mehrere Kategorien aufteilen |
| Tags | Frei vergebbar zusätzlich zur Kategorie, mit Jahresliste |
| Firmenlogos | Farbige Logos (Simple Icons) je Empfänger, automatisch nach dem Namen erkannt und von Hand änderbar; sonst farbige Initialen |
| Suche und Filter | Über alle Buchungen nach Empfänger, Betrag, Zeitraum, Kategorie und Tag |
| Gesamtübersicht Haushalt | Eine Seite mit allen sichtbaren Konten, Summe, verfügbarem Betrag und Sparzielen |
| 12-Monats-Vorschau | Kurve des Kontostands mit dem tiefsten Punkt des Jahres |
| Kennzahlen | Fixkostenquote, Sparquote und Preissteigerung je Vertrag in Prozent pro Jahr |
| Budget je Kategorie | Monatsgrenze je Kategorie und Konto, mit Fortschritt |
| Was-wäre-wenn | Vertrag probeweise hinzufügen oder kündigen und die Wirkung auf Mindestbestand und verfügbaren Betrag sehen |
| Preis- und Abo-Wächter | Meldung, wenn ein Dauerposten teurer wird oder im Import eine neue wiederkehrende Abbuchung auftaucht |
| Import-Erinnerung | Monatlich am 30., im Februar am Monatsletzten; dazu „Stand vom“ an jedem Kontostand |
| Monatsbericht per E-Mail | Einnahmen, Ausgaben, größte Posten und anstehende Kündigungsfristen |
| Kündigungsschreiben als PDF | Aus den Vertragsdetails erzeugt, fertig zum Versenden |
| Kalender-Abo | Fälligkeiten und Kündigungsfristen als abonnierbarer Kalender, geschützt durch ein Token |
| Home-Assistant-Sensoren | Verfügbarer Betrag und nächste Zahlung als Sensorwerte über die lesende API |
| Schnellerfassung per iOS-Kurzbefehl | Ausgabe erfassen, ohne die App zu öffnen; eigenes Token, das nur Buchungen anlegen darf |
| Systemstatus | Für den Admin: Version, letzter Hintergrundjob, letzte Sicherung; „Was ist neu“ nach jedem Update |
| Demo-Modus | Erfundene Daten für Screenshots im öffentlichen Repo |
| Puffer je Konto | Sicherheitsbetrag, der immer zum Mindestbestand dazukommt |
| Geplante Betragsänderung | Neuer Betrag ab einem künftigen Datum; die Vorschau rechnet ab dann damit |
| Erinnerung an manuelle Überweisungen | Zahlart je Dauerposten (Lastschrift, Dauerauftrag, manuell); bei manuellen eine Meldung am Fälligkeitstag |
| Sparvorschlag am Gehaltstag | Nach dem Gehaltseingang ein Vorschlag, wie viel aufs Sparbuch kann, ohne den Mindestbestand zu gefährden |
| Dauerposten pausieren | Ruht von bis, ohne gelöscht zu werden; in der Pause entstehen keine Fälligkeiten |
| Jahresvergleich | Dieses Jahr gegen das Vorjahr, je Kategorie |
| Vorlagen für die Schnellerfassung | Häufige Ausgaben mit einem Tipp erfassen |
| Papierkorb | Gelöschtes lässt sich 30 Tage wiederherstellen |
| Push aus der Web-App | Meldungen als iOS-Mitteilung der installierten Web-App, dritter Kanal neben E-Mail und Home Assistant |
| Kreditkarte | Dritte Kontoart; monatliche Abrechnung vom Girokonto, in dessen Planung berücksichtigt |
| Ausgleich zwischen Benutzern | Gemeinsame Ausgaben markieren, Anteil je Ausgabe einstellbar; die App zeigt, wer wem wie viel schuldet |

## Releaseplan

Jede Funktion kommt einzeln als eigene Unterversion 0.x.0, in dieser Reihenfolge; 1.0.0 schließt ab. Fehlerbehebungen dazwischen erhöhen die dritte Stelle (0.x.1).

| Version | Funktion |
| --- | --- |
| 0.1.0 | Fundament: Repo, Prüf- und Release-Pipeline, Docker-Image auf GitHub, Stack, erster Admin, Login, Grundlayout im iOS-Stil mit Dark Mode, Installation als PWA auf dem Homescreen |
| 0.2.0 | Benutzerverwaltung mit Passwort-Zurücksetzen |
| 0.3.0 | Login-Sperre |
| 0.4.0 | Sicherung vor Update |
| 0.5.0 | Protokoll |
| 0.6.0 | Konten (Giro, Sparbuch) mit Zugriffsrechten und Archivieren |
| 0.7.0 | Kategorien mit Unterkategorien |
| 0.8.0 | Dauerposten: Ausgaben und Einnahmen, alle Intervalle, Betragsverlauf |
| 0.9.0 | Umbuchungen zwischen Konten |
| 0.10.0 | Vertragsdaten: Laufzeit, Kündigungsfrist, Verlängerung |
| 0.11.0 | Vertragsdetails |
| 0.12.0 | Geplante Betragsänderung |
| 0.13.0 | Dauerposten pausieren |
| 0.14.0 | Buchungen und Schnellerfassung |
| 0.15.0 | Vorlagen für die Schnellerfassung |
| 0.16.0 | Kontostand und Anpassungsbuchung |
| 0.17.0 | Fälligkeiten mit vorläufigem Buchen und Bankkalender |
| 0.18.0 | Mindestbestand mit Stichtag und Dispo-Hinweis |
| 0.19.0 | Puffer je Konto |
| 0.20.0 | Einmalige geplante Zahlungen |
| 0.21.0 | Sparbuch-Zinsen |
| 0.22.0 | Sparziele |
| 0.23.0 | Rücklagen für Jahreszahlungen |
| 0.24.0 | Darlehen |
| 0.25.0 | CSV-Import mit Dublettenprüfung und Vorschau |
| 0.26.0 | Import: Zuordnung, Dauerposten-Vorschläge, Gehalt markieren, Hinweis auf ausgebliebene Buchungen |
| 0.27.0 | Import rückgängig |
| 0.28.0 | Regel-Editor für Kategorien |
| 0.29.0 | Splitbuchung |
| 0.30.0 | Tags |
| 0.31.0 | Firmenlogos für Buchungen und Dauerposten |
| 0.32.0 | Suche und Filter |
| 0.33.0 | Papierkorb |
| 0.34.0 | Ausgleich zwischen Benutzern |
| 0.35.0 | Dashboard und Gesamtübersicht Haushalt |
| 0.36.0 | Auswertungen: Ausgaben nach Kategorie, Fixkosten je Monat, Einnahmen gegen Ausgaben, Preisverlauf, Jahreskalender |
| 0.37.0 | Jahresvergleich |
| 0.38.0 | 12-Monats-Vorschau |
| 0.39.0 | Kennzahlen |
| 0.40.0 | Budget je Kategorie |
| 0.41.0 | Was-wäre-wenn |
| 0.42.0 | Benachrichtigungen: E-Mail, Home Assistant, Kündigungsfristen, Meldungsregeln |
| 0.43.0 | Weitere Meldungen: Mindestbestand, ausgebliebene Zahlung, Dispo |
| 0.44.0 | Push aus der Web-App, falls iOS es für diese Einrichtung unterstützt |
| 0.45.0 | Erinnerung an manuelle Überweisungen |
| 0.46.0 | Sparvorschlag am Gehaltstag |
| 0.47.0 | Kreditkarte |
| 0.48.0 | Preis- und Abo-Wächter |
| 0.49.0 | Import-Erinnerung |
| 0.50.0 | Monatsbericht per E-Mail |
| 0.51.0 | Kündigungsschreiben als PDF |
| 0.52.0 | Kalender-Abo |
| 0.53.0 | Lesende API und Home-Assistant-Sensoren |
| 0.54.0 | Widget-Musterseite mit Kopier-Knopf |
| 0.55.0 | Widget-Editor |
| 0.56.0 | Sperrbildschirm-Widgets, falls Scriptable sie unterstützt |
| 0.57.0 | Schnellerfassung per iOS-Kurzbefehl |
| 0.58.0 | Systemstatus |
| 0.59.0 | Anleitung für Einrichtung und Bedienung |
| 0.60.0 | Demo-Modus |
| 1.0.0 | Abschluss: Tests der gesamten Bedienung am Handy, Freigabe |

Abnahme je Version: Die Funktion läuft im Docker und ist am Handy bedienbar; Rechenlogik ist durch Tests abgedeckt.

## Offene Punkte

Alle Fragen sind geklärt. Push aus der Web-App (0.44.0) und Sperrbildschirm-Widgets über Scriptable (0.56.0, ab iOS 16: rechteckig, rund, Zeile) werden unterstützt.
