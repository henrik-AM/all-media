-- ===========================================================================
--  SUPABASE_SCHEMA_38_nummer_bremse.sql — eine Bremse fuer die Nummernsuche
--  13.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  `finde_per_nummer` (Schema 24) uebersetzt eine Telefonnummer in eine
--  Person: Name, Handle, Initialen, Farbe, Beschreibung. Das ist gewollt —
--  „Kontakt hinzufuegen nur ueber Telefonnummer/QR-Code" (Henrik, 07.09.2026)
--  braucht genau diesen Weg.
--
--  Der Schutz lag bisher allein darin, dass man die Nummer kennen muss. Das
--  traegt nur, solange Nummern schwer zu raten sind — und Mobilnummern sind es
--  nicht. Ein deutscher Mobilfunkblock hat sieben freie Stellen; wer eine
--  Vorwahl durchzaehlt, findet zu jeder vergebenen Nummer einen Namen. Genau
--  das ist ein Massenabzug, nur langsamer als der aus Fund 1 vom 04.09.2026.
--
--  NACHGEMESSEN AM 13.09.2026
--
--  Angemeldet, ein ganz normales Konto, zwoelf Aufrufe hintereinander:
--
--      finde_per_nummer  ->  200, 200, 200, 200, 200, 200
--      finde_per_nummer  ->  200, 200, 200, 200, 200, 200
--
--  Keine Bremse, keine Verzoegerung, keine Spur davon irgendwo. Weder die
--  Datenbank noch der Express-Server sehen diese Aufrufe: die App spricht
--  fuer die Suche direkt mit PostgREST, das Ratenlimit aus web/server/app.js
--  (300/Minute auf /api) greift hier also gar nicht.
--
--  WAS SICH AENDERT
--
--  Jeder angemeldete Nutzer darf GRENZE Nummern je FENSTER nachschlagen.
--  Darueber hinaus antwortet die Funktion mit einem Fehler statt mit einer
--  Person. Vierzig Nachschlaege pro Stunde sind fuer einen Menschen, der
--  Kontakte eintippt oder QR-Codes scannt, reichlich; fuer das Durchzaehlen
--  einer Vorwahl sind sie nichts.
--
--  WARUM EINE TABELLE UND NICHT `pg_stat`
--
--  Gezaehlt werden muss je Nutzer und ueber Verbindungen hinweg. Postgres
--  bietet dafuer nichts Fertiges an, das eine Sitzung ueberlebt. Die Tabelle
--  ist die kleinstmoegliche Fassung davon: Nutzer und Zeitpunkt, sonst
--  nichts. Insbesondere NICHT die gesuchte Nummer — ein Protokoll darueber,
--  wer wen sucht, waere ein neues Datenleck an der Stelle, an der wir gerade
--  eines schliessen.
--
--  Alte Zeilen raeumt jeder Aufruf fuer den eigenen Nutzer selbst weg. Damit
--  bleibt die Tabelle bei (aktive Nutzer x GRENZE) Zeilen stehen, ohne dass
--  irgendwo ein Aufraeumauftrag laufen muss, an den sich spaeter niemand mehr
--  erinnert.
--
--  DIE FALLE BEI DEN AUFRUFERN — WICHTIG
--
--  `finde_per_nummer` wird an zwei verschiedenen Stellen benutzt:
--
--    1. Person suchen        app/lib/aktionen.ts personPerNummer()
--                            web/server/sync-handlers.js handleFindPerson()
--    2. Nummer schon         app/lib/aktionen.ts telefonAendern()
--       vergeben?            web/server/app.js POST /api/eigene/telefon
--
--  Die beiden Stellen unter 2. haben den Fehlerwert bisher weggeworfen
--  (`const { data: schonDa } = await ...`). Ohne Anpassung waere die Bremse
--  dort zu einer Sicherheitsluecke geworden: wer sie ausloest, bekaeme
--  `schonDa = null`, und die Dopplungspruefung waere stillschweigend
--  uebersprungen. Beide Stellen pruefen den Fehler jetzt und brechen ab.
--  Der Eindeutigkeits-Index `profiles_phone_einmalig` bleibt der letzte
--  Riegel darunter.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_38_nummer_bremse.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Der Zaehler.
--
--  Kein Fremdschluessel auf `profiles`, sondern auf `auth.users`: gezaehlt
--  wird, wer aufruft, und das ist die Anmeldung. Ein geloeschtes Konto nimmt
--  seine Zeilen mit.
-- ---------------------------------------------------------------------------
create table if not exists public.nummer_suche_takt (
  id     bigint generated always as identity primary key,
  nutzer uuid        not null references auth.users(id) on delete cascade,
  zeit   timestamptz not null default now()
);

create index if not exists nummer_suche_takt_nutzer_zeit
  on public.nummer_suche_takt (nutzer, zeit desc);

-- Niemand liest diese Tabelle ueber PostgREST. RLS ohne eine einzige Regel
-- heisst: jede Abfrage von aussen kommt leer zurueck. Die Funktion unten
-- laeuft als `security definer` und geht daran vorbei — das ist der einzige
-- Weg hinein.
alter table public.nummer_suche_takt enable row level security;
revoke all on public.nummer_suche_takt from public, anon, authenticated;


-- ---------------------------------------------------------------------------
--  Die Suche, jetzt mit Bremse.
--
--  Der Rest der Funktion ist wortgleich mit Schema 24. Neu sind nur die drei
--  Schritte zwischen Laengenpruefung und Suche: aufraeumen, zaehlen,
--  eintragen.
-- ---------------------------------------------------------------------------
create or replace function public.finde_per_nummer(nummer text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ich     uuid := auth.uid();
  gesucht text := public.nummer_vergleichsform(nummer);
  bisher  integer;
  -- Vierzig Nachschlaege je Stunde und Konto. Wer Kontakte eintippt, merkt
  -- davon nichts; wer eine Vorwahl durchzaehlt, braucht Jahre.
  grenze  constant integer  := 40;
  fenster constant interval := interval '1 hour';
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;
  -- Zu kurze Eingaben wuerden auf halbe Nummern passen und die Suche in ein
  -- Rateverfahren verwandeln.
  if length(gesucht) < 6 then
    return null;
  end if;

  delete from public.nummer_suche_takt
   where nutzer = ich
     and zeit < now() - fenster;

  select count(*) into bisher
    from public.nummer_suche_takt
   where nutzer = ich;

  if bisher >= grenze then
    -- 54000 = program_limit_exceeded. Ein eigener Code, damit die Aufrufer
    -- die Bremse von einem echten Fehler unterscheiden koennen.
    raise exception 'Zu viele Nummernsuchen. Bitte versuche es spaeter noch einmal.'
      using errcode = '54000';
  end if;

  insert into public.nummer_suche_takt (nutzer) values (ich);

  return (
    select to_jsonb(t)
      from (select p.id, p.name, p.handle, p.initials, p.color, p.privat, p.about
              from public.profiles p
             where p.id <> ich
               and p.phone is not null
               and public.nummer_vergleichsform(p.phone) = gesucht
             limit 1) t
  );
end;
$$;

-- `create or replace` behaelt die bestehenden Rechte. Sie stehen hier
-- trotzdem noch einmal — Schema 37 ist genau daran entstanden, dass sich
-- niemand darauf verlassen sollte, welche Rechte eine Funktion „schon hat".
revoke execute on function public.finde_per_nummer(text) from public, anon;
grant  execute on function public.finde_per_nummer(text) to authenticated;


-- ---------------------------------------------------------------------------
--  Kontrolle
-- ---------------------------------------------------------------------------
select
  has_function_privilege('anon',          'public.finde_per_nummer(text)', 'execute') as anon_darf,
  has_function_privilege('authenticated', 'public.finde_per_nummer(text)', 'execute') as angemeldet_darf,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'nummer_suche_takt')                  as regeln_auf_der_tabelle;
