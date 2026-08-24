# All Media App 📱

Eine moderne Social-Media-App mit Messenger, Video-Feed, Communitys und mehr — gebaut mit React Native (Expo) und einer Web-Mockup für schnelles Testing.

## 🚀 Schnellstart

### Web-Version (lokal testen)
```bash
cd app
node web-app.js
```
Öffne dann im Browser: **http://localhost:3000**

### React-Native (Entwicklung)
```bash
cd app
npm install
npm start
```

## 📁 Projektstruktur

```
All-Media/
├── app/                          # Hauptanwendung
│   ├── screens/                  # React Native Screens
│   │   ├── messenger/
│   │   │   ├── ChatListScreen.tsx
│   │   │   ├── ChatDetailScreen.tsx
│   │   │   ├── ContactsScreen.tsx
│   │   │   ├── StoriesScreen.tsx
│   │   │   ├── CameraScreen.tsx
│   │   │   └── GroupManagementScreen.tsx
│   ├── components/               # Wiederverwendbare Komponenten
│   │   └── SearchBar.tsx
│   ├── contexts/                 # State Management
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── NotificationContext.tsx
│   ├── types/                    # TypeScript Interfaces
│   ├── mocks/                    # Mock-Daten für Tests
│   ├── constants/                # Design-Tokens
│   ├── web-app.js                # Express Web-Server (HTML/CSS/JS)
│   └── App.tsx                   # Hauptapp mit Navigation
├── .claude/                      # Claude Code Konfiguration
│   └── skills/
│       └── ig-inspired-design/   # Design-System Skill
└── README.md
```

## 🎯 Features

### Phase 1 ✓ (Messenger Core)
- [x] Chat-Liste mit ungelesenen Badges
- [x] Einzelner Chat mit Nachrichten
- [x] Kontakte-Verwaltung
- [x] Profil & Einstellungen

### Phase 2 ✓ (Erweitert)
- [x] Stories (Ansehen & Viewer)
- [x] Kamera-UI (Photo/Video Modus)
- [x] Gruppen erstellen & verwalten
- [x] Suche-Komponent
- [x] Dark Mode Support (ThemeContext)

### Phase 3 🔄 (Backend & Realtime)
- [x] Supabase Foundation (Context, Auth, Types)
- [x] Realtime Message Sync (useChatMessages Hook)
- [x] Media-Upload (expo-image-picker + supabaseStorage)
- [x] User Presence Tracking (online/offline status)
- [x] Typing Indicators (\"user is typing\")
- [x] Photo/Video Capture to Storage
- [ ] LoginScreen with Supabase Auth
- [ ] Push-Notifications (expo-notifications)
- [ ] Video-Calls (WebRTC) — see VIDEO_CALLS_SETUP.md
- [ ] Stories Realtime Upload

**Status**: Foundation complete. Awaiting Supabase setup (see SUPABASE_SETUP.md)

## 🔧 Backend Setup (Phase 3)

### Supabase Integration
1. **Choose**: Local (Docker) or Cloud (Supabase.com)
2. **Read**: `SUPABASE_SETUP.md` for detailed instructions
3. **Schema**: Deploy SQL schema from SUPABASE_SETUP.md
4. **Env**: Create `.env.local` with credentials
5. **Test**: Realtime chat & media upload

### What's Already Built
- ✅ SupabaseContext for client initialization
- ✅ supabaseAuth.ts (signup/signin with fallback)
- ✅ Hooks: useChatMessages, usePresence, useTypingIndicator
- ✅ supabaseStorage.ts (photo/video upload)
- ✅ ChatDetailScreen & CameraScreen connected

No Supabase config needed = app uses mock data automatically.

## 🎨 Design-System

Alle Komponenten folgen dem **Instagram-inspirierten Design**:

- **Akzent-Farbe**: `#0A66FF` (Brand-Blau)
- **Typografie**: System Fonts
- **Spacing**: 4px-Basiseinheit
- **Radius**: 8-16px

## 📱 Multi-Plattform

- ✅ iOS (Expo/TestFlight)
- ✅ Android (Expo/Google Play)
- ✅ Web (Browser-Mockup)

---

**Stand**: 2026-08-24 | **Commits**: 6 | **Screens**: 10+ | **Components**: 25+ | **Hooks**: 10+
