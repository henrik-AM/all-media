-- AF3 / Schema 108 — ENTWURF, nicht eingespielt. Nach 107 und 82.
-- Ersetzt feed_rang aus Schema 82; keine öffentliche Negativzahl.
create table if not exists public.post_dislikes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(), primary key(post_id,user_id)
);
create index if not exists post_dislikes_eigen on public.post_dislikes(user_id, created_at);
alter table public.post_dislikes enable row level security;
revoke all on public.post_dislikes from public, anon, authenticated;
grant select on public.post_dislikes to authenticated;
drop policy if exists eigen on public.post_dislikes;
create policy eigen on public.post_dislikes for select to authenticated using(user_id=auth.uid());
drop policy if exists nur_freigegebene on public.post_dislikes;
create policy nur_freigegebene on public.post_dislikes as restrictive for all to authenticated
using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

-- Bezug und Zeit sind nicht direkt beschreibbar; keine Zählerspalte.
-- Der Lock gilt auch für direkte Likes aus älteren Clients.
create or replace function public.reaktion_ausschliessen() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || new.post_id::text,108));
  if tg_table_name='post_likes' then
    delete from public.post_dislikes where post_id=new.post_id and user_id=new.user_id;
  else
    delete from public.post_likes where post_id=new.post_id and user_id=new.user_id;
  end if;
  return new;
end $$;
revoke execute on function public.reaktion_ausschliessen() from public,anon,authenticated;
drop trigger if exists reaktion_ausschliessen on public.post_likes;
create trigger reaktion_ausschliessen before insert on public.post_likes for each row execute function public.reaktion_ausschliessen();
drop trigger if exists reaktion_ausschliessen on public.post_dislikes;
create trigger reaktion_ausschliessen before insert on public.post_dislikes for each row execute function public.reaktion_ausschliessen();

create or replace function public.beitrag_reaktion(p_post uuid,p_art text) returns boolean
language plpgsql security definer set search_path=public as $$
declare an boolean;
begin
  if auth.uid() is null or not public.konto_freigegeben() then raise exception 'Konto nicht freigegeben'; end if;
  -- Auch direkt aufgerufen kein unberechtigter Beitrag; dieselben Sichtbedingungen wie posts.
  if not exists(select 1 from public.posts p where p.id=p_post
      and public.beitrag_sichtbar(p.user_id,p.demo)
      and not public.blockiert_zwischen(auth.uid(),p.user_id)
      and (p.publish_at is null or p.publish_at<=now())) then raise exception 'Beitrag nicht sichtbar'; end if;
  if p_art not in ('like','dislike') or p_art is null then raise exception 'Unbekannte Reaktion'; end if;
  if p_art='dislike' and not exists(select 1 from public.posts where id=p_post and kind in ('reel','clip')) then raise exception 'Nur Videos'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || p_post::text,108));
  if p_art='like' then
    delete from public.post_likes where post_id=p_post and user_id=auth.uid();
    an := not found;
    if an then insert into public.post_likes(post_id,user_id) values(p_post,auth.uid()); end if;
  else
    delete from public.post_dislikes where post_id=p_post and user_id=auth.uid();
    an := not found;
    if an then insert into public.post_dislikes(post_id,user_id) values(p_post,auth.uid()); end if;
  end if;
  return an;
end $$;
revoke execute on function public.beitrag_reaktion(uuid,text) from public,anon;
grant execute on function public.beitrag_reaktion(uuid,text) to authenticated;

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

  negativ as (
    select k.id, case
      when exists(select 1 from public.post_dislikes d where d.user_id=ich and d.post_id=k.id and d.created_at>=lern_ab) then 0.02
      when exists(select 1 from public.post_dislikes d join public.posts n on n.id=d.post_id where d.user_id=ich and d.created_at>=lern_ab and n.user_id=k.user_id) then 0.3
      when exists(select 1 from public.post_dislikes d join public.posts n on n.id=d.post_id where d.user_id=ich and d.created_at>=lern_ab and n.tags && k.tags) then 0.5
      else 1.0 end as faktor from kandidat k
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
    from gerechnet g join negativ n on n.id=g.id
   order by 2 desc;
end;
$$;

revoke execute on function public.feed_rang(uuid[], text) from public, anon;
grant  execute on function public.feed_rang(uuid[], text) to authenticated;
