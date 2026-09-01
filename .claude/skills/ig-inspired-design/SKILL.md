---
name: ig-inspired-design
description: Design-System für All Media im Instagram-Stil — Kartenlook, Typografie, Abstände, Farben und Icon-Regeln. Nutzen, wenn Oberflächen der All-Media-App gebaut oder überarbeitet werden.
---

# Instagram-inspiriertes Design für All Media

Dieses Skill definiert ein konsistentes, Instagram-inspiriertes Design-System für die All-Media-App. Nicht 1:1 Instagram-Klon, sondern eine eigene Zwischenlösung: Look & Feel, Card-Stil, Typografie und Abstände orientieren sich am IG-Design, die Akzentfarbe und Icon-Details sind aber eigenständig.

## Designprinzipien

- **Minimalistisch & Clean:** Große Whitespace-Bereiche, klare Hierarchie
- **Bilder im Fokus:** Posts, Videos, Avatare sind die primären Elemente
- **Responsive:** Flexibles Layout, passt sich Bildschirmgröße an
- **Dunkelmodus-Ready:** Farbvariablen funktionieren in Light & Dark

## Farbpalette

### Primär (Akzent)
- **Brand-Blau**: `#0A66FF` (aktiv, Likes, Highlights) — deutlich unterscheidbar von IG-Blau
- **Hover-Blau**: `#0052CC` (z.B. Button-Hover)

### Neutrale Graustufen
- **Weiß (Light Mode)**: `#FFFFFF`
- **Sehr Hellgrau (Light Mode)**: `#F5F5F5` (Backgrounds)
- **Mittelgrau**: `#B0B0B0` (sekundärer Text, Platzhalter)
- **Dunkelgrau**: `#262626` (primärer Text)
- **Schwarz (Dark Mode)**: `#000000`
- **Dunkelgrau (Dark Mode)**: `#121212` (Backgrounds)

### Status-Farben
- **Rot (Like/Highlight)**: `#E0245E`
- **Grün (OK/Aktiv)**: `#31A24C`
- **Orange (Warnung)**: `#F59E0B`

## Typografie

### Font-Familien
- **Titel/Headings**: System Font (SF Pro Display auf iOS, Roboto auf Android)
- **Body/Text**: System Font (SF Pro Text / Roboto)
- **Monospace (Code/IDs)**: System Monospace

### Größen
- **H1 (Seiten-Titel)**: 32px, Bold (700)
- **H2 (Bereichs-Titel)**: 24px, SemiBold (600)
- **H3 (Card-Titel)**: 18px, SemiBold (600)
- **Body (Standard-Text)**: 16px, Regular (400)
- **Small (Sekundär, Timestamps)**: 13px, Regular (400)
- **Tiny (Labels, Counts)**: 12px, SemiBold (600)

### Line Heights
- Headings: 1.2
- Body: 1.5
- Small: 1.4

## Abstände (Spacing Scale)

```
xs:  4px
sm:  8px
md:  16px
lg:  24px
xl:  32px
xxl: 48px
```

**Regel:** Posts/Cards nutzen `md` (16px) innen, `md` (16px) außen Abstand zueinander.

## Border Radius

- **Buttons, kleine Elemente**: `8px`
- **Cards, Avatare (Profile-Link)**: `12px`
- **Avatare (Story-Reihe)**: kreisförmig (`50%`)
- **Input-Felder**: `8px`

## Komponenten-Muster

### Post/Feed-Card
```
┌─────────────────────────────┐
│ [Avatar] Name   [Menu] 3h   │  ← Header: Avatar (24px), Text (sm), Time (tiny)
├─────────────────────────────┤
│       [Bild/Video]          │  ← 16px innen, Rand 12px
├─────────────────────────────┤
│ ❤️ Like  💬 Comment ➡️ Share │  ← Action Buttons (outline, 16px spacing)
│ Like count, Comment preview  │
└─────────────────────────────┤
```

**Spacing:** 16px außen, 16px innen zwischen Sektionen. Avatar 40px, Border 12px radius.

### Chat-Bubble
```
Eingehend (left):      Ausgehend (right):
┌─────────┐            ┌─────────┐
│ Nachricht│            │ Nachricht│
└─────────┘            └─────────┘
Dunkelgrau             Brand-Blau
Radius 20px            Radius 20px
```

Spacing: 12px zwischen Bubbles, 16px von Edge.

### Bottom Navigation (Tab Bar)
```
┌───────────────────────────────────┐
│  🏠  💬  📷  👥  ⚙️                │
│      (Label optional)              │
└───────────────────────────────────┘
```
5 Tabs, Icon 28px, Spacing 32px. Aktiver Tab: Brand-Blau, inaktiv: Mittelgrau.

### Story-Reihe (oberhalb Chat-Liste)
```
┌──────┬──────┬──────┬──────┐
│ 50px │ 50px │ 50px │ ...  │ (Avatare, kreisförmig)
│ Name │ Name │ Name │      │
└──────┴──────┴──────┴──────┘
```
Spacing zwischen Avataren: 12px. Border bei ungesehener Story: Brand-Blau (2px), bei gesehen: Mittelgrau.

## Icons

### Icon-Stil
- **Outline-Icons** (nicht gefüllt), Gewicht: 2px Strich
- **Größe:** 24px (default), 28px (Nav), 16px (inline Text)
- **Farbe:** Dunkelgrau (Light) / Weiß (Dark), Brand-Blau bei aktiv/liked

### Häufige Icons (IG-inspiriert, aber eigenständig)
- Like: Herz-Outline (gefüllt, wenn liked)
- Comment: Sprechblase-Outline
- Share/Repost: Pfeil-Outline (nach oben-rechts)
- Profil: Person-Outline
- Messenger: Sprechblase + Punkt-Outline
- Suche: Lupe-Outline
- Einstellungen: Zahnrad-Outline
- Zurück: Pfeil-Links-Outline
- Menu (3 Punkte): Vertikal, drei Punkte

**Quelle:** Nutze Expo Icons (`@expo/vector-icons/Feather` oder `MaterialCommunityIcons`) oder exportiere SVGs aus dem Prototyp.

## Dark Mode

Alle Farben haben Dark-Varianten:
- Text: #FFFFFF (statt #262626)
- Background: #121212 (statt #F5F5F5)
- Card: #1E1E1E (statt #FFFFFF)
- Borders/Separators: #333333 (statt #E5E5E5)

**Implementierung:** React Native `useColorScheme()` (Expo) oder Manually via Theme Context.

## Wann dieses Skill laden?

- Vor dem Design/Code einer neuen Screen → Styling korrekt, konsistent
- Vor Komponenten-Erstellung → Design-Tokens einbauen
- Bei Farb-/Layout-Fragen → hier nachschlagen

## Beispiel-Use

Neue Chat-Liste aufbauen:
1. Dieses Skill laden
2. Für Card-Style: 16px innen, 16px außen, Brand-Blau bei Hover
3. Avatar: 40px, 12px radius, Story-Border 2px Brand-Blau wenn neue Messages
4. Text: Body (16px) für Name, Small (13px) für Nachricht-Preview
5. Icons: 24px Outline von Feather Icons, Dunkelgrau
