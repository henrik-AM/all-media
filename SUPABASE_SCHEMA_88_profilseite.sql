-- ===========================================================================
-- Schema 88 (ENTWURF, noch nicht eingespielt — Supabase-Sperre seit 10.10.2026)
-- Seite „Profil bearbeiten“: Pronomen und bis zu fünf Links
-- (Kasten 1.3, Nachtrag 10.10.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 10.10.2026: „deutlich mehr Freiraum“ beim Profil bearbeiten,
-- „orientiere dich an Instagram und entscheide selbst“. Die neue Seite hat
-- Profilbild, Name, Benutzername, Pronomen, Biografie und Links. Name,
-- Biografie, Benutzername und Bild gibt es schon; neu sind:
--
--   profiles.pronomen   text, freiwillig, höchstens 30 Zeichen, eine Zeile.
--   profiles.links      jsonb, Liste aus höchstens 5 Einträgen
--                       { "url": "https://…", "titel": "…" }, url nur
--                       http/https mit Rechnernamen, Titel ≤ 40 Zeichen.
--
-- Dieselben Grenzen prüft gemeinsam/profilfelder.js in App und Website.
--
-- ALTE LESER UND SCHREIBER: profiles.link BLEIBT
--
-- `link` ist ab hier immer die Adresse des ersten Links. Der Trigger
-- `profil_links_abgleichen` hält beide Spalten gleich:
--   * wer `links` schreibt (neue Seite), bekommt `link` = links[0].url;
--   * wer nur `link` schreibt (alte App-Stände, altes Formular), ersetzt den
--     ersten Eintrag von `links` und behält die übrigen; ein geleertes
--     `link` leert die Liste.
-- So zeigt ein noch nicht aktualisiertes Gerät weiter den ersten Link, und
-- ein altes Formular zerstört keine fünf Links still.
--
-- RECHTE
--
-- `profiles` hat seit Schema 23 spaltenweise Rechte. Eine neue Spalte ist für
-- `authenticated` unlesbar, bis sie hier freigegeben wird — und ein select,
-- das sie nennt, scheitert dann GANZ (nicht nur die Spalte). Deshalb laden
-- App und Website die beiden Spalten getrennt und nachsichtig
-- (ladeProfilZusatz in app/lib/daten.ts, profilZusatz in
-- web/server/supabase-api.js), wie die Profilbilder aus Schema 69.
--
-- ACHTUNG: Wer SUPABASE_SCHEMA_23_audit.sql später noch einmal einspielt,
-- nimmt mit dessen `revoke select … from authenticated` auch diese
-- Freigaben wieder weg (wie bei Schema 30 und 69). Danach diese Datei erneut
-- einspielen.
--
-- `mein_profil()` (Schema 23_audit) und `meine_daten()` (Schema 23_sicherheit)
-- liefern die ganze Zeile per to_jsonb(p) — sie nehmen die neuen Spalten
-- ohne Änderung mit. `handle_aendern()` (Schema 4) bleibt unverändert; die
-- Seite speichert den Benutzernamen darüber.
--
-- ERSETZT / ÄNDERT
--
--   * zuruecksetzen()  — am Anker umgeschrieben (wie Schema 62/85/87), keine
--                        neue Vollfassung: setzt beim Testkonto auch
--                        pronomen = null und links = '[]' zurück.
--   * Neu: profil_links_gueltig(jsonb), profil_links_abgleichen() + Trigger.
--   Keine bestehende Funktion wird als Ganzes ersetzt.
--
-- Alles idempotent.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. Spalten
-- ---------------------------------------------------------------------------

alter table public.profiles add column if not exists pronomen text;
alter table public.profiles add column if not exists links jsonb not null default '[]'::jsonb;

alter table public.profiles drop constraint if exists profiles_pronomen_laenge;
alter table public.profiles add constraint profiles_pronomen_laenge check (
  pronomen is null
  or (char_length(pronomen) <= 30 and pronomen !~ '[\r\n]')
);


-- ---------------------------------------------------------------------------
-- 2. Was ein gültiger Linkeintrag ist
-- ---------------------------------------------------------------------------
-- Eine Funktion, weil ein Check keine Unterabfrage enthalten darf.
-- Gleiche Regel: gemeinsam/profilfelder.js (adresse, linksPruefen).

create or replace function public.profil_links_gueltig(l jsonb)
returns boolean
language sql
immutable
set search_path = public
as $$
  select l is null or (
    jsonb_typeof(l) = 'array'
    and jsonb_array_length(l) <= 5
    and not exists (
      select 1
        from jsonb_array_elements(l) as e(eintrag)
       where jsonb_typeof(e.eintrag) <> 'object'
          or coalesce(e.eintrag->>'url', '') !~* '^https?://[^[:space:]/?#@]+\.[^[:space:]/?#@]+'
          or char_length(e.eintrag->>'url') > 300
          or char_length(coalesce(e.eintrag->>'titel', '')) > 40
    )
  );
$$;

revoke execute on function public.profil_links_gueltig(jsonb) from public, anon;
grant execute on function public.profil_links_gueltig(jsonb) to authenticated, service_role;

alter table public.profiles drop constraint if exists profiles_links_gueltig;
alter table public.profiles add constraint profiles_links_gueltig check (public.profil_links_gueltig(links));


-- ---------------------------------------------------------------------------
-- 3. `link` und `links` gleich halten
-- ---------------------------------------------------------------------------
-- Name beginnt mit „profil_l…“: BEFORE-Trigger laufen in Namensfolge, dieser
-- also vor `profil_vervollstaendigen_trigger`.

create or replace function public.profil_links_abgleichen()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  einzel text;
  rest   jsonb;
begin
  if new.links is null then
    new.links := '[]'::jsonb;
  end if;

  if tg_op = 'INSERT' then
    if jsonb_array_length(new.links) > 0 then
      new.link := new.links->0->>'url';
    end if;
    return new;
  end if;

  if new.links is distinct from old.links then
    -- Die neue Seite hat geschrieben: der erste Link ist der Einzellink.
    new.link := coalesce(new.links->0->>'url', '');
  elsif new.link is distinct from old.link then
    -- Ein alter Schreiber kennt nur `link`.
    einzel := btrim(coalesce(new.link, ''));
    if einzel = '' then
      new.links := '[]'::jsonb;
    else
      if einzel !~* '^[a-z][a-z0-9+.-]*:' then
        einzel := 'https://' || einzel;
      end if;
      rest := case when jsonb_array_length(coalesce(old.links, '[]'::jsonb)) > 1
                   then old.links - 0 else '[]'::jsonb end;
      if public.profil_links_gueltig(jsonb_build_array(jsonb_build_object('url', einzel, 'titel', ''))) then
        new.links := jsonb_build_array(jsonb_build_object('url', einzel, 'titel', '')) || rest;
        new.link := einzel;
      else
        -- Keine gültige Webadresse (z. B. alter Freitext): die Liste nicht
        -- mit Unsinn füllen; `link` bleibt, wie der alte Schreiber es wollte.
        new.links := rest;
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.profil_links_abgleichen() from public, anon;

drop trigger if exists profil_links_abgleichen on public.profiles;
create trigger profil_links_abgleichen
  before insert or update of link, links on public.profiles
  for each row execute function public.profil_links_abgleichen();


-- ---------------------------------------------------------------------------
-- 4. Spaltenrechte (wie Schema 69)
-- ---------------------------------------------------------------------------
-- Die Regel „Profil ändern nur für sich selbst“ hängt an der Zeile, nicht an
-- der Spalte — keine neue RLS-Regel nötig. Keine neue Tabelle, also auch
-- keine `nur_freigegebene`-Regel (Schema 74).

grant select (pronomen, links) on public.profiles to authenticated;
grant update (pronomen, links) on public.profiles to authenticated;


-- ---------------------------------------------------------------------------
-- 5. zuruecksetzen(): Testkonto bekommt auch Pronomen und Links zurück
-- ---------------------------------------------------------------------------
-- Am Anker aus Schema 47 (Profilfelder auf den Stand nach der Registrierung),
-- keine neue Vollfassung. zuruecksetzen() wirkt seit Schema 62 nur für
-- ist_testkonto() — echte Konten bleiben unberührt.

do $$
declare
  quelle text;
  anker  constant text := '         geburtsdatum = null' || chr(10) || '   where id = ziel;';
begin
  select pg_get_functiondef('public.zuruecksetzen'::regproc) into quelle;
  if quelle like '%pronomen = null%' then
    raise notice 'zuruecksetzen() setzt Pronomen und Links schon zurück.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in zuruecksetzen() nicht gefunden — bitte von Hand anpassen.';
  end if;
  quelle := replace(quelle, anker,
    '         geburtsdatum = null,' || chr(10) ||
    '         pronomen = null, links = ''[]''::jsonb  -- Schema 88' || chr(10) ||
    '   where id = ziel;');
  execute quelle;
end;
$$;


-- ---------------------------------------------------------------------------
-- 6. Nachweis — die Verwaltungs-API meldet auch dann Erfolg, wenn nichts
--    passiert ist. Dieser Block rechnet nach und bricht sonst ab.
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'pronomen') then
    raise exception 'Spalte profiles.pronomen fehlt';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'profiles' and column_name = 'links') then
    raise exception 'Spalte profiles.links fehlt';
  end if;
  if not has_column_privilege('authenticated', 'public.profiles', 'pronomen', 'SELECT')
     or not has_column_privilege('authenticated', 'public.profiles', 'links', 'SELECT')
     or not has_column_privilege('authenticated', 'public.profiles', 'pronomen', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'links', 'UPDATE') then
    raise exception 'Spaltenrechte für pronomen/links fehlen';
  end if;
  if has_function_privilege('anon', 'public.profil_links_gueltig(jsonb)', 'EXECUTE') then
    raise exception 'profil_links_gueltig() ist für anon ausführbar';
  end if;
  if not public.profil_links_gueltig('[{"url":"https://a.de","titel":"A"}]'::jsonb)
     or public.profil_links_gueltig('[{"url":"javascript:alert(1)"}]'::jsonb)
     or public.profil_links_gueltig('[{"url":"https://a.de"},{"url":"https://b.de"},{"url":"https://c.de"},{"url":"https://d.de"},{"url":"https://e.de"},{"url":"https://f.de"}]'::jsonb) then
    raise exception 'profil_links_gueltig() rechnet falsch';
  end if;
  if not exists (select 1 from pg_trigger
                  where tgname = 'profil_links_abgleichen' and tgrelid = 'public.profiles'::regclass) then
    raise exception 'Trigger profil_links_abgleichen fehlt';
  end if;
  if pg_get_functiondef('public.zuruecksetzen'::regproc) not like '%pronomen = null%' then
    raise exception 'zuruecksetzen() setzt Pronomen nicht zurück';
  end if;
end;
$$;

-- PostgREST soll die neuen Spalten sofort kennen.
notify pgrst, 'reload schema';
