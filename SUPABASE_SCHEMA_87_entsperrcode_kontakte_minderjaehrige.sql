-- ===========================================================================
--  SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql
--  09.10.2026 — Nacharbeit zu den Kästen 22, 23 und 25
-- ===========================================================================
--
--  WORUM ES GEHT — Henrik am 09.10.2026, drei Punkte:
--
--   A. „Bildschirmzeit-Code gleicher Code wie Spenden-Code (außer Nutzer
--      entscheidet sich aktiv dagegen)."
--   B. „Bei Personen, die ich kenne, sollen auch Minderjährige vorgeschlagen
--      werden können. Und es soll gefragt werden, ob All Media auf die
--      Kontakte auf dem Handy zugreifen darf."
--   C. „Bei den @-Markierungen sollen Minderjährige auch markiert werden
--      dürfen."
--
--  A. ENTSPERRCODE = SPENDEN-PIN
--
--    Bisher (Schema 83) brauchte die Bildschirmzeit einen eigenen
--    Entsperrcode; ohne ihn ließ sich nichts entsperren. Jetzt gilt:
--
--      - Steht in entsperrcodes eine Zeile, ist das die aktive Entscheidung
--        für einen EIGENEN Code — dann gilt nur er.
--      - Sonst gilt die Spenden-PIN (spendencodes, Schema 72/77).
--      - entsperrcode_entfernen() nimmt den eigenen Code zurück; danach gilt
--        wieder die Spenden-PIN. Gleiche Hürde wie beim Ändern: bisheriger
--        Code oder frische Anmeldung.
--
--    Bestimmen die Eltern (bildschirmzeit_kontrolle), gilt dieselbe Regel für
--    das Elternkonto: dessen eigener Entsperrcode, sonst dessen Spenden-PIN.
--
--    Geprüft wird die Spenden-PIN hier direkt am Hash, NICHT über
--    spendencode_stimmt(): die schreibt ins spendencode_protokoll, und fünf
--    Fehlversuche sperren dort die Spenden. Ein Kind könnte sonst mit fünf
--    falschen Versuchen an der Sperrseite die Spenden des Elternteils für
--    15 Minuten lahmlegen. Die Bremse für das Entsperren bleibt die aus
--    Schema 83 (entsperrcode_versuche, 5 in 15 Minuten je Konto).
--
--    Live am 09.10.2026: 0 Entsperrcodes — niemand verliert etwas.
--
--  B. KONTAKTE VOM HANDY UND MINDERJÄHRIGE IN DEN VORSCHLÄGEN
--
--    telefonbuch       je Konto die Nummern aus dem Adressbuch des Handys —
--                      NICHT im Klartext, sondern als SHA-256 der
--                      Vergleichsform (Schema 24). Ehrlich: Telefonnummern
--                      sind so wenige, dass sich ein Hash durchprobieren
--                      lässt. Er verhindert nur, dass die Tabelle auf einen
--                      Blick lesbar ist. Kein Client liest sie; nur die
--                      Funktionen unten.
--    kontakte_abgleichen(text[])   ersetzt das gespeicherte Adressbuch.
--                      Höchstens 3000 Nummern, höchstens 5 Abgleiche in
--                      24 Stunden — sonst wäre das Hochladen ein Weg an der
--                      Nummernbremse (Schema 38, 40/Stunde) vorbei. Die
--                      Antwort sagt NICHT, wie viele Treffer es gab.
--    kontakte_entfernen()          löscht das gespeicherte Adressbuch
--                      (Schalter „Kontakte abgleichen" aus).
--
--    Die Website kann das Adressbuch des Handys nicht lesen (kein
--    Browser-Zugriff). Sie zeigt aber dieselben Vorschläge, weil der
--    Abgleich aus der App im Konto liegt, und kann ihn löschen.
--
--    personen_vorschlaege() bekommt das Signal „Aus deinen Kontakten" (ich
--    habe die Nummer der Person gespeichert). Und Minderjährige:
--
--      Henrik am 09.10.2026: „Minderjährige Konten können auch so
--      vorgeschlagen werden, wenn der Verdacht besteht, dass man sich kennt.
--      Diese Regelung gilt ja eh nur für die Videospalte und nicht für den
--      Messenger, deshalb kann man sowieso bei keinem Konto die Telefonnummer
--      sehen. Im Prinzip ist es das Gleiche, wie Instagram es hat."
--
--      Minderjährige werden also mit denselben Signalen vorgeschlagen wie
--      Volljährige und bekommen selbst dieselben Vorschläge. Die
--      Telefonnummer steht in keiner Antwort. Was gegen das Hochladen
--      geratener Nummern bleibt, ist die Bremse von kontakte_abgleichen
--      (3000 Nummern, 5 Abgleiche in 24 Stunden).
--
--  C. MINDERJÄHRIGE MARKIEREN
--
--    darf_markieren_person() (Schema 86) ließ Minderjährige nur von
--    Personen markieren, die sie selbst als Kontakt führen. Henrik am
--    09.10.2026: „keine Einschränkungen im Vergleich zu volljährigen
--    Konten". Die Klausel fällt weg, auch in den Vorschlagslisten
--    (markierung_vorschlaege, story_markierbar). Für alle gleich bleibt:
--    Blockieren, „Wer darf mich markieren", freigegebene Konten,
--    Testkonten-Trennung, Mitteilung nur bei Sicht auf den Inhalt.
--
--  ERSETZT (Gewinner 87)
--
--    bildschirmzeit_stand(uuid)                  zuvor Schema 83
--    bildschirmzeit_entsperren(text, text, int)  zuvor Schema 83
--    personen_vorschlaege(text, integer)         zuvor Schema 85
--    darf_markieren_person(uuid, uuid)           zuvor Schema 86
--    markierung_vorschlaege(text, uuid, uuid)    zuvor Schema 86
--    story_markierbar(text)                      zuvor Schema 86
--    zuruecksetzen() — am Anker umgeschrieben (wie Schema 62/85): leert
--                      telefonbuch des Testkontos.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_87_entsperrcode_kontakte_minderjaehrige.sql
--
--  Danach: npm run test:rechte, test:minderjaehrig, test:schema,
--          test:bildschirmzeit, test:vorschlaege, test:markieren.
--  Voraussetzung: Schema 83, 85, 86.  Idempotent.
-- ===========================================================================

do $$
begin
  if to_regprocedure('public.bildschirmzeit_kontrolle(uuid)') is null then
    raise exception 'Schema 83 fehlt';
  end if;
  if to_regprocedure('public.ist_minderjaehrig(uuid)') is null then
    raise exception 'Schema 85 fehlt';
  end if;
  if to_regprocedure('public.darf_markieren_person(uuid, uuid)') is null then
    raise exception 'Schema 86 fehlt';
  end if;
end $$;


-- ===========================================================================
--  A. Entsperrcode = Spenden-PIN
-- ===========================================================================

/*
 * Welcher Code entsperrt für dieses Konto? 'eigen', 'spenden' oder null.
 * Nur intern.
 */
create or replace function public.entsperrcode_art(p_user uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select case
    when exists (select 1 from public.entsperrcodes c where c.user_id = p_user) then 'eigen'
    when exists (select 1 from public.spendencodes s where s.user_id = p_user) then 'spenden'
    else null
  end;
$$;

revoke all on function public.entsperrcode_art(uuid) from public, anon, authenticated;


-- Gewinner 87, ersetzt Schema 83. Neu: code_gesetzt zählt die Spenden-PIN
-- mit; code_art und eigene_art sagen, welcher Code gilt.
create or replace function public.bildschirmzeit_stand(p_ziel uuid default null)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_ich       uuid := auth.uid();
  v_ziel      uuid := coalesce(p_ziel, auth.uid());
  zeile     public.bildschirmzeit_regeln;
  heute     date;
  kontrolle uuid;
begin
  if v_ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if v_ziel <> v_ich and public.bildschirmzeit_eltern_von(v_ziel) is distinct from v_ich then
    return jsonb_build_object('ok', false, 'grund', 'nicht_erlaubt');
  end if;

  select * into zeile from public.bildschirmzeit_regeln where user_id = v_ziel;
  heute := public.bildschirmzeit_heute(v_ziel);
  kontrolle := public.bildschirmzeit_kontrolle(v_ziel);

  return jsonb_build_object(
    'ok', true,
    'ziel', v_ziel,
    'ich', v_ziel = v_ich,
    'regeln', coalesce(zeile.regeln, '{}'::jsonb),
    'zeitzone', coalesce(zeile.zeitzone, 'Europe/Berlin'),
    'tag', heute,
    'nutzung', coalesce((
      select jsonb_object_agg(n.bereich, n.sekunden)
        from public.bildschirmzeit_nutzung n
       where n.user_id = v_ziel and n.tag = heute), '{}'::jsonb),
    'woche', coalesce((
      select jsonb_agg(jsonb_build_object('tag', n.tag, 'bereich', n.bereich, 'sekunden', n.sekunden) order by n.tag)
        from public.bildschirmzeit_nutzung n
       where n.user_id = v_ziel and n.tag between heute - 6 and heute), '[]'::jsonb),
    'freigaben', coalesce((
      select jsonb_agg(jsonb_build_object(
               'ziel', f.ziel, 'art', f.art, 'minuten', f.minuten, 'basis', f.basis,
               'tag', f.tag,
               -- Mit „Z" und Millisekunden: Date.parse in Hermes nimmt keine Mikrosekunden.
               'created_at', to_char(f.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
             order by f.created_at)
        from public.bildschirmzeit_freigaben f
       where f.user_id = v_ziel
         and (f.tag = heute or (f.ziel = 'auszeit' and f.created_at > now() - interval '24 hours'))), '[]'::jsonb),
    'eltern', (select jsonb_build_object('id', p.id, 'name', p.name, 'handle', p.handle)
                 from public.profiles p where p.id = kontrolle),
    -- Gilt für das Entsperren: der Code des Elternteils, sonst der eigene —
    -- jeweils der eigene Entsperrcode, sonst die Spenden-PIN (Schema 87).
    'code_gesetzt', public.entsperrcode_art(coalesce(kontrolle, v_ziel)) is not null,
    'code_art', public.entsperrcode_art(coalesce(kontrolle, v_ziel)),
    'eigener_code', exists (select 1 from public.entsperrcodes c where c.user_id = v_ich),
    -- Für die Einstellungen: was gilt für MEIN Konto — 'eigen' oder 'spenden'.
    'eigene_art', coalesce(public.entsperrcode_art(v_ich), 'spenden'),
    'kinder', case when v_ziel = v_ich then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'handle', p.handle) order by p.name)
        from public.konto_alter k
        join public.profiles p on p.id = k.user_id
       where k.eltern_id = v_ich
         and public.bildschirmzeit_eltern_von(k.user_id) = v_ich), '[]'::jsonb)
      else '[]'::jsonb end
  );
end;
$$;

/*
 * Gewinner 87, ersetzt Schema 83. Mit dem Entsperrcode freigeben: 15 Min.,
 * 1 Std. oder für heute (null). Es gilt der eigene Entsperrcode, sonst die
 * Spenden-PIN — des Elternteils, wenn die Eltern bestimmen.
 * Fünf falsche Versuche in 15 Minuten sperren für den Rest dieser Zeit.
 */
create or replace function public.bildschirmzeit_entsperren(p_ziel text, p_code text, p_minuten int default 15)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich       uuid := auth.uid();
  heute     date;
  kontrolle uuid;
  wessen    uuid;
  hash      text;
  stimmt    boolean;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_ziel is null or not (p_ziel = any(public.bildschirmzeit_bereiche() || array['gesamt', 'auszeit'])) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;
  if p_minuten is not null and p_minuten not in (15, 60) then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'entsperren' and not v.erfolg
         and v.created_at > now() - interval '15 minutes') >= 5 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele falsche Versuche. Versuch es in 15 Minuten noch einmal.');
  end if;

  kontrolle := public.bildschirmzeit_kontrolle(ich);
  wessen := coalesce(kontrolle, ich);

  select c.code_hash into hash from public.entsperrcodes c where c.user_id = wessen;
  if hash is not null then
    stimmt := p_code is not null and extensions.crypt(p_code, hash) = hash;
  else
    -- Kein eigener Code: die Spenden-PIN, in ihrer Schreibweise
    -- (spendencode_normal: ohne Leerzeichen/Bindestriche, groß).
    select s.code_hash into hash from public.spendencodes s where s.user_id = wessen;
    if hash is null then
      return jsonb_build_object('ok', false, 'grund', 'kein_code', 'eltern', kontrolle is not null);
    end if;
    stimmt := p_code is not null and extensions.crypt(public.spendencode_normal(p_code), hash) = hash;
  end if;

  if not stimmt then
    insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'entsperren', false);
    return jsonb_build_object('ok', false, 'grund', 'falsch', 'meldung', 'Der Code stimmt nicht.');
  end if;
  insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'entsperren', true);

  heute := public.bildschirmzeit_heute(ich);
  insert into public.bildschirmzeit_freigaben (user_id, tag, ziel, art, minuten, basis, von)
  values (ich, heute, p_ziel, 'code', p_minuten, public.bildschirmzeit_basis(ich, p_ziel), wessen);
  return jsonb_build_object('ok', true, 'minuten', p_minuten);
end;
$$;

/*
 * Den eigenen Entsperrcode zurücknehmen — danach gilt wieder die Spenden-PIN.
 * Wie beim Ändern: der bisherige Code oder eine frische Anmeldung.
 */
create or replace function public.entsperrcode_entfernen(p_bisher text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich  uuid := auth.uid();
  hash text;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  select c.code_hash into hash from public.entsperrcodes c where c.user_id = ich;
  if hash is null then
    return jsonb_build_object('ok', true);
  end if;
  if (select count(*) from public.entsperrcode_versuche v
       where v.user_id = ich and v.art = 'setzen' and v.created_at > now() - interval '1 hour') >= 10 then
    return jsonb_build_object('ok', false, 'grund', 'zu_viele_versuche',
                              'meldung', 'Zu viele Versuche. Versuch es in einer Stunde noch einmal.');
  end if;
  insert into public.entsperrcode_versuche (user_id, art, erfolg) values (ich, 'setzen', false);

  if coalesce(btrim(p_bisher), '') = '' then
    if not public.frisch_angemeldet() then
      return jsonb_build_object('ok', false, 'grund', 'bisher_fehlt',
                                'meldung', 'Gib deinen bisherigen Code ein — oder melde dich neu an, wenn du ihn vergessen hast.');
    end if;
  elsif extensions.crypt(btrim(p_bisher), hash) <> hash then
    return jsonb_build_object('ok', false, 'grund', 'bisher_falsch', 'meldung', 'Der bisherige Code stimmt nicht.');
  end if;

  delete from public.entsperrcodes where user_id = ich;
  update public.entsperrcode_versuche set erfolg = true
   where id = (select max(id) from public.entsperrcode_versuche where user_id = ich and art = 'setzen');
  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.bildschirmzeit_stand(uuid)                 from public, anon;
revoke execute on function public.bildschirmzeit_entsperren(text, text, int) from public, anon;
revoke execute on function public.entsperrcode_entfernen(text)               from public, anon;
grant  execute on function public.bildschirmzeit_stand(uuid)                 to authenticated;
grant  execute on function public.bildschirmzeit_entsperren(text, text, int) to authenticated;
grant  execute on function public.entsperrcode_entfernen(text)               to authenticated;


-- ===========================================================================
--  B. Kontakte vom Handy
-- ===========================================================================

/*
 * Der Schlüssel einer Nummer: SHA-256 der Vergleichsform (Schema 24), oder
 * null bei weniger als sechs Ziffern (wie finde_per_nummer).
 */
create or replace function public.telefonbuch_schluessel(nummer text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when length(public.nummer_vergleichsform(nummer)) between 6 and 15
      then encode(extensions.digest(public.nummer_vergleichsform(nummer), 'sha256'), 'hex')
  end;
$$;

revoke all on function public.telefonbuch_schluessel(text) from public, anon, authenticated;

create index if not exists profiles_telefonbuch_idx
  on public.profiles (public.telefonbuch_schluessel(phone))
  where phone is not null and phone <> '';

create table if not exists public.telefonbuch (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  schluessel text not null,
  primary key (user_id, schluessel)
);
create index if not exists telefonbuch_schluessel_idx on public.telefonbuch (schluessel);

comment on table public.telefonbuch is
  'Nummern aus dem Adressbuch des Handys, nur als SHA-256 der Vergleichsform (Schema 87). '
  'Kein Client liest sie; nur personen_vorschlaege().';

create table if not exists public.telefonbuch_abgleiche (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists telefonbuch_abgleiche_zeit on public.telefonbuch_abgleiche (user_id, created_at desc);

alter table public.telefonbuch            enable row level security;
alter table public.telefonbuch_abgleiche  enable row level security;
-- Keine Regel: niemand liest oder schreibt direkt.
revoke all on public.telefonbuch            from public, anon, authenticated;
revoke all on public.telefonbuch_abgleiche  from public, anon, authenticated;
revoke all on sequence public.telefonbuch_abgleiche_id_seq from public, anon, authenticated;

-- Wie jede neue Tabelle seit Schema 52/74 (test:minderjaehrig zählt nach).
drop policy if exists nur_freigegebene on public.telefonbuch;
create policy nur_freigegebene on public.telefonbuch
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));
drop policy if exists nur_freigegebene on public.telefonbuch_abgleiche;
create policy nur_freigegebene on public.telefonbuch_abgleiche
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));

/*
 * Das Adressbuch abgleichen: ersetzt die gespeicherten Nummern vollständig.
 * Höchstens 3000 Nummern, 5 Abgleiche in 24 Stunden. Keine Trefferzahl.
 */
create or replace function public.kontakte_abgleichen(p_nummern text[])
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich    uuid := auth.uid();
  eigene text;
  n      int;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  if p_nummern is null then
    return jsonb_build_object('ok', false, 'grund', 'ungueltig');
  end if;

  perform pg_advisory_xact_lock(hashtext('kontakte_abgleichen:' || ich::text));
  delete from public.telefonbuch_abgleiche where user_id = ich and created_at < now() - interval '24 hours';
  if (select count(*) from public.telefonbuch_abgleiche where user_id = ich) >= 5 then
    return jsonb_build_object('ok', false, 'grund', 'zu_oft',
                              'meldung', 'Die Kontakte wurden heute schon oft abgeglichen. Morgen geht es wieder.');
  end if;
  insert into public.telefonbuch_abgleiche (user_id) values (ich);

  select public.telefonbuch_schluessel(p.phone) into eigene from public.profiles p where p.id = ich;

  delete from public.telefonbuch where user_id = ich;
  insert into public.telefonbuch (user_id, schluessel)
  select ich, s
    from (select distinct public.telefonbuch_schluessel(x) as s
            from unnest(p_nummern[1:3000]) as x) t
   where s is not null and s is distinct from eigene
  on conflict do nothing;
  get diagnostics n = row_count;

  return jsonb_build_object('ok', true, 'gespeichert', n, 'gekuerzt', cardinality(p_nummern) > 3000);
end;
$$;

-- Schalter „Kontakte abgleichen" aus: alles weg.
create or replace function public.kontakte_entfernen()
returns jsonb
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'grund', 'nicht_angemeldet');
  end if;
  delete from public.telefonbuch where user_id = auth.uid();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.kontakte_abgleichen(text[]) from public, anon;
revoke all on function public.kontakte_entfernen()        from public, anon;
grant execute on function public.kontakte_abgleichen(text[]) to authenticated;
grant execute on function public.kontakte_entfernen()        to authenticated;


-- ---------------------------------------------------------------------------
--  Gewinner 87, ersetzt Schema 85. Neu gegenüber 85:
--    - Signal „Aus deinen Kontakten" (Nummer im eigenen Adressbuch)
--    - Minderjährige wie Volljährige: werden vorgeschlagen und bekommen
--      Vorschläge (Henrik 09.10.2026)
-- ---------------------------------------------------------------------------

create or replace function public.personen_vorschlaege(
  p_bereich text default 'videos',
  p_anzahl  integer default 12
)
returns table (
  id         uuid,
  name       text,
  handle     text,
  color      text,
  avatar_url text,
  punkte     numeric,
  grund      text,
  signale    jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_ich      uuid := auth.uid();
  v_test     boolean;
  v_anzahl   integer := least(greatest(coalesce(p_anzahl, 12), 1), 30);
  v_sperre   text;
  -- Gewichte je Signal. Unter Communitys zählen gemeinsame Communitys
  -- stärker, Freunde von Freunden schwächer.
  w_follow   numeric;
  w_komm     numeric;
  w_folgt    numeric;
  w_msg      numeric;
  w_inter    numeric;
  w_tb       numeric;
begin
  if v_ich is null then
    return;
  end if;
  if p_bereich is null or p_bereich not in ('videos', 'communitys') then
    raise exception 'unbekannter Bereich: % (erlaubt: videos, communitys)', p_bereich;
  end if;

  -- Ein Konto, das auf die Eltern wartet, sieht nichts (Schema 52).
  if not public.konto_freigegeben() then
    return;
  end if;

  v_test := public.ist_testkonto(v_ich)
            or coalesce((select p.demo from public.profiles p where p.id = v_ich), false);

  if p_bereich = 'videos' then
    v_sperre := 'videos';
    w_follow := 10; w_komm := 4;  w_folgt := 30; w_msg := 25; w_inter := 3; w_tb := 35;
  else
    v_sperre := 'communitys';
    w_follow := 6;  w_komm := 12; w_folgt := 20; w_msg := 15; w_inter := 2; w_tb := 25;
  end if;

  return query
  with
  blockiert as (
    select b.blocked_user_id as k from public.blocks b where b.user_id = v_ich
    union
    select b.user_id from public.blocks b where b.blocked_user_id = v_ich
  ),
  gefolgt as (
    -- Zu welcher Welt gehört ein Konto? Test (Testkonten + Beispielprofile)
    -- oder echt. Genannt wird nur jemand aus der eigenen Welt.
    select f.followee_id as k, f.created_at
      from public.follows f
      join public.profiles gp on gp.id = f.followee_id
     where f.follower_id = v_ich
       and f.followee_id not in (select k from blockiert)
       and (public.ist_testkonto(gp.id) or coalesce(gp.demo, false)) = v_test
  ),
  -- Freunde von Freunden: wem folgen die, denen ich folge?
  fof as (
    select f.followee_id as k,
           count(*)::int as n,
           (array_agg(p.handle order by g.created_at desc, p.handle))[1] as erster
      from gefolgt g
      join public.follows f on f.follower_id = g.k
      join public.profiles p on p.id = g.k
     group by f.followee_id
  ),
  komm as (
    select m2.user_id as k, count(distinct m1.community_id)::int as n
      from public.community_members m1
      join public.community_members m2
        on m2.community_id = m1.community_id and m2.user_id <> v_ich
     where m1.user_id = v_ich
     group by m2.user_id
  ),
  folgt_mir as (
    select f.follower_id as k from public.follows f where f.followee_id = v_ich
  ),
  -- Nur gegenseitige, bestätigte Kontakte. Keine Nummer wird verglichen.
  messenger as (
    select c1.contact_id as k
      from public.contacts c1
      join public.contacts c2
        on c2.user_id = c1.contact_id and c2.contact_id = v_ich and c2.status = 'friend'
     where c1.user_id = v_ich and c1.status = 'friend'
  ),
  -- Ich habe ihre Nummer im Adressbuch (Schema 87).
  mein_tb as (
    select distinct p.id as k
      from public.telefonbuch t
      join public.profiles p
        on p.phone is not null and p.phone <> ''
       and public.telefonbuch_schluessel(p.phone) = t.schluessel
     where t.user_id = v_ich
  ),
  inter_roh as (
    select p.user_id as k, count(*)::int as n, false as von_ihm
      from public.post_likes l join public.posts p on p.id = l.post_id
     where l.user_id = v_ich and p.user_id <> v_ich
     group by p.user_id
    union all
    select p.user_id, count(*)::int, false
      from public.comments c join public.posts p on p.id = c.post_id
     where c.user_id = v_ich and p.user_id <> v_ich
     group by p.user_id
    union all
    select l.user_id, count(*)::int, true
      from public.post_likes l join public.posts p on p.id = l.post_id
     where p.user_id = v_ich and l.user_id <> v_ich
     group by l.user_id
    union all
    select c.user_id, count(*)::int, true
      from public.comments c join public.posts p on p.id = c.post_id
     where p.user_id = v_ich and c.user_id <> v_ich
     group by c.user_id
  ),
  inter as (
    select r.k, sum(r.n)::int as n, bool_or(r.von_ihm) as von_ihm
      from inter_roh r group by r.k
  ),
  kandidaten as (
    select k from fof
    union select k from komm
    union select k from folgt_mir
    union select k from messenger
    union select k from inter
    union select k from mein_tb
  ),
  bewertet as (
    select kd.k,
           coalesce(fof.n, 0)        as n_follow,
           fof.erster,
           coalesce(komm.n, 0)       as n_komm,
           (fm.k is not null)        as folgt_dir,
           (ms.k is not null)        as messenger,
           (tb.k is not null)        as im_tb,
           coalesce(i.n, 0)          as n_inter,
           coalesce(i.von_ihm, false) as inter_von_ihm,
           least(coalesce(fof.n, 0), 5)   * w_follow as s_follow,
           least(coalesce(komm.n, 0), 5)  * w_komm   as s_komm,
           case when fm.k is not null then w_folgt else 0 end as s_folgt,
           case when ms.k is not null then w_msg   else 0 end as s_msg,
           case when tb.k is not null then w_tb    else 0 end as s_tb,
           least(coalesce(i.n, 0), 10)    * w_inter  as s_inter
      from kandidaten kd
      left join fof           on fof.k  = kd.k
      left join komm          on komm.k = kd.k
      left join folgt_mir fm  on fm.k   = kd.k
      left join messenger ms  on ms.k   = kd.k
      left join mein_tb tb    on tb.k   = kd.k
      left join inter i       on i.k    = kd.k
  ),
  summe as (
    select b.*,
           (b.s_follow + b.s_komm + b.s_folgt + b.s_msg + b.s_tb + b.s_inter) as gesamt,
           greatest(b.s_follow, b.s_komm, b.s_folgt, b.s_msg, b.s_tb, b.s_inter) as bestes
      from bewertet b
  )
  select p.id,
         p.name,
         p.handle,
         p.color,
         p.avatar_url,
         s.gesamt::numeric,
         -- Bei Gleichstand: unter Communitys zuerst die Communitys, sonst
         -- Adressbuch vor Messenger vor „Folgt dir" vor Freunden von Freunden.
         case
           when p_bereich = 'communitys' and s.s_komm > 0 and s.s_komm = s.bestes then
             case when s.n_komm = 1 then '1 gemeinsame Community'
                  else s.n_komm || ' gemeinsame Communitys' end
           when s.s_tb > 0 and s.s_tb = s.bestes then 'Aus deinen Kontakten'
           when s.s_msg > 0 and s.s_msg = s.bestes then 'Aus deinem Messenger'
           when s.s_folgt > 0 and s.s_folgt = s.bestes then 'Folgt dir'
           when s.s_follow > 0 and s.s_follow = s.bestes then
             'Gefolgt von '
             || case when left(s.erster, 1) = '@' then s.erster else '@' || s.erster end
             || case when s.n_follow = 1 then ''
                     when s.n_follow = 2 then ' und einer weiteren Person'
                     else ' und ' || (s.n_follow - 1) || ' weiteren Personen' end
           when s.s_komm > 0 and s.s_komm = s.bestes then
             case when s.n_komm = 1 then '1 gemeinsame Community'
                  else s.n_komm || ' gemeinsame Communitys' end
           when s.inter_von_ihm then 'Interagiert mit deinen Beiträgen'
           else 'Du hast Beiträge geliked oder kommentiert'
         end,
         jsonb_build_object(
           'gefolgt_von',   s.n_follow,
           'communitys',    s.n_komm,
           'folgt_dir',     s.folgt_dir,
           'messenger',     s.messenger,
           'kontakte',      s.im_tb,
           'interaktionen', s.n_inter
         )
    from summe s
    join public.profiles p on p.id = s.k
    join auth.users u      on u.id = p.id
   where p.id <> v_ich
     and s.gesamt > 0
     -- Vorgeschlagen wird nur die eigene Welt (Testkonten-Trennung).
     and (public.ist_testkonto(p.id) or coalesce(p.demo, false)) = v_test
     and not exists (select 1 from public.follows f
                      where f.follower_id = v_ich and f.followee_id = p.id)
     and p.id not in (select k from blockiert)
     and not exists (select 1 from public.mutes m
                      where m.user_id = v_ich and m.muted_user_id = p.id)
     and not exists (select 1 from public.vorschlag_entfernt e
                      where e.user_id = v_ich and e.ziel_id = p.id)
     and u.deleted_at is null
     and (u.banned_until is null or u.banned_until <= now())
     and not public.gesperrt(p.id, v_sperre)
     and public.konto_stand(p.id) = 'frei'
   order by s.gesamt desc, p.handle
   limit v_anzahl;
end;
$$;

revoke all on function public.personen_vorschlaege(text, integer) from public, anon;
grant execute on function public.personen_vorschlaege(text, integer) to authenticated;


-- ---------------------------------------------------------------------------
--  zuruecksetzen(): Adressbuch des Testkontos mit leeren — am Anker aus
--  Schema 85 umgeschrieben, keine neue Vollfassung.
-- ---------------------------------------------------------------------------

do $$
declare
  quelle text;
  anker  constant text := '  delete from public.vorschlag_entfernt where user_id = ziel;  -- Kasten 23';
begin
  select pg_get_functiondef('public.zuruecksetzen'::regproc) into quelle;
  if quelle like '%public.telefonbuch %' then
    raise notice 'zuruecksetzen() leert telefonbuch schon.';
    return;
  end if;
  if position(anker in quelle) = 0 then
    raise exception 'Anker in zuruecksetzen() nicht gefunden — bitte von Hand anpassen.';
  end if;
  quelle := replace(quelle, anker, anker || chr(10) ||
    '  delete from public.telefonbuch where user_id = ziel;  -- Schema 87');
  execute quelle;
end;
$$;


-- ===========================================================================
--  C. Minderjährige markieren
-- ===========================================================================

-- Gewinner 87, ersetzt Schema 86: ohne die Klausel für Minderjährige.
create or replace function public.darf_markieren_person(wer uuid, wen uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select wer is not null and wen is not null and wer <> wen
     and exists (select 1 from public.profiles p where p.id = wen)
     and public.konto_stand(wer) = 'frei'
     and public.konto_stand(wen) = 'frei'
     and not exists (
           select 1 from public.blocks b
            where (b.user_id = wen and b.blocked_user_id = wer)
               or (b.user_id = wer and b.blocked_user_id = wen))
     and public.sichtbar_fuer(wen, 'markierung', wer)
     and not (public.ist_testkonto(wer) and not public.ist_testkonto(wen));
$$;

revoke all on function public.darf_markieren_person(uuid, uuid) from public, anon, authenticated;

-- Gewinner 87, ersetzt Schema 86 — jetzt wortgleich bis auf
-- darf_markieren_person() ohne Minderjährigen-Klausel.
create or replace function public.markierung_vorschlaege(
  p_suche text default null,
  p_chat  uuid default null,
  p_kanal uuid default null
)
returns table (id uuid, name text, handle text, avatar_url text, color text, rang text)
language sql
stable
security definer set search_path = public
as $$
  with ich as (select auth.uid() as k),
  s as (select lower(trim(both from regexp_replace(coalesce(p_suche, ''), '^@+', ''))) as t),
  mitglied as (
    -- Mitglieder des Chats — nur, wenn ich selbst drin bin.
    select cm.user_id as k from public.chat_members cm, ich
     where p_chat is not null and cm.chat_id = p_chat
       and exists (select 1 from public.chat_members x where x.chat_id = p_chat and x.user_id = ich.k)
    union
    -- Mitglieder der Community eines Unterthemas — nur, wenn ich sie sehe.
    select m.user_id from public.community_channels ch
      join public.community_members m on m.community_id = ch.community_id
     where p_kanal is not null and ch.id = p_kanal
       and public.community_sichtbar(ch.community_id)
  ),
  nah as (
    select c.contact_id as k from public.contacts c, ich where c.user_id = ich.k and c.status = 'friend'
    union
    select f.followee_id from public.follows f, ich where f.follower_id = ich.k
    union
    select f.follower_id from public.follows f, ich where f.followee_id = ich.k
  ),
  kandidaten as (
    select p.id, 0 as stufe from public.profiles p join mitglied on mitglied.k = p.id
    union all
    select p.id, 1 from public.profiles p join nah on nah.k = p.id
    union all
    select p.id, 2 from public.profiles p, s
     where length(s.t) >= 2
       and (p.handle ilike '@' || s.t || '%' or p.name ilike '%' || s.t || '%')
  ),
  beste as (
    select k.id, min(k.stufe) as stufe from kandidaten k group by k.id
  )
  select p.id, p.name, p.handle, p.avatar_url, p.color,
         case b.stufe when 0 then 'mitglied' when 1 then 'nah' else 'suche' end
    from beste b
    join public.profiles p on p.id = b.id
    cross join ich
    cross join s
   where ich.k is not null
     and p.id <> ich.k
     and (s.t = '' or p.handle ilike '@%' || s.t || '%' or p.name ilike '%' || s.t || '%')
     and public.darf_markieren_person(ich.k, p.id)
   order by b.stufe, (p.handle ilike '@' || s.t || '%') desc, p.name
   limit 20;
$$;

revoke all on function public.markierung_vorschlaege(text, uuid, uuid) from public, anon;
grant execute on function public.markierung_vorschlaege(text, uuid, uuid) to authenticated;

-- Gewinner 87, ersetzt Schema 86 (dieselbe Fassung, neu eingespielt, damit
-- 87 als Ganzes die gültige Lage beschreibt).
create or replace function public.story_markierbar(suche text default null)
returns table (id uuid, name text, handle text)
language sql
stable
security definer
set search_path = public
as $$
  with ich as (select auth.uid() as k),
  nah as (
    select c.contact_id as k from public.contacts c, ich
     where c.user_id = ich.k and c.status = 'friend'
    union
    select f.followee_id from public.follows f, ich where f.follower_id = ich.k
    union
    select f.follower_id from public.follows f, ich where f.followee_id = ich.k
  ),
  kandidaten as (
    select p.id, p.name, p.handle, 0 as rang
      from public.profiles p join nah on nah.k = p.id
     where coalesce(trim(suche), '') = ''
        or p.name ilike '%' || trim(suche) || '%'
        or p.handle ilike '%' || trim(suche) || '%'
    union
    select p.id, p.name, p.handle, 1 as rang
      from public.profiles p
     where length(coalesce(trim(suche), '')) >= 2
       and (p.name ilike '%' || trim(suche) || '%' or p.handle ilike '%' || trim(suche) || '%')
  )
  select distinct on (k.id) k.id, k.name, k.handle
    from kandidaten k, ich
   where ich.k is not null
     and k.id <> ich.k
     and public.darf_markieren_person(ich.k, k.id)
   order by k.id, k.rang
   limit 50;
$$;

revoke all on function public.story_markierbar(text) from public, anon;
grant execute on function public.story_markierbar(text) to authenticated;


-- ---------------------------------------------------------------------------
--  Nachweis
-- ---------------------------------------------------------------------------
do $$
begin
  if pg_get_functiondef('public.darf_markieren_person(uuid,uuid)'::regprocedure) like '%ist_minderjaehrig%'
     or pg_get_functiondef('public.markierung_vorschlaege(text,uuid,uuid)'::regprocedure) like '%ist_minderjaehrig%'
     or pg_get_functiondef('public.story_markierbar(text)'::regprocedure) like '%ist_minderjaehrig%'
     or pg_get_functiondef('public.personen_vorschlaege(text,integer)'::regprocedure) like '%ist_minderjaehrig%' then
    raise exception 'Minderjährige werden noch anders behandelt als Volljährige';
  end if;
  if pg_get_functiondef('public.bildschirmzeit_entsperren(text,text,integer)'::regprocedure) not like '%spendencodes%' then
    raise exception 'bildschirmzeit_entsperren kennt die Spenden-PIN nicht';
  end if;
  if pg_get_functiondef('public.personen_vorschlaege(text,integer)'::regprocedure) not like '%Aus deinen Kontakten%' then
    raise exception 'personen_vorschlaege ohne Adressbuch';
  end if;
  if pg_get_functiondef('public.zuruecksetzen'::regproc) not like '%public.telefonbuch %' then
    raise exception 'zuruecksetzen() leert telefonbuch nicht';
  end if;
  if has_function_privilege('anon', 'public.kontakte_abgleichen(text[])', 'execute') then
    raise exception 'kontakte_abgleichen steht anon offen';
  end if;
  if has_function_privilege('authenticated', 'public.telefonbuch_schluessel(text)', 'execute')
     or has_function_privilege('authenticated', 'public.entsperrcode_art(uuid)', 'execute') then
    raise exception 'interne Hilfsfunktion von außen aufrufbar';
  end if;
  if has_table_privilege('authenticated', 'public.telefonbuch', 'select') then
    raise exception 'telefonbuch ist lesbar';
  end if;
  if public.telefonbuch_schluessel('0170 1234567') is distinct from public.telefonbuch_schluessel('+49 170 1234567') then
    raise exception 'telefonbuch_schluessel: 0170… und +49 170… verschieden';
  end if;
end $$;
