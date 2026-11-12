# Paket6: verspätete Kuverts und Browsergeneration

Getrennter Zweig codex/paket6-kuvert-2026-11-11, Basis6478803. Keine Änderung am ursprünglichen94er-Gesamtlauf.

Fehlende Kuverts erhalten eigenen Marker. Standabgleich prüft ausschließlich markierte gerenderte Haupt-/Bezugsnachrichten dieses Geräts, in begrenzten500er-Requests/100er-Datenbankabfragen. Erstes Nachsehen lädt auch bei vorhandener Baseline; erst erfolgreicher Verlaufabruf bestätigt den Stand. Fingerabdruck berücksichtigt geheilte Antwort-/Zitatbezüge. App registriert Schlüssel nicht periodisch, sondern cached erfolgreiche Geräte-ID und wiederholt Fehler mit4–60sBackoff. Browsergeneration verhindert, dass alte Requests einen neu geöffneten selben Chat überschreiben. LegacyGET bleibt, zusätzlichePOST-Standroute validiert UUIDs/Zahl.

Nachweise:17/17 Offlinegegenproben auf integrierten Quellen, TypeScriptExit0, vorhandene Offlinegruppen9/9. Unabhängiger Kandidaten-Gegenreview hat zuvor Startfenster,Bezugsfingerabdruck,1000PendingIDs und Nullschlüssel entdeckt; diese Fälle sind jetzt regressionsgeprüft. Echte Datenbank-/RLS-/Browser-/Nativeabnahme noch offen. Gesamtlauf94 auf6478803 war3254/3257 mit5roten Läufen undRest0; kein finaler grüner Gesamtnachweis.

Frische Nachproben: Gesten9/9, Kasten8 6/6, Kommentare9/9 jeweilsExit0/keineKonsolenfehler undnachfolgend geprüfteMitteilungenRest0. LiveKuvertprobe produktBrowser/RLS beendetExit0, genaueAnzahl im Protokoll live-kuvert-12-11.log. Erstversuch wegen verdecktemURL-Konstruktor im Test abgebrochen (26/27,Rest0), Prüfschrift korrigiert und wiederholt. API für ungültigeKuvertlisten liefert jetzt eindeutig400 mit festerFehlermeldung; keine generischen500 alsValidierungsnachweis. Expo-Konfigurationsordnerfreigabe perHandy ohneAntwort; nativeAbnahme bleibt offen.
