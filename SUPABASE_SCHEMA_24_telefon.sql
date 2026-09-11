-- ===========================================================================
--  SUPABASE_SCHEMA_24_telefon.sql — eine Telefonnummer, eine Vergleichsregel
--  07.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Unter Einstellungen -> Konto stand "Telefonnummer aendern". Man tippte
--  eine Nummer ein, es erschien "Wir haben dir einen Bestaetigungscode
--  geschickt", und es passierte nichts: kein Code, kein Schreibvorgang. Die
--  Spalte `profiles.phone` gab es die ganze Zeit.
--
--  Beim Nachbauen fiel das Zweite auf. Es gab DREI Regeln dafuer, wann zwei
--  Telefonnummern dieselbe sind:
--
--    app/lib/personSuche.ts       Nicht-Ziffern weg, +/00 weg, fuehrende 0
--                                 wird zu 49    ->  0170… = +49 170…
--    web/server/sync-handlers.js  dasselbe, zweite Abschrift
--    finde_per_nummer (DB)        nur Nicht-Ziffern weg
--                                 ->  0170… ist NICHT +49 170…
--
--  Die Datenbank ist die Stelle, an der es zaehlt: `finde_per_nummer` sucht
--  Personen ueber ihre Nummer, und seit heute prueft sie ausserdem, ob eine
--  Nummer schon jemandem gehoert. Mit der schwaecheren Regel ging
--  "0152 3456789" als freie Nummer durch, obwohl sie als "+49 152 3456789"
--  schon vergeben war — nachgemessen am 07.09.2026, die Doppelvergabe kam
--  durch.
--
--  Ab hier rechnet die Datenbank dasselbe wie die App: gemeinsam/telefon.js,
--  `vergleichsform()`. Wer eine der beiden Stellen aendert, aendert die
--  andere mit.
--
--  WAS SICH NICHT AENDERT
--
--  Gespeichert wird die Nummer weiter so, wie sie eingetippt wurde. Genau das
--  steht in der Kontaktinfo, und "+49 151 2345678" liest sich besser als
--  "+491512345678". Verglichen wird die Rechenform, angezeigt die Eingabe.
--
--  Der Eindeutigkeits-Index `profiles_phone_einmalig` aus Schema 11 bleibt
--  ebenfalls stehen. Er sieht nur zeichengleiche Dopplungen, ist aber der
--  letzte Riegel fuer den Fall, dass zwischen Frage und Schreiben jemand
--  anders schneller war.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_24_telefon.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Die gemeinsame Rechenform, einmal in SQL.
--
--  Wortgleich mit `vergleichsform()` in gemeinsam/telefon.js:
--    1. alles ausser Ziffern und + faellt weg
--    2. ein fuehrendes + wird zu 00
--    3. fuehrendes 00 faellt weg          (0049 170… -> 49 170…)
--    4. sonst wird eine fuehrende 0 zu 49 (0170…     -> 49170…)
--
--  `immutable`, damit sie in einem Ausdrucksindex stehen darf — ohne den
--  liefe jede Suche als vollstaendiger Durchlauf ueber `profiles`.
-- ---------------------------------------------------------------------------
create or replace function public.nummer_vergleichsform(nummer text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when z like '00%' then substr(z, 3)
    when z like '0%'  then '49' || substr(z, 2)
    else z
  end
  from (
    select replace(regexp_replace(coalesce(nummer, ''), '[^0-9+]', '', 'g'), '+', '00') as z
  ) t;
$$;

comment on function public.nummer_vergleichsform(text) is
  'Vergleichsform einer Telefonnummer. Muss mit vergleichsform() in gemeinsam/telefon.js uebereinstimmen.';

create index if not exists profiles_nummer_vergleich_idx
  on public.profiles (public.nummer_vergleichsform(phone))
  where phone is not null and phone <> '';


-- ---------------------------------------------------------------------------
--  Jemanden ueber seine Telefonnummer finden — jetzt mit derselben Regel.
--
--  Sonst unveraendert gegenueber SUPABASE_SCHEMA_23_audit.sql: der Vergleich
--  bleibt in der Datenbank (kein Massenabzug), die gefundene Nummer steht
--  nicht in der Antwort, und ohne Anmeldung geht gar nichts.
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
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;
  -- Zu kurze Eingaben wuerden auf halbe Nummern passen und die Suche in ein
  -- Rateverfahren verwandeln.
  if length(gesucht) < 6 then
    return null;
  end if;

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

revoke execute on function public.finde_per_nummer(text) from public, anon;
grant execute on function public.finde_per_nummer(text) to authenticated;

-- `nummer_vergleichsform` rechnet nur; sie liest nichts. Trotzdem gilt die
-- Regel aus Schema 23 (Teil C): kein geerbtes Ausfuehrungsrecht.
revoke execute on function public.nummer_vergleichsform(text) from public, anon;
grant execute on function public.nummer_vergleichsform(text) to authenticated;
