-- ===========================================================================
--  SUPABASE_SCHEMA_XX_testbestand_nur_testkonten.sql     (ENTWURF, Kasten 13.4)
--
--  WARUM ES DAS GIBT
--
--  Henrik am 21.09.2026: „Echte Konten werden nicht angefasst … Auf Konten
--  echter Personen darf Claude nichts hochladen — kein Video, kein Beitrag."
--
--  Schema 62 hat starter_inhalte() und zuruecksetzen() auf ist_testkonto()
--  beschränkt, Schema 66 den Wächter vor saves/post_likes/reposts/comments/
--  shares gesetzt. Zwei Funktionen des Testbestands blieben offen:
--
--  1. testbestand_insight(ziel)  — Schema 29, `security definer`, Recht für
--     `authenticated` (Schema 29 Zeile 140; Schema 37 hat nur anon/PUBLIC
--     entzogen). Sie prüft NICHT, wer ruft. Jedes angemeldete Konto kann
--
--        rpc('testbestand_insight', { ziel: '<Kennung eines echten Kontos>' })
--
--     aufrufen und legt damit einen Test-Insight von Anna Schmidt in dessen
--     Posteingang — vorausgesetzt, das Konto hat einen Demo-Kontakt. Genau
--     das haben alle sechs echten Konten, seit starter_inhalte() sie ihnen
--     vor Schema 62 angelegt hat.
--
--  2. testbestand_profilaufrufe(ziel) — Schema 17/23, `security definer`,
--     Recht für `authenticated`. Seit Schema 23 nur noch für das eigene
--     Konto (ziel = auth.uid()); ein echtes Konto kann sich damit aber
--     weiterhin selbst 38 erfundene Profilaufrufe in die Statistik
--     schreiben. Kein Übergriff auf andere, aber Testinhalt auf einem echten
--     Konto.
--
--  Kein Client ruft eine der beiden auf (geprüft am 29.09.2026: app/, web/,
--  gemeinsam/, tools/ — nur Kommentare). Aufgerufen werden sie aus
--  zuruecksetzen(); das ist `security definer` und braucht das Recht der
--  Rolle `authenticated` nicht.
--
--  WAS HIER GESCHIEHT
--
--  - Beide Funktionen bekommen am Anker `  if ziel is null then` die Sperre
--    `if not public.ist_testkonto(ziel)` — wie Schema 62, ohne eine weitere
--    Vollfassung der Funktion.
--  - Das Ausführungsrecht geht an public, anon UND authenticated verloren.
--  - Gegenprobe im selben Lauf.
--
--  Idempotent: ein zweiter Lauf erkennt die Sperre und ändert nichts.
--  Voraussetzung: Schema 62 (ist_testkonto).
--
--  Nach dem Einspielen: npm run test:rechte und npm run test:handbuch.
-- ===========================================================================

do $$
begin
  if to_regprocedure('public.ist_testkonto(uuid)') is null then
    raise exception 'ist_testkonto() fehlt — erst SUPABASE_SCHEMA_62_nur_eigene_testkonten.sql einspielen.';
  end if;
end;
$$;

-- 1. testbestand_insight() --------------------------------------------------
do $$
declare
  quelle text;
  anker  constant text := '  if ziel is null then' || chr(10) ||
                          '    return jsonb_build_object(''ok'', false, ''grund'', ''keine Kennung'');' || chr(10) ||
                          '  end if;' || chr(10);
begin
  if to_regprocedure('public.testbestand_insight(uuid)') is null then
    raise notice 'testbestand_insight() gibt es nicht — nichts zu tun.';
    return;
  end if;
  select pg_get_functiondef('public.testbestand_insight(uuid)'::regprocedure) into quelle;

  if quelle like '%ist_testkonto(ziel)%' then
    raise notice 'testbestand_insight() prüft schon auf Testkonten.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in testbestand_insight() nicht gefunden — bitte von Hand anpassen.';
  end if;

  quelle := replace(quelle, anker, anker || chr(10) ||
    '  -- Nur Claudes eigene Testkonten bekommen einen Test-Insight (Kasten 13.4).' || chr(10) ||
    '  if not public.ist_testkonto(ziel) then' || chr(10) ||
    '    return jsonb_build_object(''ok'', false, ''grund'', ''kein Testkonto'');' || chr(10) ||
    '  end if;' || chr(10));
  execute quelle;
end;
$$;

-- 2. testbestand_profilaufrufe() -------------------------------------------
--  Anker ist hier nur die erste Zeile: der Rückgabetyp ist integer, der
--  Zweig darunter sieht anders aus als in testbestand_insight().
do $$
declare
  quelle text;
  anker  constant text := '  if ziel is null then';
begin
  if to_regprocedure('public.testbestand_profilaufrufe(uuid)') is null then
    raise notice 'testbestand_profilaufrufe() gibt es nicht — nichts zu tun.';
    return;
  end if;
  select pg_get_functiondef('public.testbestand_profilaufrufe(uuid)'::regprocedure) into quelle;

  if quelle like '%ist_testkonto(ziel)%' then
    raise notice 'testbestand_profilaufrufe() prüft schon auf Testkonten.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in testbestand_profilaufrufe() nicht gefunden — bitte von Hand anpassen.';
  end if;

  -- Nur das erste Vorkommen ersetzen: davor die Sperre setzen.
  quelle := overlay(quelle placing
    '  -- Erfundene Profilaufrufe nur in Claudes Testkonten (Kasten 13.4).' || chr(10) ||
    '  if not public.ist_testkonto(ziel) then' || chr(10) ||
    '    return 0;' || chr(10) ||
    '  end if;' || chr(10) || chr(10) || anker
    from position(anker in quelle) for length(anker));
  execute quelle;
end;
$$;

-- 3. Rechte -----------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.testbestand_insight(uuid)') is not null then
    revoke execute on function public.testbestand_insight(uuid) from public, anon, authenticated;
  end if;
  if to_regprocedure('public.testbestand_profilaufrufe(uuid)') is not null then
    revoke execute on function public.testbestand_profilaufrufe(uuid) from public, anon, authenticated;
  end if;
end;
$$;

-- 4. Gegenprobe --------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['public.testbestand_insight(uuid)', 'public.testbestand_profilaufrufe(uuid)'] loop
    if to_regprocedure(f) is null then
      continue;
    end if;
    if pg_get_functiondef(to_regprocedure(f)) not like '%ist_testkonto(ziel)%' then
      raise exception '% hat die Sperre noch nicht.', f;
    end if;
    if has_function_privilege('authenticated', to_regprocedure(f), 'execute')
    or has_function_privilege('anon', to_regprocedure(f), 'execute') then
      raise exception '% ist noch von außen aufrufbar.', f;
    end if;
  end loop;
end;
$$;

notify pgrst, 'reload schema';
