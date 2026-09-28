-- ===========================================================================
--  SUPABASE_SCHEMA_60_testkommentar_nur_testkonten.sql
--
--  WARUM ES DAS GIBT
--
--  starter_inhalte() läuft für jedes neue Profil und hängte jedem Konto
--  „Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen." an
--  den neuesten Demo-Beitrag. Demo-Beiträge sehen alle. Unter dem Live-Post
--  „Expo SDK 57 live erklärt" standen deshalb acht gleiche Testkommentare,
--  sechs davon im Namen echter Konten (@h.dikta, @henrik1848, @jarno.riegel,
--  @tanti, @user.hugo, @ralle) — und jeder sah sie. Schema 50 hatte sie
--  ausdrücklich „für jedes echte Konto" nachgetragen.
--
--  Henrik am 21.09.2026 (Kasten 13.4): echte Konten bleiben unangetastet.
--  Gefunden am 28.09.2026 beim Prüfen von Kasten 5.
--
--  WAS HIER GESCHIEHT
--
--  1. starter_inhalte() legt den Kommentar nur noch für die beiden
--     Testkonten an (@test und @prueflauf). test:datenbank braucht ihn dort.
--     Wie Schema 17 wird die vorhandene Funktion umgeschrieben statt eine
--     dritte Fassung anzulegen. Die Fassungen in Schema 7 und 23 tragen
--     dieselbe Bedingung.
--  2. Die vorhandenen Testkommentare echter Konten werden gelöscht.
--  3. Gegenprobe im selben Lauf.
-- ===========================================================================

do $$
declare
  quelle text;
  anker  constant text := '  if v_post is not null and not exists (' || chr(10) ||
                          '    select 1 from public.comments where user_id = ziel and post_id = v_post';
begin
  select pg_get_functiondef(p.oid) into quelle
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'starter_inhalte'
   limit 1;

  if quelle is null then
    raise exception 'starter_inhalte() gibt es nicht.';
  end if;

  if quelle like '%all.media.prueflauf@web.de%' then
    raise notice 'starter_inhalte() beschränkt den Testkommentar schon.';
    return;
  end if;

  if position(anker in quelle) = 0 then
    raise exception 'Die Ankerzeile in starter_inhalte() hat sich geaendert — bitte von Hand anpassen.';
  end if;

  quelle := replace(
    quelle,
    anker,
    '  -- Nur fuer die Testkonten: Demo-Beitraege sieht jeder, und echte Konten' || chr(10) ||
    '  -- bleiben unangetastet (Schema 60, 28.09.2026).' || chr(10) ||
    '  if v_post is not null and exists (' || chr(10) ||
    '    select 1 from auth.users u' || chr(10) ||
    '     where u.id = ziel' || chr(10) ||
    '       and u.email in (''test@all-media.app'', ''all.media.prueflauf@web.de'')' || chr(10) ||
    '  ) and not exists (' || chr(10) ||
    '    select 1 from public.comments where user_id = ziel and post_id = v_post'
  );

  execute quelle;
  raise notice 'starter_inhalte() legt den Testkommentar nur noch für Testkonten an.';
end;
$$;

-- 2. Vorhandene Testkommentare echter Konten weg.
delete from public.comments k
 where k.text = 'Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen.'
   and not exists (
     select 1 from auth.users u
      where u.id = k.user_id
        and u.email in ('test@all-media.app', 'all.media.prueflauf@web.de')
   );

-- 3. Gegenprobe.
do $$
declare
  rest int;
begin
  select count(*) into rest
    from public.comments k
   where k.text = 'Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen.'
     and not exists (
       select 1 from auth.users u
        where u.id = k.user_id
          and u.email in ('test@all-media.app', 'all.media.prueflauf@web.de')
     );
  if rest > 0 then
    raise exception 'Noch % Testkommentare an echten Konten.', rest;
  end if;
end;
$$;
