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

alter table public.vorlage_eigene_beitraege enable row level security;

drop policy if exists "Vorlage eigene Beitraege lesen" on public.vorlage_eigene_beitraege;
create policy "Vorlage eigene Beitraege lesen" on public.vorlage_eigene_beitraege
  for select to authenticated using (true);


create table if not exists public.vorlage_eigene_storys (
  schluessel      text primary key,
  media_type      text not null default 'image',
  caption         text default '',
  minuten_zurueck integer not null default 0,
  position        integer not null default 0
);

alter table public.vorlage_eigene_storys enable row level security;

drop policy if exists "Vorlage eigene Storys lesen" on public.vorlage_eigene_storys;
create policy "Vorlage eigene Storys lesen" on public.vorlage_eigene_storys
  for select to authenticated using (true);


-- --------------------------------------------------------------- Die Inhalte
delete from public.vorlage_eigene_beitraege;
insert into public.vorlage_eigene_beitraege
  (schluessel, kind, format, title, description, location, music, duration,
   tags, views, zuschauer, untertitel, kapitel, minuten_zurueck, position)
values
  -- 1. Foto-Beitrag. Steht im Raster auf dem eigenen Profil ganz vorn.
  ('eigen-foto', 'post', 'standard', '',
   'Testbeitrag: ein Foto. Damit lässt sich alles prüfen, was an einem Beitrag hängt — Gefällt mir, Kommentar, Teilen, Merken, Melden.',
   'Hamburg', 'Golden Hour – Lys', '',
   array['#hafen', '#nachtfotografie']::text[], 0, null, false, '[]'::jsonb,
   120, 0),

  -- 2. Hochformat. Das ist der senkrechte Videokanal — eine Seite je Video,
  --    von unten nach oben gewischt.
  ('eigen-hochformat', 'reel', 'standard', '',
   'Testvideo im Hochformat. Zum Prüfen von Wischen, Ton an/aus, Doppeltippen und der Leiste an der rechten Seite.',
   'Rheinpark', 'Runner High – Aster', '0:34',
   array['#laufen', '#testvideo']::text[], 1840, null, false, '[]'::jsonb,
   240, 1),

  -- 3. Querformat, Knopf „Standard" in der Filterleiste. Mit Kapiteln und
  --    Untertiteln, damit auch der Player vollständig prüfbar ist.
  ('eigen-querformat', 'clip', 'standard',
   'Testvideo im Querformat',
   'Testvideo im Querformat. Zum Prüfen von Vollbild, Fortschrittsleiste, Kapitelsprüngen, Untertiteln und Geschwindigkeit.',
   'Hamburg', 'Lo-Fi Focus – beatlab', '12:40',
   array['#testvideo', '#reactnative']::text[], 9420, null, true,
   '[{"titel":"Einleitung","sekunde":0},{"titel":"Hauptteil","sekunde":180},{"titel":"Beispiel","sekunde":520},{"titel":"Fazit","sekunde":700}]'::jsonb,
   360, 2),

  -- 4. Querformat, Knopf „360°".
  ('eigen-360', 'clip', '360',
   'Test-Rundumvideo (360°)',
   'Testvideo für den 360°-Knopf in der Filterleiste. Prüft, dass die Filterleiste wirklich trennt und nicht überall dasselbe zeigt.',
   'Zugspitze', 'Ambient Sunrise – Nora K.', '4:12',
   array['#sonnenaufgang', '#testvideo']::text[], 3310, null, false, '[]'::jsonb,
   480, 3),

  -- 5. Querformat, Knopf „Live". „zuschauer" ist die Zahl neben dem roten
  --    Punkt — nur ein Livebeitrag hat sie.
  ('eigen-live', 'clip', 'live',
   'Test-Livestream',
   'Testbeitrag für den Live-Knopf. Prüft die Zuschauerzahl, den roten Punkt und den Live-Chat.',
   'Berlin', 'Originalton', '',
   array['#testvideo']::text[], 0, 128, false, '[]'::jsonb,
   15, 4);


delete from public.vorlage_eigene_storys;
insert into public.vorlage_eigene_storys (schluessel, media_type, caption, minuten_zurueck, position)
values
  ('eigen-story', 'image',
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
      (user_id, kind, format, title, description, location, music, duration,
       tags, views, zuschauer, untertitel, kapitel, demo, created_at)
    values
      (ziel, v_vorlage.kind, v_vorlage.format, v_vorlage.title, v_vorlage.description,
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

    insert into public.stories (user_id, media_type, caption, created_at, expires_at)
    values (ziel, v_vorlage.media_type, v_vorlage.caption,
            now() - make_interval(mins => v_vorlage.minuten_zurueck),
            now() + interval '24 hours');
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


-- ===========================================================================
-- Ablage für Bilder und Videos
-- ===========================================================================
--
-- Die App lädt Aufnahmen in den Eimer „media" hoch (app/lib/supabaseStorage.ts).
-- Ohne ihn scheitert jeder Upload mit „Bucket not found".

-- Die Regeln auf storage.objects gehoeren dem Rollennamen
-- supabase_storage_admin. Reicht das Recht hier nicht, soll deshalb nicht die
-- ganze Datei scheitern: dann bleibt eine Meldung stehen und der Eimer wird
-- im Dashboard unter Storage -> Policies freigegeben.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('media', 'media', true)
  on conflict (id) do update set public = true;

  execute 'drop policy if exists "Medien lesen" on storage.objects';
  execute 'create policy "Medien lesen" on storage.objects
             for select using (bucket_id = ''media'')';

  execute 'drop policy if exists "Eigene Medien hochladen" on storage.objects';
  execute 'create policy "Eigene Medien hochladen" on storage.objects
             for insert to authenticated with check (bucket_id = ''media'')';

  execute 'drop policy if exists "Eigene Medien loeschen" on storage.objects';
  execute 'create policy "Eigene Medien loeschen" on storage.objects
             for delete to authenticated using (bucket_id = ''media'' and owner = auth.uid())';
exception when insufficient_privilege or undefined_table then
  raise notice 'Ablage "media" konnte nicht eingerichtet werden (%). Bitte im Dashboard unter Storage anlegen.', sqlerrm;
end $$;


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
