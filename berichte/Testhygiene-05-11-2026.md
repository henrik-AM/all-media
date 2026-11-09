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
- Sitzungsbudget: 13/13 (`python3 -B -m unittest discover -s Claude/Tools -p test_sitzungsbudget.py -v`, aus Henrik/).
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
