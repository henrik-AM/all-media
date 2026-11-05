-- ===========================================================================
-- ABGLEICH MIT MAIN (Paket 1, 05.11.2026, Stand origin/main ad7f221)
--   Keine main-Datei 101–117 definiert eines dieser Objekte; live nicht
--   vorhanden (nur lesend geprüft): Spalten shared_post_weg/-konto,
--   geteilt_weg_merken() (before delete on posts), geteilt_weg_schuetzen().
--   Zusammenspiel mit main:
--   * Schema 102 (F11) blendet moderierte Beiträge aus statt sie zu löschen —
--     dann feuert geteilt_weg_merken nicht; die Karte zeigt „für dich nicht
--     sichtbar“ (Beitrag nicht lesbar), erst das endgültige Löschen nach der
--     Frist (beitraege_entfernte_loeschen) setzt den Merker.
--   * Schema 103 (konto_loeschen) löscht Beiträge → Merker wird gesetzt.
--   * messages_krypto_stimmig, nicht_gesperrt_aendern (102) und
--     medienreferenz_pruefen (117) betreffen die beiden Spalten nicht.
-- ===========================================================================
-- ============================================================================
-- SUPABASE_SCHEMA_93_geteilt_weg.sql
-- (Nummer 93 reserviert vom Hauptagenten für Kasten 7.5/7.6.
-- Entwurf — eingespielt wird erst nach der Supabase-Sperre.)
--
-- Feedback 28.09.2026, Kasten 7, Nachtrag 11.10.2026 (Henrik: „Ja, einbauen
-- und verbessern"), Zeilen 7.5 und 7.6.
--
-- WAS FEHLTE
--
-- Ein geteilter Beitrag hängt an der Nachricht über `shared_post_id`
-- (messages: Schema 7, community_channel_messages: Schema 59), beide mit
-- `on delete set null`. Wird der Beitrag gelöscht, setzt die Datenbank die
-- Kennung auf null — und die Nachricht verliert jede Spur. Übrig bleibt der
-- Vorschautext „Beitrag geteilt“ / „Video geteilt“ als gewöhnliche Blase, in
-- Chat, Unterthema und Chatliste. Niemand sieht, dass da einmal ein Beitrag war.
--
-- ENTSCHEIDUNG: Merker plus Konto, kein Schnappschuss von Titel/Bild
--
--   shared_post_weg    timestamptz — wann der geteilte Beitrag gelöscht wurde.
--   shared_post_konto  uuid        — wem er gehörte (posts.user_id).
--
-- Ein Schnappschuss von Titel, Beschreibung oder Vorschaubild hätte den
-- gelöschten Inhalt in jedem Chat weiterleben lassen, in den er je geteilt
-- wurde — das Gegenteil dessen, was der Besitzer mit Löschen will. Ein Merker
-- sagt nur die Wahrheit („gelöscht“), das Konto erlaubt die Zeile „von …“ mit
-- Profilbild über der Karte. Kein Fremdschlüssel auf profiles: wird das
-- ganze Konto gelöscht, fallen seine Beiträge per cascade im selben Befehl,
-- und eine Referenz auf das gerade verschwindende Profil wäre eine Falle.
-- Die Oberfläche schlägt das Konto in der geladenen Nutzerliste nach; ein
-- gelöschtes Konto steht dort nicht, dann fehlt die Zeile „von …“ — ehrlich.
--
-- WAS DIESE DATEI TUT
--
-- 1. Beide Spalten auf messages und community_channel_messages.
-- 2. Auslöser `geteilt_weg_merken` BEFORE DELETE auf posts (security definer,
--    EXECUTE entzogen): setzt in allen Nachrichten und Kanalnachrichten mit
--    shared_post_id = old.id den Merker und das Konto. Danach setzt der
--    Fremdschlüssel shared_post_id wie bisher auf null.
-- 3. Auslöser `geteilt_weg_schuetzen` BEFORE INSERT OR UPDATE OF … auf beiden
--    Tabellen: von außen (Client) lassen sich die beiden Spalten weder setzen
--    noch ändern — sonst könnte ein Absender seine eigene Karte als „gelöscht“
--    ausgeben. Nur der Auslöser aus 2 (pg_trigger_depth() > 1) schreibt sie.
--
-- „NICHT VERFÜGBAR“ VS. „GELÖSCHT“ (7.6)
--
--   shared_post_id gesetzt, Einbettung leer  → die Leseregel gibt ihn nicht
--       heraus (privat, gesperrt, Minderjährigen-Freigabe): „Für dich nicht
--       sichtbar“. Ehrlich, denn die Zeile existiert noch (sonst wäre die
--       Kennung null).
--   shared_post_id null, shared_post_weg gesetzt → „Der Beitrag wurde gelöscht“.
--   shared_post_id null, kein Merker            → keine Karte (alte Nachricht
--       von vor diesem Schema, deren Beitrag schon weg war — nicht mehr
--       erkennbar; siehe auskommentierten Block 5).
--
-- ERSETZT NICHTS. Keine bestehende Funktion, Regel oder Bedingung wird neu
-- definiert; `letzte_nachrichten()` (Schema 32) liefert `m.*` und damit die
-- neuen Spalten von selbst. Keine neue Tabelle (also kein nur_freigegebene).
--
-- Code vor dem Schema: App (daten.ts) und Server (supabase-api.js) lesen die
-- beiden Spalten getrennt und nachsichtig (42703 → ohne Merker, wie bisher).
--
-- Alles idempotent.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Spalten
-- ---------------------------------------------------------------------------

alter table public.messages
  add column if not exists shared_post_weg   timestamptz,
  add column if not exists shared_post_konto uuid;

alter table public.community_channel_messages
  add column if not exists shared_post_weg   timestamptz,
  add column if not exists shared_post_konto uuid;

comment on column public.messages.shared_post_weg is
  'Wann der geteilte Beitrag gelöscht wurde (Schema 93). Nur vom Auslöser geteilt_weg_merken gesetzt.';
comment on column public.messages.shared_post_konto is
  'Wem der gelöschte geteilte Beitrag gehörte (Schema 93). Kein Fremdschlüssel, siehe Kopf.';
comment on column public.community_channel_messages.shared_post_weg is
  'Wann der geteilte Beitrag gelöscht wurde (Schema 93). Nur vom Auslöser geteilt_weg_merken gesetzt.';
comment on column public.community_channel_messages.shared_post_konto is
  'Wem der gelöschte geteilte Beitrag gehörte (Schema 93). Kein Fremdschlüssel, siehe Kopf.';

-- ---------------------------------------------------------------------------
-- 2. Beim Löschen eines Beitrags die Spur in den Nachrichten setzen
-- ---------------------------------------------------------------------------

create or replace function public.geteilt_weg_merken()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Läuft als Besitzer: die Nachrichten gehören fremden Konten, die RLS-Regel
  -- „Eigene Nachricht aendern“ ließe den Löschenden sonst nicht heran.
  update public.messages
     set shared_post_weg = now(), shared_post_konto = old.user_id
   where shared_post_id = old.id;
  update public.community_channel_messages
     set shared_post_weg = now(), shared_post_konto = old.user_id
   where shared_post_id = old.id;
  return old;
end;
$$;

revoke all on function public.geteilt_weg_merken() from public, anon, authenticated;

drop trigger if exists geteilt_weg_merken on public.posts;
create trigger geteilt_weg_merken
  before delete on public.posts
  for each row execute function public.geteilt_weg_merken();

-- ---------------------------------------------------------------------------
-- 3. Von außen nicht setzbar
-- ---------------------------------------------------------------------------

create or replace function public.geteilt_weg_schuetzen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Tiefe 1 = direkt vom Client. Tiefe > 1 = aus geteilt_weg_merken().
  if pg_trigger_depth() <= 1 then
    if tg_op = 'INSERT' then
      new.shared_post_weg := null;
      new.shared_post_konto := null;
    else
      new.shared_post_weg := old.shared_post_weg;
      new.shared_post_konto := old.shared_post_konto;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.geteilt_weg_schuetzen() from public, anon, authenticated;

drop trigger if exists geteilt_weg_schuetzen on public.messages;
create trigger geteilt_weg_schuetzen
  before insert or update of shared_post_weg, shared_post_konto on public.messages
  for each row execute function public.geteilt_weg_schuetzen();

drop trigger if exists geteilt_weg_schuetzen on public.community_channel_messages;
create trigger geteilt_weg_schuetzen
  before insert or update of shared_post_weg, shared_post_konto on public.community_channel_messages
  for each row execute function public.geteilt_weg_schuetzen();

-- ---------------------------------------------------------------------------
-- 4. Nachweis — die Verwaltungs-API meldet auch dann Erfolg, wenn nichts
--    passiert ist. Dieser Block rechnet nach und bricht sonst ab.
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['messages', 'community_channel_messages'] loop
    if not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = t and column_name = 'shared_post_weg')
       or not exists (select 1 from information_schema.columns
                    where table_schema = 'public' and table_name = t and column_name = 'shared_post_konto') then
      raise exception 'Spalten shared_post_weg/shared_post_konto fehlen auf %', t;
    end if;
    if not exists (select 1 from pg_trigger
                    where tgname = 'geteilt_weg_schuetzen' and tgrelid = ('public.' || t)::regclass) then
      raise exception 'Auslöser geteilt_weg_schuetzen fehlt auf %', t;
    end if;
  end loop;
  if not exists (select 1 from pg_trigger
                  where tgname = 'geteilt_weg_merken' and tgrelid = 'public.posts'::regclass) then
    raise exception 'Auslöser geteilt_weg_merken fehlt auf posts';
  end if;
  if has_function_privilege('authenticated', 'public.geteilt_weg_merken()', 'EXECUTE')
     or has_function_privilege('anon', 'public.geteilt_weg_merken()', 'EXECUTE')
     or has_function_privilege('anon', 'public.geteilt_weg_schuetzen()', 'EXECUTE') then
    raise exception 'EXECUTE auf geteilt_weg_* ist nicht entzogen';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. NICHT AUSGEFÜHRT — nur nach Henriks Freigabe:
--    Alte Nachrichten, deren Beitrag schon vor diesem Schema gelöscht wurde,
--    sind nur über den Vorschautext zu erraten („Beitrag geteilt“ /
--    „Video geteilt“, ohne Anhang). Das ist eine Vermutung, keine Tatsache —
--    darum auskommentiert. Konto bleibt null (nicht mehr bekannt).
-- ---------------------------------------------------------------------------
-- update public.messages
--    set shared_post_weg = created_at
--  where shared_post_id is null and shared_post_weg is null
--    and text in ('Beitrag geteilt', 'Video geteilt')
--    and media_url is null and anruf_art is null and coalesce(krypto, 0) = 0;
-- update public.community_channel_messages
--    set shared_post_weg = created_at
--  where shared_post_id is null and shared_post_weg is null
--    and text in ('Beitrag geteilt', 'Video geteilt') and media_url is null;
-- Hinweis: pg_trigger_depth() ist hier 1 → geteilt_weg_schuetzen würde den
-- Wert zurücksetzen. Zum Ausführen vorher
--   alter table … disable trigger geteilt_weg_schuetzen; … enable trigger …
