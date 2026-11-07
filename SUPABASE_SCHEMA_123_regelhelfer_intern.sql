-- =============================================================================
--  SCHEMA 123 — Regel-Helfer aus der öffentlichen API nehmen (07.11.2026)
-- =============================================================================
--
--  Codex-Gegencheck zu Schema 122 (Bericht ~/allmedia-wt/BERICHT-schema122-07-11.md,
--  zwei Funde „mittel"). Drei security-definer-Helfer, die nur in RLS-Regeln
--  gebraucht werden, waren für jedes angemeldete Konto per
--  POST /rest/v1/rpc/<name> direkt aufrufbar und verrieten dabei mehr, als
--  das Konto sehen darf:
--
--  1. public.beitrag_ausgeblendet(uuid)   (Schema 102)
--     public.kommentar_ausgeblendet(uuid) (Schema 92/102)
--     moderierter (für Clients unsichtbarer) Inhalt → true, unbekannte ID →
--     false: Existenz- und Moderationsorakel für beliebige UUIDs.
--
--  2. public.darf_markierung_loesen(ziel_post, wen, wer) (Schema 20)
--     `wer` frei übergebbar: mit wer = <beliebiges Konto> verrät true/false,
--     wer einen Beitrag verfasst hat — auch einen unsichtbaren; unbekannter
--     Beitrag → NULL statt false.
--
--  Behebung: Die Helfer ziehen in das Schema `intern`, das PostgREST nicht
--  ausliefert (db_schema = public, graphql_public). Regeln dürfen sie weiter
--  aufrufen (USAGE + EXECUTE für authenticated), als RPC gibt es sie nicht mehr.
--  Der Markierungs-Helfer nimmt das Konto nicht mehr als Parameter, sondern
--  liest auth.uid() selbst, und antwortet für unbekannte Beiträge false.
--  Danach die alten public-Funktionen löschen — `drop function` ohne cascade
--  scheitert laut, falls noch eine Regel daran hängt.
--
--  Die Regeln selbst bleiben inhaltlich gleich (102, 20); nur der Aufruf
--  zeigt auf intern.*. Kein App-/Website-Code ruft die Helfer (geprüft 07.11.).
--
--  Bleibt (bekannt, niedrig): wer eine fremde UUID kennt, kann über die
--  Fehlerart beim Einfügen (FK-Fehler vs. RLS-Ablehnung) weiter auf Existenz
--  schließen. Das ist eine Eigenschaft der Fremdschlüssel, nicht der Helfer.
-- =============================================================================

create schema if not exists intern;
revoke all on schema intern from public, anon;
grant usage on schema intern to authenticated;

-- ---------------------------------------------------------------- Helfer

create or replace function intern.beitrag_ausgeblendet(p_post uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.posts where id = p_post and moderiert_am is not null);
$$;

-- Schema 92 (reply_to) ist seit 07.11. live — die Fassung mit Antwort-Teil.
create or replace function intern.kommentar_ausgeblendet(p_kommentar uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.comments c
      left join public.comments w on w.id = c.reply_to
      join public.posts p on p.id = c.post_id
     where c.id = p_kommentar
       and (c.moderiert_am is not null or p.moderiert_am is not null or w.moderiert_am is not null));
$$;

-- Entfernen darf die markierte Person selbst und der Verfasser des Beitrags
-- (Schema 20). Das Konto kommt aus der Anmeldung, nicht vom Aufrufer.
create or replace function intern.darf_markierung_loesen(ziel_post uuid, wen uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    wen = auth.uid()
    or exists (select 1 from public.posts b where b.id = ziel_post and b.user_id = auth.uid()),
    false);
$$;

revoke execute on function intern.beitrag_ausgeblendet(uuid) from public, anon;
revoke execute on function intern.kommentar_ausgeblendet(uuid) from public, anon;
revoke execute on function intern.darf_markierung_loesen(uuid, uuid) from public, anon;
grant execute on function intern.beitrag_ausgeblendet(uuid) to authenticated;
grant execute on function intern.kommentar_ausgeblendet(uuid) to authenticated;
grant execute on function intern.darf_markierung_loesen(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------- Regeln (102)

drop policy if exists nicht_ausgeblendet on public.comments;
create policy nicht_ausgeblendet on public.comments as restrictive for all to authenticated
  using (moderiert_am is null and not intern.beitrag_ausgeblendet(post_id)
         and (reply_to is null or not intern.kommentar_ausgeblendet(reply_to)))
  with check (moderiert_am is null and not intern.beitrag_ausgeblendet(post_id)
              and (reply_to is null or not intern.kommentar_ausgeblendet(reply_to)));

do $$
declare t text;
begin
  foreach t in array array['post_likes', 'saves', 'reposts', 'shares', 'sammlung_inhalte',
                           'sammlung_beitraege', 'post_tags'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists nicht_ausgeblendet on public.%I', t);
    -- sammlung_inhalte.post_id darf null sein (andere Inhaltsarten).
    execute format('create policy nicht_ausgeblendet on public.%I as restrictive for insert to authenticated '
                   'with check (post_id is null or not intern.beitrag_ausgeblendet(post_id))', t);
  end loop;
end $$;

drop policy if exists nicht_ausgeblendet on public.comment_likes;
create policy nicht_ausgeblendet on public.comment_likes as restrictive for insert to authenticated
  with check (not intern.kommentar_ausgeblendet(comment_id));

-- ---------------------------------------------------------------- Regel (20)

drop policy if exists "Markierung entfernen" on public.post_tags;
create policy "Markierung entfernen" on public.post_tags
  for delete to authenticated
  using (intern.darf_markierung_loesen(post_id, user_id));

-- ---------------------------------------------------------------- Alte Helfer weg

drop function if exists public.beitrag_ausgeblendet(uuid);
drop function if exists public.kommentar_ausgeblendet(uuid);
drop function if exists public.darf_markierung_loesen(uuid, uuid, uuid);
