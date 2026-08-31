-- ===========================================================================
-- All Media — Schema 5: alles, was für echte Inhalte noch fehlte
-- ===========================================================================
--
-- Bis hierher konnten Website und App nur Namen, Chats und nackte Beiträge aus
-- der Datenbank lesen. Alles andere — Videos im Querformat, Sounds mit
-- Liedtext, Standorte, Hashtags, die Kanäle einer Community, die Freundeskarte
-- — stand nur in den Beispieldaten im Quelltext. Genau deshalb konnten beide
-- Fassungen nie denselben Stand haben.
--
-- Diese Datei legt die fehlenden Spalten und Tabellen an. Die Inhalte selbst
-- kommen in SUPABASE_SCHEMA_6_inhalte.sql.
--
-- Gefahrlos mehrfach ausführbar.
-- ===========================================================================


-- ------------------------------------------------------------------ Profile
-- „about" ist der Satz unter dem Namen in der Kontaktliste („Verfügbar",
-- „Im Meeting"). „highlights" und „playlists" sind die Reiter auf der
-- Profilseite.
alter table public.profiles
  add column if not exists about      text default '',
  add column if not exists highlights text[] default '{}',
  add column if not exists playlists  text[] default '{}',
  add column if not exists demo       boolean default false;

comment on column public.profiles.demo is
  'Von SUPABASE_SCHEMA_6_inhalte.sql angelegtes Beispielprofil, kein echter Mensch.';

/*
 * Sockelzahlen.
 *
 * Die Beispielinhalte tragen Zahlen, die eine benutzte App zeigen würde:
 * 12.400 Follower, 342 Likes. Zwölftausend Folgen-Zeilen dafür anzulegen wäre
 * Unsinn. Also steht die historische Zahl als Sockel in einer eigenen Spalte
 * und die echten Zeilen werden obendrauf gezählt. Wer jetzt auf „Gefällt mir"
 * tippt, sieht 343 — und die 343 ist zur Hälfte echt.
 *
 * Bei einem neu angelegten Profil oder Beitrag ist der Sockel 0. Dann ist
 * jede angezeigte Zahl vollständig echt.
 */
alter table public.profiles
  add column if not exists followers_basis bigint default 0,
  add column if not exists following_basis bigint default 0,
  add column if not exists beitraege_basis bigint default 0;


-- ------------------------------------------------------------------- Folgen
-- Vorher wurde „folgt dir" aus einer festen Liste im Quelltext gelesen. Die
-- Zahlen unter dem Profil (Follower, Gefolgt) zählen jetzt echte Zeilen.
create table if not exists public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

drop policy if exists "Folgen lesen" on public.follows;
create policy "Folgen lesen" on public.follows
  for select to authenticated using (true);

drop policy if exists "Selbst folgen und entfolgen" on public.follows;
create policy "Selbst folgen und entfolgen" on public.follows
  for all to authenticated
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);


-- ----------------------------------------------------------------- Beiträge
-- „format" ist nicht dasselbe wie „kind": kind trennt Beitrag / Hochformat /
-- Querformat, format trennt innerhalb des Querformats die Knöpfe der
-- Filterleiste (Standard, 360°, Live). Beides in eine Spalte zu pressen war
-- der Grund, warum unter allen vier Knöpfen dieselben Videos standen.
alter table public.posts
  add column if not exists tags        text[] default '{}',
  add column if not exists views       bigint default 0,
  add column if not exists format      text default 'standard',
  add column if not exists zuschauer   integer,
  add column if not exists untertitel  boolean default false,
  add column if not exists kapitel     jsonb default '[]'::jsonb,
  add column if not exists demo        boolean default false,
  add column if not exists likes_basis    bigint default 0,
  add column if not exists shares_basis   bigint default 0,
  add column if not exists comments_basis bigint default 0;

do $$
begin
  alter table public.posts
    add constraint posts_format_check check (format in ('standard', '360', 'live'));
exception when duplicate_object then null;
end $$;

create index if not exists posts_kind_idx   on public.posts (kind, created_at desc);
create index if not exists posts_format_idx on public.posts (format);
create index if not exists posts_tags_idx   on public.posts using gin (tags);


-- ------------------------------------------------------------------- Sounds
-- Liedtext strophenweise: eine leere Zeichenkette trennt zwei Strophen.
-- Instrumentalstücke haben null, damit die Seite „kein Liedtext" sagen kann
-- statt „Instrumental" als Liedzeile auszugeben.
create table if not exists public.sounds (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  artist     text not null default '',
  uses       bigint default 0,
  dauer      text default '',
  lyrics     text[],
  created_at timestamptz default now()
);

alter table public.sounds enable row level security;

drop policy if exists "Sounds lesen" on public.sounds;
create policy "Sounds lesen" on public.sounds
  for select to authenticated using (true);


-- ---------------------------------------------------------------- Standorte
-- „ort" verbindet den Standort mit dem location-Feld der Beiträge; ohne das
-- bliebe die Standortseite immer leer. x und y sind die Position auf der
-- Karte im Prototyp-Frame.
create table if not exists public.places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  ort         text not null default '',
  adresse     text default '',
  koordinaten text default '',
  x           numeric default 50,
  y           numeric default 50,
  beitraege_basis bigint default 0,
  created_at  timestamptz default now()
);

alter table public.places enable row level security;

drop policy if exists "Standorte lesen" on public.places;
create policy "Standorte lesen" on public.places
  for select to authenticated using (true);


-- ----------------------------------------------------------------- Hashtags
create table if not exists public.hashtags (
  tag             text primary key,
  beitraege_basis bigint default 0,
  created_at      timestamptz default now()
);

alter table public.hashtags enable row level security;

drop policy if exists "Hashtags lesen" on public.hashtags;
create policy "Hashtags lesen" on public.hashtags
  for select to authenticated using (true);

-- Wie oft ein Hashtag benutzt wird, wird gezählt statt gespeichert. Eine
-- gespeicherte Zahl wäre schon nach dem ersten neuen Beitrag falsch.
create or replace view public.hashtags_mit_anzahl as
  select h.tag,
         h.beitraege_basis
           + (select count(*) from public.posts p where h.tag = any (p.tags)) as beitraege
  from public.hashtags h;


-- ---------------------------------------------------------- Freundes­karte --
create table if not exists public.friend_pins (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  x          numeric not null default 50,
  y          numeric not null default 50,
  place      text default '',
  updated_at timestamptz default now()
);

alter table public.friend_pins enable row level security;

drop policy if exists "Pins lesen" on public.friend_pins;
create policy "Pins lesen" on public.friend_pins
  for select to authenticated using (true);

drop policy if exists "Eigenen Pin setzen" on public.friend_pins;
create policy "Eigenen Pin setzen" on public.friend_pins
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- --------------------------------------------------------------- Communitys
alter table public.communities
  add column if not exists bio  text default '',
  add column if not exists link text default '',
  add column if not exists demo boolean default false,
  add column if not exists mitglieder_basis bigint default 0;

-- Aufbau nach Henriks Vorgabe: Community -> Kanal -> Thema. Vorher hingen die
-- Nachrichten an der Community, der Kanal-Endpunkt suchte aber nach dem Kanal
-- und fand nie etwas.
create table if not exists public.community_channels (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  slug         text not null,
  name         text not null,
  topics       text[] default '{}',
  position     integer default 0,
  created_at   timestamptz default now(),
  unique (community_id, slug)
);

create table if not exists public.community_channel_messages (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.community_channels (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
);

alter table public.community_channels         enable row level security;
alter table public.community_channel_messages enable row level security;

-- Ein Kanal ist sichtbar, wenn die Community sichtbar ist. Die Prüfung läuft
-- über dieselbe Hilfsfunktion wie bei der Community selbst.
create or replace function public.community_sichtbar(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.communities c
    where c.id = ziel
      and (c.visibility = 'public' or public.is_community_member(c.id))
  );
$$;

drop policy if exists "Kanaele lesen" on public.community_channels;
create policy "Kanaele lesen" on public.community_channels
  for select to authenticated using (public.community_sichtbar(community_id));

drop policy if exists "Kanal anlegen" on public.community_channels;
create policy "Kanal anlegen" on public.community_channels
  for insert to authenticated with check (public.is_community_member(community_id));

create or replace function public.kanal_sichtbar(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.community_channels k
    where k.id = ziel and public.community_sichtbar(k.community_id)
  );
$$;

drop policy if exists "Kanalnachrichten lesen" on public.community_channel_messages;
create policy "Kanalnachrichten lesen" on public.community_channel_messages
  for select to authenticated using (public.kanal_sichtbar(channel_id));

drop policy if exists "Im Kanal schreiben" on public.community_channel_messages;
create policy "Im Kanal schreiben" on public.community_channel_messages
  for insert to authenticated
  with check (auth.uid() = sender_id and public.kanal_sichtbar(channel_id));


-- ------------------------------------------------------------- Mitteilungen
-- Die App hat zwei Glocken: eine im Videos-Bereich, eine im Community-Bereich
-- (Prototyp-Frames „VP + Mitteilung" und „CP + Mitteilungen"). Die alte
-- Einschränkung kannte diese beiden Bereiche nicht — jede Mitteilung dorthin
-- wäre abgewiesen worden.
alter table public.notifications drop constraint if exists notifications_bereich_check;
alter table public.notifications add constraint notifications_bereich_check
  check (bereich in ('aktivitaet', 'nachrichten', 'system', 'videos', 'communities'));

alter table public.notifications drop constraint if exists notifications_art_check;
alter table public.notifications add constraint notifications_art_check
  check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system',
                 'repost', 'story', 'kanal', 'beitritt', 'nachricht', 'einladung'));

alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('post', 'comment', 'story', 'user', 'message', 'community', 'profile', 'video'));


-- -------------------------------------------------------------------- Chats
-- Henriks Trennung: Messenger = Chat über Telefonnummer/Kontakt.
-- Community-Chat = Kommunikation ohne Telefonnummer. Beides sind Chats, nur
-- in verschiedenen Bereichen der App — deshalb eine Spalte statt zwei
-- Tabellen.
alter table public.chats
  add column if not exists bereich text default 'messenger';

do $$
begin
  alter table public.chats
    add constraint chats_bereich_check check (bereich in ('messenger', 'community'));
exception when duplicate_object then null;
end $$;

alter table public.messages
  add column if not exists demo boolean default false;

/*
 * Zustände, die bisher nur im Arbeitsspeicher des Servers lebten.
 *
 * Ein gesperrter Chat, eine mit einem Stern markierte Nachricht, ein
 * Lieblingskontakt — all das war nach jedem Neustart des Servers wieder weg
 * und existierte in der App überhaupt nicht. Deshalb konnten die beiden
 * Fassungen hier gar nicht gleich sein.
 */
alter table public.chat_members
  add column if not exists is_locked         boolean default false,
  add column if not exists notifications_off boolean default false;

alter table public.contacts
  add column if not exists is_favorite boolean default false;

-- Ein Stern gehört der Person, die ihn setzt: in einer Gruppe markiert jeder
-- seine eigenen Nachrichten.
create table if not exists public.message_stars (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (message_id, user_id)
);

-- „Benachrichtige mich über neue Beiträge dieser Person."
create table if not exists public.post_notify (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz default now(),
  primary key (post_id, user_id)
);

alter table public.message_stars enable row level security;
alter table public.post_notify   enable row level security;

drop policy if exists "Eigene Sterne" on public.message_stars;
create policy "Eigene Sterne" on public.message_stars
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Eigene Beitragshinweise" on public.post_notify;
create policy "Eigene Beitragshinweise" on public.post_notify
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Spendenknopf und Livestream auf dem eigenen Profil.
alter table public.profiles
  add column if not exists spende text,
  add column if not exists live   jsonb;

-- Gemeldete Personen und Inhalte: der Grund gehört zur Meldung, nicht ans
-- Profil des Gemeldeten. Vorher stand er dort und war für alle sichtbar.
alter table public.reports
  add column if not exists erledigt boolean default false;


-- ===========================================================================
-- Startinhalte für neue Konten
-- ===========================================================================
--
-- Beiträge, Storys, Sounds und öffentliche Communitys gehören allen: eine
-- Welt, die jeder Angemeldete sieht. Chats, Kontakte und private Communitys
-- gehören dagegen einer Person. Ein frisch registrierter Nutzer bekommt sie
-- deshalb als eigene Zeilen angelegt — nicht geteilt, sondern seine eigenen.
--
-- Was er bekommt, steht in den Vorlage-Tabellen. Sie zu ändern ändert, was
-- der nächste neue Nutzer vorfindet, ohne dass jemand Code anfassen muss.
-- ===========================================================================

create table if not exists public.vorlage_kontakte (
  kontakt_id uuid primary key references public.profiles (id) on delete cascade,
  status     text not null default 'friend',
  position   integer default 0
);

create table if not exists public.vorlage_chats (
  schluessel text primary key,
  name       text not null,
  is_group   boolean not null default false,
  bereich    text not null default 'messenger',
  mitglieder uuid[] not null default '{}',
  position   integer default 0
);

create table if not exists public.vorlage_nachrichten (
  id             bigserial primary key,
  chat           text not null references public.vorlage_chats (schluessel) on delete cascade,
  -- null bedeutet: der Nutzer selbst hat das geschrieben.
  sender_id      uuid references public.profiles (id) on delete cascade,
  text           text not null,
  minuten_zurueck integer not null default 0
);

create table if not exists public.vorlage_communities (
  schluessel text primary key,
  name       text not null,
  topic      text default '',
  bio        text default '',
  link       text default '',
  mitglieder_basis bigint default 0,
  position   integer default 0
);

create table if not exists public.vorlage_kanaele (
  id         bigserial primary key,
  community  text not null references public.vorlage_communities (schluessel) on delete cascade,
  slug       text not null,
  name       text not null,
  topics     text[] default '{}',
  position   integer default 0,
  unique (community, slug)
);

-- Mitteilungen richten sich an eine Person („Anna gefällt dein Beitrag"). Sie
-- gehören deshalb zu den Startinhalten, nicht in die geteilte Welt.
create table if not exists public.vorlage_mitteilungen (
  id              bigserial primary key,
  bereich         text not null,
  art             text not null,
  actor_id        uuid references public.profiles (id) on delete cascade,
  target_type     text,
  -- Zeigt entweder auf einen festen Beitrag oder — bei einer Community, die
  -- jeder Nutzer als eigene bekommt — auf deren Namen.
  target_id       uuid,
  target_name     text,
  minuten_zurueck integer not null default 0,
  gelesen         boolean default false
);

create table if not exists public.vorlage_kanalnachrichten (
  id              bigserial primary key,
  community       text not null,
  slug            text not null,
  sender_id       uuid references public.profiles (id) on delete cascade,
  text            text not null,
  minuten_zurueck integer not null default 0
);

-- Die Vorlagen sind für alle lesbar, aber nur über die Datenbankkonsole
-- änderbar. Ein Nutzer soll nicht bestimmen können, was andere vorfinden.
do $$
declare t text;
begin
  foreach t in array array['vorlage_kontakte','vorlage_chats','vorlage_nachrichten',
                           'vorlage_communities','vorlage_kanaele','vorlage_kanalnachrichten',
                           'vorlage_mitteilungen']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "Vorlage lesen" on public.%I', t);
    execute format('create policy "Vorlage lesen" on public.%I for select to authenticated using (true)', t);
  end loop;
end $$;


/**
 * Legt für eine Person ihre Startinhalte an: Kontakte, Chats mit Verlauf,
 * die Mitgliedschaft in den öffentlichen Communitys und ihre beiden privaten
 * Communitys mit Kanälen.
 *
 * Läuft ohne Schaden ein zweites Mal: was schon da ist, wird übersprungen.
 */
create or replace function public.starter_inhalte(ziel uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_chat     record;
  v_com      record;
  v_kanal    record;
  v_neu      uuid;
  v_kanal_id uuid;
  v_person   uuid;
  v_chats    integer := 0;
  v_komm     integer := 0;
begin
  if ziel is null then
    return jsonb_build_object('ok', false, 'grund', 'keine Kennung');
  end if;

  -- --- Kontakte ---------------------------------------------------------
  insert into public.contacts (user_id, contact_id, status)
  select ziel, v.kontakt_id, v.status
  from public.vorlage_kontakte v
  where v.kontakt_id <> ziel
  on conflict do nothing;

  -- --- Folgen: den Leuten folgen, die man auch als Kontakt hat ----------
  insert into public.follows (follower_id, followee_id)
  select ziel, v.kontakt_id
  from public.vorlage_kontakte v
  where v.kontakt_id <> ziel and v.status = 'friend'
  on conflict do nothing;

  -- --- Chats ------------------------------------------------------------
  for v_chat in select * from public.vorlage_chats order by position loop
    -- Schon vorhanden? Dann nicht doppelt anlegen.
    if exists (
      select 1
      from public.chats c
      join public.chat_members m on m.chat_id = c.id
      where m.user_id = ziel and c.name = v_chat.name and c.bereich = v_chat.bereich
    ) then
      continue;
    end if;

    insert into public.chats (name, is_group, bereich, created_by)
    values (v_chat.name, v_chat.is_group, v_chat.bereich, ziel)
    returning id into v_neu;

    insert into public.chat_members (chat_id, user_id) values (v_neu, ziel)
    on conflict do nothing;

    foreach v_person in array v_chat.mitglieder loop
      insert into public.chat_members (chat_id, user_id) values (v_neu, v_person)
      on conflict do nothing;
    end loop;

    insert into public.messages (chat_id, sender_id, text, created_at, demo)
    select v_neu, coalesce(n.sender_id, ziel), n.text,
           now() - make_interval(mins => n.minuten_zurueck), true
    from public.vorlage_nachrichten n
    where n.chat = v_chat.schluessel
    order by n.minuten_zurueck desc;

    v_chats := v_chats + 1;
  end loop;

  -- --- Öffentlichen Communitys beitreten --------------------------------
  insert into public.community_members (community_id, user_id)
  select c.id, ziel
  from public.communities c
  where c.demo and c.visibility = 'public'
  on conflict do nothing;

  -- --- Eigene, private Communitys ---------------------------------------
  for v_com in select * from public.vorlage_communities order by position loop
    if exists (select 1 from public.communities where created_by = ziel and name = v_com.name) then
      continue;
    end if;

    insert into public.communities (name, topic, bio, link, visibility, created_by, demo, mitglieder_basis)
    values (v_com.name, v_com.topic, v_com.bio, v_com.link, 'private', ziel, true, v_com.mitglieder_basis)
    returning id into v_neu;

    insert into public.community_members (community_id, user_id) values (v_neu, ziel)
    on conflict do nothing;

    for v_kanal in
      select * from public.vorlage_kanaele where community = v_com.schluessel order by position
    loop
      insert into public.community_channels (community_id, slug, name, topics, position)
      values (v_neu, v_kanal.slug, v_kanal.name, v_kanal.topics, v_kanal.position)
      returning id into v_kanal_id;

      insert into public.community_channel_messages (channel_id, sender_id, text, created_at)
      select v_kanal_id, coalesce(m.sender_id, ziel), m.text,
             now() - make_interval(mins => m.minuten_zurueck)
      from public.vorlage_kanalnachrichten m
      where m.community = v_com.schluessel and m.slug = v_kanal.slug
      order by m.minuten_zurueck desc;
    end loop;

    v_komm := v_komm + 1;
  end loop;

  -- --- Mitteilungen -----------------------------------------------------
  -- Der Satz („Anna gefällt dein Beitrag") entsteht erst beim Ausliefern,
  -- gespeichert wird nur, was passiert ist. Sonst müsste bei jeder
  -- Textänderung der ganze Bestand mitwandern.
  if not exists (select 1 from public.notifications where user_id = ziel) then
    insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id,
                                      read_at, created_at)
    select ziel, v.actor_id, v.art, v.bereich, v.target_type,
           coalesce(
             v.target_id,
             -- Zeigt die Mitteilung auf eine Community, die jeder Nutzer als
             -- eigene bekommt, wird hier seine eigene nachgeschlagen.
             (select c.id from public.communities c
               where c.name = v.target_name
                 and (c.created_by = ziel or c.visibility = 'public')
               order by (c.created_by = ziel) desc
               limit 1)
           ),
           case when v.gelesen then now() else null end,
           now() - make_interval(mins => v.minuten_zurueck)
    from public.vorlage_mitteilungen v;
  end if;

  return jsonb_build_object('ok', true, 'chats', v_chats, 'communities', v_komm);
end;
$$;

grant execute on function public.starter_inhalte(uuid) to authenticated;


/**
 * Ein Konto auf den Startzustand zurücksetzen.
 *
 * Wofür: die Prüfläufe. Bisher stellte POST /api/reset die Beispieldaten im
 * Arbeitsspeicher des Servers wieder her. Die gibt es nicht mehr — also muss
 * das Zurücksetzen in der Datenbank passieren.
 *
 * Angefasst wird ausschließlich, was diesem Konto gehört: seine Chats, seine
 * Kontakte, seine Beiträge, seine Likes. Die geteilte Welt (Annas Beiträge,
 * die öffentlichen Communitys) bleibt unberührt. Ein Prüflauf kann damit
 * nichts kaputt machen, was jemand anderem gehört.
 */
create or replace function public.zuruecksetzen(ziel uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare v_geloescht integer := 0;
begin
  if ziel is null then
    return jsonb_build_object('ok', false, 'grund', 'keine Kennung');
  end if;

  -- Beispielprofile lassen sich nicht zurücksetzen: sie SIND der Startzustand.
  if exists (select 1 from public.profiles where id = ziel and demo) then
    return jsonb_build_object('ok', false, 'grund', 'Beispielprofil');
  end if;

  -- Eigene Inhalte und alles, was daran hängt (über die Fremdschlüssel).
  delete from public.posts   where user_id = ziel;
  delete from public.stories where user_id = ziel;

  -- Eigene Spuren an fremden Inhalten.
  delete from public.comments      where user_id = ziel;
  delete from public.post_likes    where user_id = ziel;
  delete from public.comment_likes where user_id = ziel;
  delete from public.story_likes   where user_id = ziel;
  delete from public.story_views   where user_id = ziel;
  delete from public.saves         where user_id = ziel;
  delete from public.reposts       where user_id = ziel;
  delete from public.post_notify   where user_id = ziel;
  delete from public.message_stars where user_id = ziel;
  delete from public.blocks        where user_id = ziel;
  delete from public.mutes         where user_id = ziel;
  delete from public.follows       where follower_id = ziel;
  delete from public.shares        where shared_by = ziel or shared_to = ziel;
  delete from public.reports       where reported_by = ziel;
  delete from public.friend_pins   where user_id = ziel;
  delete from public.notifications where user_id = ziel;
  delete from public.contacts      where user_id = ziel;

  -- Chats: erst austreten, dann die verwaisten entfernen.
  delete from public.chat_members where user_id = ziel;
  delete from public.chats c
   where not exists (select 1 from public.chat_members m where m.chat_id = c.id);

  -- Selbst angelegte Communitys.
  delete from public.community_members where user_id = ziel;
  delete from public.communities where created_by = ziel;

  -- Profilfelder auf den Stand nach der Registrierung.
  update public.profiles
     set bio = '', link = '', highlights = '{}', playlists = '{}',
         spende = null, live = null, status = 'offline'
   where id = ziel;

  perform public.starter_inhalte(ziel);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.zuruecksetzen(uuid) to authenticated;


/**
 * Beim Registrieren mitlaufen lassen.
 *
 * Wichtig: die Startinhalte dürfen die Registrierung nicht scheitern lassen.
 * Genau daran ist sie schon einmal gestorben (siehe SUPABASE_SCHEMA_3.sql).
 * Deshalb steht der Aufruf in einem eigenen Block, der Fehler schluckt und
 * nur eine Warnung schreibt.
 */
create or replace function public.starter_nach_registrierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- Anna, Bob und die anderen sind Beispielprofile aus
  -- SUPABASE_SCHEMA_6_inhalte.sql. Sie brauchen keine Startinhalte — sie
  -- SIND die Startinhalte.
  if exists (
    select 1 from auth.users u
    where u.id = new.id and coalesce((u.raw_user_meta_data ->> 'beispiel')::boolean, false)
  ) then
    return new;
  end if;

  begin
    perform public.starter_inhalte(new.id);
  exception when others then
    raise warning 'Startinhalte fuer % fehlgeschlagen: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists starter_inhalte_trigger on public.profiles;
create trigger starter_inhalte_trigger
  after insert on public.profiles
  for each row execute function public.starter_nach_registrierung();


-- --------------------------------------------------------------- Kennzahlen
-- Follower und Gefolgt werden gezählt, nicht gespeichert. Gespeicherte Zahlen
-- laufen auseinander, sobald jemand folgt oder entfolgt.
create or replace view public.profile_zahlen as
  select p.id,
         p.followers_basis + (select count(*) from public.follows f where f.followee_id = p.id) as followers,
         p.following_basis + (select count(*) from public.follows f where f.follower_id = p.id) as following,
         p.beitraege_basis + (select count(*) from public.posts   b where b.user_id     = p.id) as beitraege
  from public.profiles p;

grant select on public.profile_zahlen        to authenticated;
grant select on public.hashtags_mit_anzahl   to authenticated;
