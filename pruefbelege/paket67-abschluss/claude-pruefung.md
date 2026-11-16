# Einmalige Claude-Prüfschleife

Ergebnis: Ich habe nichts geändert, nichts belegt und nichts live getestet. Alle drei Pflichtläufe sind nicht gelaufen, deshalb kann ich Paket7 nicht abnehmen.

**Eigene Prüfzahlen: keine.** Die Sitzung lief im Modus „don't ask“, und dort wurden `node --test …` (zweimal) und `npm run lint` abgelehnt. Es gibt also keine eigenen Exitcodes und keine Gegenproben im Sitzungstemp. Ich habe nur die Differenz zu main und die Belege gelesen.

**Materieller Fund, Datei+Zeile:**
- `app/contexts/ProfilContext.tsx:1016`: Ein Wunsch wird nur gelöscht, wenn der Server genau den gewünschten Wert zeigt (`geschrieben && server === wert`). Ändert ein Zweitgerät den Wert, nachdem das eigene Schreiben bestätigt ist und bevor die Liste neu gelesen wurde, bleibt der Wunsch dauerhaft stehen. Die Anzeige zeigt dann „Aus“, obwohl der Server „An“ hat. Das widerspricht dem Kommentar bei Zeile 1000 („danach gewinnt der Server“).
- Fall im vorhandenen Prüfrahmen (`native-pruefen.py`):
  1. `reset()`, `transport lesefehler=N`, `tipps n=1`
  2. Während des Lesefehlers `remote wert=False`
  3. Lesefehler enden lassen. Erwartet „An“, tatsächlich bleibt „Aus“.
- Diese Prüfung fehlt in 19/19. Zeile 52 setzt den Fernwert erst nach einem erfolgreichen Lesen.

**Geringere Funde:**
- `DatenContext.tsx:198` und der Abruf in `nachsehen`: Beide setzen die Chatliste ohne Reihenfolgeschutz. Eine ältere Antwort, die später ankommt, kann einen Wunsch kurz zurückdrehen. Die nächste Klingel bzw. der nächste Takt korrigiert das.
- Die Fehlerwege in `ProfilContext.tsx:1077–1078` greifen nie, weil `chatsNeuLaden` Fehler selbst abfängt (`DatenContext.tsx:199`). Das schadet nicht, aber der Kommentar sagt mehr, als der Code tut.

**Zahlen sind konsistent:**
- Bei ab21c8a3 (101/101, 3351/3364, Code1, Rest0) fehlen genau die 13 Prüfungen: Explorer 10 + Fremdprofil + K28-Erstellen 3.
- `drei-status.json` stimmt: e78686c2, 3/3, 116/116, Code0, Quellen unverändert.
- `native-ergebnis.json` zeigt 19/19.
- Das ist weiterhin kein einzelner grüner Gesamtlauf.

**Verbleibende Abnahmelücken:**
- Die drei Pflichtläufe müssen nachgeholt werden.
- Ein vollständiger 101er-Lauf mit Code0 fehlt.
- Ob Explorer 11/21 am Overlay bzw. an Zeitgrenzen lag, ist nur durch die Wiederholung belegt, nicht ursächlich geklärt.
- Der Fall oben (Fernänderung zwischen Schreiben und Lesen) ist nicht abgedeckt.

**Paket6 (ee57c82) hängt bei der Veröffentlichung an Paket7:** Es ändert dieselben Dateien `app/lib/daten.ts`, `ContactProfileScreen.tsx` und `_paket6_kuvert_regression.cjs`, also gibt es Merge-Konflikte bzw. einen Prüfungsbedarf. Dazu kommen Schema127 und Format2, die vor dem Veröffentlichen von Web, Server und Krypto live abgenommen werden müssen. Beide Zweige zweigen von main ab.

Eigene Claude-Züge: 19; Ausführungsergebnis: success
