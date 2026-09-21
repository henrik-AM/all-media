-- ===========================================================================
--  Drei Ereignisse, die bisher keine Mitteilung erzeugt haben
-- ===========================================================================
--
--  BEFUND (21.09.2026)
--
--  Schema 44 hat sechs Auslöser gebaut: Herz, Kommentar, Folgen, Repost,
--  Story-Herz, Beitritt. Danach blieb in der App eine Liste von Mitteilungs-
--  arten stehen, zu denen es zwar einen Satz gibt (ProfilContext.tsx,
--  web/server/app.js), aber niemanden, der sie je schreibt.
--
--  Drei davon hängen an Ereignissen, die es in der Datenbank wirklich gibt:
--
--    1. Markierung in einem Beitrag      -> post_tags   (Schema 20)
--    2. Herz an einem Kommentar          -> comment_likes (Schema 1)
--    3. Chat-Anfrage und ihre Annahme    -> chats.anfrage_zustand (Schema 21)
--
--  Was hier NICHT gebaut wird, und warum:
--
--    - "Antwort auf einen Kommentar". Die Tabelle `comments` hat keine
--      Spalte für den Bezug; Antworten auf Kommentare gibt es im Projekt
--      überhaupt nicht. Eine Mitteilung dafür wäre eine Mitteilung über ein
--      Ereignis, das nie eintritt. Erst das Merkmal, dann der Auslöser.
--    - "Neue Nachricht in einem Kanal". Ein Kanal hat viele Mitglieder; das
--      wäre bei jeder Nachricht eine Lawine, dieselbe Überlegung wie bei
--      `mitteilung_beitritt` in Schema 44. Das braucht vorher eine
--      Stummschaltung je Kanal.
--
--  WARUM WIEDER AUSLÖSER UND NICHT CODE
--
--  Unverändert der Grund aus Schema 44: App und Website schreiben beide
--  direkt nach Supabase. Stünde das Anlegen in der Oberfläche, gäbe es zwei
--  Stellen, und eine würde vergessen.
--
--  Einspielen:
--    SUPABASE_TOKEN=... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_49_mitteilungen_rest.sql
--
--  Danach `npm run test:rechte` — Postgres gibt EXECUTE bei jeder neuen
--  Funktion automatisch an PUBLIC.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Zuerst die Einschränkungen erweitern
--
--  `notifications_art_check` und `notifications_target_type_check` stammen
--  aus Schema 5. Die Chat-Anfrage passt in keine der dort aufgezählten
--  Arten: 'nachricht' heißt in beiden Oberflächen "Neue Nachrichten in
--  einer Community", 'einladung' meint eine Community-Einladung. Eine
--  Anfrage, mit jemandem schreiben zu dürfen, ist etwas Drittes.
--
--  Zwei Arten und nicht eine: „X möchte mit dir schreiben" und „X hat deine
--  Anfrage angenommen" sind zwei verschiedene Sätze. Aus einer einzigen Art
--  ließe sich beim Anzeigen nicht ablesen, welcher gemeint ist — die
--  Mitteilung weiß nicht, auf welcher Seite der Anfrage ihr Empfänger steht.
--
--  ACHTUNG für später: wer SUPABASE_SCHEMA_5.sql noch einmal ganz einspielt,
--  setzt diese beiden Einschränkungen auf den alten Stand zurück und macht
--  damit die Auslöser unten stumm — sie würden bei jedem Herz an einem
--  Kommentar einen Fehler werfen. Dieselbe Falle wie bei Schema 7
--  (SUPABASE_REIHENFOLGE.md).
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_art_check;
alter table public.notifications add constraint notifications_art_check
  check (art in ('like', 'comment', 'follow', 'mention', 'share', 'message', 'system',
                 'repost', 'story', 'kanal', 'beitritt', 'nachricht', 'einladung',
                 'anfrage', 'anfrage_ok'));

alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications add constraint notifications_target_type_check
  check (target_type in ('post', 'comment', 'story', 'user', 'message', 'community',
                         'profile', 'video', 'chat'));


-- ---------------------------------------------------------------------------
--  1. Jemand markiert mich in einem Beitrag
--
--  `post_tags` merkt sich nur, WER markiert ist, nicht wer markiert hat.
--  Der Markierende ist der Angemeldete — beim Einspielen von Beständen per
--  SQL gibt es keinen, dann steht der Verfasser des Beitrags dafür ein.
--  `mitteilung_anlegen` wirft beides weg, wenn Sender und Empfänger
--  dieselbe Person sind; wer sich selbst markiert, bekommt also nichts.
--
--  Das Ziel ist der Beitrag, nicht der Markierende: ein Tipp darauf soll
--  den Beitrag öffnen.
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_markierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_verfasser uuid;
begin
  select user_id into v_verfasser from public.posts where id = new.post_id;

  perform public.mitteilung_anlegen(
    new.user_id, coalesce(auth.uid(), v_verfasser), 'mention', 'videos',
    'post', new.post_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_markierung on public.post_tags;
create trigger mitteilung_markierung
  after insert on public.post_tags
  for each row execute function public.mitteilung_bei_markierung();


-- ---------------------------------------------------------------------------
--  2. Jemandem gefällt mein Kommentar
--
--  Dieselbe Art wie beim Beitrag ('like'), aber ein anderes Ziel. Daran
--  unterscheiden beide Oberflächen den Satz: 'post' -> "dein Beitrag",
--  'video' -> "dein Video", 'comment' -> "dein Kommentar".
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_kommentarlike()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_verfasser uuid;
begin
  select user_id into v_verfasser from public.comments where id = new.comment_id;

  perform public.mitteilung_anlegen(
    v_verfasser, new.user_id, 'like', 'videos', 'comment', new.comment_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_kommentarlike on public.comment_likes;
create trigger mitteilung_kommentarlike
  after insert on public.comment_likes
  for each row execute function public.mitteilung_bei_kommentarlike();


-- ---------------------------------------------------------------------------
--  3. Chat-Anfrage gestellt und angenommen
--
--  Schema 21 kennt vier Zustände: 'offen', 'wartet', 'angenommen',
--  'abgelehnt'. Zwei davon will jemand erfahren:
--
--    'wartet'      -> der Angefragte soll es sehen, sonst wartet die
--                     Anfrage in einem Chat, den er nie öffnet.
--    'angenommen'  -> der Anfragende soll es sehen, damit er weiß, dass er
--                     jetzt schreiben darf.
--
--  Kein Auslöser bei 'abgelehnt': eine Ablehnung soll niemandem gemeldet
--  werden. Wer abgelehnt hat, möchte in Ruhe gelassen werden, und der
--  Anfragende merkt es daran, dass er nicht schreiben kann.
--
--  Der Empfänger ist das Chatmitglied, das nicht der Anfragende ist. Bei
--  einem Chat zu zweit ist das genau einer. Bei einer Gruppe gibt es keine
--  Anfrage (Schema 21), deshalb reicht `limit 1` hier nicht als Notnagel,
--  sondern beschreibt die Lage.
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_chatanfrage()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_anderer uuid;
begin
  if new.anfrage_zustand is not distinct from old.anfrage_zustand then
    return new;
  end if;

  if new.anfrage_zustand = 'wartet' then
    select user_id into v_anderer
      from public.chat_members
     where chat_id = new.id and user_id <> new.anfrage_von
     limit 1;

    perform public.mitteilung_anlegen(
      v_anderer, new.anfrage_von, 'anfrage', 'communities', 'chat', new.id
    );

  elsif new.anfrage_zustand = 'angenommen' then
    select user_id into v_anderer
      from public.chat_members
     where chat_id = new.id and user_id <> new.anfrage_von
     limit 1;

    perform public.mitteilung_anlegen(
      new.anfrage_von, coalesce(auth.uid(), v_anderer), 'anfrage_ok', 'communities',
      'chat', new.id
    );
  end if;

  return new;
end $$;

drop trigger if exists mitteilung_chatanfrage on public.chats;
create trigger mitteilung_chatanfrage
  after update on public.chats
  for each row execute function public.mitteilung_bei_chatanfrage();


-- ---------------------------------------------------------------------------
--  Rechte
--
--  Postgres gibt EXECUTE bei jeder neuen Funktion automatisch an PUBLIC —
--  also auch an `anon`, den Schlüssel, den jede Website-Seite mitbringt.
--  Diese drei Funktionen sind `security definer` und schreiben in fremde
--  Posteingänge; sie dürfen von außen nicht aufrufbar sein. Als Auslöser
--  braucht sie niemand aufzurufen.
-- ---------------------------------------------------------------------------

revoke all on function public.mitteilung_bei_markierung()    from public, anon, authenticated;
revoke all on function public.mitteilung_bei_kommentarlike() from public, anon, authenticated;
revoke all on function public.mitteilung_bei_chatanfrage()   from public, anon, authenticated;
