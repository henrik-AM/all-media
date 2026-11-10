# Testhygiene, 05.11.2026

Basis: main ad7f221. Testablauf-Korrektur: b512c56, nur eigener Zweig.

- Fixtures werden vor dem Quellenfingerabdruck vorbereitet; der Quellwächter bleibt aktiv.
- Vor dem Gesamtlauf: eigene KI-Belegung, passender Server, Bereinigungstoken/Projekt und leerer Altbestand erforderlich.
- Lauf-UUID und DB-Zeitgrenze im lokalen Journal; Benachrichtigungen beider erlaubten Testkonten werden nur seit Beginn entfernt. Nachzählung über beide Konten muss null ergeben. Unklarer Altbestand wird nicht pauschal gelöscht.
- Laufende Kinder/Browser beenden, dann bereinigen. SIGINT/SIGTERM und Zeitlimit sind behandelt. Bei SIGKILL bleibt das Journal; ein noch lebender oder unklarer alter Prüfprozess blockiert die Wiederaufnahme.
- Rohprotokolle und Abschlussstatus bleiben je Laufkennung erhalten. Bereinigungsfehler, fehlende/0 Prüfzahlen und fehlende Läufe verhindern Exit 0.
- Sechs-Stunden-Warnung im Gesamtlauf; kein eigenständiger Sitzungswächter in diesem Paket.

## Prüfungen

- Testhygiene: 22/22 (`node --test app/test/_testhygiene_offline.js`).
- Belegungsschutz: 18/18 (`bash app/test/_ki_belegung_probe.sh`).
- Schema/Code: 7/7 (`node app/test/_schema.js`).
- Bunny-Adapter: 138/138; Umzug: 2/2, ausschließlich lokal/Attrappen. Kein vollständiger Review.
- Keine echte SQL-Ausführung, kein Cloudlauf, keine Installation von Abhängigkeiten, kein main/Push/Deploy.

## Paket T, 09.11.2026

Neu aufgebaut auf main fbf0e79, Zweig `codex/paket-t-testhygiene`.
Nur App-Testhygiene aus b512c56 und Bericht aus 3db230c übernommen.
590d579 betrifft ausschließlich Sitzungsbudget und ist vollständig ausgeschlossen.
Sitzungsbudget-Dateien, Hooks und deren Freigaben bleiben außerhalb von Paket T.
Die alten Prüfzahlen oben sind historische Nachweise vom 05.11., keine neuen Läufe.

Aktuell offline: Testhygiene 22/22, Belegungsschutz 18/18, Schema/Code 7/7.
Main-Abgleich: 105/105 Skripte unverändert erhalten, 74/74 Gesamtläufe erhalten;
zusätzlich Testhygiene ergibt 75 Läufe. `test:bz-neuladen` bleibt erhalten,
ist bereits auf main nicht in `LAEUFE` eingetragen; keine fremde Laufliste erweitert.
Kein TypeScript berührt; `tsc --noEmit` gemäß Auftrag nicht erforderlich.
Laufjournal und Rohbelege werden über `app/test/.gitignore` lokal ausgeschlossen.

Gesamtlaufversuch am 09.11.: `npm run test:alles` mit vorhandenem
`SUPABASE_TOKEN`, eigener Belegung `testbestand`, Exit 2 vor Anmeldung/SQL.
Grund: Auf Port 3000 läuft kein Prüfserver. Laut Auftrag darf Port 3000
nicht angefasst werden; Wächter nicht umgangen. 0/75 Läufe ausgeführt,
Prüfzahl nicht ermittelt (Nenner unbekannt). Vollständige Liveabnahme offen.
Belegung anschließend freigegeben. Kein Schema, keine Live-Daten geändert.

## Gesamtlauf 09.11. — neuer Auftrag, Vorbereitung

Freigabe laut `AUFTRAG-paket-t-gesamtlauf-codex-09-11.md`: Supabase-Gesamtlauf,
eigener Prüfserver auf 3300; fremde Ports 3000/8081 bleiben tabu.
Testbestand beim Start durch Claude belegt; Belegungsversuche alle drei Minuten,
maximal vier Stunden, ohne Erzwingen oder Übernehmen.
Server per `PORT=3300 npm start` aus diesem Worktree gestartet, HTTP 200 geprüft.
Adressvariablen: `BASE`, `BASIS`, `ZIEL`, `AM_URL`, `AM_BASIS` jeweils
`http://localhost:3300`. `SUPABASE_TOKEN` vorhanden, nicht ausgegeben.
Lokale, ignorierte Env-Dateien vorbereitet; keine Schlüssel im Commit.

Vorbefund: `smoke.js:59` verwendet die feste Adresse `http://localhost:3000`;
`_uebernacht.js` verwendet ebenfalls feste Standardadressen ohne Env-Auswertung.
Beides unverändert auch auf main fbf0e79. Der Auftrag verlangt bei einem Lauf
gegen 3000 den Abbruch; der bestehende Prüfserverwächter bleibt eingeschaltet.

`npm ci --ignore-scripts` gemäß Lockdateien: web 109, app 571 Pakete installiert.
Audit meldet web 4 Lücken (2 mittel, 1 hoch, 1 kritisch), app 14
(1 niedrig, 7 mittel, 5 hoch, 1 kritisch). Keine Abhängigkeiten geändert.
Web: body-parser hoch, proxy-addr kritisch, ip-address und qs mittel.

Budget-/Hook-Freigaben laut Auftrag erledigt: alle fünf Hooks konfiguriert,
Vertrauenseintrag vorhanden, vorheriger Budgettest 13/13. Hier keine
Hook-Konfiguration gelesen, geändert oder erneut geprüft.


## Gesamtlauf 09.11. — Abschluss am 10.11.: wartet weiter

Status: **wartet weiter**. Der Testbestand blieb bei sämtlichen Belegungsversuchen
exklusiv durch Claude belegt (`Paket 5: Live-Läufe community/henrik/k28-commbild`,
seit 09.11. 21:51). Keine fremde Belegung übernommen, erzwungen oder gelöst.
Der Gesamtlauf wurde deshalb nicht gestartet: **0/75 Läufe**, Prüfungen nicht
gemessen, Nenner unbekannt. Keine vollständige Liveabnahme.

Beginn des protokollierten Wartens: 09.11. 21:58:53; Sollfrist: 10.11. 01:58:53.
Die Wiederholung lief mit 180 Sekunden Abstand und einer Vierstundengrenze auf
monotoner Prozesszeit. Abweichung: Die beobachtete Kalenderzeit sprang zwischen
kurzen Werkzeugaufrufen von 01:51 über 04:29 auf 06:24; die Warteschleife lief
dabei noch. Die Kalenderfrist wurde damit überschritten. Nach Feststellung
Warteschleife sofort beendet; keine weiteren Belegungsversuche. Eine Ursache
für die abweichenden Uhren wurde nicht nachgewiesen.

Vorbereitung vollständig: eigener Server `PORT=3300 npm start`, HTTP 200;
`web/.env.local` gemäß Auftrag aus dem Hauptordner kopiert, App-Testkonfiguration
aus dem erlaubten Worktree `~/allmedia-wt/p5-main/app/.env.local` kopiert.
Beide Dateien lokal ignoriert, Schlüssel weder ausgegeben noch committet.
`BASE`, `BASIS`, `ZIEL`, `AM_URL`, `AM_BASIS` für 3300 identifiziert;
`SUPABASE_TOKEN` vorhanden. Prüfbrowser startet und schließt erfolgreich.

Zusätzlicher statischer Befund, noch nicht live geprüft: `app/test/smoke.js:59`
verwendet fest `http://localhost:3000`; `_uebernacht.js:82,137,249` verwendet
ebenfalls Standardadressen auf 3000 ohne Env-Auswertung. Beide Befunde stimmen
mit main fbf0e79 überein (`git show main:…`), gehören nicht zu Paket T.
Die verlangte einzelne Live-Gegenprobe gegen main konnte mangels eigener
Testbestandsbelegung ebenfalls nicht stattfinden. Keine Quellkorrektur vorgenommen.
Bei Fortsetzung vor jeder Anmeldung auf 3000 abbrechen, wie beauftragt.

Nachzählung/Testhygiene: **nicht live gemessen**, da ohne eigene Belegung verboten.
Kein Gesamtlauf und keine Anmeldung/Reset/SQL durch diese Sitzung gestartet;
kein Bereinigungsjournal und keine Gesamtlaufsperre vorhanden. Daher keine
verifizierte Restzahl 0 behauptet. Claudes Bestand blieb unangetastet.

Eigenen Server 3300 beendet; anschließend kein Listener auf 3300.
Eigene Warteschleife beendet. Keine eigene Testbestandsbelegung zu lösen;
fremde Belegung bleibt bestehen. Isolierte main-Gegenprobe nicht ausgeführt.
Kein main/Push/Deploy/Schema, keine echten Konten, keine Änderungen an Paket 5.

Abhängigkeiten mit unveränderten Lockdateien installiert: web 109, app 571 Pakete.
Audit web: 4 Lücken (2 mittel, 1 hoch, 1 kritisch); app: 14
(1 niedrig, 7 mittel, 5 hoch, 1 kritisch). Keine Updates ausgeführt.
Web-Befunde: body-parser hoch, proxy-addr kritisch, ip-address und qs mittel.

Budget-/Hook-Freigaben laut neuem Auftrag erledigt: alle fünf Hooks,
Vertrauenseintrag, vorheriger Budgettest 13/13. Keine Hook-Konfiguration geändert.
Die älteren Aussagen über offene Budgetfreigaben sind damit überholt.
Sechs-Stunden-Hinweis im Sitzungskontext erhalten; keine riskanten Schritte begonnen.

Offen: Nach regulärer Freigabe des Testbestands Gesamtlauf unter eigener Belegung
starten; feste 3000-Adressen beachten, bei einem solchen Lauf abbrechen und melden.
Erst danach Lauf-/Prüfnenner, Einzelursachen, main-Gegenprobe und Restzahl 0 prüfen.


## Gesamtlauf 09.11. — Wiederaufnahme 10.11.

Nachtrag angewandt: `testbestand` und `port-3000` erfolgreich für diese Sitzung
belegt; eigener Prüfserver aus diesem Worktree auf Port 3000 gestartet.
Alle fünf Adressvariablen BASE, BASIS, ZIEL, AM_URL, AM_BASIS zeigen auf 3000;
SUPABASE_TOKEN vorhanden. Lokale Env-Dateien bereits vorhanden und ignoriert.

Erster Start sicher vor den Prüfungen blockiert: 164 alte Testmitteilungen ohne
Laufjournal. Herkunft gezielt geprüft: 138 Test→Demo, 26 Demo→Test; keine anderen
Beteiligten. Nur diese 164 zuvor erfassten UUIDs mit erneutem Test/Demo-Filter
entfernt, Löschzahl 164. Lokaler Herkunftsbeleg unter
`app/test/.gesamtlauf-belege/altbestand-10-11.json`, keine Inhalte oder Schlüssel.
Zweiter Start erfolgreich; Laufkennung und 75er-Laufliste werden protokolliert.
Ergebnisse und Abschlussbereinigung folgen nach Laufende.

Zwischenstand während Lauf `2a8249ab-2403-4eeb-a9ce-293539effb94`: 22/75
Läufe abgeschlossen, 528/532 Prüfungen bestanden. Explorer 18/21: Hashtag-Seite
öffnet nicht innerhalb 3000 ms, passende Beiträge und Abschnittsüberschrift fehlen
als Folge. Kontaktinfo 9/10: Chatdesign-Rückweg wartet 3000 ms vergeblich auf
`.kp__zeileText`. Beide Prüfdateien und die Website sind unverändert gegenüber
main fbf0e79. Isolierter main-Stand für spätere Einzelgegenproben vorbereitet;
keine parallelen Liveprüfungen. Noch keine Aussage zur Abschlussbereinigung.

Weiterer Zwischenstand: 41/75 Läufe, 1099/1104 Prüfungen grün. Zusätzlich
Chatoptionen 16/17: „Mitteilungen“ nach erneutem Öffnen wieder eingeschaltet.
Prüfdatei unverändert gegenüber main. Querformat dagegen 37/37 grün.
Die übrigen bisher abgeschlossenen Läufe bestanden; noch keine Endzählung.
