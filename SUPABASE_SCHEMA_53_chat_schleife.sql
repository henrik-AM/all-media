-- ===========================================================================
-- Schema 53: Chats ließen sich nicht mehr löschen (22.09.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Seit Schema 52 steht auf jeder Tabelle die Sperrregel `nur_freigegebene`.
-- Danach schlug jedes DELETE auf public.chats fehl:
--
--   infinite recursion detected in policy for relation "chats"
--
-- supabase-js meldet das nicht als Fehler, das DELETE trifft einfach keine
-- Zeile. Aufgefallen ist es in test/_sichtbarkeit.js, dessen Prüfchat danach
-- stehen blieb.
--
-- Die Schleife: "Leeren Chat abraeumen" (chats) liest chat_members, und
-- "Mitglieder lesen" (chat_members) las direkt wieder chats. Solange chats nur
-- erlaubende Regeln hatte, ging das gut; mit der zusätzlichen einschränkenden
-- Regel sieht Postgres chats beim Auswerten ein zweites Mal und bricht ab.
--
-- Die Lösung ist dieselbe wie bei is_chat_member: die Frage „habe ich den Chat
-- angelegt?" beantwortet eine Funktion mit den Rechten ihres Eigentümers. Die
-- Regel liest chats dann nicht mehr selbst. Was sie zulässt, bleibt gleich.
--
-- Geprüft mit EXPLAIN für SELECT, UPDATE und DELETE auf allen 65 Tabellen mit
-- `nur_freigegebene`: nur chats/DELETE war betroffen.
-- ===========================================================================

create or replace function public.ist_chat_ersteller(p_chat uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.chats where id = p_chat and created_by = auth.uid());
$$;

revoke execute on function public.ist_chat_ersteller(uuid) from public, anon;
grant execute on function public.ist_chat_ersteller(uuid) to authenticated;

drop policy if exists "Mitglieder lesen" on public.chat_members;
create policy "Mitglieder lesen" on public.chat_members
  for select to authenticated
  using (
    public.is_chat_member(chat_id)
    or public.ist_chat_ersteller(chat_id)
  );
