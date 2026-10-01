-- ===========================================================================
--  All Media — Schema 75 (Kasten 16): Die Story-Markierung landet im Chat
--  Stand 01.10.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Schema 68 hat jede Story-Markierung als Mitteilung in die Videos-Glocke
--  gelegt — auch die aus einer reinen Messenger-Story. Henrik am 01.10.2026:
--
--    „Nein, das ist falsch, Messenger und Videos werden strikt getrennt.
--     Wenn ich im Messenger bei den Stories markiere, soll die Person im Chat
--     zwischen den beiden Personen eine Benachrichtigung bekommen, dass sie
--     markiert wurde. Wenn unter Videos eine Person markiert wird, soll diese
--     auch im Messenger die gleiche Benachrichtigung erhalten, solange die
--     beiden über den Messenger schreiben. Schreiben sie über Communitys,
--     bekommt die Person dort die Benachrichtigung unter Chats."
--
--  Und zur Frage, was ohne gemeinsamen Chat passiert:
--
--    „Die Idee ist, dass man nicht die Telefonnummer einer Person aus dem
--     öffentlichen Video-Profil bekommt, sondern erst mal nur über das
--     öffentliche Community-Profil schreiben kann."
--
--  WAS HIER GESCHIEHT
--
--  1. messages.hinweis — eine Nachricht kann ein Hinweis sein statt Text.
--     Einziger Wert bisher 'story_markierung'. Die Story steht in
--     reply_to_story (Fremdschlüssel seit Schema 41, Einbettung in beiden
--     Oberflächen vorhanden). Unverschlüsselt (krypto = 0): Der Hinweis
--     entsteht in der Datenbank, die keinen Schlüssel der beiden kennt, und
--     er enthält nichts, was nicht schon die Story selbst zeigt.
--
--  2. Der Ziel-Chat, in dieser Reihenfolge:
--       a) der Messenger-Zweierchat der beiden,
--       b) sonst ihr Community-Zweierchat,
--       c) sonst ein neuer Community-Zweierchat als Chat-Anfrage — nie ein
--          neuer Messenger-Chat (Schema 57: Messenger nur mit Zustimmung).
--     Das gilt für Messenger- und Videos-Storys gleich. Eine Messenger-Story
--     ohne Messenger-Chat ist selten (markieren lassen sich auch Gefolgte),
--     dann gilt dieselbe Kette.
--
--  3. Die Videos-Glocke meldet nur noch Markierungen in Storys mit
--     in_videos. Eine reine Messenger-Story erscheint nie in Videos.
--
--  4. Wird die Markierung entfernt, verschwinden Hinweis und Mitteilung
--     wieder (wie Schema 61 bei Likes und Folgen).
--
--  Idempotent: mehrfach einspielbar.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Spalte
-- ---------------------------------------------------------------------------

alter table public.messages add column if not exists hinweis text;

alter table public.messages drop constraint if exists messages_hinweis_check;
alter table public.messages
  add constraint messages_hinweis_check
  check (hinweis is null or hinweis in ('story_markierung'));

comment on column public.messages.hinweis is
  'Nachricht ist ein Hinweis statt Text. story_markierung: Absender hat den '
  'Empfänger in der Story reply_to_story markiert (Schema 75). Satz in '
  'gemeinsam/story.js.';

-- Für das Entfernen der Markierung: den Hinweis zu einer Story schnell finden.
create index if not exists messages_hinweis_story_idx
  on public.messages (reply_to_story) where hinweis is not null;


-- ---------------------------------------------------------------------------
--  2. Den Zweierchat zweier Personen in einem Bereich finden
-- ---------------------------------------------------------------------------

create or replace function public.zweierchat(p_a uuid, p_b uuid, p_bereich text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.chats c
   where c.is_group is not true
     and coalesce(c.bereich, 'messenger') = p_bereich
     and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = p_a)
     and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = p_b)
     and (select count(*) from public.chat_members m where m.chat_id = c.id) = 2
   -- Ein abgelehnter Chat bleibt bestehen (Schema 21), er ist trotzdem
   -- der Ort, an dem die beiden schreiben. Der jüngste gewinnt.
   order by c.updated_at desc nulls last, c.created_at desc
   limit 1;
$$;

revoke all on function public.zweierchat(uuid, uuid, text) from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  3. Der Auslöser: Hinweis in den Chat, Glocke nur bei Videos-Storys
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_story_markierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_story     public.stories%rowtype;
  v_von       uuid;
  v_chat      uuid;
begin
  select * into v_story from public.stories where id = new.story_id;
  if v_story.id is null then
    return new;
  end if;
  v_von := coalesce(auth.uid(), v_story.user_id);

  -- Wer sich selbst markiert, bekommt nichts.
  if v_von = new.user_id then
    return new;
  end if;

  -- (3) Glocke nur, wenn die Story in Videos steht.
  if v_story.in_videos then
    perform public.mitteilung_anlegen(
      new.user_id, v_von, 'mention', 'videos', 'story', new.story_id
    );
  end if;

  -- (2) Der Chat: Messenger, sonst Community, sonst neue Community-Anfrage.
  v_chat := coalesce(
    public.zweierchat(v_von, new.user_id, 'messenger'),
    public.zweierchat(v_von, new.user_id, 'community')
  );

  if v_chat is null then
    insert into public.chats (is_group, created_by, bereich)
    values (false, v_von, 'community')
    returning id into v_chat;

    insert into public.chat_members (chat_id, user_id)
    values (v_chat, v_von), (v_chat, new.user_id)
    on conflict do nothing;

    -- Als Anfrage, damit der Empfänger annimmt oder ablehnt wie bei jeder
    -- ersten Nachricht von Fremden. Das UPDATE (statt gleich beim INSERT)
    -- ist Absicht: mitteilung_bei_chatanfrage() meldet die Anfrage in der
    -- Communitys-Glocke nur beim Wechsel offen -> wartet.
    update public.chats
       set anfrage_zustand = 'wartet', anfrage_von = v_von
     where id = v_chat and anfrage_zustand = 'offen';
  end if;

  -- Gleiche Story, gleicher Chat: nicht doppelt (Markierung entfernt und
  -- wieder gesetzt, ohne dass der alte Hinweis gelöscht wurde).
  if not exists (
    select 1 from public.messages
     where chat_id = v_chat and reply_to_story = new.story_id
       and hinweis = 'story_markierung' and sender_id = v_von
  ) then
    insert into public.messages (chat_id, sender_id, text, reply_to_story, hinweis, krypto)
    values (v_chat, v_von, '', new.story_id, 'story_markierung', 0);
  end if;

  update public.chats set updated_at = now() where id = v_chat;
  return new;
end $$;

revoke all on function public.mitteilung_bei_story_markierung() from public, anon, authenticated;

drop trigger if exists mitteilung_story_markierung on public.story_tags;
create trigger mitteilung_story_markierung
  after insert on public.story_tags
  for each row execute function public.mitteilung_bei_story_markierung();


-- ---------------------------------------------------------------------------
--  4. Markierung entfernt -> Hinweis und Mitteilung weg
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_weg_bei_story_markierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.notifications
   where user_id = old.user_id
     and art = 'mention'
     and target_type = 'story'
     and target_id = old.story_id;

  -- Nur der Hinweis an genau diese Person: in ihrem Zweierchat.
  delete from public.messages m
   where m.hinweis = 'story_markierung'
     and m.reply_to_story = old.story_id
     and exists (select 1 from public.chat_members c
                  where c.chat_id = m.chat_id and c.user_id = old.user_id);
  return old;
end $$;

revoke all on function public.mitteilung_weg_bei_story_markierung() from public, anon, authenticated;

drop trigger if exists mitteilung_weg_story_markierung on public.story_tags;
create trigger mitteilung_weg_story_markierung
  after delete on public.story_tags
  for each row execute function public.mitteilung_weg_bei_story_markierung();


-- ---------------------------------------------------------------------------
--  5. Altlast: Glocken-Mitteilungen aus reinen Messenger-Storys entfernen
-- ---------------------------------------------------------------------------

delete from public.notifications n
 using public.stories s
 where n.art = 'mention'
   and n.target_type = 'story'
   and n.target_id = s.id
   and not s.in_videos;


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'messages'
                    and column_name = 'hinweis') then
    raise exception 'messages.hinweis fehlt';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'mitteilung_weg_story_markierung') then
    raise exception 'Auslöser beim Entfernen fehlt';
  end if;
  if pg_get_functiondef('public.mitteilung_bei_story_markierung'::regproc) not like '%zweierchat%' then
    raise exception 'mitteilung_bei_story_markierung ist die alte Fassung';
  end if;
end $$;
