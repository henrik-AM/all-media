# Paket 6 – Fortsetzung mit Expo SDK 58

## Gesicherter Ausgangspunkt

Paket-6-Code auf `codex/paket6-kuvert-2026-11-11`, bisheriger Commit85d3cde. Der davor gestartete97er-Gesamtlauf wurde nach Nutzungslimit von Claude auf Henriks Anweisung gestoppt. Er ist kein vollständiger Nachweis. Das Rohprotokoll enthält24/97 protokollierte Einträge mit Abbrüchen und495/495 gezählten Einzelprüfungen; diese Zahlen dürfen nicht als Gesamtabnahme dienen. Aufräumen meldet254 entfernte Testmitteilungen, Rest0.

Sicherungszweig `sicherung/codex-paket6-kuvert-2026-11-12`, Commit39b5f55, bleibt erhalten. Die beiden Glockenbilder waren Prüfnebenprodukte; Arbeitskopie wird auf den vorherigen Bildstand zurückgestellt, Sicherung bleibt unverändert. Teilprotokoll separat als `pruefbelege/paket-6/live-alles-sdk57-abgebrochen-12-11.log` erhalten.

## Geplanter Abgleich

Aktuellen main757fc5c nur in den eigenen Codex-Zweig mergen. SDK58-Versionen übernehmen; eigene Paket6-Prüfskripte behalten. Lockdatei aus main, danach npm install zur Synchronisierung; npm ci für App und Website. Eigene isolierte Abhängigkeiten statt bisheriger Symlinks in den Hauptarbeitsordner. Expo-doctor und TypeScript anschließend frisch prüfen. Keine Veröffentlichung oder Schemaänderung. Ein vollständiger neuer Gesamtlauf erst auf dem gemergten Stand und nur mit ausreichendem Budget für etwa zwei Stunden.

## SDK-58-Basis übernommen

main757fc5c ließ sich automatisch ohne Konflikt mergen. Alle drei eigenen Paket6-npm-Skripte bleiben vorhanden. Lockdateien wurden ausdrücklich aus main übernommen und npm install bestätigte dieselben Fassungen. Beide node_modules-Symlinks zum Hauptprojekt wurden nur als Links entfernt; danach isolierte App-/Web-Installationen per npm ci, beide Exit0. Hauptprojekt-Abhängigkeiten unberührt. Die beiden eigenen nativen Prüfprojekte deklarieren ebenfalls Expo58/RN0.88/React19.3.

Frisch: TypeScript Exit0,21/21 Paket6-Gegenproben bestanden. Expo Doctor19/20: inzwischen verfügbare kompatible Patches Expo58.0.25 und expo-contacts58.0.11 werden empfohlen; keine Prüfungen ausgeblendet. Vor vollständiger Abnahme werden diese beiden SDK58-Patches im eigenen Zweig nachgezogen. App-Audit meldet drei mittlere Befunde, Web-Audit0. Kein npm audit fix --force und kein SDK-Downgrade.

## Frisch geprüfter Stand nach kompatiblen Patches

Nur zwei Lockfile-Auflösungen zusätzlich zu main geändert: Expo58.0.24→58.0.25 und expo-contacts58.0.10→58.0.11, innerhalb der übernommenen~58.0-Bereiche. Keine manuellen Lockfile-Merges. App anschließend erneut per npm ci reproduziert. Tatsächlich installiert: Expo58.0.25, ReactNative0.88.1, React19.3.0.

Expo Doctor **20/20**, TypeScript **Exit0**, Paket6-Kuvert-/Generations-/Öffnungsregressionen **21/21**. AST-Graph lokal ohne LLM aktualisiert. App weiterhin drei mittlere Abhängigkeitsbefunde; Website0. SDK58-Produktlauf und Nativeabnahme dadurch noch nicht bestätigt. Vor dem nächsten Gesamtlauf ausreichendes Kontingent für etwa zwei Stunden klären; derzeit kein eigener Server und keine Testbestandsbelegung. Paket8 wurde nicht weiterbearbeitet und muss vor dortiger Fortsetzung ebenfalls mit aktuellem main abgeglichen werden.
