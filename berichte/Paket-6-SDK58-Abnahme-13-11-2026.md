# Paket 6 – SDK-58-Abnahme am 13.11.2026

## Ergebnis

Produktstand **bb5963c**, eigener Zweig `codex/paket6-kuvert-2026-11-11`: vollständiger Gesamtlauf **3287/3287 Prüfungen bei 97/97 Läufen, Exit 0**. Alle 97 Läufe enthalten zählbare Prüfungen. Quellen unverändert. Bereinigung erfolgreich: 512 Testmitteilungen entfernt, **Rest 0**. Eigener Server beendet; Testbestand und port-3300 danach freigegeben.

Native Abnahme anschließend im eigenen Simulator **All-Media Codex**, UDID `5210E675-C198-4328-B3E2-30FCE9E0F624`, iOS26.5, **Expo Go58.0.7**. Das vorhandene Simulatorwerkzeug ersetzte57.0.9 automatisch. Native Komponentenprüfung **11/11 UI und 11/11 Backend**, danach normale Produkt-App mit echten Anmeldungen, gespeichertem Kontowechsel, SecureStore-Neustart und verspätetem Kuvert nachgewiesen. Produktcode unverändert; einzige Änderung unter app/web/gemeinsam seit bb5963c: eindeutige Auswahl des modalen Zurück im nativen Python-Prüftreiber.

**Keine Abnahmepunkte dieses Auftrags offen.** Die drei mittleren Expo-internen minimatch-Auditbefunde bleiben auf Henriks ausdrückliche Anweisung bestehen. Kein main, Push, Deploy oder Schemaeingriff. Gerätesitzungen wurden ausschließlich im eigenen Simulator geprüft.

## Gesamtläufe und rote Einzelwiederholung

Erster vollständiger Lauf `6b234b1c-e69e-483e-a6f0-234fb0dff428`: **3283/3287, 97/97**, Exit1, einzig Explorer17/21. Alle übrigen96 Läufe grün. Die bedingte Warnzeile „Ohne zählbare Prüfungen“ erscheint nicht; zusätzlich im Status alle97 Prüfzahlen als vorhanden und größer0 geprüft. Quellen unverändert,512 Mitteilungen entfernt,Rest0,Server beendet,beide Freigaben Exit0. Belege: `live-alles-sdk58-6b234b1c-vollstaendig.log`, `sdk58-6b234b1c-vollstatus.json`, `sdk58-terminal-gesamt-13-11.json`.

Vor jeder Codeverdächtigung unveränderte Einzelwiederholung Explorer: **21/21**, Exit0, keine Konsolenfehler. Vor-/Nachbereinigung erfolgreich, Server beendet, beide Freigaben Exit0. Kein Produktpatch daraus. Belege: `live-_explorer.log`, `sdk58-terminal-explorer-13-11.json`.

Vollständige Bestätigung `f117d6fb-083e-4273-9a7e-5a137c028e49`: **3287/3287, 97/97**, Exit0. „Ohne zählbare Prüfungen“ ebenfalls keine Einträge; Quellen identisch,512 entfernt,Rest0,beide Freigaben Exit0. Belege: `live-alles-sdk58-f117d6fb-gruen.log`, `sdk58-f117d6fb-vollstatus.json`, `sdk58-terminal-gesamt-bestaetigung-13-11.json`. `live-alles.log` enthält zusammengefügte Rohprotokolle und darf nicht als eine doppelt gezählte Abnahme gelesen werden; die getrennten Laufdateien und Status-IDs sind maßgeblich. Belegcommit894a950.

Vorherige abgebrochene SDK-58-Läufe und überlappende Einzelstarts bleiben getrennte historische Diagnosebelege und zählen nicht zur Abnahme. Der unabhängige Terminalkontext wurde zuvor mit Glocke21/21 einschließlich tatsächlichem Codex-Neustart und sauberer Bereinigung geprüft.

## Native Komponenten mit echtem Backend

Erster nativer Teillauf: Expo-Einführung und mehrdeutiger Zurück stoppten die Bedienautomation; später45-Minuten-Zeitlimit, geprüfte Bereinigung Rest0. Nach angeordneter Pause vollständige Wiederholung im unabhängigen Terminal. Prüfbedienung wählt den tatsächlich sichtbaren GenericElement-Zurück im Modal statt des verdeckten Bildschirm-Zurück. Diese nachweislich verwendete Auswahl anschließend in `app/test/_paket6_native_live.py` übernommen; Belegcommit6f5c517.

**11/11 UI und 11/11 Backend**, beide Exit0, Rest0, Prozesse beendet. Belegt: getrennte native SecureStore-Geräte je Konto, Browser↔Native beidseitig, Entwurf bleibt bei Verschlüsselungsfehler ohne zusätzliche Zeile, Sicherheitsnummer über alle realen Geräte einschließlich Zusatzgerät, Warnung bei unregistriertem Absender, A/B/A, tatsächlicher Expo-Go-Prozessneustart mit denselben Geräteschlüsseln. Datenbank enthält ausschließlich Chiffren ohne Klartext. Eigene Chat-/Nachrichten-/Kuvert-/Geräte-/Kontaktfixtures beseitigt.

Belege: `sdk58-native2-terminal.json`, `sdk58-native2-bedienung.log`, `sdk58-native2-bruecke.log`, `native-live-fixtures.json`, `native-live-*.png`. Neustart, Sendesperre, Absenderwarnung und Sicherheitsnummer visuell geprüft. Dieser Prüfstand ersetzt Rahmenkontexte; er allein belegt keinen Produkt-Login.

## Normale Produkt-App ohne ersetzte Kontexte

Metro anschließend aus normalem `app/` gestartet; Zugangskonfiguration im Prozess ausschließlich aus EXPO_PUBLIC-Werten. Kein Harness-Netzfilter und kein Harness-SecureStore-Präfix. Beide vorhandenen Testkonten über echte Produktoberfläche angemeldet. Tastatur des eigenen Simulators für HID-Eingabe von Deutsch/Automatisch auf ABC umgestellt; keine Änderung an Henriks Mac-Tastatur. Geheimnisse nur zur Eingabe im RAM, nicht in Belegen oder Repository.

**11 dokumentierte UI-Beobachtungen und 3/3 Backendprüfungen**:

- Beide Konten lesen die Website-Chiffren im echten Community-Zweierchat und senden jeweils eine im echten Browser lesbare Antwort.
- Echte Kontoliste: A→B→A ohne erneute Passwortabfrage; Identität in den Einstellungen jeweils über die Testkonto-Mail bestätigt.
- Nachricht zunächst ohne Kuvert eingefügt: im weiter geöffneten Chat „Auf diesem Gerät nicht lesbar“. Kuverts derselben Nachrichten-ID anschließend ergänzt: derselbe Chat zeigt „Produkt Kuvert nachgeliefert“, ohne Navigation oder Neuladen dazwischen.
- Expo Go tatsächlich beendet und neu gestartet. Konto A bleibt angemeldet, bestehende Chiffren einschließlich nachgeliefertem Kuvert lesbar. Gespeichertes Konto B danach ohne Passwort nutzbar und dessen alte Chiffren ebenfalls lesbar. Beide nativen Geräteschlüssel-IDs vor/nach Neustart und Kontowechsel identisch.
- Backend bestätigt beide nativen Antworten im echten Browser und alle fünf Nachrichtenzeilen als Chiffren ohne Klartext. Eigene App beendet, danach Fixturebereinigung Rest0; Server/Metro beendet, eigener Simulator ausgeschaltet.

Belege: `sdk58-produkt-ui.json`, `sdk58-produkt-vor-neustart.json`, `sdk58-produkt-nach-neustart.json`, `sdk58-produkt-nach-kontowechsel.json`, `sdk58-produkt-spaet.json`, `sdk58-produkt-browser.json`, `sdk58-produkt-abschluss.json`, `produkt-live-fixtures.json`, `sdk58-produkt-fixture.log`, `sdk58-produkt-terminal.json`, `produkt-*.png`. Bilder fehlendes/nachgeliefertes Kuvert, Chiffren nach Neustart und gespeichertes Konto B visuell geprüft.

Abschließend unter erneuter eigener Belegung sechs übrig gebliebene Testmitteilungen entfernt, **Rest0**, Belegung wieder freigegeben. Eigene Ports3300/3301/3302 leer, alle vier Belegungen frei. Beleg `sdk58-abschluss-bereinigung.log`. Kein laufender Prüfprozess verbleibt.
