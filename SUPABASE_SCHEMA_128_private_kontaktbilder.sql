-- =====================================================================
-- SUPABASE_SCHEMA_128_private_kontaktbilder.sql — 20.11.2026 (Paket 8)
--
-- OWASP-Fund A01-002 (Codeaudit 25.10.2026, berichte/OWASP-Audit-2026-10-25.md
-- im Sammelzweig): „Nur du" gilt bei Kontaktfotos nicht für die Datei.
--
-- Kontaktfotos (Schema 94) laden App und Website in den Ordner avatars/.
-- `medium_sichtbar` (Schema 95) gab den ganzen Ordner für jedes angemeldete
-- Konto frei:  if ordner in ('avatars', 'beispiel') then return true;
-- Die Regel „Medien lesen" auf storage.objects ruft genau diese Funktion.
-- Wer also direkt die Storage-API fragt, konnte jede Datei in avatars/
-- auflisten und unterschreiben — auch das private Kontaktfoto eines
-- anderen. Live am 20.11.: 18 Avatar-Dateien nur in Supabase, keine davon
-- von einem Profil oder einer Community verwendet; für alle offen.
--
-- Bunny-Medien hatten das Problem nicht: bunny_medium_lesbar (Schema 115)
-- gibt avatars/ nur frei, wenn ein Profil oder eine Community darauf zeigt.
-- Dieselbe Regel gilt jetzt auch für Dateien in Supabase.
--
-- Der Entwurf SUPABASE_SCHEMA_107_private_kontaktbilder.sql (Sammelzweig,
-- nie eingespielt) ist damit ersetzt:
--   * Sein Referenz-Auslöser (A01-003) ist seit Schema 117 live
--     (medienreferenz_eigen: Medienspalten nur mit selbst hochgeladener
--     Datei, auch profiles.avatar_url, communities.bild_url).
--   * Die Bindung an den Uploader brauchte einen DEFINER-Helfer in public
--     (RPC-Orakel, vgl. Schema 123/125). Seit 117 kann niemand ein fremdes
--     Bild in sein Profil schreiben; die Referenz genügt, wie in 115.
--
-- Der Eigentümer liest seine Datei weiter über owner_id (Regel „Medien
-- lesen"). Bereits ausgegebene Unterschriften laufen erst ab (max. 4 h).
--
-- Idempotent, ohne begin/commit. Hängt ab von 95 (medien_adresse).
-- Ersetzt nur medium_sichtbar (Kette 95 → 128, SUPABASE_REIHENFOLGE.md).
-- =====================================================================

create or replace function public.medium_sichtbar(pfad text)
returns boolean
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  ordner text := split_part(pfad, '/', 1);
  adresse text := public.medien_adresse(pfad);
begin
  if ordner = 'beispiel' then
    return true;
  end if;
  -- Profil- und Communitybilder sind öffentlich, Kontaktfotos nicht.
  -- SECURITY INVOKER: die Tabellen-RLS des Lesers entscheidet mit.
  if ordner = 'avatars' then
    return
         exists (select 1 from public.profiles where avatar_url = adresse)
      or exists (select 1 from public.communities where bild_url = adresse);
  end if;
  return
       exists (select 1 from public.stories where media_url = adresse)
    or exists (select 1 from public.posts where media_url = adresse or thumbnail_url = adresse)
    or exists (select 1 from public.messages where media_url = adresse)
    or exists (select 1 from public.insights where media_url = adresse)
    or exists (select 1 from public.ptt_messages where audio_url = adresse)
    or exists (select 1 from public.community_channel_messages where media_url = adresse)
    or exists (select 1 from public.sammlungen where titelbild_url = adresse);
end;
$$;

revoke execute on function public.medium_sichtbar(text) from public, anon;
grant execute on function public.medium_sichtbar(text) to authenticated;

-- Bewusst KEIN Index auf profiles.avatar_url / communities.bild_url (Probe
-- 20.11.): Ein neuer Index macht das Profil-UPDATE „nicht-HOT"; dann wertet
-- Postgres alle Indizes neu aus, auch den Ausdrucksindex mit
-- telefonbuch_schluessel() — den darf authenticated nicht ausführen, und
-- jeder Profilbildwechsel scheiterte mit 42501. Die Tabellen sind klein.
