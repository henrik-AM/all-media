-- ===========================================================================
--  PRUEFUNG_echte_konten_seit_schema62.sql           (NUR LESEN, Kasten 13.4)
--
--  Zählt, was seit Schema 62 (eingespielt 28.09.2026, 12:45 Uhr) an
--  Testinhalten auf ECHTEN Konten entstanden ist. Echt heißt: kein
--  Demoprofil (Anna, Bob …) und kein Testkonto nach ist_testkonto()
--  (@test, @prueflauf).
--
--  Henrik am 21.09.2026: „Echte Konten werden nicht angefasst … Auf Konten
--  echter Personen darf Claude nichts hochladen — kein Video, kein Beitrag."
--  Die 30 Starterbeiträge von vor Schema 62 bleiben auf Henriks Anweisung
--  liegen; sie sind älter als der Stichtag und werden hier NICHT gezählt.
--
--  Diese Datei ist EINE Abfrage (select), sie ändert nichts. Sie liegt
--  bewusst in berichte/ und heißt nicht SUPABASE_*: die Prüfläufe
--  _schema.js und _rechte.js lesen alle SUPABASE_*-Dateien als Schema.
--
--  Ausführen (Management-API, liest nur):
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs berichte/PRUEFUNG_echte_konten_seit_schema62.sql
--
--  Erwartet: jede Zeile mit anzahl = 0, außer der Gruppe „sperre": dort
--  1 bei den drei Funktionen (die Sperre steht drin) und 5 beim Wächter
--  (fünf Tabellen). testbestand_insight zeigt 0, solange
--  SUPABASE_SCHEMA_73_testbestand_nur_testkonten.sql nicht eingespielt ist. Eine
--  Zeile > 0 bei „test_an_echt" oder „echt_mit_testmerkmal" ist ein
--  Fund: `beispiel` nennt die neueste betroffene Zeile.
-- ===========================================================================

with
stichtag as (select timestamptz '2026-09-28 12:45:43+02' as seit),
echt as (
  select p.id
    from public.profiles p
   where coalesce(p.demo, false) = false
     and not public.ist_testkonto(p.id)
),
test as (
  select p.id from public.profiles p where public.ist_testkonto(p.id)
),
demo as (
  select p.id from public.profiles p where p.demo
),
-- Chats und Communitys, in denen ein echtes Konto Mitglied ist.
echte_chats as (
  select distinct m.chat_id from public.chat_members m where m.user_id in (select id from echt)
),
echte_communitys as (
  select distinct m.community_id from public.community_members m where m.user_id in (select id from echt)
),
befund (gruppe, bereich, anzahl, beispiel) as (

  -- ------------------------------------------------ 1. Testkonto → echtes Konto
  select 'test_an_echt', 'Kommentare an Beiträgen echter Konten', count(*), max(k.created_at)::text
    from public.comments k join public.posts b on b.id = k.post_id, stichtag
   where k.user_id in (select id from test) and b.user_id in (select id from echt) and k.created_at >= seit
  union all
  select 'test_an_echt', 'Likes an Beiträgen echter Konten', count(*), max(l.created_at)::text
    from public.post_likes l join public.posts b on b.id = l.post_id, stichtag
   where l.user_id in (select id from test) and b.user_id in (select id from echt) and l.created_at >= seit
  union all
  select 'test_an_echt', 'Reposts von Beiträgen echter Konten', count(*), max(r.created_at)::text
    from public.reposts r join public.posts b on b.id = r.post_id, stichtag
   where r.user_id in (select id from test) and b.user_id in (select id from echt) and r.created_at >= seit
  union all
  select 'test_an_echt', 'Livestream-Kommentare bei echten Konten', count(*), max(k.created_at)::text
    from public.stream_comments k join public.posts b on b.id = k.post_id, stichtag
   where k.user_id in (select id from test) and b.user_id in (select id from echt) and k.created_at >= seit
  union all
  select 'test_an_echt', 'Spenden an echte Konten', count(*), max(d.created_at)::text
    from public.donations d, stichtag
   where d.sender_id in (select id from test) and d.empfaenger_id in (select id from echt) and d.created_at >= seit
  union all
  select 'test_an_echt', 'Folgen echter Konten', count(*), max(f.created_at)::text
    from public.follows f, stichtag
   where f.follower_id in (select id from test) and f.followee_id in (select id from echt) and f.created_at >= seit
  union all
  select 'test_an_echt', 'Geteilt an echte Konten', count(*), max(s.created_at)::text
    from public.shares s, stichtag
   where s.shared_by in (select id from test) and s.shared_to in (select id from echt) and s.created_at >= seit
  union all
  select 'test_an_echt', 'Nachrichten in Chats mit echten Konten', count(*), max(n.created_at)::text
    from public.messages n, stichtag
   where n.sender_id in (select id from test) and n.chat_id in (select chat_id from echte_chats) and n.created_at >= seit
  union all
  select 'test_an_echt', 'Reaktionen auf Nachrichten in Chats mit echten Konten', count(*), max(r.created_at)::text
    from public.message_reactions r join public.messages n on n.id = r.message_id, stichtag
   where r.user_id in (select id from test) and n.chat_id in (select chat_id from echte_chats) and r.created_at >= seit
  union all
  select 'test_an_echt', 'Standortanfragen an echte Konten', count(*), max(a.created_at)::text
    from public.location_requests a, stichtag
   where a.sender_id in (select id from test) and a.ziel_id in (select id from echt) and a.created_at >= seit
  union all
  select 'test_an_echt', 'Kanalnachrichten in Communitys mit echten Mitgliedern', count(*), max(n.created_at)::text
    from public.community_channel_messages n join public.community_channels c on c.id = n.channel_id, stichtag
   where n.sender_id in (select id from test) and c.community_id in (select community_id from echte_communitys)
     and n.created_at >= seit
  union all
  select 'test_an_echt', 'Sprachnachrichten in Communitys mit echten Mitgliedern', count(*), max(n.created_at)::text
    from public.ptt_messages n, stichtag
   where n.sender_id in (select id from test) and n.community_id in (select community_id from echte_communitys)
     and n.created_at >= seit
  union all
  select 'test_an_echt', 'Mitteilungen an echte Konten, ausgelöst von Testkonten', count(*), max(n.created_at)::text
    from public.notifications n, stichtag
   where n.actor_id in (select id from test) and n.user_id in (select id from echt) and n.created_at >= seit
  union all
  select 'test_an_echt', 'Profilaufrufe bei echten Konten', count(*), max(v.created_at)::text
    from public.profile_views v, stichtag
   where v.viewer_id in (select id from test) and v.profile_id in (select id from echt) and v.created_at >= seit
  union all
  select 'test_an_echt', 'Story-Likes bei echten Konten', count(*), max(l.created_at)::text
    from public.story_likes l join public.stories s on s.id = l.story_id, stichtag
   where l.user_id in (select id from test) and s.user_id in (select id from echt) and l.created_at >= seit
  union all
  select 'test_an_echt', 'Kontaktanfragen bei echten Konten', count(*), max(c.created_at)::text
    from public.contacts c, stichtag
   where c.user_id in (select id from echt) and c.contact_id in (select id from test) and c.created_at >= seit

  -- -------------------------------- 2. Echtes Konto mit Merkmal des Testbestands
  union all
  select 'echt_mit_testmerkmal', 'Beiträge mit Beispielmedien oder Prüflauf-Text', count(*), max(b.created_at)::text
    from public.posts b, stichtag
   where b.user_id in (select id from echt) and b.created_at >= seit
     and (b.media_url like '%/media/beispiel/%'
          or coalesce(b.description, '') ~* '(prüflauf|testkonto|testbestand)'
          or coalesce(b.title, '') ~* '(prüflauf|testkonto|testbestand)')
  union all
  select 'echt_mit_testmerkmal', 'Storys mit Beispielmedien oder Prüflauf-Text', count(*), max(s.created_at)::text
    from public.stories s, stichtag
   where s.user_id in (select id from echt) and s.created_at >= seit
     and (s.media_url like '%/media/beispiel/%' or coalesce(s.caption, '') ~* '(prüflauf|testkonto)')
  union all
  select 'echt_mit_testmerkmal', 'Der Testkommentar aus starter_inhalte()', count(*), max(k.created_at)::text
    from public.comments k, stichtag
   where k.user_id in (select id from echt) and k.created_at >= seit
     and k.text = 'Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen.'
  union all
  select 'echt_mit_testmerkmal', 'Gespeichert/Like/Repost an Demo-Beiträgen in den ersten 2 Minuten nach der Registrierung (Starter-Muster)',
         count(*), max(t.created_at)::text
    from (
      select s.user_id, s.created_at, s.post_id from public.saves s
      union all select l.user_id, l.created_at, l.post_id from public.post_likes l
      union all select r.user_id, r.created_at, r.post_id from public.reposts r
    ) t
    join public.posts b on b.id = t.post_id and b.demo
    join public.profiles p on p.id = t.user_id, stichtag
   where t.user_id in (select id from echt) and t.created_at >= seit
     and t.created_at between p.created_at and p.created_at + interval '2 minutes'
  union all
  select 'echt_mit_testmerkmal', 'Erfundene Profilaufrufe von Demoprofilen', count(*), max(v.created_at)::text
    from public.profile_views v, stichtag
   where v.profile_id in (select id from echt) and v.viewer_id in (select id from demo)
     and v.created_at >= seit
  union all
  select 'echt_mit_testmerkmal', 'Test-Insights von Demoprofilen (testbestand_insight)', count(*), max(i.created_at)::text
    from public.insight_recipients r join public.insights i on i.id = r.insight_id, stichtag
   where r.user_id in (select id from echt) and i.sender_id in (select id from demo)
     and i.media_url like '%beispiel/story-laufen.jpg' and i.created_at >= seit
  union all
  select 'echt_mit_testmerkmal', 'Spenden von Testkonten, die ein echtes Konto erhalten hat (alle Zeit)', count(*), max(d.created_at)::text
    from public.donations d
   where d.sender_id in (select id from test) and d.empfaenger_id in (select id from echt)

  -- ------------------------------------------------------------- 3. Sperren
  union all
  select 'sperre', 'starter_inhalte() prüft ist_testkonto',
         (pg_get_functiondef('public.starter_inhalte'::regproc) like '%ist_testkonto(ziel)%')::int, null
  union all
  select 'sperre', 'zuruecksetzen() prüft ist_testkonto',
         (pg_get_functiondef('public.zuruecksetzen'::regproc) like '%ist_testkonto(ziel)%')::int, null
  union all
  select 'sperre', 'testbestand_insight() prüft ist_testkonto (Schema 73_testbestand_nur_testkonten)',
         coalesce((pg_get_functiondef(to_regprocedure('public.testbestand_insight(uuid)')) like '%ist_testkonto(ziel)%')::int, 1), null
  union all
  select 'sperre', 'Wächter nur_eigene_aktion auf saves/post_likes/reposts/comments/shares (Schema 66)',
         (select count(distinct c.relname)::int from pg_trigger t join pg_class c on c.oid = t.tgrelid
           join pg_proc p on p.oid = t.tgfoid
          where p.proname = 'nur_eigene_aktion' and not t.tgisinternal), null
)
select gruppe, bereich, anzahl, beispiel
  from befund
 order by gruppe desc, anzahl desc, bereich;
