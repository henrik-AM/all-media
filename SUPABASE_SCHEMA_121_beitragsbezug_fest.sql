-- =====================================================================
-- SUPABASE_SCHEMA_121_beitragsbezug_fest.sql — 07.11.2026
--
-- Fund (Codex, high) zu Schema 119: Die RESTRICTIVE-Regel
-- `nur_sichtbare_beitraege` gilt nur für INSERT. Wer eine Zeile mit
-- lesbarem (oder leerem) Beitragsbezug anlegt, kann den Bezug danach per
-- UPDATE auf einen unsichtbaren Beitrag umbiegen — die UPDATE-Regeln
-- prüfen nur den Besitzer (`auth.uid() = user_id` bzw. `sender_id`).
--
-- Stand live (07.11.2026, pg_policies/pg_trigger gegengelesen):
--   * messages.shared_post_id    — schon fest durch spalten_fest (Schema 93)
--   * comments.post_id           — schon fest durch spalten_fest
--   * post_likes, reposts, saves, post_notify, sammlung_beitraege
--                                — Regel FOR ALL `auth.uid() = user_id`:
--                                  post_id per UPDATE frei änderbar  ← Lücke
--   * community_channel_messages, shares, stream_comments, kein_interesse
--                                — keine permissive UPDATE-Regel, UPDATE
--                                  trifft heute 0 Zeilen
--
-- Lösung: der Beitragsbezug ist für Clients unveränderlich. Ein Auslöser
-- `beitrag_bezug_fest` mit der vorhandenen Funktion spalten_fest() (wirft
-- 42501, nur für current_user = authenticated; service_role/Management-API
-- und security-definer-Funktionen bleiben frei) auf ALLEN Tabellen aus
-- Schema 119 — auch dort, wo heute schon etwas schützt, damit eine spätere
-- UPDATE-Regel oder eine geänderte spalten_fest-Liste die Lücke nicht
-- wieder aufmacht.
--
-- Warum verbieten statt erneut prüfen: App und Website ändern den Bezug
-- nirgends per UPDATE (Like/Merken/Repost/Hinweis/Sammlung = anlegen oder
-- löschen; upsert nur mit ignoreDuplicates = ON CONFLICT DO NOTHING). Eine
-- Sichtbarkeitsprüfung beim UPDATE würde dagegen normale Änderungen
-- (Nachricht bearbeiten/zurücknehmen, Kommentar bearbeiten) scheitern
-- lassen, sobald der geteilte Beitrag später unsichtbar wird.
--
-- Legt keine Funktion und keine Tabelle an (kein revoke/nur_freigegebene
-- nötig). Probe: app/test/_probe121.js.
-- =====================================================================

do $$
declare
  t text;
begin
  foreach t in array array['comments', 'stream_comments', 'post_likes', 'reposts', 'saves',
                           'shares', 'post_notify', 'kein_interesse', 'sammlung_beitraege'] loop
    execute format('drop trigger if exists beitrag_bezug_fest on public.%I', t);
    execute format(
      'create trigger beitrag_bezug_fest before update of post_id on public.%I
         for each row execute function public.spalten_fest(%L)', t, 'post_id');
  end loop;
  foreach t in array array['messages', 'community_channel_messages'] loop
    execute format('drop trigger if exists beitrag_bezug_fest on public.%I', t);
    execute format(
      'create trigger beitrag_bezug_fest before update of shared_post_id on public.%I
         for each row execute function public.spalten_fest(%L)', t, 'shared_post_id');
  end loop;
end $$;
