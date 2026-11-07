-- =============================================================================
--  SCHEMA 124 — Likes und Aufrufe nur auf Sichtbares (08.11.2026)
-- =============================================================================
--
--  Rest aus Schema 123 („Bleibt, niedrig"): Wer eine fremde UUID kennt, sah an
--  der Fehlerart beim Einfügen, ob es den Inhalt gibt — Fremdschlüsselfehler
--  (23503) = gibt es nicht, Erfolg oder RLS-Ablehnung (42501) = gibt es.
--
--  Gemessen 08.11. (app/test/_probe124.js, PROBE_LIVE=1):
--  Beitragsbezüge sind dicht — überall prüft eine RESTRICTIVE-Regel
--  beitrag_lesbar() (Schema 119), die für „unbekannt" und „unsichtbar" gleich
--  false liefert; RLS läuft vor der Fremdschlüsselprüfung. Sammlungen prüfen
--  per Auslöser „nur Eigenes" (gleiche Meldung für beides). Offen waren:
--
--    comment_likes.comment_id   — kein Sichtbarkeitsbezug außer Moderation:
--                                 Like auf Kommentar unter einem unsichtbaren
--                                 (z. B. geplanten) Beitrag ging durch.
--    story_likes.story_id       — gar keine Prüfung: Like auf abgelaufene/
--    story_views.story_id         verborgene Storys ging durch.
--    messages.reply_to_story    — Antwort auf eine unsichtbare Story ging durch.
--
--  und bei allen vier per UPDATE der Bezugsspalte dasselbe noch einmal.
--
--  Behebung ohne neue Helfer-Funktion (kein neues RPC-Orakel, vgl. Schema 123):
--  Die Regel fragt `exists (select 1 from <Ziel> where id = …)` — die
--  Unterabfrage läuft mit den RLS-Regeln des Kontos, sieht also genau, was das
--  Konto lesen darf. Unbekannt und unsichtbar → beide 42501.
--  UPDATE der Bezugsspalten wird per spalten_fest (Schema 121) gesperrt.
-- =============================================================================

-- ---------------------------------------------------------------- Kommentar-Likes

drop policy if exists nur_sichtbare_kommentare on public.comment_likes;
create policy nur_sichtbare_kommentare on public.comment_likes as restrictive for insert to authenticated
  with check (exists (select 1 from public.comments c where c.id = comment_likes.comment_id));

drop trigger if exists bezug_fest on public.comment_likes;
create trigger bezug_fest before update of comment_id on public.comment_likes
  for each row execute function public.spalten_fest('comment_id');

-- ---------------------------------------------------------------- Story-Likes / -Aufrufe

drop policy if exists nur_sichtbare_storys on public.story_likes;
create policy nur_sichtbare_storys on public.story_likes as restrictive for insert to authenticated
  with check (exists (select 1 from public.stories s where s.id = story_likes.story_id));

drop trigger if exists bezug_fest on public.story_likes;
create trigger bezug_fest before update of story_id on public.story_likes
  for each row execute function public.spalten_fest('story_id');

drop policy if exists nur_sichtbare_storys on public.story_views;
create policy nur_sichtbare_storys on public.story_views as restrictive for insert to authenticated
  with check (exists (select 1 from public.stories s where s.id = story_views.story_id));

drop trigger if exists bezug_fest on public.story_views;
create trigger bezug_fest before update of story_id on public.story_views
  for each row execute function public.spalten_fest('story_id');

-- ---------------------------------------------------------------- Antwort auf Story
-- UPDATE von reply_to_story sperrt schon der spalten_fest-Auslöser auf messages.

drop policy if exists nur_sichtbare_storys on public.messages;
create policy nur_sichtbare_storys on public.messages as restrictive for insert to authenticated
  with check (reply_to_story is null
              or exists (select 1 from public.stories s where s.id = messages.reply_to_story));
