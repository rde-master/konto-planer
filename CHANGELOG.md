# Changelog

Alle nennenswerten Änderungen an Konto Planer. Versionen folgen [SemVer](https://semver.org/lang/de/); jede Funktion erscheint als eigene Unterversion 0.x.0.

## [0.56.0] – Sperrbildschirm-Widgets

### Neu

- Widgets für den Sperrbildschirm (ab iOS 16, über Scriptable): rechteckig (bis drei Zeilen), rund (Ring mit verfügbarem Anteil und Betrag in der Mitte, z. B. „1,2T“) und als Zeile über der Uhr („612,00 € frei bis 30.11.“)
- Als zusätzliche Größen „Sperrbildschirm“, „Rund“ und „Zeile“ auf der Musterseite und im Editor, mit passender Vorschau; der Inhalt kommt aus den gewählten Bausteinen
- Auf dem iPhone: Sperrbildschirm gedrückt halten › Anpassen › Widgets hinzufügen › Scriptable, dann das Skript wählen

### Hinweis

- Für Sperrbildschirm-Widgets das Skript neu kopieren (bestehende Skripte kennen die neuen Formen noch nicht)

## [0.55.0] – Widget-Editor

### Neu

- Widget-Editor mit Live-Vorschau: aus einer Vorlage oder leer starten, bestehende Widgets unter „Meine Widgets“ öffnen und ändern
- Bausteine frei zusammenstellen und mit Pfeilen sortieren: Überschrift (eigener Text oder automatisch), Verfügbar bis Stichtag, Fortschrittsbalken, Mindestbestand, Kontostand, nächste Zahlung, offene Zahlungen (Anzahl wählbar), Konten, Abstand; was nicht in die Größe passt, fällt unten weg
- Gestaltung: Erscheinungsbild (wie iPhone, immer hell, immer dunkel), Akzentfarbe (Kontofarbe oder iOS-Farbe), Hintergrund (Standard, Verlauf, Schwarz/Weiß) und Schriftgröße
- Änderungen kommen ohne neues Kopieren beim nächsten Aktualisieren aufs iPhone
- „Neues Skript“ erzeugt einen neuen Zugang, falls das Skript verloren ging

### Hinweis

- Widgets aus 0.54 zeigen geänderte Bausteine sofort; damit auch Farben und Schriftgröße ankommen, einmal „Neues Skript“ tippen und das Skript in Scriptable ersetzen

## [0.54.0] – Widget-Musterseite

### Neu

- Neue Seite „Widgets“ (unter Mehr) mit drei Vorlagen für iOS-Widgets über die App Scriptable: „Verfügbar bis Gehalt“, „Offene Zahlungen“ und „Alle Konten“
- Jede Vorlage mit Live-Vorschau in Klein, Mittel oder Groß und wählbaren Konten
- „Widget anlegen“ erzeugt ein Widget mit eigenem, nur lesendem Token und ein fertiges Skript zum Kopieren; dazu eine Anleitung in drei Schritten
- Das Skript lädt Layout und Werte vom Server, folgt Hell/Dunkel des iPhones und zeigt ohne Verbindung die zuletzt geladenen Werte mit „offline · Stand HH:MM“
- „Meine Widgets“ zeigt alle Widgets mit letztem Abruf; jedes lässt sich einzeln widerrufen

## [0.53.0] – Lesende API und Home-Assistant-Sensoren

### Neu

- Einstellungen › API-Zugänge: jeder legt eigene Tokens an (Name, Zweck, alle oder ausgewählte Konten), sieht, wann sie zuletzt benutzt wurden, und kann sie widerrufen; das Token wird nur einmal angezeigt und nur als Hash gespeichert
- Lesende API `/api/v1/status`: Kontostände mit „Stand vom“, verfügbar und Mindestbestand je Girokonto, nächste Zahlung je Konto und gesamt, Budgets des Monats und Warnungen (Minus, Dispo, Mindestbestand, ausgebliebene Zahlungen, Kreditrahmen); `/api/v1/accounts/<id>` für ein Konto
- Für Home Assistant: fertiger REST-Sensor zum Kopieren beim Anlegen eines Zugangs
- Zusätzlich kann die App die Werte stündlich als Sensoren an Home Assistant senden (sensor.konto_planer_verfuegbar, _naechste_zahlung, _warnungen und je Konto Stand/verfügbar) – Schalter für den Admin unter Benachrichtigungen

## [0.52.0] – Kalender-Abo

### Neu

- Einstellungen › Kalender-Abo: ein geheimer Abo-Link je Benutzer für Apple Kalender, Google Kalender & Co. („Im Kalender abonnieren“ oder Link kopieren)
- Inhalt wählbar: Fälligkeiten der Dauerposten (mit Betrag), Kündigungsfristen (mit Erinnerung zum Vorlauf), Kreditkarten-Abbuchungen und Sparziel-Termine
- Zeitraum drei Monate zurück bis zwölf Monate voraus, nur Konten, die du siehst; der Kalender aktualisiert sich etwa alle sechs Stunden
- „Neuen Link erzeugen“ macht den alten ungültig, „Abo beenden“ schaltet ihn ab; der Link wird nur als Hash gespeichert

## [0.51.0] – Kündigungsschreiben als PDF

### Neu

- Am Dauerposten mit Vertrag: „Kündigungsschreiben erstellen“ – ein fertiger Brief als PDF (DIN 5008, passend für Fensterumschläge)
- Absender aus deiner gespeicherten Anschrift (beim ersten Mal eingeben und merken), Empfänger aus der Kündigungsadresse des Vertrags; beides vor dem Erstellen änderbar
- Inhalt: ordentliche Kündigung zum nächstmöglichen Zeitpunkt mit dem berechneten Vertragsende, Kundennummer; wählbar: Bitte um schriftliche Bestätigung, Widerruf des Lastschrift-Mandats (mit Mandatsreferenz), Widerspruch gegen Rückgewinnung und Bitte um Datenlöschung
- Das PDF wird als Anhang am Dauerposten gespeichert; danach lässt sich „Gekündigt am heute“ mit einem Tipp eintragen (das Ende des Dauerpostens folgt wie gewohnt)

## [0.50.0] – Monatsbericht per E-Mail

### Neu

- Monatsbericht per E-Mail, von jedem selbst unter „Meine Benachrichtigungen“ einschaltbar; er kommt am 1. eines Monats ab 8 Uhr für den Vormonat (bei Ausfall des Servers bis zum 7. nachgeholt)
- Inhalt für die Konten, die du siehst: Einnahmen, Ausgaben und Saldo, Ausgaben je Kategorie mit Vergleich zum Vormonat, größte Posten, Budgets, Kontostand am Monatsende und heute verfügbar, Gespartes mit Sparquote, Preiserhöhungen und anstehende Kündigungsfristen
- Übersichtliche HTML-Mail im App-Stil (ohne externe Bilder) mit zusätzlichem Textteil
- „Bericht für den Vormonat jetzt senden“ zum Ausprobieren; verschickte Berichte stehen in der Liste „Zuletzt verschickt“

## [0.49.0] – Import-Erinnerung

### Neu

- Meldung „Import-Erinnerung“: monatlich am 30. (im Februar am Monatsletzten) für Girokonten und Kreditkarten, die schon importiert wurden und deren letzter Import älter als 14 Tage ist; die Meldung führt direkt zum Import
- „Stand vom“ an jedem Kontostand (Übersicht, Kontoliste, Kontoseite): Tag der jüngsten importierten Buchung, ohne Import der letzten Kontostand-Korrektur; ab 30 Tagen rot markiert

## [0.48.0] – Preis- und Abo-Wächter

### Neu

- Meldung „Dauerposten wird teurer“: wenn eine Ausgabe einen höheren Betrag bekommt (auch angekündigt für später) oder der Import eine höhere Abbuchung findet – mit altem und neuem Betrag, Plus in Prozent und Mehrkosten im Jahr
- Meldung „Neue regelmäßige Abbuchung im Import“: ab der zweiten Zahlung an denselben Empfänger, wenn es keinen Dauerposten gibt und du den Vorschlag beim Import nicht übernommen hast
- Die Übersicht zeigt „Teurer geworden“ und „Neues Abo?“; ein Tipp legt den Dauerposten an (ab der nächsten erwarteten Abbuchung) oder blendet den Empfänger dauerhaft aus
- „Import rückgängig“ entfernt auch die dabei entstandenen Abo-Hinweise

## [0.47.0] – Kreditkarte

### Neu

- Neue Kontoart „Kreditkarte“ neben Girokonto und Sparbuch, mit Abrechnungskonto (Girokonto), Abrechnungstag, Abbuchungstag und Kreditrahmen
- Am Abrechnungstag wird der Kartensaldo festgestellt und am Abbuchungstag (nächster Bankarbeitstag) automatisch vom Girokonto auf die Karte gebucht
- Die nächste Abbuchung – Kartensaldo plus geplante Kartenzahlungen bis zum Abrechnungstag – zählt in Mindestbestand, „Verfügbar“ und 12-Monats-Vorschau des Girokontos
- Auf der Karte: Buchungen und Schnellerfassung, Dauerposten (z. B. Abos), CSV-Import im Volksbank-Format (IBAN-Prüfung nur, wenn an der Karte eine IBAN eingetragen ist)
- Die Kontoseite der Karte zeigt die nächsten Abrechnungen mit Betrag und Abbuchungstag sowie den freien Kreditrahmen
- Neue Meldung „Kreditrahmen der Kreditkarte reicht nicht“, wenn der Rahmen jetzt oder nach Plan in den nächsten zwei Monaten überschritten wird
- Nachträglich erfasste Kartenumsätze korrigieren eine schon gebuchte Abrechnung; ein Import der echten Abbuchung ersetzt sie
- Auswertungen zählen Kreditkarten zu „Alle Girokonten und Kreditkarten“; Abrechnungen gelten als interne Umbuchung

## [0.46.0] – Sparvorschlag am Gehaltstag

### Neu

- Sobald das Gehalt gebucht ist (vorläufig oder per Import), schlägt die Übersicht vor, wie viel aufs Sparbuch kann: der frei verfügbare Betrag, abgerundet auf volle 10 €; der Mindestbestand bis zum nächsten Gehalt bleibt gedeckt
- „Umbuchen“ bucht den Betrag (änderbar) heute vom Girokonto aufs gewählte Sparbuch und teilt ihn auf Wunsch einem Sparziel zu; „Nicht jetzt“ blendet den Vorschlag bis zum nächsten Gehalt aus
- Neue Meldung „Sparvorschlag am Gehaltstag“ per E-Mail, Home Assistant oder Push
- Gilt für Girokonten mit Stichtag „Gehalt“

## [0.45.0] – Erinnerung an manuelle Überweisungen

### Neu

- Meldung „Manuelle Überweisung fällig“ für Dauerposten mit Zahlart „manuell“ (Ausgaben und Umbuchungen), per E-Mail, Home Assistant oder Push
- Vorlauf in der Meldungsregel einstellbar: Standard 1 Bankarbeitstag vor der Fälligkeit, 0 = am Fälligkeitstag
- Die Übersicht zeigt „Zu überweisen“ mit Betrag, Empfänger und IBAN; „Überwiesen“ hakt die Zahlung ab
- Erledigt ist eine Überweisung mit „Überwiesen“, durch einen Import mit der Zahlung oder wenn die Fälligkeit zurückgenommen wird; bis dahin wiederholt „Täglich bis erledigt“ die Meldung

## [0.44.0] – Push aus der Web-App

### Neu

- Meldungen kommen auf Wunsch als Mitteilung der installierten Web-App, als dritter Kanal neben E-Mail und Home Assistant
- Einstellungen › Meine Benachrichtigungen: „Push auf diesem Gerät einschalten“, Liste der eigenen Geräte zum Entfernen und ein Push-Test
- Jede Meldungsregel hat den Schalter „Push aus der Web-App“
- Antippen der Mitteilung öffnet die passende Seite: Dauerposten, Buchung oder Konto
- Geräte, die der Push-Dienst nicht mehr kennt, werden automatisch entfernt

### Hinweis

- Auf dem iPhone und iPad funktioniert Push nur in der App vom Home-Bildschirm (ab iOS 16.4) und über HTTPS; der Server braucht Zugang zum Internet (Push-Dienst von Apple)

## [0.43.0] – Weitere Meldungen

### Neu

- Meldung „Mindestbestand unterschritten“: wenn auf einem Girokonto weniger liegt als bis zum Stichtag gebraucht wird
- Meldung „Zahlung ausgeblieben“: wenn eine erwartete Zahlung nach einer einstellbaren Toleranz (Standard 3 Tage) nicht im Import auftaucht – nur bei Konten, die importiert werden
- Meldung „Dispo erreicht“: sobald ein Girokonto im Minus steht
- Meldung „Dispo droht“: wenn das Geld samt Dispo bis zum Stichtag nach Plan nicht reicht
- Jede Meldung hat eine eigene Regel mit Kanälen, Empfängern und Wiederholung
- Die Übersicht zeigt ausgebliebene Zahlungen in einem eigenen Abschnitt

## [0.42.0] – Benachrichtigungen

### Neu

- Einstellungen › Benachrichtigungen (Admin): SMTP-Zugang für E-Mails (Server, Port, SSL/TLS, Benutzer, Passwort, Absender) und Home Assistant (Adresse, Zugriffstoken), jeweils mit Test-Knopf; Passwort und Token werden verschlüsselt gespeichert und nie wieder angezeigt
- Meldung „Kündigungsfrist endet bald“: sobald die Kündigungsfrist abzüglich Vorlauf erreicht ist, per E-Mail und/oder Home Assistant
- Meldungsregel je Meldung: aktiv, Kanäle, Empfänger (alle mit „bearbeiten“ am Konto oder ausgewählte Benutzer) und Wiederholung (einmal oder täglich bis erledigt)
- Versand einmal täglich ab 8 Uhr; „Jetzt prüfen und senden“ für den Admin; eine Liste zeigt die zuletzt verschickten Meldungen samt Fehlern
- Einstellungen › Meine Benachrichtigungen: jeder wählt seine Home-Assistant-Geräte (z. B. die Home-Assistant-App auf dem Handy) und kann eine Testnachricht senden

### Hinweis

- Der Schlüssel für die gespeicherten Zugangsdaten kommt aus `APP_SECRET` oder wird beim ersten Speichern als `secret.key` im Datenvolume angelegt

## [0.41.0] – Was wäre wenn

### Neu

- Neue Seite „Was wäre wenn“ (unter „Mehr“ und in der Seitenleiste): benannte Szenarien je Girokonto, gespeichert und nur für dich sichtbar
- Probeweise Änderungen sammeln: neuen Posten (Ausgabe oder Einnahme, monatlich bis jährlich oder einmalig) hinzufügen, einen Dauerposten ab einem Datum kündigen oder seinen Betrag ab einem Datum ändern
- Die Wirkung steht direkt daneben, heute gegen mit Szenario: verfügbarer Betrag, Mindestbestand, Fixkosten im Monat, tiefster Stand in den nächsten 12 Monaten und Stand in 12 Monaten
- An den echten Daten ändert sich nichts; Szenarien lassen sich umbenennen und löschen

## [0.40.0] – Budget je Kategorie

### Neu

- Neue Seite „Budgets“ (unter „Mehr“ und in der Seitenleiste): eine Monatsgrenze je Kategorie, für ein Konto oder für alle Konten (dann nur für dich)
- Fortschritt je Budget mit Balken, Rest bzw. Überschreitung und einem Strich, wie weit der Monat ist; Monat wählbar, jeden Monat beginnt das Budget neu
- Es zählen echte und vorläufige Ausgaben; eine Hauptkategorie umfasst ihre Unterkategorien, aufgeteilte Buchungen zählen nach ihren Teilen, Umbuchungen zwischen eigenen Konten nicht
- Nach dem Buchen zeigt die Meldung, was im Budget noch übrig ist („Lebensmittel: noch 15,00 € diesen Monat“) oder um wie viel es überschritten ist
- Die Übersicht zeigt Budgets ab 80 % Verbrauch
- Konto-Budgets ändern alle mit Recht „bearbeiten“ am Konto; alles steht im Protokoll

## [0.39.0] – Kennzahlen

### Neu

- Neue Ansicht „Kennzahlen“ in den Auswertungen, über alle Konten, die du siehst
- Fixkostenquote: regelmäßige Ausgaben geteilt durch regelmäßige Einnahmen der Dauerposten (je Monat)
- Sparquote: was in den letzten 12 Monaten netto auf Sparbücher umgebucht wurde, geteilt durch die Einnahmen der Girokonten; dazu der Verlauf je Monat
- Preissteigerung je Vertrag in Prozent pro Jahr, mit Durchschnitt und den stärksten Steigerungen
- Die Übersicht zeigt Fixkosten- und Sparquote in einer Zeile mit Link zu den Kennzahlen

## [0.38.0] – 12-Monats-Vorschau

### Neu

- Jede Kontoseite zeigt die Vorschau des Kontostands für die nächsten 12 Monate als Kurve
- Der tiefste Punkt ist markiert und mit Betrag und Datum angegeben, dazu der Stand in 12 Monaten; bei Girokonten mit Dispo steht die Dispo-Grenze als gestrichelte Linie in der Kurve
- Berücksichtigt werden alle offenen Fälligkeiten (auch Umbuchungen und Sparziel-Umbuchungen), geplante Zahlungen und Buchungen mit Datum in der Zukunft; schwankende Beträge mit dem letzten Wert
- Reicht das Geld nach Plan im Laufe des Jahres nicht, weist die App darauf hin

## [0.37.0] – Jahresvergleich

### Neu

- Neue Ansicht „Vergleich“ in den Auswertungen: dieses Jahr gegen das Vorjahr, je Kategorie mit Differenz in Euro und Prozent (mehr ausgegeben rot, weniger grün)
- Im laufenden Jahr wird fair verglichen: 1. Januar bis heute gegen den gleichen Zeitraum im Vorjahr; frühere Jahre jeweils als ganzes Jahr
- Dazu Ausgaben und Einnahmen beider Zeiträume im Überblick; Kontoauswahl wie bei den anderen Auswertungen

## [0.36.0] – Auswertungen

### Neu

- Seite „Auswertungen“ mit fünf Ansichten und Kontoauswahl (Standard: alle Girokonten)
- Kategorien: Ausgaben je Haupt- und Unterkategorie für einen Monat oder ein Jahr, mit Anteil in Prozent; aufgeteilte Buchungen zählen nach ihren Teilen
- Ein/Aus: Einnahmen gegen Ausgaben der letzten 12 Monate als Balkengrafik, mit Summen und dem Anteil, der übrig bleibt
- Fixkosten: regelmäßige Ausgaben auf den Monat umgerechnet (Jahresbeiträge ÷ 12), für die letzten 12 und die nächsten 11 Monate, dazu die Aufteilung nach Kategorie
- Preise: Dauerposten mit Preisänderungen, gesamt und pro Jahr
- Kalender: fällige Zahlungen je Monat des Jahres mit den größten Posten; je Monat eine Tages-Heatmap (bisherige Ausgaben und geplante Zahlungen) mit den Einzelposten des gewählten Tags
- Umbuchungen zwischen eigenen Konten zählen nicht als Einnahme oder Ausgabe

## [0.35.0] – Dashboard und Gesamtübersicht Haushalt

### Neu

- Die Startseite „Übersicht“ ist jetzt ein Dashboard
- Oben die Gesamtübersicht Haushalt: Summe aller sichtbaren Konten, verfügbar auf allen Girokonten zusammen, Summe der Sparbücher und der Stand der Sparziele
- „Verfügbar“ je Girokonto mit Stand, Mindestbestand und Stichtag; eine Warnung, wenn das Konto ins Minus rutscht oder der Dispo überschritten werden könnte
- „Nächste 7 Tage“: anstehende Zahlungen aller Konten mit Firmenlogo, Link zu allen offenen Zahlungen
- „Bald kündbar“: Verträge, deren Kündigungsfrist bald endet, mit Frist und Ende

## [0.34.0] – Ausgleich zwischen Benutzern

### Neu

- Ausgaben lassen sich als gemeinsam markieren: wer bezahlt hat und wer beteiligt ist, zu gleichen Teilen oder mit Anteilen in Prozent (zusammen 100 %); jeder Anteil wird auf den Cent genau berechnet
- Neue Seite „Ausgleich“ (unter „Mehr“ und in der Seitenleiste): wie viel du bekommst oder schuldest, wer wem wie viel zahlen sollte (mit möglichst wenigen Zahlungen) und alle gemeinsamen Ausgaben mit deinem Anteil
- Beteiligte sehen nur die gemeinsame Ausgabe selbst, nicht das Konto oder dessen andere Buchungen
- „Ausgleich erfassen“ hält fest, dass Geld geflossen ist (Vorschlag: der offene Betrag); gebucht wird dabei nichts
- Markieren und Ändern darf, wer das Konto bearbeiten darf; Ausgleiche löscht, wer sie erfasst hat, oder der Admin
- Alles steht im Protokoll; eine gelöschte Buchung kommt aus dem Papierkorb mit ihren Anteilen zurück

## [0.33.0] – Papierkorb

### Neu

- Gelöschte Buchungen, Dauerposten, Kategorien, Sparziele, Vorlagen, Tags und Kategorie-Regeln landen im Papierkorb (unter „Mehr“ und in der Seitenleiste) und lassen sich 30 Tage lang wiederherstellen
- Wiederhergestellt wird vollständig: Dauerposten mit Betragsverlauf, Vertrag, PDF-Anhängen, Tags und Darlehensdaten (Fälligkeiten werden neu berechnet), Buchungen mit Aufteilung und Tags, Kategorien mit Unterkategorien und ihren Zuordnungen an Buchungen, Dauerposten, Regeln und Vorlagen
- Jeder sieht, was er selbst gelöscht hat; der Admin sieht alles, kann einzelne Einträge endgültig löschen und den Papierkorb leeren
- Nach 30 Tagen werden Einträge automatisch endgültig entfernt
- Wiederherstellen und endgültiges Löschen stehen im Protokoll

## [0.32.0] – Suche und Filter

### Neu

- Suchfeld auf der Seite „Buchungen“: findet Text in Empfänger, Verwendungszweck, IBAN und Buchungstext der Bank (Groß- und Kleinschreibung egal, auch Wortteile)
- „Filter“: Ausgaben oder Einnahmen, Zeitraum von – bis, Betrag von – bis (ohne Vorzeichen), Kategorie (eine Hauptkategorie umfasst ihre Unterkategorien und Teile aufgeteilter Buchungen) und Tag (auch über den Dauerposten)
- Aktive Filter erscheinen als Chips und lassen sich einzeln entfernen; dazu Anzahl und Summe der Treffer
- Die Filter stehen in der Adresse: Neu laden, Zurück und Lesezeichen behalten sie

## [0.31.0] – Firmenlogos

### Neu

- Buchungen und Dauerposten zeigen vorne das farbige Logo des Empfängers, z. B. PayPal, Netflix, Spotify, Telekom, Vodafone, DHL, Lidl, Rewe oder dm (aus der freien Sammlung Simple Icons, liegt in der App, nichts geht ins Internet)
- Das Logo wird automatisch am Empfängernamen erkannt; Rechtsformen wie „GmbH“ oder „S.A.R.L.“ stören dabei nicht
- Ohne passendes Logo erscheinen farbige Initialen statt des bisherigen Pfeils, damit sich Empfänger leichter unterscheiden lassen
- „Logo ändern“ an Buchung oder Dauerposten: Logo suchen und wählen, „Kein Logo (Initialen)“ oder zurück zu „Automatisch erkennen“; die Wahl gilt für alle Buchungen und Dauerposten dieses Empfängers, auch künftige
- Die Wahl steht im Protokoll

### Geändert

- Releaseplan: Firmenlogos sind als 0.31.0 eingeschoben, die folgenden Versionen rücken um eins nach hinten

## [0.30.0] – Tags

### Neu

- Tags ergänzen die Kategorie, z. B. „Urlaub Italien“: neue Seite „Tags“ (unter „Mehr“ und in der Seitenleiste)
- An Buchungen und Dauerposten lassen sich Tags vergeben, auch direkt einen neuen Tag anlegen; Buchungen tragen automatisch die Tags ihres Dauerpostens (grau angezeigt)
- Jahresliste je Tag: Jahr wählen, Summe der Ausgaben und Einnahmen, Aufteilung nach Kategorie (aufgeteilte Buchungen nach ihren Teilen) und alle Buchungen nach Monat; dazu die Dauerposten mit diesem Tag
- Tags gelten für alle Benutzer; anlegen, umbenennen und vergeben darf jeder (Buchungen und Dauerposten mit Recht „bearbeiten“), löschen nur der Admin
- Tags und ihre Zuordnungen stehen im Protokoll

## [0.29.0] – Splitbuchung

### Neu

- Manuelle und importierte Buchungen lassen sich auf mehrere Kategorien aufteilen („Aufteilen“ an der Buchung), z. B. ein Einkauf mit Lebensmitteln und Drogerie
- Bis zu zehn Teile mit Betrag und Kategorie; was nicht verteilt ist, bleibt als Rest bei der Kategorie der Buchung und wird beim Eingeben laufend angezeigt
- Die Buchungsliste zeigt aufgeteilte Buchungen mit der Zahl der Kategorien
- Ändert sich der Betrag einer manuellen Buchung, prüft die App, ob die Aufteilung noch passt
- Ersetzt ein Import eine aufgeteilte manuelle Buchung, übernimmt die importierte Buchung die Aufteilung; „Import rückgängig“ stellt sie wieder her
- Aufteilungen stehen im Protokoll

## [0.28.0] – Regel-Editor für Kategorien

### Neu

- Unter „Kategorien › Regeln für den Import“ legst du Regeln an wie „Verwendungszweck enthält Miete → Wohnen“: Feld (Empfänger/Zahler, Verwendungszweck, IBAN), Bedingung (enthält, ist gleich, beginnt mit), Text und Kategorie; Groß- und Kleinschreibung zählen nicht
- Die Regeln gelten für alle Benutzer und lassen sich sortieren; die erste passende gilt
- Beim Import bestimmt zuerst ein zugeordneter Dauerposten die Kategorie, dann die Regeln, dann die zuletzt für den Empfänger gewählte Kategorie, zuletzt die Kategorie der Bank
- „Auf bisherige Buchungen anwenden“ gibt importierten Buchungen ohne Kategorie die Kategorie der passenden Regel; die Seite zeigt vorher, wie viele es sind
- Anlegen, ändern und sortieren darf jeder, löschen nur der Admin; alles steht im Protokoll

### Verbessert

- Am Desktop zeigt die Seitenleiste jetzt alle Bereiche, auch die, die am Handy unter „Mehr“ liegen (Offene und geplante Zahlungen, Sparziele, Rücklagen, Kategorien)
- Die aktuelle Version steht unten in der Seitenleiste und am Handy auf der Seite „Mehr“

## [0.27.0] – Import rückgängig

### Neu

- Der letzte Import eines Kontos lässt sich mit einem Klick zurücknehmen („Letzten Import rückgängig machen“ auf der Import-Seite); danach der davor
- Vollständig: importierte Buchungen und Gegenbuchungen verschwinden, ersetzte vorläufige und manuelle Buchungen sowie aufgelöste Anpassungen kommen zurück, Fälligkeiten sind wieder vorläufig, übernommene Beträge und beim Import angelegte Dauerposten werden entfernt
- „Letzte Importe“ zeigt zurückgenommene Importe; das Zurücknehmen steht im Protokoll

### Hinweis

- Importe vor dieser Version lassen sich nicht zurücknehmen, weil ihnen die nötigen Angaben fehlen

## [0.26.0] – Import: Zuordnung und Vorschläge

### Neu

- Der Import ordnet Buchungen ihren Dauerposten zu: zuerst über Mandatsreferenz und Gläubiger-ID, dann über IBAN und Name, zuletzt über Betrag und Datum (±3 Tage); die passende Fälligkeit gilt danach als gebucht, die vorläufige Buchung wird ersetzt
- Weicht der Betrag vom Plan ab, bietet die Vorschau an, den neuen Betrag ab dieser Fälligkeit in den Betragsverlauf zu übernehmen
- Umbuchungen an ein Konto der App werden erkannt: eine vorhandene Gegenbuchung wird verknüpft, sonst bucht die App den Betrag auf dem anderen Konto gegen (z. B. aufs Sparbuch); ein späterer Import des anderen Kontos ersetzt diese Gegenbuchung
- Wiederkehrende Zahlungen ohne Dauerposten (mindestens zwei, auch aus früheren Importen) schlägt die Vorschau mit erkanntem Intervall als neue Dauerposten vor; per Haken werden sie angelegt, Einnahmen lassen sich dabei als Gehalt markieren
- Vorläufige Buchungen im Zeitraum der Datei ohne echte Buchung stehen als Hinweis in Vorschau und Ergebnis, mit Link zur Buchung
- Kategorie importierter Buchungen: vom Dauerposten, sonst die zuletzt für diesen Empfänger gewählte, sonst eine eigene Kategorie mit dem Namen der Bank-Kategorie
- Die Kategorie importierter Buchungen lässt sich an der Buchung ändern; die App merkt sich die Wahl je Empfänger. IBAN, Buchungstext und Bank-Kategorie werden angezeigt

## [0.25.0] – CSV-Import

### Neu

- Girokonten lassen sich mit dem CSV-Export der Volksbank (Semikolon, 19 Spalten) füllen: auf der Kontoseite „CSV importieren“
- Zeichensatz (UTF-8 oder Windows-1252), Datums- und Zahlenformat erkennt die App selbst und zeigt sie in der Vorschau
- Die IBAN in der Datei muss zum Konto passen, sonst bricht der Import ab
- Dublettenprüfung über Buchungstag, Betrag, IBAN, Verwendungszweck und Saldo: schon importierte und doppelte Zeilen werden übersprungen, ein erneuter Import bringt nur Fehlendes
- Vorschau mit Status je Zeile (neu, ersetzt eine Buchung, schon vorhanden); einzelne Zeilen lassen sich abwählen
- Eine importierte Buchung ersetzt eine vorläufige oder manuelle Buchung mit gleichem Betrag bis drei Tage Abstand; die Fälligkeit gilt dann als gebucht, die Kategorie bleibt
- Anpassungen im Zeitraum der Datei werden aufgelöst; danach vergleicht die App den Stand mit dem Saldo der Bank und bucht eine verbleibende Differenz auf Knopfdruck als Anpassung
- Jeder Import steht mit Datei und Anzahlen im Protokoll und unter „Letzte Importe“

## [0.24.0] – Darlehen

### Neu

- An einer Ausgabe lassen sich Darlehensdaten erfassen: Darlehenssumme, Zinssatz, Beginn und optional Laufzeitende bzw. Ende der Zinsbindung
- Jede Fälligkeit des Dauerpostens gilt als Rate: erst die Zinsen (30/360 auf die Restschuld), der Rest tilgt
- Die Seite zeigt Restschuld heute, getilgten Anteil, berechnetes Ende mit letzter Rate, Restschuld zum Laufzeitende, Zinsen bisher und gesamt, die nächsten Raten mit Zins- und Tilgungsanteil und den Tilgungsverlauf als Kurve
- Sondertilgungen mit Datum und Betrag senken die Restschuld und verkürzen die Laufzeit
- „Ende übernehmen“ setzt das Ende des Dauerpostens auf die letzte Rate
- Deckt die Rate die Zinsen nicht, warnt die App
- Änderungen an Darlehen und Sondertilgungen stehen im Protokoll

## [0.23.0] – Rücklagen für Jahreszahlungen

### Neu

- Neue Seite „Rücklagen“ (unter „Mehr“): alle Ausgaben, die vierteljährlich, halbjährlich, jährlich oder noch seltener fällig sind, mit Monatsrate und der Summe, die du jeden Monat zurücklegen solltest
- Die Seite eines solchen Dauerpostens zeigt seine Rücklage im Monat
- „Als Sparziel anlegen“ macht aus einer Jahreszahlung ein Sparziel auf einem Sparbuch; als schon zurückgelegt schlägt die App vor, was bei gleichmäßigem Sparen seit der letzten Zahlung da sein sollte
- Auf Wunsch legt sie dazu eine monatliche Umbuchung (Dauerauftrag) vom Girokonto aufs Sparbuch über die Monatsrate an
- Die Sparbuch-Seite zeigt die Summe der Rücklagen im Monat für die verknüpften Sparziele

## [0.22.0] – Sparziele

### Neu

- Neue Seite „Sparziele“ (unter „Mehr“ und auf jeder Sparbuch-Seite): mehrere Ziele je Sparbuch mit Name, Zielbetrag und optionalem Zieldatum
- Mit „Zurücklegen“ reservierst du einen Teil des Sparbuch-Stands für ein Ziel; die Sparbuch-Seite zeigt, was noch frei ist
- Jedes Ziel zeigt Fortschritt, was noch fehlt, und die nötige Sparrate im Monat bis zum Zieldatum
- Ein Ziel lässt sich mit einer Ausgabe verknüpfen, einmalig (z. B. Urlaub) oder regelmäßig (z. B. Jahresversicherung); Datum und Betrag kommen dann von der Zahlung
- Am Tag der Zahlung bucht die App das Zurückgelegte (höchstens den Zielbetrag) vorläufig vom Sparbuch auf das Girokonto der Zahlung; im Mindestbestand zählt diese Umbuchung schon vorher, die Zahlung belastet ihn also nur mit dem Rest
- Bei regelmäßigen Zahlungen spart das Ziel danach für die nächste Fälligkeit weiter
- Eine Sparziel-Umbuchung lässt sich an der Buchung zurücknehmen; der Betrag gilt dann wieder als zurückgelegt
- Anlegen, Ändern, Zurücklegen, Löschen und die Umbuchungen stehen im Protokoll

## [0.21.0] – Sparbuch-Zinsen

### Neu

- Sparbücher haben einen Zinssatz mit Verlauf: neuer Satz ab einem Datum, auch für künftige Zinsänderungen
- Die App rechnet die Zinsen tagegenau (act/365, im Schaltjahr 366) auf den Stand am Ende jedes Tages, ohne Steuern
- Rhythmus der Gutschrift wählbar: monatlich, vierteljährlich oder jährlich (Standard); gutgeschriebene Zinsen werden mitverzinst
- Am Ende jeder Periode bucht die App die Zinsen vorläufig; weicht die Bank ab, lässt sich ihr Betrag übernehmen und später wieder auf den berechneten zurückstellen
- Die Kontoseite eines Sparbuchs zeigt Zinssatz, Zinsen bisher in dieser Periode, die erwartete Gutschrift (mit geplanten Umbuchungen) und den Verlauf des Kontostands als Kurve
- Zinsänderungen, der Rhythmus und automatische Gutschriften stehen im Protokoll

## [0.20.0] – Einmalige geplante Zahlungen

### Neu

- Neue Seite „Geplante Zahlungen“ (unter „Mehr“ und am Ende der Dauerposten): einmalige Ausgaben wie Urlaub oder eine Anschaffung und erwartete Einnahmen wie eine Steuererstattung mit Datum erfassen
- Einfaches Formular mit Art, Bezeichnung, Betrag, Datum, Konto, Kategorie und Notiz; das Datum darf nicht in der Vergangenheit liegen
- Liegt eine geplante Zahlung vor dem Stichtag, zählt sie im Mindestbestand mit; am Tag selbst (nächster Bankarbeitstag) wird sie vorläufig gebucht
- Geplante Zahlungen nach dem Stichtag stehen auf der Kontoseite unter „Danach geplant“, zählen aber noch nicht
- Einmalige Posten erscheinen nicht mehr in der Dauerposten-Liste, sondern nur noch unter „Geplante Zahlungen“; Details und Änderungen wie gewohnt auf ihrer eigenen Seite

## [0.19.0] – Puffer je Konto

### Neu

- Girokonten haben einen optionalen Puffer: ein Sicherheitsbetrag, der immer zum Mindestbestand dazukommt
- Den Puffer stellt ein, wer das Konto bearbeiten darf, neben dem Dispo-Rahmen
- Die Kontoseite zeigt beim Mindestbestand, wie viel davon Puffer ist; der verfügbare Betrag sinkt entsprechend
- Änderungen am Puffer stehen im Protokoll

## [0.18.0] – Mindestbestand mit Stichtag und Dispo-Hinweis

### Neu

- Jedes Girokonto zeigt, wie viel bis zum Stichtag verfügbar ist, und den Mindestbestand: so viel muss heute auf dem Konto sein, damit es bis dahin an keinem Tag ins Minus geht
- Stichtag ist standardmäßig der nächste Gehaltseingang; umschaltbar auf Monatsende, ein festes Datum oder einen bestimmten Eingang (auch eine Umbuchung auf das Konto)
- Gerechnet wird bis einschließlich Stichtag; an jedem Tag zählen erst die Ausgänge, dann die Eingänge
- Die Kontoseite listet alle Zahlungen bis zum Stichtag mit dem Stand danach und markiert den tiefsten Stand
- Dispo-Hinweise: wenn das Konto im Minus ist, wenn es bis zum Stichtag ins Minus rutscht, und eine große Warnung, wenn der Dispo nicht reicht
- Der Dispo zählt nie zum verfügbaren Betrag
- Die Kontenliste zeigt bei Girokonten den verfügbaren Betrag
- Änderungen am Stichtag stehen im Protokoll

## [0.17.0] – Fälligkeiten mit vorläufigem Buchen und Bankkalender

### Neu

- Am Fälligkeitstag bucht die App jeden Dauerposten automatisch vorläufig, damit der Kontostand stimmt – Ausgaben, Einnahmen wie das Gehalt und Umbuchungen (auf beiden Konten)
- Fälligkeiten am Wochenende oder an einem Bankfeiertag (TARGET-Kalender) rutschen auf den nächsten Bankarbeitstag
- Nach dem Update werden alle Fälligkeiten seit dem Startsaldo-Datum des Kontos nachgebucht
- Vorläufige Buchungen stehen in „Buchungen“ mit dem Hinweis „vorläufig“ und lassen sich verschieben, im Betrag anpassen oder zurücknehmen
- Am Dauerposten: letzte Fälligkeiten mit Status (zurückgenommene lassen sich wiederherstellen) und nächste Fälligkeiten mit Bankarbeitstag
- Neue Seite „Offene Zahlungen“ (unter „Mehr“ und auf jeder Kontoseite): alle kommenden Fälligkeiten der nächsten 30 Tage, 3 Monate oder des nächsten Jahres, filterbar nach Konto
- Ändert man einen Dauerposten (Betrag, Termin, Pause, Ende), passen sich seine vorläufigen Buchungen an; von Hand geänderte bleiben, wie sie sind
- Ein Dauerposten mit nur vorläufigen Buchungen lässt sich weiterhin löschen; die vorläufigen Buchungen verschwinden mit
- Das Protokoll zeigt das automatische Buchen sowie jedes Zurücknehmen, Wiederherstellen und Ändern

## [0.16.0] – Kontostand und Anpassungsbuchung

### Neu

- Jedes Konto zeigt seinen aktuellen Kontostand: Startsaldo plus alle Buchungen ab dem Startsaldo-Datum, in der Kontenliste und auf der Kontoseite
- „Kontostand korrigieren“: tatsächlichen Stand an einem Tag eingeben, die Differenz wird als Anpassung gebucht
- Anpassungen erscheinen in den Buchungen; sie lassen sich nicht ändern, aber löschen
- Die Schnellerfassung meldet nach dem Buchen den neuen Stand des Kontos
- Buchungen vor dem Startsaldo-Datum bleiben gespeichert und sind als „zählt nicht zum Kontostand“ gekennzeichnet
- Korrekturen stehen im Protokoll mit Stand vorher und nachher

## [0.15.0] – Vorlagen für die Schnellerfassung

### Neu

- Vorlagen für häufige Buchungen, z. B. „Bäcker“ oder „Tanken“: Ein Tipp oben in der Schnellerfassung füllt Art, Betrag, Konto, Kategorie und Empfänger aus, danach nur noch „Buchen“
- Betrag und Konto sind optional: Ohne Betrag fragt die Schnellerfassung nur den Betrag ab, ohne Konto gilt das zuletzt benutzte
- Eigene Vorlagen sieht nur, wer sie angelegt hat; Vorlagen „für alle“ stehen allen Benutzern zur Verfügung
- Neue Seite Einstellungen › Vorlagen zum Anlegen, Ändern, Löschen und Ordnen
- Jede Buchung lässt sich mit „Als Vorlage sichern“ als Vorlage übernehmen
- Gemeinsame Vorlagen darf jeder ändern, löschen darf sie nur der Admin
- Anlegen, Ändern, Ordnen und Löschen von Vorlagen stehen im Protokoll

## [0.14.0] – Buchungen und Schnellerfassung

### Neu

- Runder Plus-Knopf auf jeder Seite (am Handy über der Tab-Leiste, am Desktop in der Seitenleiste): Ausgabe oder Einnahme mit Betrag, Konto und Kategorie erfassen, gebucht wird mit dem heutigen Datum
- Die Schnellerfassung merkt sich auf jedem Gerät das zuletzt benutzte Konto
- Neue Seite „Buchungen“: alle Buchungen nach Tagen gruppiert, filterbar nach Konto
- Buchung mit Datum, Empfänger/Zahler und Notiz erfassen; Buchungen ändern und löschen
- Konten zeigen die Anzahl ihrer Buchungen und führen direkt zur gefilterten Liste
- Buchungen dürfen nur auf Girokonten mit Recht „Bearbeiten“ erfasst werden; wer ein Konto nur sehen darf, sieht die Buchungen schreibgeschützt
- Konten mit Buchungen lassen sich nur noch archivieren, nicht löschen
- Anlegen, Ändern und Löschen von Buchungen stehen im Protokoll

## [0.13.0] – Dauerposten pausieren

### Neu

- Dauerposten lassen sich pausieren, z. B. ein Abo während einer Reise: Pause ab einem Tag, Ende optional
- In der Pause entstehen keine Fälligkeiten; danach geht es im gewohnten Rhythmus weiter
- Ohne Ende ruht der Dauerposten, bis jemand die Pause beendet
- „Pause beenden“: Eine laufende Pause endet am Vortag, eine noch nicht begonnene wird entfernt
- Liste und Detailseite zeigen die Pause an; pausierte Posten zählen nicht zu den Monatssummen
- Pausen stehen im Protokoll

### Behoben

- Dauerposten-Seite ohne Konten: Der Admin bekam fälschlich den Hinweis, ihm fehle das Recht „Bearbeiten“. Jetzt verweist die Seite darauf, zuerst unter „Konten“ ein Girokonto anzulegen

## [0.12.0] – Geplante Betragsänderung

### Neu

- „Änderung planen“ auf der Detailseite: Das Blatt zeigt bisherigen und neuen Betrag, die Differenz in Euro und Prozent und bei nicht monatlichen Posten die Wirkung pro Monat
- In der Dauerposten-Liste steht an jedem Eintrag mit geplanter Änderung der neue Betrag ab dem Datum
- Neuer Abschnitt „Geplante Änderungen“ mit allen künftigen Betragsänderungen, nach Datum sortiert
- Die Monatssummen je Konto zeigen zusätzlich, wie sie sich ab jeder geplanten Änderung verändern

## [0.11.0] – Vertragsdetails

### Neu

- Kundennummer und Notiz an jedem Dauerposten
- Kündigungsadresse bei kündbaren Verträgen: Firma, Straße, PLZ, Ort und E-Mail
- PDF-Dokumente an Dauerposten, z. B. Vertrag oder Preiserhöhung: beliebig viele, je bis 10 MB; die App prüft, dass es wirklich PDFs sind
- Dokumente öffnen sich mit einem Tipp; wer den Dauerposten nur sehen darf, kann sie öffnen, aber nicht ändern
- Hochladen und Löschen von Dokumenten stehen im Protokoll

### Hinweis für den Betrieb

- Dokumente liegen im Volume `app-data` unter `attachments/` und sind nicht Teil der automatischen Datenbanksicherung

## [0.10.0] – Vertragsdaten

### Neu

- Ausgaben lassen sich als „Kündbarer Vertrag“ markieren, mit Laufzeit, Kündigungsfrist (in Tagen, Wochen oder Monaten) und Verlängerung
- Drei Arten der Verlängerung: unbefristet (nach der Mindestlaufzeit jederzeit mit Frist kündbar), um eine feste Zeit (z. B. 12 Monate) oder keine (endet zum Laufzeitende)
- Die App berechnet, bis wann gekündigt werden muss und zu welchem Termin der Vertrag dann endet
- „Bald kündbar“ oben in der Dauerposten-Liste, sobald die Kündigungsfrist innerhalb des Vorlaufs abläuft
- Standard-Vorlauf für alle Verträge in den Einstellungen (Admin, vorbelegt mit 30 Tagen), je Vertrag änderbar
- „Gekündigt am“ setzt das Ende des Dauerpostens automatisch auf das berechnete Vertragsende; das Ende bleibt danach von Hand änderbar
- Vertragsdaten und Einstellungen stehen im Protokoll

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
