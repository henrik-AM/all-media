-- =====================================================================
-- SUPABASE_SCHEMA_118_medienadresse_host.sql — 05.11.2026
--
-- Codex-Review 05.11.2026 (Kasten live-medienadresse): fremde Adresse im
-- Profilbild und im Titelbild.
--
-- Die CHECKs `profiles_avatar_url_eimer` (Schema 69) und
-- `sammlungen_titelbild_eimer` (Schema 70) prüfen nur das PFADENDE:
--   avatar_url    ~ '/storage/v1/object/public/media/avatars/[A-Za-z0-9._-]+$'
--   titelbild_url ~ '/storage/v1/object/public/media/(stories|posts)/[A-Za-z0-9._-]+$'
-- Eine Adresse wie https://boese.example/storage/v1/object/public/media/avatars/x.png
-- ging durch. Die Auslöser `medienreferenz_pruefen` (117) und
-- `bunny_referenz_pruefen` (115) überspringen Adressen, für die
-- `medien_adresse_gueltig()` false liefert ("Fremde Formen weist schon der
-- CHECK ab" — für diese beiden Spalten stimmte das nicht). Ergebnis: eine
-- fremde Tracking-Adresse als Profil-/Titelbild, die jeder Betrachter lädt.
--
-- Jetzt: beide CHECKs zusätzlich mit `public.medien_adresse_gueltig(...)`
-- (Schema 23/95: eigener Projekt-Host, Ordner, Dateiname, kein ?/#) —
-- Muster wie `kontakt_bilder_eimer` (Paket 1, Schema 94).
--
-- Live-Stand 05.11.2026 (nur lesend geprüft):
--   * profiles.avatar_url: 0 Zeilen gesetzt, 0 verletzen die neue Regel.
--   * sammlungen.titelbild_url: 0 Zeilen gesetzt, 0 verletzen.
--   * Alle übrigen Medienspalten (posts.media_url/thumbnail_url,
--     stories, messages, insights, ptt_messages, community_channel_messages)
--     tragen schon `<tabelle>_<spalte>_eigener_eimer` = medien_adresse_gueltig.
--   * sounds.audio_url/cover_url, vorlage_eigene_*: keine Schreibregel für
--     authenticated (nur SELECT-Regeln) — Clients können sie nicht setzen.
--   * Bunny-Adressen stehen in derselben Supabase-Form (bunny.js, dauerBasis);
--     keine andere Form im Bestand.
--   * communities.bild_url und kontakt_bilder gibt es live noch nicht; ihre
--     CHECKs mit medien_adresse_gueltig bringen Schema 99 (Paket 3) und 94
--     (Paket 1) selbst mit.
--
-- Sicher gegen Altbestand: Der CHECK wird `not valid` angelegt (gilt sofort
-- für jede neue/geänderte Zeile) und danach validiert. Verletzt eine alte
-- Zeile die Regel, bleibt er `not valid` und es gibt nur einen Hinweis —
-- das Einspielen scheitert nicht. Bereinigung dann nur mit Henriks Ja
-- (auskommentierter Block unten).
--
-- Ersetzt keine Funktion. Hängt ab von `medien_adresse_gueltig` (23/95).
-- Idempotent, ohne begin/commit.
-- =====================================================================

do $$
begin
  alter table public.profiles drop constraint if exists profiles_avatar_url_eimer;
  alter table public.profiles add constraint profiles_avatar_url_eimer check (
    avatar_url is null
    or (avatar_url ~ '/storage/v1/object/public/media/avatars/[A-Za-z0-9._-]+$'
        and public.medien_adresse_gueltig(avatar_url))
  ) not valid;
  begin
    alter table public.profiles validate constraint profiles_avatar_url_eimer;
  exception when check_violation then
    raise notice 'Schema 118: profiles_avatar_url_eimer bleibt NOT VALID — Altbestand verletzt die Regel (siehe Nachweis unten).';
  end;
end $$;

do $$
begin
  alter table public.sammlungen drop constraint if exists sammlungen_titelbild_eimer;
  alter table public.sammlungen add constraint sammlungen_titelbild_eimer check (
    titelbild_url is null
    or (titelbild_url ~ '/storage/v1/object/public/media/(stories|posts)/[A-Za-z0-9._-]+$'
        and public.medien_adresse_gueltig(titelbild_url))
  ) not valid;
  begin
    alter table public.sammlungen validate constraint sammlungen_titelbild_eimer;
  exception when check_violation then
    raise notice 'Schema 118: sammlungen_titelbild_eimer bleibt NOT VALID — Altbestand verletzt die Regel (siehe Nachweis unten).';
  end;
end $$;

-- ---------------------------------------------------------------------
-- Bereinigung (NUR mit Henriks Ja, sonst auskommentiert lassen):
-- fremde Adressen entfernen, danach die CHECKs validieren.
-- ---------------------------------------------------------------------
-- update public.profiles set avatar_url = null
--  where avatar_url is not null and not public.medien_adresse_gueltig(avatar_url);
-- update public.sammlungen set titelbild_url = null
--  where titelbild_url is not null and not public.medien_adresse_gueltig(titelbild_url);
-- alter table public.profiles validate constraint profiles_avatar_url_eimer;
-- alter table public.sammlungen validate constraint sammlungen_titelbild_eimer;

-- ---------------------------------------------------------------------
-- Nachweis (nur lesend): beide CHECKs kennen medien_adresse_gueltig und
-- sind validiert; kein Altbestand verletzt sie.
-- ---------------------------------------------------------------------
select conrelid::regclass as tabelle, conname, convalidated,
       pg_get_constraintdef(oid) ilike '%medien_adresse_gueltig%' as mit_host
  from pg_constraint
 where conname in ('profiles_avatar_url_eimer', 'sammlungen_titelbild_eimer');

select 'profiles' as tabelle, count(*) as verletzt
  from public.profiles
 where avatar_url is not null and not public.medien_adresse_gueltig(avatar_url)
union all
select 'sammlungen', count(*)
  from public.sammlungen
 where titelbild_url is not null and not public.medien_adresse_gueltig(titelbild_url);
