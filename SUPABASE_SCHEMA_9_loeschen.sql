-- ===========================================================================
--  All Media — Schema 9: löschen dürfen
--  Stand 01.09.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Row Level Security schaltet jede Tabelle standardmäßig zu. Erlaubt ist
--  danach nur, wofür es eine Regel gibt — getrennt nach select, insert,
--  update und delete.
--
--  Für vier Tabellen gab es nie eine delete-Regel:
--
--      chat_members        "Chat verlassen"
--      messages            "Chat leeren", eine eigene Nachricht zurücknehmen
--      chats               den leeren Chat hinterher abräumen
--      community_channels  ein Unterthema wieder entfernen
--
--  Und das war nicht als Fehler zu sehen. Postgres weist ein verbotenes
--  DELETE nicht ab — es löscht null Zeilen und meldet Erfolg. Der Code auf
--  beiden Seiten (web/server/sync-handlers.js, handleLeaveChat, und
--  app/lib/aktionen.ts, chatVerlassen) prüfte das Ergebnis auf `error`, fand
--  keinen und meldete "Chat gelöscht". Beim nächsten Laden stand er wieder da.
--
--  Aufgefallen ist es erst, als der Prüflauf test:aktionen eine Gruppe anlegte
--  und danach wieder verlassen wollte — sie blieb.
--
--  WAS DIE REGELN ZULASSEN
--
--  Nur das eigene. Die eigene Mitgliedschaft, die eigenen Nachrichten. Einen
--  Chat für alle löschen kann niemand: er gehört auch dem Gegenüber, und ihn
--  zu entfernen würde ihm den Verlauf unter den Füßen wegziehen. Abgeräumt
--  wird ein Chat nur, wenn niemand mehr darin ist.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_… node tools/sql-einspielen.mjs SUPABASE_SCHEMA_9_loeschen.sql
-- ===========================================================================

-- --------------------------------------------------------- chat_members --
-- Chat verlassen heißt: die eigene Mitgliedschaft geht weg, nicht der Chat.
drop policy if exists "Eigene Mitgliedschaft beenden" on public.chat_members;
create policy "Eigene Mitgliedschaft beenden" on public.chat_members
  for delete to authenticated
  using (auth.uid() = user_id);

-- -------------------------------------------------------------- messages --
-- Die eigenen Nachrichten gehören mir — fremde rührt niemand an. Genau das
-- ist der erste Schritt beim Leeren eines Chats; für alles andere zieht
-- chat_members.geleert_bis einen Strich.
drop policy if exists "Eigene Nachricht loeschen" on public.messages;
create policy "Eigene Nachricht loeschen" on public.messages
  for delete to authenticated
  using (auth.uid() = sender_id);

-- ----------------------------------------------------------------- chats --
-- Ein Chat wird nur abgeräumt, wenn niemand mehr darin ist. Der zweite Fall
-- ist das Zurücknehmen einer halb angelegten Gruppe: sie hat noch keine
-- Mitglieder außer dem, der sie gerade anlegt.
drop policy if exists "Leeren Chat abraeumen" on public.chats;
create policy "Leeren Chat abraeumen" on public.chats
  for delete to authenticated
  using (
    not exists (select 1 from public.chat_members m where m.chat_id = id)
    or (
      auth.uid() = created_by
      and not exists (
        select 1 from public.chat_members m
        where m.chat_id = id and m.user_id <> auth.uid()
      )
    )
  );

-- ---------------------------------------------------- community_channels --
-- Ein Unterthema anlegen ging immer, es wieder loszuwerden nie — weder in der
-- App noch auf der Website. Fünf Unterthemen namens "Prüfthema …" standen
-- deshalb am 01.09.2026 dauerhaft in der Community "Design Systeme": ein
-- Prüflauf hatte sie angelegt und konnte sie nicht abräumen. Sie schoben die
-- echten Kanäle in der Liste nach hinten, woran ein anderer Prüflauf hängen
-- blieb.
--
-- Entfernen darf nur, wem die Community gehört. Ein einzelnes Mitglied könnte
-- sonst allen anderen einen Kanal samt Verlauf wegnehmen.
drop policy if exists "Eigenen Kanal entfernen" on public.community_channels;
create policy "Eigenen Kanal entfernen" on public.community_channels
  for delete to authenticated
  using (
    exists (
      select 1 from public.communities c
      where c.id = community_id and c.created_by = auth.uid()
    )
  );

-- Und die fünf, die schon dastehen, gleich mit weg. Sie gehören keinem
-- Menschen, sondern einem Prüflauf; test/_aktionen.js räumt seither selbst auf.
delete from public.community_channels where name like 'Prüfthema %';
