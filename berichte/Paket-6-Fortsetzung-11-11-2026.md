# Paket 6 – Stand der Fortsetzung am 11.11.2026

> **Historischer Zwischenstand vom Sitzungsende am 11.11.2026, 01:14 MEZ.**
> Aktueller Arbeits- und Prüfstand: [Aufräumfortsetzung 11.11.2026 nachmittags](Paket-6-Aufraeumen-11-11-2026.md).
> Die folgenden Commitstände, Belegungen, Pausen und offenen Schritte beschreiben
> den damaligen Stand. Die Nachmittagsfortsetzung enthält inzwischen neue Korrekturen
> sowie die frische Live-Rundreise und Angriffsprüfung. Native Abnahme, vollständige
> Liveprüfung der Nebenwege und vollständiger Gesamtlauf bleiben dort offen;
> ein gestarteter Gesamtlauf gilt erst nach vollständiger Auswertung als Nachweis.
> Die historischen Ergebnisse und Einschränkungen unten bleiben unverändert.

## Gesicherter Stand

Worktree: `/Users/henrik.dikta/allmedia-wt-codex/paket-6`.
Zweig: `codex/paket-6-main-2026-11-10`.
Codecommit: **22830e6**, mit **c325f7d** als zweitem Elterncommit.
Der Remote-main wurde lesend als `c325f7dc4a8c12264c6719bfa1d767da7c721ce6` bestätigt.
Der lokale main-Ref bleibt **0288a35**; keine Änderung im Hauptarbeitsordner.

Die vor dem Limit vorbereitete Übertragung auf ba90b50 ist zusätzlich in
**9f54804** gesichert. Claudes Sicherung `sicherung/codex-paket-6-2026-11-10`
(**6518f85**) bleibt erhalten. Ursprünglicher Verlauf:
`codex/paket-6-krypto-2026-11-10`.

Paket-5-Änderungen und atomare Chat-Anlage aus Schema 126 wurden erhalten.
Die unveränderte Schema-Datei stammt aus main; diese Sitzung hat kein Schema eingespielt.
Vorgeschriebene Supabase-Dokumentation wurde vor dem Abgleich abgefragt.
Projektversionen unverändert: Expo `~57.0.16`, React Native `0.86.2`,
Supabase-JS `^2.112.4`.

## Tatsächlich frisch geprüft – ausschließlich OFFLINE

| Prüfung auf dem mit c325f7d vereinigten Stand | Ergebnis | Beleg unter `pruefbelege/paket-6/` |
|---|---:|---|
| Krypto-Rechnung/App/Browser/Server | 88/88 | `_krypto*_einheit.log` |
| Zusätzliche Paket-6-Regressionen | 22/22 | `_paket6_offline.log` |
| Browserkomponenten mit echten lokalen Routen, simulierten Tabellen/Anmeldung | 26/26 | `main-c325f7d-browser-offline.log` |
| Meldebelege | 105/105 | `_melden_einheit.log` |
| Dateischema | 7 Gruppen grün | `_schema.log` |
| TypeScript / Syntax | Exit 0 / 8/8 | `main-c325f7d-offline.log` |
| Aggregierte Offlineprüfung | 9/9 Gruppen | `main-c325f7d-offline.log` |
| Paket-5-Kopf / Filter | 20/20 und 26/26 | `main-c325f7d-kopf-offline.log`, `main-c325f7d-filter-offline.log` |
| Fremde Testbestandsbelegung | Exit 2 vor Zugangsdaten/Anmeldung | `fortsetzung-fremdbelegungsschutz.log` |

Diese Ergebnisse bestätigen keine Live-Datenbank, vollständige native App oder
neue Zwei-Konten-Abnahme. Frühere Live-Ergebnisse (21/21; native Komponenten
10/10 plus Backend 8/8) stammen vom älteren Stand und werden nicht als neue
Abnahme von c325f7d ausgegeben. Details und negative Gegenproben stehen in
`Paket-6-Krypto-10-11-2026.md`.

## Offen – konkrete Reihenfolge

1. **Testbestand exklusiv neu belegen.** Claude hält ihn derzeit seit 01:05
   für den Chatoptionen-Beleg. Ein freier Port erlaubt keine parallele Liveprobe.
   Keine fremde Belegung erzwingen.
2. **Aktuellen Remote-main noch einmal lesend vergleichen**, eigenen Server 3300
   aus dem Worktree starten und `/api/version` prüfen. Bei neuem main nur den
   eigenen Zweig abgleichen. Kein main-Merge, Push oder Deploy.
3. **Erweiterte Zwei-Konten-Liveprobe** `_paket6_live.cjs` auf neuem Stand:
   vier App-Logik/Website-Richtungen, Chiffren/Kuverts, Klartextabweisung,
   vollständige Gerätenummer, Geräteaufnahme/-entfernung, A/B/A,
   Browser-Neuladen mit unverändertem Gerätepaar und lesbaren alten Chiffren.
   Neu vorbereitet: tatsächliche Absenderregistrierung und -entfernung,
   jeweils reguläre 60-Sekunden-Cachefrist abwarten und beide Warnzustände prüfen.
   Diese Erweiterungen sind noch nicht live ausgeführt.
4. **Native Live-Komponenten auf neuem Stand erneut prüfen**:
   `_paket6_native_live.cjs`, Projekt `app/test/paket6-live-native`,
   `_paket6_native_live.py`; nur All-Media Codex und eigene belegte Ports 3301/3302.
   Neu vorbereitet: echter Expo-Go-Prozessneustart, unveränderte SecureStore-
   Identität beider Konten und bestehende Chiffren danach lesen.
   Rahmenkontexte bleiben ersetzt; vollständige App-Anmelde-/Profilwechsel-
   Navigation und Android-/Hardware-Schlüsselbundfehler sind dadurch nicht geprüft.
5. **Verschlüsselte Nebenwege gezielt live ergänzen**: Kontakt mit Nachricht,
   Beitrag/Video teilen, Story-Antwort/-Herz, Anhang-Beschriftung, Bearbeiten und
   Mehrziel-Weiterleiten. Gruppen/Kanäle bewusst offen prüfen; Nichtmitglieder
   dürfen nichts erhalten. Offline sind diese Sicherheitswege abgedeckt;
   vollständige Zwei-Konten-Bedienung auf neuem Stand bleibt offen.
6. **Angriffe und vollständigen Gesamtlauf ausführen**:
   `_paket6_lauf.cjs _angriffe.js`, danach `alles.js` mit vorhandenem
   Management-Token nur im Prozessspeicher und Port-3300-Preload.
   Alle tatsächlich ausgeführten Läufe/Nenner, unveränderte Quellen und geprüfte
   Bereinigung ausweisen. Rote Läufe anschließend gezielt nachprüfen.
   Frühere Gesamtläufe waren abgebrochene Teilnachweise (3/80 und 11/80),
   kein erfolgreicher vollständiger Lauf. Explorer war im zweiten Teilnachweis rot.
7. **Bereinigung und Abschluss**: eigene Chats, Nachrichten, Kuverts,
   registrierte Geräte und neu entstandene Kontakte anhand des Journals abbauen;
   Testmitteilungen beider erlaubter Konten nachzählen, Rest 0 bestätigen.
   Eigene Prozesse beenden, Belege/Report/Vault committen, Belegungen freigeben.

## Pause und laufende Prozesse

Der neue Sechs-Stunden-Hinweis verlangt eine Pause vor dem nächsten riskanten
Schritt. Deshalb wurde der eigene bewachte Warteprozess **53458** geordnet
beendet (Exit 143), bevor er Live-Arbeit beginnen konnte. Seine letzte Meldung:
fremder Testbestand, keine Anmeldung. Kein neuer Testbestand wurde übernommen.
Auf 3300, 3301 und 3302 wurde anschließend kein Listener gefunden.
Keine eigene Migration läuft; Claudes Prozesse bleiben unberührt.

Der automatische Start ist **aus** und muss bei Fortsetzung bewusst neu gestartet
werden. Die Zugangsdaten werden weiterhin nur aus bestehenden lokalen Dateien
beim autorisierten Lauf geladen, nicht kopiert oder protokolliert.

## Grenzen der Verschlüsselung

Neue Konten erhalten getrennte Geräteschlüssel. Historisch gemeinsam verwendete
Altpaare bleiben für alte Nachrichten erhalten; keine rückwirkende Rotation.
Dateien, Dateinamen und Verbindungsmetadaten bleiben unverschlüsselt;
Gruppen/Kanäle bewusst Klartext. Keine Forward Secrecy oder Key Transparency.
Die tatsächliche App ist auf Hochformat begrenzt. Die gesonderte Querformat-
Warnblase wurde offline gesehen; das nur quer konfigurierte Kontaktmodal-
Experiment scheiterte an iOS-Orientierungsanforderungen und gilt nicht als
erfolgreiche native Abnahme. Produkt-Ausrichtung wurde nicht geändert.
