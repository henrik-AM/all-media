# Ausführungsartefakte vom 12./13.11.2026

Keine aktiven Jobs. Verbindlicher Abschluss: ../sdk58-abschluss-13-11.json und Bericht Paket-6-SDK58-Abnahme-13-11-2026.md. Historische Statusdateien können nach abgebrochenen Controllern „laeuft“ enthalten; dies ist kein aktueller Prozessnachweis. Teil- und Koordinationsabbrüche zählen nicht zur Abnahme.

Die Skripte dokumentieren die tatsächlich verwendete lokale Ausführung im eigenen Worktree und der zugehörigen Codex-Sitzung. Absolute Pfade und Sitzungskennungen sind Belegkontext; Zugangsdaten werden ausschließlich aus den vorhandenen Konfigurations-/Tokendateien im RAM geladen. Terminal-Controller hielt die vollständigen Läufe unabhängig vom Codex-Daemon. Testbestand und verwendete Ports waren jeweils exklusiv belegt.

native2-bedienung.py enthält die identische modale Zurück-Auswahl, die anschließend in den regulären Python-Prüftreiber übernommen wurde. produkt-fixture.cjs erstellt und beseitigt nur journalisierte Testfixtures; normale App-Kontexte wurden dabei nicht ersetzt. produkt-beleg.py dokumentiert tatsächlich sichtbare Beschriftungen und Screenshots, keine simulierte Anmeldung. anmelden.cjs gibt keine Passwörter aus; finale Eingabe erfolgte per HID nach ABC-Umstellung im eigenen Simulator. Alle Prozesse am Abschluss beendet, Ressourcen freigegeben.
