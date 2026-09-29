-- ===========================================================================
--  SUPABASE_SCHEMA_66_verlauf_nur_eigenes.sql
--
--  WARUM ES DAS GIBT
--
--  Henrik am 21.09.2026 (Kasten 10.2): „Gespeicherte Beiträge enthalten
--  Beiträge, die Henrik nie gespeichert hat."
--
--  Weder App noch Website schreiben das. Beide legen eine `saves`-Zeile nur
--  beim Tippen auf das Lesezeichen an, immer mit der eigenen Kennung, und die
--  Regel „Eigene Merkliste" (Schema 2) lässt nichts anderes zu.
--
--  Die fremden Einträge kamen aus dem Testbestand, und zwar ohne Anmeldung —
--  also an der Leseregel vorbei:
--
--  1. SUPABASE_SCHEMA_42_testbestand_sichtbar.sql, Zeile 82–95: fügt JEDEM
--     Profil, das kein Demoprofil ist (`where not z.demo`), zwei gespeicherte
--     Demo-Beiträge hinzu. Ebenso einen Repost (Zeile 107) und drei Likes
--     (Zeile 132). Henriks Konto ist kein Demoprofil.
--  2. starter_inhalte() (Schema 7 Zeile 423, Schema 23 Zeile 446,
--     SUPABASE_EINSPIELEN.sql Zeile 2028) lief über starter_inhalte_trigger
--     bei JEDER Registrierung und legte dieselben zwei Merklisten-Einträge,
--     einen Repost und drei Likes an. Seit Schema 62 nur noch für die beiden
--     Testkonten — aber Schema 7, 23 und EINSPIELEN enthalten die alte Fassung
--     ohne Sperre. Wer eine davon neu einspielt, öffnet die Tür wieder
--     (siehe [[Schema 7 dreht Regeln zurück]]).
--  3. SUPABASE_SCHEMA_50_kommentar_sichtbar.sql: ein Testkommentar für jedes
--     echte Konto (von Schema 60 schon wieder entfernt).
--
--  Seit „Mein Verlauf" (Kasten 10.1) wären diese Zeilen doppelt falsch: sie
--  stünden dort als „Gespeichert", „Gefällt dir", „Repostet" — Dinge, die
--  Henrik nie getan hat.
--
--  WAS HIER GESCHIEHT
--
--  1. nur_eigene_aktion(): ein Wächter vor jedem INSERT auf saves,
--     post_likes, reposts, comments und shares. Eine Zeile im Namen eines
--     anderen wird nur noch angenommen, wenn dieser andere
--       - ein Demoprofil ist (Anna, Bob … — Schema 6 braucht ihre Likes und
--         Kommentare), oder
--       - eines der beiden Testkonten ist (ist_testkonto, Schema 62).
--     Für echte Konten gilt: nur sie selbst.
--
--     Angemeldet (auth.uid() gesetzt) und fremd → Fehler, wie die
--     Leseregel ihn ohnehin melden würde.
--     Ohne Anmeldung (SQL-Editor, Migration, Registrierungs-Auslöser) →
--     die Zeile wird mit einer WARNUNG übersprungen, nicht mit einem Fehler.
--     Sonst würde eine neu eingespielte alte starter_inhalte() jede
--     Registrierung eines echten Kontos scheitern lassen.
--
--     Damit bleibt jede künftige Neueinspielung von Schema 7, 23, 42, 50
--     oder EINSPIELEN wirkungslos gegenüber echten Konten.
--
--  2. Gegenprobe im selben Lauf: Wächter auf allen fünf Tabellen, keine
--     Ausführungsrechte für public/anon/authenticated.
--
--  NICHT HIER: die schon vorhandenen falschen Einträge in echten Konten.
--  Die fasst nur Henrik an. Die Anweisung dafür steht ganz unten,
--  AUSKOMMENTIERT und mit „NUR NACH FREIGABE DURCH HENRIK" markiert.
--
--  Nach dem Einspielen: npm run test:rechte und npm run test:verlauf.
-- ===========================================================================

-- 0. Voraussetzung ---------------------------------------------------------
-- Ohne Schema 62 gäbe es ist_testkonto() nicht, und der Wächter fiele erst
-- beim ersten Speichern um — mit einem Fehler für jeden Nutzer. Deshalb
-- VOR dem Anlegen prüfen, nicht hinterher.
do $$
begin
  if to_regprocedure('public.ist_testkonto(uuid)') is null then
    raise exception 'ist_testkonto() fehlt — erst SUPABASE_SCHEMA_62_nur_eigene_testkonten.sql einspielen.';
  end if;
end;
$$;

-- 1. Der Wächter -----------------------------------------------------------
create or replace function public.nur_eigene_aktion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  spalte constant text := tg_argv[0];
  wer    uuid;
  ich    uuid := auth.uid();
begin
  wer := nullif(to_jsonb(new) ->> spalte, '')::uuid;

  -- Kein Besitzer: das entscheidet die Spalte selbst (not null).
  if wer is null then
    return new;
  end if;

  -- Der Normalfall: man handelt für sich selbst.
  if ich is not null and wer = ich then
    return new;
  end if;

  -- Testbestand: Demoprofile und die beiden Testkonten dürfen befüllt werden.
  if public.ist_testkonto(wer)
     or exists (select 1 from public.profiles p where p.id = wer and p.demo) then
    return new;
  end if;

  if ich is not null then
    raise exception 'Nur im eigenen Namen: % in % für ein fremdes Konto abgelehnt (Schema 66).',
      spalte, tg_table_name
      using errcode = '42501';
  end if;

  raise warning 'Schema 66: % für ein echtes Konto ohne Anmeldung übersprungen (%).',
    tg_table_name, wer;
  return null;
end;
$$;

-- Postgres gibt EXECUTE an neuen Funktionen automatisch an PUBLIC
-- (test:rechte). Ein Auslöser braucht das Recht nicht.
revoke all on function public.nur_eigene_aktion() from public, anon, authenticated;

drop trigger if exists nur_eigene_aktion on public.saves;
create trigger nur_eigene_aktion
  before insert or update of user_id on public.saves
  for each row execute function public.nur_eigene_aktion('user_id');

drop trigger if exists nur_eigene_aktion on public.post_likes;
create trigger nur_eigene_aktion
  before insert or update of user_id on public.post_likes
  for each row execute function public.nur_eigene_aktion('user_id');

drop trigger if exists nur_eigene_aktion on public.reposts;
create trigger nur_eigene_aktion
  before insert or update of user_id on public.reposts
  for each row execute function public.nur_eigene_aktion('user_id');

drop trigger if exists nur_eigene_aktion on public.comments;
create trigger nur_eigene_aktion
  before insert or update of user_id on public.comments
  for each row execute function public.nur_eigene_aktion('user_id');

drop trigger if exists nur_eigene_aktion on public.shares;
create trigger nur_eigene_aktion
  before insert or update of shared_by on public.shares
  for each row execute function public.nur_eigene_aktion('shared_by');

-- 2. Gegenprobe ------------------------------------------------------------
do $$
declare
  fehlt text;
begin
  select string_agg(t, ', ') into fehlt
    from unnest(array['saves', 'post_likes', 'reposts', 'comments', 'shares']) t
   where not exists (
     select 1 from pg_trigger g
      where g.tgrelid = ('public.' || t)::regclass
        and g.tgname = 'nur_eigene_aktion'
        and not g.tgisinternal
   );
  if fehlt is not null then
    raise exception 'Der Wächter fehlt auf: %', fehlt;
  end if;

  if has_function_privilege('anon', 'public.nur_eigene_aktion()', 'execute')
  or has_function_privilege('authenticated', 'public.nur_eigene_aktion()', 'execute') then
    raise exception 'nur_eigene_aktion() ist für anon/authenticated ausführbar.';
  end if;
end;
$$;


-- ===========================================================================
--  AUFRÄUMEN — NUR NACH FREIGABE DURCH HENRIK
--
--  Absichtlich auskommentiert. Diese Datei einzuspielen löscht NICHTS.
--
--  Was es trifft: Einträge in saves, reposts, post_likes und comments von
--  ECHTEN Konten (nicht @test, nicht @prueflauf, kein Demoprofil), die
--  nachweislich aus dem Testbestand stammen. „Nachweislich" heißt, BEIDES
--  gilt:
--
--    a) Der Beitrag ist ein Demo-Beitrag eines Demoprofils (Anna, Bob …).
--       Nur solche hat der Testbestand seit Schema 42 ausgewählt.
--    b) Der Zeitpunkt trägt den Fingerabdruck einer Massen-Einfügung:
--       - derselbe Zeitpunkt (auf die Mikrosekunde) wie eine Zeile eines
--         ANDEREN Kontos in derselben Tabelle — so sieht ein
--         `insert … select … from profiles` wie in Schema 42 aus, eine
--         Anweisung, ein now() für alle; oder
--       - derselbe Zeitpunkt wie die Registrierung des Kontos
--         (profiles.created_at) — so sieht starter_inhalte() aus, das im
--         selben Vorgang wie die Registrierung lief.
--       Ein echtes Antippen hat seinen eigenen Zeitpunkt.
--    Kommentare: nur der wörtliche Testkommentar aus starter_inhalte().
--
--  Wen es betrifft: alle echten Konten mit solchen Einträgen — laut Schema 60
--  und 62 sechs (@h.dikta, @henrik1848, @jarno.riegel, @tanti, @user.hugo,
--  @ralle), Stand 28.09.2026; Schritt A zeigt den tatsächlichen Stand.
--  Nicht nur Henriks. Die anderen fünf sind Personen, die Henrik kennt; ihre
--  Einträge gehören ebenso wenig ihnen, aber auch darüber entscheidet Henrik.
--
--  Was es NICHT erkennt: Hätte jemand zufällig in derselben Mikrosekunde
--  wie die Massen-Einfügung selbst etwas gespeichert — praktisch
--  ausgeschlossen, aber der Vollständigkeit halber genannt. Umgekehrt bleibt
--  ein Seed-Eintrag stehen, dessen Zeitpunkt später von Hand geändert wurde.
--
--  Ablauf im SQL-Editor, in EINER Sitzung:
--    Schritt A ausführen → Liste ansehen → Henrik zeigen.
--    Nur nach seinem Ja: Schritt B ausführen. B prüft selbst nach und bricht
--    ab (alles zurück), wenn danach noch ein Fund übrig ist — ein
--    abgelehntes DELETE meldet sonst Erfolg.
--
--  AUSGEFÜHRT am 29.09.2026 nach Henriks Freigabe („vervollständige bitte
--  die noch offenen Sachen"): 33 Zeilen, Sicherung im Vault unter
--  07 Anhänge/All-Media Seed-Sicherung 2026-09-29.json. Schritt A fand 26.
--  Die Regel b) vergleicht nur innerhalb einer Tabelle; 7 Seed-Zeilen trugen
--  denselben Zeitstempel nur in einer anderen Tabelle oder nur bei einem
--  Konto (starter_inhalte() bei der ersten Anmeldung, @tanti) und kamen mit
--  einer breiteren Suche dazu: gleiche Mikrosekunde bei mehreren Konten
--  ODER in mehreren Tabellen. Siehe SUPABASE_REIHENFOLGE.md.
-- ===========================================================================

/*
-- Schritt A: Vorschau (liest nur) ------------------------------------------
drop table if exists pg_temp.seed_funde;
create temp table seed_funde as
with echt as (
  select z.id, z.created_at
    from public.profiles z
   where not coalesce(z.demo, false)
     and not public.ist_testkonto(z.id)
),
demo_beitrag as (
  select b.id
    from public.posts b
    join public.profiles bp on bp.id = b.user_id
   where b.demo and bp.demo
)
select 'saves'::text as tabelle, s.user_id, s.post_id, null::uuid as kommentar_id, s.created_at
  from public.saves s
  join echt e on e.id = s.user_id
 where s.post_id in (select id from demo_beitrag)
   and (s.created_at = e.created_at
        or exists (select 1 from public.saves x
                    where x.created_at = s.created_at and x.user_id <> s.user_id))
union all
select 'reposts', r.user_id, r.post_id, null, r.created_at
  from public.reposts r
  join echt e on e.id = r.user_id
 where r.post_id in (select id from demo_beitrag)
   and (r.created_at = e.created_at
        or exists (select 1 from public.reposts x
                    where x.created_at = r.created_at and x.user_id <> r.user_id))
union all
select 'post_likes', l.user_id, l.post_id, null, l.created_at
  from public.post_likes l
  join echt e on e.id = l.user_id
 where l.post_id in (select id from demo_beitrag)
   and (l.created_at = e.created_at
        or exists (select 1 from public.post_likes x
                    where x.created_at = l.created_at and x.user_id <> l.user_id))
union all
select 'comments', k.user_id, k.post_id, k.id, k.created_at
  from public.comments k
  join echt e on e.id = k.user_id
 where k.text = 'Testkommentar — zum Prüfen von Antworten, Gefällt mir und Löschen.';

select p.handle, f.tabelle, count(*) as anzahl, min(f.created_at) as ab, max(f.created_at) as bis
  from seed_funde f
  join public.profiles p on p.id = f.user_id
 group by p.handle, f.tabelle
 order by p.handle, f.tabelle;


-- Schritt B: Löschen — NUR NACH FREIGABE DURCH HENRIK ----------------------
do $$
declare
  vorher bigint;
  weg    bigint := 0;
  n      bigint;
  rest   bigint;
begin
  select count(*) into vorher from seed_funde;

  delete from public.saves s using seed_funde f
   where f.tabelle = 'saves' and s.user_id = f.user_id and s.post_id = f.post_id;
  get diagnostics n = row_count; weg := weg + n;

  delete from public.reposts r using seed_funde f
   where f.tabelle = 'reposts' and r.user_id = f.user_id and r.post_id = f.post_id;
  get diagnostics n = row_count; weg := weg + n;

  delete from public.post_likes l using seed_funde f
   where f.tabelle = 'post_likes' and l.user_id = f.user_id and l.post_id = f.post_id;
  get diagnostics n = row_count; weg := weg + n;

  delete from public.comments k using seed_funde f
   where f.tabelle = 'comments' and k.id = f.kommentar_id;
  get diagnostics n = row_count; weg := weg + n;

  -- Gegenprobe: steht noch einer der Funde in der Datenbank?
  select count(*) into rest from seed_funde f
   where (f.tabelle = 'saves'      and exists (select 1 from public.saves      x where x.user_id = f.user_id and x.post_id = f.post_id))
      or (f.tabelle = 'reposts'    and exists (select 1 from public.reposts    x where x.user_id = f.user_id and x.post_id = f.post_id))
      or (f.tabelle = 'post_likes' and exists (select 1 from public.post_likes x where x.user_id = f.user_id and x.post_id = f.post_id))
      or (f.tabelle = 'comments'   and exists (select 1 from public.comments   x where x.id = f.kommentar_id));
  if rest > 0 then
    raise exception 'Nach dem Löschen stehen noch % von % Funden da — alles zurück.', rest, vorher;
  end if;

  raise notice 'Aufgeräumt: % Funde, % Zeilen gelöscht, Gegenprobe leer.', vorher, weg;
end;
$$;
*/
