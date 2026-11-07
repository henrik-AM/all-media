-- =====================================================================
-- SUPABASE_SCHEMA_122_rpc_nur_sichtbare_beitraege.sql — 07.11.2026
--
-- Codex-Fund (mittel) beim Gegencheck zu Schema 121: security-definer-
-- Funktionen umgehen RLS und damit die Regel „nur sichtbare Beiträge"
-- aus Schema 119. Wer eine Beitrags-ID kennt, die er nicht lesen darf
-- (demo-Beitrag, geplanter Beitrag, moderierter Beitrag, Beitrag einer
-- blockierten/unsichtbaren Person), konnte
--   1. impression_vermerken() (zuletzt Schema 28; auch über
--      impressionen_vermerken()) Sichtungen darauf schreiben — färbt das
--      Ranking und verrät per Fehler/Erfolg, ob es den Beitrag gibt;
--   2. spende_senden() (zuletzt Schema 101) mit p_post auf diesen Beitrag
--      spenden — die Spende hängt dann an einem unsichtbaren Beitrag;
--   3. feed_rang() (zuletzt Schema 82) beliebige IDs bewerten lassen und
--      bekam Zeilen mit Resonanz, Verweildauer, Neuling — Existenz und
--      Reaktionen eines unsichtbaren Beitrags (eigener Fund, gleiches Muster).
--
-- Jetzt prüfen alle drei `beitrag_lesbar()` aus Schema 119 (dieselbe
-- Hilfsfunktion wie die RLS-Regeln):
--   impression_vermerken  → still nichts tun (App/Website rufen nur die
--                           Sammelfunktion; die zählt weiter, bricht nicht)
--   spende_senden         → { ok: false, grund: 'beitrag' } (Clients zeigen
--                           „Das hat nicht geklappt"; vor Zahlungsweg/Code)
--   feed_rang             → keine Zeile für den Beitrag (Clients ranken nur,
--                           was sie unter RLS gelesen haben — keine Änderung)
--
-- Jede Funktion ist die vollständige, live gegengelesene Fassung der
-- zuletzt gültigen Datei (prosrc gleich); geändert ist nur die Prüfung.
-- Keine neue Tabelle, keine neue Funktion. EXECUTE danach nur authenticated.
--
-- Nicht mitgenommen (siehe BERICHT-schema122-07-11.md): like_zahlen,
-- liker_namen, kommentar_like_zahlen, inhalt_melden prüfen schon
-- beitrag_sichtbar(); sound_stellen nimmt keinen Beitrag entgegen.
--
-- Einspielen:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs SUPABASE_SCHEMA_122_rpc_nur_sichtbare_beitraege.sql
-- Davor/danach: node app/test/_probe122.js, dann test:rechte, test:angriffe,
-- test:minderjaehrig, test:schema.
-- =====================================================================

-- ------------------------------------------ 1. impression_vermerken --
-- Fassung aus Schema 28 (live gleich, geprueft 07.11.), neu nur die Sichtbarkeitspruefung.

create or replace function public.impression_vermerken(
  beitrag uuid,
  dauer   integer default 0,
  herkunft text default 'feed'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  ich uuid := auth.uid();
  heute date := (now() at time zone 'utc')::date;
  gedeckelt integer;
begin
  if ich is null then
    raise exception 'nicht angemeldet';
  end if;

  if herkunft not in ('feed', 'reels', 'explorer', 'profil', 'community') then
    raise exception 'unbekannte Herkunft: %', herkunft;
  end if;

  /*
   * Schema 122: nur Beitraege, die der Aufrufer lesen darf (dieselbe Regel
   * wie Schema 119). Unsichtbar oder unbekannt -> still nichts tun: die
   * Sammelfunktion impressionen_vermerken() zaehlt den Eintrag trotzdem,
   * so verraet die Antwort nicht, ob es den Beitrag gibt, und die
   * Oberflaeche bricht nicht.
   */
  if not public.beitrag_lesbar(beitrag) then
    return;
  end if;

  /*
   * Eine einzelne Sichtung wird bei fuenf Minuten gekappt, und Unsinn
   * (negative Werte) faellt auf null.
   *
   * Der Grund ist nicht Boeswilligkeit, sondern der Alltag: wer die App
   * mit offenem Feed in die Tasche steckt, haette sonst eine Sichtung von
   * vierzig Minuten — und dieser eine Beitrag stuende im Ranking ueber
   * allem, was Menschen tatsaechlich angesehen haben.
   */
  gedeckelt := least(greatest(coalesce(dauer, 0), 0), 300000);

  insert into public.post_impressions (post_id, user_id, tag, dauer_ms, quelle)
  values (beitrag, ich, heute, gedeckelt, herkunft)
  on conflict (user_id, post_id, tag, quelle) do update
    set dauer_ms   = public.post_impressions.dauer_ms + excluded.dauer_ms,
        sichtungen = public.post_impressions.sichtungen + 1,
        zuletzt    = now();
end;
$$;

revoke execute on function public.impression_vermerken(uuid, integer, text) from public, anon;
grant  execute on function public.impression_vermerken(uuid, integer, text) to authenticated;

-- --------------------------------------------------- 2. spende_senden --
-- Fassung aus Schema 101 (live gleich, geprueft 07.11.), neu nur die Beitragspruefung.

CREATE OR REPLACE FUNCTION public.spende_senden(p_empfaenger uuid, p_betrag_cent integer, p_code text, p_methode uuid DEFAULT NULL::uuid, p_post uuid DEFAULT NULL::uuid, p_nachricht text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_ich     uuid := auth.uid();
  v_methode public.zahlungsmethoden%rowtype;
  v_zeile   public.donations%rowtype;
  v_fehl    integer;
begin
  if v_ich is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_empfaenger is null or p_empfaenger = v_ich then
    return jsonb_build_object('ok', false, 'grund', 'selbst');
  end if;
  -- Dieselben Grenzen wie MIN_CENT/MAX_CENT in gemeinsam/zahlung.js.
  if p_betrag_cent is null or p_betrag_cent < 50 or p_betrag_cent > 100000 then
    return jsonb_build_object('ok', false, 'grund', 'betrag');
  end if;
  -- Schema 101: Spenden nur zwischen freigegebenen Konten. Der Empfänger
  -- bekommt dieselbe Antwort wie ein fehlendes Profil, damit die Funktion
  -- nicht verrät, dass es ein wartendes Kinderkonto gibt.
  if not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_freigegeben');
  end if;
  if not exists (select 1 from public.profiles where id = p_empfaenger)
     or public.konto_stand(p_empfaenger) <> 'frei' then
    return jsonb_build_object('ok', false, 'grund', 'empfaenger');
  end if;
  -- Schema 122: ein angegebener Beitrag muss fuer den Spender lesbar sein
  -- (Regel aus Schema 119). Unsichtbar und unbekannt antworten gleich.
  if p_post is not null and not public.beitrag_lesbar(p_post) then
    return jsonb_build_object('ok', false, 'grund', 'beitrag');
  end if;

  if p_methode is null then
    select * into v_methode from public.zahlungsmethoden where user_id = v_ich and standard limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'grund', 'keine_zahlungsmethode');
    end if;
  else
    select * into v_methode from public.zahlungsmethoden where id = p_methode and user_id = v_ich;
    if not found then
      return jsonb_build_object('ok', false, 'grund', 'methode_unbekannt');
    end if;
  end if;
  if v_methode.anbieter = 'karte'
     and (v_methode.ablauf_jahr < extract(year from now())
          or (v_methode.ablauf_jahr = extract(year from now())
              and v_methode.ablauf_monat < extract(month from now()))) then
    return jsonb_build_object('ok', false, 'grund', 'methode_abgelaufen');
  end if;

  if not exists (select 1 from public.spendencodes where user_id = v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'kein_code');
  end if;
  if public.spendencode_gesperrt(v_ich) then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;
  if not public.spendencode_stimmt(v_ich, p_code) then
    select count(*) into v_fehl
      from public.spendencode_protokoll p
     where p.user_id = v_ich and p.art = 'pruefen' and not p.erfolg
       and p.created_at > now() - interval '15 minutes'
       and p.created_at > coalesce((select max(q.created_at) from public.spendencode_protokoll q
                                     where q.user_id = v_ich and q.art = 'pruefen' and q.erfolg),
                                    '-infinity'::timestamptz);
    return jsonb_build_object('ok', false, 'grund',
                              case when v_fehl >= 5 then 'gesperrt' else 'falscher_code' end,
                              'verbleibend', greatest(0, 5 - v_fehl));
  end if;

  insert into public.donations (post_id, empfaenger_id, sender_id, betrag_cent, nachricht,
                                zahlungsmethode_id, zahlungsstatus)
  values (p_post, p_empfaenger, v_ich, p_betrag_cent, left(coalesce(p_nachricht, ''), 500),
          v_methode.id, 'vorgemerkt')
  returning * into v_zeile;

  return jsonb_build_object('ok', true, 'id', v_zeile.id, 'created_at', v_zeile.created_at,
                            'zahlungsstatus', v_zeile.zahlungsstatus);
end;
$function$;

revoke execute on function public.spende_senden(uuid, integer, text, uuid, uuid, text) from public, anon;
grant  execute on function public.spende_senden(uuid, integer, text, uuid, uuid, text) to authenticated;

-- ------------------------------------------------------- 3. feed_rang --
-- Fassung aus Schema 82 (live gleich, geprueft 07.11.), neu nur die Lesbarkeit der Kandidaten.

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
       -- Schema 122: unlesbare Beitraege bekommen keine Zeile (keine
       -- Zaehler, Sichtungen, kein Hinweis, dass es sie gibt).
       and public.beitrag_lesbar(p.id)
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
  f text;
begin
  foreach f in array array['public.impression_vermerken(uuid,integer,text)',
                           'public.spende_senden(uuid,integer,text,uuid,uuid,text)',
                           'public.feed_rang(uuid[],text)'] loop
    if position('beitrag_lesbar(' in pg_get_functiondef(f::regprocedure)) = 0 then
      raise exception 'Schema 122: % ohne beitrag_lesbar()', f;
    end if;
    if has_function_privilege('anon', f, 'execute') then
      raise exception 'Schema 122: anon darf % ausfuehren', f;
    end if;
    if not has_function_privilege('authenticated', f, 'execute') then
      raise exception 'Schema 122: authenticated darf % nicht ausfuehren', f;
    end if;
  end loop;
  -- Schema 101 bleibt erhalten.
  if position('konto_stand(p_empfaenger)' in pg_get_functiondef('public.spende_senden(uuid,integer,text,uuid,uuid,text)'::regprocedure)) = 0 then
    raise exception 'Schema 122: spende_senden ohne Freigabeprüfung (101)';
  end if;
end $$;
