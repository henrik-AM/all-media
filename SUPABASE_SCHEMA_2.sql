-- ============================================================================
-- All Media — Schema-Erweiterung 2 (30.08.2026)
--
-- So einspielen: Supabase-Dashboard → SQL Editor → New query → alles hier
-- hineinkopieren → Run. Wiederholbar: legt nur an, was fehlt, löscht nichts.
--
-- Voraussetzung: SUPABASE_SCHEMA.sql wurde bereits eingespielt.
--
-- Warum diese Datei nötig ist
-- ---------------------------
-- Die Sync-Handler der Website schrieben in Tabellen und Spalten, die es in
-- der Datenbank nie gab. Die Fehler wurden abgefangen, die Website fiel still
-- auf Mock-Daten zurück — deshalb wirkte sie „hinterher".
--
-- Ein Teil davon war überflüssig: „videos" ist in Wahrheit ein Beitrag mit
-- kind = 'reel' bzw. 'clip', und „likes" deckt post_likes bereits ab. Diese
-- beiden Tabellen werden NICHT angelegt, stattdessen wurden die Handler
-- korrigiert.
--
-- Was hier wirklich fehlte, sind die folgenden Funktionen.
-- ============================================================================

-- ---------------------------------------------------------- Chat-Zustand --
-- Archiviert, stummgeschaltet, gelesen und Favorit sind Einstellungen *pro
-- Mitglied*, nicht pro Chat — sonst würde Annas Archivieren auch Bobs Liste
-- verändern. Deshalb hängen sie an chat_members.
alter table public.chat_members
  add column if not exists is_archived  boolean default false,
  add column if not exists is_muted     boolean default false,
  add column if not exists is_read      boolean default true,
  add column if not exists is_favorite  boolean default false,
  add column if not exists last_read_at timestamptz;

-- Bisher durfte man Mitgliedschaften nur lesen und anlegen. Für die
-- Einstellungen oben braucht es das Recht, die eigene Zeile zu ändern.
drop policy if exists "Eigene Mitgliedschaft aendern" on public.chat_members;
create policy "Eigene Mitgliedschaft aendern" on public.chat_members
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------ Story-Views --
-- Wer hat die Story schon gesehen? Steuert den grauen statt bunten Ring.
create table if not exists public.story_views (
  story_id   uuid not null references public.stories (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  viewed_at  timestamptz default now(),
  primary key (story_id, user_id)
);

alter table public.story_views enable row level security;

-- Der Story-Autor sieht die Zuschauerliste, jeder Nutzer seine eigenen Views.
drop policy if exists "Story-Views lesen" on public.story_views;
create policy "Story-Views lesen" on public.story_views
  for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.stories s
      where s.id = story_id and s.user_id = auth.uid()
    )
  );

drop policy if exists "Eigenen Story-View setzen" on public.story_views;
create policy "Eigenen Story-View setzen" on public.story_views
  for insert to authenticated with check (auth.uid() = user_id);

-- ----------------------------------------------------- Gespeichert / Merkliste --
create table if not exists public.saves (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  post_id      uuid not null references public.posts (id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (user_id, post_id)
);

alter table public.saves enable row level security;

-- Gespeichertes ist privat — nur der Nutzer selbst sieht seine Merkliste.
drop policy if exists "Eigene Merkliste" on public.saves;
create policy "Eigene Merkliste" on public.saves
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ------------------------------------------------------------------ Reposts --
create table if not exists public.reposts (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  post_id     uuid not null references public.posts (id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (user_id, post_id)
);

alter table public.reposts enable row level security;

-- Reposts sind öffentlich sichtbar (sie erscheinen im Feed), setzen darf sie
-- nur der Nutzer selbst.
drop policy if exists "Reposts lesen" on public.reposts;
create policy "Reposts lesen" on public.reposts
  for select to authenticated using (true);

drop policy if exists "Eigenen Repost setzen" on public.reposts;
create policy "Eigenen Repost setzen" on public.reposts
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- -------------------------------------------------------------------- Teilen --
-- Ein Beitrag, den jemand per Direktnachricht an jemanden geschickt hat.
create table if not exists public.shares (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts (id) on delete cascade,
  shared_by   uuid not null references public.profiles (id) on delete cascade,
  shared_to   uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz default now()
);

create index if not exists shares_empfaenger_idx on public.shares (shared_to, created_at);

alter table public.shares enable row level security;

-- Sichtbar für Absender und Empfänger, sonst niemanden.
drop policy if exists "Geteiltes lesen" on public.shares;
create policy "Geteiltes lesen" on public.shares
  for select to authenticated
  using (auth.uid() = shared_by or auth.uid() = shared_to);

drop policy if exists "Selbst teilen" on public.shares;
create policy "Selbst teilen" on public.shares
  for insert to authenticated with check (auth.uid() = shared_by);

-- ------------------------------------------------------- Blockieren / Stumm --
create table if not exists public.blocks (
  user_id          uuid not null references public.profiles (id) on delete cascade,
  blocked_user_id  uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz default now(),
  primary key (user_id, blocked_user_id),
  constraint blocks_nicht_selbst check (user_id <> blocked_user_id)
);

create table if not exists public.mutes (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  muted_user_id   uuid not null references public.profiles (id) on delete cascade,
  created_at      timestamptz default now(),
  primary key (user_id, muted_user_id),
  constraint mutes_nicht_selbst check (user_id <> muted_user_id)
);

alter table public.blocks enable row level security;
alter table public.mutes  enable row level security;

-- Wen ich blockiert oder stummgeschaltet habe, geht nur mich etwas an. Der
-- Blockierte darf es ausdrücklich NICHT sehen.
drop policy if exists "Eigene Blockliste" on public.blocks;
create policy "Eigene Blockliste" on public.blocks
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Eigene Stummliste" on public.mutes;
create policy "Eigene Stummliste" on public.mutes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ----------------------------------------------------------------- Melden --
create table if not exists public.reports (
  id            uuid primary key default gen_random_uuid(),
  reported_by   uuid not null references public.profiles (id) on delete cascade,
  target_type   text not null check (target_type in ('post', 'comment', 'story', 'user', 'message')),
  target_id     uuid not null,
  reason        text not null default '',
  created_at    timestamptz default now()
);

alter table public.reports enable row level security;

-- Melden ist eine Einbahnstraße: abschicken ja, fremde Meldungen lesen nein.
-- Die Auswertung passiert im Dashboard mit dem Secret Key, der RLS umgeht.
drop policy if exists "Selbst melden" on public.reports;
create policy "Selbst melden" on public.reports
  for insert to authenticated with check (auth.uid() = reported_by);

drop policy if exists "Eigene Meldungen lesen" on public.reports;
create policy "Eigene Meldungen lesen" on public.reports
  for select to authenticated using (auth.uid() = reported_by);

-- -------------------------------------------------------- Benachrichtigungen --
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  actor_id    uuid references public.profiles (id) on delete cascade,
  art         text not null check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system')),
  bereich     text not null default 'aktivitaet' check (bereich in ('aktivitaet', 'nachrichten', 'system')),
  target_type text check (target_type in ('post', 'comment', 'story', 'user', 'message')),
  target_id   uuid,
  text        text default '',
  read_at     timestamptz,
  created_at  timestamptz default now()
);

create index if not exists notifications_posteingang_idx
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Jeder sieht und quittiert nur seinen eigenen Posteingang. Angelegt werden
-- Benachrichtigungen von den Triggern weiter unten, nicht vom Client.
drop policy if exists "Eigene Benachrichtigungen lesen" on public.notifications;
create policy "Eigene Benachrichtigungen lesen" on public.notifications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Eigene Benachrichtigungen quittieren" on public.notifications;
create policy "Eigene Benachrichtigungen quittieren" on public.notifications
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Benachrichtigungen entstehen serverseitig, damit niemand sich selbst oder
-- anderen falsche Meldungen ins Postfach schreiben kann.
create or replace function public.benachrichtige(
  empfaenger uuid, ausloeser uuid, art text, bereich text,
  ziel_typ text, ziel_id uuid, inhalt text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Keine Benachrichtigung über die eigenen Handlungen.
  if empfaenger is null or empfaenger = ausloeser then
    return;
  end if;
  insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id, text)
  values (empfaenger, ausloeser, art, bereich, ziel_typ, ziel_id, coalesce(inhalt, ''));
end;
$$;

-- Like auf einen Beitrag
create or replace function public.on_post_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare autor uuid;
begin
  select user_id into autor from public.posts where id = new.post_id;
  perform public.benachrichtige(autor, new.user_id, 'like', 'aktivitaet', 'post', new.post_id, '');
  return new;
end;
$$;

drop trigger if exists on_post_like_trigger on public.post_likes;
create trigger on_post_like_trigger
  after insert on public.post_likes
  for each row execute function public.on_post_like();

-- Kommentar unter einem Beitrag
create or replace function public.on_comment()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare autor uuid;
begin
  select user_id into autor from public.posts where id = new.post_id;
  perform public.benachrichtige(autor, new.user_id, 'comment', 'aktivitaet', 'comment', new.id, new.text);
  return new;
end;
$$;

drop trigger if exists on_comment_trigger on public.comments;
create trigger on_comment_trigger
  after insert on public.comments
  for each row execute function public.on_comment();

-- Neuer Kontakt
create or replace function public.on_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.benachrichtige(new.contact_id, new.user_id, 'follow', 'aktivitaet', 'user', new.user_id, '');
  return new;
end;
$$;

drop trigger if exists on_contact_trigger on public.contacts;
create trigger on_contact_trigger
  after insert on public.contacts
  for each row execute function public.on_contact();

-- ------------------------------------------------- Profil: fehlende Felder --
-- Die Oberfläche zeigt Initialen, Farbverlauf, Telefonnummer und ob ein
-- Konto privat ist. Bisher standen diese Werte nur in den Mock-Daten.
alter table public.profiles
  add column if not exists initials text default '',
  add column if not exists color    text default '',
  add column if not exists phone    text default '',
  add column if not exists privat   boolean default false;

-- Initialen und Farbe automatisch setzen, damit kein Profil ohne Bild und
-- ohne Kürzel in der Liste steht.
create or replace function public.profil_vervollstaendigen()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  farben text[] := array[
    'linear-gradient(135deg,#FCA2BC,#E04570)',
    'linear-gradient(135deg,#75DCF2,#1791BA)',
    'linear-gradient(135deg,#FBD277,#D88F1C)',
    'linear-gradient(135deg,#A5E8C0,#2F9E68)',
    'linear-gradient(135deg,#C4B5FD,#7C3AED)'
  ];
begin
  if coalesce(new.initials, '') = '' then
    new.initials := upper(
      left(split_part(new.name, ' ', 1), 1) ||
      coalesce(nullif(left(split_part(new.name, ' ', 2), 1), ''), '')
    );
  end if;
  if coalesce(new.color, '') = '' then
    new.color := farben[1 + (abs(hashtext(new.id::text)) % array_length(farben, 1))];
  end if;
  return new;
end;
$$;

drop trigger if exists profil_vervollstaendigen_trigger on public.profiles;
create trigger profil_vervollstaendigen_trigger
  before insert or update on public.profiles
  for each row execute function public.profil_vervollstaendigen();

-- Für bestehende Profile einmal nachziehen.
update public.profiles set initials = initials where coalesce(initials, '') = '';

-- ------------------------------------------------ Beiträge: fehlende Felder --
-- Der Feed zeigt Titel und Vorschaubild; beides fehlte in posts.
alter table public.posts
  add column if not exists title         text default '',
  add column if not exists thumbnail_url text;

-- --------------------------------------------------------------- Realtime --
do $$
begin
  begin
    alter publication supabase_realtime add table public.notifications;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.post_likes;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.comments;
  exception when duplicate_object then null;
  end;
end $$;
