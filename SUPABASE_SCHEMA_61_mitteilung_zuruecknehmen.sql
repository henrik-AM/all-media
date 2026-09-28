-- ===========================================================================
--  SUPABASE_SCHEMA_61_mitteilung_zuruecknehmen.sql
--
--  WARUM ES DAS GIBT
--
--  Die Glocke füllt sich über Auslöser beim Anlegen (Schema 44 und 49): ein
--  Like, ein Kommentar, ein Folgen, ein Kommentar-Like. Beim Zurücknehmen
--  passierte nichts. Wer versehentlich ein Herz setzte und es sofort wieder
--  wegnahm, stand trotzdem in der Glocke des anderen: „X gefällt dein
--  Beitrag" — für ein Like, das es nicht mehr gibt. Gefunden am 28.09.2026
--  beim Prüfen von Kasten 5.
--
--  WAS HIER GESCHIEHT
--
--  Je ein Auslöser NACH dem Löschen, der die passende Mitteilung entfernt.
--  Gesucht wird über Absender, Art und Ziel, nicht über den Empfänger: wird
--  ein ganzer Beitrag gelöscht, fallen seine Likes per cascade mit, und der
--  Beitrag, aus dem sich der Empfänger ablesen ließe, ist dann schon weg.
--
--  Beim Kommentar wird nur EINE Mitteilung entfernt, die jüngste: wer zweimal
--  unter denselben Beitrag schreibt und einen Kommentar löscht, hat den
--  anderen ja noch.
-- ===========================================================================

create or replace function public.mitteilung_weg_bei_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
   where actor_id = old.user_id
     and art = 'like'
     and target_type in ('post', 'video')
     and target_id = old.post_id;
  return old;
end $$;

create or replace function public.mitteilung_weg_bei_kommentarlike()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
   where actor_id = old.user_id
     and art = 'like'
     and target_type = 'comment'
     and target_id = old.comment_id;
  return old;
end $$;

create or replace function public.mitteilung_weg_bei_folgen()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
   where user_id = old.followee_id
     and actor_id = old.follower_id
     and art = 'follow';
  return old;
end $$;

create or replace function public.mitteilung_weg_bei_kommentar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notifications
   where id = (
     select n.id from public.notifications n
      where n.actor_id = old.user_id
        and n.art = 'comment'
        and n.target_type = 'post'
        and n.target_id = old.post_id
      order by n.created_at desc
      limit 1
   );
  return old;
end $$;

drop trigger if exists mitteilung_weg_like on public.post_likes;
create trigger mitteilung_weg_like
  after delete on public.post_likes
  for each row execute function public.mitteilung_weg_bei_like();

drop trigger if exists mitteilung_weg_kommentarlike on public.comment_likes;
create trigger mitteilung_weg_kommentarlike
  after delete on public.comment_likes
  for each row execute function public.mitteilung_weg_bei_kommentarlike();

drop trigger if exists mitteilung_weg_folgen on public.follows;
create trigger mitteilung_weg_folgen
  after delete on public.follows
  for each row execute function public.mitteilung_weg_bei_folgen();

drop trigger if exists mitteilung_weg_kommentar on public.comments;
create trigger mitteilung_weg_kommentar
  after delete on public.comments
  for each row execute function public.mitteilung_weg_bei_kommentar();

-- Postgres gibt EXECUTE an neuen Funktionen automatisch an PUBLIC.
-- Auslöserfunktionen ruft niemand direkt auf (test:rechte).
revoke all on function public.mitteilung_weg_bei_like()          from public, anon, authenticated;
revoke all on function public.mitteilung_weg_bei_kommentarlike() from public, anon, authenticated;
revoke all on function public.mitteilung_weg_bei_folgen()        from public, anon, authenticated;
revoke all on function public.mitteilung_weg_bei_kommentar()     from public, anon, authenticated;
