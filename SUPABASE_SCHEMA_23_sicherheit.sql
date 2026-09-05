-- =====================================================================
-- SUPABASE_SCHEMA_23_sicherheit.sql — 03.09.2026
--
-- Behebt sechs Punkte der Sicherheitspruefung vom 03.09.2026
-- (2.Gehirn.md/02 Projekte/All-Media-Sicherheitspruefung-03-09-2026.md).
--
-- DIE GEMEINSAME URSACHE, die diese Datei als Erstes abstellt:
-- In Postgres hat die Rolle PUBLIC von Haus aus EXECUTE auf jede neu
-- angelegte Funktion, und `anon` — der nicht angemeldete Besucher — erbt
-- das. Die Zeilen `grant execute on function ... to authenticated;` in den
-- bisherigen Schemadateien sahen aus wie eine Beschraenkung. Sie waren
-- keine: sie haben ein Recht hinzugefuegt, das ohnehin schon alle hatten.
-- Entzogen wurde nie etwas. Alle `security definer`-Funktionen waren
-- deshalb anonym ausfuehrbar — nachgewiesen gegen die laufende Instanz.
--
-- Enthalten:
--   Fund 1 + 4 + 5 + 6  fremde Kennung in security-definer-Funktionen
--   Fund 9              fehlendes WITH CHECK auf sieben UPDATE-Regeln
--   (Sammelpunkt)       Entzug der geerbten Ausfuehrungsrechte
--
-- NICHT enthalten und weiterhin offen:
--   Fund 2   der Anmeldeweg ueber `email_zu_handle` (siehe unten)
--   Fund 3   der Medieneimer (siehe Bericht — greift nicht ohne Umbau)
--   Fund 10-16
--
-- Alles idempotent: die Datei laesst sich mehrfach einspielen.
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_23_sicherheit.sql
-- =====================================================================


-- ---------------------------------------------------------------------
-- TEIL A — Fund 1, 4, 5, 6: die Kennung muss dem Aufrufer gehoeren
--
-- Die vier Funktionen werden vollstaendig neu geschrieben. Grundlage ist
-- der Stand, der am 03.09.2026 wirklich in der Datenbank lag (ausgelesen
-- mit pg_get_functiondef) — nicht der Stand der Schemadateien im Ordner,
-- der davon abweichen kann. Geaendert ist ausschliesslich die Pruefung am
-- Anfang; der uebrige Rumpf ist unveraendert uebernommen.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.zuruecksetzen(ziel uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare betroffene_chats uuid[];
begin
  /*
   * Sicherheitspruefung vom 03.09.2026 (Sicherheitspruefung Fund 1).
   *
   * `security definer` heisst: die Funktion laeuft mit den Rechten ihres
   * Eigentuemers und umgeht Row Level Security vollstaendig. Der Schutz, auf
   * den sich App und Website sonst verlassen, greift hier nicht — und die
   * Funktion nahm bis heute jede beliebige Kennung entgegen.
   *
   * Wer sie ohne Anmeldung aufrief, konnte die Beitraege, Storys,
   * Chats, Kontakte und Einstellungen jedes fremden Kontos loeschen.
   *
   * Darum als allererstes: die Kennung muss dem Aufrufer gehoeren. Kein
   * `return jsonb ...`, sondern eine Ausnahme — ein solcher Aufruf ist kein
   * Sonderfall, den man freundlich beantwortet, sondern ein Uebergriff.
   */
  if ziel is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

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

  -- Die Tabellen aus SUPABASE_SCHEMA_11_handbuch.sql. Sie fehlten hier bis
  -- zum 02.09.2026 vollständig; siehe SUPABASE_SCHEMA_13_zuruecksetzen_handbuch.sql.
  delete from public.insights           where sender_id = ziel;
  delete from public.insight_recipients where user_id   = ziel;
  delete from public.insight_targets    where user_id   = ziel or target_id = ziel;
  delete from public.insight_streaks    where user_a    = ziel or user_b    = ziel;
  delete from public.poll_votes         where user_id = ziel;
  delete from public.polls              where user_id = ziel;
  delete from public.message_reactions  where user_id = ziel;
  delete from public.visibility_exceptions where user_id = ziel or target_id = ziel;
  delete from public.visibility_settings   where user_id = ziel;
  delete from public.profile_bans       where user_id = ziel;
  delete from public.ptt_messages       where sender_id = ziel;
  delete from public.stream_comments    where user_id = ziel;
  delete from public.donations          where sender_id = ziel or empfaenger_id = ziel;
  delete from public.location_requests  where sender_id = ziel or ziel_id = ziel;

  -- Chats: erst merken, worin man saß, dann austreten — und danach die
  -- aufräumen, in denen nur noch Beispielprofile zurückbleiben. Genau das
  -- fehlte: die alte Fassung suchte nach Chats ganz ohne Mitglieder, und die
  -- gab es nie.
  -- Sowohl die Chats, in denen man sitzt, als auch die selbst angelegten:
  -- wer aus einem eigenen Chat schon ausgetreten ist, taucht in
  -- chat_members nicht mehr auf, hat ihn aber trotzdem hinterlassen.
  select array_agg(distinct id) into betroffene_chats from (
    select chat_id as id from public.chat_members where user_id = ziel
    union
    select id from public.chats where created_by = ziel
  ) q;

  delete from public.chat_members where user_id = ziel;

  if betroffene_chats is not null then
    delete from public.chats c
     where c.id = any (betroffene_chats)
       and not exists (
         select 1
           from public.chat_members m
           join public.profiles p on p.id = m.user_id
          where m.chat_id = c.id
            and p.demo is not true);
  end if;

  -- Selbst angelegte Communitys.
  delete from public.community_members where user_id = ziel;
  delete from public.communities where created_by = ziel;

  -- Einstellungen und Profilaufrufe (Schema 16).
  perform public.zuruecksetzen_einstellungen(ziel);

  -- Profilfelder auf den Stand nach der Registrierung.
  update public.profiles
     set bio = '', link = '', highlights = '{}', playlists = '{}',
         spende = null, live = null, status = 'offline',
         geburtsdatum = null
   where id = ziel;

  perform public.starter_inhalte(ziel);
  return jsonb_build_object('ok', true);
end;
$function$;

CREATE OR REPLACE FUNCTION public.zuruecksetzen_einstellungen(ziel uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  /*
   * Sicherheitspruefung vom 03.09.2026 (Sicherheitspruefung Fund 4).
   *
   * `security definer` heisst: die Funktion laeuft mit den Rechten ihres
   * Eigentuemers und umgeht Row Level Security vollstaendig. Der Schutz, auf
   * den sich App und Website sonst verlassen, greift hier nicht — und die
   * Funktion nahm bis heute jede beliebige Kennung entgegen.
   *
   * Sie loescht `user_settings` und `profile_views` — bis heute zu
   * jeder beliebigen Kennung.
   *
   * Darum als allererstes: die Kennung muss dem Aufrufer gehoeren. Kein
   * `return jsonb ...`, sondern eine Ausnahme — ein solcher Aufruf ist kein
   * Sonderfall, den man freundlich beantwortet, sondern ein Uebergriff.
   */
  if ziel is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  delete from public.user_settings where user_id = ziel;
  delete from public.profile_views where profile_id = ziel or viewer_id = ziel;
end;
$function$;

CREATE OR REPLACE FUNCTION public.starter_inhalte(ziel uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  /*
   * Sicherheitspruefung vom 03.09.2026 (Sicherheitspruefung Fund 5).
   *
   * Die Funktion legt fuer `ziel` Kontakte, Follows, Chats und Nachrichten
   * an. Ohne Pruefung konnte sich damit jeder in die Kontaktliste eines
   * fremden Kontos schreiben.
   *
   * WARUM HIER NICHT DIE SCHLICHTE FORM `ziel is distinct from auth.uid()`:
   * diese Funktion wird auch von aussen aufgerufen, wo es gar keinen
   * angemeldeten Aufrufer gibt —
   *   1. vom Trigger `starter_nach_registrierung()`, der bei der
   *      Registrierung an `auth.users` haengt. Der laeuft in der Verbindung
   *      von GoTrue, nicht in einer Anfrage; `auth.uid()` ist dort null.
   *      Die schlichte Form wuerde jede Registrierung abbrechen.
   *   2. aus den Bestandsskripten (SCHEMA_6, SCHEMA_7), die als `postgres`
   *      ueber die Verwaltungs-API laufen.
   *   3. aus `zuruecksetzen(ziel)`, wo `ziel = auth.uid()` schon geprueft
   *      wurde — dieser Weg kommt also durch.
   *
   * Unterschieden wird an `session_user`: PostgREST — und nur PostgREST —
   * verbindet sich als `authenticator` und wechselt danach auf `anon` bzw.
   * `authenticated`. `session_user` bleibt dabei `authenticator` und wird,
   * anders als `current_user`, von `security definer` NICHT ueberschrieben.
   * Der Wert kommt aus der Verbindung, nicht aus der Anfrage: faelschen
   * laesst er sich von aussen nicht.
   *
   * Kurz: kommt der Aufruf ueber die REST-Schnittstelle, muss die Kennung
   * dem Aufrufer gehoeren. Kommt er aus der Datenbank selbst, bleibt es beim
   * bisherigen Verhalten.
   */
  if session_user = 'authenticator' and ziel is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

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

    -- „is_read = false" macht die rote Zahl an Messenger und Chats sichtbar.
    insert into public.chat_members (chat_id, user_id, is_read)
    values (v_neu, ziel, not v_chat.ungelesen)
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
  -- Eine bleibt bewusst offen: sonst ist das Testkonto überall schon Mitglied
  -- und "einer Community beitreten" lässt sich gar nicht mehr ausprobieren.
  -- Genau daran scheiterte der Prüflauf _eigenes.js.
  insert into public.community_members (community_id, user_id)
  select c.id, ziel
  from public.communities c
  where c.demo and c.visibility = 'public' and c.name <> 'Musikproduktion'
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
  -- Storys laufen nach 24 Stunden ab, und die Regel zeigt nur Storys mit
  -- expires_at > now().
  --
  -- Beim Zurücksetzen wird deshalb eine frische angelegt. Das reicht aber
  -- nicht: der Testbestand soll auch dann vollständig sein, wenn einen Tag
  -- lang niemand zurückgesetzt hat. Genau das ist am 01.09.2026 passiert —
  -- test:datenbank meldete "Eigene Story: FAIL", und im Testkonto war der
  -- eigene Storykreis leer, ohne dass jemand etwas gelöscht hätte.
  --
  -- Also dieselbe Lösung wie für die Beispielstorys in
  -- SUPABASE_SCHEMA_6_inhalte.sql: der Bestand läuft nicht ab. Was ein Nutzer
  -- selbst aufnimmt, bekommt weiterhin die üblichen 24 Stunden — das steuert
  -- die Vorgabe der Spalte, nicht diese Zeile hier.
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
            now() + interval '10 years', true);
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

  -- Profilaufrufe fuer die Statistik (Schema 17).
  perform public.testbestand_profilaufrufe(ziel);

  return jsonb_build_object('ok', true, 'chats', v_chats, 'communities', v_komm,
                            'eigene_beitraege', v_eigene);
end;
$function$;

CREATE OR REPLACE FUNCTION public.testbestand_profilaufrufe(ziel uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_besucher uuid[];
  v_person   uuid;
  v_anzahl   integer := 0;
  v_tage     integer;
  v_i        integer;
begin
  /*
   * Sicherheitspruefung vom 03.09.2026 (Sicherheitspruefung Fund 6).
   *
   * `security definer` heisst: die Funktion laeuft mit den Rechten ihres
   * Eigentuemers und umgeht Row Level Security vollstaendig. Der Schutz, auf
   * den sich App und Website sonst verlassen, greift hier nicht — und die
   * Funktion nahm bis heute jede beliebige Kennung entgegen.
   *
   * Sie schreibt 38 Profilaufrufe — bis heute in die Statistik jedes
   * beliebigen Profils.
   *
   * Darum als allererstes: die Kennung muss dem Aufrufer gehoeren. Kein
   * `return jsonb ...`, sondern eine Ausnahme — ein solcher Aufruf ist kein
   * Sonderfall, den man freundlich beantwortet, sondern ein Uebergriff.
   */
  if ziel is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;

  if ziel is null then
    return 0;
  end if;

  /*
   * Nur die Beispielprofile besuchen. Ein echtes Konto als Besucher
   * einzutragen wäre eine Behauptung über einen Menschen, der davon nichts
   * weiß — und beim Löschen dieses Kontos verschwände der Eintrag wieder.
   */
  select array_agg(id) into v_besucher
    from public.profiles
   where demo and id <> ziel;

  if v_besucher is null or array_length(v_besucher, 1) = 0 then
    return 0;
  end if;

  /*
   * Sechs Wochen, mit Schwerpunkt auf den letzten Tagen. `mod` verteilt die
   * Besucher reihum; die Tagesabstände kommen aus einer festen Folge, damit
   * zwei Läufe dasselbe Bild ergeben — eine Statistik, die sich bei jedem
   * Zurücksetzen ändert, taugt nicht zum Prüfen.
   */
  for v_i in 0..37 loop
    v_person := v_besucher[1 + mod(v_i, array_length(v_besucher, 1))];

    -- 0,1,2,3,5,8,13,21,34 … je kleiner die Zahl, desto näher an heute.
    v_tage := case
                when v_i < 12 then mod(v_i, 7)          -- letzte Woche: dicht
                when v_i < 26 then 7 + mod(v_i, 23)     -- der Monat davor
                else 30 + mod(v_i, 12)                  -- älter als 30 Tage
              end;

    insert into public.profile_views (profile_id, viewer_id, created_at)
    values (ziel, v_person, now() - (v_tage || ' days')::interval - (mod(v_i, 19) || ' hours')::interval);

    v_anzahl := v_anzahl + 1;
  end loop;

  return v_anzahl;
end;
$function$;

-- ---------------------------------------------------------------------
-- TEIL B — Fund 9: fehlendes WITH CHECK
--
-- `using` sagt, WELCHE Zeile man anfassen darf. `with check` sagt, WIE sie
-- danach aussehen darf. Fehlt das zweite, darf man seine eigene Zeile
-- nehmen und sie in eine fremde verwandeln: die eigene Nachricht auf eine
-- fremde `sender_id` umschreiben, und der Text steht im Chat unter fremdem
-- Namen. Dasselbe Muster lag auf sieben Regeln.
--
-- Jede Regel bekommt als `with check` genau dieselbe Bedingung wie im
-- `using`. Damit bleibt erlaubt, was vorher erlaubt war — nur das
-- Hinausschreiben aus dem eigenen Bereich faellt weg.
--
-- Die Bedingungen sind woertlich der Stand aus pg_policies vom 03.09.2026.
-- ---------------------------------------------------------------------

-- Profil: die eigene Zeile darf nicht auf eine fremde Kennung umgeschrieben
-- werden.
drop policy if exists "Eigenes Profil aendern" on public.profiles;
create policy "Eigenes Profil aendern" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Nachrichten: der Absender bleibt der Absender (Fund 9, der Kern).
drop policy if exists "Eigene Nachricht aendern" on public.messages;
create policy "Eigene Nachricht aendern" on public.messages
  for update to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

-- Chats: man darf einen Chat nicht so aendern, dass man selbst nicht mehr
-- Mitglied ist — sonst liesse sich ein fremder Chat uebernehmen.
drop policy if exists "Eigene Chats aendern" on public.chats;
create policy "Eigene Chats aendern" on public.chats
  for update to authenticated
  using (public.is_chat_member(id))
  with check (public.is_chat_member(id));

drop policy if exists "Eigenen Insight aendern" on public.insights;
create policy "Eigenen Insight aendern" on public.insights
  for update to authenticated
  using (auth.uid() = sender_id)
  with check (auth.uid() = sender_id);

drop policy if exists "Insight als gesehen vermerken" on public.insight_recipients;
create policy "Insight als gesehen vermerken" on public.insight_recipients
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Eigene Streaks fortschreiben" on public.insight_streaks;
create policy "Eigene Streaks fortschreiben" on public.insight_streaks
  for update to authenticated
  using ((user_a = auth.uid()) or (user_b = auth.uid()))
  with check ((user_a = auth.uid()) or (user_b = auth.uid()));

-- Standortanfrage: beantworten darf sie, wer gefragt wurde — und die
-- Anfrage darf dabei nicht auf jemand anderen umgeschrieben werden.
drop policy if exists "Standortanfrage beantworten" on public.location_requests;
create policy "Standortanfrage beantworten" on public.location_requests
  for update to authenticated
  using (auth.uid() = ziel_id)
  with check (auth.uid() = ziel_id);


-- ---------------------------------------------------------------------
-- TEIL C — der Entzug der geerbten Ausfuehrungsrechte
--
-- Das ist die eigentliche Behebung. Die Pruefungen aus Teil A sind der
-- zweite Riegel; dieser hier schliesst die Tuer.
--
-- `revoke ... from public` nimmt das Recht weg, das jede Funktion beim
-- Anlegen automatisch bekommt. `revoke ... from anon` nimmt zusaetzlich die
-- ausdruecklichen Gaben aus den alten Schemadateien weg. Die
-- `alter default privileges`-Zeile sorgt dafuer, dass jede kuenftige
-- Funktion gar nicht erst mit diesem Recht entsteht — sonst faellt der
-- Bestand beim naechsten `create function` wieder auf.
--
-- WICHTIG, weil es leicht schiefgeht: `authenticated` wird hier NICHT
-- angefasst. Alle 43 Funktionen des Schemas hatten am 03.09.2026 bereits
-- eine ausdrueckliche Gabe an `authenticated` (geprueft ueber pg_proc.proacl).
-- Das ist wesentlich: mehrere dieser Funktionen — `is_chat_member`,
-- `sichtbar_fuer`, `beitrag_sichtbar`, `gesperrt` und weitere — stehen in
-- RLS-Regeln. Postgres prueft das Ausfuehrungsrecht auch dort. Haette man
-- pauschal von allen entzogen, waeren mit einem Schlag saemtliche Regeln
-- fuer angemeldete Nutzer gescheitert.
-- ---------------------------------------------------------------------

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- Die Diagnosefunktion aus der Pruefung wieder entfernen.
drop function if exists public.diag_kontext();


-- ---------------------------------------------------------------------
-- TEIL D — gezielt zurueckgeben, was der Client wirklich braucht
--
-- Grundlage: eine Suche nach `rpc('...')` in web/public/, web/server/ und
-- app/. Mehr wird nicht freigegeben. Die Gaben sind idempotent; sie standen
-- zum Teil schon so da und werden hier vollstaendig und an einer Stelle
-- wiederholt, damit man nachlesen kann, WAS der Client aufruft.
-- ---------------------------------------------------------------------

-- web/server/app.js:184 — POST /api/reset, mit req.nutzerId als Kennung
grant execute on function public.zuruecksetzen(uuid) to authenticated;
-- web/server/app.js:718, app/lib/aktionen.ts:1596 — "meine Daten"
grant execute on function public.meine_daten() to authenticated;
-- web/server/app.js:759, app/lib/aktionen.ts:1879 — Standort melden
grant execute on function public.hier_bin_ich() to authenticated;
-- web/server/app.js:776, app/lib/aktionen.ts:1941, app/test/_sichtbarkeit.js:508
grant execute on function public.darf_herunterladen(uuid, uuid) to authenticated;
-- web/server/app.js:793, web/server/sync-handlers.js:288, app/lib/aktionen.ts:1969
grant execute on function public.darf_angeschrieben_werden(uuid, uuid) to authenticated;
-- web/server/supabase-api.js:670, app/lib/daten.ts:654, app/test/_sichtbarkeit.js:479
grant execute on function public.liker_namen(uuid[], uuid) to authenticated;
-- web/server/sync-handlers.js:1140, app/lib/aktionen.ts:1121 — Insight Time
grant execute on function public.insight_streak_fortschreiben(uuid) to authenticated;
-- web/public/anmeldung.js:204 — Benutzernamen nachtraeglich aendern
grant execute on function public.handle_aendern(text) to authenticated;

/*
 * `handle_frei` ist die einzige Ausnahme fuer `anon`: beim Registrieren ist
 * noch niemand angemeldet, und die Seite muss trotzdem sagen koennen, ob der
 * Wunschname noch frei ist (web/public/anmeldung.js:116). Die Funktion gibt
 * nur ja/nein und einen Vorschlag zurueck, keine Profildaten.
 */
grant execute on function public.handle_frei(text) to anon, authenticated;

/*
 * `email_zu_handle` bekommt BEWUSST KEIN Recht mehr fuer `anon` (Fund 2).
 *
 * Sie schlaegt in `auth.users` nach und gab jedem, der fragte, die
 * hinterlegte E-Mail-Adresse zu einem Benutzernamen heraus — nachgewiesen
 * ohne Anmeldung. Damit liess sich der gesamte Nutzerbestand in
 * E-Mail-Adressen uebersetzen. Der "bewusst neutrale" Fehlertext in
 * web/public/anmeldung.js half dagegen nichts: man ruft die Funktion einfach
 * direkt auf.
 *
 * FOLGE, die so gewollt ist: die Anmeldung mit `@name` statt mit der
 * E-Mail-Adresse funktioniert ab jetzt nicht mehr. Das ist ein offener
 * Punkt, kein Versehen — der Anmeldeweg braucht einen Umbau (Aufloesung
 * serverseitig hinter der Anmeldung, oder ein eigener Endpunkt). Bis dahin
 * ist die Anmeldung mit E-Mail-Adresse der einzige Weg.
 */
grant execute on function public.email_zu_handle(text) to authenticated;
