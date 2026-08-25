# Supabase — Einrichtung

Das Projekt ist angelegt: `https://ijztosbjfybdgotpdixw.supabase.co`.
Zugangsdaten stehen im Vault unter `04 Ressourcen/Zugangsdaten/Supabase.md`
und lokal in `app/.env.local` (nicht im Repo).

## Was noch fehlt: das Schema

Die Datenbank ist leer. Einmalig einspielen:

1. Supabase-Dashboard öffnen → **SQL Editor** → **New query**
2. Den kompletten Inhalt von **`SUPABASE_SCHEMA.sql`** hineinkopieren
3. **Run**

Das Skript ist wiederholbar — es legt nur an, was fehlt, und löscht nichts.

## Warum Row Level Security wichtig ist

Der Publishable Key steckt im App-Bundle und ist damit öffentlich. Ohne
Zugriffsregeln könnte jeder alle Daten lesen und ändern. `SUPABASE_SCHEMA.sql`
schaltet deshalb für jede Tabelle Row Level Security ein:

- Profile sind für Angemeldete lesbar, ändern darf jeder nur sich selbst
- Chats und Nachrichten sieht nur, wer Mitglied des Chats ist
- Private Communitys sehen nur ihre Mitglieder
- Likes und Kommentare kann jeder nur für sich setzen

**Der ältere Schema-Vorschlag weiter unten hatte das nicht** und ist damit
unsicher. Er bleibt nur als Referenz stehen; maßgeblich ist
`SUPABASE_SCHEMA.sql`.

## Kosten

Der kostenlose Tarif reicht für dieses Projekt. Sollte etwas kostenpflichtig
werden, wird das vorher angesprochen.

---

## Älterer Entwurf (nicht verwenden, ohne RLS)



## Phase 3: Backend Integration

This guide walks you through setting up Supabase for the All Media app.

### Option 1: Local Development (with Supabase Docker)

For rapid local development without cloud credentials:

```bash
# Install Supabase CLI (macOS with Homebrew)
brew install supabase/tap/supabase

# Start local Supabase (requires Docker)
supabase start

# This runs on http://localhost:54321 (API)
```

The local setup includes:
- PostgreSQL database
- Realtime server
- Vector support
- Dashboard at http://localhost:3000/

When done developing:
```bash
supabase stop
```

### Option 2: Cloud (Supabase Cloud)

1. Sign up at https://app.supabase.com
2. Create a new project (choose your region)
3. Copy your **Project URL** and **Anon Key** from Settings → API

Then add to your `.env.local` (create it in `All-Media/app/`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

### Database Schema (SQL)

Run this SQL in your Supabase SQL Editor to set up tables:

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  avatar_url TEXT,
  status VARCHAR DEFAULT 'offline' CHECK (status IN ('online', 'away', 'offline')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Contacts table
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status VARCHAR DEFAULT 'friend' CHECK (status IN ('friend', 'pending', 'blocked')),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, contact_id)
);

-- Chats table
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_ids UUID[] NOT NULL,
  type VARCHAR DEFAULT 'direct' CHECK (type IN ('direct', 'group')),
  name VARCHAR,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type VARCHAR CHECK (media_type IN ('image', 'video', 'audio')),
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Stories table
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type VARCHAR DEFAULT 'image' CHECK (media_type IN ('image', 'video')),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

-- Groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  members UUID[] NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE chats;
ALTER PUBLICATION supabase_realtime ADD TABLE stories;
```

### Environment Variables

Create `.env.local` in `All-Media/app/`:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

**Important:** Expo requires env vars to be prefixed with `EXPO_PUBLIC_` to be available at runtime.

### Integrate with App

The app automatically:
1. Initializes Supabase in `SupabaseContext`
2. Falls back to mock data if Supabase is unavailable
3. Provides hooks like `useChatMessages()` for Realtime subscriptions

To use Realtime messages in a chat screen:

> **Hinweis (25.08.2026):** Der hier beschriebene Haken
> `useChatMessages` aus `lib/useSupabaseSubscription` **gibt es nicht
> mehr.** Die Phase-3-Haken liessen sich nicht uebersetzen und wurden
> entfernt. Vorhanden sind heute: `contexts/SupabaseContext.tsx`,
> `lib/supabaseAuth.ts`, `lib/supabaseStorage.ts` und
> `lib/supabaseTypes.ts`. Die Realtime-Anbindung wird neu geschrieben,
> sobald das Schema in der Datenbank steht.

### Testing

Start the app:
```bash
cd app
npm start
```

Then scan the QR code in Expo Go, or run on simulator.

Messages will sync in realtime when you have Supabase connected.

Without Supabase credentials, the app uses mock data (development fallback).

---

**Next Steps:**
- [ ] Choose local or cloud Supabase
- [ ] Set up database schema
- [ ] Add `.env.local` with credentials
- [ ] Test Realtime with chat messages
- [ ] Integrate media upload (expo-image-picker)
