# Buchungen und Import

## Buchen

Mit dem **+** unten rechts erfasst du eine Ausgabe oder Einnahme von jeder Seite aus: Betrag, Konto, Kategorie, optional Empfänger. Ohne Datum gilt heute. Unter **Buchungen** findest du alle Buchungen mit Suche und Filtern (Konto, Zeitraum, Betrag, Kategorie, Tag).

**Vorlagen** (Einstellungen › Vorlagen) füllen häufige Buchungen mit einem Tipp aus, z. B. „Bäcker“ mit Konto und Kategorie.

## Splitbuchung, Tags und Logos

- **Aufteilen**: Eine Buchung lässt sich auf mehrere Kategorien verteilen (z. B. Supermarkt: Lebensmittel und Drogerie).
- **Tags** fassen Buchungen über Kategorien hinweg zusammen, z. B. „Urlaub 2026“.
- Für viele Firmen zeigt die App automatisch das **Logo**. Fehlt es, sucht die App das Symbol auf der Webseite der Firma (stündlich und nach jedem Import). Unter **Logo ändern** kannst du selbst eine Webseite wie `rewe.de` oder die Adresse eines Bildes eintragen, ein anderes Logo wählen oder bei den Initialen bleiben.

## Umsatzimport (CSV)

Auf der Kontoseite **CSV importieren** wählen und den Export deiner Bank hochladen (Format der Volksbank, Semikolon-getrennt). Die Vorschau zeigt für jede Zeile, was passiert:

- **neu**: wird als Buchung übernommen
- **Dauerposten**: gehört zu einer erwarteten Zahlung; die vorläufige Buchung wird ersetzt
- **ersetzt**: ersetzt eine manuelle Buchung mit gleichem Betrag (±3 Tage)
- **Dublette**: schon importiert, wird übersprungen

Einen Dauerposten erkennt der Import der Reihe nach an Mandat und Gläubiger-ID, an der IBAN, am Namen (mit einer Fälligkeit in den zehn Tagen davor oder danach) und zuletzt an Betrag und Datum (±3 Tage; bei Zahlungen ohne IBAN wie auf der Kreditkarte ±10 Tage, wenn nur ein Dauerposten mit genau diesem Betrag in Frage kommt). Beim Namen zählt nur, was bleibt: Datum, Uhrzeit und Belegnummern, die vor allem Kreditkartenabrechnungen an den Namen hängen („FILMDIENST 24.11.“), werden nicht mitverglichen. Hat ein Empfänger bei gleicher IBAN einen neuen Namen, gilt die Zahlung weiter als sein Dauerposten, wenn eine Fälligkeit in der Nähe liegt. Nur über den Namen erkannt wird eine Zahlung, wenn der Betrag höchstens 30 % vom Plan abweicht – außer bei Dauerposten mit schwankendem Betrag. So wird eine regelmäßige Kartenzahlung nicht doppelt geführt (vorläufig und importiert), sondern ersetzt die vorläufige Buchung.

Erkennt der Import eine Zahlung nicht – etwa weil sie auf der Karte jedes Mal anders heißt –, wählst du in der Vorschau unter **Dauerposten** den richtigen von Hand (oder „keiner“, wenn die App falsch zugeordnet hat). Die Zahlung nimmt dann die nächstgelegene offene Fälligkeit (bis 31 Tage davor oder danach) und ersetzt deren vorläufige Buchung. Die App merkt sich den Namen: Beim nächsten Import erkennt sie den Dauerposten daran. Die gemerkten Namen stehen am Dauerposten unter **Namen im Import** und lassen sich dort entfernen.

## Buchung einem Dauerposten zuordnen

Auch nach dem Import geht das: An einer Buchung ohne Dauerposten steht unter „Verwaltung“ **Dauerposten zuordnen**. Die Buchung gehört dann zum gewählten Dauerposten, die nächstgelegene offene Fälligkeit gilt als bezahlt und ihre vorläufige Buchung verschwindet – so steht die Zahlung nicht doppelt da. Mit **Zuordnung lösen** machst du das rückgängig; die Fälligkeit ist dann wieder offen. Gibt es den Dauerposten noch nicht, nimm stattdessen **Dauerposten daraus machen**.

## Abweichungen und Abgleich

Weicht ein Betrag vom Dauerposten ab, kannst du den neuen Betrag übernehmen. Regelmäßige Zahlungen ohne Dauerposten schlägt der Import als neue Dauerposten vor. Nach dem Übernehmen vergleicht die App den Kontostand mit dem Saldo laut Bank.

Ein Import lässt sich rückgängig machen, solange er der jüngste auf dem Konto ist.

## Kategorien und Regeln

Kategorien haben zwei Ebenen (Haupt- und Unterkategorie); die Farbe kommt von der Hauptkategorie. **Regeln** (Kategorien › Regeln) ordnen importierte Buchungen automatisch zu, z. B. „Empfänger enthält REWE → Lebensmittel“. Wählst du bei einer Buchung eine Kategorie, merkt sich die App das für den Empfänger.

## Papierkorb

Gelöschte Buchungen, Dauerposten, Kategorien und mehr liegen 30 Tage im **Papierkorb** und lassen sich mit einem Tipp wiederherstellen.
