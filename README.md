# All Media

Social-App mit Messenger, Storys, Video-Feed und Communitys — gebaut aus dem
Figma-Prototypen. Zwei Wege zum Testen: eine Web-Version im Browser und die
echte React-Native-App über Expo Go.

## Starten

### Web-Version (schnellster Weg)

```bash
cd app
node web-app.js
```

Dann im Browser öffnen: **http://localhost:3000**

### React-Native über Expo Go

```bash
cd app
npm install
npx expo start
```

Danach den QR-Code aus dem Terminal mit der **Expo Go**-App scannen
(iOS: Kamera-App, Android: Expo Go direkt). Handy und Rechner müssen im
gleichen WLAN sein. Ein Expo-Konto ist dafür nicht nötig.

## Was funktioniert

| Bereich | Stand |
|---|---|
| Bild-Feed (Start): Beiträge, Like, Folgen, Merken | fertig |
| Video-Feed: Vollbild-Slides, Like, Teilen, Merken | fertig |
| Communitys: Liste, Filter, Beitreten, Kanal-Chat | fertig |
| Chat-Liste mit Suche, Filtern und Story-Rail | fertig |
| Einzelchat: Nachrichten senden, Antwort-Simulation, Tippen-Indikator | fertig |
| Gruppenchat mit Absendernamen | fertig |
| Kontakte mit Live-Suche | fertig |
| Storys: Liste und Viewer mit Fortschrittsbalken | fertig |
| Kamera: Foto/Video über Kamera oder Galerie | fertig (RN), UI-Gerüst (Web) |
| Einstellungen/Profil inkl. Dark Mode | fertig |
| Login/Registrierung mit Validierung | fertig (Mock-Auth) |
| Kommentare schreiben und liken | fertig |
| Nutzerprofile mit Statistiken, Bio, Highlights, Raster | fertig |
| Anrufe, Repost, Kontakt hinzufügen | noch nicht gebaut |
| Supabase-Backend | vorbereitet, siehe unten |

## Projektstruktur

```
All-Media/
├── app/
│   ├── App.tsx              Shell: Top-Switcher, Tabs, Overlays
│   ├── components/          Avatar, SearchBar, StoryRail, TabBar, Toast …
│   ├── screens/             Login, Home, Video, Messenger, Communitys, Profil
│   ├── test/smoke.js        Smoke-Test der Web-Version
│   ├── constants/design.ts  Farben, Abstände, Typografie, Avatar-Farben
│   ├── types/               TypeScript-Modelle
│   ├── mocks/               Testdaten (Nutzer, Chats, Nachrichten, Storys)
│   ├── lib/                 Supabase-Anbindung (Auth, Storage, Typen)
│   ├── web-app.js           Express-Server + Mock-API
│   └── public/              Web-Version (index.html, styles.css, app.js, icons.js)
├── SUPABASE_SETUP.md        Backend-Anleitung (lokal oder Cloud)
└── VIDEO_CALLS_SETUP.md     Konzept für Video-Anrufe (noch nicht umgesetzt)
```

## Design

Orientiert am Figma-Prototypen, professionell ausgearbeitet:

- **Akzentfarbe** `#0A66FF`
- **Icons** durchgehend Strich-Icons (Ionicons in der App, eigenes SVG-Set im Web) — bewusst keine Emojis in der Oberfläche
- **Avatare** Initialen auf einer festen Farbe pro Person
- **Nachrichten** grün (eigene) / weiß (fremde), wie im Prototypen
- **Dark Mode** in Web und App

## Backend (Supabase)

Die App läuft vollständig ohne Backend auf Mock-Daten. Sobald in
`app/.env.local` echte Zugangsdaten stehen, wird Supabase automatisch benutzt:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

Schema und Einrichtung: siehe `SUPABASE_SETUP.md`.

## Prüfen

```bash
cd app
npm run lint    # Typprüfung, muss fehlerfrei durchlaufen
npm test        # Smoke-Test der Web-Version (Server muss laufen)
```

Der Smoke-Test klickt alle fünf Bereiche durch und prüft Suche, Filter,
Nachricht senden, Story-Viewer, Kamera und den Dark-Mode-Schalter. Beim ersten
Mal muss der Browser einmalig geladen werden:

```bash
npx playwright install chromium
```
