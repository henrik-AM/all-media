# All Media

> **In English:** All Media is an open source social platform — messenger,
> stories, video feed and communities — shipped as two clients with enforced
> feature parity: a React Native / Expo mobile app and a Node.js web client,
> both on a single Supabase backend. Roughly 110,000 lines across 407 files,
> 49 incremental PostgreSQL migrations, every table covered by Row Level
> Security and verified by an automated policy test suite. Direct messages
> are end-to-end encrypted; media is served through signed URLs only.
>
> **The codebase is written in German** — identifiers, functions, file names
> and documentation. That is deliberate. Open source almost universally
> charges English fluency as the price of entry; this project shows that a
> substantial, security-conscious full-stack application can be built and
> documented in a contributor's native language. Pull requests in German are
> welcome; English ones are too. Licensed under [MIT](LICENSE).

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
│   ├── metro.config.js      Nimmt `gemeinsam/` für den Bundler dazu
│   └── web-app.js           Nur die Weiterleitung an Metro für Expo Go
├── gemeinsam/               Was App UND Website benutzen — bisher die
│   └── spalten.js           Spaltenlisten der Datenbank. Eine Aenderung hier
│                            gilt sofort für beide Seiten; vorher stand das
│                            doppelt da und ist auseinandergelaufen.
├── berichte/                Ältere Prüf- und Abschlussberichte (kein Code)
├── SUPABASE_SCHEMA.sql      Das gültige Schema, mit Row Level Security
├── SUPABASE_SETUP.md        Anleitung dazu
└── VIDEO_CALLS_SETUP.md     Konzept für Anrufe mit echter Übertragung
```

### Der Ordner `gemeinsam/`

Alles darin wird von **beiden** Seiten geladen: der Node-Server per `require`,
die App über Metro (`app/metro.config.js` nimmt den Ordner in `watchFolders`
auf). Deshalb gilt dort:

- **CommonJS** (`module.exports`), kein TypeScript — der Server hat keinen
  Übersetzungsschritt, und ein solcher wäre die Stelle, an der ein Deployment
  bei Render scheitert. Typen liefert eine `.d.ts`-Datei daneben.
- **Keine Logik**, nur Werte. Sonst wäre diese Ablage selbst ein möglicher
  Grund, warum App und Website sich unterschiedlich verhalten.
- Wer eine Datei ergänzt, muss auch `app/test/_modulquelle.js` ansehen: die
  Prüfläufe führen App-Code im Browser aus und müssen den Import auflösen
  können.

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

Die Schemadateien bauen aufeinander auf; `SUPABASE_SCHEMA_31_verschluesselung.sql`
ist die jüngste.

## Verschlüsselung

Textnachrichten in Chats **zu zweit** sind Ende-zu-Ende verschlüsselt: sie
werden auf dem Gerät verschlossen und erst auf dem Gerät des Gegenübers wieder
geöffnet. Weder Supabase noch der eigene Node-Server bei Render sehen den
Klartext.

**Nicht verschlüsselt sind** Anrufe, Bilder und Dateien, Gruppen,
Community-Kanäle und alles von vor dem 07.09.2026. Wer mit wem schreibt, ist
ebenfalls sichtbar — verschlüsselt ist der Inhalt, nicht die Verbindung. Es
gibt keine Forward Secrecy, und ein neues Gerät kann alte Nachrichten nicht
lesen. Die Oberfläche sagt das an Ort und Stelle; wo nichts verschlüsselt ist,
steht auch kein Schloss.

| Datei | Rolle |
|---|---|
| `gemeinsam/krypto.js` | Die Rechnung, gemeinsam für App und Website |
| `gemeinsam/tweetnacl.js` | tweetnacl 1.0.3, unverändert eingekopiert |
| `app/lib/krypto.ts` | Schlüssel im SecureStore des Handys |
| `web/public/krypto.js` | Schlüssel im localStorage des Browsers |

Ein Schlüsselpaar **je Gerät**, ein Kuvert je mitlesendem Gerät — App und
Website sind zwei Geräte derselben Person, und kein geheimer Schlüssel wandert
zwischen ihnen.

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
| `npm run test:krypto` | Ende-zu-Ende-Verschlüsselung, Rechnung und Regeln | 23 |

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

## Lizenz

MIT — siehe [LICENSE](LICENSE). Das heißt: benutzen, ändern, weitergeben,
auch gewerblich. Der Copyright-Hinweis muss mitgehen, eine Gewähr gibt es
nicht.
