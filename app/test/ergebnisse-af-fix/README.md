# AF-Zweitprüfung: Nachweis der Behebung B1–B7

26.10.2026 · Basis `a5eccc5` · Zweig `codex/bunny-anschluss-2026-10-26`.
Alle sieben Befunde am aktuellen AF4-/Bunny-Stand bearbeitet. Kein Merge, Push,
Deploy, Konto, Kauf oder echter Bunny-Aufruf. Sämtliche Schemas bleiben Entwürfe.

## Vorher und nachher

| Befund | Commit der Behebung | Rotnachweis | Aktueller Nachweis |
|---|---|---|---|
| B1 | dba3849 | Alte Storage-Löschung + Neu-INSERT tatsächlich möglich; Adapter löscht ohne Rechteprüfung | Adapter 3/3; Rollenprobe 14/14 einschließlich Karussellvideo an zweiter Stelle |
| B2 | 161e2d3 | Fremdzustellung vor strengeren Regeln reproduziert | Rollenprobe 19/19, darunter Kontaktrichtung am Empfänger |
| B3 | 3387cf6 | Komponente verbraucht Sprung nicht | Komponente 4/4: Öffnen, Rückkehr, Kontowechsel, neue Mitteilung |
| B4 | a8ebb53 | Abgelehnter Dislike wird als Repost protokolliert | Callback 1/1, einschließlich Zurücksetzen |
| B5 | 8deb9e9 | Wiederholen lädt zweimal hoch; App lässt Datei bei DB-Fehler zurück | Website 6/6, App 3/3; zusätzlicher echter Browserweg mit beiden Speichern |
| B6 | 659b5a5 | Empfangsabwahl verändert Zahl 1 → 0 | Rollenprobe 10/10: konstante Listengröße, keine Zustellung/Quittung, 24-h-Aufräumen |
| B7 | 085c661 | Unbekannte Zahlen erscheinen als feste Null | App-/Websitekörper 7/7, Browserbilder für Laden/Fehler/bestätigte Null |

Ein zusätzlicher Abschlusscommit ergänzt die Kontaktrichtung nach Schema 57,
Browsernachweise und die Karussell-Rollenregression. Die Kontaktprüfung verwendet
beim Empfänger dieselbe Senderichtung wie beim Versand; anonyme Aufrufe gesperrt.
B2 ist ausdrücklich **Vorgabe bis Henriks Entscheidung**: eigene Enge-Freunde-Liste
UND (gegenseitiges Folgen ODER Kontakt nach Schema 57); beide Konten nach 52/58 frei.

## Endstand der Prüfung

- `offline.txt`: 17/17 Läufe, **244/244** Einzelprüfungen. Bestehende Bunny-/AF-Läufe
  plus sechs neue reine Prüfläufe. B4-Ausgabe anschließend an den Zähler in
  `test/alles.js` angepasst und nochmals 1/1 ausgeführt.
- `vorher.txt`: **6/6** erwartete rote Assertions am festen Vorgänger. Kein
  Worktree-Wechsel, keine Änderung alter Dateien, keine Cloud.
- `schema.txt`: B1 **14/14**, B2 **19/19**, B6 **10/10**; Vorher/Nachher jeweils
  innerhalb derselben verworfenen Transaktion. Rollbackkontrollen **3/3**.
- `schema113.txt`: bestehende vollständige Bunny-/Karussell-Rollenprobe **38/38**,
  Rollbackkontrolle **1/1**. Zusammen **81/81** SQL-Prüfungen, **4/4** Rollbacks.
- `browser.txt`: neue echte Browser-/Serverwege **9/9**, einschließlich Wiederholen
  ohne erneuten Upload, Pflichttext vor Upload, Abbruchbereinigung in Bunny und
  Supabase sowie Schutz veröffentlichter Dateien.
- Bestehender lokaler Serverlauf `bunny-anschluss.js`: **22/22**.
- Bestehender Browser-/App-Bibliothekslauf `bunny-bilder.js`: **14/14**.
- `npx tsc --noEmit`: grün. `syntax.txt`: **22/22** geänderte/neue JS-Dateien.
- Vier neue PNGs angesehen. `b7-fehler.png` nach Entfernen eines stehengebliebenen
  Ladehinweises nochmals erzeugt und angesehen. Graph mittels `graphify update .`.

## Wiederholung

Rein offline: `node app/test/af-fix-vorher.js`, danach `node app/test/af-fix-b1.js`,
`af-fix-b3.js`, `af-fix-b4.js`, `af-fix-b5.js`, `af-fix-b5-app.js`, `af-fix-b7.js`.
Browser/Server: `node app/test/af-fix-bilder.js` (startet und stoppt ausschließlich 3300).
SQL: `node app/test/af-fix-b1-schema.js`, `af-fix-b2-schema.js`, `af-fix-b6-schema.js`.
SQL erfordert eigene `supabase-schema`- UND `testbestand`-Belegung sowie Token nur
in der Umgebung; kein Login, Reset oder Cloud-Medium. Bewusst nicht in test:alles.

## Prüfgrenzen und Freigabe

Keine dauerhafte Einspielung. Code/Server/Schema 109/111/113 gemeinsam freigeben;
Supabase-Postdateien werden nach Besitz-/Referenzprüfung mit Dienstschlüssel gelöscht.
Keine tatsächliche Bunny-Zone, Cache-/Pull-Abnahme, Bestandsmigration, native iOS-/
Android-Sichtabnahme oder Gesamt-Liveabnahme. Kein Beleg für konkurrierende Requests.
Ein Browser-/Prozessabsturz ohne Schließereignis kann weiterhin Restdateien lassen;
gescheitertes Aufräumen wird angezeigt. Bereits ausgestellte Signaturen bleiben bis
Ablauf gültig. Bisherige unverifizierte Instant-Storage-/Native-Prüfgrenzen gelten weiter.
