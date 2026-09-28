-- ===========================================================================
--  SUPABASE_SCHEMA_62_nur_eigene_testkonten.sql
--
--  WARUM ES DAS GIBT
--
--  Henrik am 28.09.2026: Beiträge und alles andere am Profil dürfen nur bei
--  den Testkonten bearbeitet werden, die Claude selbst angelegt hat
--  (@test = test@all-media.app, @prueflauf = all.media.prueflauf@web.de).
--  Konten, die Henrik oder andere Personen angelegt haben, auch zum Testen,
--  sind tabu.
--
--  Die Datenbank hielt sich nicht daran:
--
--  1. starter_inhalte() läuft über starter_inhalte_trigger für JEDES neue
--     Profil. Es schreibt Kontakte, Chats, Nachrichten, Communitys,
--     Mitteilungen, fünf Beiträge, eine Story, einen Kartenpunkt, eine
--     Spendenkarte und die Bio „Testkonto für All Media …“ ins Konto.
--     Alle sechs echten Konten haben das bekommen.
--  2. zuruecksetzen() löscht alle Beiträge, Storys, Chats, Kontakte und
--     Einstellungen eines Kontos. Geprüft wurde nur, dass es das eigene
--     Konto ist. Über POST /api/reset kann also jedes angemeldete Konto sich
--     selbst leeren. Kein Knopf ruft das auf, aber ein Prüflauf, der
--     versehentlich unter einem echten Konto angemeldet ist, würde es tun.
--
--  WAS HIER GESCHIEHT
--
--  - ist_testkonto(k): die eine Stelle, an der die beiden Testkonten stehen.
--  - starter_inhalte() schreibt nur noch in Testkonten. Bei allen anderen
--    kehrt es sofort zurück. Beide Aufrufer (Registrierung, zuruecksetzen)
--    nutzen `perform`, der Rückgabewert stört also niemanden.
--  - zuruecksetzen() verweigert echte Konten mit einer Ausnahme.
--
--  Beide Funktionen werden wie in Schema 17/60 am Anker umgeschrieben, damit
--  keine weitere vollständige Fassung entsteht.
--
--  NICHT HIER: die Starterinhalte, die schon in echten Konten liegen. Die
--  fasst nur Henrik an.
-- ===========================================================================

create or replace function public.ist_testkonto(k uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from auth.users u
     where u.id = k
       and u.email in ('test@all-media.app', 'all.media.prueflauf@web.de')
  );
$$;

-- Postgres gibt EXECUTE an neuen Funktionen automatisch an PUBLIC (test:rechte).
-- Aufgerufen wird sie nur aus Funktionen mit security definer.
revoke all on function public.ist_testkonto(uuid) from public, anon, authenticated;

-- 1. starter_inhalte() -----------------------------------------------------
do $$
declare
  quelle text;
  anker  constant text := '  if ziel is null then' || chr(10) ||
                          '    return jsonb_build_object(''ok'', false, ''grund'', ''keine Kennung'');' || chr(10) ||
                          '  end if;' || chr(10);
begin
  select pg_get_functiondef('public.starter_inhalte'::regproc) into quelle;

  if quelle like '%ist_testkonto(ziel)%' then
    raise notice 'starter_inhalte() prüft schon auf Testkonten.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in starter_inhalte() nicht gefunden — bitte von Hand anpassen.';
  end if;

  quelle := replace(quelle, anker, anker || chr(10) ||
    '  -- Nur in Claudes eigene Testkonten schreiben. Echte Konten, auch' || chr(10) ||
    '  -- die zum Testen angelegten, bleiben unangetastet (Schema 62).' || chr(10) ||
    '  if not public.ist_testkonto(ziel) then' || chr(10) ||
    '    return jsonb_build_object(''ok'', false, ''grund'', ''kein Testkonto'');' || chr(10) ||
    '  end if;' || chr(10));

  execute quelle;
end;
$$;

-- 2. zuruecksetzen() -------------------------------------------------------
do $$
declare
  quelle text;
  anker  constant text := '  -- Eigene Inhalte und alles, was daran hängt (über die Fremdschlüssel).';
begin
  select pg_get_functiondef('public.zuruecksetzen'::regproc) into quelle;

  if quelle like '%ist_testkonto(ziel)%' then
    raise notice 'zuruecksetzen() prüft schon auf Testkonten.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in zuruecksetzen() nicht gefunden — bitte von Hand anpassen.';
  end if;

  quelle := replace(quelle, anker,
    '  -- Echte Konten leert niemand, auch nicht sie selbst (Schema 62).' || chr(10) ||
    '  if not public.ist_testkonto(ziel) then' || chr(10) ||
    '    raise exception ''nur für Testkonten'';' || chr(10) ||
    '  end if;' || chr(10) || chr(10) || anker);

  execute quelle;
end;
$$;

-- 3. Gegenprobe ------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.starter_inhalte'::regproc) not like '%ist_testkonto(ziel)%'
  or pg_get_functiondef('public.zuruecksetzen'::regproc)   not like '%ist_testkonto(ziel)%' then
    raise exception 'Die Sperre fehlt noch in einer der beiden Funktionen.';
  end if;
  if (select count(*) from auth.users
       where email in ('test@all-media.app', 'all.media.prueflauf@web.de')) <> 2 then
    raise exception 'ist_testkonto() findet nicht beide Testkonten.';
  end if;
end;
$$;
