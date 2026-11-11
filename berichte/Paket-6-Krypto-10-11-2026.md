**Aktuell: Website-Entwurfserhalt korrigiert; Browserregression 26/26 OFFLINE, Altstand als Gegenprobe rot. Erster Gesamtlauf bewusst nach 3/80 beendet; Neustart nach Commit.**

**Aktueller Stand 20:02:** Live-Zwei-Konten 21/21; native Live-Komponenten 10/10 und Backend-Gegenprüfung 8/8, jeweils Rest 0. Bilder angesehen. Management-Zugang gefunden und lesend bestätigt. Exklusiver Gesamtlauf folgt.

**Fortsetzung Live 19:52:** Zwei Konten/App-Logik/echte Website **21/21**, bereinigter Rest **0**. Native Live-Komponentenabnahme in Vorbereitung; Gesamtlauf benötigt noch Management-Token.

# Paket 6: Verschlüsselung AR-04/05/08 — Vorbereitung

**Fortsetzung 10.11.: native Offline-Komponentenprüfung 6/6, Tipphelfer-Gegenproben 8/8. Bilder angesehen. Live-/Zwei-Konten-Abnahme und Gesamtlauf warten weiterhin auf Claudes exklusiv belegten Testbestand. Ein bewachter Start ist aktiv; keine Anmeldung vor eigener Belegung.**

Basis: main `0288a35` am 10.11.2026. Zweig: `codex/paket-6-krypto-2026-11-10`.
Worktree: `~/allmedia-wt-codex/paket-6`.

## Ergebnis: lokal vorbereitet, nicht zur Live-Abnahme erklärt

- **Vier Krypto-Läufe: 88/88** (36/36 Rechenschicht, 18/18 App, 16/16 Browser-VM, 18/18 Server).
- **Zusätzliche Regressionstestfälle: 22/22.** Dieselben Fälle am übertragenen Stand vor Zusatzkorrekturen (`b522bac`): **2/22 grün, 20/22 rot**, erwarteter Exit 1. Der neue Seitenhelfer wird bei dieser Altstand-Gegenprobe aus dem aktuellen Stand bereitgestellt, weil er damals fehlt; seine Aufrufer werden gegen den alten App-/Servercode geprüft. Das sind Testfälle, keine Zählung von Sicherheitslücken.
- **Chromium-Komponentenprüfung: 16/16**, echte Website-Routen und unveränderte Website-Funktionen im kleinen Prüfrahmen, Tabellen und Konten simuliert. Sendeknopf, Entwurf nach Abweisung, echte Blase mit Absenderwarnung, Nummer bei zweitem zeitlich alten Gerät, Schloss aus bei drittem Mitglied, Teilen-, Anhang- und Storyroute geprüft. Bilder `browser-sendesperre.png` und `browser-absenderwarnung.png` angesehen.
- **Meldebelege 105/105**, Dateischema sieben Prüfgruppen grün; TypeScript Exit 0; Syntax acht Dateien 8/8. Kein Live-Datenbankschema geprüft oder geändert.
- Reproduzierbare reine Offline-Abnahme: `cd app && npm run test:paket6-vorbereitung` (9/9 Prüfgruppen). Browser separat: `npm run test:paket6-browser-offline`, vorher eigenen freien Port 3300 belegen. Reine Node-Läufe blockieren Netzwerk; Browser startet mit Konten-/Datenbankattrappen und sperrt fremde Herkunft. Kein `server/lokal.js`, keine `.env`, keine Supabase-Anmeldung.
- Prüflogs und Bilder liegen unter `pruefbelege/paket-6/`. AST-Graph mit `graphify update .` lokal aktualisiert, ohne LLM.
- main am Abschluss weiterhin `0288a35`, Hauptworktree unverändert. Eigener Prüfport 3300 ist beendet/freigegeben. Kein Merge, Push oder Deploy.

## Abgrenzung und Abgleich

- KI-Abgleich gestartet, verbindliche Regeln, Paketplan und sämtliche Zwischenstände gelesen.
- Claude-Sitzung `92afb9fd`: Paket 5, Gesamtlauf; `testbestand` und `port-3000` belegt.
- Zweite aktive Claude-Sitzung `0684163e`: Mitteilungsschalter/Chatoptionen, wartet auf Testbestand. Deren jüngsten Auftrag und Stand im lokalen Sitzungsprotokoll geprüft; kein Paket 6.
- Paket 6 exklusiv für diese Codex-Sitzung belegt. Keine fremden Prozesse, Belegungen oder Worktrees verändert.
- Nur die sieben Krypto-Commits `87885c4`, `5f1cf9f`, `75c4686`, `578c1c5`, `86a4c58`, `569340c`, `f730bc7` werden gezielt abgeglichen. Kein Merge des Sammelzweigs.
- main enthält bereits Meldebelege und die Krypto-Typdeklarationen, aber noch nicht die dort beschriebenen Senderegeln/Prüfer.

## Dokumentation vor Code

package.json: Expo `~57.0.16`, React Native `0.86.2`, expo-secure-store `^57.0.3`, expo-crypto `^57.0.2`, Supabase App `^2.112.4`, Website `^2.43.0`.
Expo SDK 57: https://docs.expo.dev/versions/v57.0.0/ gelesen; SecureStore über context7 `/websites/expo_dev_versions/v57.0.0`, Supabase-Fehlerbehandlung/Paginierung über `/supabase/supabase` abgefragt.
SecureStore kann beim Lesen/Schreiben/Löschen ablehnen; erlaubte Fachnamen enthalten Buchstaben, Zahlen, Punkt, Bindestrich und Unterstrich. Supabase-Abfragen liefern Fehler separat und müssen explizit geprüft werden.

## Prüfstatus

Übertragung abgeschlossen; Konflikte in gemeinsam/krypto.js, web/public/krypto.js und sync-handlers.js mit Erhalt der späteren Meldebelege gelöst. Vier unveränderte übertragene Offline-Läufe: Rechenschicht 36/36, App 18/18, Browser 16/16, Server 17/17; zusammen 87/87. Syntax der Konfliktdateien geprüft. Weitere gezielte Gegenprüfungen stehen aus. Sämtliche folgenden Ergebnisse sind ausdrücklich OFFLINE mit simulierten Konten/Tabellen, keine Live-Abnahme.
Kein Login, Reset, Schemaeingriff, Supabase-Testlauf oder externer Medienabruf erlaubt. Kein main-Merge, Push oder Deploy.

## Verbleibende Abnahme nach Freigabe

- Zwei Testkonten, App + Website: verschlüsselte Rundreise und Gegenlesen von messages/message_keys, kein Klartext gespeichert.
- Schlüssel-/Netzfehler und bereits verschlüsselter Chat ohne Empfängerschlüssel: Senden sichtbar abgewiesen, keine neue Nachricht.
- Weiterleiten, Story-Antwort/-Herz, Anhang-Beschriftung, Kontakt-Hinzufügen und Beitrag-Teilen auf beiden Plattformen kontrollieren.
- Sicherheitsnummer bei zwei Geräten je Konto: gleiche Nummer auf App/Website; zusätzliches, entferntes und zeitlich altes Gerät ändert sie.
- Fremder Absenderschlüssel, fehlende Abfragemöglichkeit und Schlüsselrotation: Warnung statt ungeprüfter Vertrauensanzeige; Polling aktualisiert Blase.
- Kontowechsel A/B/A, paralleler Start, Neustart und Altbestandsübernahme: richtige Fächer, getrennte neue Paare, alte Chats weiter lesbar.
- Eigener Simulator „All-Media Codex“: Sichtprüfung Schloss, Nummer/Gerätezahl, Fehlermeldung, Absenderwarnung, Senden/Bearbeiten/Weiterleiten.
- Gemeinsamen Gesamtlauf und Rechte-/Angriffsprüfung erst mit eigener exklusiver Testbestand-Belegung; anschließend geprüfte Bereinigung.

## Gegenprüfung und zusätzliche Korrekturen

Die 87 ursprünglichen Prüfungen waren grün, deckten aber folgende Lücken nicht ab:

1. Sicherheitsnummer und Empfängerabfrage endeten bei 1000 Geräten. Gemeinsamer Helfer `kryptodaten.schluesselHolen` liest geordnet in 200er-Seiten mit exaktem Nenner; verkürzte Seiten, Abfragefehler, doppelte IDs und wechselnde Anzahl brechen ab. App-Kontaktprofil und Website verwenden denselben Helfer. Gegenprobe mit 1201 Geräten und altem zusätzlichem Schlüssel.
2. Eine laufende Website-Schlüsselanmeldung gehörte keinem Konto; Kontowechsel erbte ihre Promise. Jetzt je Konto, mit Prüfung der aktiven Kennung nach der Antwort und Widerruf durch Abmelden. Behaltene Schlüssel und gemerkte Chats sind ans Konto gebunden.
3. App-Altbestand ohne Gerätekennung wurde verworfen. Vorhandenen geheimen Schlüssel behalten, nur Kennung ergänzen; kontenübergreifende Übernahme seriell, Fächer mit ungültiger Kennung ablehnen. Historisch gemeinsam genutzte Paare bleiben zur Lesbarkeit des Altverlaufs in den damals gespeicherten Konten erhalten; neue Konten erhalten getrennte Paare. Keine rückwirkende Schlüsselrotation.
4. Nicht ladbare Absenderschlüssel wurden ohne Warnung angezeigt. Jetzt Warnung auch bei unbekanntem Urteil, nach erfolgreicher Nachprüfung wieder entfernt. Bestätigte und unbestätigte Paare nach 60 Sekunden nachprüfen; abgelaufene Bestätigung bei Fehler nicht weiter vertrauen. Lange Verläufe in Paketen von 100 Paaren prüfen, keine stille API-Kappung nach 200.
5. Kontakttext und Beitrag-Teilen umgingen die Senderegel. App geht über nachrichtSenden; Website bereitet Zielchat vor, verschließt im Browser und schreibt über denselben Serverwächter. Geteilte Beitrags-ID bleibt Metadatum. Alte Website-Aufrufer mit Klartext werden abgewiesen.
6. Website-Anhangtexte waren vom Klartextwächter ausgenommen. Jetzt Beschriftung im Browser verschließen; Anhangroute übernimmt ausschließlich Kryptofelder aus dem Paket und serverseitig aufgelöste Medienmetadaten. Dateien selbst sind weiterhin unverschlüsselt.
7. Fehlende/alte Fakten, fehlender Chat und Mitgliedschaft sowie ausgefallene Prüfungen auch für leere Anhänge schließen den Weg. Fehlende KryptoWeb-Datei sendet keine Klartext-Anfrage. Unvollständige Kryptopakete ohne Chiffre/Nonce/Absender/Kuverts werden vor dem Schreiben abgewiesen.

Offline-Zwischenstand: 4 Krypto-Läufe 36/36 + 18/18 + 16/16 + 18/18 = 88/88; 20 zusätzliche Regressionstestfälle 20/20. Meldebelege 105/105; Dateischema-Prüfung sieben Gruppen grün; TypeScript ohne Fehler. Alle reinen Node-Läufe unter `_offline_sperre.cjs`, die Netzverbindungen verweigert. Chromium-Komponentenprüfung danach 16/16 grün; native und Live-Abnahme bleiben offen.

## Grenzen und verbleibende Risiken

- **Ausschließlich OFFLINE.** Der Browserrahmen lädt Produktfunktionen und echte Express-Routen, ersetzt aber Anmeldung, Datenbank, Datenaufbereitung und Rahmenfunktionen (Ton, allgemeines Zeichnen). Er beweist keine vollständige Website-Navigation. In der Fortsetzung wurden zusätzlich die echten nativen Chat-/Kontaktbildschirme im eigenen Simulator gegen simulierte Kontexte/Tabellen geprüft (6/6). Der isolierte Rahmen verändert die Anordnung und ersetzt keine komplette native Live-/Kontenabnahme.
- Historisch mehrere Konten umfassende Altpaare bleiben zur Lesbarkeit alter Nachrichten erhalten. Neue Konten bekommen je ein eigenes Paar. Altpaare sind dadurch nicht nachträglich kryptografisch getrennt; hierfür wäre eine eigene Rotation mit Altleseschlüsseln erforderlich.
- Sicherheitsnummer zählt eindeutige öffentliche Schlüssel. Kopien desselben Paares erzeugen keine zusätzliche kryptografische Identität. Keine Vorwärtssicherheit, keine automatische Gerätewarnung oder Geräteliste; manuell verglichene Nummer bleibt der Vertrauensanker gegen einen kompromittierten Server.
- Textverschlüsselung schützt weiterhin keine Dateien, Dateinamen, Kontakt-/Standort-/Beitrags-/Storybezüge oder sonstige Metadaten. Gruppen und Community-Kanäle bleiben wie bisher offen. Kein Schema ergänzt: der Wächter schützt die aktualisierten App-/Website-Wege, kein neues Datenbankverbot für jeden denkbaren direkten Altclient.
- Kontakt, Zielchat oder Story-Like können bei einem anschließenden Sendefehler bereits angelegt/gesetzt sein; keine transaktionsübergreifende Alles-oder-nichts-Zusage. Bei Mehrziel-Weiterleitung werden alle Ziele vorab auf Klartext geprüft, spätere Datenbankfehler können trotzdem Teilversand erzeugen.
- Live-Prüfläufe, die bisher Nachrichten zwischen registrierten Geräten direkt als Klartext per API erzeugen, können jetzt berechtigt scheitern. Beim späteren exklusiven Gesamtlauf unterscheiden: veralteter Prüfaufbau, gewollte Abweisung oder tatsächlicher Funktionsfehler. Keinen Wächter zum Grünmachen umgehen.

## Konkrete ausstehende Live-/Zwei-Konten-/Simulatorprüfungen

Erst nach ausdrücklicher Freigabe und eigener exklusiver `testbestand`-Belegung, mit `@test` und `@prueflauf`; App-Prüfgerät ausschließlich „All-Media Codex“. Keine dieser Prüfungen wurde hier durchgeführt.

1. **Zwei Konten × App/Website:** A-App → B-Web, B-Web → A-App, A-Web → B-App, B-App → A-Web. Jeweils Nachricht tatsächlich lesen, `messages.text = ''`, Chiffre und Kuverts aller registrierten Geräte gegenlesen. Auch eigenes zweites Gerät muss neue Nachrichten lesen können.
2. **Fehler/Downgrade:** temporär blockierte Schlüsselabfrage, gesperrter Schlüsselbund, verlorenes Empfängergerät und bereits verschlüsselter Chat. Null zusätzliche Nachrichten, verständliche Absage und erhaltener Entwurf/Antwortbezug in beiden Oberflächen.
3. **Sicherheitsnummer:** zwei Geräte je Konto, zusätzlich zeitlich alter Schlüssel, anschließend Entfernung. Nummern App/Web vergleichen; auch >1000 simulierte Geräte wurde offline geprüft, einen so großen Livebestand nicht eigens erzeugen. Neuöffnen der Kontaktinfo muss aktualisieren; kein Schloss bei unklarem Zustand.
4. **Absenderprüfung:** zulässiges Testpaket mit fremdem Absenderschlüssel; Warnung in beiden Blasen. Unladbare Prüfung warnt ebenfalls. Nach gültiger Anmeldung/Entfernung und spätestens Cacheablauf erneut prüfen; Polling muss Kennzeichnung sichtbar ändern. Absenderprüfung gegen echte RLS eigens kontrollieren.
5. **Kontowechsel und Altbestand:** A/B/A, paralleler Start und Abmelden während Anmeldung, Neustart App/Browser. Getrennte Fächer für neue Konten; Altbestand mit/ohne Gerätekennung bleibt lesbar. Mehrgeräte- und alte Nachrichtenzustellung sowie SecureStore-/localStorage-Schreibfehler auf echten Plattformen prüfen.
6. **Nebenwege:** Kontakt mit Nachricht, Beitrag/Video teilen an Kontakt/Fremden, Story-Antwort und Story-Herz, Text und Anhang-Beschriftung, Gruppe, Community-Kanal, Bearbeiten und Mehrziel-Weiterleiten. Richtiger Chat und Bezug, kein Klartext im verschlüsselten Ziel, nichts an Nichtmitglieder. Alle neuen Vorbereitungs-Endpunkte in normaler Website-Navigation bedienen.
7. **Native Sichtprüfung:** Schloss/Nummer/Gerätezahl im Kontaktprofil, verständlicher Fehler bei Senden/Anhang/Weiterleitung, Absenderwarnung im Hoch-/Querformat sowie erhaltener Entwurf und Bezug. Der vorliegende Browserbildbeleg ersetzt das nicht.
8. **Exklusiver Gesamtlauf:** `test:krypto`, betroffene Chat-/Story-/Teilen-/Kontakt-/Anhangläufe, Rechte/Angriffe und anschließend `test:alles` mit richtigem Zweig/Fingerabdruck. Bestehende Erwartung „API schreibt Klartext“ gegebenenfalls durch verschlüsselten Aufbau oder eine echte Negativprobe ersetzen. Alle gestarteten Läufe, Prüfnenner und Fehler ausweisen.
9. **Geprüfte Bereinigung:** beide Testkonten und registrierte Testgeräte/Kuverts berücksichtigen; verbliebene Daten gegenlesen, eigene Prozesse schließen, Belegungen freigeben. main-Merge/Push/Deploy weiterhin nicht Teil dieses Auftrags.

## Fortsetzung 10.11., ab 19:04

Henrik beauftragte die offenen Prüfungen schnellstmöglich. Testbestand weiterhin exklusiv durch Claude belegt, aktiver Gesamtlauf; keine Live-Anmeldung oder gemeinsame Datenänderung. Paket 6 erneut belegt. Native Offline-Vorprüfung im eigenen Simulator All-Media Codex (5210E675-C198-4328-B3E2-30FCE9E0F624), separater Metro 3301. Eigenständiger Prüfstand unter app/test/paket6-native, normale App-Konfiguration unverändert; echte Chat-/Kontakt-Bildschirme, simulierte Hooks/Tabellen, ausgehendes App-Netz auf eigenen Metro begrenzt. Kontaktinfo mit aktivem Verschlüsselungszustand sichtbar, Bild native-kontakt.png angesehen. Noch keine vollständige native Abnahme; laufender Ausbau der Bedienprüfung.

Liveprobe vorbereitet: app/test/_paket6_live.cjs prüft die echte Zwei-Konten-Rundreise mit übersetzter App-Logik und echter Website, Sicherheitsnummern, Kontowechsel, Absenderprüfung, explizite Klartextabweisung und prüft eigene Fixture-Bereinigung. Kein Reset, keine Registrierung, kein Schema. Fremdbelegungsschutz vor Zugangsdaten/Anmeldung geprüft: Exit 2. Wartewerkzeug _paket6_warten.cjs erwirbt die Belegung atomar, startet nur dann den eigenen Server 3300 und die beauftragte Probe; kein fremder Prozess wird beendet. Zugangsdaten werden erst nach eigener Belegung aus den bestehenden lokalen Umgebungsdateien geladen und nicht kopiert oder ausgegeben. Native Bedienprüfung im getrennten Offline-Rahmen noch nicht vollständig; dessen zusätzlicher Rahmen verschiebt die Eingabe hinter die Tastatur, daher keine Produkt-Keyboard-Abnahme daraus ableiten.

Native Fortsetzung: Senden erzeugt im simulierten Bestand genau eine Chiffre; bei Schlüsselstörung bleibt der Bestand unverändert, die konkrete Fehlermeldung erscheint und der Entwurf bleibt erhalten. Absenderwarnung und Sicherheitsnummer mit einem Gerät angesehen. Bedienwerkzeug-Fund: AXe meldet auch außerhalb des Scroll-Fensters abgeschnittene Kinder mit Bildschirmkoordinaten; der bisherige Tipphelfer hielt sie fälschlich für überlagernde Flächen. ui-sichtbar.js begrenzt nun rekursiv an allen Scroll-Fenstern, echte Überlagerungen bleiben erhalten; Regressionen 8/8. Kein Tipp auf Koordinaten ohne eindeutigen sichtbaren Beschriftungstreffer. Native komplette Wiederholung läuft.

## Native Offline-Abnahme abgeschlossen (Fortsetzung)

Eigener Simulator „All-Media Codex“, separates Expo-Projekt mit echten `ChatDetailScreen`/`ContactProfileScreen` und echter `lib/aktionen.ts`/Kryptologik, simulierten Konten/Tabellen und ausgehendem App-Netz nur zum eigenen Metro. **6/6** im reproduzierbaren Bedienlauf `python3 app/test/_paket6_native.py`:

1. Eindeutig eigener Offline-Prüfstand.
2. Native Blase zeigt die Absenderwarnung (darstellungsbezogene, simulierte Markierung; kryptografischer Prüfer gesondert in Node/Browser geprüft).
3. Tatsächliches Senden über den nativen Knopf erzeugt genau eine verschlüsselte Zeile; keine externe Anfrage.
4. Schlüsselstörung zeigt die originale Verschlüsselungsabsage, erzeugt keine weitere Nachricht und erhält den Entwurf.
5. Native Kontaktinfo zeigt Sicherheitsnummer und „1 Gerät“.
6. Zusätzliches simuliertes Gerät ändert dieselbe native Anzeige zu „2 Geräte“ und einer anderen Nummer.

Angesehene Belege: `native-chat-gesendet.png`, `native-sendesperre.png`, `native-sicherheitsnummer-ein-geraet.png`, `native-sicherheitsnummer-zwei-geraete.png`; Warnung zusätzlich unter `native-absenderwarnung.png`. Der eigene Prüfstand brauchte ein getrenntes „Tastatur schließen“ vor dem nativen Sende-Knopf; Keyboard-Verhalten des normalen App-Rahmens ist damit ausdrücklich nicht abgenommen. Die erwartete abgefangene Fehlerzeile wird nur im Prüfstand aus LogBox-Hinweisen herausgefiltert, damit sie die originale Produktmeldung nicht verdeckt; unerwartete Fehler bleiben sichtbar und Metro protokolliert die Simulation.

Prüfwerkzeug-Korrektur `app/tools/ui-sichtbar.js`: sichtbare Flächen werden rekursiv mit Scroll-Fenstern geschnitten. **8/8** reine Offline-Gegenproben; echte überlagernde Modalflächen bleiben blockierend. Normale App-Konfiguration und Claudes Simulator bleiben unverändert.

## Exklusive Zwei-Konten-Liveprobe (19:46–19:52)

Testbestand seit 19:46 exklusiv Codex; eigener Paket-6-Server 3300. Erster Lauf 20/21: alle Sicherheitsprüfungen bestanden, sechs gegenprüfbare Reste durch unvollständigen Prüfhelfer-Abbau. Kein Produktfehler: RLS erlaubt Nachrichtenlöschung nur durch jeweiligen Absender und Chatlöschung erst nach Austritt des Gegenübers. `_paket6_reste.cjs` entfernte ausschließlich protokollierte eigene Fixtures, Rest 0; Prüfhelfer entsprechend korrigiert. Wiederholung **21/21**, Rest **0**. Originalfehler bleibt als Beleg erhalten.

Echte Browser-Anmeldungen, echte Supabase, tatsächliche Chiffre-/Kuvertdaten; App-Code als Node-Übersetzung mit simuliertem SecureStore. Kein Nachweis nativer Live-Anmeldung daraus. Beide Senderichtungen App→Website und Website→App-Logik, eigene Gerätekuverts, Klartextabweisung, simuliert unterbrochene Schlüsselabfrage im echten Websiteweg, vollständige geräteübergreifende Nummer, reale Geräteaufnahme/-entfernung, Browser A/B/A und Warnung vor tatsächlich unregistriertem Absender bestanden. Kein Reset/Schema.

Dateien: live-zwei-konten.log (20/21), live-zwei-konten-wiederholung.log (21/21), live-fixtures*.json (IDs, geprüfter Rest). Neue native Live-Rahmenprüfung verwendet tatsächliche SecureStore-Schlüssel, zwei echte Sitzungen und Originalbildschirme; Kontexte/Rahmensteuerung bleiben gesondert und werden entsprechend ausgewiesen.

## Native Live-Komponenten (19:55–20:00)

Echte Original-Chat-/Kontaktbildschirme im gesonderten Expo-Projekt `paket6-live-native`, echte Supabase-Sitzungen beider erlaubter Konten, echte geräteeigene SecureStore-Paare. Sitzungstoken nur flüchtig über eigene Loopback-Steuerung, keine Passwörter im Bundle. Nur eigene Ports 3301/3302 und All-Media Codex. Rahmenkontexte und Navigation werden ersetzt; keine Abnahme der vollständigen App-Anmeldemaske oder Tastaturgeometrie daraus ableiten.

Bedienlauf **10/10** nach Wiederaufnahme: vier Richtungen Website/native A/B tatsächlich gelesen; Sendefehler bei simulierter blockierter Schlüsselabfrage mit erhaltenem Entwurf, keine zusätzliche DB-Zeile; reale Sicherheitsnummer gegen alle Geräteschlüssel verglichen; Zusatzgerät verändert Zahl/Nummer; native Warnung bei tatsächlich unregistriertem Absender; Rückkehr A liest alte Chiffre weiter. Ursprüngliche feste Erwartung drei Geräte war falsch: A hatte bereits 16 verschiedene reale Geräteschlüssel. Prüfnenner auf tatsächlichen Grundstand korrigiert, vorhandene Geräte unverändert gelassen; anschließend 16→17 und geänderte Nummer bestätigt. Originalfehler im Protokoll erhalten.

Backend-Gegenprüfung **8/8**, alle eigenen Chat-/Nachrichten-/Geräte-/Kontaktfixtures entfernt und gegengelesen: **Rest 0**. Sechs ausgelöste Testmitteilungen mit Filter für beide erlaubten Testkonten entfernt, Rest 0. Eigener Metro/Expo-Projekt beendet, Simulator-/Port3301/3302-Belegungen frei. Sechs neue native Bilder angesehen (A, B, Sendesperre, Nummer vor/nach Zusatzgerät, Absenderwarnung). Offline-Nachprüfung weiterhin **9/9 Gruppen**, TypeScript ohne Fehler.

Bestehender Management-Token in freigegebenem eigenem KI-Konfigurationsbereich gefunden; ausschließlich im Prozessspeicher geladen. Lesende Abfrage HTTP201. Keine Schlüssel in Protokollen oder Commit. Gesamtlauf misst den eigenen Zweig mit Port3300-Preload, keine fremden Prozesse.

## Korrektur Entwurfserhalt und unterbrochener Gesamtlauf

Beim Lesen zusätzlicher Fehlerwege entdeckt: Website leerte Text und Antwort-/Bearbeitenbezug vor bestätigtem Versand; Bearbeitungsfehler verloren den gesamten Entwurf, Netz-/JSON-Fehler waren nicht abgefangen, Serverabsage ließ Bezug/Knopf unbrauchbar. Gezielte Korrektur in `sendMessage`: erst nach Bestätigung abschließen, Fehler sichtbar abfangen, Entwurf und Bezug bis dahin erhalten; erneutes Auslösen während Anfrage gesperrt, inzwischen neu geschriebener Text bleibt erhalten. Keine Änderung am Verschlüsselungsformat oder Schema.

Reale Browserkomponenten gegen Speichertabellen **26/26 OFFLINE**, darunter zehn neue Fälle: fehlendes/werfendes Umschlüsselpaket, Serverabsage beim Bearbeiten, erfolgreiche verschlüsselte Wiederholung, normale Absage/Netzfehler/ungültige JSON-Antwort mit Antwortbezug, Erfolg nach Fehler, Doppelaufruf und neu geschriebener Entwurf während Anfrage. Altstand84dbd83 scheitert nach drei bestandenen Anfangsprüfungen genau an der neuen Entwurfserhalt-Probe, Exit1. Aktuell26/26 Exit0; Bilder angesehen. Reine Offlinegruppen erneut9/9, TypeScript/Syntax grün.

Erster Gesamtlauf (0845e0a2-d9c6-491e-8bb0-32e14651e743) vor Korrektur mit stabilen Quellen bewusst per SIGTERM beendet, statt gegen inzwischen als fehlerhaft erkannten Stand zu Ende zu messen: **132/133 gezählte Prüfungen, 3/80 Läufe**, feedback nur unterbrochen. testhygiene24/24, smoke75/75, feedback33/34 Teilbestand. Bereinigung erkannte zunächst eine verspätet ausgelöste Testmitteilung und blieb korrekt rot; gezielte Nachbereinigung beider erlaubter Konten entfernte1, Rest0. Journal für sichere Wiederaufnahme erhalten. Das ist ausdrücklich kein vollständiger oder grüner Gesamtlauf. Belege gesamtlauf-abgebrochen.log/status.json.

## Ergänzende Querformatprobe während des Gesamtlaufs (ausschließlich OFFLINE)

Unveränderte Original-Chatblase in eigenem, kompaktem Prüfrahmen `pruefstand/paket6-quer` (außerhalb der vom Gesamtlauf beobachteten Produkt-/Prüfquellen),874×402. Warnung vor simuliert fremdem Absender vollständig sichtbar, externe Anfragen0. Bild native-querformat-absenderwarnung.png angesehen.

Kontaktmodal-Zusatzprobe **fehlgeschlagen im erzwungenen Querformatrahmen**: ExpoGo beendet sich mit UIApplicationInvalidInterfaceOrientation, da React-Native-Modal standardmäßig Hochformat verlangt und der zusätzliche Prüfrahmen nur Querformat zulässt. Die tatsächliche App ist in app/app.json ausschließlich auf portrait gestellt; deren native Kontaktmodalprüfung im zulässigen Hochformat war erfolgreich. Deshalb keine Produktions-Ausrichtung und keine gemeinsamen Sheet-Komponenten geändert. Absturzlog und Springboard-Bild ausdrücklich als fehlgeschlagene Rahmenprobe aufbewahrt; kein Nummern-Nachweis daraus. Echte Querformat-Kontaktmodal-Abnahme erfordert erst einen gesondert beschlossenen Produkt-Ausrichtungsumfang. Eigener Metro beendet; kein Zugriff auf den exklusiv laufenden Testbestand.

Gesamtlauf-Zwischenstand:10/80 abgeschlossene Läufe,259/259 gezählte Prüfungen, keine roten Läufe. Lauf801f2907-97d7-4fa4-a4b5-cc987ea422a3 noch aktiv. Fingerabdruckvergleich nach rein unabhängiger Offline-Querformatprobe bestätigt alle beobachteten Produkt-/Prüfquellen unverändert. Separater Angriffslauf und gezielte Neustart-/Nebenwege nach Ende des exklusiven Gesamtlaufs, keine parallele Anmeldung gegen seinen Bestand.

## Aktueller Remote-main ba90b50 erkannt (20:33)

Übergabe meldete Paket5 komplett auf main. Tatsächlich steht der lokale main-Ref weiterhin auf0288a35, `git ls-remote origin refs/heads/main` bestätigt dagegen **ba90b506ae586fe624f3afa72b9bff2924855538**. Der Gegenstand des Auftrags ist der aktuelle main-Stand, deshalb zweiter Gesamtlauf geordnet vor Quellenänderung beendet und Belege gesichert: **261/272**, **11/80** gestartet, darunter Explorer2/13 rot (erste echte Abweichung: Hashtag-Unterliste; weitere Kartenfehler Folge des offenen Overlays), übrige zehn Läufe259/259. Abbruch ist kein voller Gesamtnachweis.135 Testmitteilungen entfernt, Rest0, Quellen bis Abbruch unverändert.

Paket6 wird auf einem neuen eigenen Codex-Zweig auf ba90b50 übertragen; alter eigener Zweig bleibt als gesicherter Verlauf erhalten. Kein lokaler main-Ref geändert und kein Push/Merge/Deploy. Zielcode muss anschließend erneut offline/live und im dann vollständigen Gesamtlauf geprüft werden. Paket5 enthält zusätzliche Community-/Kopf-/Filterläufe und Änderungen an Chat-/Kontaktansichten; diese beim Zusammenführen erhalten. Dependencies unverändert (Expo~57.0.16, RN0.86.2, Supabase-JS^2.112.4).

## Wiederaufnahme 11.11.,01:05

Henrik autorisiert Fortsetzung nach Limit. Claude hat den früheren Testbestand mit ausdrücklicher Nutzerfreigabe übernommen und inzwischen Schema126 eingespielt; Sicherung6518f85 bleibt erhalten. Aktuell hält Claude erneut testbestand für Chatoptionen; Port3300 ist frei, keine Live-Anmeldung dieser Wiederaufnahme. Remote-main ist nunc325f7d; lokale main-Referenz noch0288a35. Der vorbereitete, konfliktfrei zusammengeführte Stand aufba90b50 wird zunächst auf eigenem Zweig gesichert:9/9 Offlinegruppen,26/26 Browserkomponenten, Paket5 Kopf20/20, Filter26/26, Tipphelfer8/8 in den vorhandenen Ergebnisdateien bestätigt. Nächster Schritt: c325f7d mit Erhalt aller Paket6-Sicherheitsänderungen integrieren, neu offline prüfen; Live erst mit eigener exklusiver Belegung.

Abgleichc325f7d konfliktfrei in eigenem Zweig vorbereitet; Schema126-Datei unverändert ausmain übernommen, kein Schemaeingriff dieser Sitzung. Frische Offlineprüfung9/9, Browser26/26, Paket5 Kopf20/20 und Filter26/26. Erweiterte Liveprobe prüft künftig Browser-Neuladen sowie tatsächliche Registrierung/Entfernung eines Absenderschlüssels nach regulären60s Cachefrist; nativer Prozessneustart mit gleicher SecureStore-Identität ebenfalls vorbereitet, noch nicht ausgeführt. Claude hält weiter Testbestand.
