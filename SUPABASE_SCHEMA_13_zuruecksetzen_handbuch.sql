-- ===========================================================================
--  Das Aufräumen kannte die neuen Tabellen nicht
-- ===========================================================================
--
--  SUPABASE_SCHEMA_11_handbuch.sql hat sechzehn Tabellen angelegt — Insights,
--  Umfragen, Sichtbarkeit, Spenden und die übrigen. public.zuruecksetzen()
--  stammt aber aus der Zeit davor und räumt nur ab, was es kennt. Nach jedem
--  Prüflauf blieben die neuen Zeilen liegen.
--
--  Sichtbar wurde das an einer Prüfung, die einzeln grün war und im
--  Gesamtlauf rot: „Eine Person von der Story ausnehmen". Die Aktion dahinter
--  ist ein Umschalter. Beim ersten Lauf setzt sie die Ausnahme, beim zweiten
--  nimmt sie dieselbe Ausnahme wieder weg — weil das Aufräumen sie
--  dazwischen stehen ließ. Die Prüfung war also nicht falsch; der
--  Startzustand war es.
--
--  Was hier NICHT abgeräumt wird:
--
--  * public.filter_words — eine gemeinsame Wortliste, kein Nutzerbestand.
--    Sie zu leeren würde die Filterprüfung für alle kaputtmachen.
--  * Zeilen, die über einen Fremdschlüssel mit `on delete cascade` an
--    eigenen Beiträgen, Storys oder Chats hängen: die gehen bereits mit,
--    wenn der Träger fällt. Doppelt löschen kostet nur Zeit.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_13_zuruecksetzen_handbuch.sql
-- ===========================================================================

create or replace function public.zuruecksetzen(ziel uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
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

  -- ------------------------------------------------ ab hier neu (Schema 11)

  -- Insights: erst die selbst verschickten, dann das Empfangene und die
  -- feste Empfängerliste. Die Ketten fallen zuletzt, sonst zeigen sie auf
  -- Insights, die es schon nicht mehr gibt.
  delete from public.insights           where sender_id = ziel;
  delete from public.insight_recipients where user_id   = ziel;
  delete from public.insight_targets    where user_id   = ziel or target_id = ziel;
  delete from public.insight_streaks    where user_a    = ziel or user_b    = ziel;

  -- Umfragen: die eigenen ganz, in fremden nur die eigene Stimme.
  delete from public.poll_votes where user_id = ziel;
  delete from public.polls      where user_id = ziel;

  -- Reaktionen auf Nachrichten.
  delete from public.message_reactions where user_id = ziel;

  -- Sichtbarkeit zurück auf den Auslieferungszustand: keine Einstellung,
  -- keine Ausnahme. Auch Ausnahmen, in denen man selbst das Ziel war —
  -- sonst bliebe man in fremden Listen stehen.
  delete from public.visibility_exceptions where user_id = ziel or target_id = ziel;
  delete from public.visibility_settings   where user_id = ziel;

  -- Sperren, Sprachnachrichten, Streamkommentare, Spenden, Standortfragen.
  delete from public.profile_bans    where user_id = ziel;
  delete from public.ptt_messages    where sender_id = ziel;
  delete from public.stream_comments where user_id = ziel;
  delete from public.donations       where sender_id = ziel or empfaenger_id = ziel;
  delete from public.location_requests where sender_id = ziel or ziel_id = ziel;

  -- --------------------------------------------------------------- Ende neu

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
         spende = null, live = null, status = 'offline',
         geburtsdatum = null
   where id = ziel;

  perform public.starter_inhalte(ziel);
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.zuruecksetzen(uuid) to authenticated;
