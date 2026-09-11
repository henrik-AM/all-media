# All Media — Komplette Feedback-Behebung
## Alle noch offenen Punkte aus Feedback 29.08.2026

---

## ✅ BEREITS GELÖST (von anderem Chat)

- ✅ Pfeil zurück (Commit: 0b15121)
- ✅ Dynamic Island Backdrop transparent (Commit: 0c6e1fd)
- ✅ Dicke Schrift überall klickbar (Commit: 747eb0c)
- ✅ Story/Highlights in fremden Profilen klickbar (Commit: 38d8f50)
- ✅ Profilbild Großformat (Commit: 8c04933)
- ✅ Gruppen-Einstellungen (Commit: 9b3e77b)
- ✅ Neues Thema erstellen Design (Commit: 9b3e77b)
- ✅ Friend-Map Zoom-Buttons (Commit: b1837e7)
- ✅ Friend-Map Initialen bei Zoom-Out (Commit: 74c4430)
- ✅ Friend-Map Person-Name Label (Commit: e82f935)
- ✅ Friend-Map Trennstrich (Commit: 74c4430)
- ✅ Settings Icon → Zahnrad (Commit: 1e9bcf8)
- ✅ Repost-Button Höhe (Commit: 1e9bcf8)
- ✅ Kommentar-Spalte zentriert (Commit: 10e7926)
- ✅ Dynamic Island Farbmodus (TopSwitcher.tsx: inselDark/inselLight)

---

## ❌ NOCH ZU BEHEBEN

### GRUPPE 1: STORY-MANAGEMENT (3 Punkte)

#### 1. Story-Kreis bleibt rot nach Anschauen
- **File:** VideoHomeScreen, StoryRail, StoryViewerScreen
- **Problem:** Story wird nach Ansicht nicht als "gelesen" markiert
- **Lösung:** onStoryViewed Callback → State aktualisieren
- **Priority:** 🔴 HOCH

#### 2. Story-Nachrichten Sync in Chats
- **File:** ChatDetailScreen
- **Problem:** Story-Like/Reactions werden nicht synchronisiert
- **Lösung:** ProfilContext → Story-Likes speichern und bei Chat-Änderung aktualisieren
- **Priority:** 🟠 MITTEL

#### 3. Story-Online Anzeige falsch
- **File:** StoryRail
- **Problem:** Zeigt "eine Story aktuell online" obwohl keine online
- **Lösung:** Online-Status korrekt berechnen
- **Priority:** 🟠 MITTEL

---

### GRUPPE 2: FREMD-PROFILE (3 Punkte)

#### 4. Chats aus Video-Profil landen falsch
- **File:** VideoProfileScreen
- **Problem:** Nachricht an Person → Chat schon nicht unter Communitys/Chats
- **Lösung:** Navigation zu ChatListScreen statt Video-Bereich
- **Priority:** 🔴 HOCH

#### 5. Profil-Follower/Following sichtbar
- **File:** VideoProfileScreen, PublicProfileScreen
- **Problem:** Kann nicht sehen wer die Person folgt/gefolgt wird
- **Lösung:** Zwei neue externe Seiten: "Follower" und "Following" (mit `oeffneLink`)
- **Priority:** 🟠 MITTEL

#### 6. Story unter fremden Videos klickbar
- **File:** VideoProfileScreen (für fremde Profile)
- **Problem:** Story-Icon ist nicht klickbar für andere Nutzer
- **Lösung:** onStoryPress Handler beim Story-Circle
- **Priority:** 🟠 MITTEL

---

### GRUPPE 3: FRIEND-MAP (4 Punkte)

#### 7. Screen-Abschneidung unter Dynamic Island
- **File:** FriendMapScreen
- **Problem:** Content unter Dynamic Island wird abgeschnitten
- **Lösung:** Padding/Margin oben anpassen
- **Priority:** 🔴 HOCH

#### 8. Kartenansicht-Wechsel (Standard/Satellit/Gelände)
- **File:** KarteWeb.tsx
- **Problem:** Kein UI zum Wechsel zwischen Map-Typen
- **Lösung:** Floating Button oder BottomSheet mit 3 Optionen
- **Priority:** 🟠 MITTEL

#### 9. Auto-Zoom bei Person-Klick
- **File:** FriendMapScreen
- **Problem:** Klick auf Person zoomed nicht automatisch nah ran
- **Lösung:** karte.current?.zoomAuf(id) verbessern
- **Priority:** 🟠 MITTEL

#### 10. Kontakt unter Karte → nah zoomen
- **File:** FriendMapScreen
- **Problem:** Klick auf Kontakt-Reihe zoomed nicht nah genug
- **Lösung:** Spezielle Zoom-Level für Kontakt-Clicks
- **Priority:** 🟠 MITTEL

---

### GRUPPE 4: MESSENGER CHATS (6 Punkte)

#### 11. Storys nicht fixiert (verschiebbar)
- **File:** ChatDetailScreen
- **Problem:** Storys können nach oben/unten verschoben werden
- **Lösung:** ScrollView mit `scrollEnabled={false}` oder PanGestureHandler nur horizontal
- **Priority:** 🟠 MITTEL

#### 12. Anhang-Seite Design
- **File:** AttachmentSheet oder neue Komponente
- **Problem:** Unprofessionelles Design
- **Lösung:** Neudesign wie Figma-Prototyp (Grid mit Icons)
- **Priority:** 🟠 MITTEL

#### 13. Live-Standort senden
- **File:** AttachmentSheet
- **Problem:** Kann nur Standort aus Liste wählen, nicht Live-Standort senden
- **Lösung:** Neuer "Live-Standort" Button in AttachmentSheet
- **Priority:** 🟠 MITTEL

#### 14. Chat-Einstellungen Sync
- **File:** ProfilContext, ChatDetailScreen
- **Problem:** Einstellungen (Teilen, Sperren) werden nicht gespeichert/synchronisiert
- **Lösung:** State-Update in ProfilContext
- **Priority:** 🟠 MITTEL

#### 15. Story-Einstellungen Sync
- **File:** ProfilContext, ChatDetailScreen
- **Problem:** Story-Einstellungen (Stummschalt) werden nicht synchronisiert
- **Lösung:** Story-Settings in ProfilContext speichern
- **Priority:** 🟠 MITTEL

#### 16. Stories durch Downswipe beenden (Website)
- **File:** web/public/app.js
- **Problem:** Website: Downswipe schließt Stories nicht
- **Lösung:** Touch-Event Handler für Downswipe
- **Priority:** 🟠 MITTEL

---

### GRUPPE 5: KAMERA (2 Punkte)

#### 17. Foto-Ansicht anders gestalten
- **File:** CameraScreen
- **Problem:** "Was möchtest du mit dem Foto machen?" ist ungünstig
- **Lösung:** Direktes Chat-Selection Sheet statt Zwischen-Screen
- **Priority:** 🟠 MITTEL

#### 18. Chat-Auswahl nach Foto
- **File:** CameraScreen
- **Problem:** Nach Foto → sollte zu Chat-List navigieren, nicht zu Kurzvideos
- **Lösung:** Navigation zu ChatListScreen
- **Priority:** 🟠 MITTEL

---

### GRUPPE 6: VIDEOS HOME (4 Punkte)

#### 19. Klicks unter Profil (Location/Sound)
- **File:** VideoFeedScreen oder VideoHomeScreen
- **Problem:** Location und Sound-Klicks leiten zu Video-Profil statt zur Seite
- **Lösung:** Correct navigation zu Location/Sound Seite
- **Priority:** 🟠 MITTEL

#### 20. Story-Nachrichten falsch kategorisiert
- **File:** ChatListScreen
- **Problem:** Story-Nachrichten von Leuten ohne Messenger-Nummer sollten unter Communitys landen
- **Lösung:** Chat-Type Logik überarbeiten
- **Priority:** 🟠 MITTEL

---

### GRUPPE 7: VIDEOS KURZFORMAT (3 Punkte)

#### 21. Kommentar-Spalte Downswipe schließen
- **File:** VideoClipScreen
- **Problem:** Downswipe schließt Kommentar-Spalte nicht
- **Lösung:** PanGestureHandler für Downswipe
- **Priority:** 🟠 MITTEL

#### 22. Follow-Aktion Sync
- **File:** VideoClipScreen, ProfilContext
- **Problem:** Follow wird nicht synchronisiert/gespeichert
- **Lösung:** State-Update in ProfilContext
- **Priority:** 🟠 MITTEL

#### 23. Speichern-Text Overflow
- **File:** VideoClipScreen
- **Problem:** "Speichern" Text geht über Bildschirmrand hinaus
- **Lösung:** Shorter text oder `numberOfLines={1}`
- **Priority:** 🟡 NIEDRIG

---

### GRUPPE 8: SETTINGS (2 Punkte)

#### 24. Button-Zentrierung
- **File:** SettingsScreen
- **Problem:** Schalter (Bildschirmsperre, Enter senden, etc.) nicht korrekt zentriert
- **Lösung:** Style-Fix für item.toggle
- **Priority:** 🟡 NIEDRIG

#### 25. Ganze Kästchen klickbar
- **File:** SettingsScreen
- **Problem:** Nur Pfeile öffnen Settings, nicht ganze Zeile
- **Lösung:** Bereits implementiert? Prüfen nötig
- **Priority:** 🟡 NIEDRIG

---

## ZUSAMMENFASSUNG
- **Zu beheben:** 25 Punkte
- **Kritisch (Hoch):** 3 Punkte
- **Mittel:** 19 Punkte
- **Niedrig:** 3 Punkte

---

## BEARBEITUNGS-STRATEGIE
1. Kritische Punkte zuerst (Story-Kreis, Chats-Navigation, Map-Abschneidung)
2. Dann Mittlere (Feature-Ergänzungen, Sync-Probleme)
3. Dann Niedrige (Text-Fixes, UI-Polish)
4. Nach jedem Block committen

