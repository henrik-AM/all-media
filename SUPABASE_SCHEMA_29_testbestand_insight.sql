-- ===========================================================================
--  Schema 29 — ein Insight im Testbestand
--
--  Am 06.09.2026 zeigte der Bildschirm `detail-insights` im Bilderlauf
--  („npm run mac:bilder") nichts als den Satz „Dieser Insight ist nicht mehr
--  da." Das war kein Fehler in der Anzeige: die Tabelle `insights` war leer.
--
--  `starter_inhalte()` legt Kontakte, Chats, Beiträge, Storys, Umfragen und
--  Mitteilungen an — Insights aber nie. Damit ließ sich der Betrachter weder
--  fotografieren noch von Hand ansehen, und ein Fehler darin wäre niemandem
--  aufgefallen.
--
--  Angelegt wird genau einer: ein empfangener, noch ungesehener Insight von
--  einem Beispielkontakt. Mehr braucht es nicht, und mehr wäre im Weg —
--  `_handbuch.js` prüft das Senden, das Speichern, das Wiederholen und die
--  Empfängerliste mit eigenen Daten. Deshalb hier ausdrücklich **kein**
--  Eintrag in `insight_targets` und **keine** Kette in `insight_streaks`:
--  beide würde der Prüflauf umschalten und dann etwas anderes vorfinden, als
--  er hingelegt hat.
--
--  Einspielen:  node tools/sql-einspielen.mjs SUPABASE_SCHEMA_29_testbestand_insight.sql
-- ===========================================================================

create or replace function public.testbestand_insight(ziel uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_sender uuid;
  v_url    text;
  v_neu    uuid;
  -- Ein echtes Foto im Hochformat. `test-hochformat.png` waere zwar auch
  -- hochkant, traegt aber die Aufschrift „Test-Video" — im Foto-Betrachter
  -- sieht das nach einem Fehler aus.
  v_bild   constant text := 'beispiel/story-laufen.jpg';
begin
  if ziel is null then
    return jsonb_build_object('ok', false, 'grund', 'keine Kennung');
  end if;

  -- Schon einer da? Dann nichts tun. Die Funktion läuft nach jedem
  -- Zurücksetzen und soll den Bestand nicht anhäufen.
  if exists (select 1 from public.insight_recipients where user_id = ziel) then
    return jsonb_build_object('ok', true, 'angelegt', 0);
  end if;

  /*
   * Reste von früher.
   *
   * `zuruecksetzen()` löscht die Zeile aus `insight_recipients`, den Insight
   * selbst aber nicht: dessen Absender ist ein Beispielprofil, und die
   * Funktion räumt nur, was `ziel` gehört. Ohne die Zeile hier bliebe nach
   * jedem Lauf ein Insight liegen, den niemand mehr sehen kann.
   */
  delete from public.insights i
   where i.sender_id in (select id from public.profiles where demo)
     and not exists (select 1 from public.insight_recipients r where r.insight_id = i.id);

  /*
   * Absender ist Anna Schmidt — feste Kennung aus Schema 6.
   *
   * Nicht „irgendein Beispielkontakt": der Bilderlauf öffnet den Betrachter
   * über genau diese Kennung (`app/tools/app-bilder.js`, `detail-insights`).
   * Wäre der Absender vom Zufall abhängig, zeigte der Bildschirm mal etwas
   * und mal „Dieser Insight ist nicht mehr da." — und niemand wüsste, ob das
   * ein Fehler ist. Gibt es sie nicht, tut es jeder andere Beispielkontakt;
   * dann steht im Bild eben ein anderer Name.
   */
  select p.id into v_sender
    from public.contacts c
    join public.profiles p on p.id = c.contact_id
   where c.user_id = ziel and p.demo
   order by (p.id = '11111111-a11e-4d1a-8000-000000000001'::uuid) desc, p.name
   limit 1;

  if v_sender is null then
    return jsonb_build_object('ok', false, 'grund', 'kein Beispielkontakt');
  end if;

  /*
   * Das Bild.
   *
   * Ein Insight kommt aus der Kamera, also Hochformat. Der erste Versuch
   * nahm „die neueste Story des Absenders" — das war `test-live.png`, ein
   * quer liegender Livestream-Platzhalter, der den halben Bildschirm frei
   * liess. Im Betrachter sah das aus wie ein Fehler, obwohl alles stimmte.
   * Deshalb steht die Datei jetzt fest.
   *
   * Gespeichert wird die Adresse in der Form `.../object/public/media/<pfad>`;
   * unterschrieben wird erst beim Anzeigen (`app/lib/medien.ts`). Den
   * Bestandteil davor gibt es nirgends als Einstellung — er wird deshalb aus
   * einer vorhandenen Adresse übernommen.
   */
  select regexp_replace(m.media_url,
                        '/storage/v1/object/public/media/.*$',
                        '/storage/v1/object/public/media/' || v_bild)
    into v_url
    from (
      select media_url from public.stories where media_url is not null
      union all
      select media_url from public.posts   where media_url is not null
    ) m
   where m.media_url like '%/storage/v1/object/public/media/%'
   limit 1;

  -- Gibt es die Datei nicht, lieber ein anderes echtes Bild als eine
  -- Adresse, die ins Leere führt.
  if v_url is not null and not exists (
    select 1 from storage.objects where bucket_id = 'media' and name = v_bild
  ) then
    raise notice 'media/% fehlt — es wird ein vorhandenes Bild genommen.', v_bild;
    select s.media_url into v_url
      from public.stories s
     where s.media_type = 'image' and s.media_url is not null
     order by s.created_at desc
     limit 1;
  end if;

  if v_url is null then
    return jsonb_build_object('ok', false, 'grund', 'kein Bild im Bestand');
  end if;

  /*
   * `einmal = false` und `dauer = 0`: der Insight bleibt nach dem Ansehen
   * stehen. Ein einmaliger wäre nach dem ersten Blick weg, und der nächste
   * Bilderlauf stünde wieder vor „Dieser Insight ist nicht mehr da."
   */
  insert into public.insights (sender_id, media_url, media_type, filter, dauer, einmal, ablauf_at)
  values (v_sender, v_url, 'image', '', 0, false, null)
  returning id into v_neu;

  insert into public.insight_recipients (insight_id, user_id, gesehen_at)
  values (v_neu, ziel, null);

  return jsonb_build_object('ok', true, 'angelegt', 1, 'insight', v_neu);
end;
$$;

grant execute on function public.testbestand_insight(uuid) to authenticated;


-- ---------------------------------------------------------------------------
--  An starter_inhalte() anhängen
--
--  Gleiches Vorgehen wie in Schema 16 und 17: die vorhandene Funktion wird
--  gelesen und der Aufruf vor die Rückgabe gesetzt. So bleibt die eine
--  Fassung in der Datenbank die Wahrheit, statt dass zwei Dateien
--  auseinanderlaufen.
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

  if quelle like '%testbestand_insight%' then
    raise notice 'starter_inhalte() legt den Insight schon an.';
    return;
  end if;

  quelle := replace(
    quelle,
    '  return jsonb_build_object(''ok'', true, ''chats'', v_chats',
    '  -- Ein empfangener Insight fuer den Betrachter (Schema 29).' || chr(10) ||
    '  perform public.testbestand_insight(ziel);' || chr(10) || chr(10) ||
    '  return jsonb_build_object(''ok'', true, ''chats'', v_chats'
  );

  if quelle not like '%testbestand_insight%' then
    raise exception 'Die Ankerzeile in starter_inhalte() hat sich geaendert — bitte von Hand anhaengen.';
  end if;

  execute quelle;
  raise notice 'starter_inhalte() legt jetzt auch einen Insight an.';
end;
$$;


-- ---------------------------------------------------------------------------
--  Und einmal für die bestehenden Konten
--
--  Sie wurden vor dieser Datei angelegt und kämen sonst erst beim nächsten
--  Zurücksetzen zu ihrem Insight. Doppelt anlegen kann nicht passieren: die
--  Funktion sieht selbst nach.
-- ---------------------------------------------------------------------------

do $$
declare
  v_konto record;
  v_erg   jsonb;
begin
  for v_konto in
    select id, name from public.profiles where demo is not true
  loop
    v_erg := public.testbestand_insight(v_konto.id);
    if (v_erg->>'angelegt') = '1' then
      raise notice 'Insight fuer % angelegt.', v_konto.name;
    end if;
  end loop;
end;
$$;
