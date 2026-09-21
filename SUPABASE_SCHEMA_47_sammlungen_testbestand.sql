-- ===========================================================================
-- Der Testbestand fuellt die Sammlungen
-- ===========================================================================
--
-- BEFUND (20.09.2026, nach dem Gesamtlauf)
--
-- SUPABASE_SCHEMA_46_sammlungen.sql hat Playlists und Highlights einen
-- Inhalt gegeben. Nach einem Gesamtlauf war jede Sammlung wieder leer:
--
--   select s.art, s.name, (select count(*) from sammlung_inhalte i
--                          where i.sammlung_id = s.id) from sammlungen s;
--   -> alle 0
--
-- Der Grund ist nicht der Code, sondern der Bestand. `zuruecksetzen(ziel)`
-- loescht die Beitraege und Storys des Kontos und legt sie neu an.
-- `sammlung_inhalte.post_id` haengt mit `on delete cascade` daran — die
-- Zuordnung faellt mit. Die Sammlung selbst bleibt stehen, leer.
--
-- Damit ist der Fall genau der aus dem Vault-Eintrag „Einzeln gruen, gesamt
-- rot": einzeln bestueckt und geprueft ist alles richtig, im Gesamtlauf ist
-- der Bestand schuld.
--
-- WAS DAS AUSSERDEM SICHTBAR GEMACHT HAT
--
-- Die Pruefung `_profil.js` → „Zwei Playlists sind voneinander zu
-- unterscheiden" war bis heute gruen, WEIL die Website sich die Bilder
-- ausgedacht hat (`i % 2 === name.length % 2`). Seit die Kreise ihr echtes
-- Titelbild tragen, sind zwei LEERE Playlists nicht mehr zu unterscheiden —
-- und das ist richtig so. Die Pruefung darf nicht wieder auf eine Erfindung
-- gestellt werden; stattdessen bekommt der Bestand Inhalt, sodass es etwas
-- zu unterscheiden GIBT.
--
-- WAS HIER PASSIERT
--
--   1. `starter_sammlungen(ziel)` legt die fuenf Sammlungen des Testkontos
--      an und fuellt zwei davon: „Zum Pruefen" mit den eigenen Beitraegen,
--      „Reisen" mit der eigenen Story. Drei bleiben leer — auch der leere
--      Fall muss sich ansehen lassen.
--   2. `zuruecksetzen(ziel)` raeumt die Sammlungen mit ab (sonst bleibt
--      liegen, was ein Pruflauf angelegt hat) und ruft danach 1. auf.
--
-- Start:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--     SUPABASE_SCHEMA_47_sammlungen_testbestand.sql
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Die Sammlungen des Testbestands
-- ---------------------------------------------------------------------------
create or replace function public.starter_sammlungen(ziel uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_name    text;
  v_id      uuid;
  v_pos     integer;
  v_post    record;
  v_story   uuid;
begin
  -- Die Namen stammen aus denselben Listen, die `starter_inhalte` in
  -- `profiles.highlights` / `profiles.playlists` schreibt. Solange beide
  -- Wahrheiten nebeneinander stehen, muessen sie dieselben Namen tragen —
  -- sonst zeigt die App fuenf Kreise und die Datenbank kennt vier.
  foreach v_name in array array['Zum Prüfen', 'Später ansehen'] loop
    insert into public.sammlungen (user_id, art, name)
    values (ziel, 'playlist', v_name)
    on conflict (user_id, art, name) do nothing;
  end loop;

  foreach v_name in array array['Test', 'Reisen', 'Technik'] loop
    insert into public.sammlungen (user_id, art, name)
    values (ziel, 'highlight', v_name)
    on conflict (user_id, art, name) do nothing;
  end loop;

  -- --- „Später ansehen" bekommt die eigenen Beitraege --------------------
  -- NICHT „Zum Prüfen": dort legen `_feinschliff.js` und `_sammlungenweb.js`
  -- selbst einen Beitrag hinein. Ein vorbelegter Bestand nahm ihnen den
  -- Platz weg — beide meldeten am 20.09.2026 „enthält das schon".
  select id into v_id from public.sammlungen
   where user_id = ziel and art = 'playlist' and name = 'Später ansehen';

  if v_id is not null then
    v_pos := 0;
    for v_post in
      select id from public.posts
       where user_id = ziel
       order by created_at desc
       limit 3
    loop
      insert into public.sammlung_inhalte (sammlung_id, post_id, position)
      values (v_id, v_post.id, v_pos)
      on conflict do nothing;
      v_pos := v_pos + 1;
    end loop;
  end if;

  -- --- „Reisen" bekommt die eigene Story ---------------------------------
  -- Nur EINE: so steht neben der gefuellten Sammlung auch der Fall „genau
  -- ein Eintrag", an dem sich die Einzahl im Kopf pruefen laesst.
  select id into v_id from public.sammlungen
   where user_id = ziel and art = 'highlight' and name = 'Reisen';

  select id into v_story from public.stories
   where user_id = ziel and expires_at > now()
   order by created_at desc
   limit 1;

  if v_id is not null and v_story is not null then
    insert into public.sammlung_inhalte (sammlung_id, story_id, position)
    values (v_id, v_story, 0)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.starter_sammlungen(uuid) from public;
grant execute on function public.starter_sammlungen(uuid) to postgres;

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
  delete from public.sammlungen    where user_id = ziel;

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

  -- Eigene Zeilen in fremden Kanaelen (Schema 25).
  delete from public.community_channel_messages where sender_id = ziel;

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
  perform public.starter_sammlungen(ziel);
  return jsonb_build_object('ok', true);
end;
$function$
;

revoke all on function public.zuruecksetzen(uuid) from public;
grant execute on function public.zuruecksetzen(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Nachweis
-- ---------------------------------------------------------------------------
-- Die Verwaltungs-API meldet auch dann Erfolg, wenn nichts passiert ist.
-- Deshalb rechnet dieser Block nach und bricht mit Fehler ab, wenn etwas
-- nicht stimmt.
do $$
declare
  v_ziel  uuid;
  v_voll  integer;
  v_leer  integer;
begin
  select id into v_ziel from public.profiles where handle = '@test';
  if v_ziel is null then
    raise exception 'Testkonto @test nicht gefunden — Nachweis nicht moeglich';
  end if;

  perform public.starter_sammlungen(v_ziel);

  select count(*) into v_voll
    from public.sammlungen s
   where s.user_id = v_ziel
     and exists (select 1 from public.sammlung_inhalte i where i.sammlung_id = s.id);

  select count(*) into v_leer
    from public.sammlungen s
   where s.user_id = v_ziel
     and not exists (select 1 from public.sammlung_inhalte i where i.sammlung_id = s.id);

  if v_voll < 2 then
    raise exception 'Nur % gefuellte Sammlung(en) — erwartet mindestens 2', v_voll;
  end if;
  if v_leer < 1 then
    raise exception 'Keine leere Sammlung — der leere Fall laesst sich nicht pruefen';
  end if;

  raise notice 'Sammlungen @test: % gefuellt, % leer', v_voll, v_leer;
end $$;
