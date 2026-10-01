-- ===========================================================================
--  All Media — Schema 79 (Kasten 16): Ein Hinweis ist kein Austausch
--  Stand 01.10.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  messenger_anfragen() (Schema 57) erlaubt die Frage nach dem Messenger erst
--  „nach etwas Austausch": beide müssen im Community-Chat geschrieben haben.
--  Gezählt wurde jede Nachricht. Seit Schema 75 legt eine Story-Markierung
--  eine Hinweis-Nachricht im Namen des Markierenden an — eine Markierung und
--  eine einzige Antwort hätten also schon gereicht, um nach dem Messenger zu
--  fragen. Henrik: erst über das öffentliche Community-Profil schreiben, die
--  Telefonnummer bleibt privat.
--
--  WAS HIER GESCHIEHT
--
--  Die Zählung in messenger_anfragen() übergeht Hinweise (hinweis is null).
--  Umgeschrieben am Anker wie Schema 17/60/62, der Rest der Funktion bleibt.
--
--  Idempotent: mehrfach einspielbar.
-- ===========================================================================

do $$
declare
  quelle text;
  anker  constant text := 'where chat_id = p_chat and sender_id in (ich, anderer)) < 2 then';
  neu    constant text := 'where chat_id = p_chat and sender_id in (ich, anderer) and hinweis is null) < 2 then';
begin
  select pg_get_functiondef('public.messenger_anfragen(uuid)'::regprocedure) into quelle;
  if position(neu in quelle) > 0 then
    raise notice 'messenger_anfragen() übergeht Hinweise schon.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in messenger_anfragen() nicht gefunden — bitte von Hand anpassen.';
  end if;
  execute replace(quelle, anker, neu);
end $$;

revoke execute on function public.messenger_anfragen(uuid) from public, anon;
grant execute on function public.messenger_anfragen(uuid) to authenticated;

do $$
begin
  if pg_get_functiondef('public.messenger_anfragen(uuid)'::regprocedure) not like '%hinweis is null%' then
    raise exception 'messenger_anfragen zählt Hinweise noch mit';
  end if;
end $$;
