# Testhygiene und Sitzungsbudget, 05.11.2026

Basis: main ad7f221. Testablauf-Korrektur: b512c56, nur eigener Zweig.

- Fixtures werden vor dem Quellenfingerabdruck vorbereitet; der Quellwächter bleibt aktiv.
- Vor dem Gesamtlauf: eigene KI-Belegung, passender Server, Bereinigungstoken/Projekt und leerer Altbestand erforderlich.
- Lauf-UUID und DB-Zeitgrenze im lokalen Journal; Benachrichtigungen beider erlaubten Testkonten werden nur seit Beginn entfernt. Nachzählung über beide Konten muss null ergeben. Unklarer Altbestand wird nicht pauschal gelöscht.
- Laufende Kinder/Browser beenden, dann bereinigen. SIGINT/SIGTERM und Zeitlimit sind behandelt. Bei SIGKILL bleibt das Journal; ein noch lebender oder unklarer alter Prüfprozess blockiert die Wiederaufnahme.
- Rohprotokolle und Abschlussstatus bleiben je Laufkennung erhalten. Bereinigungsfehler, fehlende/0 Prüfzahlen und fehlende Läufe verhindern Exit 0.
- Sechs-Stunden-Warnung im Gesamtlauf. Zusätzlich eigenständiger Sitzungswächter: aktive Zeit zwischen SessionStart/UserPromptSubmit/PreToolUse und Stop/SessionEnd; mindestens 30 Minuten Pause setzen zurück. Komprimierung setzt nicht zurück. Nur Hinweis, kein Prozessabbruch, kein Netzwerk, keine Prompt-/Transkriptspeicherung.

## Prüfungen

- Testhygiene: 22/22 (`node --test app/test/_testhygiene_offline.js`).
- Belegungsschutz: 18/18 (`bash app/test/_ki_belegung_probe.sh`).
- Schema/Code: 7/7 (`node app/test/_schema.js`).
- Sitzungsbudget: 13/13 (`python3 -B -m unittest discover -s Claude/Tools -p test_sitzungsbudget.py -v`, aus Henrik/).
- Bunny-Adapter: 138/138; Umzug: 2/2, ausschließlich lokal/Attrappen. Kein vollständiger Review.
- Keine echte SQL-Ausführung, kein Cloudlauf, keine Installation von Abhängigkeiten, kein main/Push/Deploy.

## Sitzungswächter: Originale und Einbau

Aktive Originale unter Henrik/Claude/Tools/. Der beigefügte Patch ist ein unveränderlicher Review-Snapshot, keine zweite aktive Installation. Codex-Konfiguration wurde um fünf Ereignisse ergänzt; vorhandene Hookdefinitionen und Vertrauenseinträge blieben unverändert. Neue Hooks sind noch nicht als vertrauenswürdig bestätigt; Henrik muss sie in `/hooks` prüfen/freigeben. Claude-Einbau ist vorbereitet, Zugriff auf ~/.claude/settings.json ist noch nicht genehmigt.

Quelle für Codex-Schema und Vertrauensmodell: https://learn.chatgpt.com/docs/hooks (05.11.2026). Verwendet wurden systemMessage und additionalContext, keine Blockierentscheidung.

SHA256 der Originale zum Snapshot:
- `Claude/Tools/sitzungsbudget.py`: `024b80c233d981decd066106401ec23f5e9b8bb5bcbccebe41171005cb58243a`
- `Claude/Tools/test_sitzungsbudget.py`: `89e809b827739a041c8f06a7f1db834e1a936d9bf064f51fc9e2eda7f8948393`
- `Claude/Tools/sitzungsbudget-hooks.json`: `02fe6a00f29b1278f300648d376dcd9bf181eb1a0b78229692bd72fed306340c`
