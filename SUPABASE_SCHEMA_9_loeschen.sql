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
--  Für drei Tabellen gab es nie eine delete-Regel:
--
--      chat_members    "Chat verlassen"
--      messages        "Chat leeren", eine eigene Nachricht zurücknehmen
--      chats           den leeren Chat hinterher abräumen
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
