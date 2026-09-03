-- ===========================================================================
--  Siebenundzwanzig Einstellungen, die nichts gespeichert haben
-- ===========================================================================
--
--  In `app/screens/profile/SettingsScreen.tsx` stand es sogar dabei:
--
--      // Der offene Punkt und die getroffenen Auswahlen. Sie gelten fuer
--      // diese Sitzung - dauerhaft speichern kann erst das Backend.
--      const [gewaehlt, setGewaehlt] = useState<Record<string, string>>({});
--
--  Neun Schalter und achtzehn Auswahlen lagen im Bildschirmzustand. Wer
--  „Privates Profil" anschaltete, hatte es beim nächsten Start wieder aus.
--  Auf der Website war es ein Modul-Objekt (`const toggles = {…}`) und damit
--  bis zum nächsten Neuladen. Betroffen war unter anderem:
--
--    Privates Profil · Lesebestätigung · Zwei-Faktor-Anmeldung ·
--    Selbstlöschende Nachrichten · Zuletzt online · Bildschirmsperre ·
--    Ruhezeiten · Wer darf mich zu Gruppen hinzufügen
--
--  Das sind keine Kleinigkeiten. „Privates Profil" ist eine Zusage an den
--  Nutzer, und `profiles.privat` gibt es seit Schema 5 — sie war nur nie
--  angeschlossen.
--
--  Einspielen:
--    node tools/sql-einspielen.mjs SUPABASE_SCHEMA_16_einstellungen.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Teil 1: user_settings
--
--  Eine Zeile je Einstellung statt einer Spalte je Einstellung. Der Grund ist
--  nicht Bequemlichkeit: Einstellungen kommen und gehen mit der Oberfläche,
--  und für jede neue Wahl eine Spalte anzulegen hieße, für jede
--  Beschriftungsänderung eine Wanderung zu schreiben. Was wirklich Bedeutung
--  für die Datenbank hat — `profiles.privat`, die Sichtbarkeitsstufen — steht
--  weiterhin in eigenen Spalten und Tabellen.
--
--  Der Schlüssel ist bewusst ein technischer Name (`toene`, `zwei_faktor`)
--  und nicht die Beschriftung. Eine Beschriftung ist Text für Menschen; sie
--  wird umformuliert, und dann wäre die Einstellung verloren.
-- ---------------------------------------------------------------------------

create table if not exists public.user_settings (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  schluessel text not null,
  wert       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, schluessel),
  -- Ein leerer Schlüssel wäre ein Schreibfehler, kein Wunsch.
  check (length(schluessel) between 1 and 60)
);

alter table public.user_settings enable row level security;

/*
 * Die eigenen Einstellungen sind privat — anders als etwa `follows`, das für
 * alle Angemeldeten lesbar ist. Ob jemand die Lesebestätigung abgeschaltet
 * hat, geht niemanden sonst etwas an; und eine Regel, die es doch verrät,
 * ist später schwer zurückzunehmen.
 */
drop policy if exists "Eigene Einstellungen" on public.user_settings;
create policy "Eigene Einstellungen" on public.user_settings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

comment on table public.user_settings is
  'Schalter und Auswahlen aus den Einstellungen. Ein Schluessel je Zeile, '
  'damit eine neue Einstellung keine Wanderung braucht. Alles, was fuer die '
  'Datenbank selbst Bedeutung hat, steht weiterhin in eigenen Spalten.';


-- ---------------------------------------------------------------------------
--  Teil 2: profile_views
--
--  „Wie viele Aufrufe hatte mein Profil in den letzten Wochen?" ließ sich
--  bisher nicht beantworten, und zwar nicht, weil es niemand programmiert
--  hätte, sondern weil nichts gemessen wurde. `posts.views` ist ein
--  Zählerstand ohne Verlauf: man kann daraus den Stand von heute lesen, nie
--  den von letzter Woche.
--
--  Deshalb hier eine Zeile je Aufruf mit Zeitpunkt. Wer sich sein eigenes
--  Profil ansieht, zählt nicht — sonst wäre die eigene Nutzung die halbe
--  Statistik.
-- ---------------------------------------------------------------------------

create table if not exists public.profile_views (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (profile_id <> viewer_id)
);

create index if not exists profile_views_nach_profil
  on public.profile_views (profile_id, created_at desc);

alter table public.profile_views enable row level security;

/*
 * Sehen darf die Aufrufe nur, wem das Profil gehört. Ein Aufruf ist eine
 * Beobachtung über andere Menschen — wer wann wen angesehen hat. Sichtbar
 * wird davon nur die eigene Zahl, nie eine fremde und nie ein Name.
 */
drop policy if exists "Eigene Profilaufrufe lesen" on public.profile_views;
create policy "Eigene Profilaufrufe lesen" on public.profile_views
  for select to authenticated
  using (auth.uid() = profile_id);

/*
 * Schreiben darf jeder — aber nur den eigenen Aufruf. `viewer_id` muss man
 * selbst sein, sonst könnte man fremden Profilen Aufrufe andichten.
 */
drop policy if exists "Eigenen Aufruf vermerken" on public.profile_views;
create policy "Eigenen Aufruf vermerken" on public.profile_views
  for insert to authenticated
  with check (auth.uid() = viewer_id);

comment on table public.profile_views is
  'Ein Aufruf eines fremden Profils, mit Zeitpunkt. Nur der Profilinhaber '
  'liest sie, und auch er sieht in der Oberflaeche nur Zahlen, keine Namen.';


-- ---------------------------------------------------------------------------
--  Teil 3: die Statistik als Sicht
--
--  Die Rechnung gehört in die Datenbank und nicht zweimal in den Code — sonst
--  liefern App und Website unterschiedliche Zahlen, sobald einer von beiden
--  angefasst wird. Genau dieser Fall ist am 02.09.2026 bei der Insight-Streak
--  vermieden worden, und aus demselben Grund hier noch einmal.
-- ---------------------------------------------------------------------------

create or replace view public.profil_statistik as
  select
    p.id,
    (select count(*) from public.posts b where b.user_id = p.id)          as beitraege,
    (select coalesce(sum(b.views), 0) from public.posts b
      where b.user_id = p.id)                                             as aufrufe_beitraege,
    (select count(*) from public.follows f where f.followee_id = p.id)    as follower,
    (select count(*) from public.follows f
      where f.followee_id = p.id
        and f.created_at >= now() - interval '30 days')                   as follower_30,
    (select count(*) from public.follows f
      where f.followee_id = p.id
        and f.created_at >= now() - interval '7 days')                    as follower_7,
    (select count(*) from public.profile_views v where v.profile_id = p.id) as profilaufrufe,
    (select count(*) from public.profile_views v
      where v.profile_id = p.id
        and v.created_at >= now() - interval '30 days')                   as profilaufrufe_30,
    (select count(*) from public.profile_views v
      where v.profile_id = p.id
        and v.created_at >= now() - interval '7 days')                    as profilaufrufe_7,
    (select count(distinct v.viewer_id) from public.profile_views v
      where v.profile_id = p.id
        and v.created_at >= now() - interval '30 days')                   as besucher_30
  from public.profiles p;

/*
 * Die Sicht erbt die Regeln der Tabellen darunter nicht automatisch —
 * `security_invoker` sorgt dafür, dass sie mit den Rechten des Fragenden
 * läuft. Ohne das könnte jeder die Profilaufrufe jedes anderen zählen.
 */
alter view public.profil_statistik set (security_invoker = true);

grant select on public.profil_statistik to authenticated;


-- ---------------------------------------------------------------------------
--  Teil 4: zuruecksetzen() kennt die beiden neuen Tabellen
--
--  Nach jedem Schema, das Tabellen anlegt, gehört die Funktion erweitert.
--  Am 02.09.2026 hat genau das gefehlt und siebzehn falsche Fehler in sechs
--  Prüfläufen gekostet: ein Umschalter, den Lauf 1 setzt und niemand
--  abräumt, nimmt Lauf 2 wieder weg.
-- ---------------------------------------------------------------------------

create or replace function public.zuruecksetzen_einstellungen(ziel uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  delete from public.user_settings where user_id = ziel;
  delete from public.profile_views where profile_id = ziel or viewer_id = ziel;
end;
$$;

grant execute on function public.zuruecksetzen_einstellungen(uuid) to authenticated;

/*
 * Und in die große Funktion einhängen. Sie steht in
 * SUPABASE_SCHEMA_13_zuruecksetzen_handbuch.sql; hier wird nur der neue
 * Aufruf ergänzt, damit die eine Stelle nicht in zwei Dateien abweicht.
 */
do $$
declare
  quelle text;
begin
  select pg_get_functiondef(p.oid) into quelle
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'zuruecksetzen'
   limit 1;

  if quelle is null then
    raise notice 'zuruecksetzen() gibt es nicht — nichts einzuhaengen.';
    return;
  end if;

  if quelle like '%zuruecksetzen_einstellungen%' then
    raise notice 'zuruecksetzen() ruft die Einstellungen schon ab.';
    return;
  end if;

  -- Vor der ersten Zeile, die Profilfelder zuruecksetzt: dort ist das Ende
  -- des Loeschteils, und die neuen Tabellen gehoeren dazu.
  quelle := replace(
    quelle,
    '  -- Profilfelder auf den Stand nach der Registrierung.',
    '  -- Einstellungen und Profilaufrufe (Schema 16).' || chr(10) ||
    '  perform public.zuruecksetzen_einstellungen(ziel);' || chr(10) || chr(10) ||
    '  -- Profilfelder auf den Stand nach der Registrierung.'
  );

  if quelle not like '%zuruecksetzen_einstellungen%' then
    raise exception 'Die Ankerzeile in zuruecksetzen() hat sich geaendert — bitte von Hand einhaengen.';
  end if;

  execute quelle;
  raise notice 'zuruecksetzen() kennt jetzt user_settings und profile_views.';
end;
$$;
