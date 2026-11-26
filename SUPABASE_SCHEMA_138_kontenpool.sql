-- ===========================================================================
-- All Media — Schema 138: Kontenpool für parallele Prüfläufe (24.11.2026)
-- ===========================================================================
--
-- Bis heute teilten sich alle Claude- und Codex-Sitzungen EIN Prüfkonto
-- (all.media.prueflauf@web.de) und EIN Partnerkonto (test@all-media.app).
-- Jeder Lauf setzt sein Konto per zuruecksetzen() zurück; zwei Läufe zugleich
-- zerstören einander die Zahlen. Darum gab es nur einen Testbestand, und jede
-- Sitzung musste warten (Belegung `testbestand`).
--
-- Jetzt gibt es vier Plätze. Platz 1 ist das bisherige Paar, die Plätze 2–4
-- sind neue Paare:
--
--   Platz  Prüfkonto                     Partnerkonto
--   1      all.media.prueflauf@web.de    test@all-media.app
--   2      prueflauf2@all-media.app      test2@all-media.app
--   3      prueflauf3@all-media.app      test3@all-media.app
--   4      prueflauf4@all-media.app      test4@all-media.app
--
-- zuruecksetzen() fasst schon seit Schema 5/23 nur Zeilen des eigenen Kontos
-- an, daher reicht es, die neuen Konten als Testkonten zu kennen.
--
-- Die Konten selbst legt tools/kontenpool-anlegen.mjs über die Admin-API an
-- (Registrierung ist bis zum Launch gesperrt). Diese Datei ändert nur:
--   1. ist_testkonto(): Liste um die sechs neuen Adressen erweitert.
--      Dieselbe Liste steht in app/test/_nur_testkonten.js — beide gleich halten.
--   2. starter_inhalte(): die fest eingetragene Adressliste beim
--      Testkommentar (Schema 60) ruft jetzt ist_testkonto() — eine Liste, ein Ort.
--
-- Nur diese Datei einspielen; sie schreibt starter_inhalte() am Anker um und
-- dreht nichts zurück.

-- 1. ist_testkonto() ---------------------------------------------------------
create or replace function public.ist_testkonto(k uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from auth.users u
     where u.id = k
       and u.email in ('test@all-media.app', 'all.media.prueflauf@web.de',
                       'prueflauf2@all-media.app', 'test2@all-media.app',
                       'prueflauf3@all-media.app', 'test3@all-media.app',
                       'prueflauf4@all-media.app', 'test4@all-media.app')
  );
$$;

-- Aufgerufen nur aus security-definer-Funktionen (wie Schema 62).
revoke all on function public.ist_testkonto(uuid) from public, anon, authenticated;

-- 2. starter_inhalte(): Adressliste → ist_testkonto() ----------------------
do $$
declare
  quelle text;
  anker  constant text :=
    '       and u.email in (''test@all-media.app'', ''all.media.prueflauf@web.de'')';
begin
  select pg_get_functiondef('public.starter_inhalte'::regproc) into quelle;

  if position(anker in quelle) = 0 then
    if quelle like '%public.ist_testkonto(u.id)%' then
      raise notice 'starter_inhalte() nutzt schon ist_testkonto().';
      return;
    end if;
    raise exception 'Anker in starter_inhalte() nicht gefunden — bitte von Hand anpassen.';
  end if;

  quelle := replace(quelle, anker,
    '       and public.ist_testkonto(u.id)  -- Schema 138: Kontenpool');
  execute quelle;
end;
$$;

-- 3. Gegenprobe --------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.starter_inhalte'::regproc) like '%all.media.prueflauf@web.de%' then
    raise exception 'starter_inhalte() nennt noch feste Adressen.';
  end if;
  if pg_get_functiondef('public.starter_inhalte'::regproc) not like '%ist_testkonto(ziel)%' then
    raise exception 'Die Testkonto-Sperre aus Schema 62 fehlt in starter_inhalte().';
  end if;
end;
$$;
