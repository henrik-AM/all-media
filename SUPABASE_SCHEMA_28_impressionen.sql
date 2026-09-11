-- =====================================================================
-- SUPABASE_SCHEMA_28_impressionen.sql — 06.09.2026
--
-- Die Voraussetzung fuer den Feed-Algorithmus: mitschreiben, wer welchen
-- Beitrag wie lange gesehen hat.
--
-- WARUM JETZT UND NICHT SPAETER
--
-- Das Konzept vom 02.09.2026 (2.Gehirn.md/02 Projekte/
-- All-Media-Feed-Algorithmus-02-09-2026.md) haelt fest: ohne Impressionen
-- gibt es kein Ranking, das sich verbessern kann. Ein Beitrag, den alle
-- gesehen und keiner geliket haben, ist etwas anderes als einer, den
-- niemand gesehen hat — an den Likes allein sind beide nicht zu
-- unterscheiden.
--
-- Diese Tabelle ist deshalb die einzige Stelle des Algorithmus, die
-- Vorlauf braucht: die Ranking-Funktion laesst sich an einem Nachmittag
-- schreiben, der Datenbestand darunter nicht. Sie kommt darum jetzt,
-- lange vor dem Rest.
--
-- WAS SIE NICHT IST
--
-- Kein zweiter Zaehler neben `posts.views`. Der steht weiter da und bleibt
-- der Wert, der unter dem Beitrag angezeigt wird — ein Zaehlerstand ohne
-- Verlauf (siehe web/server/supabase-api.js:214). Hier geht es um das
-- Gegenteil: um den Verlauf, mit Person, Zeit und Dauer.
--
-- EINE ZEILE JE PERSON, BEITRAG UND TAG
--
-- Nicht je Sichtung. Wer durch den Feed nach oben und wieder nach unten
-- scrollt, sieht denselben Beitrag fuenfmal; fuenf Zeilen dafuer waeren
-- fuenfmal dieselbe Aussage und ein Bestand, der schneller waechst als
-- alles andere zusammen. Stattdessen wird auf der bestehenden Zeile die
-- Dauer aufaddiert und `sichtungen` hochgezaehlt. Das ist genau die
-- Koernigkeit, die ein Ranking braucht.
--
-- GESCHRIEBEN WIRD NUR UEBER DIE FUNKTION
--
-- `impression_vermerken()` nimmt den Betrachter aus `auth.uid()` und nicht
-- als Parameter entgegen — die Lehre aus Fund 11 der Sicherheitspruefung
-- (Schema 27). Deshalb gibt es fuer INSERT und UPDATE bewusst keine
-- Regel: die Tabelle ist von aussen nur lesbar, und auch das nur fuer die
-- eigenen Zeilen.
--
-- Alles idempotent: die Datei laesst sich mehrfach einspielen.
-- Start:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--     ../SUPABASE_SCHEMA_28_impressionen.sql
-- =====================================================================

create table if not exists public.post_impressions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.posts(id) on delete cascade,
  user_id     uuid not null references auth.users(id)   on delete cascade,
  tag         date not null default (now() at time zone 'utc')::date,
  dauer_ms    integer not null default 0,
  sichtungen  integer not null default 1,
  quelle      text    not null default 'feed',
  zuletzt     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

/*
 * Die Klammer, an der die Zusammenfassung haengt: eine Zeile je Person,
 * Beitrag, Tag und Herkunft. Die Herkunft gehoert dazu, weil dieselbe
 * Sichtung im Reel-Kanal etwas anderes wert ist als im Feed — im Reel
 * laeuft das Video von selbst weiter, im Feed muss jemand stehenbleiben.
 */
create unique index if not exists post_impressions_klammer
  on public.post_impressions (user_id, post_id, tag, quelle);

/* Fuer das Ranking: alle Sichtungen eines Beitrags, jung zuerst. */
create index if not exists post_impressions_beitrag
  on public.post_impressions (post_id, tag desc);

alter table public.post_impressions enable row level security;

/*
 * Lesen darf jeder nur seine eigenen Zeilen.
 *
 * Nicht der Verfasser des Beitrags: "wer hat meinen Beitrag wie lange
 * angesehen" waere eine namentliche Zuschauerliste. Was der Verfasser
 * sehen soll, ist die Zahl — und die steht in `posts.views`.
 */
drop policy if exists "Eigene Impressionen lesen" on public.post_impressions;
create policy "Eigene Impressionen lesen" on public.post_impressions
  for select to authenticated
  using (user_id = auth.uid());

/*
 * Loeschen darf jeder seine eigenen Zeilen.
 *
 * Das ist die eigene Sehgeschichte — wer sie loswerden will, soll das
 * koennen; ein Ranking, das sich auf Daten stuetzt, die niemand mehr
 * loswird, waere eine Zumutung. Gefaelscht werden kann damit nichts:
 * loeschen heisst weniger Signal, nicht falsches.
 *
 * Es ist ausserdem die einzige Moeglichkeit, wie ein Prueflauf hinter sich
 * aufraeumen kann, ohne das ganze Pruefkonto zurueckzusetzen.
 */
drop policy if exists "Eigene Impressionen loeschen" on public.post_impressions;
create policy "Eigene Impressionen loeschen" on public.post_impressions
  for delete to authenticated
  using (user_id = auth.uid());

/*
 * Kein INSERT und kein UPDATE — mit Absicht.
 *
 * Geschrieben wird ausschliesslich ueber `impression_vermerken()`. Eine
 * INSERT-Regel daneben waere eine zweite Tuer in denselben Raum: wer sie
 * benutzt, setzt Dauer und Anzahl frei und faerbt damit spaeter das
 * Ranking. Bei eingeschaltetem RLS gilt ohne Regel: verboten.
 */

-- --------------------------------------------------- Der Schreibweg --

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
grant execute on function public.impression_vermerken(uuid, integer, text) to authenticated;

/*
 * Und dasselbe fuer eine Handvoll auf einmal.
 *
 * Der Feed meldet nicht bei jedem Beitrag einzeln: wer zwei Minuten
 * scrollt, hat zwanzig Sichtungen gesammelt. Zwanzig einzelne Aufrufe
 * waeren zwanzig Rundreisen ueber das Mobilfunknetz — im Zug also
 * zwanzig Gelegenheiten zu scheitern. Die Oberflaeche sammelt deshalb
 * und schickt einmal.
 *
 * Ein einzelner unbrauchbarer Eintrag darf den Rest nicht mitreissen:
 * Sichtungen sind Nebensache, sie duerfen nichts kaputtmachen. Deshalb
 * wird je Eintrag abgefangen und weitergemacht; zurueck kommt, wie viele
 * ankamen.
 */
create or replace function public.impressionen_vermerken(eintraege jsonb)
returns integer
language plpgsql
security definer set search_path = public
as $$
declare
  e jsonb;
  gezaehlt integer := 0;
begin
  if auth.uid() is null then
    raise exception 'nicht angemeldet';
  end if;

  if jsonb_typeof(eintraege) is distinct from 'array' then
    raise exception 'Erwartet wird eine Liste';
  end if;

  -- Eine Obergrenze, damit ein einzelner Aufruf nicht die Datenbank
  -- beschaeftigt: mehr als hundert Beitraege sieht in einem Rutsch niemand.
  if jsonb_array_length(eintraege) > 100 then
    raise exception 'zu viele Eintraege auf einmal';
  end if;

  for e in select * from jsonb_array_elements(eintraege) loop
    begin
      perform public.impression_vermerken(
        (e ->> 'beitrag')::uuid,
        coalesce((e ->> 'dauer')::integer, 0),
        coalesce(e ->> 'herkunft', 'feed')
      );
      gezaehlt := gezaehlt + 1;
    exception when others then
      -- Absichtlich still: ein geloeschter Beitrag oder eine krumme
      -- Kennung ist kein Grund, die uebrigen Sichtungen wegzuwerfen.
      null;
    end;
  end loop;

  return gezaehlt;
end;
$$;

revoke execute on function public.impressionen_vermerken(jsonb) from public, anon;
grant execute on function public.impressionen_vermerken(jsonb) to authenticated;

-- ------------------------------------- Aufraeumen des Testbestands --

/*
 * `zuruecksetzen(ziel)` muss die eigenen Sichtungen mit wegraeumen.
 *
 * Die Impressionen an den EIGENEN Beitraegen gehen ueber den
 * Fremdschluessel mit, sobald der Beitrag faellt. Die eigenen Sichtungen
 * FREMDER Beitraege nicht — und genau die sammelt jeder Prueflauf an, der
 * durch den Beispielbestand scrollt. Ohne diese Zeile waere die neue
 * Tabelle binnen weniger Tage die groesste im Bestand, gefuellt
 * ausschliesslich vom Pruefkonto.
 *
 * Die Funktion wird nicht neu geschrieben, sondern um eine Zeile ergaenzt:
 * der Rest steht in SUPABASE_SCHEMA_23_sicherheit.sql und soll dort
 * bleiben. Deshalb wird sie aus dem Katalog gelesen, die Zeile eingefuegt
 * und zurueckgeschrieben — dieselbe Vorgehensweise wie in Schema 25, damit
 * diese Datei keine aeltere Fassung wiederherstellen kann.
 */
do $$
declare
  quelle text;
  neu    text;
begin
  select pg_get_functiondef(p.oid) into quelle
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'zuruecksetzen';

  if quelle is null then
    raise exception 'zuruecksetzen() gibt es nicht — erst SUPABASE_SCHEMA_23_sicherheit.sql einspielen';
  end if;

  if position('post_impressions' in quelle) > 0 then
    raise notice 'zuruecksetzen(): Impressionen stehen schon drin';
    return;
  end if;

  neu := replace(
    quelle,
    '  delete from public.post_notify   where user_id = ziel;',
    '  delete from public.post_notify   where user_id = ziel;' || chr(10) ||
    '  delete from public.post_impressions where user_id = ziel;'
  );

  if neu = quelle then
    raise exception 'Ankerzeile in zuruecksetzen() nicht gefunden — bitte von Hand nachziehen';
  end if;

  execute neu;
  raise notice 'zuruecksetzen(): raeumt jetzt auch post_impressions ab';
end
$$;

revoke execute on function public.zuruecksetzen(uuid) from public, anon;
grant  execute on function public.zuruecksetzen(uuid) to authenticated;

-- ------------------------------------------------------- Nachweis --

do $$
declare regeln integer;
begin
  if not exists (
    select 1 from information_schema.tables
     where table_schema = 'public' and table_name = 'post_impressions'
  ) then
    raise exception 'Die Tabelle post_impressions steht nicht.';
  end if;

  select count(*) into regeln from pg_policies
   where schemaname = 'public' and tablename = 'post_impressions'
     and cmd in ('SELECT', 'DELETE');
  if regeln <> 2 then
    raise exception 'Erwartet: SELECT und DELETE. Vorhanden: %', regeln;
  end if;

  if exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'post_impressions'
       and cmd in ('INSERT', 'UPDATE', 'ALL')
  ) then
    raise exception 'Es gibt eine Schreibregel neben impression_vermerken().';
  end if;

  if has_function_privilege('anon', 'public.impression_vermerken(uuid, integer, text)', 'execute') then
    raise exception 'anon darf impression_vermerken() ausfuehren.';
  end if;

  if not has_function_privilege('authenticated', 'public.impression_vermerken(uuid, integer, text)', 'execute') then
    raise exception 'authenticated darf impression_vermerken() nicht ausfuehren.';
  end if;

  if has_function_privilege('anon', 'public.impressionen_vermerken(jsonb)', 'execute') then
    raise exception 'anon darf impressionen_vermerken() ausfuehren.';
  end if;

  raise notice 'Schema 28: Impressionen werden mitgeschrieben.';
end
$$;
