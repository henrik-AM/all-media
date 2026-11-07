-- =====================================================================
-- SUPABASE_SCHEMA_119_nur_sichtbare_beitraege.sql — 07.11.2026
--
-- Fund im Prüflauf k28-kommentare (07.11.2026): @test konnte einen
-- Beitrag von @prueflauf kommentieren, den @test gar nicht sehen kann
-- (demo-Beitrag eines Nicht-demo-Profils; Regel "Beitraege lesen" →
-- beitrag_sichtbar() liefert false). Die INSERT-Regeln aller Tabellen,
-- die auf posts zeigen, prüfen nur `auth.uid() = user_id` (bzw.
-- darf_kommentieren = Kommentar-Einstellung des Besitzers), aber nie, ob
-- der Beitrag für den Schreibenden überhaupt lesbar ist. Wer eine
-- Beitrags-ID kennt (z. B. aus einer alten Verlinkung oder einem
-- geplanten, noch nicht veröffentlichten Beitrag), konnte
--   * kommentieren / live kommentieren (löst Mitteilungen aus),
--   * liken, reposten, merken, teilen, in Sammlungen legen,
--   * "Beitragshinweis" und "kein Interesse" setzen,
--   * den Beitrag in einen Chat oder Kanal teilen,
-- und erfuhr dabei per Erfolg/Fehler, dass es den Beitrag gibt.
--
-- Jetzt: eine Hilfsfunktion `beitrag_lesbar(post)` bildet genau die
-- Lese-Regeln von posts nach (Beitraege lesen + geplant_erst_spaeter +
-- nicht_ausgeblendet) und eine RESTRICTIVE INSERT-Regel
-- `nur_sichtbare_beitraege` auf jeder dieser Tabellen verlangt sie.
-- Bei comments und stream_comments gilt dieselbe Regel zusätzlich fürs
-- Lesen (bisher "Kommentare lesen" = true: Kommentare zu unsichtbaren
-- Beiträgen waren lesbar).
--
-- RESTRICTIVE, damit sie sich mit den vorhandenen Regeln UND-verknüpft
-- (siehe reference_rls_zweite_regel_oeffnet). Bestehende Zeilen bleiben
-- unberührt; nur neue Schreibvorgänge werden geprüft.
-- Nicht betroffen: Einfügen per service_role / Management-API (Testbestand).
-- =====================================================================

create or replace function public.beitrag_lesbar(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts b
     where b.id = p_post
       and b.moderiert_am is null
       and public.beitrag_sichtbar(b.user_id, b.demo)
       and (b.publish_at is null or b.publish_at <= now() or b.user_id = auth.uid())
  );
$$;

revoke execute on function public.beitrag_lesbar(uuid) from public, anon;
grant execute on function public.beitrag_lesbar(uuid) to authenticated;

-- Schreiben: nur auf lesbare Beiträge.
do $$
declare
  t text;
begin
  foreach t in array array['comments', 'stream_comments', 'post_likes', 'reposts', 'saves',
                           'shares', 'post_notify', 'kein_interesse', 'sammlung_beitraege'] loop
    execute format('drop policy if exists nur_sichtbare_beitraege on public.%I', t);
    execute format(
      'create policy nur_sichtbare_beitraege on public.%I as restrictive for insert to authenticated
         with check ((select public.beitrag_lesbar(post_id)))', t);
  end loop;
end $$;

-- Geteilte Beiträge in Chats und Kanälen (Spalte darf leer sein).
drop policy if exists nur_sichtbare_beitraege on public.messages;
create policy nur_sichtbare_beitraege on public.messages as restrictive for insert to authenticated
  with check (shared_post_id is null or (select public.beitrag_lesbar(shared_post_id)));

drop policy if exists nur_sichtbare_beitraege on public.community_channel_messages;
create policy nur_sichtbare_beitraege on public.community_channel_messages as restrictive for insert to authenticated
  with check (shared_post_id is null or (select public.beitrag_lesbar(shared_post_id)));

-- Lesen: Kommentare nur zu lesbaren Beiträgen.
drop policy if exists nur_sichtbare_beitraege_lesen on public.comments;
create policy nur_sichtbare_beitraege_lesen on public.comments as restrictive for select to authenticated
  using (public.beitrag_lesbar(post_id));

drop policy if exists nur_sichtbare_beitraege_lesen on public.stream_comments;
create policy nur_sichtbare_beitraege_lesen on public.stream_comments as restrictive for select to authenticated
  using (public.beitrag_lesbar(post_id));
