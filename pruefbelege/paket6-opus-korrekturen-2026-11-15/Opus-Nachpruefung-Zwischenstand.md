# Paket 6 – Nachprüfung der Opus-Korrekturen (Claude Opus 5.5, unabhängig)

- **Datum:** 15.11.2026
- **Reviewbasis:** `966f283`
- **Gegenstand:** Worktree `paket6-claude-review`.

**Der Prüfgegenstand hat sich während der Prüfung mehrfach geändert.** Begonnen habe ich auf HEAD `d84ae72`. Abgeschlossen habe ich auf HEAD `ec149f5` plus einem Arbeitsstand mit Änderungen in Schema 127, `aktionen.ts`, `krypto.ts`, `ContactProfileScreen.tsx`, `gemeinsam/krypto.js`, `web/public/app.js`, `supabase-api.js` und `sync-handlers.js`.

Die Hauptsitzung hat dabei die von mir belegten Lücken N1, N2 und N3 parallel behoben. Alle Gegenproben und Tests habe ich am **Endstand** wiederholt.

Ausschließlich offline. Kein Supabase, keine `.env`, keine Installation, kein Simulator, kein Commit, keine Produktänderung durch mich. Schlüsselmaterial wird nicht ausgegeben. Gegenproben und Protokolle liegen in `/private/tmp/paket6-opus-nachpruefung/`.

## Urteil

**Am Endstand sind F2, F3 und F4 behoben, F1 nur teilweise.**

- **Belegter offener Befund:** **N4**, ein Rest von F1. Die gemeinsame Paarnummer erkennt kein Zusatzgerät, das der Server beiden Seiten gleich zeigt.
- **Behoben:** Drei während der Prüfung gefundene Regressionen bzw. Integrationslücken (N1 Sendezeit, N2 App-Weiterleiten, N3 Browser-Anhang mit Bezug). Belegt habe ich sie am Zwischenstand, nachgeprüft am Endstand.
- **Weiterhin nicht veröffentlichungsreif:** Schema 127 ist nicht live. Der N1-Schutz für App-Sendungen hängt allein an Schema 127, und dessen SQL-Probe habe ich nicht selbst ausgeführt. Es gibt keinen Live- oder RLS-Nachweis.

## Status der ursprünglichen Befunde

| Befund | Status am Endstand | Beleg |
|---|---|---|
| F1 Sicherheitsnummer nicht vergleichbar | **teilweise**: gemeinsame Paarnummer, auf beiden Seiten gleich; eine geteilte Sicht fällt auf. Rest offen: N4 | N4 4/4 |
| F2 Migration verliert Altpaar | **behoben**: Altfach bleibt; Übernahme nur bei registrierter Zeile (`user_id`, `pub(L)`), mit historischer Gerätekennung; neues Konto erbt nichts; Abfragefehler führt zu keinem Schlüssel und keinem Ersatzpaar | N5 5/5 (App und Web) |
| F3 Bearbeiten schreibt Klartext | **behoben**: App prüft über `fuerChatVerschliessen`, Server über Format- und `sendeweg`-Prüfung | `_paket6_opus.cjs`; Code-Review |
| F4 Wiedereinspielen | **behoben für Format 2**: Bindung an id, Chat, Absender, reply/quote und Zeit; Kopie und Herabstufung sind unlesbar; Format 1 zeigt „Absender nicht prüfbar“ | `_paket6_opus.cjs` Format-2-Fall; Code-Review |

## Offener Befund

### N4 – Paarnummer erkennt kein Gerät, das der Server beiden Seiten gleich unterschiebt (mittel, Rest von F1)

- **Wo:**
  - `gemeinsam/krypto.js` (`paarSicherheitsnummer`)
  - `app/screens/messenger/ContactProfileScreen.tsx` (kryptoZustand-Effekt, Hinweistext)
  - `web/public/app.js` (`kryptoZustand`, `kontaktZeile`)
- **Ursache:** Es gibt eine Nummer und nur eine Gesamtzahl „N Geräteschlüssel“. Es fehlen eine Zahl je Konto, eine eigene Geräteliste und ein Hinweis auf ein neues Gerät. Der Server liefert beiden Clients die Listen. Legt er unter B ein Gerät X an und zeigt es beiden (der Normalfall eines Einschubs), dann gilt:
  - Beide Nummern ändern sich gleich, der persönliche Vergleich besteht.
  - A und B verschlüsseln künftig auch für X.
  - Ein echtes neues Gerät sieht genauso aus. Nutzer kennen ihre Schlüsselzahl wegen liegen gebliebener Browser- und Altschlüssel nicht (Codex' Bericht: 16 reale Schlüssel bei einem Prüfkonto).
- **Was erreicht ist:** Eine geteilte Sicht (A sieht X, B nicht) erkennt der Vergleich jetzt. Das ist ein echter Fortschritt gegenüber F1.
- **Was offen bleibt:** Der Hinweis „Vergleicht sie erneut, wenn ein Gerät dazukommt“ setzt Wissen voraus, das das Produkt nicht anzeigt.
- **Beleg:** `gegenproben.cjs` N4, **4/4** (am Endstand unverändert belegt): Der Einschub ändert die Nummer, beide Seiten sehen danach dieselbe Nummer, die Rückgabe enthält nur `{nummer, geraete=3}`; Gegenprobe: eine geteilte Sicht wird erkannt.
- **Empfehlung:**
  - Gerätezahl je Konto anzeigen.
  - Eigene Geräteliste mit Art und Datum, widerrufbar.
  - Hinweis im Chat, wenn ein Schlüssel dazukommt.
  - Bis dahin im Text offen sagen, dass ein beiden gleich gezeigtes Zusatzgerät nicht auffällt.

## Während der Prüfung belegt, am Endstand behoben

### N1 – Format 2 machte die angezeigte Sendezeit vom Absender frei wählbar (mittel; Regression durch den F4-Fix)

- **Zwischenstand d84ae72:** Die App setzte `created_at = krypto_gesendet_am` (`krypto.ts`), die Website zeigte `krypto_gesendet_am` vor `created_at`. Server und Schema 127 nahmen beliebige Werte an. Das unterlief Schema 95 (`anlegen_vorgaben`: `created_at := now()`).
- **Beleg:** `gegenproben-d84ae72.log`, **8/8**: Eine um zwei Wochen zurückdatierte Nachricht wird angenommen, öffnet gültig, App und Web zeigen die Absenderzeit ohne Warnung.
- **Endstand:**
  - Anzeige wieder `created_at` (App und Web).
  - Server lehnt mehr als 5 min Abweichung ab (`handleSendMessage`, `handleNachrichtWeiterleiten`).
  - Schema 127 verlangt `krypto_gesendet_am` innerhalb von ±5 min um `created_at`. Da der BEFORE-Trigger `created_at := now()` vor dem CHECK läuft und `created_at` per `spalten_fest` unveränderlich ist, gilt das auch für spätere Updates.
  - `gegenproben-final.log`: Die N1-Aussagen sind nicht mehr belegbar, der Server antwortet „Die Sendezeit stimmt nicht …“.
- **Rest:** App-Sendungen gehen direkt an Supabase. Ihr Schutz besteht **nur** durch Schema 127, das nicht live ist und dessen SQL-Probe ich nicht selbst ausgeführt habe.
- **Neue Nebenwirkung (Hinweis, kein Sicherheitsbefund):** Bei einer Geräteuhr mit mehr als 5 min Abweichung scheitert jede verschlüsselte Sendung (App: Constraint-Fehler; Web: Serverhinweis). Live prüfen, ob die App dafür eine verständliche Meldung zeigt.

### N2 – App-Weiterleiten von Format 2 war unmöglich (mittel, funktional)

- `nachrichtWeiterleiten` las ohne Kontextspalten; die Nachricht war „nicht lesbar“, das Weiterleiten wurde abgelehnt (kein Leck).
- Beleg am Zwischenstand: 3/3.
- Endstand: Select ergänzt, Gegenprobe öffnet.

### N3 – Browser-Anhang als Antwort oder Zitat war für alle unlesbar (mittel, funktional)

- `anhangSenden` verschloss ohne Bezug, die Route setzte aber `reply_to`.
- Beleg am Zwischenstand: 5/5.
- Endstand: Bezug wird durchgereicht; `n3_neu.cjs` **2/2**.

## Format-2-Wege am Endstand (Code-Review und Gegenproben)

| Weg | App | Browser/Server |
|---|---|---|
| Senden | Kontext mit id/zeit; `...paket.spalten` setzt id und `krypto_gesendet_am` | `sendeKoerper(chat, text, bezug)`; Server prüft UUID und ±5 min |
| Antwort/Zitat inkl. Anhang | im Kontext und in `reply_to`/`quote_of` | ok (N3 behoben) |
| Kontakt, Teilen, Story-Antwort, Einladung | über `nachrichtSenden` | `kryptoAngaben`/Routen reichen `nachrichtId`/`gesendetAm` durch |
| Weiterleiten | ok (N2 behoben) | je Ziel neu verschlossen, id/Zeit geprüft |
| Öffnen Verlauf/Vorschau/Bezug | `kontextAusZeile`; Vorschau über `letzte_nachrichten` `m.*`; Bezug-Select erweitert | `previewKrypto`/Bezug/Verlauf mit echter senderId, chatId, Bezügen, gesendetAm; lokal gesendete Nachricht ergänzt |
| Bearbeiten | `umschliessen` öffnet erst mit Kontext und behält ihn | wie App |
| Melden | `meldebeleg` mit Kontext; `belegPruefen` entfernt Format-2-Hülle | wie App |
| Format 1 / Klartext | weiterhin lesbar, Format 1 mit Warnung; als Format 1 gelabeltes Format 2 → null | wie App |

**Unbelegte Restpunkte (Vermutung, nicht als Befund gewertet):**
- Ein Datenbankschreiber kann eine bearbeitete Nachricht auf eine frühere Chiffre derselben Nachricht zurücksetzen, weil `edited_at` nicht gebunden ist.
- Veränderte Clients können weiter neue Format-1-Nachrichten schreiben. Im Verlauf erscheinen sie mit Warnung, in der Chatlisten-Vorschau ohne.

## Ausgeführt (Endstand)

| Prüfung | Ergebnis |
|---|---|
| `_krypto_einheit.js` | 36/36 |
| `_krypto_web_einheit.js` | 16/16 |
| `_krypto_server_einheit.js` | 18/18 |
| `_krypto_app_einheit.js` | 18/18 |
| `_paket6_opus.cjs` | 12/12 |
| `_paket6_kuvert_regression.cjs` | 13/13 |
| `_paket6_weiterleiten_regression.cjs` | 3/3 |
| `_paket6_chatgeneration_regression.cjs` | 4/4 |
| **Summe vorhandene Tests** | **120/120**, alle Exit 0, Offline-Sperre aktiv |
| TypeScript `tsc --noEmit` (App) | Exit 0 |
| `node --check` auf 4 geänderte JS-Dateien | 4/4 |

Eigene Gegenproben:

| Lauf | Ergebnis |
|---|---|
| `gegenproben.cjs` an `d84ae72` | **25/25** belegt (N1 8, N2 3, N3 5, N4 4, N5 5) |
| `gegenproben.cjs` am Endstand | **14/25** belegt: N4 4/4 und N5 5/5 weiter belegt; die 11 Abweichungen sind die behobenen N1/N2/N3-Aussagen bzw. Folgeaussagen |
| `n3_neu.cjs` (Endstand) | 2/2 |

## Nicht geprüft / Grenzen

- **Nicht selbst gemessen:** SQL-Probe mit PGlite 10/10 (`_paket6_schema127.cjs`; Modul ohne Installation nicht verfügbar), Browser 26/26 (Chromium/Server-Port), Offline 52/52 und Krypto/Melden 193/193 der Hauptsitzung.
- **Schema 127:** Den neuen ±5-min-CHECK habe ich nur gelesen, nicht ausgeführt.
- **Kein Live-Nachweis:** RLS, Trigger und echte Geräte sind aus Code und SQL abgeleitet.
- **Ausrollen:** Alte Clients können Format 2 nicht lesen; neue Clients und Schema 127 müssen zusammen ausgerollt werden (bekannt).
- **Migration:** Hat ein Konto unter dem alten Stand 627fa86 bereits ein neues Paar erhalten, greift die neue Migration für dieses Konto nicht mehr. Relevant nur, falls 627fa86 bei Nutzern ausgerollt war; das ist nicht belegt.
- **Prüfgegenstand nicht stabil:** Weitere parallele Änderungen nach meinem letzten Lauf sind von diesem Bericht nicht gedeckt.
