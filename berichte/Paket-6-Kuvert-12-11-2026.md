# Paket6: verspätete Kuverts und Browsergeneration

Getrennter Zweig codex/paket6-kuvert-2026-11-11, Basis6478803. Keine Änderung am ursprünglichen94er-Gesamtlauf.

Fehlende Kuverts erhalten eigenen Marker. Standabgleich prüft ausschließlich markierte gerenderte Haupt-/Bezugsnachrichten dieses Geräts, in begrenzten500er-Requests/100er-Datenbankabfragen. Erstes Nachsehen lädt auch bei vorhandener Baseline; erst erfolgreicher Verlaufabruf bestätigt den Stand. Fingerabdruck berücksichtigt geheilte Antwort-/Zitatbezüge. App registriert Schlüssel nicht periodisch, sondern cached erfolgreiche Geräte-ID und wiederholt Fehler mit4–60sBackoff. Browsergeneration verhindert, dass alte Requests einen neu geöffneten selben Chat überschreiben. LegacyGET bleibt, zusätzlichePOST-Standroute validiert UUIDs/Zahl.

Nachweise:17/17 Offlinegegenproben auf integrierten Quellen, TypeScriptExit0, vorhandene Offlinegruppen9/9. Unabhängiger Kandidaten-Gegenreview hat zuvor Startfenster,Bezugsfingerabdruck,1000PendingIDs und Nullschlüssel entdeckt; diese Fälle sind jetzt regressionsgeprüft. Echte Datenbank-/RLS-/Browser-/Nativeabnahme noch offen. Gesamtlauf94 auf6478803 war3254/3257 mit5roten Läufen undRest0; kein finaler grüner Gesamtnachweis.

Frische Nachproben: Gesten9/9, Kasten8 6/6, Kommentare9/9 jeweilsExit0/keineKonsolenfehler undnachfolgend geprüfteMitteilungenRest0. LiveKuvertprobe produktBrowser/RLS beendetExit0, genaueAnzahl im Protokoll live-kuvert-12-11.log. Erstversuch wegen verdecktemURL-Konstruktor im Test abgebrochen (26/27,Rest0), Prüfschrift korrigiert und wiederholt. API für ungültigeKuvertlisten liefert jetzt eindeutig400 mit festerFehlermeldung; keine generischen500 alsValidierungsnachweis. Expo-Konfigurationsordnerfreigabe perHandy ohneAntwort; nativeAbnahme bleibt offen.

## Gezielte Abnahme vor abschließendem Gesamtlauf

- Echte Zwei-Konten-Liveprobe einschließlich Kuvertnachlieferung: **38/38**, Rest **0**; Screenshot der automatisch geheilten Nachricht angesehen. Protokoll: `pruefbelege/paket-6/live-kuvert-12-11.log`. App-Datenmodul nutzt echten Supabase-Client/RLS; Browser benutzt echte Produktoberfläche. Native Komponenten sind dadurch nicht abgenommen.
- Fünf zuvor rote Läufe isoliert nachgeprüft: Feedback **53/53**, Kasten8 **6/6**, Gesten **9/9**, Kommentare **9/9**, Farbfilter **16/16**, jeweils Prozessstatus0 und nachgezählte Testmitteilungen Rest0. Farbfilter erster Nachlauf noch15/16 wegen weiterer fester400ms-Pause; Originalbeleg separat erhalten. Jetzt beide Umschaltantworten und tatsächlicher UI-Abschluss sowie alle vier Resetantworten und Serverwerte geprüft. Fehler werden weiterhin gezählt.
- Zusätzlicher Guard auch für initiales `openChat()`: alte Verlauf-/DM-Antworten und Sperrbestätigung dürfen neu geöffnete gleiche Chat-ID nicht überschreiben. Vier neue Gegenproben; insgesamt **21/21** Kuvert-/Generations-/Öffnungsregressionen.
- Vorhandene Offlinegruppen zuletzt **9/9**, Typprüfung Exit0. AST-Graph lokal aktualisiert. Inventar enthält **97** Läufe; kompletter neuer Lauf steht jetzt an. Der alte94er-Lauf bleibt ausdrücklich rot.

Weiter offen: vollständige Native-/Neustart-/Kontowechselabnahme und verschlüsselte Nebenwege mit zwei Konten; Kontakt plus Anfangsnachricht ist noch kein atomarer Vorgang. Expo-Ordnerfreigabe ohne Antwort; diese native Vorbereitung deshalb nicht ausgeführt. Keine Schemaänderung, kein main/Push/Deploy.
