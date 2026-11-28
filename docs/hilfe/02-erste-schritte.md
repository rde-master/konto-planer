# Erste Schritte

Konto Planer beantwortet eine Frage: **Wie viel Geld muss bis zum nächsten Gehalt auf dem Girokonto bleiben – und wie viel ist frei?** Damit das klappt, braucht die App deine Konten und die regelmäßigen Zahlungen.

## Konten anlegen

Unter **Konten › +** (nur Admin) legst du an:

- **Girokonto**: das Konto für den Alltag; nur hier rechnet die App den Mindestbestand.
- **Sparbuch**: Geld zum Zurücklegen, mit Zinsen und Sparzielen.
- **Kreditkarte**: Umsätze werden einmal im Monat vom gewählten Girokonto ausgeglichen (siehe [Kreditkarte](04-planen-und-sparen.md#kreditkarte)).

Wichtig ist der **Startsaldo mit Datum** („Stand am“): Der Kontostand ist dieser Betrag plus alle Buchungen ab diesem Tag. Ältere Buchungen werden gespeichert, zählen aber nicht mit. Stimmt der Stand später nicht, hilft **Kontostand korrigieren** auf der Kontoseite. Ist das Konto im Minus (Dispo, offene Umsätze der Kreditkarte), wechselt der Knopf **+/−** neben dem Betrag das Vorzeichen – die Zahlentastatur am Handy hat kein Minuszeichen.

Die IBAN ist optional; der Umsatzimport prüft damit, ob die Datei zum Konto passt.

## Monatsübersicht eines Kontos

Auf der Kontoseite zeigt **Monatsübersicht** für die letzten zwölf Monate, was vom Konto abgegangen ist: die Summe aller **Abbuchungen** (jede Buchung mit Minusbetrag – Lastschriften, Kartenzahlungen, Überweisungen, auch Umbuchungen auf eigene Konten und die Kreditkartenabrechnung), ihre Anzahl, die Eingänge und den Saldo des Monats. „Umgebucht“ nennt den Teil der Abbuchungen, der auf eigene Konten ging. Ein Tipp auf einen Monat öffnet die Buchungsliste mit genau diesen Abbuchungen. Gezählt wird ab dem Startsaldo-Datum und bis heute; der laufende Monat ist mit „bisher“ gekennzeichnet.

## Dauerposten erfassen

Unter **Dauerposten** trägst du alles ein, was regelmäßig kommt oder geht: Gehalt, Miete, Strom, Versicherungen, Abos, Umbuchungen aufs Sparbuch. Je Posten wählst du Betrag, Intervall und erste Fälligkeit. Fällt die Fälligkeit auf ein Wochenende oder einen Feiertag, rechnet die App mit dem nächsten Bankarbeitstag.

Ist eine Zahlung schon als Buchung da (von Hand erfasst oder importiert), geht es schneller: die Buchung öffnen und **Dauerposten daraus machen** tippen. Bezeichnung, Betrag, Konto, Kategorie und Empfänger sind dann schon ausgefüllt, und die Buchung zählt als erste Zahlung.

Am Fälligkeitstag bucht die App den Posten **vorläufig**. Kommt später der Umsatzimport, ersetzt die echte Buchung die vorläufige.

Ändert sich ein Betrag, trage ihn mit **Änderung planen** und „gültig ab“ ein – die Vorschau rechnet ab dann damit.

### Die Seite eines Dauerpostens

Ein Tipp auf einen Dauerposten öffnet seine Seite. Sie ist in Reiter aufgeteilt, damit nicht alles untereinander steht:

- **Übersicht**: die nächsten Fälligkeiten, Pause, Vertrag mit Kündigungsfrist, Rücklage und Sparziele
- **Buchungen**: alles, was zu dem Dauerposten gebucht ist – importiert, von Hand zugeordnet oder vorläufig – mit Anzahl und Summe; ein Tipp öffnet die Buchung
- **Betrag**: der Betragsverlauf mit „Änderung planen“ und, bei Krediten, die Darlehensdaten
- **Bearbeiten**: die Angaben ändern, archivieren oder löschen
- **Mehr**: Dokumente (PDF), Tags, Logo und die Namen, unter denen der Import den Dauerposten erkennt

Der Reiter bleibt beim Sichern stehen; wer von einer Buchung zurückkommt, landet wieder im selben Reiter.

### Dauerposten finden

Über der Liste steht ein Suchfeld: Es sucht in Name, alternativer Bezeichnung, Empfänger, Kategorie, IBAN und Notiz. Darunter filterst du nach Art (Ausgaben, Einnahmen, Umbuchungen), Kategorie und Rhythmus und wählst die Reihenfolge – nächste Fälligkeit, Name, Betrag oder Kategorie. Die Liste bleibt nach Konten gruppiert; die Monatssummen gelten dann für die Auswahl. So siehst du zum Beispiel mit dem Filter „Versicherungen“, was sie dich im Monat kosten.

Jede Zeile zeigt den Rhythmus farbig hinterlegt und die Kategorie – mit einem Punkt in ihrer Farbe links oben, wie in der Buchungsliste.

### Alternative Bezeichnung

Banken schreiben den Empfänger oft sperrig („FUNKNETZ GMBH 4711“). Trägst du am Dauerposten eine **Alternative Bezeichnung** ein, zeigen seine Buchungen diese als Titel – zum Beispiel „Handy Lisa“. Die eigentliche Bezeichnung bleibt erhalten; sie steht in der Buchungsliste wie gewohnt in der Zeile darunter.

Auf den Seiten mit Buchungen (Buchungsliste, einzelne Buchung, Jahresliste eines Tags, Ausgleich) schaltest du mit **Alternative Bezeichnungen** zwischen deinem Namen und dem der Bank um. Derselbe Schalter steht auf der Dauerposten-Seite und am Dauerposten selbst: Eingeschaltet heißt der Dauerposten auch dort so; seine eigentliche Bezeichnung steht in der Liste in der Zeile darunter. Die Wahl gilt für dich überall; andere Benutzer entscheiden für sich. Der Schalter erscheint nur, wo es eine alternative Bezeichnung gibt.

Der Name von der Bank geht nicht verloren: Er steht an der Buchung unter „Empfänger/Zahler“, und Import, Logos und Auswertungen arbeiten weiter damit. Die Suche findet beide Namen.

### Kategorie aus den Buchungen

Hat ein Dauerposten keine Kategorie, seine Buchungen aber schon (von Hand, durch eine Regel oder aus dem Import), trägt die App die Kategorie der jüngsten Buchung am Dauerposten ein. Sie gilt dann auch für künftige Buchungen und für die Fixkosten in den Auswertungen. Eine Kategorie, die du selbst am Dauerposten gewählt hast, bleibt immer stehen.

## Gehalt und Stichtag

Markiere dein Gehalt beim Dauerposten als **Gehalt**. Bis zu diesem Tag rechnet die App den Mindestbestand („Stichtag“). Auf der Kontoseite kannst du den Stichtag auch auf das Monatsende oder ein festes Datum stellen.

## Mindestbestand verstehen

Die App geht alle Zahlungen bis zum Stichtag durch – pro Tag erst die Ausgänge, dann die Eingänge – und merkt sich den tiefsten Punkt. **Mindestbestand** ist, was heute auf dem Konto sein muss, damit es bis zum Stichtag nie unter null fällt, plus ein optionaler **Puffer**. **Verfügbar** ist der Rest. Der Dispo zählt nie als verfügbar.

Rutscht das Konto nach Plan ins Minus oder reicht der Dispo nicht, zeigt die Kontoseite eine Warnung mit dem Tag und dem fehlenden Betrag.

## Die Übersicht

Die Startseite zeigt den Haushalt auf einen Blick. Ganz oben steht **Verfügbar** mit jedem Girokonto einzeln, darunter die Summe aller Konten, dann die nächsten Zahlungen, bald kündbare Verträge, Budgets, offene Überweisungen und Hinweise wie neue Abos oder Preiserhöhungen. Ein Sparvorschlag am Gehaltstag steht ganz unten.

Dazu kommen Grafiken: der **Vermögensverlauf** der letzten sechs Monate mit gestrichelter Vorschau auf die nächsten 30 Tage, die **Ausgaben des Monats nach Kategorie** als Ring, **Einnahmen und Ausgaben** der letzten sechs Monate und je Girokonto eine kleine Linie bis zum Stichtag – der rote Punkt markiert den tiefsten Stand. Budgets und Sparziele zeigen ihren Fortschritt als Ring.
