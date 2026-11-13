# Paket 6 – SDK-58-Abnahme am 13.11.2026

Geprüfter Produktstand: `bb5963c` auf `codex/paket6-kuvert-2026-11-11`. Keine Änderung am Produktcode, kein main, Push oder Deploy. Die drei mittleren Expo-internen Auditbefunde bleiben auf Henriks Anweisung unberührt.

## Vollständiger Lauf und angeordnete Einzelwiederholung

Laufkennung `6b234b1c-e69e-483e-a6f0-234fb0dff428`: **3283/3287 Prüfungen, 97/97 Läufe**, Exit 1. Einzig roter Lauf: Explorer **17/21**. Die übrigen 96 Läufe sind grün. Alle 97 Läufe enthalten zählbare Prüfungen; die bedingte Warnzeile „Ohne zählbare Prüfungen“ erscheint folglich nicht. Statusfelder zusätzlich geprüft: keine fehlende/Null-Prüfzahl, Quellen unverändert, Bereinigung erfolgreich. 512 Testmitteilungen entfernt, **Rest 0**. Eigener Server beendet; Testbestand und port-3300 jeweils erfolgreich freigegeben.

Belege: `pruefbelege/paket-6/live-alles-sdk58-6b234b1c-vollstaendig.log`, `sdk58-6b234b1c-vollstatus.json` sowie `sdk58-terminal-gesamt-13-11.json`. Dieser vollständige Lauf bleibt rot protokolliert.

Explorer wurde vor jeder Codeverdächtigung unverändert einzeln wiederholt: **21/21**, Exit 0, keine Konsolenfehler. Eigene Belegungen und Vor-/Nachbereinigung erfolgreich, Server beendet, beide Belegungen erneut freigegeben. Belege: `live-_explorer.log`, `sdk58-terminal-explorer-13-11.json`. Kein daraus abgeleiteter Produktpatch.

## Vollständige Bestätigung vor nativer Abnahme

Ohne Quelländerung weiterer vollständiger Lauf auf `bb5963c`: `f117d6fb-083e-4273-9a7e-5a137c028e49`, gestartet 13.11.2026 um 15:33 Uhr Europe/Berlin. Testbestand und port-3300 erneut selbst belegt, SUPABASE_TOKEN ausschließlich im Kindprozess, Vorbereinigung Exit 0. Abgeschlossen: **3287/3287 Prüfungen, 97/97 Läufe, Exit 0**. Alle 97 Läufe enthalten zählbare Prüfungen; keine Warnzeile „Ohne zählbare Prüfungen“. Quellen unverändert. 512 Testmitteilungen entfernt, **Rest 0**. Eigener Server beendet, Testbestand und port-3300 jeweils erfolgreich freigegeben. Belege: `live-alles-sdk58-f117d6fb-gruen.log`, `sdk58-f117d6fb-vollstatus.json`, `sdk58-terminal-gesamt-bestaetigung-13-11.json`. Native Abnahme anschließend.

Überwachung: `pruefbelege/paket-6/laufsteuerung/monitor-bestaetigung.py`. Terminal-Controller PID 32709, eigener Server PID 32794. Terminal-Kontext wurde vorher mit Glocke 21/21 einschließlich tatsächlichem Codex-Neustart und sauberem Abschluss geprüft. Frühere abgebrochene SDK-58-Läufe bleiben getrennt und zählen nicht als Abnahme.

## Noch offen

Native Abnahme nach abgeschlossenem grünem Gesamtlauf durchführen. Der vorhandene native Komponenten-Prüfstand ersetzt Konten-/Datenkontexte und belegt daher keinen echten App-Login. Echter App-Flow und verspätetes Kuvert sind getrennt nachzuweisen. Ergebnis, Bilder und Bereinigung anschließend dokumentieren und auf eigenem Zweig sichern.

## Native Komponentenabnahme

Eigener Simulator `All-Media Codex` (`5210E675-C198-4328-B3E2-30FCE9E0F624`), iOS26.5, Expo Go durch vorhandenes Werkzeug von57.0.9 auf58.0.7 ersetzt. Erster nativer Teillauf scheiterte an Expo-Einführung und mehrdeutigem Zurück; später45-Minuten-Zeitlimit, geprüfte Bereinigung Rest0. Keine Produktänderung daraus. Nach angeordneter Pause vollständige Wiederholung im unabhängigen Terminal: **11/11 UI-Prüfungen und 11/11 Backendprüfungen**, beide Exit0, Rest0, Prozesse beendet. Testbedienung wählt den modalen GenericElement-Zurück ausdrücklich statt des verdeckten Bildschirm-Zurück; dieselbe Anpassung anschließend in den Python-Prüftreiber übernommen.

Belegt: zwei echte SecureStore-Geräte, Browser→Native und Native→Browser für beide Testkonten, Entwurferhalt bei Verschlüsselungsfehler ohne zusätzliche Nachrichtenzeile, Sicherheitsnummer über alle realen Geräte und Änderung durch zusätzliches Gerät, Warnung bei unregistriertem Absenderschlüssel, A/B/A und tatsächlicher Expo-Go-Prozessneustart bei identischen Geräteschlüsseln. Ausschließlich Chiffren in der Datenbank, eigener Fixture-Grundstand wiederhergestellt. Bilder Neustart, Sendesperre, Absenderwarnung und Sicherheitsnummer visuell angesehen. Belege `sdk58-native2-terminal.json`, `sdk58-native2-bedienung.log`, `sdk58-native2-bruecke.log`, `native-live-fixtures.json` und `native-live-*.png`.

Abgrenzung: Original-Chat-/Kontaktbildschirme mit realem Supabase und SecureStore; Rahmenkontexte ersetzt. Echter Produkt-Login/Kontenspeicher und verspätetes Kuvert im offenen Produktchat sind damit noch nicht belegt.
