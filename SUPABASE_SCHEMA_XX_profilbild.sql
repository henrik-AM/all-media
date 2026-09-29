-- ===========================================================================
-- Schema XX (Entwurf): Profilbild (29.09.2026, Kasten 12.5)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: „‚Profil bearbeiten' braucht die Funktion, ein neues
-- Profilbild hinzuzufügen."
--
-- Befund: Ein Profilbild gab es in der Datenbank nie. `profiles` kennt nur
-- `initials` und `color`; `avatar_url` stand allein in
-- app/lib/supabaseTypes.ts, in keinem Schema. Die Website legte ein
-- gewähltes Bild in den localStorage des Browsers (PROFILBILD_SPEICHER) —
-- sichtbar nur in genau diesem Browser, nie in der App, nie für andere.
--
-- NEU
--
--   profiles.avatar_url   Bestaendige Form der Adresse im Eimer `media`
--                         (…/object/public/media/avatars/<id>-….jpg).
--                         Ausgeliefert wird sie nur unterschrieben
--                         (web/server/medien.js, app/lib/medien.ts) — der
--                         Eimer ist seit Schema 23 nicht öffentlich.
--
-- RECHTE
--
-- `profiles` hat seit Schema 23 spaltenweise Rechte: `revoke select … from
-- authenticated` und eine Liste freigegebener Spalten. Eine neue Spalte ist
-- darum für niemanden lesbar, bis sie ausdrücklich freigegeben wird.
--
-- ACHTUNG: Wer SUPABASE_SCHEMA_23_audit.sql später noch einmal einspielt,
-- nimmt mit dessen `revoke select` auch diese beiden Freigaben wieder weg
-- (dasselbe gilt für story_in_videos aus Schema 30). Dann diese Datei danach
-- erneut einspielen.
--
-- Nur Adressen aus dem eigenen Eimer: die Prüfung unten verhindert, dass
-- jemand eine fremde Webadresse als Profilbild einträgt, die dann bei jedem
-- Betrachter geladen würde (Tracking-Pixel).
--
-- Alles idempotent.
-- ===========================================================================

alter table public.profiles add column if not exists avatar_url text;

alter table public.profiles drop constraint if exists profiles_avatar_url_eimer;
alter table public.profiles add constraint profiles_avatar_url_eimer check (
  avatar_url is null
  or avatar_url ~ '/storage/v1/object/public/media/avatars/[A-Za-z0-9._-]+$'
);

grant select (avatar_url) on public.profiles to authenticated;
grant update (avatar_url) on public.profiles to authenticated;

-- Die Regel „Profil ändern nur für sich selbst" gilt unverändert für die
-- neue Spalte — sie hängt an der Zeile, nicht an der Spalte. Keine neue
-- RLS-Regel nötig.

-- ---------------------------------------------------------------------------
--  Testbestand: das Testkonto bekommt KEIN Bild vorgegeben. Ein Prüflauf
--  setzt und entfernt es selbst (app/test/_kasten12.js), und nur bei
--  ist_testkonto().
-- ---------------------------------------------------------------------------
