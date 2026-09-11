-- ===========================================================================
--  Schema 32 — die letzte Nachricht je Chat
--
--  Henrik, 07.09.2026:
--    "Kontaktsortierung falsch (älterer Chat über neuerem)."
--    "Chat-Vorschautext nicht synchron mit letzter echter Nachricht."
--
--  Beides ist derselbe Fehler, und er stand in App wie Website an derselben
--  Stelle. Die Chatliste holte die Vorschauen so:
--
--      from('messages').in('chat_id', ids).order('created_at', desc).limit(500)
--
--  Eine Grenze von fünfhundert — aber über ALLE Chats zusammen, nicht je
--  Chat. Wer viel schreibt, füllt sie allein. Jeder Chat, dessen letzte
--  Nachricht älter ist als die fünfhundert jüngsten insgesamt, bekam gar
--  keine Zeile zurück. In der Liste hatte er dann
--
--    * keinen Vorschautext (die Nachricht fehlte) und
--    * als Sortierschlüssel `chats.updated_at` statt der Nachrichtenzeit.
--
--  `updated_at` wandert bei jeder Änderung am Chat mit — beim Umbenennen,
--  beim Stummschalten, beim Beitreten. Damit rutschte ein monatealter Chat
--  über einen frischen, sobald irgendwer an ihm etwas verstellt hatte. Genau
--  das Bild, das Henrik beschreibt.
--
--  Die Grenze anzuheben verschiebt den Fehler nur nach hinten. Richtig ist,
--  die Frage zu stellen, die die Liste wirklich hat: eine Nachricht je Chat,
--  die jeweils jüngste. Das kann Postgres mit `lateral` in einem Durchgang;
--  PostgREST kann es nicht, deshalb steht es hier als Funktion.
-- ===========================================================================

create or replace function public.letzte_nachrichten(chat_ids uuid[])
returns setof public.messages
language sql
stable
security invoker
set search_path = public
as $$
  /*
   * `security invoker`, nicht `definer`: die Funktion soll genau das sehen,
   * was der Aufrufer sehen darf. Die Regeln auf `messages` und
   * `chat_members` gelten also weiter — eine Funktion, die sie umginge, wäre
   * ein Loch in der Wand, das man aus der Chatliste heraus aufmachen kann.
   *
   * Der Zeitstrich `geleert_bis` wird hier gleich mitgezogen. Wer einen Chat
   * geleert hat, soll in der Liste auch keine Vorschau von vorher mehr
   * sehen; früher filterte das jede Seite für sich nach dem Laden — was nur
   * so lange funktionierte, wie die alten Nachrichten überhaupt mitkamen.
   * Steht der Strich hinter der letzten Nachricht, liefert das `lateral`
   * keine Zeile, und der Chat hat schlicht keine Vorschau. Richtig so.
   */
  select m.*
    from public.chat_members cm
    cross join lateral (
      select n.*
        from public.messages n
       where n.chat_id = cm.chat_id
         and (cm.geleert_bis is null or n.created_at > cm.geleert_bis)
       order by n.created_at desc
       limit 1
    ) m
   where cm.user_id = auth.uid()
     and cm.chat_id = any(chat_ids);
$$;

comment on function public.letzte_nachrichten(uuid[]) is
  'Je Chat die jüngste für mich sichtbare Nachricht — Vorschau und Sortierung der Chatliste.';

grant execute on function public.letzte_nachrichten(uuid[]) to authenticated;

/*
 * Der Index dazu. Ohne ihn liest das `lateral` je Chat die Nachrichten der
 * Reihe nach durch; mit ihm greift es die jüngste direkt ab.
 */
create index if not exists messages_chat_zeit_idx
  on public.messages (chat_id, created_at desc);
