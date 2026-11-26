-- Schema 134 — Paket 9, Befunde der Gegenprüfung Runde 1 (Codex, 21.11.2026).
-- Nach 129–133 (alle live). Ändert nur, was die Befunde betreffen:
--   feed_rang (129)            Negativsignale nur aus lesbaren, nicht blockierten Beiträgen
--   konto_sichtung_messen (130) je Zuschauer/Beitrag/Tag höchstens 1 Aufruf und 5 Minuten
--   video_beleg_pruefen (132)  Video-Beitrag ohne Datei trägt keine Dauer
--   post_upload_loeschsperre   Clients löschen keine Beitragsdateien mehr (Server über Dienst)
--   bunny_medium_referenziert  nicht mehr direkt aufrufbar (Orakel über unsichtbare Beiträge)

drop policy if exists post_upload_loeschsperre on storage.objects;
create policy post_upload_loeschsperre on storage.objects as restrictive for delete to authenticated
using(not(bucket_id='media' and name like 'posts/%'));

revoke execute on function public.bunny_medium_referenziert(text) from public, anon, authenticated;

-- Fassung 129 + Lesbarkeit der Negativquelle.
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
  -- Schema 129: wie beitrag_reaktion nur für freigegebene Konten (Entwurf 108).
  if not public.konto_freigegeben() then
    raise exception 'Konto nicht freigegeben';
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
       -- Schema 122: unlesbare Beitraege bekommen keine Zeile (keine
       -- Zaehler, Sichtungen, kein Hinweis, dass es sie gibt).
       and public.beitrag_lesbar(p.id)
       -- Schema 129 (wie Entwurf 108): Blockierte in beide Richtungen nicht bewerten.
       and not public.blockiert_zwischen(ich, p.user_id)
  ),

  -- Schema 129 (AF3): eigene „Gefällt mir nicht" senken den Beitrag stark,
  -- dieselbe Person und gleiche Schlagworte schwächer. Nur eigene Signale.
  negativ as (
    select k.id, case
      when exists(select 1 from public.post_dislikes d where d.user_id=ich and d.post_id=k.id and d.created_at>=lern_ab) then 0.02
      when exists(select 1 from public.post_dislikes d join public.posts n on n.id=d.post_id where d.user_id=ich and d.created_at>=lern_ab and n.user_id=k.user_id and public.beitrag_lesbar(n.id) and not public.blockiert_zwischen(ich,n.user_id)) then 0.3
      when exists(select 1 from public.post_dislikes d join public.posts n on n.id=d.post_id where d.user_id=ich and d.created_at>=lern_ab and n.tags && k.tags and public.beitrag_lesbar(n.id) and not public.blockiert_zwischen(ich,n.user_id)) then 0.5
      else 1.0 end::numeric as faktor
      from kandidat k
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
    ) * g.ermuedung * (0.25 + 0.75 * g.frische) * n.faktor, 4),
    round(g.frische, 4),
    round(g.verweilwert, 4),
    round(g.resonanz, 4),
    round(g.naehe, 4),
    round(g.interesse, 4),
    round(g.ermuedung, 4),
    (g.neuling and n.faktor >= 0.5)
    from gerechnet g
    join negativ n on n.id = g.id
   order by 2 desc;
end;
$$;

revoke execute on function public.feed_rang(uuid[], text) from public, anon;
grant  execute on function public.feed_rang(uuid[], text) to authenticated;

-- Fassung 130 + Deckel je Tag.
create or replace function public.konto_sichtung_messen() returns trigger
language plpgsql security definer set search_path=public as $$
declare autor uuid; delta_s bigint; delta_d bigint; bisher bigint; heute date:=(now() at time zone 'utc')::date;
begin
 select user_id into autor from public.posts where id=new.post_id;
 if autor=new.user_id or not public.konto_freigegeben() then return new; end if;
 delta_s := greatest(0,new.sichtungen-case when tg_op='UPDATE' then old.sichtungen else 0 end);
 delta_d := greatest(0,new.dauer_ms-case when tg_op='UPDATE' then old.dauer_ms else 0 end);
 -- Auch privilegierte Direktimporte mit Null-/Kurzsichtungen nicht auswerten.
 if delta_s<1 or delta_d<1000 then return new;end if;
 /*
  * Schema 134 (Gegenprüfung R1): Die Dauer meldet der Client. Damit
  * wiederholte Meldungen die Analysen nicht aufblähen, zählt je Zuschauer,
  * Beitrag und UTC-Tag höchstens EIN Aufruf und höchstens fünf Minuten.
  */
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text||new.post_id::text||heute::text,134));
 select coalesce(sum(dauer_ms),0) into bisher from public.konto_sichtungen
  where post_id=new.post_id and zuschauer=new.user_id and tag=heute;
 delta_s := case when exists(select 1 from public.konto_sichtungen where post_id=new.post_id and zuschauer=new.user_id and tag=heute) then 0 else 1 end;
 delta_d := least(delta_d, greatest(0, 300000-bisher));
 if delta_s=0 and delta_d=0 then return new; end if;
 insert into public.konto_sichtungen(impression_id,post_id,zuschauer,tag,folgt,land,sichtungen,dauer_ms)
 values(new.id,new.post_id,new.user_id,(now() at time zone 'utc')::date,
   exists(select 1 from public.follows where follower_id=new.user_id and followee_id=autor),
   (select public.analyse_vorwahlland(phone) from public.profiles where id=new.user_id),delta_s,delta_d)
 on conflict(impression_id) do update set sichtungen=public.konto_sichtungen.sichtungen+delta_s,
   dauer_ms=public.konto_sichtungen.dauer_ms+delta_d;
 return new;
end $$;
revoke execute on function public.konto_sichtung_messen() from public,anon,authenticated;

-- Fassung 132 + keine Dauer ohne Datei.
create or replace function public.video_beleg_pruefen() returns trigger
language plpgsql security definer set search_path=public as $$
declare p text; video boolean; s double precision;
begin
 if tg_op='INSERT' and new.demo and public.ist_testkonto(new.user_id) then return new; end if;
 p := case when new.media_url like public.medien_adresse('')||'%'
           then substr(new.media_url, length(public.medien_adresse(''))+1) end;
 if tg_op='UPDATE' and new.media_url is not distinct from old.media_url and new.kind=old.kind then
   -- Andere Änderungen an Altbeiträgen bleiben möglich; belegte Dauer bleibt fest.
   if new.duration is distinct from old.duration and p is not null then
     s := intern.video_sekunden(p, new.user_id);
     if s is not null then new.duration := floor(s/60)::int::text||':'||lpad((floor(s)::int%60)::text,2,'0'); end if;
   end if;
   return new;
 end if;
 -- Schema 134: ohne Datei keine behauptete Dauer (Ausnahme Livestream-Platzhalter).
 if new.media_url is null then
   if new.kind in ('reel','clip') and coalesce(new.format,'')<>'live' then new.duration := null; end if;
   return new;
 end if;
 if p is null or split_part(p,'/',1)='beispiel' then return new; end if;
 video := new.kind in ('reel','clip') or coalesce(intern.medium_typ(p),'') like 'video/%'
          or p ~* '\.(mp4|mov|m4v|webm)$';
 if not video then return new; end if;
 s := intern.video_sekunden(p, new.user_id);
 if s is null then
   raise exception 'Bitte das Video über die geprüfte Uploadstelle hochladen.' using errcode='42501';
 end if;
 new.duration := floor(s/60)::int::text||':'||lpad((floor(s)::int%60)::text,2,'0');
 return new;
end $$;
revoke execute on function public.video_beleg_pruefen() from public,anon,authenticated;

-- ------------------------------------------------------------ Nachweis --
do $$
begin
  if has_function_privilege('authenticated','public.bunny_medium_referenziert(text)','execute') then
    raise exception 'Schema 134: Referenz-Orakel noch aufrufbar';
  end if;
  if position('beitrag_lesbar(n.id)' in pg_get_functiondef('public.feed_rang(uuid[],text)'::regprocedure)) = 0 then
    raise exception 'Schema 134: feed_rang ohne Lesbarkeit der Signalquelle';
  end if;
  if position('300000-bisher' in pg_get_functiondef('public.konto_sichtung_messen()'::regprocedure)) = 0 then
    raise exception 'Schema 134: Analysen ohne Deckel';
  end if;
end $$;
