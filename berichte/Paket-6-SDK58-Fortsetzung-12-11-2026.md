# Paket 6 – Fortsetzung mit Expo SDK 58

## Gesicherter Ausgangspunkt

Paket-6-Code auf `codex/paket6-kuvert-2026-11-11`, bisheriger Commit85d3cde. Der davor gestartete97er-Gesamtlauf wurde nach Nutzungslimit von Claude auf Henriks Anweisung gestoppt. Er ist kein vollständiger Nachweis. Das Rohprotokoll enthält24/97 protokollierte Einträge mit Abbrüchen und495/495 gezählten Einzelprüfungen; diese Zahlen dürfen nicht als Gesamtabnahme dienen. Aufräumen meldet254 entfernte Testmitteilungen, Rest0.

Sicherungszweig `sicherung/codex-paket6-kuvert-2026-11-12`, Commit39b5f55, bleibt erhalten. Die beiden Glockenbilder waren Prüfnebenprodukte; Arbeitskopie wird auf den vorherigen Bildstand zurückgestellt, Sicherung bleibt unverändert. Teilprotokoll separat als `pruefbelege/paket-6/live-alles-sdk57-abgebrochen-12-11.log` erhalten.

## Geplanter Abgleich

Aktuellen main757fc5c nur in den eigenen Codex-Zweig mergen. SDK58-Versionen übernehmen; eigene Paket6-Prüfskripte behalten. Lockdatei aus main, danach npm install zur Synchronisierung; npm ci für App und Website. Eigene isolierte Abhängigkeiten statt bisheriger Symlinks in den Hauptarbeitsordner. Expo-doctor und TypeScript anschließend frisch prüfen. Keine Veröffentlichung oder Schemaänderung. Ein vollständiger neuer Gesamtlauf erst auf dem gemergten Stand und nur mit ausreichendem Budget für etwa zwei Stunden.
