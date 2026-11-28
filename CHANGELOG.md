# Changelog

Alle nennenswerten Änderungen an Konto Planer. Versionen folgen [SemVer](https://semver.org/lang/de/); jede Funktion erscheint als eigene Unterversion 0.x.0.

## [0.83.0] – Übersicht: Konten zuerst

### Geändert

- Übersicht: Die Kachel „Verfügbar“ mit den einzelnen Girokonten steht jetzt ganz oben – noch vor der Summe des Haushalts und dem Vermögensverlauf
- Der Sparvorschlag steht jetzt ganz unten auf der Übersicht. Die Meldung nach dem Umbuchen oder Ausblenden erscheint dort, wo der Vorschlag stand

## [0.82.0] – Alternative Bezeichnung auch bei den Dauerposten

### Neu

- Der Umschalter „Alternative Bezeichnungen“ steht jetzt auch auf der Dauerposten-Seite und an jedem Dauerposten mit alternativer Bezeichnung. Eingeschaltet heißt der Dauerposten dort so wie in den Buchungen – in der Liste, unter „Bald kündbar“ und „Geplante Änderungen“ und als Titel seiner eigenen Seite. Die eigentliche Bezeichnung steht in der Liste in der Zeile darunter
- Sortiert nach Name richtet sich die Liste nach dem Namen, der gerade angezeigt wird. Der Schalter ist derselbe wie auf den Buchungsseiten: einmal umgestellt, gilt die Wahl überall

## [0.81.0] – Benachrichtigungen über Pushover

### Neu

- Pushover als vierter Weg für Benachrichtigungen, neben E-Mail, Home Assistant und Push aus der Web-App. Die Meldungen kommen als Push-Mitteilung in der Pushover-App an (iPhone, Android, Desktop); ein Tipp auf den Link darin öffnet die passende Seite im Konto Planer
- Einrichten: Der Admin legt auf pushover.net eine Anwendung an und trägt ihr API-Token unter Einstellungen › Benachrichtigungen ein. Jeder Benutzer trägt unter „Meine Benachrichtigungen“ seinen eigenen Benutzerschlüssel ein. Beides wird verschlüsselt gespeichert und nie wieder angezeigt
- Je Meldungsregel gibt es den Schalter „Über Pushover“ – so legst du fest, welche Meldungen diesen Weg nehmen. Mit „Pushover-Test an mich“ prüfst du, ob alles ankommt; ein falsches Token oder ein unbekannter Schlüssel wird beim Test gemeldet
- Gut zu wissen: Pushover ist ein Dienst eines anderen Anbieters. Titel und Text der Meldungen (zum Beispiel Kontoname und Betrag) laufen über dessen Server

## [0.80.0] – Alternative Bezeichnung für Dauerposten

### Neu

- Dauerposten haben ein neues Feld „Alternative Bezeichnung“. Die Buchungen des Dauerpostens zeigen sie als Titel – statt des Namens, den die Bank schreibt. Aus „FUNKNETZ GMBH 4711“ wird so zum Beispiel „Handy Lisa“. Der Dauerposten selbst heißt weiter wie bisher und steht wie gewohnt in der Zeile darunter
- Umschalter „Alternative Bezeichnungen“ auf den Seiten mit Buchungen (Buchungsliste, einzelne Buchung, Jahresliste eines Tags, Ausgleich): ausgeschaltet stehen wieder die Namen von der Bank. Die Wahl gilt für dich auf allen Seiten und Geräten; der Schalter erscheint nur dort, wo es eine alternative Bezeichnung gibt
- Die Suche in den Buchungen und in den Dauerposten findet auch die alternative Bezeichnung. Der Name von der Bank bleibt an der Buchung unter „Empfänger/Zahler“ stehen; Import, Logos und Auswertungen arbeiten weiter damit

## [0.79.0] – Auswertung nach Empfängern

### Neu

- Auswertungen: Neuer Reiter „Empfänger“ zeigt, wie viel in einem Zeitraum an wen gezahlt wurde – je Empfänger die Summe, die Zahl der Zahlungen, die letzte Zahlung und, falls etwas zurückkam, die Gutschriften
- Zeitraum frei wählbar (von/bis) oder mit einem Tipp: dieser Monat, letzter Monat, 12 Monate, dieses Jahr, letztes Jahr. Die Kontoauswahl gilt wie in den anderen Auswertungen
- Suchfeld für bestimmte Empfänger; die Summe oben gilt für die Treffer. Ein Tipp auf einen Empfänger öffnet seine Buchungen im gewählten Zeitraum
- Zusammenfassen: Bucht derselbe Empfänger unter verschiedenen Namen oder IBANs ab, wählst du die Namen aus und zählst sie als einen – mit eigenem Namen. Die Zusammenfassung zeigt die Gesamtsumme und darunter die einzelnen Namen; sie lässt sich umbenennen, um weitere Namen ergänzen, einzelne Namen wieder herauslösen oder ganz auflösen. An den Buchungen ändert sich dabei nichts
- Gleiche Namen mit wechselndem Datum oder Belegnummer („FILMDIENST 24.11.“) zählen von selbst als ein Empfänger; Umbuchungen zwischen eigenen Konten zählen nicht

## [0.78.0] – Import auch für Sparbücher

### Neu

- Sparbücher lassen sich jetzt importieren wie Girokonten – auf der Kontoseite unter „CSV importieren“ und per Kurzbefehl. Voraussetzung ist die IBAN am Sparbuch; daran erkennt der Kurzbefehl das Konto
- Die Zeilen der Bank ersetzen, was die App auf dem Sparbuch schon selbst gebucht hat, damit nichts doppelt steht: die Gegenbuchung einer Umbuchung vom Girokonto, die vorläufige Buchung eines Dauerauftrags aufs Sparbuch und die Umbuchung für ein Sparziel
- Zinsen: Schreibt die Bank Zinsen gut, ersetzt ihr Betrag die berechnete Gutschrift der Zinsperiode. Die Buchung heißt dann „Zinsen (Import)“ und ändert sich nicht mehr, wenn die App neu rechnet
- Wie bei jedem Import: Abgleich mit dem Saldo der Bank, und der jüngste Import lässt sich rückgängig machen – die berechneten Zinsen und die eigenen Buchungen der App sind dann wieder da

### Behoben

- Import: Eine Umbuchung fürs Sparziel stand nach dem Import des Girokontos doppelt da (einmal von der App, einmal von der Bank). Die Zeile der Bank ersetzt sie jetzt
- Import: Eine zusätzliche Überweisung aufs eigene Sparbuch wurde dem Dauerauftrag zugeordnet und kam auf dem Sparbuch nicht an. Zum Dauerauftrag gehört jetzt nur noch die Zahlung in der Nähe seiner Fälligkeit, bevorzugt die mit dem geplanten Betrag; alles andere ist eine eigene Umbuchung mit Gegenbuchung
- Kurzbefehl: Bei einem Sparbuch hieß es irreführend, zur IBAN gebe es kein Konto

## [0.77.0] – Frameworks und Bibliotheken

### Neu

- Einstellungen: Neue Seite „Frameworks und Bibliotheken“ zeigt, womit die App gebaut ist – Frameworks, Bibliotheken und die Werkzeuge für Entwicklung und Tests, jeweils mit Version, Lizenz und kurzem Zweck
- Dazu die Laufzeit: die Versionen von Node.js und PostgreSQL, mit denen die App gerade läuft
- Ein Tipp auf den Namen öffnet die Seite des Pakets bei npm

## [0.76.0] – Dauerposten finden und einordnen

### Neu

- Dauerposten: Suchfeld über der Liste – sucht in Name, Empfänger, Kategorie, IBAN und Notiz
- Filter nach Art (Ausgaben, Einnahmen, Umbuchungen), Kategorie und Rhythmus; sortieren nach nächster Fälligkeit, Name, Betrag oder Kategorie. Die Gruppen je Konto bleiben, die Monatssummen gelten für die Auswahl
- Suche, Filter und Sortierung bleiben erhalten, wenn du einen Dauerposten öffnest und zurückkommst
- Jede Zeile zeigt die Kategorie – mit farbigem Punkt links oben wie in der Buchungsliste – und den Rhythmus farbig hinterlegt (monatlich blau, vierteljährlich orange, halbjährlich lila, jährlich rot, wöchentlich grün, frei türkis)
- Hat ein Dauerposten keine Kategorie, übernimmt er die Kategorie seiner jüngsten Buchung. Sie wird am Dauerposten eingetragen und gilt damit auch für künftige Buchungen und die Fixkosten-Auswertung. Eine selbst gewählte Kategorie wird nie überschrieben

### Geändert

- Am Handy gibt es auf der Dauerposten-Seite nur noch ein Plus: Das runde Plus unten legt dort einen Dauerposten an

## [0.75.1] – Liste bleibt stehen

### Behoben

- Buchungen: „Ältere Buchungen anzeigen“ springt nicht mehr an den Anfang der Liste – du bleibst, wo du warst, und die älteren Buchungen folgen darunter
- Dasselbe galt beim Entfernen eines Filters in der Buchungsliste und beim Umschalten der Ansicht im Finanzfluss; auch dort bleibt die Seite jetzt stehen

## [0.75.0] – Umsätze per Kurzbefehl importieren

### Neu

- Den CSV-Export deiner Bank kannst du jetzt per iOS-Kurzbefehl importieren – über „Teilen“ in der Banking-App oder aus „Dateien“. Die Anleitung steht unter „iOS Kurzbefehle“
- Zwei Varianten zur Wahl: „sofort übernehmen“ (alle neuen Zeilen werden gleich gebucht, der Kurzbefehl meldet Anzahl und Saldo-Abgleich) oder „erst Vorschau“ (die Datei wartet in der App, bis du sie geprüft hast)
- Das Konto erkennt die App an der IBAN in der Datei. Wie die Datei heißt, ist egal – sie muss nicht auf „.csv“ enden
- Übersicht: Eine hochgeladene, noch nicht übernommene Datei steht unter „Import prüfen“; auch die Import-Seite des Kontos führt zur offenen Vorschau

### Geändert

- Beim Hochladen in der App lassen sich jetzt auch Dateien ohne die Endung „.csv“ auswählen

## [0.74.0] – iOS Kurzbefehle

### Neu

- Neuer Menüpunkt „iOS Kurzbefehle“ (unter „Mehr“): Hier legst du den Zugang für einen Kurzbefehl an, wählst das Konto, auf das er bucht, und widerrufst ihn bei Bedarf
- Adresse und Kopfzeile stehen mit Knöpfen zum Kopieren bereit – direkt zum Einfügen in die App „Kurzbefehle“
- Schritt-für-Schritt-Anleitung auf der Seite: die einfache Fassung mit fünf Aktionen (nur Betrag eintippen) und die erweiterte mit Auswahl von Vorlage oder Kategorie, dazu Tipps für Home-Bildschirm, Aktionstaste und Siri
- Der Kurzbefehl kann jetzt auch nur den Betrag senden. Die Kategorie setzt die App dann über deine Regeln („Immer so einordnen“); die Rückmeldung nennt, was gebucht wurde
- Einen fertigen Kurzbefehl zum Laden gibt es nicht: iOS nimmt nur von Apple signierte Kurzbefehle an (iCloud-Link oder Mac). Die Seite erklärt das

## [0.73.0] – Bedienung am Handy

### Neu

- Buchungen: Am Handy gibt es nur noch ein Plus. Das runde Plus unten öffnet in der Buchungsliste gleich das vollständige Formular (mit Datum und Umbuchung); das zweite Plus oben entfällt. Auf allen anderen Seiten bleibt es die Schnellerfassung
- Zurück-Knopf: Ist eine Seite nach unten gescrollt, steht der Zurück-Knopf jetzt über dem kleinen Titel statt daneben. So wird bei langen Namen – etwa in einer Buchung – weder „Buchungen“ zu „B…“ gekürzt noch der Titel abgeschnitten

## [0.72.0] – Regeln mit mehreren Bedingungen

### Neu

- „Immer so einordnen“ an der Buchung: Statt eines Merkmals kreuzt du jetzt an, woran die App solche Buchungen erkennt – Empfänger, Verwendungszweck, IBAN und neu auch **Buchungstext** (z. B. „Basislastschrift“) und **Kategorie der Bank** (z. B. „Technik“). Bei mehreren Merkmalen müssen alle zutreffen
- So lassen sich Zahlungen trennen, die beim selben Händler landen: etwa „APPLE.COM/BILL“ mit Bank-Kategorie „Technik“ anders einordnen als mit „Freizeit“
- Kategorien › Regeln: Jede Regel kann bis zu fünf Bedingungen haben („Weitere Bedingung“); sie gilt nur, wenn alle zutreffen. Buchungstext und Kategorie der Bank stehen auch dort zur Wahl
- Bestehende Regeln bleiben unverändert gültig

## [0.71.0] – Vorläufige Buchungen auf einen Blick

### Neu

- Buchungsliste: Vorläufige Buchungen tragen rechts oben am Symbol ein gelbes Fragezeichen – die Bank hat sie noch nicht bestätigt
- Das Wort „vorläufig“ steht jetzt vorn in der Unterzeile und ist gelb (im hellen Design in einem dunkleren Gelb, damit es lesbar bleibt)

## [0.70.0] – Finanzfluss

### Neu

- Neue Seite „Finanzfluss“ (unter „Mehr“): ein Flussdiagramm zeigt, wie das Gehalt vom Hauptkonto über Umbuchungen auf deine anderen Konten wandert und wofür es dort ausgegeben wird – in Beträgen je Monat
- „Geplant“ rechnet mit den Dauerposten und geplanten Zahlungen der nächsten zwölf Monate, „Tatsächlich“ mit den Buchungen der letzten drei, sechs oder zwölf Monate
- Reichen die Beträge? Für jedes Konto steht das Urteil für den Plan und für den Rückblick: „Reicht“, „Zehrt vom Bestand“, „Zeitweise knapp“ oder „Reicht nicht“ – mit dem Betrag, der im Monat fehlt oder übrig bleibt, und dem Tag, an dem es eng wird
- Ausreichend heißt: Im Schnitt kommt mindestens so viel an, wie abgeht, und der Kontostand fällt nie unter 0 bzw. den Puffer. Jahresbeiträge sind dabei auf die Monate verteilt
- Der Plan rechnet die Alltagsausgaben mit ein (Einkäufe, Tanken, Kartenzahlungen ohne Dauerposten) – als Durchschnitt aus dem Rückblick
- Sparbücher werden an ihren Rücklagen und Sparzielen gemessen („120 € im Monat nötig, 100 € kommen an“), Kreditkarten gleicht die Abrechnung aus
- „Monat für Monat“ zeigt je Konto, was ankam und abging; „Alle Flüsse als Liste“ nennt jeden Betrag des Diagramms

## [0.69.0] – Immer so einordnen: Kategorie je Empfänger

### Neu

- An der Buchung: „Immer so einordnen“ legt fest, dass Buchungen dieses Empfängers automatisch eine Kategorie bekommen. Empfänger und Kategorie sind vorausgefüllt und änderbar
- Bei Kartenzahlungen ohne Empfänger nimmt die App den Händler aus dem Verwendungszweck („APPLE.COM/BILL IRL CORK“). Datum und Nummern, die sich je Buchung ändern, lässt sie weg; den Text kannst du weiter kürzen
- Sofort eingeordnet werden die Buchung selbst und alle vorhandenen Buchungen ohne Kategorie, auf die der Text zutrifft. Buchungen mit einer Kategorie bleiben unverändert
- Neue Buchungen bekommen die Kategorie von selbst – beim Import und jetzt auch beim Erfassen von Hand, wenn du keine Kategorie wählst
- Dahinter steht eine gewöhnliche Kategorie-Regel: Sie erscheint an erster Stelle unter Kategorien › Regeln und lässt sich dort ändern oder löschen

## [0.68.0] – Buchungsliste: Dauerposten und Kategorien auf einen Blick

### Neu

- Buchungsliste: Buchungen, die zu einem Dauerposten gehören, sind farbig hinterlegt und tragen den Hinweis „Dauerposten“ – mit dem Namen des Dauerpostens, wenn die Bank die Zahlung anders nennt („Dauerposten iCloud“). Das gilt für vorläufige wie für importierte Zahlungen
- So siehst du sofort, welche Zahlung erkannt wurde – und welche noch keinem Dauerposten zugeordnet ist
- Jede Buchung mit Kategorie zeigt links oben einen Punkt in der Farbe ihrer Kategorie; aufgeteilte Buchungen zeigen bis zu drei Punkte

## [0.67.1] – Zahlungen nicht mehr doppelt

### Behoben

- Legst du einen Dauerposten an, dessen Zahlung schon auf dem Konto steht (importiert oder von Hand erfasst), stand sie bisher doppelt da: einmal echt, einmal „vorläufig“. Jetzt erkennt die App die vorhandene Buchung, ordnet sie dem Dauerposten zu und bucht nichts mehr vorläufig dazu
- Als bezahlt gilt eine Fälligkeit, wenn auf dem Konto eine Buchung ohne Dauerposten mit genau dem geplanten Betrag steht, bis drei Tage davor oder danach – bis zehn Tage, wenn auch Name, IBAN oder Mandat passen
- Schon doppelt vorhandene Zahlungen bereinigt die App nach dem Update von selbst: die vorläufige Buchung verschwindet, die echte gehört zum Dauerposten
- Hat die App falsch zugeordnet, hilft „Zuordnung lösen“ an der Buchung – eine so gelöste Buchung (und im Import „keiner“) ordnet sie nicht noch einmal von selbst zu
- Import rückgängig: Fälligkeiten, die du nach dem Import von Hand zugeordnet hattest, sind danach wieder offen

## [0.67.0] – Monatsübersicht je Konto

### Neu

- Kontoseite: neuer Abschnitt „Monatsübersicht“ mit den letzten zwölf Monaten – je Monat die Summe aller Abbuchungen, ihre Anzahl, die Eingänge und der Saldo
- Abbuchungen sind alles, was vom Konto abgeht: Lastschriften, Kartenzahlungen, Überweisungen, auch Umbuchungen auf eigene Konten und die Kreditkartenabrechnung. Der umgebuchte Teil steht zusätzlich dabei
- Ein Tipp auf einen Monat öffnet die Buchungsliste mit genau diesen Abbuchungen; von dort führt Zurück wieder zum Konto

## [0.66.0] – Umbuchung zwischen zwei Konten

### Neu

- Buchung erfassen: Im Feld „Umbuchung auf/von“ wählst du ein anderes eigenes Konto. Die Ausgabe hier ist dort eine Einnahme (und umgekehrt) – etwa Girokonto → Sparbuch oder Girokonto → Kreditkarte
- An einer bestehenden Buchung: „Als Umbuchung kennzeichnen“. Steht auf dem anderen Konto schon die passende Buchung (gleicher Betrag, bis drei Tage davor oder danach), werden beide verknüpft; sonst legt die App die Gegenbuchung an
- Beide Seiten zeigen, wohin bzw. woher das Geld ging, und führen zueinander
- „Umbuchung auflösen“ macht daraus wieder zwei einzelne Buchungen; eine von der App angelegte Gegenbuchung lässt sich dabei gleich löschen
- Umbuchungen zählen in Auswertungen und Budgets weder als Ausgabe noch als Einnahme
- Änderst du Betrag oder Datum, zieht die von der App angelegte Gegenbuchung mit

## [0.65.0] – Zahlungen von Hand zuordnen

### Neu

- Import-Vorschau: Jede Zeile hat eine Auswahl „Dauerposten“. Erkennt die App eine Zahlung nicht, wählst du den Dauerposten selbst; hat sie falsch zugeordnet, wählst du einen anderen oder „keiner“
- An der Buchung: „Dauerposten zuordnen“ für Zahlungen, die schon importiert oder von Hand erfasst sind – und „Zuordnung lösen“, falls es der falsche war
- Die zugeordnete Zahlung nimmt die nächstgelegene offene Fälligkeit (bis 31 Tage davor oder danach) und ersetzt deren vorläufige Buchung – nichts steht mehr doppelt da
- Die App merkt sich den Namen der Zahlung und erkennt den Dauerposten beim nächsten Import daran. Die gemerkten Namen stehen am Dauerposten unter „Namen im Import“ und lassen sich dort entfernen
- Importierte Buchungen zeigen jetzt, zu welchem Dauerposten sie gehören

## [0.64.4] – Kartenabrechnung in den offenen Zahlungen

### Behoben

- „Offene Zahlungen“ listet jetzt auch die nächste Kreditkartenabrechnung: als Ausgang beim Girokonto und als Eingang bei der Karte, am Tag der Abbuchung. Bisher war sie nur in Mindestbestand, Verfügbar und Vorschau eingerechnet
- Auch das Widget „Offene Zahlungen“ und die nächste Zahlung in der API (Home Assistant) kennen die Abrechnung

## [0.64.3] – Dauerposten im Import besser erkennen

### Behoben

- Kreditkarte: Hängt die Bank das Kaufdatum oder eine Belegnummer an den Namen („FILMDIENST 24.11.“), wird die Zahlung jetzt trotzdem ihrem Dauerposten zugeordnet – sie steht nicht mehr doppelt da (vorläufig und importiert)
- Zahlungen ohne IBAN werden am Namen erkannt: Empfänger oder Bezeichnung des Dauerpostens, dazu eine Fälligkeit in den zehn Tagen davor oder danach; der Betrag darf bis 30 % abweichen (bei schwankendem Betrag beliebig)
- Ganz anderer Name auf der Karte: Der genaue Betrag reicht innerhalb von zehn Tagen, wenn nur ein Dauerposten in Frage kommt
- Gleiche IBAN, neuer Name des Empfängers: Die Zahlung bleibt bei ihrem Dauerposten, wenn eine Fälligkeit in der Nähe liegt
- Vorschläge für neue Dauerposten, gemerkte Kategorien und Logos fassen solche Zahlungen jetzt zu einem Empfänger zusammen; der Vorschlag trägt den Namen ohne Datum

Hinweis: Für Empfänger ohne IBAN, deren Name Zahlen enthielt, musst du eine von Hand gewählte Kategorie oder ein Logo einmal neu wählen.

## [0.64.2] – Zurück führt zurück

### Behoben

- Der Zurück-Knopf oben links führt jetzt dorthin, woher du gekommen bist, und zeigt den Namen dieser Seite: vom Konto in dessen Buchungen, in eine Buchung und zurück landest du wieder in der gefilterten Liste und danach beim Konto – nicht mehr bei allen Buchungen
- Die Liste steht dabei wieder an der Stelle, an der du sie verlassen hast
- Die gefilterte Buchungsliste hat selbst einen Zurück-Knopf, wenn du von einer anderen Seite kommst (Konto, Auswertung, Tag, Budget)
- Nach „Dauerposten daraus machen“ führt Zurück zur Buchung statt noch einmal ins ausgefüllte Formular
- Öffnest du eine Seite direkt (Lesezeichen, Mitteilung), führt Zurück wie bisher zur übergeordneten Liste

## [0.64.1] – Minusbetrag am Handy eingeben

### Behoben

- Startsaldo und „Kontostand korrigieren“: neben dem Betrag steht jetzt ein Knopf „+/−“, der das Vorzeichen wechselt – die Zahlentastatur am Handy hat kein Minuszeichen, ein negativer Stand (Kreditkarte, Dispo) ließ sich dort nicht eingeben
- „Kontostand korrigieren“ öffnet am Handy jetzt ebenfalls die Zahlentastatur

## [0.64.0] – Dauerposten aus einer Buchung

### Neu

- An jeder Buchung (manuell oder importiert): „Dauerposten daraus machen“ – das Formular öffnet sich mit Bezeichnung, Betrag, Konto, Kategorie, Empfänger und IBAN aus der Buchung; Intervall prüfen, anlegen, fertig
- Die Buchung zählt als erste Zahlung des neuen Dauerpostens und wird nicht noch einmal vorläufig gebucht
- Nach dem Anlegen geht es direkt zum neuen Dauerposten

## [0.63.1] – Knöpfe am Desktop erkennbar

### Behoben

- Aktionen wie „Logo ändern“, „Aufteilen“, „Umbenennen“ oder „Archivieren“ sahen aus wie normale Einträge; sie sind jetzt farbig wie Knöpfe
- Am Desktop zeigt die Maus überall die Hand, und Zeilen sowie Knöpfe reagieren beim Überfahren
- Kleine Text-Knöpfe („Entfernen“, „Überwiesen“, „Widerrufen“, „Holen“ …) haben am Desktop eine Knopfform, graue und schlichte Knöpfe eine Kontur

## [0.63.0] – Grafiken auf der Übersicht

### Neu

- Vermögensverlauf: Summe aller Konten über die letzten sechs Monate, gestrichelt die erwarteten Zahlungen der nächsten 30 Tage
- Ausgaben des laufenden Monats als Ring nach Kategorie, mit Vergleich zum Vormonat bis zum gleichen Tag
- Einnahmen und Ausgaben der letzten sechs Monate als Balken
- Je Girokonto eine kleine Verlaufslinie bis zum Stichtag, mit Markierung des tiefsten Punkts
- Budgets und Sparziele mit Fortschrittsringen – alle Budgets des Monats, nicht mehr nur die knappen

## [0.62.0] – Mehr Firmenlogos

### Neu

- Empfänger ohne Logo bekommen jetzt das Symbol von der Webseite der Firma, ersatzweise über den Symboldienst von Google – für rund 180 bekannte Firmen in Deutschland (REWE, EDEKA, Lidl, ALDI, dm, Rossmann, Kaufland, Sparkasse, Volksbank, Versicherungen, Tankstellen …) und per vorsichtigem Versuch aus dem Firmennamen
- Die Suche läuft automatisch stündlich und nach jedem Import; unter Einstellungen › Systemstatus gibt es „Fehlende Logos jetzt suchen“
- „Logo ändern“: Webseite der Firma (z. B. rewe.de) oder die Adresse eines Bildes aus einer Websuche eintragen und mit „Holen“ übernehmen
- Privatpersonen werden nie im Web gesucht; ohne Logo bleiben wie bisher die Initialen

### Hinweis

- Der Server ruft dafür Firmen-Webseiten und den Google-Dienst ab; übertragen wird nur die Adresse der Firmen-Webseite, keine Buchungsdaten. Abschalten mit `WEB_LOGOS=false` in der `.env`
- Die Bilder liegen im Datenvolume unter `logos/`

## [0.61.0] – Desktop-Layout

### Neu

- Am Desktop nutzen die Seiten jetzt die Breite: ab etwa 1280 Pixel Fensterbreite laufen die Abschnitte in zwei Spalten, auf sehr breiten Monitoren in drei
- Suche, Filter, Reiter und Monatswahl gehen über die ganze Breite; Formulare bleiben mit ihrem Knopf zusammen
- Lange Listen wie Protokoll und Kategorien-Auswertung fließen über die Spalten; der Jahreskalender zeigt sechs Monate je Reihe
- Widget-Editor: Vorschau links, Einstellungen rechts
- Lesetexte (Hilfe, Was ist neu) bleiben in angenehmer Lesebreite; am Handy ändert sich nichts

## [0.60.0] – Demo-Modus

### Neu

- Demo-Instanz zum Ausprobieren: `docker compose -f docker-compose.demo.yml up -d` startet Konto Planer mit dem erfundenen Haushalt „Beispiel“ – vier Konten samt Kreditkarte, Dauerposten mit Verträgen, sechs Monate Alltagsbuchungen, Budgets und ein Sparziel
- In der Demo keine Anmeldung, alles bedienbar; ein Hinweis oben erinnert daran, dass Änderungen jede Nacht zurückgesetzt werden
- E-Mail, Push und Home Assistant sind in der Demo abgeschaltet
- Screenshots für README und Dokumentation entstehen per Skript aus der Demo (Handy hell und dunkel, Desktop)

## [0.59.0] – Anleitung

### Neu

- Hilfe in der App unter Mehr › Hilfe: Einrichtung, Erste Schritte, Buchungen und Import, Planen und Sparen, Benachrichtigungen, Widgets/Kurzbefehl/Kalender/API und Gemeinsam nutzen
- Suche über alle Kapitel, Abschnitt mit einem Tipp öffnen
- Hilfe-Links auf wichtigen Seiten führen direkt zum passenden Abschnitt (Mindestbestand, Dauerposten, Import, Widgets, Meldungen)
- Dieselben Texte stehen im Repository unter docs/hilfe, verlinkt aus der README

## [0.58.0] – Systemstatus und „Was ist neu“

### Neu

- Einstellungen › Systemstatus (Admin): Version mit Hinweis auf ein neueres Release, Laufzeit, Hintergrundjobs mit letztem Lauf, Dauer und Fehlern, Verbindungen (E-Mail, Home Assistant, Push) mit letztem Versand, Datenbank-Version und -Größe, Anzahl der Daten, Platz für Anhänge und Sicherungen
- Sicherungen: „Jetzt sichern“ (wie vor jedem Update) und alle Sicherungen zum Herunterladen; die neuesten zehn bleiben
- „Was ist neu“: nach einem Update sieht jeder Benutzer einmal, was sich seit seinem letzten Besuch geändert hat; jederzeit nachlesbar unter Einstellungen › Was ist neu

### Hinweis

- Die Update-Prüfung fragt nur die öffentliche Release-Liste auf GitHub ab und sendet keine Daten

## [0.57.0] – Schnellerfassung per iOS-Kurzbefehl

### Neu

- Ausgaben über einen iOS-Kurzbefehl erfassen, ohne die App zu öffnen: Betrag eingeben, Vorlage oder Kategorie aus der Liste wählen – fertig
- Eigener Zugang „Kurzbefehl (bucht)“ unter Einstellungen › API-Zugänge mit festem Konto („Bucht auf“); er ist der einzige Zugang, der schreiben darf, und legt nur Buchungen an
- Vorlagen der Schnellerfassung bestimmen Konto, Kategorie und Empfänger; Einnahmen mit „+“ vor dem Betrag
- Rückmeldung als Mitteilung, z. B. „12,80 € Lebensmittel gebucht (Giro) · Lebensmittel: noch 87,20 € diesen Monat · verfügbar 612,00 €“
- Anleitung zum Einrichten in der App „Kurzbefehle“ mit Kopier-Knopf für die Adresse

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
