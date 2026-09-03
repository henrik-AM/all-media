-- ===========================================================================
--  Eine Statistik aus lauter Nullen sagt nichts
-- ===========================================================================
--
--  Seit Schema 16 zeigen die Einstellungen unter „Insights" die echten Zahlen
--  zum eigenen Profil — Aufrufe der letzten sieben und dreißig Tage, neue
--  Follower, verschiedene Besucher. Echt heißt hier auch: beim Testkonto
--  stand überall 0, weil niemand das Profil je aufgerufen hatte.
--
--  Das ist richtig gerechnet und trotzdem unbrauchbar. Wer die Liste
--  aufschlägt, kann nicht unterscheiden, ob die Zahlen stimmen oder ob das
--  Feature kaputt ist. Der Testbestand hat für jede Funktion einen Fall —
--  ein Foto, ein Video, eine Story, eine Umfrage. Für die Statistik fehlte er.
--
--  Diese Datei legt ihn an: Profilaufrufe der neun Beispielprofile auf das
--  Testkonto, über sechs Wochen verteilt. Die Verteilung ist bewusst
--  ungleichmäßig — eine Kurve, die jeden Tag denselben Wert zeigt, sieht
--  erfunden aus, und genau davon soll die Statistik ja wegkommen.
--
--  Angehängt an starter_inhalte(), damit sie nach jedem Zurücksetzen wieder
--  entstehen.
--
--  Einspielen:
--    node tools/sql-einspielen.mjs SUPABASE_SCHEMA_17_testbestand_statistik.sql
-- ===========================================================================

create or replace function public.testbestand_profilaufrufe(ziel uuid)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  v_besucher uuid[];
  v_person   uuid;
  v_anzahl   integer := 0;
  v_tage     integer;
  v_i        integer;
begin
  if ziel is null then
    return 0;
  end if;

  /*
   * Nur die Beispielprofile besuchen. Ein echtes Konto als Besucher
   * einzutragen wäre eine Behauptung über einen Menschen, der davon nichts
   * weiß — und beim Löschen dieses Kontos verschwände der Eintrag wieder.
   */
  select array_agg(id) into v_besucher
    from public.profiles
   where demo and id <> ziel;

  if v_besucher is null or array_length(v_besucher, 1) = 0 then
    return 0;
  end if;

  /*
   * Sechs Wochen, mit Schwerpunkt auf den letzten Tagen. `mod` verteilt die
   * Besucher reihum; die Tagesabstände kommen aus einer festen Folge, damit
   * zwei Läufe dasselbe Bild ergeben — eine Statistik, die sich bei jedem
   * Zurücksetzen ändert, taugt nicht zum Prüfen.
   */
  for v_i in 0..37 loop
    v_person := v_besucher[1 + mod(v_i, array_length(v_besucher, 1))];

    -- 0,1,2,3,5,8,13,21,34 … je kleiner die Zahl, desto näher an heute.
    v_tage := case
                when v_i < 12 then mod(v_i, 7)          -- letzte Woche: dicht
                when v_i < 26 then 7 + mod(v_i, 23)     -- der Monat davor
                else 30 + mod(v_i, 12)                  -- älter als 30 Tage
              end;

    insert into public.profile_views (profile_id, viewer_id, created_at)
    values (ziel, v_person, now() - (v_tage || ' days')::interval - (mod(v_i, 19) || ' hours')::interval);

    v_anzahl := v_anzahl + 1;
  end loop;

  return v_anzahl;
end;
$$;

grant execute on function public.testbestand_profilaufrufe(uuid) to authenticated;


-- ---------------------------------------------------------------------------
--  An starter_inhalte() anhängen
--
--  Wie bei Schema 16 wird die vorhandene Funktion gelesen und der neue Aufruf
--  vor die Rückgabe gesetzt. Das ist umständlicher als sie neu zu schreiben,
--  hält aber die eine Stelle in einer Datei — sonst weichen die Fassungen in
--  Schema 7 und hier voneinander ab, und niemand weiß mehr, welche gilt.
-- ---------------------------------------------------------------------------

do $$
declare
  quelle text;
begin
  select pg_get_functiondef(p.oid) into quelle
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'starter_inhalte'
   limit 1;

  if quelle is null then
    raise notice 'starter_inhalte() gibt es nicht — nichts anzuhaengen.';
    return;
  end if;

  if quelle like '%testbestand_profilaufrufe%' then
    raise notice 'starter_inhalte() legt die Profilaufrufe schon an.';
    return;
  end if;

  quelle := replace(
    quelle,
    '  return jsonb_build_object(''ok'', true, ''chats'', v_chats',
    '  -- Profilaufrufe fuer die Statistik (Schema 17).' || chr(10) ||
    '  perform public.testbestand_profilaufrufe(ziel);' || chr(10) || chr(10) ||
    '  return jsonb_build_object(''ok'', true, ''chats'', v_chats'
  );

  if quelle not like '%testbestand_profilaufrufe%' then
    raise exception 'Die Ankerzeile in starter_inhalte() hat sich geaendert — bitte von Hand anhaengen.';
  end if;

  execute quelle;
  raise notice 'starter_inhalte() legt jetzt auch Profilaufrufe an.';
end;
$$;


-- ---------------------------------------------------------------------------
--  Und einmal für das bestehende Testkonto
--
--  Es wurde vor dieser Datei angelegt und bekommt seine Aufrufe deshalb nicht
--  über starter_inhalte(). Doppelt anlegen kann nicht passieren: die Funktion
--  läuft nur, wenn noch keine Zeile da ist.
-- ---------------------------------------------------------------------------

do $$
declare
  v_test uuid;
  v_zahl integer;
begin
  select id into v_test from public.profiles where handle = 'test' or handle = '@test' limit 1;

  if v_test is null then
    raise notice 'Kein Testkonto gefunden — uebersprungen.';
    return;
  end if;

  if exists (select 1 from public.profile_views where profile_id = v_test) then
    raise notice 'Das Testkonto hat schon Profilaufrufe.';
    return;
  end if;

  v_zahl := public.testbestand_profilaufrufe(v_test);
  raise notice 'Testkonto: % Profilaufrufe angelegt.', v_zahl;
end;
$$;
