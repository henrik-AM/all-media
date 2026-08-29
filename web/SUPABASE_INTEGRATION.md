# Website ↔ Supabase Integration

**Status:** Phase 1 complete — kritische Endpoints integriert  
**Ziel:** Website 100% mit Supabase synchronisiert (wie Expo Go App)  
**Strategie:** Hybrid-Ansatz (Supabase + Mock-Fallback)

---

## ✅ Bereits Integriert (Phase 1)

| Endpoint | Datei | Status | Sync-Handler |
|----------|-------|--------|--------------|
| `GET /api/bootstrap` | app.js:615 | ✅ Async | `bootstrapData()` |
| `POST /api/messages/:chatId` | app.js:1522 | ✅ Sync | `handleSendMessage()` |
| `POST /api/profile/:userId/follow` | app.js:1387 | ✅ Sync | `handleFollowUser()` |
| `POST /api/videos/:id/:action` (like) | app.js:1467 | ✅ Sync | `handleLikeContent()` |
| `POST /api/chats/:chatId/:was` (archiv/stumm/gelesen) | app.js:721 | ✅ Sync | `handleChatAction()` |

---

## 🚧 Phase 2 — Nächste Integratoren (TODO)

### Stories
- [ ] `POST /api/stories/:id/like` — Like einen Story
- [ ] `POST /api/stories/:id/view` — Markiere Story als angesehen
- [ ] `POST /api/eigene/story` — Neuer Story erstellen
  - **Handler:** `handleCreateStory()`, `handleViewStory()`

### Comments
- [ ] `POST /api/comments/:targetId` — Kommentar erstellen
- [ ] `POST /api/comments/:targetId/:commentId/like` — Kommentar liken
- [ ] `GET /api/comments/:targetId` — Kommentare laden
  - **Handler:** `handleCreateComment()`

### Profile
- [ ] `POST /api/eigene/profil` — Eigenes Profil aktualisieren (Name, Bio, Link)
- [ ] `POST /api/profile/:userId/:was` — Andere Profile aktualisieren
  - **Handler:** `handleUpdateProfile()`

### Chats (erweitert)
- [ ] `POST /api/chats/:chatId/:was` (blockieren, mitteilungen, löschen)
- [ ] `POST /api/chats/:chatId/accept` — Kontaktanfrage annehmen
- [ ] `GET /api/messages/:chatId` — Messages mit Supabase laden (nicht nur lokal)
  - **Handler:** `handleChatAction()` (erweitern)

### Communities
- [ ] `POST /api/communities` — Neue Community erstellen
- [ ] `POST /api/eigene/beitrag` — Neuen Beitrag erstellen
- [ ] `GET /api/explorer/:art/:wert` — Explorer-Seiten mit Supabase
  - **Handler:** TBD

### Weitere Aktionen
- [ ] `POST /api/kontakte/:userId/favorit` — Kontakt als Favorit
- [ ] `POST /api/eigene/video` — Video hochladen/erstellen
- [ ] `POST /api/clips/:id/:action` — Clip-Aktionen
- [ ] `POST /api/teilen` — Inhalte teilen
  - **Handler:** Neue Handler schreiben

---

## 🔧 Technische Details

### Hybrid-Ansatz

```javascript
// Pattern für jeden Endpoint:
app.post('/api/...', async (req, res) => {
  // 1. Versuche Supabase
  const supabaseResult = await syncHandlers.handleXxx(...);

  // 2. Aktualisiere Mock-Daten (Fallback/Cache)
  // ... existierende Mock-Logik ...

  // 3. Gib Antwort zurück
  res.json({...});
});
```

### Supabase Fehlerbehandlung

Wenn Supabase nicht konfiguriert (`SUPABASE_URL` / `SUPABASE_ANON_KEY` fehlen):
- Alle `syncHandlers.handleXxx()` Funktionen geben `null` zurück
- Website funktioniert weiter mit Mock-Daten
- In Logs: `⚠️ Supabase nicht konfiguriert — nutze Mock-Daten`

### Environment-Variablen (Render)

Auf Render Dashboard setzen:
```
SUPABASE_URL=https://ijztosbjfybdgotpdixw.supabase.co
SUPABASE_ANON_KEY=sb_publishable_sh_LhLSMkHNZrmmj7XkTtw_QFT1G9Ze
```

---

## 📋 Checkliste für neue Endpoints

Wenn ein neuer Endpoint mit Supabase synchronisieren soll:

1. **Handler schreiben** in `sync-handlers.js`
   ```javascript
   async function handleXxx(params) {
     if (!supabase) return null;
     // ... Supabase-Operation ...
     return result;
   }
   ```

2. **In app.js integrieren**
   ```javascript
   app.post('/api/...', async (req, res) => {
     const result = await syncHandlers.handleXxx(...);
     // ... Mock-Fallback ...
   });
   ```

3. **Testen**
   - Lokal mit Supabase (SUPABASE_URL gesetzt)
   - Lokal ohne Supabase (Mock-Fallback)
   - Auf Render nach Deploy

4. **Documentieren** in dieser Datei (checklist abhaken)

---

## 🎯 Ziel (100% Sync)

Wenn alle Phase-2-Endpoints integriert sind:
- ✅ Website = Expo Go App (funktionell identisch)
- ✅ Benutzer sehen gleiche Daten auf beiden Plattformen
- ✅ Alle Änderungen werden live synchronisiert
- ✅ Hybrid-Betrieb (Supabase + Fallback) robustfehler

---

## 📞 Notizen

- **Mock-Daten:** Bleiben in `app.js` als Fallback. Nicht löschen!
- **Authentifizierung:** Derzeit alle User als "me". Echte Auth kommt später.
- **Performance:** Supabase-Queries sind async — können langsamer sein als Mock (ok für MVP)
- **Testing:** Mit `npm start` lokal testen, dann `git push` für Render auto-deploy

