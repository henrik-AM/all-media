-- ===========================================================================
--  SUPABASE_SCHEMA_82_feed_lenkung.sql                          (06.10.2026)
--  Kasten 24 — „Algorithmus selbst lenken" (Einstellungen → Videos →
--  „Feed steuern"). Entwurf, noch NICHT eingespielt.
--
--  WARUM
--
--  Henrik am 06.10.2026: „Ein Nutzer soll die Möglichkeit haben, seinen
--  Algorithmus selbstständig in eine Richtung zu lenken (Einstellungsbereich
--  unter Einstellungen → Videos), durch Eingabe von #/Sounds/Orten/
--  Profilen/etc." Vorbilder: TikTok „Themen verwalten" / „Schlüsselwörter
--  filtern" / „For You zurücksetzen", Instagram „Dein Algorithmus" und
--  „Vorgeschlagene Inhalte zurücksetzen", YouTube „Kanal nicht empfehlen".
--
--  WAS DIESE DATEI TUT
--
--  1. Tabelle `feed_lenkung`: je Konto Einträge (Art, Wert, Richtung).
--     Arten: hashtag, sound, ort, profil, wort (Stichwort). Richtung: mehr,
--     weniger. Jeder sieht und ändert nur die eigenen Zeilen; Konten ohne
--     Elternfreigabe gar nicht (nur_freigegebene, Schema 52/74).
--     Höchstens 200 Einträge je Konto (Auslöser).
--
--     Gewichtet wird NICHT hier, sondern in gemeinsam/lenkung.js +
--     gemeinsam/rang.js — dieselbe Datei in App und Website, deshalb
--     dieselbe Reihenfolge auf beiden Seiten, und ohne Datenbank prüfbar
--     (app/test/_lenkung_einheit.js). Die Lenkung betrifft nur den eigenen
--     Feed; was andere betrifft, entscheidet sie nicht.
--
--  2. Tabelle `feed_neustart`: der Zeitpunkt des letzten „Feed
--     zurücksetzen". Ab da zählen gelernte Signale neu.
--
--  3. Funktion `feed_zuruecksetzen()`: löscht die eigenen Einträge in
--     feed_lenkung und kein_interesse (Schema 55) und setzt feed_neustart
--     auf jetzt. Genau das steht als Text in gemeinsam/lenkung.js
--     (RESET_TEXT) — ändert sich das eine, muss sich das andere ändern.
--     Likes, Gespeichertes, Reposts, Folgen und Sichtungen bleiben; die
--     Sichtungen fremder Beiträge tragen deren Verweildauer für alle.
--
--  4. ERSETZT `interessenbild(uuid)` aus SUPABASE_SCHEMA_51_feed_rang.sql
--     (live geprüft am 06.10.2026: Funktionstext identisch mit Schema 51).
--     Neu: Signale erst ab feed_neustart; und die Funktion antwortet nur
--     noch für das eigene Konto (`wer = auth.uid()`). Vorher konnte jeder
--     Angemeldete das Interessenbild jedes anderen abfragen — security
--     definer, an authenticated freigegeben. feed_rang() ruft sie nur mit
--     der eigenen Kennung, der Prüflauf _rang.js ebenso.
--
--  5. ERSETZT `feed_rang(uuid[], text)` aus SUPABASE_SCHEMA_51_feed_rang.sql
--     (live identisch mit Schema 51). Einzige Änderung: der Like-Anteil der
--     NÄHE zählt Likes erst ab feed_neustart (Variable `lern_ab`). Formel,
--     Gewichte, Altersdämpfung und Neuling bleiben Wort für Wort.
--
--  Testbestand: /api/reset (web/server/app.js) leert feed_lenkung und
--  feed_neustart des Testkontos — wie bei kein_interesse (Schema 55), damit
--  keine sechste Fassung von zuruecksetzen() entsteht.
--
--  Idempotent: if not exists, create or replace, drop policy/trigger if exists.
--  Danach: SUPABASE_REIHENFOLGE.md um interessenbild() und feed_rang()
--  ergänzen (51 → diese Datei), npm run test:rechte, test:minderjaehrig,
--  test:rang, test:lenken.
-- ===========================================================================

-- ------------------------------------------------------ 1. feed_lenkung --

create table if not exists public.feed_lenkung (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  art        text not null,
  wert       text not null,
  anzeige    text not null default '',
  richtung   text not null,
  created_at timestamptz not null default now(),
  constraint feed_lenkung_einmal unique (user_id, art, wert),
  constraint feed_lenkung_art check (art in ('hashtag', 'sound', 'ort', 'profil', 'wort')),
  constraint feed_lenkung_richtung check (richtung in ('mehr', 'weniger')),
  constraint feed_lenkung_anzeige check (char_length(anzeige) <= 120),
  /*
   * Dieselbe Form, die gemeinsam/lenkung.js `normalisieren()` erzeugt. Ein
   * Wert in anderer Form würde nie treffen — dann lieber gleich abweisen.
   */
  constraint feed_lenkung_wert check (
       (art = 'hashtag' and wert ~ '^#[^[:space:]#]{1,60}$' and wert = lower(wert))
    or (art in ('sound', 'profil')
        and wert ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$')
    or (art in ('ort', 'wort') and char_length(wert) between 2 and 80 and wert = lower(wert))
  )
);

create index if not exists feed_lenkung_wer on public.feed_lenkung (user_id);

alter table public.feed_lenkung enable row level security;

revoke all on public.feed_lenkung from anon, public;
grant select, insert, update, delete on public.feed_lenkung to authenticated;

drop policy if exists "Lenkung lesen" on public.feed_lenkung;
create policy "Lenkung lesen" on public.feed_lenkung
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Lenkung anlegen" on public.feed_lenkung;
create policy "Lenkung anlegen" on public.feed_lenkung
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Lenkung aendern" on public.feed_lenkung;
create policy "Lenkung aendern" on public.feed_lenkung
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Lenkung entfernen" on public.feed_lenkung;
create policy "Lenkung entfernen" on public.feed_lenkung
  for delete to authenticated using (auth.uid() = user_id);

-- Konten, die noch auf die Elternfreigabe warten (Schema 52, Teil 4 / 74).
drop policy if exists nur_freigegebene on public.feed_lenkung;
create policy nur_freigegebene on public.feed_lenkung
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

/*
 * Höchstens 200 Einträge je Konto. Mehr lenkt nicht mehr, es verwässert —
 * und die Faktorrechnung läuft je Beitrag über alle Einträge.
 */
create or replace function public.feed_lenkung_grenze()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (select count(*) from public.feed_lenkung where user_id = new.user_id) >= 200 then
    raise exception 'Höchstens 200 Einträge unter „Feed steuern"';
  end if;
  return new;
end;
$$;

revoke execute on function public.feed_lenkung_grenze() from public, anon;

drop trigger if exists feed_lenkung_grenze on public.feed_lenkung;
create trigger feed_lenkung_grenze
  before insert on public.feed_lenkung
  for each row execute function public.feed_lenkung_grenze();

-- ----------------------------------------------------- 2. feed_neustart --

create table if not exists public.feed_neustart (
  user_id   uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  zeitpunkt timestamptz not null default now()
);

alter table public.feed_neustart enable row level security;

revoke all on public.feed_neustart from anon, public;
grant select, insert, update, delete on public.feed_neustart to authenticated;

drop policy if exists "Neustart lesen" on public.feed_neustart;
create policy "Neustart lesen" on public.feed_neustart
  for select to authenticated using (auth.uid() = user_id);

-- Kein Zeitpunkt in der Zukunft: der würde das Lernen still abschalten.
drop policy if exists "Neustart setzen" on public.feed_neustart;
create policy "Neustart setzen" on public.feed_neustart
  for insert to authenticated with check (auth.uid() = user_id and zeitpunkt <= now());

drop policy if exists "Neustart aendern" on public.feed_neustart;
create policy "Neustart aendern" on public.feed_neustart
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id and zeitpunkt <= now());

drop policy if exists "Neustart entfernen" on public.feed_neustart;
create policy "Neustart entfernen" on public.feed_neustart
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists nur_freigegebene on public.feed_neustart;
create policy nur_freigegebene on public.feed_neustart
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

-- ----------------------------------------------- 3. feed_zuruecksetzen() --

/*
 * Security INVOKER: läuft unter den Regeln des Aufrufers. Er darf genau
 * seine eigenen Zeilen löschen und seinen eigenen Neustart setzen — mehr
 * braucht die Funktion nicht, und nur_freigegebene greift mit.
 */
create or replace function public.feed_zuruecksetzen()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  ich uuid := auth.uid();
  n_lenkung integer;
  n_kein integer;
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  with weg as (delete from public.feed_lenkung where user_id = ich returning 1)
  select count(*) into n_lenkung from weg;

  with weg as (delete from public.kein_interesse where user_id = ich returning 1)
  select count(*) into n_kein from weg;

  insert into public.feed_neustart (user_id, zeitpunkt) values (ich, now())
  on conflict (user_id) do update set zeitpunkt = excluded.zeitpunkt;

  return jsonb_build_object(
    'ok', true,
    'eintraege', n_lenkung,
    'kein_interesse', n_kein,
    'seit', now()
  );
end;
$$;

revoke execute on function public.feed_zuruecksetzen() from public, anon;
grant  execute on function public.feed_zuruecksetzen() to authenticated;

-- --------------------------------------------- 4. interessenbild(uuid) --
-- Ersetzt die Fassung aus SUPABASE_SCHEMA_51_feed_rang.sql.

create or replace function public.interessenbild(wer uuid)
returns table (marke text, gewicht numeric)
language sql
security definer set search_path = public
stable
as $$
  /*
   * Ab wann gelernt wird: 60 Tage zurück wie bisher — oder, wenn jemand
   * seinen Feed zurückgesetzt hat (Kasten 24), erst ab diesem Zeitpunkt.
   */
  with grenze as (
    select greatest(now() - interval '60 days',
                    coalesce((select n.zeitpunkt from public.feed_neustart n where n.user_id = wer),
                             '-infinity'::timestamptz)) as ab,
           coalesce((select n.zeitpunkt from public.feed_neustart n where n.user_id = wer),
                    '-infinity'::timestamptz) as neustart
  ),
  signal as (
    -- Geliket: das schwaechste der drei Antippsignale.
    select p.tags, 1.0::numeric as wert
      from public.post_likes l
      join public.posts p on p.id = l.post_id
     where l.user_id = wer and l.created_at > (select ab from grenze)
    union all
    -- Gespeichert: „das will ich wiederfinden".
    select p.tags, 3.0::numeric
      from public.saves s
      join public.posts p on p.id = s.post_id
     where s.user_id = wer and s.created_at > (select ab from grenze)
    union all
    -- Weitergeleitet: die staerkste Empfehlung, die jemand abgeben kann.
    select p.tags, 4.0::numeric
      from public.reposts r
      join public.posts p on p.id = r.post_id
     where r.user_id = wer and r.created_at > (select ab from grenze)
    union all
    /*
     * Lange hingesehen. Ab acht Sekunden je Sichtung, gedeckelt auf das
     * Gewicht eines Likes (Begründung in Schema 51). Sichtungen werden je
     * Tag in einer Zeile gesammelt; nach einem Neustart zählt eine Zeile
     * erst, wenn sie danach angelegt wurde — die Sichtungen vom Vormittag
     * des Neustart-Tages bleiben vergessen.
     */
    select p.tags,
           least(i.dauer_ms::numeric / (i.sichtungen * 8000.0), 1.0)
      from public.post_impressions i
      join public.posts p on p.id = i.post_id
     where i.user_id = wer
       and i.tag > (now() - interval '60 days')::date
       and i.created_at > (select neustart from grenze)
       and i.dauer_ms >= i.sichtungen * 8000
  )
  select lower(t.marke) as marke, sum(s.wert) as gewicht
    from signal s
    cross join lateral unnest(coalesce(s.tags, array[]::text[])) as t(marke)
   where length(trim(t.marke)) > 0
     -- Nur das eigene Bild (Kasten 24, siehe Kopf): fremde Interessen gehen
     -- niemanden etwas an.
     and wer = auth.uid()
   group by lower(t.marke)
   order by gewicht desc
   limit 40;  -- Mehr als vierzig Interessen hat niemand (Schema 51).
$$;

revoke execute on function public.interessenbild(uuid) from public, anon;
grant  execute on function public.interessenbild(uuid) to authenticated;

-- ------------------------------------------- 5. feed_rang(uuid[], text) --
-- Ersetzt die Fassung aus SUPABASE_SCHEMA_51_feed_rang.sql. Wort für Wort
-- übernommen; geändert ist nur `lern_ab` (Deklaration, Berechnung, NÄHE).

create or replace function public.feed_rang(
  beitraege uuid[],
  herkunft  text default 'feed'
)
returns table (
  post_id      uuid,
  punkte       numeric,
  frische      numeric,
  verweilwert  numeric,
  resonanz     numeric,
  naehe        numeric,
  interesse    numeric,
  ermuedung    numeric,
  neuling      boolean
)
language plpgsql
security definer set search_path = public
stable
as $$
declare
  ich uuid := auth.uid();
  /*
   * Kasten 24: ab wann gelernte Signale zaehlen. Sonst 60 Tage zurueck;
   * nach „Feed zuruecksetzen" erst ab diesem Zeitpunkt (feed_neustart).
   */
  lern_ab timestamptz;
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  select greatest(now() - interval '60 days',
                  coalesce((select n.zeitpunkt from public.feed_neustart n where n.user_id = ich),
                           '-infinity'::timestamptz))
    into lern_ab;

  if herkunft not in ('feed', 'reels', 'explorer', 'profil', 'community') then
    raise exception 'unbekannte Herkunft: %', herkunft;
  end if;

  /*
   * Dieselbe Obergrenze wie beim Mitschreiben, aus demselben Grund: ein
   * Aufruf darf die Datenbank nicht beschaeftigen. Die Oberflaeche holt
   * 300 Kandidaten, das ist die Hausnummer.
   */
  if coalesce(array_length(beitraege, 1), 0) > 500 then
    raise exception 'zu viele Beitraege auf einmal';
  end if;

  return query
  with kandidat as (
    select p.id, p.user_id, p.kind, p.tags, p.created_at, p.views,
           coalesce(p.likes_basis, 0)    as likes_sockel,
           coalesce(p.comments_basis, 0) as kommentar_sockel,
           coalesce(p.shares_basis, 0)   as teil_sockel
      from public.posts p
     where p.id = any(beitraege)
  ),

  -- Was der Beitrag bei allen zusammen ausgeloest hat.
  echo as (
    select k.id,
           (select count(*) from public.post_likes l where l.post_id = k.id) as likes,
           (select count(*) from public.comments  c where c.post_id = k.id) as kommentare,
           (select count(*) from public.saves     s where s.post_id = k.id) as gemerkt,
           (select count(*) from public.reposts   r where r.post_id = k.id) as geteilt
      from kandidat k
  ),

  -- Wie lange bei diesem Beitrag stehengeblieben wurde, von allen.
  sicht as (
    select k.id,
           coalesce(sum(i.sichtungen), 0)::numeric as sichtungen,
           coalesce(sum(i.dauer_ms), 0)::numeric   as dauer
      from kandidat k
      left join public.post_impressions i on i.post_id = k.id
     group by k.id
  ),

  -- Und wie oft ICH ihn schon gesehen habe.
  meine_sicht as (
    select k.id, coalesce(sum(i.sichtungen), 0)::numeric as sichtungen
      from kandidat k
      left join public.post_impressions i
             on i.post_id = k.id and i.user_id = ich
     group by k.id
  ),

  bild as (select marke, gewicht from public.interessenbild(ich)),
  bild_spitze as (select greatest(max(gewicht), 1.0) as spitze from bild),

  gerechnet as (
    select
      k.id,
      k.user_id,

      /*
       * ALTER. Halbwertszeit 36 Stunden.
       *
       * Nicht kuerzer: All Media hat keinen Nachschub im Minutentakt wie
       * TikTok. Wer hier auf sechs Stunden verfaellt, hat nach einem
       * ruhigen Tag einen leeren Feed. Nicht laenger: sonst steht die
       * gleiche Woche zwei Wochen lang oben.
       *
       * Beitraege aus der Zukunft („spaeter posten") koennen hier nicht
       * ankommen, die filtert schon die Kandidatenabfrage.
       */
      exp(-1.0 * extract(epoch from (now() - k.created_at)) / 3600.0 / 36.0)::numeric
        as frische,

      /*
       * VERWEILDAUER — das staerkste Signal.
       *
       * Durchschnitt je Sichtung, gemessen an acht Sekunden. Acht, weil das
       * ungefaehr die Grenze ist, ab der jemand nicht mehr vorbeiscrollt,
       * sondern hinsieht. Gedeckelt bei 1,5: ein einzelner sehr langer
       * Beitrag soll vorne stehen, aber nicht alles andere verdraengen.
       *
       * Wer noch gar nicht gesehen wurde, bekommt hier 0 und faengt das
       * unten ueber den Neuling-Bonus wieder auf. Eine 0 ist hier richtig
       * und nicht ungerecht: „hat noch niemanden festgehalten" ist die
       * Wahrheit ueber diesen Beitrag.
       */
      case when s.sichtungen > 0
           then least(s.dauer / s.sichtungen / 8000.0, 1.5)
           else 0.0 end::numeric as verweilwert,

      /*
       * RESONANZ — Reaktionen je Reichweite, nicht absolut.
       *
       * Gewichtet nach dem, was die Reaktion kostet: weiterleiten (4) und
       * speichern (3) vor kommentieren (2) vor liken (1). Genau die
       * Reihenfolge, die Mosseri fuer Instagram bestaetigt hat und die bei
       * TikTok ueber die Art der Weiterleitung noch feiner abgestuft wird.
       *
       * Die Sockelzahlen der Beispielinhalte zaehlen mit, sonst stuende
       * der ganze Demobestand auf null und der Feed saehe im Testkonto
       * anders aus als spaeter im Betrieb. Dann muss aber auch `views` in
       * die Reichweite, sonst haette ein Demobeitrag mit 400 Likes und
       * null gemessenen Sichtungen eine unendliche Rate.
       *
       * Gedeckelt bei 2,0. Ohne Deckel gewinnt jedes Mal der Beitrag mit
       * drei Sichtungen und zwei Likes.
       */
      least(
        (   ( e.likes      + k.likes_sockel     ) * 1.0
          + ( e.kommentare + k.kommentar_sockel ) * 2.0
          + ( e.gemerkt                         ) * 3.0
          + ( e.geteilt    + k.teil_sockel      ) * 4.0
        ) / greatest(s.sichtungen, coalesce(k.views, 0)::numeric, 1.0),
        2.0)::numeric as resonanz,

      /*
       * NAEHE. Folge ich der Person? Habe ich frueher auf sie reagiert?
       *
       * Das ist der Punkt, an dem All Media bewusst anders ist als TikTok.
       * Dort zaehlt die Beziehung fast nichts, der Interessengraph regiert.
       * Hier ist der Feed aber auch der Ort, an dem man sieht, was die
       * eigenen Leute machen — wer jemandem folgt, hat eine Entscheidung
       * getroffen, und die soll etwas wert sein.
       *
       * Der eigene Beitrag bekommt keine Naehe: man muss sich nicht selbst
       * empfohlen werden.
       */
      ( case when k.user_id = ich then 0.0
             when exists (select 1 from public.follows f
                           where f.follower_id = ich and f.followee_id = k.user_id)
             then 1.0 else 0.0 end
      + least(
          ( select count(*) from public.post_likes l
              join public.posts p2 on p2.id = l.post_id
             where l.user_id = ich and p2.user_id = k.user_id
               and l.created_at > lern_ab  -- Kasten 24: seit „Feed zuruecksetzen"
          )::numeric / 5.0, 0.6)
      )::numeric as naehe,

      /*
       * INTERESSE. Wie gut passen die Schlagworte zu dem, was mich bisher
       * gehalten hat.
       *
       * Geteilt durch die Spitze des eigenen Interessenbildes, damit der
       * Wert zwischen 0 und 1 bleibt, egal ob jemand seit drei Tagen oder
       * seit drei Monaten dabei ist. Und geteilt durch die Wurzel der
       * Schlagwortzahl: wer zwanzig Hashtags daruntersetzt, trifft sonst
       * immer irgendetwas.
       */
      case
        when coalesce(array_length(k.tags, 1), 0) = 0 then 0.0
        else least(
          ( select coalesce(sum(b.gewicht), 0)
              from unnest(k.tags) as t(marke)
              join bild b on b.marke = lower(t.marke)
          ) / (select spitze from bild_spitze)
            / sqrt(array_length(k.tags, 1)::numeric),
          1.0)
      end::numeric as interesse,

      /*
       * ERMUEDUNG. Was ich schon gesehen habe, will ich nicht schon wieder
       * sehen.
       *
       * Kein hartes Ausblenden, sondern ein Nachlassen: beim zweiten Mal
       * noch fast voll, beim fuenften kaum noch. Hart ausblenden waere
       * falsch, weil dieselbe Zeile auch entsteht, wenn jemand im Feed
       * kurz hoch und wieder runter gescrollt hat.
       *
       * Ausgenommen sind Profil und Community: dort will man genau die
       * Beitraege einer Person sehen, auch zum zehnten Mal.
       */
      case when herkunft in ('profil', 'community') then 1.0
           else 1.0 / (1.0 + 0.5 * m.sichtungen) end::numeric as ermuedung,

      /*
       * NEULING. Wer noch fast niemandem gezeigt wurde, bekommt eine
       * Chance.
       *
       * Ohne das friert jedes Ranking ein: ein Beitrag ohne Sichtungen hat
       * keine Verweildauer und keine Resonanz, steht deshalb hinten, wird
       * deshalb nicht gesehen, hat deshalb weiter keine Sichtungen. Die
       * grossen Plattformen loesen das ueber einen Erprobungsstapel —
       * jedes neue Video geht erst an eine kleine Gruppe. Hier ist es ein
       * Bonus mit Ablaufdatum: nach zehn Sichtungen traegt sich der
       * Beitrag selbst, oder eben nicht.
       */
      (s.sichtungen < 10)::boolean as neuling,

      /*
       * Und ein Hauch Zufall — fest je Person, Beitrag und Tag.
       *
       * Fest, weil ein Feed, der sich bei jedem Aktualisieren neu wuerfelt,
       * sich kaputt anfuehlt: man scrollt zurueck und findet nichts wieder.
       * Ueberhaupt Zufall, weil sonst alle mit aehnlichem Verhalten
       * denselben Feed bekommen und nie etwas Neues dazukommt.
       */
      ( abs(('x' || substr(md5(ich::text || k.id::text ||
            (now() at time zone 'utc')::date::text), 1, 8))::bit(32)::bigint)
        % 1000 )::numeric / 1000.0 * 0.15 as wuerfel

      from kandidat k
      join echo        e on e.id = k.id
      join sicht       s on s.id = k.id
      join meine_sicht m on m.id = k.id
  )

  /*
   * DIE FORMEL.
   *
   * Die Summe ist, was der Beitrag wert ist: Verweildauer und Resonanz —
   * was er kann —, Naehe und Interesse — was er mit mir zu tun hat —, und
   * der Neuling-Bonus fuer den, der noch nichts zeigen konnte.
   *
   * Die beiden Faktoren dahinter sind die Bremsen, und sie sind mit Absicht
   * Faktoren und keine Summanden:
   *
   *   - ERMUEDUNG dreht ab, was ich schon kenne.
   *   - ALTER daempft ALLES, nicht nur sich selbst.
   *
   * Beim Alter war das zuerst anders: es stand als `frische * 2.0` in der
   * Summe. Dann verfaellt aber nur der Zeitbonus, waehrend die Resonanz
   * ewig weiterzaehlt — und ein drei Wochen alter Beitrag mit vielen
   * Reaktionen steht auf Dauer ueber jedem neuen. Genau das war am
   * 21.09.2026 im Testbestand zu sehen: oben vier Beitraege aus der
   * Vorwoche, der taggleiche ganz unten. Ein Feed, der so rechnet, friert
   * in der Vergangenheit ein.
   *
   * Der Boden von 0,25 sorgt dafuer, dass Alter daempft und nicht loescht.
   * Ohne ihn waere der Feed nach einem ruhigen Wochenende leer — All Media
   * hat keinen Nachschub im Minutentakt.
   *
   * Die Gewichte sind nicht gelernt, sondern gesetzt — bei dieser
   * Nutzerzahl gibt es nichts, woran sich etwas lernen liesse. Sie stehen
   * hier offen da, damit man sie aendern kann, ohne die Funktion zu
   * verstehen.
   */
  select
    g.id,
    round((
        g.verweilwert * 3.0
      + g.resonanz    * 2.0
      + g.naehe       * 1.5
      + g.interesse   * 2.5
      + case when g.neuling then 1.2 else 0.0 end
      + g.wuerfel
    ) * g.ermuedung * (0.25 + 0.75 * g.frische), 4),
    round(g.frische, 4),
    round(g.verweilwert, 4),
    round(g.resonanz, 4),
    round(g.naehe, 4),
    round(g.interesse, 4),
    round(g.ermuedung, 4),
    g.neuling
    from gerechnet g
   order by 2 desc;
end;
$$;

revoke execute on function public.feed_rang(uuid[], text) from public, anon;
grant  execute on function public.feed_rang(uuid[], text) to authenticated;

-- ------------------------------------------------------------ Nachweis --

do $$
declare
  t text;
begin
  foreach t in array array['feed_lenkung', 'feed_neustart'] loop
    if to_regclass('public.' || t) is null then
      raise exception '% fehlt', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = ('public.' || t)::regclass) then
      raise exception 'RLS auf % ist aus', t;
    end if;
    if not exists (select 1 from pg_policies
                    where schemaname = 'public' and tablename = t
                      and policyname = 'nur_freigegebene' and permissive = 'RESTRICTIVE') then
      raise exception 'nur_freigegebene fehlt auf %', t;
    end if;
    if has_table_privilege('anon', 'public.' || t, 'select') then
      raise exception 'anon darf % lesen', t;
    end if;
  end loop;

  if has_function_privilege('anon', 'public.feed_zuruecksetzen()', 'execute') then
    raise exception 'anon darf feed_zuruecksetzen() ausfuehren';
  end if;
  if not has_function_privilege('authenticated', 'public.feed_zuruecksetzen()', 'execute') then
    raise exception 'authenticated darf feed_zuruecksetzen() nicht ausfuehren';
  end if;
  if has_function_privilege('anon', 'public.feed_rang(uuid[], text)', 'execute') then
    raise exception 'anon darf feed_rang() ausfuehren';
  end if;
  if has_function_privilege('anon', 'public.interessenbild(uuid)', 'execute') then
    raise exception 'anon darf interessenbild() ausfuehren';
  end if;
  if has_function_privilege('anon', 'public.feed_lenkung_grenze()', 'execute') then
    raise exception 'anon darf feed_lenkung_grenze() ausfuehren';
  end if;
  if position('lern_ab' in (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                             where n.nspname = 'public' and p.proname = 'feed_rang')) = 0 then
    raise exception 'feed_rang() ist noch die Fassung aus Schema 51';
  end if;

  raise notice 'Schema 82: Feed steuern steht (feed_lenkung, feed_neustart, feed_zuruecksetzen).';
end
$$;
