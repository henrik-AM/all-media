-- ===========================================================================
--  SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql
--
--  Feedback 21.09.2026, Kasten 9 „Likes und Aktivität“
--
--  Henriks Wortlaut:
--    „Likes-Sichtbarkeit prüfen: Die Einstellung existiert — funktioniert sie
--     wirklich? Gewünschtes Muster: niemand · keiner bis auf … · alle bis
--     auf … · alle. Wer freigegeben ist, sieht unter einem Video wie bei
--     Instagram, dass die Person es geliked hat.“
--    „Aktivitäts-Anzeigen fremder Leute: ‚X gefällt das / X hat gespeichert‘
--     nur für Profile, denen ich folge.“
--
--  WESSEN LIKES DIE EINSTELLUNG SCHÜTZT
--
--  Die des Likenden. Stellt Anna „Likes-Sichtbarkeit: Niemand“ ein, darf
--  niemand erfahren, welche fremden Beiträge Anna gefallen haben. Der
--  Beitrag, an dem das Herz hängt, gehört dabei jemand anderem.
--
--  BEFUND VORHER — DIE EINSTELLUNG WAR NUR EINE ANZEIGE
--
--  Schema 20 hat `liker_namen()` gebaut und dort `sichtbar_fuer()` geprüft.
--  Die Oberflächen haben den Namen also richtig ausgeblendet. Die Tabelle
--  darunter stand aber seit SUPABASE_SCHEMA.sql offen:
--
--      create policy "Likes lesen" on public.post_likes
--        for select to authenticated using (true);
--
--  Jedes angemeldete Konto konnte mit einer einzigen Abfrage
--  (`from('post_likes').select('user_id, post_id')`) lesen, wem was gefällt —
--  an der Einstellung vorbei. Das ist genau die Stufe „gespeichert, aber
--  nicht wirksam“.
--
--  Schema 20 hat die Leseregel bewusst offen gelassen, weil beide
--  Oberflächen die Zahl über `post_likes(count)` einbetten und PostgREST nur
--  zählt, was die Regel durchlässt. Die Lösung dafür steht hier: die Zahl
--  kommt jetzt aus `like_zahlen()`, einer Funktion, die ZÄHLT, aber keine
--  Namen herausgibt. Damit kann die Tabelle zu.
--
--  WAS HIER GESCHIEHT
--
--  1. `like_sichtbar(liker, beitrag, betrachter)` — die eine Stelle, an der
--     entschieden wird, ob ein einzelnes Like für jemanden sichtbar ist.
--  2. Leseregel „Likes lesen“ auf post_likes nutzt sie. Der Betrachter ist
--     immer `auth.uid()`.
--  3. `like_zahlen(beitraege)` — die Zahl je Beitrag, unabhängig davon, wer
--     fragt. Die Zahl ist eine Tatsache über den Beitrag, der Name eine
--     Angabe über den Menschen.
--  4. `liker_namen(beitraege, wer)` — der Name unter dem Beitrag, jetzt nur
--     noch von Profilen, denen `wer` folgt (Kasten 9.4), und über dieselbe
--     Entscheidung wie die Leseregel (Kasten 9.1/9.2).
--
--  DIE AUSNAHME: DER BESITZER DES BEITRAGS
--
--  Wem der Beitrag gehört, der sieht jedes Like darauf, egal wie der Likende
--  eingestellt ist. So hält es Instagram, und anders ginge es auch nicht
--  ehrlich: die Glocke meldet dem Besitzer ohnehin „X gefällt dein Beitrag“
--  (Schema 44). Eine Einstellung, die das Gegenteil verspricht, wäre gelogen.
--  Die Einstellung schützt also vor allen DRITTEN — Followern, Fremden,
--  anderen Likenden.
--
--  ZWEI REGELN AUF post_likes — WARUM DAS HIER NICHTS AUFHEBT
--
--  „Eigenen Like setzen“ (SUPABASE_SCHEMA.sql) gilt `for all`, also auch
--  für SELECT, und wird mit „Likes lesen“ verodert. Sie öffnet nur die
--  eigenen Zeilen (`auth.uid() = user_id`) — und die lässt `like_sichtbar()`
--  ohnehin durch. Die Veroderung öffnet also nichts, was nicht schon offen
--  sein soll. Wer eine DRITTE Leseregel ergänzt, muss die Bedingung von
--  `like_sichtbar()` darin wiederholen, sonst ist die Einstellung wieder
--  wirkungslos.
--
--  REIHENFOLGE
--
--  Setzt voraus: sichtbar_fuer() (Schema 11), beitrag_sichtbar() (Schema 7),
--  follows (Schema 2), visibility_settings mit Bereich 'likes' (Schema 18).
--  `liker_namen()` gilt ab hier aus dieser Datei (vorher Schema 23 Audit).
--  Die Leseregel „Likes lesen“ gilt ab hier aus dieser Datei (vorher
--  SUPABASE_SCHEMA.sql).
--
--  Der Code von App und Website kommt mit und ohne diese Datei zurecht:
--  fehlt `like_zahlen()`, nehmen beide die eingebettete Zahl. Die ist ohne
--  diese Datei noch ungefiltert und damit richtig.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql
--  Danach: npm run test:rechte, npm run test:likes
-- ===========================================================================


-- 1. Die eine Entscheidung --------------------------------------------------
--
-- Der Betrachter muss der Aufrufer sein. Sonst könnte jemand über
-- /rest/v1/rpc/like_sichtbar für beliebige Dritte durchprobieren, wer auf
-- wessen Ausnahmeliste steht — die Listen sind privat (Schema 11). In der
-- Leseregel wird immer `auth.uid()` übergeben, dort ändert das nichts.

create or replace function public.like_sichtbar(liker uuid, beitrag uuid, betrachter uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select betrachter is not null
     and betrachter = auth.uid()
     and (
          -- Das eigene Like sieht man immer.
          liker = betrachter
          -- Der Besitzer des Beitrags sieht jedes Like darauf (siehe oben).
       or exists (select 1 from public.posts b
                   where b.id = beitrag and b.user_id = betrachter)
          -- Alle anderen: die vier Stufen des Likenden.
       or public.sichtbar_fuer(liker, 'likes', betrachter)
     );
$$;

revoke execute on function public.like_sichtbar(uuid, uuid, uuid) from public, anon;
grant execute on function public.like_sichtbar(uuid, uuid, uuid) to authenticated;


-- 2. Die Leseregel ----------------------------------------------------------

drop policy if exists "Likes lesen" on public.post_likes;
create policy "Likes lesen" on public.post_likes
  for select to authenticated
  using (public.like_sichtbar(user_id, post_id, auth.uid()));


-- 3. Die Zahl ---------------------------------------------------------------
--
-- Zählt alle Likes eines Beitrags, auch die verborgenen. Gibt nur Beiträge
-- heraus, die der Aufrufer ohnehin lesen darf (beitrag_sichtbar, dieselbe
-- Bedingung wie die Leseregel auf posts). Höchstens 1000 auf einmal — die
-- Oberflächen laden 300.

create or replace function public.like_zahlen(beitraege uuid[])
returns table (post_id uuid, anzahl bigint)
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
  if coalesce(cardinality(beitraege), 0) > 1000 then
    raise exception 'zu viele Beiträge auf einmal';
  end if;

  return query
    select b.id,
           (select count(*) from public.post_likes l where l.post_id = b.id)
      from public.posts b
     where b.id = any (beitraege)
       and public.beitrag_sichtbar(b.user_id, b.demo);
end;
$$;

revoke execute on function public.like_zahlen(uuid[]) from public, anon;
grant execute on function public.like_zahlen(uuid[]) to authenticated;


-- 4. Der Name unter dem Beitrag ---------------------------------------------
--
-- „Gefällt Anna und 14 weiteren Personen“. Anna steht dort nur, wenn
--   - Anna nicht ich selbst bin,
--   - ich Anna folge (Kasten 9.4: Aktivität nur von Profilen, denen ich
--     folge — so hält es auch Instagram), und
--   - Annas Likes-Sichtbarkeit mich zulässt (like_sichtbar, wie oben).
-- Die jüngste passende Person gewinnt. Die Zahl daneben kommt aus
-- like_zahlen() und bleibt davon unberührt.

create or replace function public.liker_namen(beitraege uuid[], wer uuid)
returns table (post_id uuid, name text)
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
  if wer is distinct from auth.uid() then
    raise exception 'nicht erlaubt';
  end if;
  if coalesce(cardinality(beitraege), 0) > 1000 then
    raise exception 'zu viele Beiträge auf einmal';
  end if;

  return query
    select b.id,
           (select p.name
              from public.post_likes x
              join public.profiles p on p.id = x.user_id
             where x.post_id = b.id
               and x.user_id <> wer
               and exists (select 1 from public.follows f
                            where f.follower_id = wer and f.followee_id = x.user_id)
               and public.like_sichtbar(x.user_id, x.post_id, wer)
             order by x.created_at desc
             limit 1)
      from public.posts b
     where b.id = any (beitraege)
       and public.beitrag_sichtbar(b.user_id, b.demo)
       and exists (select 1 from public.post_likes l where l.post_id = b.id);
end;
$$;

revoke execute on function public.liker_namen(uuid[], uuid) from public, anon;
grant execute on function public.liker_namen(uuid[], uuid) to authenticated;


-- 5. Gegenprobe -------------------------------------------------------------
--
-- Bricht ab, wenn die Leseregel nicht die neue ist oder noch eine weitere
-- SELECT-Regel auf post_likes steht, die mehr als die eigenen Zeilen öffnet.

do $$
declare
  n int;
begin
  select count(*) into n
    from pg_policies
   where schemaname = 'public' and tablename = 'post_likes'
     and policyname = 'Likes lesen'
     and qual like '%like_sichtbar%';
  if n <> 1 then
    raise exception 'Die Leseregel „Likes lesen“ ist nicht die aus Schema 65.';
  end if;

  select count(*) into n
    from pg_policies
   where schemaname = 'public' and tablename = 'post_likes'
     and cmd in ('SELECT', 'ALL')
     and policyname not in ('Likes lesen', 'Eigenen Like setzen');
  if n <> 0 then
    raise exception 'Auf post_likes steht eine weitere Leseregel — sie hebt die Likes-Sichtbarkeit auf.';
  end if;
end;
$$;
