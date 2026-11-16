# Einmalige Claude-Prüfschleife

Alle drei Pflichtprüfungen sind grün, der gemeldete Fehler beim Stummschalten tritt aber erneut auf (**reproduziert**).

- `node --test app/test/_paket7_stumm_regression.cjs`: Exit 0, 7/7 bestanden, 0 fehlgeschlagen.
- `node --test` mit `_paket7_regression`, `_paket6_chatgeneration`, `_paket6_kuvert`: Exit 0, 26/26 bestanden, 0 fehlgeschlagen.
- `npm run lint --prefix app` (`tsc --noEmit`): Exit 0.
- Nachstellung im Sitzungstemp: Exit 1, 0/1 bestanden. Ablauf: eigenes Stummschalten bestätigt, Liste lädt nicht, Zweitgerät stellt zurück, danach zweimal frische Liste mit „nicht stumm“. Die Anzeige bleibt beide Male „stumm“.
- Ursache in `app/contexts/ProfilContext.tsx` (Zeilen 1002–1091): Ein gespeicherter Stumm-Wunsch wird erst entfernt, wenn die Serverliste genau diesen Wert zeigt. Stand der Server schon vor der ersten geladenen Liste wieder auf dem alten Wert, bleibt der Wunsch dauerhaft stehen.
- Abweichung: Die Worktree steht auf `1eef00b`, nicht auf `150a88d`. Unterschiede gibt es nur in zwei Testhilfen (`app/test/_konto.js`, `_uebernacht.js`), nicht im Produktcode. Das Repository ist unverändert, die Claude-Quota reichte.

Eigene Claude-Züge: 6; Ausführungsergebnis: success
