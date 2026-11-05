-- ===========================================================================
-- ABGLEICH MIT MAIN (Paket 1, 05.11.2026, Stand origin/main ad7f221)
--   Auf dem Sammelzweig als SUPABASE_SCHEMA_91_antworten_im_unterthema.sql
--   vergeben (Merge 963f1b9); im Paket am 05.11. von XX auf 91 zurückbenannt.
--   * community_channel_messages.reply_to (+ Index): neu, live nicht vorhanden.
--   * Regel „Antwort nur im selben Unterthema“: neu, restriktiv, nur INSERT.
--     Schema 102 legt auf derselben Tabelle die restriktive Regel
--     nicht_ausgeblendet an — restriktive Regeln werden verundet, keine
--     Rückdrehung. Keine spätere main-Datei definiert diese Objekte.
-- ===========================================================================
-- ============================================================================
--  SUPABASE_SCHEMA_91_antworten_im_unterthema.sql
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
--  Ersetzt KEINE bestehende Funktion. Neu (05.11.2026): Hilfe
--  kanal_antwort_erlaubt() (EXECUTE nur authenticated) gegen RLS-Rekursion.
--  Keine neue Tabelle (nur_freigegebene aus Schema 52/74 gilt für
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

-- Prüfung über eine Definer-Hilfe statt einer Unterabfrage in der Regel:
-- Eine Regel auf community_channel_messages, die selbst community_channel_messages
-- liest, löst „42P17 infinite recursion detected in policy“ aus — dann scheitert
-- JEDE neue Nachricht im Unterthema, auch ohne Antwort (Probe Paket 1, 05.11.2026,
-- _probe_paket1_rekursion.js). Muster wie kommentar_antwort_erlaubt() aus Schema 92.
-- Die Hilfe verrät nur, ob eine Kennung im selben Unterthema liegt.
create or replace function public.kanal_antwort_erlaubt(p_reply_to uuid, p_channel uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_reply_to is null
      or exists (
        select 1
          from public.community_channel_messages o
         where o.id = p_reply_to
           and o.channel_id = p_channel
      );
$$;

revoke execute on function public.kanal_antwort_erlaubt(uuid, uuid) from public, anon;
grant execute on function public.kanal_antwort_erlaubt(uuid, uuid) to authenticated;

drop policy if exists "Antwort nur im selben Unterthema" on public.community_channel_messages;
create policy "Antwort nur im selben Unterthema" on public.community_channel_messages
  as restrictive
  for insert to authenticated
  with check (public.kanal_antwort_erlaubt(reply_to, channel_id));

-- PostgREST soll die neue Spalte sofort kennen.
notify pgrst, 'reload schema';
