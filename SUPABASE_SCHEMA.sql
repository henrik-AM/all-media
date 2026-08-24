-- ============================================================================
-- All Media — Datenbankschema für Supabase
--
-- So einspielen: Supabase-Dashboard → SQL Editor → New query → alles hier
-- hineinkopieren → Run. Das Skript ist wiederholbar: es legt nur an, was noch
-- nicht da ist, und löscht nichts.
--
-- WICHTIG: Jede Tabelle bekommt Row Level Security. Der Publishable Key liegt
-- im App-Bundle und ist damit öffentlich — ohne diese Regeln könnte jeder alle
-- Daten lesen und ändern. Die Absicherung passiert hier, nicht im Schlüssel.
-- ============================================================================

-- ---------------------------------------------------------------- Profile --
-- Erweitert auth.users um die Felder, die die App anzeigt.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  handle      text unique not null,
  name        text not null,
  bio         text default '',
  link        text default '',
  status      text default 'offline' check (status in ('online', 'away', 'offline')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.profiles enable row level security;

-- Profile sind für angemeldete Nutzer sichtbar, ändern darf jeder nur sich selbst.
drop policy if exists "Profile lesen" on public.profiles;
create policy "Profile lesen" on public.profiles
  for select to authenticated using (true);

drop policy if exists "Eigenes Profil anlegen" on public.profiles;
create policy "Eigenes Profil anlegen" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "Eigenes Profil aendern" on public.profiles;
create policy "Eigenes Profil aendern" on public.profiles
  for update to authenticated using (auth.uid() = id);

-- Beim Registrieren automatisch ein Profil anlegen, sonst hat der neue Nutzer
-- keinen Namen und die App zeigt eine leere Zeile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, handle, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'handle', '@' || split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------------------- Kontakte --
create table if not exists public.contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  contact_id  uuid not null references public.profiles (id) on delete cascade,
  status      text default 'pending' check (status in ('friend', 'pending', 'blocked')),
  created_at  timestamptz default now(),
  unique (user_id, contact_id)
);

alter table public.contacts enable row level security;

drop policy if exists "Eigene Kontakte" on public.contacts;
create policy "Eigene Kontakte" on public.contacts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ Chats --
create table if not exists public.chats (
  id          uuid primary key default gen_random_uuid(),
  name        text,
  is_group    boolean default false,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists public.chat_members (
  chat_id    uuid not null references public.chats (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz default now(),
  primary key (chat_id, user_id)
);

alter table public.chats        enable row level security;
alter table public.chat_members enable row level security;

-- Hilfsfunktion: Ist der angemeldete Nutzer Mitglied dieses Chats?
-- Als security definer, damit die Prüfung nicht selbst wieder in die
-- Regeln von chat_members läuft (Endlosschleife).
create or replace function public.is_chat_member(target_chat uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.chat_members
    where chat_id = target_chat and user_id = auth.uid()
  );
$$;

drop policy if exists "Eigene Chats lesen" on public.chats;
create policy "Eigene Chats lesen" on public.chats
  for select to authenticated using (public.is_chat_member(id));

drop policy if exists "Chat anlegen" on public.chats;
create policy "Chat anlegen" on public.chats
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Eigene Chats aendern" on public.chats;
create policy "Eigene Chats aendern" on public.chats
  for update to authenticated using (public.is_chat_member(id));

drop policy if exists "Mitglieder lesen" on public.chat_members;
create policy "Mitglieder lesen" on public.chat_members
  for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists "Mitglieder hinzufuegen" on public.chat_members;
create policy "Mitglieder hinzufuegen" on public.chat_members
  for insert to authenticated with check (auth.uid() = user_id or public.is_chat_member(chat_id));

-- ------------------------------------------------------------ Nachrichten --
create table if not exists public.messages (
  id           uuid primary key default gen_random_uuid(),
  chat_id      uuid not null references public.chats (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  text         text not null default '',
  media_url    text,
  media_type   text check (media_type in ('image', 'video', 'audio')),
  reply_to_story uuid,
  created_at   timestamptz default now(),
  read_at      timestamptz
);

create index if not exists messages_chat_id_idx on public.messages (chat_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "Nachrichten im eigenen Chat lesen" on public.messages;
create policy "Nachrichten im eigenen Chat lesen" on public.messages
  for select to authenticated using (public.is_chat_member(chat_id));

drop policy if exists "Nachricht senden" on public.messages;
create policy "Nachricht senden" on public.messages
  for insert to authenticated
  with check (auth.uid() = sender_id and public.is_chat_member(chat_id));

-- ----------------------------------------------------------------- Storys --
create table if not exists public.stories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  media_url   text,
  media_type  text default 'image' check (media_type in ('image', 'video')),
  caption     text,
  created_at  timestamptz default now(),
  expires_at  timestamptz not null default (now() + interval '24 hours')
);

create table if not exists public.story_likes (
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (story_id, user_id)
);

alter table public.stories     enable row level security;
alter table public.story_likes enable row level security;

-- Abgelaufene Storys verschwinden automatisch aus der Abfrage.
drop policy if exists "Aktuelle Storys lesen" on public.stories;
create policy "Aktuelle Storys lesen" on public.stories
  for select to authenticated using (expires_at > now());

drop policy if exists "Eigene Story anlegen" on public.stories;
create policy "Eigene Story anlegen" on public.stories
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Eigene Story loeschen" on public.stories;
create policy "Eigene Story loeschen" on public.stories
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "Story-Likes lesen" on public.story_likes;
create policy "Story-Likes lesen" on public.story_likes
  for select to authenticated using (true);

drop policy if exists "Eigenen Story-Like setzen" on public.story_likes;
create policy "Eigenen Story-Like setzen" on public.story_likes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------- Communitys --
create table if not exists public.communities (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  topic       text default '',
  visibility  text default 'public' check (visibility in ('public', 'private')),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz default now()
);

create table if not exists public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz default now(),
  primary key (community_id, user_id)
);

alter table public.communities       enable row level security;
alter table public.community_members enable row level security;

create or replace function public.is_community_member(target uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.community_members
    where community_id = target and user_id = auth.uid()
  );
$$;

-- Öffentliche Communitys sieht jeder, private nur die Mitglieder.
drop policy if exists "Communitys lesen" on public.communities;
create policy "Communitys lesen" on public.communities
  for select to authenticated
  using (visibility = 'public' or public.is_community_member(id));

drop policy if exists "Community anlegen" on public.communities;
create policy "Community anlegen" on public.communities
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "Community-Mitglieder lesen" on public.community_members;
create policy "Community-Mitglieder lesen" on public.community_members
  for select to authenticated using (true);

drop policy if exists "Selbst beitreten und verlassen" on public.community_members;
create policy "Selbst beitreten und verlassen" on public.community_members
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------- Beiträge und Kommentare --
create table if not exists public.posts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         text default 'post' check (kind in ('post', 'reel', 'clip')),
  description  text default '',
  location     text default '',
  music        text default '',
  media_url    text,
  duration     text,
  created_at   timestamptz default now()
);

create table if not exists public.post_likes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
);

create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (comment_id, user_id)
);

alter table public.posts         enable row level security;
alter table public.post_likes    enable row level security;
alter table public.comments      enable row level security;
alter table public.comment_likes enable row level security;

drop policy if exists "Beitraege lesen" on public.posts;
create policy "Beitraege lesen" on public.posts
  for select to authenticated using (true);

drop policy if exists "Eigenen Beitrag verwalten" on public.posts;
create policy "Eigenen Beitrag verwalten" on public.posts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Likes lesen" on public.post_likes;
create policy "Likes lesen" on public.post_likes
  for select to authenticated using (true);

drop policy if exists "Eigenen Like setzen" on public.post_likes;
create policy "Eigenen Like setzen" on public.post_likes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Kommentare lesen" on public.comments;
create policy "Kommentare lesen" on public.comments
  for select to authenticated using (true);

drop policy if exists "Eigenen Kommentar verwalten" on public.comments;
create policy "Eigenen Kommentar verwalten" on public.comments
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Kommentar-Likes lesen" on public.comment_likes;
create policy "Kommentar-Likes lesen" on public.comment_likes
  for select to authenticated using (true);

drop policy if exists "Eigenen Kommentar-Like setzen" on public.comment_likes;
create policy "Eigenen Kommentar-Like setzen" on public.comment_likes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- --------------------------------------------------------------- Realtime --
-- Damit neue Nachrichten sofort ankommen, ohne dass die App nachfragen muss.
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.chats;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.stories;
  exception when duplicate_object then null;
  end;
end $$;
