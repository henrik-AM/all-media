# Phase 3: Backend Integration (Supabase)

## Overview

Phase 3 integrates Supabase into the All Media app for:
- Real authentication (Email/Password, OAuth)
- Persistent data storage
- Realtime synchronization of chats, messages, stories
- Media uploads (photos, videos)
- User presence tracking

## What's Been Set Up

### Files Created

1. **`app/constants/supabase.ts`** — Supabase configuration (reads env vars)
2. **`app/contexts/SupabaseContext.tsx`** — Supabase initialization & provider
3. **`app/lib/supabaseAuth.ts`** — Auth functions (signup, signin, signout)
4. **`app/lib/supabaseTypes.ts`** — TypeScript types for database tables
5. **`app/lib/useSupabaseSubscription.ts`** — Realtime subscription hooks
6. **`SUPABASE_SETUP.md`** — Complete setup guide (local or cloud)
7. **`.env.example`** — Environment variable template

### App Integration

- ✅ App.tsx wraps all providers: SupabaseProvider → AuthProvider → ThemeProvider → NotificationProvider
- ✅ Falls back to mock data if Supabase unavailable (dev-friendly)
- ✅ Exposes `useSupabase()` hook for any component that needs database access

## Next Steps (Prioritized)

### Step 1: Supabase Setup (Henrik's Choice)
- [ ] **Option A:** Local development
  - Install Supabase CLI
  - Run `supabase start` (requires Docker)
  - DB available at `http://localhost:54321`

- [ ] **Option B:** Cloud
  - Sign up at https://app.supabase.com
  - Create project
  - Copy URL + Anon Key

### Step 2: Database Schema
- [ ] Copy SQL from SUPABASE_SETUP.md
- [ ] Run in Supabase SQL Editor
- [ ] Tables: users, contacts, chats, messages, stories, groups

### Step 3: Environment Setup
- [ ] Copy `.env.example` → `.env.local`
- [ ] Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Restart app (`npm start`)

### Step 4: Integrate Auth
- [ ] Update LoginScreen to use `signInWithEmail()` from supabaseAuth.ts
- [ ] Test: Sign up → Auto-login flow
- [ ] Verify user can see their chats (still mocked for now)

### Step 5: Realtime Messages (High Impact)
- [ ] Update ChatDetailScreen to:
  - Fetch initial messages from Supabase (using `useChatMessages()` hook)
  - Subscribe to new messages via Realtime
  - Send new message → insert into Supabase (not mock storage)
- [ ] Test: Message appears instantly in Realtime

### Step 6: Media Upload
- [ ] Install `expo-image-picker`
- [ ] Add image/video selection in CameraScreen
- [ ] Upload to Supabase Storage
- [ ] Store reference (URL) in messages/stories

### Step 7: Presence & Typing Indicators
- [ ] Use Supabase Realtime presence to track "online" status
- [ ] Show "User is typing..." in chat

## Fallback Behavior

If Supabase is not configured:
- ✅ App uses mock data (development mode)
- ✅ All UI/UX works, but changes don't persist
- ✅ No errors or crashes
- This is intentional for iteration without backend setup

## Testing Checklist

Once Supabase is set up:

- [ ] App starts without crashes
- [ ] Login with test user works
- [ ] Chat list loads (from DB)
- [ ] Send message → appears in DB
- [ ] Other device opens same chat → sees new message in realtime
- [ ] Stories upload → appear in Stories screen
- [ ] User presence shows online/offline status
- [ ] Media uploads to Storage, displays correctly

## Useful Commands

```bash
# Local Supabase
supabase start
supabase stop
supabase db reset  # Clear and re-seed

# View logs
supabase logs --local

# Check schema
supabase db list
```

## Hooks Reference

### useSupabase()
```typescript
const { supabase, isReady, error } = useSupabase();
```
Access the Supabase client in any component.

### useChatMessages(chatId)
```typescript
const { messages, isLoading } = useChatMessages(chatId);
// Automatically syncs with Realtime
```
Fetch and subscribe to messages in a chat.

### useSupabaseSubscription(table, event, filter)
```typescript
const { data, isLoading, error } = useSupabaseSubscription('stories');
// Generic Realtime subscription
```

## Notes

- Expo requires env vars to start with `EXPO_PUBLIC_` to be accessible at runtime
- Supabase Realtime uses PostgreSQL triggers (already enabled in SQL)
- Mock data fallback means zero hard dependency on Supabase during dev
- Media uploads go to Supabase Storage (separate from database)

---

**Previous Phases:**
- ✅ Phase 1-2: Local React-Native + Web mockup
- **→ Phase 3: Supabase Backend (you are here)**
- Phase 4: App Store Launch
