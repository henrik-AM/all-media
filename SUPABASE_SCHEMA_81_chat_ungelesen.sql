-- ===========================================================================
-- Schema 81: eine neue Nachricht macht den Chat beim Gegenüber ungelesen
-- (Kasten 27, „Chats kommen verfälscht an", 06.10.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik: „A schreibt ‚cxv', bei B kommt ‚cwkdew' an." In der Datenbank stand
-- die richtige Nachricht. B sah eine ältere: App und Website luden Chat und
-- Chatliste nur einmal (behoben im Code, gemeinsam/chatabgleich.js). Dazu kam:
-- der Ungelesen-Punkt in der Chatliste hängt an chat_members.is_read — und
-- das setzte bei einer neuen Nachricht niemand auf false. B bekam also nicht
-- einmal einen Hinweis, dass etwas Neues da war. Live geprüft am 06.10.2026:
-- 406 Mitgliedschaften, last_read_at überall leer, is_read fast überall true.
--
-- Die Regel betrifft ANDERE Nutzer (B's Zeile, geschrieben durch A's
-- Nachricht) — deshalb gehört sie in die Datenbank, nicht in einen Client.
-- B's eigene Zeile darf A unter RLS nicht ändern; daher security definer.
--
-- Zurückgenommen wird der Punkt beim Öffnen des Chats: App
-- (ChatDetailScreen → chatEinstellung 'gelesen') und Website
-- (/api/chats/:id/read) setzen is_read = true und last_read_at.
--
-- ERSETZT NICHTS. Neue Funktion, neuer Auslöser. Der vorhandene Auslöser
-- chat_antwort_nimmt_an (Schema 21) auf messages bleibt unberührt.
-- Idempotent: create or replace / drop trigger if exists.
-- ===========================================================================

create or replace function public.nachricht_macht_ungelesen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.chat_members
     set is_read = false
   where chat_id = new.chat_id
     and user_id <> new.sender_id
     and is_read;
  return new;
end;
$$;

-- Postgres gibt EXECUTE automatisch an PUBLIC. Ein Auslöser braucht das
-- Recht beim Feuern nicht; aufrufbar soll die Funktion von außen nicht sein.
revoke execute on function public.nachricht_macht_ungelesen() from public, anon, authenticated;

drop trigger if exists nachricht_macht_ungelesen on public.messages;
create trigger nachricht_macht_ungelesen
  after insert on public.messages
  for each row execute function public.nachricht_macht_ungelesen();
