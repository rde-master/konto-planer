# Benachrichtigungen

Konto Planer meldet sich, wenn etwas zu tun ist – per E-Mail, über Home Assistant, über Pushover oder als Mitteilung der Web-App.

## Kanäle einrichten (Admin)

Unter **Einstellungen › Benachrichtigungen** trägt der Admin den E-Mail-Server (SMTP) und die Verbindung zu Home Assistant ein; beides lässt sich testen. Passwörter und Tokens werden verschlüsselt gespeichert.

### Pushover

Pushover (pushover.net) bringt die Meldungen als Push-Mitteilung in die Pushover-App auf iPhone, Android oder den Desktop. So richtest du es ein:

1. Der Admin meldet sich auf pushover.net an, legt dort eine Anwendung an („Create an Application/API Token“) und trägt deren **API-Token** unter **Einstellungen › Benachrichtigungen** im Abschnitt Pushover ein.
2. Jeder Benutzer trägt unter **Einstellungen › Meine Benachrichtigungen** seinen **Benutzerschlüssel** ein (in der Pushover-App und auf pushover.net als „Your User Key“). Mit dem Schlüssel einer Pushover-Gruppe gehen die Meldungen an alle in der Gruppe.
3. Der Admin schaltet bei den gewünschten Meldungen **Über Pushover** ein.

**Pushover-Test an mich** schickt eine Testnachricht; ein falsches Token oder ein unbekannter Schlüssel wird dabei gemeldet. Token und Schlüssel werden verschlüsselt gespeichert und nicht wieder angezeigt – zum Ändern einfach neu eintragen.

Die Meldung enthält einen Link zur passenden Seite, wenn die App ihre Adresse kennt (`ORIGIN`). Pushover ist ein Dienst eines anderen Anbieters: Titel und Text der Meldungen laufen über dessen Server.

## Meldungen

Je Meldung legt der Admin fest, ob sie aktiv ist, über welche Kanäle sie geht, wer sie bekommt und ob sie täglich wiederholt wird, bis sie erledigt ist:

- Kündigungsfrist endet bald
- Mindestbestand unterschritten, Dispo erreicht, Dispo könnte nicht reichen
- Erwartete Zahlung ausgeblieben (nach einstellbarer Toleranz)
- Manuelle Überweisung fällig (mit Vorlauf in Bankarbeitstagen)
- Sparvorschlag am Gehaltstag
- Kreditrahmen der Kreditkarte reicht nicht
- Dauerposten wird teurer, neue regelmäßige Abbuchung im Import
- Import-Erinnerung am 30. (im Februar am Monatsletzten)

Gesendet wird ab 8 Uhr.

## Meine Benachrichtigungen

Unter **Einstellungen › Meine Benachrichtigungen** wählt jeder selbst:

- seine **Home-Assistant-Geräte** (z. B. die Home-Assistant-App auf dem Handy)
- seinen **Pushover-Benutzerschlüssel**
- **Push auf diesem Gerät**: auf dem iPhone nur in der App vom Home-Bildschirm (ab iOS 16.4)
- den **Monatsbericht per E-Mail** am 1. eines Monats

## Erinnerung an Überweisungen

Dauerposten mit Zahlart „manuell“ erscheinen rechtzeitig unter **Zu überweisen** auf der Übersicht. Nach dem Überweisen **Überwiesen** tippen – oder der nächste Import erledigt das.
