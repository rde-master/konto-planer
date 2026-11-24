# CLAUDE.md – Regeln für Claude Code

Konto Planer: Web-App, die je Girokonto den Mindestbestand bis zum nächsten Gehaltseingang und den frei verfügbaren Betrag zeigt.
Der vollständige, verbindliche Plan steht in [docs/PLAN.md](docs/PLAN.md). Bei Widerspruch gilt der Plan; Abweichungen nur nach Rückfrage.

## Arbeitsweise

- Selbstständig arbeiten bis zum Pull Request. **Nie direkt auf `main` committen oder pushen; nie selbst mergen.** Der Merge erfolgt nur durch den Repo-Besitzer.
- Eine Funktion = ein Feature-Branch = ein Pull Request, in der Reihenfolge des Releaseplans (docs/PLAN.md, Abschnitt „Releaseplan“).
- Branch-Namen: `feat/0.x-kurzname`, `fix/kurzname`.
- Im Repo ist nur Squash-Merge erlaubt: **der PR-Titel wird zur Commit-Nachricht auf `main`** und muss daher selbst ein Conventional Commit sein (z. B. `feat: foundation with login and PWA`).
- Commits nach Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`). `feat:` erzeugt beim Merge die nächste Unterversion 0.x.0, `fix:` die 0.x.1. Kein `BREAKING CHANGE` vor 1.0.0.
- **Release-Ablauf (Version im PR):** Jeder `feat`/`fix`-PR erhöht selbst die Version in `package.json` und ergänzt `CHANGELOG.md` um `## [x.y.z] – Titel` (deutsch, für Benutzer geschrieben). Die CI prüft das mit `scripts/check-pr.mjs`. Nach dem Merge erzeugt `release.yml` Tag, GitHub-Release und Docker-Image (`:x.y.z`, `:x.y`, `:latest`).
- Schemaänderungen: `src/lib/server/db/schema.ts` anpassen, dann `pnpm db:generate --name <name>`; die Migration wird mit eingecheckt. Vor jeder Migration sichert die App per `pg_dump` (`src/lib/server/backup.ts`). `scripts/upgrade-test.sh <altes-image> <neues-image>` prüft den Update-Weg (läuft in der CI gegen das letzte Release; lokal mit `TMPDIR` im Scratchpad).
- Vor jedem PR lokal: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, bei UI-Änderungen `pnpm test:e2e`.
- Abnahme je Version: läuft im Docker-Stack, am Handy-Format bedienbar, Rechenlogik durch Vitest-Tests abgedeckt.
- Unklare fachliche Fragen stellen statt raten.

## Technik

- TypeScript durchgängig, SvelteKit + Tailwind, PWA. PostgreSQL über Drizzle; Migrationen laufen beim App-Start.
- Node 24 LTS, Paketmanager **pnpm**. SvelteKit **3**: Konfiguration in `vite.config.ts`, Umgebungsvariablen über `src/env.ts` und `$app/env/private`, Hooks-Typen aus `@sveltejs/kit/hooks`, Service Worker in `src/service-worker/` mit eigener tsconfig.
- Importe aus `src/lib` über `#lib/...` **mit Endung** (`#lib/server/auth.js`, `#lib/components/Page.svelte`).
- Links über `resolve()` aus `$app/paths` mit typisierten Pfaden ohne führenden Schrägstrich (`resolve('konten')`).
- Formulare: klassische Form Actions mit `use:enhance`; Felder mit `formString()` aus `#lib/server/validation.js` lesen.
- Beträge immer als **ganze Cent (integer)**, nie als Float. Nur Euro.
- Zeitzone fest `Europe/Berlin`. Bankarbeitstage nach TARGET-Kalender.
- Grafiken mit Apache ECharts. Tests: Vitest (Logik), Playwright (Handy-Viewport).
- Code, Bezeichner und Commit-Nachrichten auf Englisch; Oberfläche und Dokumentation für Benutzer auf Deutsch.

## Design

iOS-Stil (Liquid Glass): schwebende Tab-Leiste am Handy, Seitenleiste am Desktop, große Titel, Blätter von unten, gruppierte Listen, iOS-Blau als Akzent, Hell/Dunkel nach System und umschaltbar. `prefers-reduced-transparency`, `prefers-contrast`, `prefers-reduced-motion` beachten.
**Keine Apple-Schrift- oder Symboldateien ins Repo** – Systemschrift (`-apple-system, system-ui`) und ein frei lizenziertes Symbolset verwenden.

## Fachliche Entscheidungen (ergänzen den Plan)

- **Startsaldo mit Datum** („Stand am“): Kontostand = Startsaldo + Buchungen **ab** diesem Datum. Ältere Buchungen werden gespeichert, zählen aber nicht zum Stand.
- **Kontozugriff:** „sehen“ = nur lesen. „bearbeiten“ = Inhalte (Buchungen, Dauerposten, Import) **und** Kontodaten (Name, IBAN, Dispo, Startsaldo, Farbe). Konten anlegen, archivieren, wiederherstellen, löschen und Zugriffe vergeben: nur Admin. Admin sieht und bearbeitet alle Konten.
- Konten ohne Zugriff liefern **404** (nicht 403), damit ihre Existenz nicht erkennbar ist.
- Archivierte Konten sind schreibgeschützt, bis der Admin sie wiederherstellt. Löschen nur, solange keine abhängigen Daten existieren (`accountHasData()` in `src/lib/server/accounts.ts` – neue Tabellen mit Kontobezug dort ergänzen).
- Konten haben eine Farbe aus den iOS-Systemfarben (`src/lib/colors.ts`).
- **Kategorien:** global, genau eine Ebene (Haupt- und Unterkategorie). Nur Hauptkategorien haben eine Farbe, Unterkategorien erben sie. Anlegen/ändern darf jeder Benutzer, löschen nur der Admin. Löschen einer Hauptkategorie löscht ihre Unterkategorien mit. Neue Fremdschlüssel auf `categories` immer mit `ON DELETE SET NULL` (Buchungen bleiben, gelten als unkategorisiert).
- **Dauerposten:** nur auf Girokonten (Sparbücher bekommen Eingänge per Umbuchung). Bezeichnung (Pflicht) plus optionaler Empfänger/Zahler für den Import. Beträge positiv in `recurring_amounts` mit „gültig ab“ (Zukunft erlaubt); Vorzeichen ergibt sich aus der Art. Intervall „frei“ = alle N Tage/Wochen/Monate. Fehlt der Tag im Monat, gilt der Monatsletzte; Fälligkeiten werden immer vom Start aus berechnet (`src/lib/recurring.ts`). Löschen nur ohne Buchungen (`recurringHasData()` ergänzen), sonst archivieren.
- **Buchungen:** Tabelle `bookings`, Betrag vorzeichenbehaftet (negativ = Ausgabe), Quelle `manual`/`import`/`adjustment`. Manuell buchen nur auf aktive Girokonten mit „bearbeiten“, Datum nicht in der Zukunft; voll änderbar sind nur manuelle Buchungen. Schnellerfassung (`QuickEntry.svelte`, Optionen aus `(app)/+layout.server.ts`) postet an `buchungen?/create` ohne Datumsfeld (= heute). Geschlossene Blätter bleiben im DOM: in E2E-Tests Felder über `main` oder den Dialog eingrenzen.
- **Fälligkeiten (vorläufig gebucht):** Bankarbeitstage nach TARGET (`src/lib/bank-calendar.ts`). Tabelle `due_items` (eine Zeile je erreichter Fälligkeit, Status `provisional`/`skipped`/`booked`) mit Buchungen `source = 'provisional'` (bei Umbuchungen zwei: `bookingId`, `targetBookingId`). `syncDues()` in `src/lib/server/due.ts` gleicht ab (Logik `reconcileDues()` in `src/lib/due.ts`): ab max(Start, frühestes Startsaldo-Datum der Konten) bis heute; läuft beim Start, stündlich und nach jeder Änderung an Dauerposten oder Konten (neue Schreibpfade dort ergänzen). Von Hand verschobene/angepasste (`moved`, `amountSet`) bleiben. Künftige Fälligkeiten werden berechnet (`duesBetween()`, `openPayments()`), nicht gespeichert. Vorläufige Buchungen sind keine „Daten“ im Sinne von `recurringHasData()`.
- **Mindestbestand:** Logik in `src/lib/minimum.ts` (`resolveCutoff()`, `minimumPlan()`), Daten in `plansFor()` (`src/lib/server/minimum.ts`). Nur aktive Girokonten. Ereignisse nach heute bis einschließlich Stichtag (offene Fälligkeiten + Buchungen mit Datum in der Zukunft); je Tag erst Ausgänge, dann Eingänge. Mindestbestand = tiefster Rückgang gegenüber heute (≥ 0), verfügbar = Stand − Mindestbestand; Dispo zählt nie. Stichtag je Konto (`cutoff_mode` salary/month_end/date, `cutoff_recurring_id`, `cutoff_date`); ohne Gehalt bzw. bei vergangenem Datum gilt Monatsende. Neue Zu-/Abflüsse (z. B. einmalige Zahlungen, Puffer) dort einrechnen.
- **Kontostand:** `balanceOn()` in `src/lib/balance.ts`, serverseitig `balancesOf()`/`balanceOf()` in `bookings.ts` (Startsaldo + Buchungen von `openingDate` bis heute). „Kontostand korrigieren“ (`adjustBalance()`) bucht die Differenz als `adjustment` an einem Tag zwischen Startsaldo-Datum und heute, auf jedem aktiven Konto mit „bearbeiten“; Anpassungen sind nicht änderbar, nur löschbar (`canDelete`).
- **Vorlagen (Schnellerfassung):** Tabelle `booking_templates`, `owner_id` null = für alle. Eigene: nur der Besitzer. Gemeinsame: jeder sieht und ändert, löschen und wieder privat machen nur der Admin (`template-rules.ts`). Betrag (positiv) und Konto optional; Konto/Kategorie mit `ON DELETE SET NULL`, blockieren also kein Löschen. In der Schnellerfassung zählt das Konto nur, wenn der Benutzer darauf buchen darf (`quickTemplates()`).
- **Pause:** genau eine Pause je Dauerposten (`pause_from`, `pause_until` optional = bis auf Weiteres), beide Tage inklusive. `dueDates()` überspringt Fälligkeiten in der Pause, der Rhythmus läuft vom Start weiter. „Pause beenden“ setzt eine begonnene Pause auf gestern, eine künftige wird gelöscht. Pausierte Posten zählen nicht zu den Monatssummen.
- **Umbuchungen:** Dauerposten der Art `transfer` mit `targetAccountId`. Quelle: Giro oder Sparbuch mit Recht „bearbeiten“; Ziel: jedes aktive Konto (nur der Name ist sichtbar). Keine Kategorie und keine Empfängerdaten; Zahlart nur Dauerauftrag oder manuell. Sichtbar für Betrachter von Quell- **oder** Zielkonto; Wirkung je Konto über `effectOn()`. Ändern: Bearbeiter des Quellkontos, Anleger und Admin. Die Art lässt sich nicht zwischen Umbuchung und Ausgabe/Einnahme wechseln.
- **Vertragsdaten:** nur bei Ausgaben, Tabelle `contracts` (1:1 am Dauerposten). Verlängerung `indefinite` (nach Mindestlaufzeit jederzeit mit Frist), `period` (um N Monate, gezählt ab dem ursprünglichen Laufzeitende) oder `none`. Kündigungsfrist wird vom Vertragsende zurückgerechnet (Monatsletzter bei fehlendem Tag). „Gekündigt am“ setzt bei Änderung das Ende des Dauerpostens auf das berechnete Vertragsende (`endDateAfterSave()` in `src/lib/contracts.ts`). Standard-Vorlauf in `app_settings` (eine Zeile, `src/lib/server/settings.ts`).
- **Vertragsdetails:** Kundennummer und Notiz an allen Dauerposten, Kündigungsadresse (Einzelfelder) nur am Vertrag. PDF-Anhänge in `recurring_attachments`, Dateien unter `ATTACHMENT_DIR` (Image: `/app/data/attachments`) als `<id>.pdf`; Prüfung auf `%PDF-` und 10 MB (`attachment-rules.ts`), Upload-Limit `BODY_SIZE_LIMIT=12M`. Download nur über `dauerposten/[id]/anhang/[attachmentId]` mit Sichtprüfung (sonst 404). Beim Löschen eines Dauerpostens die Dateien nach der Transaktion entfernen.
- Beträge: Eingabe deutsch („1.234,56“), Speicherung ganze Cent (`src/lib/money.ts`).

## UI-Bausteine (`src/lib/components`)

`Page` (großer Titel, `back`, `actions`), `ListGroup`/`ListRow` (gruppierte Listen; `href`, `onclick`, `value`), `FormField` (Eingabe als Listenzeile), `SegmentedField` (Radio-Segmente, `initial`), `Sheet` (Blatt von unten, Bestätigen-Knopf sendet `formId`), `Button` (`filled`, `tinted`, `plain`, `destructive`), `ComingSoon`. Admin-Seiten mit `requireAdmin()` aus `#lib/server/guards.js` schützen.

## Daten und Sicherheit

- Öffentliches Repo (MIT). **Nur erfundene Testdaten.** Echte Bankexporte (`*.csv` außerhalb von `tests/fixtures/`), `.env` und Zugangsdaten nie einchecken.
- Tokens nur als Hash speichern; SMTP- und Home-Assistant-Zugangsdaten verschlüsselt.
- **Protokoll:** Jede Anlage, Änderung und Löschung schreibt mit `audit(tx, …)` aus `#lib/server/audit.js` in **derselben Transaktion** einen Eintrag; bei Änderungen nur die geänderten Felder (`diff()` aus `audit-rules.ts`). Neue Bereiche/Aktionen und Feldnamen in `src/lib/audit.ts` ergänzen (deutsche Bezeichnungen). Passwörter, Hashes, Tokens filtert `sanitize()` heraus – trotzdem nie absichtlich übergeben.

## Lokale Entwicklung

- Docker und Docker Compose sind installiert; Dev-Datenbank mit `pnpm db:up` (Postgres 17, `docker-compose.dev.yml`). E2E-Tests nutzen die Datenbank `kontoplaner_e2e`, die bei jedem Lauf neu angelegt wird.
- GitHub-Zugriff über `gh` (Konto rde-master), Repo `rde-master/konto-planer`. `main` ist geschützt: nur per PR, linearer Verlauf, kein Force-Push.
