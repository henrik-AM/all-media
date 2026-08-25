# All Media

Social-App mit Messenger, Storys, Video-Feed und Communitys — gebaut aus dem
Figma-Prototypen. Es gibt sie zweimal: als **Website** im Browser und als
**echte App** über Expo Go. Beide zeigen dasselbe; jede Änderung wird in
beiden gemacht.

## Adressen

| Was | Adresse |
|---|---|
| Website, dauerhaft erreichbar | https://all-media-website.onrender.com |
| Website + Expo Go vom eigenen Rechner | https://ended-floral-departure.ngrok-free.dev |

Die dauerhafte Adresse läuft bei Render und aktualisiert sich bei jedem Push
nach `main` von selbst (etwa zwei Minuten). Der Expo-QR-Code braucht einen
laufenden Rechner — dafür `npm run up` im Ordner `app/`.

## Starten

### Website

```bash
cd web
npm start          # http://localhost:3000
```

### App über Expo Go

```bash
cd app
npm install
npm run up         # startet Server, Metro und den festen Tunnel
```

`npm run up` nennt am Ende die Adresse und den QR-Code. Ohne Tunnel geht
auch `npx expo start` — dann müssen Handy und Rechner im selben WLAN sein.

## Aufbau (folgt dem Figma-Prototypen)

Unten die vier Bereiche, oben die Unterpunkte des gerade offenen Bereichs.
Diese Struktur ist im Prototyp festgelegt und wird nicht abgewandelt:

| Bereich (unten) | Unterpunkte (oben) |
|---|---|
| Messenger | Friend-Map · Chats · Kamera · Profil |
| Videos | Home · Hochformat · Querformat · Suche · Profil |
| Communitys | Home · Chats · Suchen · Profil |
| Einstellungen | *(keine obere Leiste)* |

Kontakte sind kein Navigationspunkt, sondern werden aus der Chatliste über
das Plus geöffnet — genau wie im Prototyp.

## Was funktioniert

**Messenger**

- Chatliste mit Suche, Filtern und Story-Leiste
- Einzel- und Gruppenchat, Antwort-Simulation, Tippen-Anzeige
- Anhänge: Foto aufnehmen, aus der Galerie, Standort, Kontakt
- Nachrichten mit langem Drücken markieren (Stern)
- Kontaktinfo nach dem Prototyp-Frame „MC + Kontakteinstellungen":
  Medien, Speicher, Markiertes, Chatdesign, gemeinsame Gruppen,
  Chat leeren und exportieren, blockieren, melden
- Anrufe zu zweit und in der Gruppe (Oberfläche; Übertragung folgt mit WebRTC)
- Friend-Map mit gezeichneter Karte, Zoom und Standortfreigabe
- Kamera, eigene Story mit Betrachter und Ansichten
- Gruppe erstellen, Kontakt per Benutzername oder Telefonnummer

**Videos**

- Bild-Feed mit Like, Kommentaren, Repost, Merken, Folgen, Glocke
- Hochformat-Feed als Vollbild-Slides
- Querformat-Liste **und Player** („VQ + Video"): Abspielleiste, Aktionen,
  Hashtags, ähnliche Videos
- Explorer mit Reels, Querformat, Beiträgen, Profilen, Hashtags, Standorten
  und Sounds — jeder davon mit eigener Seite
- Eigenes Profil mit Mitteilungen (Glocke), Erstellen (Plus) und Menü
- Erstellen: Reels, Querformat, Beitrag, Story, Highlight, Playlist,
  Livestream, Spendenaktion
- Teilen: Beiträge und Videos an Kontakte senden, sie landen im Chat

**Communitys**

- Liste mit Filter öffentlich/privat, Beitreten, Kanal-Chat
- Community-Chats und -Suche mit Befreunden
- Eigenes Community-Profil mit eigenen Mitteilungen und „Neuen Kanal erstellen"

**Einstellungen**

- Neun Abschnitte mit Sprungleiste
- Jeder Punkt führt zu etwas: Auswahl (die gewählte steht in der Liste),
  Formular mit Prüfung, Liste aus dem echten Zustand, Erklärtext oder
  Nachfrage
- Kontowechsel, dunkles Design

**Noch nicht gebaut**

- Echte Bild- und Tonübertragung bei Anrufen (WebRTC braucht einen eigenen
  Build, in Expo Go läuft es nicht)
- Supabase als Datenbank — vorbereitet, das Schema fehlt noch (siehe unten)
- „Abmelden" in der Website (dort gibt es keine Anmeldung; in der App geht es)

## Projektstruktur

```
All-Media/
├── web/
│   ├── server/app.js        Website + API. Dieselbe Datei bedient Render
│   │                        und den lokalen Server - kein doppelter Stand.
│   ├── server/lokal.js      Startet den Server
│   └── public/              Oberfläche der Website (index.html, styles.css,
│                            app.js, icons.js)
├── app/
│   ├── App.tsx              Shell: obere Leiste, Bereiche, Overlays
│   ├── components/          Blätter, Avatar, Karte, TabBar, Toast …
│   ├── contexts/            ProfilContext (Mitteilungen, eigene Inhalte,
│   │                        Communitys), RepostContext, Auth, Supabase
│   ├── screens/             Login, Messenger, Videos, Communitys, Profil
│   ├── constants/           navigation.ts (Prototyp-Struktur), design.ts
│   ├── types/               TypeScript-Modelle
│   ├── mocks/               Testdaten
│   ├── lib/                 Supabase, Aufnahme, Personensuche, Antworten
│   ├── test/                Alle Prüfreihen (siehe unten)
│   ├── tools/               up.js (Tunnel starten), links.js
│   └── web-app.js           Nur die Weiterleitung an Metro für Expo Go
├── SUPABASE_SCHEMA.sql      Das gültige Schema, mit Row Level Security
├── SUPABASE_SETUP.md        Anleitung dazu
└── VIDEO_CALLS_SETUP.md     Konzept für Anrufe mit echter Übertragung
```

## Design

- **Akzentfarbe** `#0A66FF`
- **Icons** durchgehend Strich-Icons (Ionicons in der App, eigenes SVG-Set im
  Web) — bewusst keine Emojis in der Oberfläche
- **Avatare** Initialen auf einer festen Farbe pro Person
- **Nachrichten** grün (eigene) / weiß (fremde), wie im Prototypen
- **Dunkles Design** in Website und App

Eigene Aufnahmen bleiben im Browser bzw. auf dem Gerät. Der Server teilt
seinen Speicher mit allen Besuchern — dort steht nur der Eintrag, nicht das
Bild.

## Backend (Supabase)

Die App läuft vollständig ohne Backend auf Mock-Daten. Sobald in
`app/.env.local` echte Zugangsdaten stehen, wird Supabase benutzt:

```env
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
```

**Die Datenbank ist noch leer.** Einmalig `SUPABASE_SCHEMA.sql` im
SQL-Editor von Supabase ausführen. Details in `SUPABASE_SETUP.md`.

## Prüfen

```bash
cd app
npm run lint              # Typprüfung, muss fehlerfrei durchlaufen
npm run test:alles        # alle acht Prüfreihen (Server muss laufen)
```

| Reihe | Was sie prüft | Anzahl |
|---|---|---|
| `npm test` | Grundstruktur und alle Bereiche | 65 |
| `npm run test:feedback` | Henriks einzelne Rückmeldungen | 27 |
| `npm run test:erstellen` | Glocke, Plus und Menü im eigenen Profil | 17 |
| `npm run test:teilen` | Beiträge und Videos an Kontakte senden | 8 |
| `npm run test:explorer` | Hashtag-, Standort- und Sound-Seiten | 8 |
| `npm run test:anhang` | Anhänge im Chat, Optionen im fremden Profil | 12 |
| `npm run test:einstellungen` | Jeder Punkt in den Einstellungen | 11 |
| `npm run test:kontaktinfo` | Kontaktinfo und Gruppenanruf | 10 |

Dazu zwei Werkzeuge:

```bash
node test/_bestand.js     # Wie viele Knöpfe wirken wirklich?
npm run compare           # Prototyp-Bild und eigener Screen nebeneinander
```

`npm run compare` braucht den Figma-Token in der Umgebung
(`export FIGMA_TOKEN=...`, im Vault unter Zugangsdaten).

Beim ersten Mal muss der Browser einmalig geladen werden:

```bash
npx playwright install chromium
```

Alle Reihen laufen auch gegen die Live-Adresse:

```bash
ZIEL=https://all-media-website.onrender.com node test/_einstellungen.js
```
