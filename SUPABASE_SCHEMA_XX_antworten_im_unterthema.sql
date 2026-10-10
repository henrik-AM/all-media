-- ============================================================================
--  SUPABASE_SCHEMA_XX_antworten_im_unterthema.sql
--  (Nummer vergibt der Hauptagent. Entwurf — eingespielt wird erst nach der
--  Supabase-Sperre.)
--
--  Feedback 28.09.2026, Kasten 4.2: „Nachricht nach rechts ziehen → Antwort,
--  auch im Chat eines Unterthemas."
--
--  WAS FEHLTE
--
--  `messages` hat `reply_to` seit Schema 11 — Messenger und Communitys-Chats
--  können antworten. Ein Unterthema schreibt aber in eine eigene Tabelle,
--  `community_channel_messages` (Schema 5/25/59), und die kannte keinen
--  Bezug. Die Antwort aus dem Unterthema hätte ihren Anlass verloren.
--
--  WAS DIESE DATEI TUT
--
--  1. community_channel_messages.reply_to → dieselbe Tabelle, on delete set
--     null (die Antwort bleibt stehen, wenn das Original verschwindet).
--  2. Index auf reply_to.
--  3. Einschränkende INSERT-Regel „Antwort nur im selben Unterthema":
--     reply_to ist null oder zeigt auf eine Nachricht desselben Kanals.
--     RESTRICTIVE, damit sie mit „Im Kanal schreiben" (Schema 5) und
--     „Beitrag nur als Mitglied teilen" (Schema 59) UND-verknüpft wird —
--     eine zweite permissive Regel würde verodert und hebt die erste auf.
--     Dasselbe für UPDATE ist nicht nötig: es gibt keine UPDATE-Regel für
--     Kanalnachrichten, eine Änderung von reply_to ist also ohnehin verboten.
--
--  Ersetzt KEINE bestehende Funktion. Keine neue Funktion (kein EXECUTE an
--  PUBLIC), keine neue Tabelle (nur_freigegebene aus Schema 52/74 gilt für
--  community_channel_messages unverändert weiter — die Zeile bleibt dieselbe).
--
--  Zitattext liegt NIE in der Datenbank: gespeichert wird nur die Kennung des
--  Originals; der Text wird beim Laden aus dem Original gelesen und unterliegt
--  dessen Leseregel. Unterthemen sind nicht verschlüsselt (Schema 31 gilt nur
--  für Zweierchats in `messages`) — dort bleibt es bei reply_to ohne Text.
--
--  Bis diese Datei eingespielt ist, laufen App und Website ohne Bezug weiter
--  (gemeinsam/chatblase.js, fehltSpalte) und sagen das beim Senden.
--
--  Idempotent: mehrfach ausführbar.
-- ============================================================================

alter table public.community_channel_messages
  add column if not exists reply_to uuid
    references public.community_channel_messages (id) on delete set null;

create index if not exists community_channel_messages_reply_to_idx
  on public.community_channel_messages (reply_to)
  where reply_to is not null;

comment on column public.community_channel_messages.reply_to is
  'Antwort auf diese Nachricht desselben Unterthemas (Feedback 28.09., Kasten 4.2). '
  'Nur die Kennung, nie der Text.';

drop policy if exists "Antwort nur im selben Unterthema" on public.community_channel_messages;
create policy "Antwort nur im selben Unterthema" on public.community_channel_messages
  as restrictive
  for insert to authenticated
  with check (
    reply_to is null
    or exists (
      select 1
        from public.community_channel_messages o
       where o.id = reply_to
         and o.channel_id = community_channel_messages.channel_id
    )
  );

-- PostgREST soll die neue Spalte sofort kennen.
notify pgrst, 'reload schema';
