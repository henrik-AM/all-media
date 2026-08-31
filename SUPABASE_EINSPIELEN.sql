-- ===========================================================================
-- All Media — alles einspielen, was der Datenbank fehlt
-- ===========================================================================
--
-- Stand 31.08.2026. In der Datenbank stecken bisher nur SUPABASE_SCHEMA.sql
-- und SUPABASE_SCHEMA_2.sql. Alles danach — Schema 3 bis 7 — fehlt. Genau
-- deshalb antwortet die Website beim Anmelden mit 500: der Server fragt nach
-- Tabellen wie "follows" oder "community_channels", die es dort nicht gibt.
--
-- So einspielen
-- -------------
--   1. https://supabase.com/dashboard/project/ijztosbjfybdgotpdixw/sql/new
--   2. Den gesamten Inhalt dieser Datei hineinkopieren
--   3. Run
--
-- Es dauert ein paar Sekunden. Am Ende muss "Success" dastehen.
-- Gefahrlos wiederholbar — es wird nichts geloescht, was jemandem gehoert.
--
-- Inhalt:
--   Schema 3  Registrierung reparieren (doppelter Benutzername)
--   Schema 4  Benutzername waehlt der Nutzer selbst
--   Schema 5  fehlende Tabellen und Spalten fuer echte Inhalte

-- ############################ SUPABASE_SCHEMA_3.sql ############################

-- ============================================================================
-- All Media — Schema-Erweiterung 3 (31.08.2026)
--
-- So einspielen: Supabase-Dashboard → SQL Editor → New query → alles hier
-- hineinkopieren → Run. Wiederholbar, löscht nichts.
--
-- Voraussetzung: SUPABASE_SCHEMA.sql und SUPABASE_SCHEMA_2.sql sind drin.
--
-- Warum diese Datei nötig ist
-- ---------------------------
-- Beim Registrieren legt ein Trigger automatisch ein Profil an. Der Benutzer-
-- name kam dabei aus dem Teil vor dem @ der E-Mail-Adresse. „handle" ist aber
-- eindeutig — und damit scheiterte die zweite Registrierung mit demselben
-- Namensteil an einer Schlüsselverletzung.
--
-- Der Trigger läuft in derselben Transaktion wie das Anlegen des Kontos. Sein
-- Fehler nahm also die ganze Registrierung mit: kein Konto, kein Profil, und
-- für den Nutzer eine unverständliche Datenbankmeldung.
--
-- Gegen ein echtes Postgres nachgestellt:
--   henrik@gmx.net    -> @henrik   angelegt
--   anna@beispiel.de  -> @anna     angelegt
--   henrik@gmail.com  -> Fehler: duplicate key ... "profiles_handle_key"
-- ============================================================================

-- Ein freier Benutzername: „@henrik", sonst „@henrik2", „@henrik3" …
create or replace function public.freier_handle(wunsch text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  basis   text;
  kandidat text;
  zaehler int := 1;
begin
  -- Nur Buchstaben, Ziffern, Punkt und Unterstrich; alles andere fliegt raus.
  basis := lower(regexp_replace(coalesce(wunsch, ''), '[^a-zA-Z0-9._]', '', 'g'));
  basis := trim(both '.' from basis);
  if basis = '' then
    basis := 'nutzer';
  end if;
  basis := left(basis, 24);

  kandidat := '@' || basis;
  while exists (select 1 from public.profiles where handle = kandidat) loop
    zaehler := zaehler + 1;
    kandidat := '@' || basis || zaehler::text;
    -- Reißleine, damit die Schleife unter keinen Umständen hängen bleibt.
    if zaehler > 9999 then
      kandidat := '@' || basis || substr(md5(random()::text), 1, 6);
      exit;
    end if;
  end loop;

  return kandidat;
end;
$$;

-- Trigger neu: nutzt den freien Namen und lässt die Registrierung auch dann
-- durchgehen, wenn beim Profil etwas schiefgeht. Ein Konto ohne Profil kann
-- man reparieren — eine gescheiterte Registrierung ist für den Nutzer eine
-- Sackgasse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wunsch text;
  anzeige text;
begin
  wunsch  := coalesce(
    new.raw_user_meta_data ->> 'handle',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  anzeige := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Neues Konto'
  );

  begin
    insert into public.profiles (id, handle, name)
    values (new.id, public.freier_handle(wunsch), anzeige)
    on conflict (id) do nothing;
  exception when others then
    -- Registrierung nicht scheitern lassen; der Grund landet im Log.
    raise warning 'Profil für % konnte nicht angelegt werden: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------- Nachträglich reparieren --
-- Konten, die durch den alten Fehler ohne Profil geblieben sind, bekommen
-- jetzt eines.
insert into public.profiles (id, handle, name)
select
  u.id,
  public.freier_handle(coalesce(u.raw_user_meta_data ->> 'handle', split_part(coalesce(u.email, ''), '@', 1))),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Neues Konto'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;


-- ############################ SUPABASE_SCHEMA_4.sql ############################

-- ============================================================================
-- All Media — Schema-Erweiterung 4 (31.08.2026)
--
-- So einspielen: Supabase-Dashboard → SQL Editor → New query → alles hier
-- hineinkopieren → Run. Wiederholbar, löscht nichts.
--
-- Voraussetzung: SUPABASE_SCHEMA.sql, _2 und _3 sind eingespielt.
--
-- Der Benutzername gehört dem Nutzer
-- ----------------------------------
-- Bisher erzeugte der Trigger den Benutzernamen aus der E-Mail und hängte bei
-- Konflikt eine Zahl an. Das war ein Notnagel gegen abstürzende Registrierungen
-- — aber es ist nicht, was der Prototyp vorsieht.
--
-- Im Prototyp („neues Profil erstellen") gibt der Nutzer als Allererstes seinen
-- Benutzernamen selbst ein, danach Passwort, danach Telefonnummer oder E-Mail.
-- Der Name ist also eine Eingabe, keine Ableitung.
--
-- Damit das funktioniert, braucht es zwei Dinge, die es hier gibt:
--   1. eine Prüfung „ist dieser Name noch frei?", die schon VOR dem
--      Registrieren beantwortbar ist — ohne die Profilliste preiszugeben
--   2. einen Trigger, der den gewünschten Namen unverändert übernimmt
-- ============================================================================

-- --------------------------------------------------- Regeln für den Namen --
-- Drei bis vierundzwanzig Zeichen, Buchstaben, Ziffern, Punkt und Unterstrich.
-- Kein führender oder abschließender Punkt. Das @ gehört nicht dazu, es wird
-- beim Anzeigen davorgesetzt.
create or replace function public.handle_gueltig(eingabe text)
returns boolean
language sql
immutable
as $$
  select eingabe is not null
     and eingabe ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
     and eingabe !~ '\.\.';
$$;

-- Vereinheitlicht die Eingabe: Kleinschreibung, ohne führendes @, ohne
-- Leerzeichen. „@Henrik " und „henrik" sind derselbe Name.
create or replace function public.handle_normal(eingabe text)
returns text
language sql
immutable
as $$
  select lower(trim(both from regexp_replace(coalesce(eingabe, ''), '^@+', '')));
$$;

-- ------------------------------------------------ Ist der Name noch frei? --
-- security definer, damit die Prüfung auch ohne Anmeldung möglich ist: Beim
-- Registrieren ist noch niemand angemeldet. Die Funktion gibt ausschließlich
-- ja/nein zurück — die Profilliste selbst bleibt geschützt.
create or replace function public.handle_frei(eingabe text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
begin
  if not public.handle_gueltig(v_name) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'ungueltig',
      'meldung', 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.'
    );
  end if;

  if exists (select 1 from public.profiles where handle = '@' || v_name) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'vergeben',
      'meldung', 'Dieser Benutzername ist schon vergeben.'
    );
  end if;

  return jsonb_build_object('frei', true, 'handle', '@' || v_name);
end;
$$;

revoke all on function public.handle_frei(text) from public;
grant execute on function public.handle_frei(text) to anon, authenticated;

-- ------------------------------------------------------- Trigger anpassen --
-- Der gewünschte Name wird übernommen, wie er ist. Nur wenn gar keiner
-- mitgeschickt wurde — etwa weil sich jemand über einen anderen Weg
-- registriert —, wird einer erzeugt, damit die Registrierung nicht scheitert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wunsch  text := public.handle_normal(new.raw_user_meta_data ->> 'handle');
  anzeige text;
  final   text;
begin
  anzeige := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(wunsch, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Neues Konto'
  );

  if public.handle_gueltig(wunsch)
     and not exists (select 1 from public.profiles where handle = '@' || wunsch) then
    -- Der Wunschname ist gültig und frei: genau so übernehmen.
    final := '@' || wunsch;
  else
    -- Kein oder kein brauchbarer Wunsch: einen erzeugen, damit die
    -- Registrierung durchgeht. Die Oberfläche soll diesen Fall verhindern,
    -- indem sie vorher handle_frei() fragt.
    final := public.freier_handle(
      coalesce(nullif(wunsch, ''), split_part(coalesce(new.email, ''), '@', 1))
    );
  end if;

  begin
    insert into public.profiles (id, handle, name)
    values (new.id, final, anzeige)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'Profil für % konnte nicht angelegt werden: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------- Anmelden per Benutzername ermöglichen --
-- Der Prototyp lässt beim Anmelden „Benutzername, E-Mail, Telefonnummer" zu.
-- Supabase meldet aber nur mit E-Mail oder Telefonnummer an. Diese Funktion
-- übersetzt einen Benutzernamen in die hinterlegte E-Mail-Adresse, damit die
-- Oberfläche danach ganz normal anmelden kann.
--
-- Sie gibt nur dann etwas zurück, wenn der Name wirklich existiert — und auch
-- dann nur die E-Mail, die zum Anmelden nötig ist. Ohne diese Funktion müsste
-- die Profilliste öffentlich lesbar sein, was deutlich mehr preisgäbe.
create or replace function public.email_zu_handle(eingabe text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
  ziel   text;
begin
  if not public.handle_gueltig(v_name) then
    return null;
  end if;

  select u.email into ziel
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.handle = '@' || v_name;

  return ziel;
end;
$$;

revoke all on function public.email_zu_handle(text) from public;
grant execute on function public.email_zu_handle(text) to anon, authenticated;

-- --------------------------------------------- Benutzername später ändern --
-- Auch nachträglich soll der Name dem Nutzer gehören. Die Regeln gelten
-- genauso, und der Name muss frei sein.
create or replace function public.handle_aendern(eingabe text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
  wer    uuid := auth.uid();
begin
  if wer is null then
    return jsonb_build_object('ok', false, 'meldung', 'Nicht angemeldet.');
  end if;

  if not public.handle_gueltig(v_name) then
    return jsonb_build_object(
      'ok', false,
      'meldung', 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.'
    );
  end if;

  if exists (select 1 from public.profiles where handle = '@' || v_name and id <> wer) then
    return jsonb_build_object('ok', false, 'meldung', 'Dieser Benutzername ist schon vergeben.');
  end if;

  update public.profiles set handle = '@' || v_name, updated_at = now() where id = wer;
  return jsonb_build_object('ok', true, 'handle', '@' || v_name);
end;
$$;

revoke all on function public.handle_aendern(text) from public;
grant execute on function public.handle_aendern(text) to authenticated;


-- ############################ SUPABASE_SCHEMA_5.sql ############################

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


-- ############################ SUPABASE_SCHEMA_6_inhalte.sql ############################

-- ===========================================================================
-- All Media — Schema 6: die Inhalte
-- ===========================================================================
--
-- ERZEUGT, NICHT VON HAND GESCHRIEBEN.
-- Quelle: web/server/app.js, Stand 2026-08-31.
-- Erzeuger: scratchpad/baue-inhalte-sql.mjs
--
-- Bis hierher standen diese Inhalte als Beispieldaten im Quelltext — einmal
-- im Webserver, einmal in app/mocks/index.ts. Zwei Bestände, die auseinander
-- liefen. Ab jetzt stehen sie an einer Stelle: hier, in der Datenbank. Website
-- und App lesen beide von dort und können deshalb gar nicht mehr abweichen.
--
-- Setzt SUPABASE_SCHEMA.sql bis SUPABASE_SCHEMA_5.sql voraus.
-- Gefahrlos mehrfach ausführbar: alle Kennungen sind fest, alles läuft über
-- "on conflict do update".
-- ===========================================================================

begin;


-- --------------------------------------------------------- Beispielprofile
-- Anna, Bob, Clara und die anderen. Sie brauchen einen Eintrag in auth.users,
-- weil profiles.id dorthin zeigt. Ein Passwort haben sie nicht — als Anna
-- anmelden kann sich niemand.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000001', 'authenticated', 'authenticated',
   'anna@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000002', 'authenticated', 'authenticated',
   'bob@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000003', 'authenticated', 'authenticated',
   'clara@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000004', 'authenticated', 'authenticated',
   'david@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000005', 'authenticated', 'authenticated',
   'elif@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000006', 'authenticated', 'authenticated',
   'finn@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000007', 'authenticated', 'authenticated',
   'greta@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000008', 'authenticated', 'authenticated',
   'hakan@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000009', 'authenticated', 'authenticated',
   'ida@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, name, handle, initials, color, phone, privat, about,
                             bio, link, highlights, playlists, status, demo,
                             followers_basis, following_basis, beitraege_basis)
values
  ('11111111-a11e-4d1a-8000-000000000001', 'Anna Schmidt', '@anna', 'AS', 'linear-gradient(135deg,#FCA2BC,#E04570)',
   '+49 151 2345678', false, 'Verfügbar',
   'Bergsteigerin und Fotografin. Immer auf der Suche nach dem ersten Licht.', 'anna-schmidt.de', array['Alpen', 'Ausrüstung', 'Touren']::text[], '{}',
   'offline', true, 12400, 312, 148),
  ('11111111-a11e-4d1a-8000-000000000002', 'Bob Müller', '@bob', 'BM', 'linear-gradient(135deg,#75DCF2,#1791BA)',
   '+49 152 3456789', true, 'Im Meeting',
   'Entwickler. Schreibt über Expo, Navigation und Performance.', 'bobmueller.dev', array['Talks', 'Setup']::text[], '{}',
   'offline', true, 2140, 189, 63),
  ('11111111-a11e-4d1a-8000-000000000003', 'Clara Weber', '@clara', 'CW', 'linear-gradient(135deg,#FBD277,#D88F1C)',
   '+49 160 4567890', false, 'Anfrage gesendet',
   'Hafen, Hamburg, Hochformat.', 'clara.photo', array['Hafen', 'Nebel', 'Nacht']::text[], '{}',
   'offline', true, 8730, 640, 421),
  ('11111111-a11e-4d1a-8000-000000000004', 'David König', '@david', 'DK', 'linear-gradient(135deg,#9FDD84,#419A32)',
   '+49 171 5678901', false, 'Beschäftigt',
   'Produktdesign und Design Systeme. Kaffee als Grundnahrungsmittel.', 'davidkoenig.design', array['Tokens', 'Prozess']::text[], '{}',
   'offline', true, 5310, 274, 97),
  ('11111111-a11e-4d1a-8000-000000000005', 'Elif Yilmaz', '@elif', 'EY', 'linear-gradient(135deg,#FFB877,#EE5F2A)',
   '+49 172 6789012', true, 'Hey, ich nutze All Media!',
   'Kochen ohne Schnickschnack. Rezepte unter zehn Minuten.', 'elif-kocht.de', array['Pasta', 'Meal Prep', 'Basics']::text[], '{}',
   'offline', true, 31200, 128, 289),
  ('11111111-a11e-4d1a-8000-000000000006', 'Finn Bauer', '@finn', 'FB', 'linear-gradient(135deg,#93AEFF,#4152D8)',
   '+49 173 7890123', false, 'Nur dringende Anrufe',
   'Schreibt Software und läuft danach zwanzig Kilometer.', 'finnbauer.io', array['Laufen']::text[], '{}',
   'offline', true, 1180, 402, 54),
  ('11111111-a11e-4d1a-8000-000000000007', 'Greta Hoffmann', '@greta', 'GH', 'linear-gradient(135deg,#FBA0C4,#DC3F7C)',
   '+49 174 8901234', true, '',
   '', '', '{}', '{}',
   'offline', true, 0, 0, 0),
  ('11111111-a11e-4d1a-8000-000000000008', 'Hakan Demir', '@hakan', 'HD', 'linear-gradient(135deg,#6FE2D0,#12907F)',
   '+49 175 9012345', false, '',
   '', '', '{}', '{}',
   'offline', true, 0, 0, 0),
  ('11111111-a11e-4d1a-8000-000000000009', 'Ida Nowak', '@ida', 'IN', 'linear-gradient(135deg,#C4A4F7,#7C46EE)',
   '+49 176 0123456', false, '',
   '', '', '{}', '{}',
   'offline', true, 0, 0, 0)
on conflict (id) do update set
  name = excluded.name, handle = excluded.handle, initials = excluded.initials,
  color = excluded.color, phone = excluded.phone, privat = excluded.privat,
  about = excluded.about, bio = excluded.bio, link = excluded.link,
  highlights = excluded.highlights, playlists = excluded.playlists, demo = true,
  followers_basis = excluded.followers_basis, following_basis = excluded.following_basis,
  beitraege_basis = excluded.beitraege_basis;


-- ----------------------------------------------------------------- Beiträge
-- Ein Video ist ein Beitrag mit kind = 'reel' (Hochformat) oder 'clip'
-- (Querformat). "format" trennt davon unabhängig die Knöpfe der Filterleiste
-- im Querformat: Standard, 360°, Live.
insert into public.posts (id, user_id, kind, format, title, description, location, music,
                          duration, tags, views, zuschauer, untertitel, kapitel,
                          likes_basis, shares_basis, comments_basis, created_at, demo)
values
  ('22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000003', 'post', 'standard',
   '', 'Der Hafen um sechs Uhr morgens. Ganz ohne Menschen.', 'Hamburg', 'Golden Hour – Lys',
   '', array['#hafen', '#nachtfotografie']::text[], 0, null,
   false, '[]'::jsonb,
   342, 0, 24, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000005', 'post', 'standard',
   '', 'Neues Setup steht. Zwei Monitore waren doch die richtige Entscheidung.', 'Köln', 'Originalton',
   '', array['#homeoffice', '#designsystem']::text[], 0, null,
   false, '[]'::jsonb,
   128, 0, 12, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000001', 'post', 'standard',
   '', 'Oben angekommen. Der Aufstieg war jede Minute wert.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '', array['#sonnenaufgang']::text[], 0, null,
   false, '[]'::jsonb,
   1204, 0, 95, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000006', 'post', 'standard',
   '', 'Kleine Commits, klare Historie. Mein Team dankt es mir.', 'Berlin', 'Lo-Fi Focus – beatlab',
   '', array['#reactnative']::text[], 0, null,
   false, '[]'::jsonb,
   87, 0, 8, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000001', 'reel', 'standard',
   '', 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '', array['#sonnenaufgang']::text[], 0, null,
   false, '[]'::jsonb,
   12400, 96, 216, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000004', 'reel', 'standard',
   '', 'So richtet ihr euer Home-Office in 60 Sekunden ein.', 'Köln', 'Lo-Fi Focus – beatlab',
   '', array['#homeoffice', '#designsystem']::text[], 0, null,
   false, '[]'::jsonb,
   8210, 61, 142, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000005', 'reel', 'standard',
   '', 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', 'Hamburg', 'Kitchen Groove – Milo',
   '', array['#mealprep']::text[], 0, null,
   false, '[]'::jsonb,
   24800, 340, 510, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000008', '11111111-a11e-4d1a-8000-000000000002', 'reel', 'standard',
   '', 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', 'Rheinpark', 'Runner High – Aster',
   '', array['#laufen']::text[], 0, null,
   false, '[]'::jsonb,
   3140, 22, 74, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000009', '11111111-a11e-4d1a-8000-000000000006', 'reel', 'standard',
   '', 'Warum kleine Commits dein Leben leichter machen.', 'Berlin', 'Originalton',
   '', array['#reactnative']::text[], 0, null,
   false, '[]'::jsonb,
   5670, 118, 188, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000001', 'clip', '360',
   'Zugspitze bei Sonnenaufgang – die ganze Tour', 'Die ganze Tour von der Hütte bis zum Gipfel, ungeschnitten. Kapitel in der Beschreibung.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '18:42', array['#sonnenaufgang']::text[], 128400, null,
   true, '[{"bei":0,"titel":"Aufbruch an der Hütte"},{"bei":240,"titel":"Über das Blockfeld"},{"bei":620,"titel":"Der Grat"},{"bei":900,"titel":"Sonnenaufgang am Gipfel"}]'::jsonb,
   8420, 0, 211, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000004', 'clip', 'standard',
   'Design Tokens sauber aufsetzen', 'Von der ersten Farbvariable bis zum fertigen Theme — Schritt für Schritt mitgebaut.', 'Köln', 'Lo-Fi Focus – beatlab',
   '24:10', array['#designsystem']::text[], 41200, null,
   true, '[{"bei":0,"titel":"Warum Tokens"},{"bei":180,"titel":"Die erste Farbvariable"},{"bei":600,"titel":"Hell und Dunkel"},{"bei":1100,"titel":"Übergabe an den Code"}]'::jsonb,
   3110, 0, 94, now() - interval '7200 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000005', 'clip', 'standard',
   'Meal Prep für eine ganze Woche', 'Fünf Gerichte, eine Stunde Arbeit, eine ganze Woche satt. Einkaufszettel unten.', 'Hamburg', 'Kitchen Groove – Milo',
   '11:07', array['#mealprep']::text[], 302900, null,
   true, '[{"bei":0,"titel":"Einkaufszettel"},{"bei":120,"titel":"Vorbereiten"},{"bei":400,"titel":"Kochen"},{"bei":580,"titel":"Abfüllen"}]'::jsonb,
   24800, 0, 609, now() - interval '10080 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000013', '11111111-a11e-4d1a-8000-000000000002', 'clip', 'live',
   'Expo SDK 57 live erklärt – Fragen willkommen', 'Was sich mit Expo SDK 57 ändert und worauf man beim Umstieg achten muss.', 'Köln', 'Originalton',
   'LIVE', array['#reactnative']::text[], 18700, 1240,
   false, '[]'::jsonb,
   1240, 0, 57, now() - interval '0 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000014', '11111111-a11e-4d1a-8000-000000000003', 'clip', 'standard',
   'Nachtfotografie am Hafen', 'Blaue Stunde am Hafen: Einstellungen, Stativ, Nachbearbeitung.', 'Hamburg', 'Golden Hour – Lys',
   '15:31', array['#hafen', '#nachtfotografie']::text[], 87300, null,
   true, '[]'::jsonb,
   6180, 0, 141, now() - interval '20160 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000015', '11111111-a11e-4d1a-8000-000000000006', 'clip', 'standard',
   'Kleine Commits, klare Historie', 'Warum kleine Commits das Review leichter machen — mit Beispielen aus echten Projekten.', 'Berlin', 'Originalton',
   '07:44', array['#reactnative']::text[], 22100, null,
   true, '[]'::jsonb,
   1870, 0, 73, now() - interval '30240 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000016', '11111111-a11e-4d1a-8000-000000000003', 'clip', '360',
   'Hamburger Hafen in 360° – einmal um die Elbphilharmonie', 'Rundumblick vom Wasser aus. Zum Umsehen ziehen oder das Handy drehen.', 'Hamburg', 'Harbour Drift – Lys',
   '12:20', array['#hafen', '#360']::text[], 64500, null,
   false, '[]'::jsonb,
   4820, 0, 118, now() - interval '5760 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000017', '11111111-a11e-4d1a-8000-000000000005', 'clip', 'live',
   'Sonntagsküche live – wir kochen zusammen', 'Zwei Gerichte, eine Pfanne, alle Fragen im Chat.', 'Hamburg', 'Originalton',
   'LIVE', array['#mealprep']::text[], 9400, 412,
   false, '[]'::jsonb,
   730, 0, 205, now() - interval '0 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000018', '11111111-a11e-4d1a-8000-000000000001', 'clip', '360',
   'Gipfelpanorama Alpen – 360° Rundflug', 'Einmal über die Gipfelkette, aufgenommen mit einer 360°-Kamera an der Drohne.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '08:05', array['#sonnenaufgang', '#360']::text[], 51200, null,
   false, '[]'::jsonb,
   3940, 0, 87, now() - interval '10080 minutes', true)
on conflict (id) do update set
  kind = excluded.kind, format = excluded.format, title = excluded.title,
  description = excluded.description, location = excluded.location, music = excluded.music,
  duration = excluded.duration, tags = excluded.tags, views = excluded.views,
  zuschauer = excluded.zuschauer, untertitel = excluded.untertitel, kapitel = excluded.kapitel,
  likes_basis = excluded.likes_basis, shares_basis = excluded.shares_basis,
  comments_basis = excluded.comments_basis, demo = true;


-- --------------------------------------------------------------- Kommentare
insert into public.comments (id, post_id, user_id, text, created_at)
values
  ('88888888-a11e-4d1a-8000-000000000001', '22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000001',
   'Das Licht ist der Wahnsinn. Welche Blende?', now() - interval '648 minutes'),
  ('88888888-a11e-4d1a-8000-000000000002', '22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000003',
   'f/8, Stativ und zehn Sekunden Belichtung.', now() - interval '640 minutes'),
  ('88888888-a11e-4d1a-8000-000000000003', '22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000004',
   'Da will ich auch mal hin.', now() - interval '598 minutes'),
  ('88888888-a11e-4d1a-8000-000000000004', '22222222-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000002',
   'Welche Monitore sind das?', now() - interval '1740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000005', '22222222-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000005',
   'Zwei 27 Zoll, nichts Besonderes, aber gleiche Höhe ist wichtig.', now() - interval '1740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000006', '22222222-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000006',
   'Respekt für den Aufstieg!', now() - interval '9040 minutes'),
  ('88888888-a11e-4d1a-8000-000000000007', '22222222-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000001',
   'Kann ich nur unterschreiben.', now() - interval '3280 minutes'),
  ('88888888-a11e-4d1a-8000-000000000008', '22222222-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000004',
   'Wie früh musstest du los?', now() - interval '740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000009', '22222222-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000001',
   'Vier Uhr ab Parkplatz, dann zwei Stunden hoch.', now() - interval '725 minutes'),
  ('88888888-a11e-4d1a-8000-000000000010', '22222222-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000006',
   'Kurz und hilfreich, danke.', now() - interval '1740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000011', '22222222-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000002',
   'Ohne Sahne cremig? Verrate das Geheimnis.', now() - interval '9040 minutes'),
  ('88888888-a11e-4d1a-8000-000000000012', '22222222-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000005',
   'Nudelwasser. Immer Nudelwasser.', now() - interval '9040 minutes'),
  ('88888888-a11e-4d1a-8000-000000000013', '22222222-a11e-4d1a-8000-000000000009', '11111111-a11e-4d1a-8000-000000000003',
   'Mache ich seit einem Jahr, will nicht mehr zurück.', now() - interval '4720 minutes'),
  ('88888888-a11e-4d1a-8000-000000000014', '22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000002',
   'Die Kapitelmarken sind Gold wert.', now() - interval '2880 minutes'),
  ('88888888-a11e-4d1a-8000-000000000015', '22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000005',
   'Wie lange wart ihr insgesamt unterwegs?', now() - interval '2880 minutes'),
  ('88888888-a11e-4d1a-8000-000000000016', '22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000001',
   'Neun Stunden mit Pausen.', now() - interval '1440 minutes'),
  ('88888888-a11e-4d1a-8000-000000000017', '22222222-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000006',
   'Endlich mal ohne Framework-Geplänkel erklärt.', now() - interval '5760 minutes'),
  ('88888888-a11e-4d1a-8000-000000000018', '22222222-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000003',
   'Teil zwei zu Dark Mode wäre super.', now() - interval '4320 minutes'),
  ('88888888-a11e-4d1a-8000-000000000019', '22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000001',
   'Der Einkaufszettel spart mir jede Woche eine Stunde.', now() - interval '8640 minutes'),
  ('88888888-a11e-4d1a-8000-000000000020', '22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000004',
   'Hält das wirklich fünf Tage frisch?', now() - interval '7200 minutes'),
  ('88888888-a11e-4d1a-8000-000000000021', '22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000005',
   'Vier sicher, am fünften würde ich einfrieren.', now() - interval '7200 minutes'),
  ('88888888-a11e-4d1a-8000-000000000022', '22222222-a11e-4d1a-8000-000000000013', '11111111-a11e-4d1a-8000-000000000004',
   'Der Hinweis zum Umstieg hat mir zwei Stunden gespart.', now() - interval '8640 minutes'),
  ('88888888-a11e-4d1a-8000-000000000023', '22222222-a11e-4d1a-8000-000000000014', '11111111-a11e-4d1a-8000-000000000006',
   'Blaue Stunde ist einfach unschlagbar.', now() - interval '20160 minutes'),
  ('88888888-a11e-4d1a-8000-000000000024', '22222222-a11e-4d1a-8000-000000000014', '11111111-a11e-4d1a-8000-000000000002',
   'Welches Stativ nutzt du?', now() - interval '17280 minutes'),
  ('88888888-a11e-4d1a-8000-000000000025', '22222222-a11e-4d1a-8000-000000000015', '11111111-a11e-4d1a-8000-000000000005',
   'Mein Team hat es nach dem Video übernommen.', now() - interval '30240 minutes')
on conflict (id) do update set text = excluded.text;


-- -------------------------------------------------------------------- Storys
-- Beispielstorys laufen nicht ab: die Regel zeigt nur Storys mit
-- expires_at > now(). Mit den üblichen 24 Stunden wäre die Story-Leiste am
-- Tag nach dem Einspielen leer.
insert into public.stories (id, user_id, media_url, media_type, caption, created_at, expires_at)
values
  ('33333333-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000001', null, 'image', 'Erstes Licht auf 2500 Metern',
   now() - interval '90 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000002', null, 'image', 'Neuer Build läuft durch',
   now() - interval '180 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000003', null, 'image', 'Hafen im Nebel',
   now() - interval '270 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000004', null, 'image', 'Schreibtisch neu sortiert',
   now() - interval '360 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000005', null, 'image', 'Pasta in zehn Minuten',
   now() - interval '450 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000006', null, 'image', '20 Kilometer geschafft',
   now() - interval '540 minutes', now() + interval '10 years')
on conflict (id) do update set
  caption = excluded.caption, expires_at = excluded.expires_at;


-- -------------------------------------------------------------------- Sounds
-- lyrics ist strophenweise: eine leere Zeile trennt zwei Strophen.
-- Instrumentalstücke haben null, keinen Ersatztext.
insert into public.sounds (id, title, artist, uses, dauer, lyrics)
values
  ('66666666-a11e-4d1a-8000-000000000001', 'Golden Hour', 'Lys', 12400, '3:46', array['And the light comes slow over the water', 'nobody up but the gulls and me', '', 'Cranes in the mist like a paper drawing', 'the harbour holds its breath', '', 'Golden hour, golden hour', 'stay a little longer now', 'Golden hour, golden hour', 'nothing here needs fixing']::text[]),
  ('66666666-a11e-4d1a-8000-000000000002', 'Lo-Fi Focus', 'beatlab', 8210, '2:58', null),
  ('66666666-a11e-4d1a-8000-000000000003', 'Kitchen Groove', 'Milo', 24800, '3:12', array['Ten minutes and the table is set', 'onions going soft in the pan', '', 'Nobody taught me, I just kept going', 'burnt a lot of Sundays learning how', '', 'Kitchen groove, kitchen groove', 'dinner is an easy thing']::text[]),
  ('66666666-a11e-4d1a-8000-000000000004', 'Runner High', 'Aster', 3140, '4:05', array['One more mile, one more morning', 'the city still asleep behind me', '', 'Legs remember what the head forgets', 'keep the rhythm, keep the rhythm', '', 'Runner high, runner high', 'nothing hurts until I stop']::text[]),
  ('66666666-a11e-4d1a-8000-000000000005', 'Ambient Sunrise', 'Nora K.', 5670, '5:21', null)
on conflict (id) do update set
  title = excluded.title, artist = excluded.artist, uses = excluded.uses,
  dauer = excluded.dauer, lyrics = excluded.lyrics;


-- ----------------------------------------------------------------- Standorte
insert into public.places (id, name, ort, adresse, koordinaten, x, y, beitraege_basis)
values
  ('77777777-a11e-4d1a-8000-000000000001', 'Hamburger Hafen', 'Hamburg', 'Am Sandtorkai, 20457 Hamburg, Deutschland',
   '53.5413° N, 9.9891° O', 44, 28, 8730),
  ('77777777-a11e-4d1a-8000-000000000002', 'Zugspitze', 'Zugspitze', 'Zugspitzplatt, 82475 Garmisch-Partenkirchen, Deutschland',
   '47.4211° N, 10.9853° O', 52, 78, 12400),
  ('77777777-a11e-4d1a-8000-000000000003', 'Rheinpark Köln', 'Rheinpark', 'Sachsenbergstraße, 50679 Köln, Deutschland',
   '50.9494° N, 6.9722° O', 30, 52, 3140),
  ('77777777-a11e-4d1a-8000-000000000004', 'Berlin Mitte', 'Berlin', 'Unter den Linden, 10117 Berlin, Deutschland',
   '52.5170° N, 13.3889° O', 70, 34, 22100),
  ('77777777-a11e-4d1a-8000-000000000005', 'Alster', 'Hamburg', 'An der Alster, 20099 Hamburg, Deutschland',
   '53.5586° N, 10.0011° O', 46, 25, 5310)
on conflict (id) do update set
  name = excluded.name, ort = excluded.ort, adresse = excluded.adresse,
  koordinaten = excluded.koordinaten, x = excluded.x, y = excluded.y,
  beitraege_basis = excluded.beitraege_basis;


-- ------------------------------------------------------------------ Hashtags
insert into public.hashtags (tag, beitraege_basis)
values
  ('#sonnenaufgang', 128400),
  ('#designsystem', 41200),
  ('#mealprep', 302900),
  ('#reactnative', 18700),
  ('#hafen', 87300),
  ('#laufen', 220100),
  ('#homeoffice', 64800),
  ('#nachtfotografie', 39100)
on conflict (tag) do update set beitraege_basis = excluded.beitraege_basis;


-- ------------------------------------------------------------- Freundeskarte
insert into public.friend_pins (user_id, x, y, place, updated_at)
values
  ('11111111-a11e-4d1a-8000-000000000001', 24, 30, 'Zugspitze', now() - interval '5 minutes'),
  ('11111111-a11e-4d1a-8000-000000000002', 62, 22, 'Köln Innenstadt', now() - interval '12 minutes'),
  ('11111111-a11e-4d1a-8000-000000000003', 45, 55, 'Hamburger Hafen', now() - interval '60 minutes'),
  ('11111111-a11e-4d1a-8000-000000000004', 76, 63, 'Köln Ehrenfeld', now() - interval '120 minutes'),
  ('11111111-a11e-4d1a-8000-000000000005', 18, 72, 'Zuhause', now() - interval '0 minutes'),
  ('11111111-a11e-4d1a-8000-000000000006', 58, 82, 'Rheinpark', now() - interval '20 minutes')
on conflict (user_id) do update set
  x = excluded.x, y = excluded.y, place = excluded.place, updated_at = excluded.updated_at;


-- ------------------------------------------------------ Öffentliche Gruppen
-- Diese Communitys gehören allen: eine Welt, die jeder Angemeldete sieht.
-- Die privaten („Team Intern", „Laufgruppe Köln") bekommt jeder Nutzer als
-- eigene angelegt — siehe die Vorlagen weiter unten.
insert into public.communities (id, name, topic, bio, link, visibility, created_by,
                                mitglieder_basis, demo)
values
  ('44444444-a11e-4d1a-8000-000000000001', 'Design Systeme', 'Komponenten, Tokens, Figma', 'Alles rund um Komponenten, Tokens und den Weg von Figma in den Code. Fragen jederzeit willkommen.', 'designsysteme.de',
   'public', '11111111-a11e-4d1a-8000-000000000001', 1284, true),
  ('44444444-a11e-4d1a-8000-000000000002', 'React Native DE', 'Expo, Navigation, Performance', 'Deutschsprachige Runde zu React Native und Expo. Von der ersten App bis zum Store-Release.', 'rn-de.dev',
   'public', '11111111-a11e-4d1a-8000-000000000002', 842, true),
  ('44444444-a11e-4d1a-8000-000000000003', 'Fotografie', 'Licht, Komposition, Nachbearbeitung', 'Licht, Komposition, Nachbearbeitung. Jeden Sonntag ein gemeinsames Thema.', 'lichtundschatten.foto',
   'public', '11111111-a11e-4d1a-8000-000000000003', 3120, true),
  ('44444444-a11e-4d1a-8000-000000000004', 'Musikproduktion', 'Ableton, Mixing, Sounddesign', 'Ableton, Mixing, Sounddesign. Feedback-Runden am Monatsende.', 'musikproduktion.club',
   'public', '11111111-a11e-4d1a-8000-000000000004', 671, true)
on conflict (id) do update set
  name = excluded.name, topic = excluded.topic, bio = excluded.bio, link = excluded.link,
  visibility = excluded.visibility, mitglieder_basis = excluded.mitglieder_basis, demo = true;


-- ------------------------------------------------- Kanäle dieser Communitys
-- Aufbau: Community -> Kanal -> Thema.
insert into public.community_channels (id, community_id, slug, name, topics, position)
values
  ('55555555-a11e-4d1a-8000-000000000001', '44444444-a11e-4d1a-8000-000000000001', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000002', '44444444-a11e-4d1a-8000-000000000001', 'ch-tokens', 'Design Tokens', array['Struktur', 'Best Practices']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000003', '44444444-a11e-4d1a-8000-000000000001', 'ch-figma', 'Figma', array['Plugins', 'Workflows']::text[], 2),
  ('55555555-a11e-4d1a-8000-000000000004', '44444444-a11e-4d1a-8000-000000000002', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000005', '44444444-a11e-4d1a-8000-000000000002', 'ch-expo', 'Expo', array['SDK Updates', 'Debugging']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000006', '44444444-a11e-4d1a-8000-000000000002', 'ch-navigation', 'Navigation', array['React Navigation', 'Router']::text[], 2),
  ('55555555-a11e-4d1a-8000-000000000007', '44444444-a11e-4d1a-8000-000000000003', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000008', '44444444-a11e-4d1a-8000-000000000003', 'ch-licht', 'Licht & Belichtung', array['Goldene Stunde', 'ISO']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000009', '44444444-a11e-4d1a-8000-000000000003', 'ch-nachbearbeitung', 'Nachbearbeitung', array['Lightroom', 'Capture One']::text[], 2),
  ('55555555-a11e-4d1a-8000-000000000010', '44444444-a11e-4d1a-8000-000000000004', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000011', '44444444-a11e-4d1a-8000-000000000004', 'ch-ableton', 'Ableton Live', array['Devices', 'Workflow']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000012', '44444444-a11e-4d1a-8000-000000000004', 'ch-mixing', 'Mixing & Mastering', array['Techniken', 'Feedback']::text[], 2)
on conflict (id) do update set
  name = excluded.name, topics = excluded.topics, position = excluded.position;

-- Verlauf in den Kanälen. Beim erneuten Einspielen zuerst leeren,
-- sonst stünde jede Nachricht doppelt da.
delete from public.community_channel_messages
 where channel_id in (select id from public.community_channels
                       where community_id in (select id from public.communities where demo and visibility = 'public'));

insert into public.community_channel_messages (channel_id, sender_id, text, created_at)
values
  ('55555555-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000001', 'Hat jemand Erfahrung mit Design Tokens in Figma Variables?', now() - interval '528 minutes'),
  ('55555555-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000004', 'Ja, wir nutzen das seit einem halben Jahr produktiv', now() - interval '520 minutes'),
  ('55555555-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000004', 'Zwei Modi in einer Collection, das reicht meistens', now() - interval '509 minutes'),
  ('55555555-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000003', 'Welches Plugin nutzt ihr zum Exportieren?', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000001', 'Wir gehen inzwischen ohne Plugin über die API', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000002', 'Expo SDK 57 läuft bei mir stabil', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000005', 'Bei mir auch, nur der Metro Cache zickt manchmal', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000006', 'Router oder React Navigation für neue Projekte?', now() - interval '9040 minutes'),
  ('55555555-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000002', 'Router, wenn du sowieso auf Expo setzt', now() - interval '9040 minutes'),
  ('55555555-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000008', '11111111-a11e-4d1a-8000-000000000003', 'Goldene Stunde heute um 19:40', now() - interval '9040 minutes'),
  ('55555555-a11e-4d1a-8000-000000000009', '11111111-a11e-4d1a-8000-000000000005', 'Capture One für Farben, Lightroom für alles andere', now() - interval '4720 minutes'),
  ('55555555-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000005', 'Neuer Track ist fertig gemischt', now() - interval '4720 minutes'),
  ('55555555-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000002', 'Wie laut mastert ihr für Streaming?', now() - interval '3280 minutes'),
  ('55555555-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000005', '-14 LUFS integrated, dann macht keine Plattform Ärger', now() - interval '3280 minutes')
;


-- ===========================================================================
-- Vorlagen: was ein neu registrierter Nutzer vorfindet
-- ===========================================================================
--
-- Chats und Kontakte gehören einer Person, nicht allen. Sie werden deshalb
-- nicht hier angelegt, sondern für jedes neue Konto einzeln — aus diesen
-- Vorlagen, von public.starter_inhalte() aus SUPABASE_SCHEMA_5.sql.

delete from public.vorlage_kontakte;
insert into public.vorlage_kontakte (kontakt_id, status, position)
values
  ('11111111-a11e-4d1a-8000-000000000001', 'friend', 0),
  ('11111111-a11e-4d1a-8000-000000000002', 'friend', 1),
  ('11111111-a11e-4d1a-8000-000000000003', 'pending', 2),
  ('11111111-a11e-4d1a-8000-000000000004', 'friend', 3),
  ('11111111-a11e-4d1a-8000-000000000005', 'friend', 4),
  ('11111111-a11e-4d1a-8000-000000000006', 'friend', 5)
;

delete from public.vorlage_nachrichten;
delete from public.vorlage_chats;
insert into public.vorlage_chats (schluessel, name, is_group, bereich, mitglieder, position)
values
  ('c1', 'Anna Schmidt', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000001']::uuid[], 0),
  ('c2', 'Bob Müller', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000002']::uuid[], 1),
  ('c3', 'Clara Weber', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000003']::uuid[], 2),
  ('c4', 'Projekt Team', true, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000004']::uuid[], 3),
  ('c5', 'David König', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000004']::uuid[], 4),
  ('c6', 'Elif Yilmaz', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000005']::uuid[], 5),
  ('c7', 'Wochenend-Crew', true, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000006']::uuid[], 6),
  ('c8', 'Finn Bauer', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000006']::uuid[], 7),
  ('cc1', 'Greta Hoffmann', false, 'community',
   array['11111111-a11e-4d1a-8000-000000000007']::uuid[], 8),
  ('cc2', 'Hakan Demir', false, 'community',
   array['11111111-a11e-4d1a-8000-000000000008']::uuid[], 9),
  ('cc3', 'Design-Runde', true, 'community',
   array['11111111-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000008', '11111111-a11e-4d1a-8000-000000000009']::uuid[], 10),
  ('cc4', 'Ida Nowak', false, 'community',
   array['11111111-a11e-4d1a-8000-000000000009']::uuid[], 11)
;

-- sender_id null bedeutet: der Nutzer selbst hat das geschrieben.
insert into public.vorlage_nachrichten (chat, sender_id, text, minuten_zurueck)
values
  ('c1', '11111111-a11e-4d1a-8000-000000000001', 'Hey! Wie läuft das Projekt?', 243),
  ('c1', null, 'Läuft gut, bin fast fertig mit dem Design', 239),
  ('c1', '11111111-a11e-4d1a-8000-000000000001', 'Super, kannst du mir das nachher zeigen?', 223),
  ('c1', null, 'Klar, so gegen 17 Uhr?', 214),
  ('c1', '11111111-a11e-4d1a-8000-000000000001', 'Klingt gut, bis später!', 209),
  ('c2', '11111111-a11e-4d1a-8000-000000000002', 'Hast du die Unterlagen schon?', 323),
  ('c2', null, 'Noch nicht, kannst du sie schicken?', 307),
  ('c2', '11111111-a11e-4d1a-8000-000000000002', 'Schicke dir die Datei gerade', 296),
  ('c3', '11111111-a11e-4d1a-8000-000000000003', 'Schau mal, was ich gefunden habe', 382),
  ('c3', '11111111-a11e-4d1a-8000-000000000003', 'Foto', 373),
  ('c4', '11111111-a11e-4d1a-8000-000000000001', 'Sind alle für morgen bereit?', 1744),
  ('c4', '11111111-a11e-4d1a-8000-000000000002', 'Von meiner Seite ja', 1743),
  ('c4', null, 'Ich auch', 1742),
  ('c4', '11111111-a11e-4d1a-8000-000000000004', 'Meeting verschoben auf 15 Uhr', 1741),
  ('c5', null, 'Ich melde mich morgen bei dir', 1742),
  ('c5', '11111111-a11e-4d1a-8000-000000000004', 'Alles klar 👍', 1741),
  ('c6', '11111111-a11e-4d1a-8000-000000000005', 'Sprachnachricht', 9041),
  ('c7', '11111111-a11e-4d1a-8000-000000000003', 'Samstag Grillen?', 9042),
  ('c7', '11111111-a11e-4d1a-8000-000000000005', 'Wer ist dabei?', 9041),
  ('c8', null, 'Kein Problem!', 3282),
  ('c8', '11111111-a11e-4d1a-8000-000000000006', 'Danke dir!', 3281),
  ('cc1', '11111111-a11e-4d1a-8000-000000000007', 'Dein Reel vom Hafen ist stark!', 177),
  ('cc2', '11111111-a11e-4d1a-8000-000000000008', 'Schaust du mal in den Tokens-Kanal?', 321),
  ('cc2', null, 'Mache ich heute Abend', 309),
  ('cc3', '11111111-a11e-4d1a-8000-000000000008', 'Wann passt es euch diese Woche?', 1742),
  ('cc3', '11111111-a11e-4d1a-8000-000000000009', 'Donnerstag passt mir', 1741),
  ('cc4', '11111111-a11e-4d1a-8000-000000000009', 'Danke für den Tipp mit dem Stativ', 9041)
;

delete from public.vorlage_kanalnachrichten;
delete from public.vorlage_kanaele;
delete from public.vorlage_communities;
insert into public.vorlage_communities (schluessel, name, topic, bio, link, mitglieder_basis, position)
values
  ('k4', 'Team Intern', 'Nur für das Kernteam', 'Interner Kanal des Kernteams. Sprintplanung, Entscheidungen, alles Kurzfristige.', '', 12, 0),
  ('k5', 'Laufgruppe Köln', 'Treffpunkte und Termine', 'Wir laufen dienstags und samstags. Treffpunkte und Termine stehen hier.', 'laufgruppe-koeln.de', 96, 1)
;

insert into public.vorlage_kanaele (community, slug, name, topics, position)
values
  ('k4', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('k4', 'ch-sprint', 'Sprint Planning', array['Backlog', 'Reviews']::text[], 1),
  ('k5', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('k5', 'ch-termine', 'Termine', array['Diese Woche', 'Nächste Woche']::text[], 1)
;

insert into public.vorlage_kanalnachrichten (community, slug, sender_id, text, minuten_zurueck)
values
  ('k4', 'ch-allgemein', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', 571),
  ('k4', 'ch-sprint', '11111111-a11e-4d1a-8000-000000000001', 'Sprint-Planung morgen um 10 Uhr', 420),
  ('k4', 'ch-sprint', null, 'Bin dabei', 416),
  ('k5', 'ch-allgemein', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', 571),
  ('k5', 'ch-termine', '11111111-a11e-4d1a-8000-000000000006', 'Samstag 8 Uhr am Rheinpark?', 3282),
  ('k5', 'ch-termine', '11111111-a11e-4d1a-8000-000000000004', 'Passt, ich bringe Wasser mit', 3281)
;

delete from public.vorlage_mitteilungen;
insert into public.vorlage_mitteilungen (bereich, art, actor_id, target_type, target_id,
                                         target_name, minuten_zurueck, gelesen)
values
  ('videos', 'like', '11111111-a11e-4d1a-8000-000000000001', 'post',
   '22222222-a11e-4d1a-8000-000000000001', null, 10, false),
  ('videos', 'follow', '11111111-a11e-4d1a-8000-000000000005', 'profile',
   '11111111-a11e-4d1a-8000-000000000005', null, 95, false),
  ('videos', 'comment', '11111111-a11e-4d1a-8000-000000000003', 'post',
   '22222222-a11e-4d1a-8000-000000000002', null, 260, false),
  ('videos', 'repost', '11111111-a11e-4d1a-8000-000000000004', 'video',
   '22222222-a11e-4d1a-8000-000000000005', null, 1500, true),
  ('videos', 'mention', '11111111-a11e-4d1a-8000-000000000002', 'profile',
   '11111111-a11e-4d1a-8000-000000000002', null, 7200, true),
  ('videos', 'story', '11111111-a11e-4d1a-8000-000000000006', 'profile',
   '11111111-a11e-4d1a-8000-000000000006', null, 11000, true),
  ('videos', 'like', '11111111-a11e-4d1a-8000-000000000003', 'video',
   '22222222-a11e-4d1a-8000-000000000006', null, 30000, true),
  ('videos', 'follow', '11111111-a11e-4d1a-8000-000000000007', 'profile',
   '11111111-a11e-4d1a-8000-000000000007', null, 46000, true),
  ('communities', 'kanal', '11111111-a11e-4d1a-8000-000000000002', 'community',
   null, 'Design Systeme', 25, false),
  ('communities', 'beitritt', '11111111-a11e-4d1a-8000-000000000005', 'community',
   null, 'React Native DE', 180, false),
  ('communities', 'nachricht', '11111111-a11e-4d1a-8000-000000000001', 'community',
   null, 'Design Systeme', 1400, true),
  ('communities', 'einladung', '11111111-a11e-4d1a-8000-000000000004', 'community',
   null, 'Fotografie', 6000, true),
  ('communities', 'beitritt', '11111111-a11e-4d1a-8000-000000000006', 'community',
   null, 'Team Intern', 20000, true)
;


-- ===========================================================================
-- Bestehende Konten nachziehen
-- ===========================================================================
-- Wer sich vor dem Einspielen registriert hat, hat noch keine Startinhalte.
-- Diese Schleife holt das nach. Für neue Konten erledigt es der Trigger aus
-- SUPABASE_SCHEMA_5.sql.
do $$
declare p record;
begin
  for p in select id from public.profiles where not demo loop
    perform public.starter_inhalte(p.id);
  end loop;
end $$;

commit;



-- ############################ SUPABASE_SCHEMA_7_testkonto.sql ############################

-- ===========================================================================
-- All Media — Schema 7: eigene Testinhalte für jedes Konto
-- ===========================================================================
--
-- Wofür diese Datei da ist
-- ------------------------
-- Schema 6 hat die geteilte Welt gefüllt: Annas Beiträge, die Sounds, die
-- Standorte, die öffentlichen Communitys. Was sie nicht gefüllt hat, ist das,
-- was einem Konto SELBST gehört. Ein frisch angemeldeter Nutzer sah deshalb
-- eine belebte Startseite, aber ein leeres eigenes Profil: keine Beiträge,
-- keine Story, keine Merkliste, kein Punkt auf der Freundeskarte.
--
-- Solange es noch keine echten Nutzer gibt, ist genau das der Zustand, in dem
-- All Media geprüft wird. Also bekommt jedes Konto ab jetzt einen eigenen
-- Beispielbestand — je ein Testbeitrag für jede Form, die die App kennt:
--
--   Foto-Beitrag        kind = 'post'
--   Video Hochformat    kind = 'reel'
--   Video Querformat    kind = 'clip',  format = 'standard'
--   360°-Video          kind = 'clip',  format = '360'
--   Live-Video          kind = 'clip',  format = 'live'
--   eigene Story        stories
--   Merkliste, Repost, eigener Kommentar, markierte Nachricht, Kartenpunkt,
--   Profiltext mit Link, Highlights, Playlists und Spendenziel
--
-- Der Weg dahin ist derselbe wie bei Kontakten und Chats: die Inhalte stehen
-- als Vorlage in einer Tabelle, und public.starter_inhalte() legt sie für ein
-- Konto an. Das hat zwei Folgen, die beide gewollt sind:
--
--   1. Jedes neu registrierte Konto ist sofort vollständig bespielt.
--   2. public.zuruecksetzen() stellt sie nach einem Prüflauf wieder her —
--      es ruft am Ende starter_inhalte() auf.
--
-- Setzt SUPABASE_SCHEMA.sql bis SUPABASE_SCHEMA_6_inhalte.sql voraus.
-- Gefahrlos mehrfach ausführbar.
-- ===========================================================================

begin;


-- ===========================================================================
-- Vorlage: die eigenen Beiträge
-- ===========================================================================
--
-- Warum eine eigene Tabelle und nicht feste Zeilen in der Funktion: die
-- Inhalte sind Daten, nicht Ablauf. Wer einen weiteren Testbeitrag braucht,
-- fügt hier eine Zeile ein und muss keine Funktion anfassen.

create table if not exists public.vorlage_eigene_beitraege (
  schluessel     text primary key,
  kind           text not null,
  format         text not null default 'standard',
  media_url      text,
  thumbnail_url  text,
  title          text default '',
  description    text default '',
  location       text default '',
  music          text default '',
  duration       text default '',
  tags           text[] default '{}',
  views          bigint default 0,
  zuschauer      integer,
  untertitel     boolean default false,
  kapitel        jsonb default '[]'::jsonb,
  minuten_zurueck integer not null default 0,
  position       integer not null default 0
);

-- Nachtraeglich dazugekommen; "create table if not exists" legt sie bei einer
-- bereits vorhandenen Tabelle nicht mehr an.
alter table public.vorlage_eigene_beitraege
  add column if not exists media_url     text,
  add column if not exists thumbnail_url text;

alter table public.vorlage_eigene_beitraege enable row level security;

drop policy if exists "Vorlage eigene Beitraege lesen" on public.vorlage_eigene_beitraege;
create policy "Vorlage eigene Beitraege lesen" on public.vorlage_eigene_beitraege
  for select to authenticated using (true);


create table if not exists public.vorlage_eigene_storys (
  schluessel      text primary key,
  media_type      text not null default 'image',
  media_url       text,
  caption         text default '',
  minuten_zurueck integer not null default 0,
  position        integer not null default 0
);

-- Nachtraeglich dazugekommen; "create table if not exists" oben legt sie bei
-- einer bereits vorhandenen Tabelle nicht mehr an.
alter table public.vorlage_eigene_storys add column if not exists media_url text;

alter table public.vorlage_eigene_storys enable row level security;

drop policy if exists "Vorlage eigene Storys lesen" on public.vorlage_eigene_storys;
create policy "Vorlage eigene Storys lesen" on public.vorlage_eigene_storys
  for select to authenticated using (true);


-- --------------------------------------------------------------- Die Inhalte
delete from public.vorlage_eigene_beitraege;
insert into public.vorlage_eigene_beitraege
  (schluessel, kind, format, media_url, thumbnail_url, title, description, location, music,
   duration, tags, views, zuschauer, untertitel, kapitel, minuten_zurueck, position)
values
  -- 1. Foto-Beitrag. Steht im Raster auf dem eigenen Profil ganz vorn.
  ('eigen-foto', 'post', 'standard',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-foto.png',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-foto.png',
   '',
   'Testbeitrag: ein Foto. Damit lässt sich alles prüfen, was an einem Beitrag hängt — Gefällt mir, Kommentar, Teilen, Merken, Melden.',
   'Hamburg', 'Golden Hour – Lys', '',
   array['#hafen', '#nachtfotografie']::text[], 0, null, false, '[]'::jsonb,
   120, 0),

  -- 2. Hochformat. Das ist der senkrechte Videokanal — eine Seite je Video,
  --    von unten nach oben gewischt.
  ('eigen-hochformat', 'reel', 'standard',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-hochformat.png',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-hochformat.png',
   '',
   'Testvideo im Hochformat. Zum Prüfen von Wischen, Ton an/aus, Doppeltippen und der Leiste an der rechten Seite.',
   'Rheinpark', 'Runner High – Aster', '0:34',
   array['#laufen', '#testvideo']::text[], 1840, null, false, '[]'::jsonb,
   240, 1),

  -- 3. Querformat, Knopf „Standard" in der Filterleiste. Mit Kapiteln und
  --    Untertiteln, damit auch der Player vollständig prüfbar ist.
  ('eigen-querformat', 'clip', 'standard',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-querformat.png',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-querformat.png',
   'Testvideo im Querformat',
   'Testvideo im Querformat. Zum Prüfen von Vollbild, Fortschrittsleiste, Kapitelsprüngen, Untertiteln und Geschwindigkeit.',
   'Hamburg', 'Lo-Fi Focus – beatlab', '12:40',
   array['#testvideo', '#reactnative']::text[], 9420, null, true,
   '[{"titel":"Einleitung","sekunde":0},{"titel":"Hauptteil","sekunde":180},{"titel":"Beispiel","sekunde":520},{"titel":"Fazit","sekunde":700}]'::jsonb,
   360, 2),

  -- 4. Querformat, Knopf „360°".
  ('eigen-360', 'clip', '360',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-360.png',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-360.png',
   'Test-Rundumvideo (360°)',
   'Testvideo für den 360°-Knopf in der Filterleiste. Prüft, dass die Filterleiste wirklich trennt und nicht überall dasselbe zeigt.',
   'Zugspitze', 'Ambient Sunrise – Nora K.', '4:12',
   array['#sonnenaufgang', '#testvideo']::text[], 3310, null, false, '[]'::jsonb,
   480, 3),

  -- 5. Querformat, Knopf „Live". „zuschauer" ist die Zahl neben dem roten
  --    Punkt — nur ein Livebeitrag hat sie.
  ('eigen-live', 'clip', 'live',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-live.png',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-live.png',
   'Test-Livestream',
   'Testbeitrag für den Live-Knopf. Prüft die Zuschauerzahl, den roten Punkt und den Live-Chat.',
   'Berlin', 'Originalton', '',
   array['#testvideo']::text[], 0, 128, false, '[]'::jsonb,
   15, 4);


delete from public.vorlage_eigene_storys;
insert into public.vorlage_eigene_storys (schluessel, media_type, media_url, caption, minuten_zurueck, position)
values
  ('eigen-story', 'image',
   'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/test-story.png',
   'Test-Story. Antippen, halten, weiterwischen, Herz, Antwort — alles daran prüfbar.',
   45, 0);


-- ===========================================================================
-- starter_inhalte(): um die eigenen Inhalte erweitert
-- ===========================================================================
--
-- Der vordere Teil ist unverändert aus SUPABASE_SCHEMA_5.sql übernommen —
-- Kontakte, Folgen, Chats, Communitys, Mitteilungen. Neu ist alles ab
-- „Eigene Beiträge".

create or replace function public.starter_inhalte(ziel uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_chat     record;
  v_com      record;
  v_kanal    record;
  v_vorlage  record;
  v_neu      uuid;
  v_kanal_id uuid;
  v_person   uuid;
  v_post     uuid;
  v_chats    integer := 0;
  v_komm     integer := 0;
  v_eigene   integer := 0;
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

  -- =====================================================================
  -- Eigene Beiträge  (neu in SUPABASE_SCHEMA_7_testkonto.sql)
  -- =====================================================================
  --
  -- Ein eigener Beitrag wird an seiner Beschreibung wiedererkannt, nicht an
  -- einer festen Kennung: die Kennung muss je Konto verschieden sein, sonst
  -- könnte nur ein einziges Konto sie haben.

  for v_vorlage in select * from public.vorlage_eigene_beitraege order by position loop
    if exists (
      select 1 from public.posts
      where user_id = ziel and demo and description = v_vorlage.description
    ) then
      continue;
    end if;

    insert into public.posts
      (user_id, kind, format, media_url, thumbnail_url, title, description, location, music, duration,
       tags, views, zuschauer, untertitel, kapitel, demo, created_at)
    values
      (ziel, v_vorlage.kind, v_vorlage.format, v_vorlage.media_url, v_vorlage.thumbnail_url,
       v_vorlage.title, v_vorlage.description,
       v_vorlage.location, v_vorlage.music, v_vorlage.duration, v_vorlage.tags,
       v_vorlage.views, v_vorlage.zuschauer, v_vorlage.untertitel, v_vorlage.kapitel,
       true, now() - make_interval(mins => v_vorlage.minuten_zurueck));

    v_eigene := v_eigene + 1;
  end loop;

  -- --- Eigene Story -----------------------------------------------------
  -- Storys laufen nach 24 Stunden ab. Beim Zurücksetzen wird deshalb immer
  -- eine frische angelegt, sonst wäre der Storykreis nach einem Tag leer.
  for v_vorlage in select * from public.vorlage_eigene_storys order by position loop
    if exists (
      select 1 from public.stories
      where user_id = ziel and caption = v_vorlage.caption and expires_at > now()
    ) then
      continue;
    end if;

    insert into public.stories (user_id, media_type, media_url, caption, created_at, expires_at, demo)
    values (ziel, v_vorlage.media_type, v_vorlage.media_url, v_vorlage.caption,
            now() - make_interval(mins => v_vorlage.minuten_zurueck),
            now() + interval '24 hours', true);
  end loop;

  -- --- Merkliste --------------------------------------------------------
  -- Zwei fremde Beiträge gemerkt, damit der Reiter „Gespeichert" nicht leer
  -- ist. Welche das sind, ist gleichgültig — deshalb die zwei neuesten
  -- Beispielbeiträge, die nicht dem Konto selbst gehören.
  insert into public.saves (user_id, post_id)
  select ziel, b.id
  from public.posts b
  where b.demo and b.user_id <> ziel
  order by b.created_at desc
  limit 2
  on conflict do nothing;

  -- --- Repost -----------------------------------------------------------
  insert into public.reposts (user_id, post_id)
  select ziel, b.id
  from public.posts b
  where b.demo and b.user_id <> ziel and b.kind = 'reel'
  order by b.created_at desc
  limit 1
  on conflict do nothing;

  -- --- Gefällt mir an fremden Beiträgen ---------------------------------
  insert into public.post_likes (user_id, post_id)
  select ziel, b.id
  from public.posts b
  where b.demo and b.user_id <> ziel
  order by b.created_at desc
  limit 3
  on conflict do nothing;

  -- --- Ein eigener Kommentar --------------------------------------------
  select b.id into v_post
  from public.posts b
  where b.demo and b.user_id <> ziel
  order by b.created_at desc
  limit 1;

  if v_post is not null and not exists (
    select 1 from public.comments where user_id = ziel and post_id = v_post
  ) then
    insert into public.comments (post_id, user_id, text, created_at)
    values (v_post, ziel, 'Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen.',
            now() - interval '30 minutes');
  end if;

  -- --- Eine markierte Nachricht -----------------------------------------
  -- Der Reiter „Markiert" in den Chateinstellungen wäre sonst leer.
  insert into public.message_stars (message_id, user_id)
  select n.id, ziel
  from public.messages n
  join public.chat_members m on m.chat_id = n.chat_id and m.user_id = ziel
  where n.sender_id <> ziel
  order by n.created_at desc
  limit 1
  on conflict do nothing;

  -- --- Eigener Punkt auf der Freundeskarte -------------------------------
  insert into public.friend_pins (user_id, x, y, place)
  values (ziel, 48, 40, 'Hamburg')
  on conflict (user_id) do nothing;

  -- --- Profiltexte -------------------------------------------------------
  -- Nur füllen, was leer ist. Wer sein Profil schon selbst geschrieben hat,
  -- bekommt es nicht überschrieben.
  update public.profiles
     set bio        = case when coalesce(bio, '')  = '' then 'Testkonto für All Media. Hier lässt sich jede Funktion einmal durchspielen, bevor die App öffentlich ist.' else bio end,
         link       = case when coalesce(link, '') = '' then 'all-media.app' else link end,
         about      = case when coalesce(about, '') = '' then 'Verfügbar' else about end,
         highlights = case when coalesce(array_length(highlights, 1), 0) = 0
                           then array['Test', 'Reisen', 'Technik']::text[] else highlights end,
         playlists  = case when coalesce(array_length(playlists, 1), 0) = 0
                           then array['Zum Prüfen', 'Später ansehen']::text[] else playlists end,
         -- „spende" ist JSON in einer Textspalte — so schreibt es
         -- handleSpende() in web/server/sync-handlers.js. Eine schlichte
         -- Zeichenkette wuerde die Oberflaeche beim Auslesen zerlegen.
         spende     = coalesce(spende,
                        '{"titel":"Testspendenziel","ziel":500,"gesammelt":120,"text":"Beispielziel zum Pruefen der Spendenkarte."}')
   where id = ziel;

  return jsonb_build_object('ok', true, 'chats', v_chats, 'communities', v_komm,
                            'eigene_beitraege', v_eigene);
end;
$$;

grant execute on function public.starter_inhalte(uuid) to authenticated;


-- Testbeiträge, die vor den Bildern angelegt wurden, nachträglich versorgen.
-- Ohne Bild steht im Feed nur ein grauer Platzhalter — und dann lässt sich
-- gerade das nicht prüfen, wofür der Testbestand da ist.
update public.posts b
   set media_url     = coalesce(b.media_url, v.media_url),
       thumbnail_url = coalesce(b.thumbnail_url, v.thumbnail_url)
  from public.vorlage_eigene_beitraege v
 where b.demo and b.description = v.description and b.media_url is null;


-- ===========================================================================
-- Testinhalte sieht nur, wem sie gehören
-- ===========================================================================
--
-- Ohne diese Regel steht der Testbestand jedes Kontos im öffentlichen Feed.
-- Bei sechs Konten waren das schon 27 Querformat-Videos, davon sechsmal
-- dasselbe „Testvideo im Querformat" von sechs verschiedenen Leuten. Nach dem
-- Start wäre es einmal je angemeldetem Nutzer — der Feed wäre unbrauchbar.
--
-- Sichtbar ist ein Beitrag also, wenn er
--   * kein Testinhalt ist (das gilt für alles, was jemand selbst anlegt), oder
--   * einem selbst gehört, oder
--   * von einem Beispielprofil stammt (Anna, Bob, Clara — die SIND die
--     gemeinsame Welt und sollen alle sehen).
--
-- Das steht in der Datenbank und nicht im Code, weil es sonst an zwei Stellen
-- stehen müsste — einmal für die Website, einmal für die App — und eine davon
-- irgendwann vergessen wird.

create or replace function public.beitrag_sichtbar(besitzer uuid, ist_test boolean)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select not coalesce(ist_test, false)
      or besitzer = auth.uid()
      or exists (select 1 from public.profiles p where p.id = besitzer and p.demo);
$$;

grant execute on function public.beitrag_sichtbar(uuid, boolean) to authenticated;

drop policy if exists "Beitraege lesen" on public.posts;
create policy "Beitraege lesen" on public.posts
  for select to authenticated
  using (public.beitrag_sichtbar(user_id, demo));

-- Storys brauchen dafür dieselbe Kennzeichnung wie Beiträge.
alter table public.stories add column if not exists demo boolean default false;

-- Testgeschichten, die vor dieser Spalte angelegt wurden, nachtragen —
-- Kennzeichnung und Bild.
update public.stories s
   set demo      = true,
       media_url = coalesce(s.media_url, v.media_url)
  from public.vorlage_eigene_storys v
 where v.caption = s.caption
   and (not coalesce(s.demo, false) or s.media_url is null);

drop policy if exists "Aktuelle Storys lesen" on public.stories;
create policy "Aktuelle Storys lesen" on public.stories
  for select to authenticated
  using (expires_at > now() and public.beitrag_sichtbar(user_id, demo));


-- ===========================================================================
-- Einen neu angelegten Chat darf sein Ersteller auch sehen
-- ===========================================================================
--
-- Eine Gruppe anzulegen schlug fehl mit
--   new row violates row-level security policy for table "chats"
--
-- Die Einfügeregel war nicht das Problem — die Zeile landete in der Datenbank.
-- Der Server bittet aber im selben Schritt um die neue Zeile zurück (er
-- braucht die Kennung, um gleich danach die Mitglieder einzutragen), und
-- dafür gilt die Leseregel. Die lautete: "sichtbar, wer Mitglied ist". Im
-- Augenblick des Anlegens ist noch niemand Mitglied — auch der Ersteller
-- nicht, seine Zeile kommt ja erst als Nächstes. Also war die frische Zeile
-- für den unsichtbar, der sie gerade angelegt hatte, und PostgREST meldete
-- den Fehler oben.
--
-- Ein Chat gehört ab jetzt auch dem, der ihn angelegt hat. Das ist keine
-- Aufweichung: created_by kann beim Einfügen ohnehin nur das eigene Konto
-- sein, dafür sorgt die Einfügeregel aus SUPABASE_SCHEMA.sql.

drop policy if exists "Eigene Chats lesen" on public.chats;
create policy "Eigene Chats lesen" on public.chats
  for select to authenticated
  using (created_by = auth.uid() or public.is_chat_member(id));

-- Dasselbe eine Ebene tiefer: die Mitglieder.
--
-- Die Regel lautete "eintragen darf, wer sich selbst eintraegt oder schon
-- Mitglied ist". Beim Anlegen einer Gruppe werden alle Mitglieder in einem
-- Zug eingetragen — der Ersteller und die Eingeladenen. Waehrend dieses einen
-- Schrittes ist der Ersteller noch nicht Mitglied (seine eigene Zeile
-- entsteht ja gerade erst), und die Zeilen der Eingeladenen fielen durch.
-- Ergebnis: eine Gruppe ohne Mitglieder, und eine Fehlermeldung, die aussah,
-- als duerfte man gar keine Gruppen anlegen.
drop policy if exists "Mitglieder hinzufuegen" on public.chat_members;
create policy "Mitglieder hinzufuegen" on public.chat_members
  for insert to authenticated
  with check (
    auth.uid() = user_id
    or public.is_chat_member(chat_id)
    or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
  );

-- Und beim Lesen: der Ersteller sieht die Mitgliederliste seiner Gruppe.
drop policy if exists "Mitglieder lesen" on public.chat_members;
create policy "Mitglieder lesen" on public.chat_members
  for select to authenticated
  using (
    public.is_chat_member(chat_id)
    or exists (select 1 from public.chats c where c.id = chat_id and c.created_by = auth.uid())
  );


-- Dasselbe bei Communitys und ihren Kanaelen.
--
-- Eine private Community war sichtbar, wenn man Mitglied ist. Im Augenblick
-- des Anlegens ist man das noch nicht — der Server bittet aber im selben
-- Schritt um die neue Zeile zurueck, um gleich danach beitreten zu koennen.
-- "Neuen Kanal erstellen" scheiterte deshalb mit
--   new row violates row-level security policy for table "communities"
--
-- Wie bei den Chats: created_by kann beim Einfuegen ohnehin nur das eigene
-- Konto sein, die Einfuegeregel aus SUPABASE_SCHEMA.sql sorgt dafuer.
drop policy if exists "Communitys lesen" on public.communities;
create policy "Communitys lesen" on public.communities
  for select to authenticated
  using (visibility = 'public' or created_by = auth.uid() or public.is_community_member(id));

-- Und die Sichtbarkeitsfunktion, an der die Kanaele haengen, zieht mit.
create or replace function public.community_sichtbar(ziel uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.communities c
    where c.id = ziel
      and (c.visibility = 'public'
           or c.created_by = auth.uid()
           or public.is_community_member(c.id))
  );
$$;

-- Einen Kanal darf anlegen, wer Mitglied ist — oder wer die Community
-- gegruendet hat und gerade erst dabei ist, ihr beizutreten.
drop policy if exists "Kanal anlegen" on public.community_channels;
create policy "Kanal anlegen" on public.community_channels
  for insert to authenticated
  with check (
    public.is_community_member(community_id)
    or exists (select 1 from public.communities c
                where c.id = community_id and c.created_by = auth.uid())
  );


-- ===========================================================================
-- Eine geteilte Nachricht weiß, welcher Beitrag geteilt wurde
-- ===========================================================================
--
-- Bisher stand im Chat nur der Text "Beitrag geteilt". Welcher Beitrag es war,
-- ging verloren: die Nachricht kannte ihn nicht. Im Prototyp ist das eine
-- Karte mit Vorschaubild, Autor und Titel, die den Beitrag öffnet — und die
-- konnte gar nicht entstehen.

alter table public.messages
  add column if not exists shared_post_id uuid references public.posts (id) on delete set null;

comment on column public.messages.shared_post_id is
  'Der geteilte Beitrag. Die Oberfläche macht daraus die Karte im Chat.';

create index if not exists messages_shared_post_idx on public.messages (shared_post_id);


-- ===========================================================================
-- Ablage für Bilder und Videos
-- ===========================================================================
--
-- Die App lädt Aufnahmen in den Eimer „media" hoch (app/lib/supabaseStorage.ts).
-- Ohne ihn scheitert jeder Upload mit „Bucket not found".

-- Der Eimer selbst. „public" heisst: wer die Adresse einer Datei hat, darf
-- sie ansehen — genau das braucht ein Beitragsbild.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do update set public = true;

-- Wer was darf. Lesen jeder, hochladen jedes angemeldete Konto, loeschen nur,
-- wer die Datei selbst hochgeladen hat.
--
-- Achtung beim Aufraeumen: aus storage.buckets oder storage.objects laesst
-- sich nichts von Hand loeschen, ein Schutztrigger verhindert das. Dafuer
-- gibt es die Storage-API.
drop policy if exists "Medien lesen" on storage.objects;
create policy "Medien lesen" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "Eigene Medien hochladen" on storage.objects;
create policy "Eigene Medien hochladen" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');

drop policy if exists "Eigene Medien loeschen" on storage.objects;
create policy "Eigene Medien loeschen" on storage.objects
  for delete to authenticated using (bucket_id = 'media' and owner = auth.uid());


-- ===========================================================================
-- Bestehende Konten nachziehen
-- ===========================================================================
-- Wer sich vor dieser Datei registriert hat, hat noch keine eigenen
-- Testinhalte. Beispielprofile (Anna, Bob, …) bekommen keine — sie SIND der
-- Startzustand.

do $$
declare p record;
begin
  for p in select id from public.profiles where not demo loop
    perform public.starter_inhalte(p.id);
  end loop;
end $$;


-- ===========================================================================
-- Das Testkonto
-- ===========================================================================
-- Angelegt über die normale Registrierung, damit Passwort und Anmeldung
-- genau so funktionieren wie bei jedem anderen Konto:
--
--     E-Mail:   test@all-media.app
--     Passwort: AllMedia2026!
--
-- Hier bekommt es nur einen sprechenden Namen. Findet die Abfrage das Konto
-- nicht, ist es noch nicht registriert — dann in der App oder auf der Website
-- „Konto anlegen" mit den Daten oben.

do $$
declare v_id uuid;
begin
  select id into v_id from auth.users where email = 'test@all-media.app';

  if v_id is null then
    raise notice 'Testkonto test@all-media.app gibt es noch nicht — bitte einmal ueber "Konto anlegen" registrieren.';
  else
    update public.profiles
       set name     = 'Test Nutzer',
           handle   = '@test',
           initials = 'TN',
           color    = coalesce(nullif(color, ''), 'linear-gradient(135deg,#8FD3FF,#2E6BE6)')
     where id = v_id;

    perform public.starter_inhalte(v_id);
  end if;
end $$;

commit;
