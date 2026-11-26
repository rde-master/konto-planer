# Erste Schritte

Konto Planer beantwortet eine Frage: **Wie viel Geld muss bis zum nächsten Gehalt auf dem Girokonto bleiben – und wie viel ist frei?** Damit das klappt, braucht die App deine Konten und die regelmäßigen Zahlungen.

## Konten anlegen

Unter **Konten › +** (nur Admin) legst du an:

- **Girokonto**: das Konto für den Alltag; nur hier rechnet die App den Mindestbestand.
- **Sparbuch**: Geld zum Zurücklegen, mit Zinsen und Sparzielen.
- **Kreditkarte**: Umsätze werden einmal im Monat vom gewählten Girokonto ausgeglichen (siehe [Kreditkarte](04-planen-und-sparen.md#kreditkarte)).

Wichtig ist der **Startsaldo mit Datum** („Stand am“): Der Kontostand ist dieser Betrag plus alle Buchungen ab diesem Tag. Ältere Buchungen werden gespeichert, zählen aber nicht mit. Stimmt der Stand später nicht, hilft **Kontostand korrigieren** auf der Kontoseite.

Die IBAN ist optional; der Umsatzimport prüft damit, ob die Datei zum Konto passt.

## Dauerposten erfassen

Unter **Dauerposten** trägst du alles ein, was regelmäßig kommt oder geht: Gehalt, Miete, Strom, Versicherungen, Abos, Umbuchungen aufs Sparbuch. Je Posten wählst du Betrag, Intervall und erste Fälligkeit. Fällt die Fälligkeit auf ein Wochenende oder einen Feiertag, rechnet die App mit dem nächsten Bankarbeitstag.

Am Fälligkeitstag bucht die App den Posten **vorläufig**. Kommt später der Umsatzimport, ersetzt die echte Buchung die vorläufige.

Ändert sich ein Betrag, trage ihn mit **Änderung planen** und „gültig ab“ ein – die Vorschau rechnet ab dann damit.

## Gehalt und Stichtag

Markiere dein Gehalt beim Dauerposten als **Gehalt**. Bis zu diesem Tag rechnet die App den Mindestbestand („Stichtag“). Auf der Kontoseite kannst du den Stichtag auch auf das Monatsende oder ein festes Datum stellen.

## Mindestbestand verstehen

Die App geht alle Zahlungen bis zum Stichtag durch – pro Tag erst die Ausgänge, dann die Eingänge – und merkt sich den tiefsten Punkt. **Mindestbestand** ist, was heute auf dem Konto sein muss, damit es bis zum Stichtag nie unter null fällt, plus ein optionaler **Puffer**. **Verfügbar** ist der Rest. Der Dispo zählt nie als verfügbar.

Rutscht das Konto nach Plan ins Minus oder reicht der Dispo nicht, zeigt die Kontoseite eine Warnung mit dem Tag und dem fehlenden Betrag.

## Die Übersicht

Die Startseite zeigt den Haushalt auf einen Blick: Summe aller Konten, verfügbar je Girokonto, die nächsten Zahlungen, bald kündbare Verträge, Budgets, offene Überweisungen und Hinweise wie neue Abos oder Preiserhöhungen.

Dazu kommen Grafiken: der **Vermögensverlauf** der letzten sechs Monate mit gestrichelter Vorschau auf die nächsten 30 Tage, die **Ausgaben des Monats nach Kategorie** als Ring, **Einnahmen und Ausgaben** der letzten sechs Monate und je Girokonto eine kleine Linie bis zum Stichtag – der rote Punkt markiert den tiefsten Stand. Budgets und Sparziele zeigen ihren Fortschritt als Ring.
