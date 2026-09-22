-- =====================================================================
-- SUPABASE_SCHEMA_51_feed_rang.sql — 21.09.2026
--
-- Der Feed-Algorithmus. Bis heute sortierte All Media nach `created_at`
-- und sonst nichts — jeder sah dasselbe, in derselben Reihenfolge.
--
-- WORAUF DAS AUFBAUT
--
-- Auf Schema 28. Dort wird seit dem 06.09.2026 mitgeschrieben, wer welchen
-- Beitrag wie lange gesehen hat. Das war die Haelfte, die Vorlauf brauchte;
-- dies hier ist die andere, die sich an einem Nachmittag schreiben laesst.
-- Konzept: 2.Gehirn.md/02 Projekte/All-Media-Feed-Algorithmus-02-09-2026.md,
-- Stufe 1 (Ranking in Postgres).
--
-- WAS DIE GROSSEN PLATTFORMEN MESSEN — UND WAS DAVON HIER STEHT
--
-- Aus der Recherche vom 21.09.2026 (TikTok/ByteDance „Monolith", Adam
-- Mosseris bestaetigte Instagram-Signale) sind vier Aussagen belastbar
-- genug, um eine Formel darauf zu bauen:
--
--   1. Verweildauer ist das staerkste Signal, nicht die Likes. Ein Beitrag,
--      bei dem Menschen stehenbleiben, schlaegt einen mit vielen Likes und
--      kurzer Sichtung.
--   2. Gemessen wird je Reichweite, nicht absolut. „Likes pro Reichweite"
--      und „Weiterleitungen pro Reichweite" — sonst gewinnt immer der
--      Beitrag, der ohnehin schon ueberall stand.
--   3. Weiterleiten und Speichern wiegen schwerer als Liken. Wer etwas
--      weiterschickt, empfiehlt es; wer liket, nickt.
--   4. Die Folgezahl des Verfassers ist KEIN Faktor. Geranked wird der
--      einzelne Beitrag, nicht das Konto dahinter.
--
-- Nicht uebernommen wird alles, was ein gelerntes Modell braucht: kein
-- trainiertes Netz, keine Embeddings, keine Echtzeit-Nachfuehrung. Das ist
-- Stufe 2 und 3 des Konzepts und bei dreistelligen Nutzerzahlen weder
-- bezahlbar noch messbar besser.
--
-- WARUM DIE FUNKTION DIE BEITRAEGE UEBERGEBEN BEKOMMT
--
-- `feed_rang()` sucht sich die Beitraege nicht selbst. Sie bewertet die,
-- die ihr gereicht werden.
--
-- Das ist kein Umweg, sondern die Sicherheitsentscheidung dieser Datei.
-- Die Funktion muss `security definer` sein, weil sie die Sichtungen
-- FREMDER Menschen zusammenzaehlt — die darf nach Schema 28 niemand lesen.
-- Wuerde sie sich die Beitraege zusaetzlich selbst aussuchen, liefe sie an
-- der Sichtbarkeitspruefung von `posts` vorbei und koennte die Kennung
-- eines Beitrags zurueckgeben, den der Fragende gar nicht sehen darf.
--
-- So aber gilt: die Kandidaten kommen aus der ganz normalen, von RLS
-- gefilterten Abfrage der Oberflaeche. Wer hier nichts hineingibt, bekommt
-- nichts heraus — und niemand erfaehrt von einem Beitrag, den er nicht
-- ohnehin schon sehen durfte. Zwei Stufen, wie bei den Grossen:
-- Kandidaten holen, dann bewerten.
--
-- AGGREGATE, KEINE NAMEN
--
-- Zurueck kommen Zahlen je Beitrag. Nie, wer ihn gesehen hat. Die
-- Zuschauerliste bleibt zu, genau wie in Schema 28 festgehalten.
--
-- Alles idempotent: die Datei laesst sich mehrfach einspielen.
-- Start:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--     ../SUPABASE_SCHEMA_51_feed_rang.sql
-- =====================================================================

-- ------------------------------------------------- Das Interessenbild --

/*
 * Woran erkennt man, was jemanden interessiert?
 *
 * An den Schlagworten der Beitraege, mit denen er etwas gemacht hat. Wer
 * drei Klettervideos geliket und bei einem vierten zwei Minuten
 * stehengeblieben ist, interessiert sich fuer Klettern — das braucht kein
 * Modell, das steht in den Daten.
 *
 * Gewichtet wird nach Aufwand: speichern und weiterleiten kosten mehr
 * Entschlossenheit als ein Like, und lange hinsehen zaehlt auch dann, wenn
 * am Ende gar nichts angetippt wurde. Genau das ist der Punkt an der
 * Verweildauer: sie erfasst die stille Mehrheit.
 *
 * Nur die letzten 60 Tage. Interessen aendern sich, und ein Bild, das nie
 * vergisst, haelt einen Menschen an dem fest, was er vor einem Jahr einmal
 * angesehen hat.
 */
create or replace function public.interessenbild(wer uuid)
returns table (marke text, gewicht numeric)
language sql
security definer set search_path = public
stable
as $$
  with signal as (
    -- Geliket: das schwaechste der drei Antippsignale.
    select p.tags, 1.0::numeric as wert
      from public.post_likes l
      join public.posts p on p.id = l.post_id
     where l.user_id = wer and l.created_at > now() - interval '60 days'
    union all
    -- Gespeichert: „das will ich wiederfinden".
    select p.tags, 3.0::numeric
      from public.saves s
      join public.posts p on p.id = s.post_id
     where s.user_id = wer and s.created_at > now() - interval '60 days'
    union all
    -- Weitergeleitet: die staerkste Empfehlung, die jemand abgeben kann.
    select p.tags, 4.0::numeric
      from public.reposts r
      join public.posts p on p.id = r.post_id
     where r.user_id = wer and r.created_at > now() - interval '60 days'
    union all
    /*
     * Lange hingesehen. Ab acht Sekunden je Sichtung, und nach oben auf
     * das Gewicht eines Likes gedeckelt: die Verweildauer ist ein starkes
     * Signal fuer den EINZELNEN Beitrag, aber ein schwaches dafuer, was
     * jemand MAG — man bleibt auch an Dingen haengen, die man verabscheut.
     */
    select p.tags,
           least(i.dauer_ms::numeric / (i.sichtungen * 8000.0), 1.0)
      from public.post_impressions i
      join public.posts p on p.id = i.post_id
     where i.user_id = wer
       and i.tag > (now() - interval '60 days')::date
       and i.dauer_ms >= i.sichtungen * 8000
  )
  select lower(t.marke) as marke, sum(s.wert) as gewicht
    from signal s
    cross join lateral unnest(coalesce(s.tags, array[]::text[])) as t(marke)
   where length(trim(t.marke)) > 0
   group by lower(t.marke)
   order by gewicht desc
   limit 40;  -- Mehr als vierzig Interessen hat niemand, und lange Listen
              -- verwaessern das Bild, bis jeder Beitrag zu allem passt.
$$;

revoke execute on function public.interessenbild(uuid) from public, anon;
grant  execute on function public.interessenbild(uuid) to authenticated;

-- ------------------------------------------------------- Das Ranking --

/*
 * `feed_rang(beitraege, herkunft)` — die Punktzahl je uebergebenem Beitrag.
 *
 * Zurueck kommen die einzelnen Bausteine, nicht nur die Summe. Das ist
 * Absicht: ein Ranking, das nur eine Zahl ausspuckt, laesst sich nicht
 * pruefen und nicht erklaeren. So kann der Prueflauf einzeln nachrechnen,
 * und ein Mensch kann fragen „warum steht das oben".
 */
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
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

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
               and l.created_at > now() - interval '60 days'
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

-- ------------------------------------------------------- Nachweis --

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'feed_rang'
  ) then
    raise exception 'feed_rang() steht nicht.';
  end if;

  if has_function_privilege('anon', 'public.feed_rang(uuid[], text)', 'execute') then
    raise exception 'anon darf feed_rang() ausfuehren.';
  end if;
  if not has_function_privilege('authenticated', 'public.feed_rang(uuid[], text)', 'execute') then
    raise exception 'authenticated darf feed_rang() nicht ausfuehren.';
  end if;

  if has_function_privilege('anon', 'public.interessenbild(uuid)', 'execute') then
    raise exception 'anon darf interessenbild() ausfuehren.';
  end if;

  -- Schema 28 muss vorher da sein, sonst rechnet das Ranking auf Sand.
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'post_impressions'
  ) then
    raise exception 'post_impressions fehlt — erst SUPABASE_SCHEMA_28_impressionen.sql einspielen';
  end if;

  raise notice 'Schema 51: Der Feed hat einen Algorithmus.';
end
$$;
