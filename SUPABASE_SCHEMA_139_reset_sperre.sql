-- ===========================================================================
-- All Media — Schema 139: zuruecksetzen() nacheinander (24.11.2026)
-- ===========================================================================
--
-- Mit dem Kontenpool (Schema 138) setzen bis zu vier Prüfläufe zugleich ihr
-- Konto zurück. Beim ersten Paralleltest (Platz 2 und 3) brach einer mit
-- 40P01 (Deadlock) ab: Beide Resets löschen Likes, Kommentare und Reposts an
-- denselben Demo-Beiträgen, die Zähler-Auslöser sperren diese Beitragszeilen
-- in unterschiedlicher Reihenfolge.
--
-- Abhilfe: zuruecksetzen() und starter_inhalte() holen eine gemeinsame
-- Transaktionssperre. Resets laufen dadurch nacheinander (je wenige
-- Sekunden); alles andere in den Prüfläufen bleibt parallel.
--
-- Umgeschrieben wird am Anker der live gültigen Fassung (Gewinner siehe
-- SUPABASE_REIHENFOLGE.md), nichts wird zurückgedreht.

do $$
declare
  quelle text;
  anker  constant text := '  -- Eigene Inhalte und alles, was daran hängt (über die Fremdschlüssel).';
  sperre constant text :=
    '  -- Schema 139: Resets parallel laufender Prüfplätze nacheinander (sonst 40P01).' || chr(10) ||
    '  perform pg_advisory_xact_lock(hashtext(''all-media:zuruecksetzen''));' || chr(10) || chr(10);
begin
  select pg_get_functiondef('public.zuruecksetzen'::regproc) into quelle;
  if quelle like '%all-media:zuruecksetzen%' then
    raise notice 'zuruecksetzen() hat die Sperre schon.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in zuruecksetzen() nicht gefunden — bitte von Hand anpassen.';
  end if;
  execute replace(quelle, anker, sperre || anker);
end;
$$;

do $$
declare
  quelle text;
  anker  constant text := '  -- --- Kontakte ---------------------------------------------------------';
  sperre constant text :=
    '  -- Schema 139: gleiche Sperre wie zuruecksetzen() (Demo-Beitragszähler).' || chr(10) ||
    '  perform pg_advisory_xact_lock(hashtext(''all-media:zuruecksetzen''));' || chr(10) || chr(10);
begin
  select pg_get_functiondef('public.starter_inhalte'::regproc) into quelle;
  if quelle like '%all-media:zuruecksetzen%' then
    raise notice 'starter_inhalte() hat die Sperre schon.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in starter_inhalte() nicht gefunden — bitte von Hand anpassen.';
  end if;
  execute replace(quelle, anker, sperre || anker);
end;
$$;

-- Gegenprobe: Sperre da, Testkonto-Schranken aus Schema 62 weiter da.
do $$
begin
  if pg_get_functiondef('public.zuruecksetzen'::regproc) not like '%all-media:zuruecksetzen%'
  or pg_get_functiondef('public.starter_inhalte'::regproc) not like '%all-media:zuruecksetzen%' then
    raise exception 'Reset-Sperre fehlt.';
  end if;
  if pg_get_functiondef('public.zuruecksetzen'::regproc) not like '%ist_testkonto(ziel)%'
  or pg_get_functiondef('public.starter_inhalte'::regproc) not like '%ist_testkonto(ziel)%' then
    raise exception 'Testkonto-Schranke aus Schema 62 fehlt.';
  end if;
end;
$$;
