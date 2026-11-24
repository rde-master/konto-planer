# Changelog

Alle nennenswerten Änderungen an Konto Planer. Versionen folgen [SemVer](https://semver.org/lang/de/); jede Funktion erscheint als eigene Unterversion 0.x.0.

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
