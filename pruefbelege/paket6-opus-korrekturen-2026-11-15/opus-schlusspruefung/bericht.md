# Paket 6 – Schlussprüfung (Claude Opus 5.5, unabhängig)

- **Datum:** 15.11.2026
- **Prüfgegenstand:** fest auf Commit `ee57c82`. `git status` war vor und nach der Prüfung sauber.
- **Fokus:** die Änderungen seit `ec149f5` und der Abgleich meiner Nachbefunde N1 bis N4.

Ausschließlich offline. Kein Supabase, keine `.env`, keine Installation, kein Simulator, kein Serverstart, keine Produktänderung, kein Commit, keine weiteren Agenten. Schlüsselmaterial wird nicht ausgegeben. Gegenproben und Protokolle liegen in `/private/tmp/paket6-opus-schlusspruefung/`.

## Urteil

**Am Stand `ee57c82` konnte ich offline keinen offenen materiellen Befund mehr belegen.**

- F2, F3 und F4 sind behoben.
- F1/N4 ist so weit behoben, wie es ohne Gerätewiderruf und ohne Konto-Identität geht. Die verbleibende Grenze wird in der Oberfläche ausdrücklich genannt und nicht als zugesichert dargestellt.
- N1, N2 und N3 sind behoben.

**Keine Freigabe zur Veröffentlichung aus dieser Prüfung:**
- Schema 127 ist nicht live.
- Der Zeitschutz für App-Sendungen hängt an Schema 127, das ich nur lokal mit PGlite geprüft habe.
- Ein Live-, RLS- und Native-Nachweis fehlt.

## Abgleich der Nachbefunde

| Befund | Stand `ee57c82` | Beleg |
|---|---|---|
| **N1** Sendezeit frei wählbar | **behoben**, Einzelheiten unten | Gegenprobe 9/9 N1-Aussagen, SQL 16/16 |
| **N2** App-Weiterleiten Format 2 | **behoben** (Select mit Kontextspalten und `created_at`, `aktionen.ts:2856`) | `_paket6_weiterleiten_regression.cjs` 3/3; frühere Gegenprobe öffnet |
| **N3** Browser-Anhang mit Bezug | **behoben** (`sendeKoerper(…, bezug)`) | frühere Nachprobe 2/2; Code unverändert seit Nachprüfung |
| **N4** Paarnummer verdeckt Einschub | **im zugesagten Umfang behoben**, Einzelheiten unten | Gegenprobe 5/5 N4-Aussagen |

**N1 im Einzelnen:**
- **Anzeige:** Die App ersetzt `created_at` nicht mehr; die Website zeigt `created_at`.
- **Server:** `handleSendMessage` und `handleNachrichtWeiterleiten` lehnen eine Abweichung von mehr als 5 min ab, ohne etwas zu schreiben.
- **Schema 127:** prüft ±5 min gegen `created_at`. Im Zusammenspiel mit Schema 95 (`created_at := now()`, `spalten_fest`) ist das Einfügen begrenzt.
- **Trigger `krypto_zeit_fest`:** macht `krypto_gesendet_am` unveränderlich. EXECUTE ist für `authenticated` und `anon` entzogen; der Trigger greift trotzdem (SQL-Probe: Update als `authenticated` wird mit 23514 abgewiesen, obwohl +1 min den CHECK noch bestünde).
- **Dechiffrierer:** Liegt `empfangenAm` mehr als 5 min von der verschlossenen Zeit entfernt, wird die Nachricht als unlesbar behandelt.

**N4 im Einzelnen:**
- `vergleichstext` zeigt:
  - die Paarnummer;
  - den lokalen Fingerabdruck dieses Geräts (aus dem lokalen Geheimschlüssel, nicht vom Server);
  - vollständige Listen getrennt nach Konto, mit Zahl je Konto.
- Fehlt der lokale Schlüssel in der eigenen Liste, wird der Vergleich abgelehnt.
- Die Grenze des bloßen Nummernvergleichs steht wörtlich im Text.
- Ein eingeschobenes Gerät X erscheint in Bs eigener Liste und lässt sich gegen Bs lokale Fingerabdrücke prüfen.

## Hinweise (keine materiellen Befunde)

1. **Zeitprüfung beim Öffnen greift nur mit Empfangszeit:** Sie ist an `empfangenAm` gebunden. Fehlt `created_at`, wird nicht geprüft (Gegenprobe: öffnet). Das betrifft den App-Bezugs-Select `app/lib/daten.ts:855` (ohne `created_at`). Da Bezüge keine Zeit anzeigen und Verlauf/Vorschau `created_at` liefern, ist das ohne belegbare Auswirkung. Für Einheitlichkeit `created_at` ergänzen.
2. **Fremde und veraltete Einträge in der Liste:** Wegen liegen gebliebener Browser- und Altschlüssel werden viele Nutzer unbekannte Einträge in der eigenen Liste sehen. Der Text rät dann, nicht weiterzuschreiben. Das ist ehrlich, aber ohne Gerätewiderruf schwer umsetzbar. Das ist die zugesagte Grenze, kein Defekt.
3. **Geräteuhr:** Weicht sie mehr als 5 min ab, scheitert jede verschlüsselte Sendung. Live prüfen, ob die App dafür eine verständliche Meldung zeigt.
4. **Missverständliche Meldung bei Fehlern:** Scheitert `vergleichstext` (lokaler Schlüssel fehlt), zeigt die Kontaktinfo den Text „keine Verschlüsselung aktiv … Gegenüber hat nie ein Gerät …“. Das ist bei jedem Fehler schon älteres Verhalten, kein neuer Befund.
5. **Unbelegte Restpunkte aus der Nachprüfung (weiterhin Vermutung):**
   - Ein Datenbankschreiber kann eine bearbeitete Nachricht auf eine frühere Chiffre derselben Nachricht zurücksetzen.
   - Veränderte Clients können neue Format-1-Nachrichten schreiben; in der Chatlisten-Vorschau erscheinen sie ohne Warnung.

## Ausgeführt (`ee57c82`)

| Prüfung | Ergebnis |
|---|---|
| `_krypto_einheit.js` | 36/36 |
| `_krypto_web_einheit.js` | 16/16 |
| `_krypto_server_einheit.js` | 18/18 |
| `_krypto_app_einheit.js` | 18/18 |
| `_paket6_opus.cjs` | 14/14 |
| `_paket6_kuvert_regression.cjs` | 13/13 |
| `_paket6_weiterleiten_regression.cjs` | 3/3 |
| `_paket6_chatgeneration_regression.cjs` | 4/4 |
| **Summe fokussierte Tests** | **122/122**, alle Exit 0, Offline-Sperre aktiv |
| `_paket6_schema127.cjs` mit vorhandenem PGlite | **16/16**, Exit 0 |
| TypeScript `tsc --noEmit` (App) | Exit 0 |
| `node --check` auf 5 geänderte JS-Dateien | 5/5 |
| Eigene `schluss_gegenproben.cjs` | **13/13** |
| Frühere `gegenproben.cjs`, Migration (N5) | 5/5 weiter belegt |

Zu `schluss_gegenproben.cjs`: Der erste Lauf ergab 12/13. Die eine Abweichung kam von meiner Supabase-Attrappe, der eine `update`-Methode fehlte; mit ihr ergänzt 13/13. Zu den früheren Gegenproben: Die N4-Aussage „nur Gesamtzahl“ gilt weiter für den Rückgabewert von `paarSicherheitsnummer`. Sie ist aber überholt, weil die Oberfläche jetzt `vergleichstext` mit Listen je Konto zeigt.

## Grenzen

- **SQL nur lokal:** Die PGlite-Probe bildet die Supabase-Trigger aus Schema 95 (`anlegen_vorgaben`, `spalten_fest`) nicht nach. Ihr Zusammenspiel mit dem ±5-min-CHECK habe ich nur aus dem SQL abgeleitet.
- **Nicht selbst gemessen:** Browser 26/26 und der Native-Lauf; kein Serverstart erlaubt.
- **Kein Live-Nachweis:** RLS und Schema-127-Einspielung sind offen.
- **Ausrollen:** Alte Clients können Format 2 nicht lesen; Schema und Clients müssen zusammen ausgerollt werden (bekannt).
- **Nicht zugesichert:** Gerätewiderruf und Konto-Identität fehlen. Das ist im Produkttext richtig als Grenze benannt.
