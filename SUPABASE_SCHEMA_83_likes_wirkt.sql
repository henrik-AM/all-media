-- ===========================================================================
--  SUPABASE_SCHEMA_83_likes_wirkt.sql
--
--  Kasten 26: „Nutzer sollen auswählen dürfen, wer ihre Likes sehen darf.“
--
--  BEFUND (lesend gegen die Live-Datenbank, 08.10.2026)
--
--  post_likes   : zu seit Schema 65 (like_sichtbar), Besitzer-Ausnahme drin,
--                 Zahl über like_zahlen(). Nichts zu tun.
--  comment_likes: Leseregel „Kommentar-Likes lesen“ = using (true)
--  story_likes  : Leseregel „Story-Likes lesen“   = using (true)
--
--  Auf den beiden letzten konnte jedes angemeldete Konto per
--  `from('comment_likes').select('user_id, comment_id')` lesen, wem welcher
--  Kommentar/welche Story gefallen hat — an „Likes-Sichtbarkeit: Niemand“
--  vorbei. Dieselbe Lücke wie bei post_likes vor Schema 65.
--
--  WAS HIER GESCHIEHT
--
--  1. Leseregeln auf comment_likes und story_likes: sichtbar sind
--       - die eigenen Zeilen,
--       - alle Likes auf meinen Kommentar / meine Story (Besitzer-Ausnahme,
--         wie bei Beiträgen, Kasten 26.4),
--       - sonst nur, was die Likes-Sichtbarkeit des Likenden zulässt
--         (sichtbar_fuer(liker, 'likes', ich), inkl. „Nur Follower“).
--     Der Betrachter ist immer auth.uid().
--  2. kommentar_like_zahlen(kommentare) — die Zahl bleibt für alle gleich
--     (nur das „wer“ ist geschützt), weil die eingebettete Zahl
--     `comment_likes(count)` nur noch die sichtbaren Zeilen zählte.
--
--  Story-Likes werden nirgends gezählt (nur die eigenen gelesen), daher
--  keine Zählfunktion.
--
--  Setzt voraus: Schema 65 + 76 (sichtbar_fuer mit nur_follower).
--  Der Code von App und Website kommt mit und ohne diese Datei zurecht:
--  fehlt die Funktion, nehmen beide die eingebettete Zahl.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_83_likes_wirkt.sql
--  Danach: npm run test:rechte, npm run test:likes
--  Idempotent.
-- ===========================================================================

-- 1a. Kommentar-Likes --------------------------------------------------------

create or replace function public.kommentar_like_sichtbar(liker uuid, kommentar uuid, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select betrachter is not null
     and betrachter = auth.uid()
     and (
          liker = betrachter
       or exists (select 1 from public.comments c
                   where c.id = kommentar and c.user_id = betrachter)
       or public.sichtbar_fuer(liker, 'likes', betrachter)
     );
$$;
revoke execute on function public.kommentar_like_sichtbar(uuid, uuid, uuid) from public, anon;
grant execute on function public.kommentar_like_sichtbar(uuid, uuid, uuid) to authenticated;

drop policy if exists "Kommentar-Likes lesen" on public.comment_likes;
create policy "Kommentar-Likes lesen" on public.comment_likes
  for select to authenticated
  using (public.kommentar_like_sichtbar(user_id, comment_id, auth.uid()));

-- 1b. Story-Likes ------------------------------------------------------------

create or replace function public.story_like_sichtbar(liker uuid, story uuid, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select betrachter is not null
     and betrachter = auth.uid()
     and (
          liker = betrachter
       or exists (select 1 from public.stories s
                   where s.id = story and s.user_id = betrachter)
       or public.sichtbar_fuer(liker, 'likes', betrachter)
     );
$$;
revoke execute on function public.story_like_sichtbar(uuid, uuid, uuid) from public, anon;
grant execute on function public.story_like_sichtbar(uuid, uuid, uuid) to authenticated;

drop policy if exists "Story-Likes lesen" on public.story_likes;
create policy "Story-Likes lesen" on public.story_likes
  for select to authenticated
  using (public.story_like_sichtbar(user_id, story_id, auth.uid()));

-- 2. Die Zahl der Kommentar-Likes -------------------------------------------

create or replace function public.kommentar_like_zahlen(kommentare uuid[])
returns table (comment_id uuid, anzahl bigint)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;
  if coalesce(cardinality(kommentare), 0) > 1000 then
    raise exception 'zu viele Kommentare auf einmal';
  end if;

  return query
    select c.id,
           (select count(*) from public.comment_likes l where l.comment_id = c.id)
      from public.comments c
      join public.posts b on b.id = c.post_id
     where c.id = any (kommentare)
       and public.beitrag_sichtbar(b.user_id, b.demo);
end;
$$;
revoke execute on function public.kommentar_like_zahlen(uuid[]) from public, anon;
grant execute on function public.kommentar_like_zahlen(uuid[]) to authenticated;

-- 3. Gegenprobe --------------------------------------------------------------

do $$
declare n int;
begin
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('comment_likes', 'story_likes')
     and cmd in ('SELECT', 'ALL') and permissive = 'PERMISSIVE'
     and policyname not in ('Kommentar-Likes lesen', 'Story-Likes lesen',
                            'Eigenen Kommentar-Like setzen', 'Eigenen Story-Like setzen');
  if n <> 0 then
    raise exception 'Auf comment_likes/story_likes steht eine weitere Leseregel.';
  end if;
  select count(*) into n from pg_policies
   where schemaname = 'public' and tablename in ('comment_likes', 'story_likes')
     and policyname in ('Kommentar-Likes lesen', 'Story-Likes lesen')
     and qual like '%_like_sichtbar%';
  if n <> 2 then
    raise exception 'Die Leseregeln sind nicht die aus Schema 83.';
  end if;
end $$;
