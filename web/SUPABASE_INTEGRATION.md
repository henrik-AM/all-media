# Website ↔ Supabase

**Stand:** 30.08.2026

## Wie es funktioniert

Die Website spricht mit derselben Datenbank wie die App. Damit das geht,
müssen drei Dinge zusammenpassen:

1. **Zugangsdaten.** Stehen in `server/supabase.js`. Sind keine
   Umgebungsvariablen gesetzt, greifen eingebaute Standardwerte — die Website
   ist also auch ohne Konfiguration auf Render mit der Datenbank verbunden.

2. **Anmeldung.** Die Datenbank ist durch Row Level Security geschützt. Die
   Regeln gelten für die Rolle `authenticated`. Ein Server, der ohne Anmeldung
   anfragt, ist `anon` und darf **weder lesen noch schreiben**. Deshalb meldet
   sich die Oberfläche selbst bei Supabase an (`public/anmeldung.js`) und
   schickt ihr Zugangstoken bei jedem Aufruf an `/api` mit. Der Server macht
   daraus einen Datenbank-Client im Namen dieses Nutzers.

3. **Schema.** Tabellen- und Spaltennamen im Code müssen denen in
   `SUPABASE_SCHEMA.sql` und `SUPABASE_SCHEMA_2.sql` entsprechen.

Fehlt eines davon, arbeitet die Website mit Beispieldaten weiter. Das ist
Absicht — aber man muss es sehen können, siehe unten.

## Zustand prüfen

    GET /api/zustand

Zeigt in einem Blick, ob die Website wirklich mit der Datenbank spricht:

```json
{
  "supabase": { "konfiguriert": true, "quelle": "Standardwert im Code" },
  "anmeldung": { "angemeldet": false, "nutzerId": null },
  "daten": "Beispieldaten"
}
```

`"daten": "Supabase"` heißt: echte Daten. `"Beispieldaten"` heißt: niemand ist
angemeldet, es sind die Mockdaten aus `server/app.js`.

## Was vorher nicht stimmte

Die frühere Sync-Schicht konnte nicht funktionieren, und zwar aus vier
unabhängigen Gründen gleichzeitig:

| Problem | Beispiel |
|---|---|
| Erfundene Tabellen | `videos`, `likes`, `saves`, `shares`, `reports`, `blocks`, `mutes`, `notifications`, `story_views`, `favorites`, `reposts` gab es in der Datenbank nicht |
| Erfundene Spalten | `comments.content_id`, `posts.content`, `communities.creator_id`, `chat_members.is_archived`, `messages.content` |
| Keine gültigen Kennungen | Es wurde `'me'` und `'u1'` als Nutzer-ID geschrieben — die Datenbank erwartet UUIDs |
| Keine Anmeldung | Ohne angemeldeten Nutzer verbieten die Regeln jeden Zugriff |

Alle Fehler wurden abgefangen und die Website fiel still auf Beispieldaten
zurück. Von außen sah das aus wie eine funktionierende Anbindung.

**Behoben durch:**
- `SUPABASE_SCHEMA_2.sql` legt die Tabellen an, die wirklich fehlten
- `videos` und `likes` wurden *nicht* angelegt: Videos sind Beiträge mit
  `kind = 'reel'`/`'clip'`, Likes stehen in `post_likes`
- `server/supabase-api.js` und `server/sync-handlers.js` neu geschrieben, an
  das echte Schema angeglichen
- `public/anmeldung.js` bringt die echte Anmeldung
- `/api/zustand` macht den Zustand sichtbar
- `app/test/_schema.js` verhindert, dass erfundene Namen zurückkommen

## Vor dem Ausliefern prüfen

    node app/test/_schema.js      # Code gegen Schema (kein Server nötig)
    npm test                      # im Ordner app/, Server muss laufen
    npm run test:alles            # alle Prüfungen

## Neuen Endpunkt anbinden

```javascript
app.post('/api/beispiel/:id', async (req, res) => {
  // req.db  = Datenbank-Client des angemeldeten Nutzers (oder null)
  // req.nutzerId = seine UUID (oder null)
  const ergebnis = await syncHandlers.handleBeispiel(req.db, req.nutzerId, req.params.id);

  // ergebnis === null  → niemand angemeldet, Beispieldaten benutzen
  // ergebnis.ok        → hat geklappt
  ...
});
```

Der Handler selbst gehört nach `server/sync-handlers.js` und muss sich an die
Spaltennamen aus den Schema-Dateien halten — `app/test/_schema.js` prüft das.

## Offen

- **Die Datenbank ist leer.** Es gibt noch keine Profile, Chats oder Beiträge.
  Solange niemand ein Konto anlegt, zeigt auch die angemeldete Website nichts.
- **E-Mail-Bestätigung ist eingeschaltet** (`mailer_autoconfirm: false`). Nach
  der Registrierung kommt erst eine Mail, dann geht die Anmeldung.
- **Google- und Apple-Anmeldung sind in Supabase nicht aktiviert.** Die
  entsprechenden Knöpfe in der App sind bisher Attrappen.
- **Telefon-Anmeldung ist nicht aktiviert.**
