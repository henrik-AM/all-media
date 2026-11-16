# Paket 6 – adversariale Prüfung durch Claude (Endbericht)

Ziel: `627fa86f7b985ae847705f9995caba434c29ceb4` (Reviewworktree, unverändert), Basis `0288a35`. Datum 15.11.2026.
Nur offline geprüft: kein Supabase, keine Konten, kein Server/Simulator, keine `.env`, keine Installation, keine Produktdatei geändert.

## Urteil

**Bedingt tragfähig.** Der Kern von AR-05 hält: Ich habe keinen Weg gefunden, auf dem **neu gesendeter** Text still im Klartext in einen verschlüsselten Chat geht – weder in der App noch im Browser oder auf dem Server. Geprüft: Senden, Anhang, Kontakt, Teilen, Story-Antwort und -Herz, Weiterleiten.
Es gibt aber **vier belegte Befunde**, alle offline reproduziert:

- AR-04: Die Sicherheitsnummer verspricht einen Schutz, den Nutzer praktisch nicht prüfen können.
- AR-08: Die Migration verliert den alten Schlüssel endgültig für Konten, die gerade abgemeldet sind.
- AR-05: Das Bearbeiten-Werkzeug ist ein ungesicherter Textweg.
- AR-04: Die Absenderprüfung erkennt keine wiederverwendeten Nachrichten.

Keiner der Befunde ist ein Sofort-Datenleck an Dritte ohne Server- oder Datenbankzugriff.

## Abgrenzung Paket 6

- Paket-6-Commits: 9f54804, 22830e6, 47a7a3f, 10cabb0, 7b303f3, 192b068, 6478803, 63f50ea, 14ec3e6, 3bac164, 85d3cde, b812bfc, 937e258, bb5963c, 894a950, 6f5c517, 627fa86. Die Krypto-Kernübernahme steckt in 9f54804 ff.
- **Nicht Gegenstand:** Paket 5/K28, Schema 126 (`zweierchat_anlegen`), Chatstand-Fix ee11974, SDK-58-Hebung 8743211 ff., npm audit fix.
- Geprüfte Produktdateien: `gemeinsam/krypto.js`, `gemeinsam/kryptodaten.js`, `app/lib/krypto.ts`, `web/public/krypto.js`, die Diffs von `web/server/sync-handlers.js` und `web/server/app.js`, `app/lib/aktionen.ts` (Paket-6-Teile, Bearbeiten, Weiterleiten), `app/lib/daten.ts`, `app/lib/kontenspeicher.ts`, ChatDetail-/ContactProfile-Diff, `web/public/anmeldung.js`.

## Findings

### F1 – AR-04: Die Sicherheitsnummer lässt sich nicht vergleichen; der Schutz ist nur behauptet (mittel)

- **Wo:**
  - Anzeige: `app/screens/messenger/ContactProfileScreen.tsx:233-235, 552-561`, `web/public/app.js:4570, 5203-5210`
  - Berechnung: `gemeinsam/krypto.js:216`
- **Ursache:** Die Nummer wird nur aus den Schlüsseln **des Gegenübers** gebildet (`kontoSchluessel(userId)` bzw. `filter(k => k.user_id === userId)`). Es gibt keine Anzeige der **eigenen** Nummer oder eigenen Geräteliste. Gegenprobe: `grep sicherheitsnummer(` liefert nur diese zwei Aufrufer, beide mit der Kennung des Gegenübers.
- **Was die Oberfläche verspricht:** „Vergleicht sie einmal persönlich. Nur dann steht fest, dass niemand dazwischen sitzt … stimmt die Zahl der Geräte nicht, fragt nach.“ B kann die Nummer, die A sieht, aber mit nichts vergleichen – B kennt die eigene Nummer und Gerätezahl nicht.
- **Realistischer Auslöser:** Wer die Datenbank kontrolliert (das Bedrohungsmodell, das AR-04 selbst nennt), legt einen Schlüssel unter B an. Nummer und Zahl ändern sich, aber niemand hat einen Referenzwert.
- **Verstärkender Effekt:** Gerätezahlen sind für Nutzer nicht vorhersagbar. Jeder neue Browser oder geleerte localStorage legt einen dauerhaften Schlüssel an. Aufgeräumt wird nur bei Testkonten über `/api/reset` (`web/server/app.js:587-598`). Codex' eigener Bericht belegt 16 reale Schlüssel eines Prüfkontos (`berichte/Paket-6-Krypto-10-11-2026.md:127`).
- **Folge:** Die Anzeige erzeugt Vertrauen, ohne prüfbar zu sein. Das ist genau die Art „Satz, der etwas zusichert“, die der Kopf von `gemeinsam/krypto.js` als Anlass nennt.
- **Beleg:** statisch, mit Datei:Zeile wie oben. Keine Laufzeitprobe nötig.
- **Empfehlung:**
  - Eigene Nummer und eigene Geräteliste anzeigen (Einstellungen oder Kontaktinfo).
  - Besser: eine gemeinsame Paar-Nummer aus beiden sortierten Schlüsselmengen, wie bei Signal.
  - Geräte widerrufbar machen.
  - Bis dahin den Hinweistext entschärfen.

### F2 – AR-08: Die Migration verwirft den gemeinsamen Altschlüssel endgültig für früher genutzte, gerade abgemeldete Konten (mittel)

- **Wo:** `app/lib/krypto.ts:91-122` (Löschung Z. 120-121), `web/public/krypto.js:59-85` (Löschung Z. 83-84)
- **Ursache:** Das Altpaar L wird nur in die Fächer des aktiven Kontos und der *aktuell gespeicherten* Konten kopiert und danach gelöscht.
  - App: `gespeicherteKonten`
  - Web: `Anmeldung.konten`, nur Konten mit `refresh_token`
  - Abmelden oder eine abgelaufene Sitzung entfernen ein Konto aus dieser Liste: `kontenspeicher.ts:121-123, 132-135`.
- **Realistischer Auslöser:** Auf einem Gerät liefen vor dem 16.10. zwei Konten mit L. Konto B war zum Updatezeitpunkt abgemeldet oder seine Sitzung abgelaufen. A öffnet einen Chat, die Migration läuft. Meldet sich B später wieder an, bekommt B ein neues Paar.
- **Folge:** Alle alten Nachrichten von B auf diesem Gerät zeigen dauerhaft „Auf diesem Gerät nicht lesbar“. Das lässt sich nicht beheben, weil L gelöscht ist.
- **Bewertung:** Codex' Berichte nennen nur „in den damals gespeicherten Konten erhalten“. Dass L dabei für andere frühere Nutzer endgültig verloren geht, ist nicht offengelegt.
- **Beleg:** `repro_migration.cjs`, echte `web/public/krypto.js` im VM und `app/lib/krypto.ts` per `Module.stripTypeScriptTypes`, Stubs nur für SecureStore/expo-crypto/kontenspeicher. **10/10 Aussagen belegt**, Exit 0: L geht an A, Altfach gelöscht, B bekommt ein neues Paar, B öffnet die Altnachricht nicht – je für Web und App. Log: `migration.log`.
- **Empfehlung:**
  - L nicht löschen, sondern in einem Quarantänefach halten.
  - Bei jeder Anmeldung nur dann übernehmen, wenn der Server für dieses Konto eine Zeile mit `oeffentlich = pub(L)` hat. Das beweist, dass das Konto L benutzt hat.
  - Ergänzend: Altpaare nur noch zum Lesen behalten und je Konto ein neues Sendepaar anlegen. Heute bleibt L dauerhaft als gemeinsames Gerät beider Konten registriert und erhält auch künftige Kuverts. Das ist im Code offengelegt, widerspricht aber dem Ziel von AR-08.

### F3 – AR-05-Lücke: Bearbeiten schreibt neuen Klartext in einen inzwischen verschlüsselten Chat (niedrig bis mittel; keine Regression)

- **Wo:**
  - App: `app/lib/aktionen.ts:2738-2745`
  - Server: `web/server/sync-handlers.js:2467-2489`
  - Route: `web/server/app.js:3800-3810`
  - Browser: `web/public/app.js:22229-22234`
- **Ursache:** Bei `krypto = 0` wird der neue Text ohne `sendeweg`-Prüfung als Klartext geschrieben. `handleSendMessage` hat den Klartext-Wächter, `handleNachrichtBearbeiten` nicht. Der Server-Kommentar behauptet trotzdem „Alle Textwege“ (`sync-handlers.js:304`).
- **Realistischer Auslöser:** A schreibt B, bevor B ein Gerät hat (Klartext ist dann erlaubt). B meldet ein Gerät an, der Chat wird verschlüsselt, die Kontaktinfo zeigt „Ende-zu-Ende“. A bearbeitet die alte Nachricht mit neuem, sensiblem Inhalt. Der Inhalt liegt dann offen in `messages.text`.
- **Beleg:** `repro_bearbeiten.cjs` mit echtem `sync-handlers.js` und Supabase-Attrappe. **4/4 Aussagen belegt**: Senden desselben Textes wird abgelehnt (AR-05-Meldung), Bearbeiten wird angenommen, die Zeile erhält Klartext und bleibt `krypto = 0`. Log: `bearbeiten.log`.
- **Einordnung:** Der Bearbeiten-Weg wurde in Paket 6 nicht geändert, die Lücke bestand also schon vorher. Sie gehört aber zum Auftrag „kein stiller Klartext-Rückfall“ und fehlt in Codex' Inventar.
- **Empfehlung:** Vor dem Bearbeiten einer `krypto = 0`-Nachricht dieselbe `sendeweg`-Regel anwenden (App und Server). Falls Verschlüsselung vorgesehen ist: ablehnen, oder als verschlüsselte Ersatznachricht neu senden.

### F4 – AR-04: Die Absenderprüfung erkennt keine wiederverwendeten oder umgehängten Nachrichten (niedrig)

- **Wo:** `gemeinsam/krypto.js:265-333, 477-542`
- **Ursache:** Chiffre und Kuvert sind nicht an Nachrichten-ID, Chat, Zeitpunkt oder Bezug (`reply_to`) gebunden. Kein zusätzlicher Kontext (AD), keine Signatur über Metadaten.
- **Realistischer Auslöser:** Wer die Datenbank schreiben kann (das in AR-04 ausdrücklich angenommene Modell), kopiert eine echte Nachricht von A („Ja, mach das.“) samt Kuvert als neue Zeile. Möglich ist das in einen anderen gemeinsamen Chat, zu einem neuen Zeitpunkt oder als Antwort auf eine andere Frage.
- **Folge:** B sieht die Kopie ohne Warnung als geprüft von A.
- **Beleg:** `repro_wiedereinspielen.cjs`. **3/3 Aussagen belegt**: Kopie öffnet sich identisch, `absenderPruefer` liefert `true`. Log: `wiedereinspielen.log`.
- **Einordnung:** Das ist kein neuer Metadaten-Befund. Es geht um die Echtheit des Inhalts: Die Warnung „Absender nicht prüfbar“ deckt nur das Unterschieben fremder Schlüssel ab, keine Wiederverwendung.
- **Empfehlung:** Nachrichten-ID, Chat-ID und Bezug in den verschlossenen Klartext aufnehmen (Version 2) und beim Öffnen gegen die Zeile prüfen. Bis dahin die Grenze in Bericht und Code offen nennen.

## Ohne Befund geprüft

- **`sendeweg`:** Unvollständige Fakten führen zur Ablehnung, ein Zweierchat mit drei Mitgliedern zur Sperre, fremde Schlüssel werden herausgefiltert, das eigene Gerät ist immer Empfänger.
- **Senden in der App:** `fuerChatVerschliessen` wirft bei Faktenfehlern.
- **Server-Wächter (knapp):** Senden, Anhang (`/anhang` mit `paket`), Kontakt, Teilen, Story-Antwort und -Herz, Weiterleiten mit Plan vor dem ersten Schreiben.
- **`schluesselHolen`:** feste Reihenfolge, 200er-Seiten, exakte Gesamtzahl; Abbruch bei Widerspruch oder Kürzung.
- **Absender-Cache:** Ladefehler ergeben `null` und damit eine Warnung, kein Vertrauen.
- **Konto-Bindung im Browser:** Die Merkliste der verschlüsselten Chats hängt am Konto; `anmelden()` prüft Stand und Konto nach dem `await`; `verschliessen` vergleicht `ichId`.
- **App bei Kontowechsel:** Die Merkliste der verschlüsselten Chats ist global, das ist aber fail-safe (eher ablehnen). Ein fremdes `ichId` beim Upsert scheitert an RLS und ergibt `null`, also ablehnen.
- **Kuvert-Nachlieferung:** nur markierte IDs, höchstens 500, UUID-Prüfung; der Stand wird erst nach erfolgreichem Nachladen bestätigt; bei fehlendem Schlüssel Backoff von 4 bis 60 s.

## Ausgeführte Prüfungen und Zahlen

| Prüfung | Ergebnis |
|---|---|
| `node app/test/_krypto_einheit.js` (unverändert, nur Node) | 36/36, Exit 0 |
| `node app/test/_krypto_web_einheit.js` | 16/16, Exit 0 |
| `node app/test/_krypto_server_einheit.js` | 18/18, Exit 0 |
| `repro_migration.cjs` (F2) | 10/10 belegt |
| `repro_bearbeiten.cjs` (F3) | 4/4 belegt |
| `repro_wiedereinspielen.cjs` (F4) | 3/3 belegt |

Vorhandene Tests zusammen 70/70. Alle Skripte und Logs liegen unter `/private/tmp/paket6-claude-review/`. Vor dem Start habe ich gelesen, worauf die Tests zugreifen: nur Module, VM und `crypto`, kein Netz und keine Dateischreibzugriffe.

## Grenzen und Lücken

- **Nicht ausgeführt:** `_krypto_app_einheit.js`, `_paket6_kuvert_regression.cjs`, `_paket6_chatgeneration_regression.cjs`, `npm run test:paket6-vorbereitung` und die Browser- und Native-Läufe. Sie brauchen `app/node_modules/typescript` bzw. Chromium/Simulator, und der Worktree hat keine `node_modules`. Installieren war ausgeschlossen. Die Zahlen aus Codex' Berichten (88/88, 26/26, 11/11, 3287/3287) habe ich **nicht** selbst nachvollzogen.
- **Kein Livebeleg:** RLS von `krypto_schluessel`/`message_keys`/`messages`, echte SecureStore- und Expo-Go-Abläufe und das Verhalten des Live-Schemas sind nur aus SQL-Dateien und Code abgeleitet.
- **Nicht tief geprüft:** Rennen zwischen Kontowechsel und ChatDetail-Effekt in der App (ob `erfolgreicheSchluesselId` und Effekt-Abhängigkeiten bei Kontowechsel neu starten); Medien- und Dateiwege jenseits des Textwächters (Dateien sind bekanntermaßen unverschlüsselt).
- **Nicht als Befund gewertet (bekannte oder akzeptierte Grenzen):**
  - unverschlüsselte Dateien und Metadaten;
  - drei mittlere Expo-Auditbefunde;
  - Erstkontakt-Downgrade durch einen bösartigen Server (leere Schlüsselliste und `schonVerschluesselt = false` nach Neustart). Das ist Teil des Server-Vertrauensmodells; im Browser liefert derselbe Server ohnehin das JavaScript.
