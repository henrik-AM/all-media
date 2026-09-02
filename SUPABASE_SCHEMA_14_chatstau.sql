-- ===========================================================================
--  Jeder Prüflauf ließ seine Chats stehen
-- ===========================================================================
--
--  public.zuruecksetzen() trat aus den Chats des Testkontos aus und löschte
--  danach die verwaisten. Verwaist war aber keiner: in einem Chat zwischen
--  dem Testkonto und Anna Schmidt bleibt Anna zurück, also blieb der Chat —
--  mit allen Nachrichten darin. Beim nächsten Lauf legte starter_inhalte()
--  neue an, und so fort.
--
--  Zwischen dem 25.08. und dem 02.09.2026 sind daraus 27.337 Chats mit
--  61.840 Nachrichten geworden. Gemerkt hat es niemand, weil die Oberfläche
--  nur zeigt, worin man selbst Mitglied ist — und das Testkonto war es nach
--  dem Austritt ja gerade nicht mehr. Aufgefallen ist es erst, als das
--  Zurücksetzen an der Menge in einen Statement-Timeout lief und drei
--  Prüfläufe mitnahm.
--
--  Zwei Teile: erst der Altbestand, dann die Ursache.
--
--  Denselben Fund hat am 02.09.2026 eine zweite Claude-Sitzung im selben
--  Ordner gemacht und als SUPABASE_SCHEMA_14_chat_leck.sql abgelegt, ohne
--  sie einzuspielen. Ihr Chat-Teil löschte `where created_by = ziel` — das
--  trifft auch Chats, in denen noch ein echter Mensch sitzt, und nähme dem
--  das Gespräch weg. Übernommen ist daraus der richtige Gedanke, dass ein
--  selbst angelegter Chat auch dann zählt, wenn man längst ausgetreten ist.
--  Die Datei ist damit aufgegangen und entfällt.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_14_chatstau.sql
-- ===========================================================================


-- --------------------------------------------------- Teil 1: der Altbestand
--
--  Weg kommt ein Chat nur, wenn in ihm KEIN echtes Profil mehr Mitglied ist.
--  Chats mit einem angemeldeten Menschen darin — auch die des Testkontos —
--  bleiben unberührt. Nachrichten, Mitgliedschaften und Anhänge hängen über
--  `on delete cascade` daran und fallen mit.

create temporary table tote_chats on commit drop as
  select c.id from public.chats c
   where not exists (
     select 1
       from public.chat_members m
       join public.profiles p on p.id = m.user_id
      where m.chat_id = c.id
        and p.demo is not true);

delete from public.chats c using tote_chats t where c.id = t.id;


-- ------------------------------------------------------ Teil 2: die Ursache
--
--  Beim Austritt werden die betroffenen Chats gemerkt und danach die
--  geprüft, in denen niemand Echtes mehr sitzt. Gezielt auf diese Liste,
--  nicht über alle Chats — die Funktion läuft im Sekundentakt der Prüfläufe.

create or replace function public.zuruecksetzen(ziel uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare betroffene_chats uuid[];
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
