-- ===========================================================================
--  Mitteilungen entstehen jetzt durch Benutzung
-- ===========================================================================
--
--  BEFUND (18.09.2026)
--
--  `notifications` wird an sieben Stellen im Projekt gelesen und an genau
--  null Stellen geschrieben. Es gibt auch keinen Auslöser dafür:
--
--      select tgname from pg_trigger
--       where not tgisinternal
--         and tgfoid in (select oid from pg_proc
--                         where prosrc ilike '%notifications%');
--      -> leer
--
--  Und es gibt keine INSERT-Regel auf der Tabelle. Selbst wenn App oder
--  Website es versuchten, käme nichts an: Row Level Security verbietet, was
--  keine Regel erlaubt.
--
--  Die Glocke im Profil konnte sich also nie durch Benutzung füllen. Was
--  dort stand, kam ausschließlich aus dem Testbestand.
--
--  DAZU EIN ZWEITER FUND
--
--  In der Tabelle stehen rund 60.000 Zeilen mit `bereich = 'aktivitaet'` —
--  aus alten Beständen. Die App zeigt sie nie an: sie filtert nach
--  `bereich = 'videos'` beziehungsweise `'communities'`
--  (MitteilungsBereich in app/types/index.ts). Die beiden Begriffe sind
--  nebeneinander gewachsen und meinen dasselbe.
--
--  WARUM AUSLÖSER UND NICHT CODE
--
--  App und Website schreiben beide direkt nach Supabase. Stünde das Anlegen
--  einer Mitteilung in der Oberfläche, gäbe es zwei Stellen dafür, und die
--  eine würde vergessen — genau das Muster, das dieses Projekt schon bei der
--  Chat-Anfrage (Schema 21) und der Telefonregel (Schema 24) durchgemacht
--  hat. Ein Auslöser fängt jeden Weg ab, auch den, den es heute noch nicht
--  gibt.
--
--  `security definer` ist nötig, weil es für `notifications` keine
--  INSERT-Regel gibt und auch keine geben soll: eine Mitteilung schreibt man
--  sich nicht selbst, sie entsteht.
--
--  WAS KEINE MITTEILUNG AUSLÖST
--
--    - die eigene Handlung an eigenem Inhalt („Dir gefällt dein Beitrag")
--    - das Zurücknehmen (kein DELETE-Auslöser): eine Mitteilung, die
--      verschwindet, weil jemand sein Herz zurückzieht, macht den Verlauf
--      unzuverlässig
--    - Nachrichten in Chats: dafür gibt es die ungelesen-Zähler in der
--      Chatliste, und jede Nachricht zusätzlich als Mitteilung wäre doppelt
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_44_mitteilungen.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Eine Stelle, an der eine Mitteilung entsteht
--
--  Alle Auslöser unten rufen nur diese Funktion. Sie prüft das Einzige, was
--  für alle gilt: an sich selbst schickt niemand eine Mitteilung.
--
--  `on conflict do nothing` gibt es hier nicht — es gibt keinen eindeutigen
--  Schlüssel, über den zwei Mitteilungen dieselbe wären. Doppelte entstehen
--  trotzdem nicht: die Auslöser hängen an Tabellen, in denen die Kombination
--  aus Person und Ziel schon eindeutig ist (ein Herz gibt es einmal).
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_anlegen(
  p_an       uuid,
  p_von      uuid,
  p_art      text,
  p_bereich  text,
  p_zielart  text,
  p_ziel     uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if p_an is null or p_von is null or p_an = p_von then
    return;
  end if;

  insert into public.notifications (user_id, actor_id, art, bereich, target_type, target_id)
  values (p_an, p_von, p_art, p_bereich, p_zielart, p_ziel);
end $$;

-- Niemand ruft sie von außen. Ohne diesen Entzug stünde sie jedem
-- Angemeldeten offen — Postgres gibt EXECUTE automatisch an PUBLIC, siehe
-- SUPABASE_SCHEMA_37_rechte_nachziehen.sql.
revoke execute on function public.mitteilung_anlegen(uuid, uuid, text, text, text, uuid)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  Gefällt mir an einem Beitrag
--
--  `art` ist 'like', `target_type` entscheidet zwischen „dein Beitrag" und
--  „dein Video" — so liest es mitteilungText() in ProfilContext.tsx.
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_like()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_besitzer uuid; v_art text;
begin
  select user_id, case when kind = 'post' then 'post' else 'video' end
    into v_besitzer, v_art
    from public.posts where id = new.post_id;

  perform public.mitteilung_anlegen(
    v_besitzer, new.user_id, 'like', 'videos', v_art, new.post_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_like on public.post_likes;
create trigger mitteilung_like
  after insert on public.post_likes
  for each row execute function public.mitteilung_bei_like();


-- ---------------------------------------------------------------------------
--  Kommentar an einem Beitrag
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_kommentar()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_besitzer uuid;
begin
  select user_id into v_besitzer from public.posts where id = new.post_id;

  perform public.mitteilung_anlegen(
    v_besitzer, new.user_id, 'comment', 'videos', 'post', new.post_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_kommentar on public.comments;
create trigger mitteilung_kommentar
  after insert on public.comments
  for each row execute function public.mitteilung_bei_kommentar();


-- ---------------------------------------------------------------------------
--  Jemand folgt mir
--
--  `target_type = 'user'` und als Ziel der Folgende selbst: ein Tipp auf die
--  Mitteilung soll sein Profil öffnen, nicht das eigene.
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_folgen()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.mitteilung_anlegen(
    new.followee_id, new.follower_id, 'follow', 'videos', 'user', new.follower_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_folgen on public.follows;
create trigger mitteilung_folgen
  after insert on public.follows
  for each row execute function public.mitteilung_bei_folgen();


-- ---------------------------------------------------------------------------
--  Repost
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_repost()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_besitzer uuid;
begin
  select user_id into v_besitzer from public.posts where id = new.post_id;

  perform public.mitteilung_anlegen(
    v_besitzer, new.user_id, 'repost', 'videos', 'post', new.post_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_repost on public.reposts;
create trigger mitteilung_repost
  after insert on public.reposts
  for each row execute function public.mitteilung_bei_repost();


-- ---------------------------------------------------------------------------
--  Herz an einer Story
--
--  Seit Schema 41 landet das Herz auch als Nachricht im Chat. Die Mitteilung
--  ist trotzdem richtig: der Chat sagt „da liegt etwas", die Glocke sagt
--  „jemand hat auf deine Sachen reagiert". Das Handbuch trennt beides.
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_storylike()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_besitzer uuid;
begin
  select user_id into v_besitzer from public.stories where id = new.story_id;

  perform public.mitteilung_anlegen(
    v_besitzer, new.user_id, 'like', 'videos', 'story', new.story_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_storylike on public.story_likes;
create trigger mitteilung_storylike
  after insert on public.story_likes
  for each row execute function public.mitteilung_bei_storylike();


-- ---------------------------------------------------------------------------
--  Beitritt zu einer Community — die einzige im Bereich „communities"
--
--  Sie geht an den, der die Community angelegt hat. Bei einer Community mit
--  vielen Mitgliedern wäre eine Mitteilung an alle eine Lawine.
-- ---------------------------------------------------------------------------

create or replace function public.mitteilung_bei_beitritt()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare v_gruender uuid;
begin
  select created_by into v_gruender from public.communities where id = new.community_id;

  perform public.mitteilung_anlegen(
    v_gruender, new.user_id, 'beitritt', 'communities', 'community', new.community_id
  );
  return new;
end $$;

drop trigger if exists mitteilung_beitritt on public.community_members;
create trigger mitteilung_beitritt
  after insert on public.community_members
  for each row execute function public.mitteilung_bei_beitritt();


-- ---------------------------------------------------------------------------
--  Die 60.000 Altlasten
--
--  `bereich = 'aktivitaet'` zeigt die App nicht an und wird ab jetzt auch
--  nicht mehr geschrieben. Die Zeilen bleiben trotzdem stehen — sie zu
--  löschen wäre ein unumkehrbarer Eingriff in fremde Bestände für einen
--  Gewinn, den niemand sieht.
--
--  Was hier steht, ist nur der Vermerk, dass sie tot sind, damit der Nächste
--  nicht danach sucht.
-- ---------------------------------------------------------------------------

comment on column public.notifications.bereich is
  'videos oder communities — danach filtert die Glocke im jeweiligen Profil. '
  'aktivitaet/nachrichten/system stammen aus einem aelteren Entwurf, werden '
  'seit dem 18.09.2026 nicht mehr geschrieben und nirgends angezeigt.';


-- ===========================================================================
--  NACHTRAG, noch am 18.09.2026: es gab sie doch schon
-- ===========================================================================
--
--  Die Suche oben im Kopf dieser Datei war falsch. Sie hat die Auslöser nach
--  dem Wort `notifications` in ihrem eigenen Rumpf durchsucht — und drei
--  übersehen, weil der INSERT gar nicht in ihnen steht, sondern eine Ebene
--  tiefer in `public.benachrichtige()`:
--
--      on_post_like_trigger  auf post_likes  -> on_post_like()
--      on_comment_trigger    auf comments    -> on_comment()
--      on_contact_trigger    auf contacts    -> on_contact()
--
--  Aufgefallen ist es erst an der Gegenprobe: ein einziges Herz erzeugte
--  ZWEI Zeilen, eine von `mitteilung_like` und eine von `on_post_like`.
--
--  Die Infrastruktur war also da. Nur schrieb sie in `bereich = 'aktivitaet'`,
--  und die App filtert nach 'videos' beziehungsweise 'communities'. Deshalb
--  die 60.000 Zeilen, die niemand je gesehen hat — nicht weil nichts
--  geschrieben wurde, sondern weil es unter einem Namen abgelegt wurde, unter
--  dem niemand nachsieht.
--
--  Aufgeräumt wird so:
--
--    - Die beiden Auslöser, die es jetzt doppelt gibt (Herz, Kommentar),
--      werden entfernt. Die neuen bleiben: sie unterscheiden zwischen
--      „dein Beitrag" und „dein Video", was `on_post_like` nicht tat, und
--      sie hängen am selben Ort wie die übrigen vier.
--
--    - `on_contact` bleibt, bekommt aber den Bereich, unter dem die App
--      nachsieht. Er meint etwas anderes als `mitteilung_folgen`: das eine
--      ist „jemand hat dich ins Adressbuch genommen", das andere „jemand
--      folgt dir". Beide gibt es im Handbuch.
-- ===========================================================================

drop trigger if exists on_post_like_trigger on public.post_likes;
drop trigger if exists on_comment_trigger on public.comments;

create or replace function public.on_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- 'videos' statt 'aktivitaet': siehe Nachtrag oben.
  perform public.benachrichtige(new.contact_id, new.user_id, 'follow', 'videos', 'user', new.user_id, '');
  return new;
end;
$$;
