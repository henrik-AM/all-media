# Paket 7 — Fortsetzung von Claudes Stand, 16.11.2026

Henrik beauftragt ausdrücklich die Fortsetzung dort, wo Claude aufgehört hat.
Basis: deb76d5 (`codex/paket-7-chatklingel-2026-11-15`). Claudes Zwischenstand
b7223140: Gesamtlauf2 auswerten, adversarial prüfen, Veröffentlichung erst
nach erfolgreicher Prüfung und belegter Freigabe. Paket6-Reviewzweig bleibt
getrennt: Schema127 nicht live, kein Einmischen in Paket7.

Aktiver Bestandslauf448ad47e, PID59127, ursprünglicher Worktree paket-7.
Bei Übernahme23/100,487/490 zählbare Prüfungen, sechs fehlerhafte Läufe:
einstellungen/kontaktinfo/insel ohne vollständige Prüfzahl; henrik/kasten8
mit Abbruch trotz Teilprüfungen; optionen13/16. Zeitgrenzen, Reset-Fetchfehler,
ein WebSocket-Handshakefehler; Ursachen noch nicht abschließend eingeordnet.
Der Lauf arbeitet nach der Nacht weiter (Logfortschritt selbst beobachtet).
Fremde Belegungen bleiben bis zu dessen Ende erhalten; vier Glocken-PNGs
und ungesichertes Claude-Laufprotokoll nicht verändert.

## Gegenprüfung von deb76d5

Claudes chatStummWunsch blieb nach Bestätigung unbegrenzt erhalten. Schaltet
ein Zweitgerät später zurück auf den ursprünglichen Wert, wird der alte lokale
Wunsch wieder aktiv. Derselbe Wunsch war außerdem nicht ans Konto gebunden.
Schnelle Tipps starteten parallele feste Schreibwerte; eine verspätete
Fehlantwort konnte einen jüngeren Wunsch entfernen.

Isolierter Fortsetzungszweig `codex/paket7-claude-fortsetzung-2026-11-16`,
Worktree `~/allmedia-wt-codex/paket-7-fortsetzung`. Kein Produkt-/Prüfcode im
laufend gemessenen ursprünglichen Worktree geändert.

Korrektur ausschließlich ProfilContext: kontoabhängige, nummerierte Wünsche,
Entfernen nach Serverbestätigung bzw. bestätigtem Schreiben plus Listenabruf,
serielle Schreibaufträge je Konto/Chat, Fehler-Rückweg nur für den betroffenen
aktuellsten Wunsch. Die bisherigen zwei Bildschirm-Aufrufer bleiben erhalten.

Originale Callback-Ausschnitte mit kontrollierten React-Hooks geprüft:
- gleicher Serverwert nach späterer Änderung vom Zweitgerät;
- Kontowechsel bei ausstehendem Schreiben;
- zwei schnelle Tipps: an/aus seriell und zuletzt gewünschter Wert sichtbar;
- verspäteter Schreibfehler löscht keinen neueren Wunsch.

**Altstand0/4, Korrektur4/4.** Weitere Klingel-/Kuvert-/Generationsregressionen
**26/26**, TypeScript Exit0. React19.3.0, React Native0.88.1, Expo~58.0.24;
Context7 React-Doku zu Effect-Synchronisierung und veralteten Antworten vor Code
abgerufen. Native/Live-Abnahme dieser neuen Korrektur noch offen.

Vor weiteren Eingriffen nach der Sechs-Stunden-Sitzungsmeldung Zwischenstand
gesichert und eine Pause eingelegt. Keine laufende Migration beendet.
Kein Schema, main, Push oder Deploy durch diese Fortsetzung.
