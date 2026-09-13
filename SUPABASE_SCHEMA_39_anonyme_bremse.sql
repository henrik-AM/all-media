-- ===========================================================================
--  SUPABASE_SCHEMA_39_anonyme_bremse.sql — Bremse fuer die zwei offenen Tueren
--  13.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Schema 37 hat alle Datenbankfunktionen fuer `anon` gesperrt — bis auf zwei,
--  die offen bleiben MUESSEN:
--
--    handle_frei(text)   Ist dieser Benutzername noch frei?
--    nummer_frei(text)   Gehoert diese Telefonnummer schon zu einem Konto?
--
--  Beide braucht die Registrierung, und dort ist noch niemand angemeldet. Sie
--  geben nur ja/nein zurueck, keine Identitaet — deshalb waren sie in Schema 37
--  vertretbar. Vertretbar heisst aber nicht folgenlos: wer eine Nummernliste
--  hat, kann sie Stueck fuer Stueck danach sortieren, welche Nummern ein Konto
--  bei All Media haben. Das ist ein Bit je Nummer, aber ueber Millionen
--  Abfragen ein Verzeichnis.
--
--  Schema 38 hat dasselbe fuer `finde_per_nummer` geloest — dort ueber
--  `auth.uid()`. Hier geht das nicht: es gibt keine Anmeldung, an der man
--  zaehlen koennte.
--
--  WAS STATTDESSEN GEZAEHLT WIRD
--
--  PostgREST reicht die Kopfzeilen der HTTP-Anfrage an Postgres durch. Am
--  13.09.2026 mit einer Wegwerf-Funktion nachgemessen, anonym aufgerufen:
--
--      {"headers_da": true, "cf": "109.41.51.237", "xff": "109.41.51.237"}
--
--  Die Datenbank sieht also die echte Absender-Adresse (Supabase steht hinter
--  Cloudflare, daher `cf-connecting-ip`). Daran laesst sich zaehlen.
--
--  DREISSIG JE STUNDE UND ANSCHLUSS
--
--  Beide Funktionen werden nur beim Absenden des Registrierungsformulars
--  aufgerufen, nicht bei jedem Tastendruck (geprueft: keine Entprellung noetig,
--  `registrieren()` in web/public/anmeldung.js ruft sie genau einmal). Dreissig
--  Versuche je Stunde sind fuer einen Menschen unerreichbar viel — auch fuer
--  mehrere Menschen hinter demselben Anschluss, was bei Mobilfunk (CGNAT),
--  Schulen und Buueros der Normalfall ist. Fuer ein Verzeichnis sind dreissig
--  nichts.
--
--  DATENSCHUTZ: IP-ADRESSEN SIND PERSONENBEZOGEN
--
--  Deshalb steht in der Tabelle das Noetigste und nichts sonst: Adresse,
--  welche der beiden Funktionen, Zeitpunkt. **Nicht** die gepruefte Nummer und
--  **nicht** der gepruefte Benutzername — sonst entstuende hier ein Protokoll
--  darueber, wer sich wofuer interessiert, und das waere schlimmer als das
--  Problem.
--
--  Jeder Aufruf raeumt ausserdem ALLE Zeilen weg, die aelter als das Fenster
--  sind — nicht nur die eigenen. Damit liegt keine Adresse laenger als eine
--  Stunde in der Tabelle, ohne dass irgendwo ein Aufraeumauftrag laufen muss.
--
--  WARUM EIN RUECKGABEWERT UND KEINE AUSNAHME
--
--  Schema 38 wirft bei `finde_per_nummer` eine Ausnahme — und genau daran
--  haette sich fast ein Loch aufgetan, weil zwei Aufrufer den Fehlerwert
--  weggeworfen haben. Hier geben beide Funktionen ohnehin
--  `{frei, grund, meldung}` zurueck, und beide Aufrufer lesen `frei` aus:
--
--    web/public/anmeldung.js  if (!pruefung.frei) return { ok:false, ... }
--    app/screens/LoginScreen  if (frei && frei.frei === false) setError(...)
--
--  `frei: false` heisst „nicht weitermachen". Die Bremse faellt damit von
--  selbst auf die sichere Seite, auch wenn jemand den Rueckgabewert nur halb
--  auswertet.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_39_anonyme_bremse.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Der Zaehler.
--
--  `kennung` statt `ip`: was drinsteht, ist eine Absenderkennung, und wenn
--  Supabase morgen eine andere Kopfzeile schickt, muss der Spaltenname nicht
--  luegen.
-- ---------------------------------------------------------------------------
create table if not exists public.anon_takt (
  id      bigint generated always as identity primary key,
  kennung text        not null,
  art     text        not null,
  zeit    timestamptz not null default now()
);

create index if not exists anon_takt_kennung_art_zeit
  on public.anon_takt (kennung, art, zeit desc);

-- Fuer das Aufraeumen ueber alle Zeilen hinweg.
create index if not exists anon_takt_zeit on public.anon_takt (zeit);

-- Wie bei `nummer_suche_takt` (Schema 38): RLS ohne eine einzige Regel heisst,
-- von aussen kommt nichts zurueck. Nur die `security definer`-Funktionen unten
-- kommen hinein.
alter table public.anon_takt enable row level security;
revoke all on public.anon_takt from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  Wer fragt gerade?
--
--  Supabase steht hinter Cloudflare, deshalb zuerst `cf-connecting-ip`. Danach
--  der erste Eintrag aus `x-forwarded-for` — der erste ist der urspruengliche
--  Absender, die weiteren sind Zwischenstationen.
-- ---------------------------------------------------------------------------
create or replace function public.anfrage_ip()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    nullif(current_setting('request.headers', true)::json ->> 'cf-connecting-ip', ''),
    nullif(
      split_part(
        coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''),
        ',', 1
      ), ''
    ),
    'unbekannt'
  );
$$;

-- Schema 37 laesst gruessen: eine neue Funktion bekommt EXECUTE automatisch an
-- PUBLIC. Sie wird nur von den Funktionen unten benutzt, die als `definer`
-- laufen — von aussen hat niemand etwas damit zu tun.
revoke execute on function public.anfrage_ip() from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  Die Bremse selbst. Gibt `true` zurueck, wenn der Aufruf noch erlaubt ist.
-- ---------------------------------------------------------------------------
create or replace function public.takt_pruefen(
  p_art     text,
  p_grenze  integer,
  p_fenster interval
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ip     text := public.anfrage_ip();
  bisher integer;
begin
  /*
   * Keine Kennung, keine Bremse.
   *
   * Absichtlich fail-open: fehlt die Kopfzeile einmal — anderer Zugangsweg,
   * Aenderung bei Supabase —, dann landen alle Anfragen unter derselben
   * Kennung und die Registrierung waere fuer ALLE nach dreissig Versuchen
   * dicht. Eine Bremse, die im Zweifel die eigenen Nutzer aussperrt, wird
   * abgeschaltet und schuetzt danach gar nicht mehr.
   */
  if ip = 'unbekannt' then
    return true;
  end if;

  -- Alles Alte weg, nicht nur das eigene: so liegt keine Adresse laenger als
  -- das Fenster in der Tabelle.
  delete from public.anon_takt where zeit < now() - p_fenster;

  select count(*) into bisher
    from public.anon_takt
   where kennung = ip
     and art = p_art;

  if bisher >= p_grenze then
    return false;
  end if;

  insert into public.anon_takt (kennung, art) values (ip, p_art);
  return true;
end;
$$;

revoke execute on function public.takt_pruefen(text, integer, interval)
  from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  Ist diese Telefonnummer noch frei?
--
--  Unveraendert gegenueber Schema 34 bis auf die Bremse oben drauf. `stable`
--  faellt weg — die Funktion schreibt jetzt (den Zaehler), und `stable` waere
--  gelogen.
-- ---------------------------------------------------------------------------
create or replace function public.nummer_frei(eingabe text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  gesucht text := public.nummer_vergleichsform(eingabe);
begin
  if not public.takt_pruefen('nummer_frei', 30, interval '1 hour') then
    return jsonb_build_object(
      'frei', false,
      'grund', 'zu_viele',
      'meldung', 'Zu viele Prüfungen von diesem Anschluss. Bitte versuche es später noch einmal.'
    );
  end if;

  -- Dieselbe Untergrenze wie in finde_per_nummer: kuerzere Eingaben passen auf
  -- halbe Nummern und machten aus der Frage ein Rateverfahren.
  if length(gesucht) < 6 then
    return jsonb_build_object(
      'frei', false,
      'grund', 'ungueltig',
      'meldung', 'Die Nummer ist zu kurz.'
    );
  end if;

  if exists (
    select 1
      from public.profiles p
     where p.phone is not null
       and p.phone <> ''
       and public.nummer_vergleichsform(p.phone) = gesucht
  ) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'vergeben',
      'meldung', 'Diese Telefonnummer gehört schon zu einem Konto.'
    );
  end if;

  return jsonb_build_object('frei', true);
end;
$$;

comment on function public.nummer_frei(text) is
  'Ja/Nein, ob eine Telefonnummer schon zu einem Konto gehoert. Fuer die Registrierung, deshalb auch ohne Anmeldung. Gebremst auf 30 je Stunde und Anschluss (Schema 39).';

revoke all on function public.nummer_frei(text) from public;
grant execute on function public.nummer_frei(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
--  Ist dieser Benutzername noch frei? Gleiche Bauart.
-- ---------------------------------------------------------------------------
create or replace function public.handle_frei(eingabe text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
begin
  if not public.takt_pruefen('handle_frei', 30, interval '1 hour') then
    return jsonb_build_object(
      'frei', false,
      'grund', 'zu_viele',
      'meldung', 'Zu viele Prüfungen von diesem Anschluss. Bitte versuche es später noch einmal.'
    );
  end if;

  if not public.handle_gueltig(v_name) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'ungueltig',
      'meldung', 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.'
    );
  end if;

  if exists (select 1 from public.profiles where handle = '@' || v_name) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'vergeben',
      'meldung', 'Dieser Benutzername ist schon vergeben.'
    );
  end if;

  return jsonb_build_object('frei', true, 'handle', '@' || v_name);
end;
$$;

comment on function public.handle_frei(text) is
  'Ja/Nein, ob ein Benutzername frei ist. Fuer die Registrierung, deshalb auch ohne Anmeldung. Gebremst auf 30 je Stunde und Anschluss (Schema 39).';

revoke all on function public.handle_frei(text) from public;
grant execute on function public.handle_frei(text) to anon, authenticated;


-- ---------------------------------------------------------------------------
--  Kontrolle: die zwei duerfen anonym, die zwei neuen Helfer nicht.
-- ---------------------------------------------------------------------------
select
  has_function_privilege('anon', 'public.nummer_frei(text)', 'execute')  as nummer_frei_anon,
  has_function_privilege('anon', 'public.handle_frei(text)', 'execute')  as handle_frei_anon,
  has_function_privilege('anon', 'public.anfrage_ip()', 'execute')       as anfrage_ip_anon,
  has_function_privilege('anon', 'public.takt_pruefen(text, integer, interval)', 'execute')
                                                                        as takt_pruefen_anon;
