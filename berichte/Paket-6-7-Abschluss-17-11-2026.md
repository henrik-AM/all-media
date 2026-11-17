# Gemeinsamer Abschluss Paket 6 und 7 — 17.11.2026

Status: Abnahme läuft. Noch nicht veröffentlicht.

## Ergebnis und Umfang

Paket 7 umfasst private Chat-/Kuvertklingeln, frische Listen und kontogetrennte,
serielle Stummschaltungswünsche. Die einmal von Henrik verlangte echte
Claude-Prüfung wurde ausgeführt; ihre Frischelücke anschließend korrigiert.
Paket 6 ist nach Henriks ausdrücklicher Erweiterung enthalten: Format 2 bindet
Chiffre und Kuvert an Chat, Absender, Zeitpunkt sowie Antwort-/Zitatbezug.
Historisches Format 1 bleibt lesbar und wird als Altbestand gekennzeichnet.
Schema 127 wurde nach einer verworfenen RLS-Probe einmal live eingespielt.

Weitere in der gemeinsamen Abnahme gefundene Korrekturen:

- Uhrzeitabweichung beim Senden erhält Entwurf und verständliche Fehlermeldung.
- Kontakt-Erstnachrichten werden erst für den endgültigen Messenger-Chat
  verschlüsselt. Fehler erlauben Wiederholung ohne doppelte Kontaktanlage.
- Die erste private Anfrage bleibt auf den leeren, eigenen Zweierchat begrenzt;
  Folge-Senden erfordert Annahme. Datenbankrechte wurden hierfür nicht erweitert.
- Kontaktinfo lädt voneinander unabhängige Daten parallel.
- Verspätete Anhangantworten verändern nach Konto-/Chatwechsel weder den
  fremden Verlauf noch dessen Antwortbezug.

## Direkte Abnahmen

| Nachweis | Ergebnis | Grenze |
| --- | --- | --- |
| Tatsächliche native Daten-/Profilprovider | 18/18 | Simulator, Testkonten |
| Native Chatkomponenten im Format-2-Rundlauf | 18/18 | Komponentenrahmen, keine zwei physischen Geräte |
| Plattform-/Backend-Rundlauf | 14/14 | Testkonten, aufgeräumt |
| Paket-6-Liveprüfung | 40/40 | RLS und echte Testidentitäten |
| Browserfunktionen und tatsächliche Serverrouten | 38/38 | Zustandsabhängige Datenattrappe |
| Kontaktanlage, Fehlermaske, Wiederholung und Annahme | 10/10 | Zwei echte Testkonten, Profil wiederhergestellt |
| Sicherheitsnummern beider Konten | 6/6 | Zusätzlich zwei unveränderte SecureStore-Schlüssel nach Neustart |
| Neue Anhang-Rückkehrgegenproben | 3/3 | Originalfunktion; vorher 0/3 |
| Paket-7-Regressionsdatei nach Rückkehrkorrektur | 17/17 | Offline, einschließlich Listen-/Auth-Rennen |

Die zugrunde liegenden Belege liegen unter `pruefbelege/paket67-abschluss/`,
`paket67-chat-final/`, `paket67-p6/` und den im
chronologischen Bericht genannten ursprünglichen Belegordnern.
Die geschützte Testnummer aus dem echten Fehlerbild bleibt ausschließlich
im privaten Roharchiv außerhalb des Repositorys.

## Vollständiger Bestand und Veröffentlichung

Vollnachweis `abc3d0a7-cefb-426b-affa-ffd1c79ae741` läuft auf eingefrorenen
Quellen von `1e05d61`. Erstellen wurde nach 15 Minuten abgebrochen (18/19).
Kontaktinfo bestand fachlich 10/10, endete wegen ausdrücklich gemeldetem
`ERR_NETWORK_IO_SUSPENDED` mit Code 1. Der frühere Backend-Diagnoserahmen
beobachtete außerdem mehrere über 20 Minuten hängende HTTP-Aufrufe.
Diese Fehler werden nicht als grüner Gesamtlauf ausgewiesen. Gesten bestanden fachlich 9/9, meldeten aber HTTP 500 beim Reset. Kasten 8
bestand 6/6 mit zusätzlichem HTTP 500. Explorer bestand 20/21 (Zeitfortschritt
der Hörprobe), Kamera 6/10 (Musik noch nicht gespeichert, anschließend drei
blockierte Klicks). Übernacht brach nach 1/1 beim nächsten page.evaluate ab.
Endauswertung, gezielte unveränderte Wiederholungen sowie Quellen- und
Bereinigungsnachweise folgen.

main, origin/main und Render verbleiben bis zur Abnahme auf `627fa86`.
Push und Veröffentlichung sind durch Henriks Auftrag bereits autorisiert.

## Bewusste Grenzen

Pakete 8–9 und die zurückgestellte Einstellungsfeedbackrunde bleiben unbegonnen.
Drei akzeptierte mittlere Expo-Auditbefunde bleiben bestehen. Bestehende Nutzer-
und Claude-Prozesse beziehungsweise fremde Arbeitskopien werden nicht bereinigt.
Nach Veröffentlichung müssen Website beziehungsweise Expo Go den neuen Client
laden, damit neue Sendungen Format 2 verwenden.
