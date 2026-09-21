-- ===========================================================================
--  Die Story im Chat — der Bezug, den es seit dem ersten Schema gibt und
--  den nie jemand benutzt hat
-- ===========================================================================
--
--  BEFUND (18.09.2026)
--
--  `messages.reply_to_story` steht seit SUPABASE_SCHEMA.sql Zeile 146 in der
--  Tabelle. Eine Suche über das ganze Projekt findet genau diese eine Zeile:
--  geschrieben hat die Spalte nie jemand, gelesen auch nicht. Sie ist seit
--  Monaten eine leere Spalte.
--
--  Was daraus folgte, hat Henrik als zwei getrennte Beobachtungen gemeldet:
--
--    1. „Story-Like wird nicht im Chat angezeigt."
--       storyLike() schreibt nach `story_likes` und sonst nirgendwohin. Die
--       Person, deren Story geliked wurde, erfährt davon nichts — es gibt
--       keine Nachricht, keine Mitteilung, nichts. Das Herz ist eine Zeile in
--       einer Tabelle, die niemand ansieht.
--
--    2. Eine Story-ANTWORT kommt zwar an, aber als nackter Satz. Im Chat
--       steht „schönes Bild!" ohne das Bild. Wer nach zwei Tagen hineinsieht,
--       weiß nicht, worauf sich das bezieht — und die Story ist dann ohnehin
--       abgelaufen.
--
--  WAS HIER GESCHIEHT
--
--  Drei kleine Dinge, damit der Bezug tragfähig wird:
--
--    1. Ein Fremdschlüssel auf `stories`. Ohne ihn zeigt die Spalte auf
--       irgendetwas, und die Einbettung in PostgREST (`stories(...)` in
--       NACHRICHT_SPALTEN) ist gar nicht möglich — PostgREST leitet
--       Einbettungen ausschließlich aus Fremdschlüsseln ab.
--
--    2. `on delete set null`. Eine Story lebt 24 Stunden, die Nachricht
--       darüber bleibt. Bei `cascade` verschwände morgen der halbe Chat.
--       Die Nachricht steht dann ohne Vorschau da — richtig so: das Bild
--       gibt es wirklich nicht mehr.
--
--    3. Ein Index. Ohne ihn liest jede Chatöffnung die Spalte sequenziell.
--
--  WAS HIER NICHT GESCHIEHT
--
--  Keine neue Tabelle und keine neue Regel. Eine Nachricht mit Storybezug ist
--  eine ganz gewöhnliche Nachricht: dieselben Rechte, dieselbe
--  Verschlüsselung, dieselbe Zustellung. Sie hat nur ein Feld mehr gefüllt.
--  Das ist der Grund, warum das Herz künftig verschlüsselt ankommt, ohne dass
--  dafür irgendetwas geschrieben werden müsste.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_41_story_im_chat.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Der Fremdschlüssel
--
--  `not valid` und danach `validate`: falls im Bestand eine Zeile steht, die
--  auf eine längst abgelaufene Story zeigt, soll das Einspielen nicht daran
--  scheitern. Die Spalte war leer, also wird das nichts finden — aber ein
--  Schema, das nur auf einem leeren Bestand durchläuft, taugt nichts.
--
--  Der Name ist bewusst ausgeschrieben. `NACHRICHT_SPALTEN` bettet über die
--  Spalte ein (`stories!messages_reply_to_story_fkey`), nicht über einen
--  geratenen Namen — siehe die Regel „PostgREST-Einbettung mehrdeutig".
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'messages_reply_to_story_fkey'
       and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_reply_to_story_fkey
      foreign key (reply_to_story) references public.stories (id)
      on delete set null
      not valid;

    alter table public.messages validate constraint messages_reply_to_story_fkey;
  end if;
end $$;


-- ---------------------------------------------------------------------------
--  2. Der Index
--
--  Teilindex: die allermeisten Nachrichten haben keinen Storybezug, und ein
--  Index über lauter NULL-Werte kostet Platz ohne Nutzen.
-- ---------------------------------------------------------------------------

create index if not exists messages_reply_to_story_idx
  on public.messages (reply_to_story)
  where reply_to_story is not null;


-- ---------------------------------------------------------------------------
--  3. Was die Spalte bedeutet — für den Nächsten, der sie findet
-- ---------------------------------------------------------------------------

comment on column public.messages.reply_to_story is
  'Die Story, auf die sich diese Nachricht bezieht — eine Antwort darauf oder '
  'ein Herz. Die Nachricht zeigt im Chat die Vorschau der Story. Bleibt '
  'stehen, wenn die Story nach 24 Stunden verschwindet (on delete set null); '
  'dann fehlt die Vorschau, die Nachricht bleibt lesbar.';
