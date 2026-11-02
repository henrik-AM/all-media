-- =====================================================================
-- SUPABASE_SCHEMA_106_einwilligung_fassung.sql — 31.10.2026
--
-- Auftrag Recht/Sicherheit vom 21.10.2026, Kasten RS 7 (Einwilligung mit
-- Version). ENTWURF — nicht eingespielt, erst nach Henriks Ja.
-- Nach 52, 58 und 103.
--
-- WORUM ES GEHT
--
-- Seit RS 1 (24.10.2026) geht die Zustimmung beim Registrieren nur in die
-- signUp-Metadaten (auth.users.raw_user_meta_data: zustimmung_am,
-- zustimmung_<dokument>, kenntnis_<dokument>). Das reicht nicht:
--
--   1. Nachweis (Art. 7 Abs. 1 DSGVO, § 305 Abs. 2 BGB): Metadaten kann der
--      Nutzer selbst überschreiben (auth.updateUser({data})). Ein Beleg,
--      den der Belegte ändern kann, belegt nichts.
--   2. Neue Fassung: Ändern sich die Nutzungsbedingungen, müssen bestehende
--      Konten neu zustimmen (Nutzungsbedingungen Abschnitt „Änderungen").
--      Ohne Tabelle weiß niemand, wer welcher Fassung zugestimmt hat.
--   3. Kinder: Die Einwilligung der Eltern (Art. 8 DSGVO) stand nur als
--      Status 'frei' in konto_alter — wer, wann, welcher Fassung, fehlte.
--   4. Konten von vor dem 24.10.2026 haben gar keine Zustimmung.
--
-- WIE
--
--   rechtstext_fassungen   Welche Fassung gilt (Dokument, Version, sha256-
--                          Präfix wie test:recht, gilt_ab). Pflegt nur ein
--                          Schema, nie ein Client.
--   einwilligungen         Je Zustimmung eine Zeile, nur anhängen. Nur über
--                          die Funktionen hier beschreibbar, der Nutzer
--                          liest seine eigenen, Eltern die ihrer Kinder.
--   Auslöser auth.users    übernimmt die Metadaten beim Registrieren.
--   einwilligung_entscheiden(kind, zustimmen, fassungen)
--                          ersetzt Schema 52: Eltern-Einwilligung nur mit
--                          Version und Prüfsumme der im Elternblatt
--                          gezeigten Texte, Beleg in derselben Transaktion
--                          (Codex-Fund F12; der frühere Auslöser auf
--                          konto_alter ist weg).
--   zustimmung_offen()     Dokumente, deren geltender Fassung das Konto
--                          noch nicht zugestimmt hat → App/Website zeigen
--                          das Blatt „Neue Bedingungen".
--   zustimmen(dok, ver, summe)
--                          nur die geltende Fassung; die Prüfsumme des
--                          gezeigten Texts muss passen (Codex-Fund F6).
--   meine_kinder()         Familienbereich: verknüpfte Kinder mit Stand.
--   elterneinwilligung_widerrufen(kind)
--                          Art. 7 Abs. 3 DSGVO, Richtlinie 1.6: das Konto
--                          ruht ('wartet'), bis der Elternteil neu zustimmt
--                          oder das Kind die Landesgrenze erreicht
--                          (konto_stand rechnet das schon so).
--
-- Rückfall: Clients behandeln 42P01/PGRST202 als „nichts offen" (Muster aus
-- Schema 102, fehltFunktion nur bei der eigenen Funktion).
--
-- NICHT HIER: meine_daten() (Schema 103) kennt einwilligungen noch nicht —
-- beim Einspielen beide zusammen, siehe Nachtrag am Ende.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Geltende Fassungen
-- ---------------------------------------------------------------------
create table if not exists public.rechtstext_fassungen (
  dokument   text not null,
  version    int  not null check (version >= 1),
  pruefsumme text not null check (pruefsumme ~ '^[0-9a-f]{16}$'),
  art        text not null check (art in ('zustimmung', 'kenntnis')),
  gilt_ab    timestamptz not null default now(),
  primary key (dokument, version)
);
comment on table public.rechtstext_fassungen is
  'Fassungen der Rechtstexte aus gemeinsam/rechtstexte.js. Prüfsumme = erste 16 Hex-Zeichen von sha256(alsText). test:recht vergleicht mit dieser Datei.';

alter table public.rechtstext_fassungen enable row level security;
drop policy if exists fassungen_lesen on public.rechtstext_fassungen;
create policy fassungen_lesen on public.rechtstext_fassungen
  for select to authenticated using (true);
-- Ausgenommen von nur_freigegebene: ein wartendes Kinderkonto muss lesen
-- können, wem es zugestimmt hat (Inhalt ist öffentlich).
revoke insert, update, delete on public.rechtstext_fassungen from anon, authenticated;

-- Fassung 1 (RS 1, 24.10.2026). Neue Fassung = neue Zeile, nie überschreiben.
insert into public.rechtstext_fassungen (dokument, version, pruefsumme, art, gilt_ab) values
  ('nutzungsbedingungen',   1, '093abb7871ad3802', 'zustimmung', '2026-10-24'),
  ('community_richtlinien', 1, '78549dde77a7bbe0', 'zustimmung', '2026-10-24'),
  ('datenschutz',           1, '73aa228acb1edf9d', 'kenntnis',   '2026-10-24')
on conflict (dokument, version) do nothing;

create or replace function public.geltende_fassung(p_dokument text)
returns public.rechtstext_fassungen
language sql stable
security definer set search_path = public
as $$
  select * from public.rechtstext_fassungen
   where dokument = p_dokument and gilt_ab <= now()
   order by version desc limit 1;
$$;
revoke execute on function public.geltende_fassung(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Einwilligungen (nur anhängen)
-- ---------------------------------------------------------------------
create table if not exists public.einwilligungen (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  dokument   text not null,
  version    int  not null,
  pruefsumme text not null,
  art        text not null check (art in ('zustimmung', 'kenntnis', 'eltern', 'widerruf')),
  -- Wer zugestimmt hat: das Konto selbst oder bei 'eltern' der Elternteil.
  -- Löscht der Elternteil sein Konto, bleibt die Einwilligung gültig
  -- (Schema 103), nur der Bezug fällt weg.
  durch      uuid references auth.users (id) on delete set null,
  quelle     text not null check (quelle in ('registrierung', 'nachtrag', 'eltern', 'altbestand', 'widerruf')),
  am         timestamptz not null default now(),
  foreign key (dokument, version) references public.rechtstext_fassungen (dokument, version)
);
create index if not exists einwilligungen_konto on public.einwilligungen (user_id, dokument, version);

alter table public.einwilligungen enable row level security;
drop policy if exists einwilligungen_lesen on public.einwilligungen;
create policy einwilligungen_lesen on public.einwilligungen
  for select to authenticated
  using (user_id = auth.uid()
         or exists (select 1 from public.konto_alter k
                     where k.user_id = einwilligungen.user_id and k.eltern_id = auth.uid()));
-- Kein nur_freigegebene: das wartende Kind muss zustimmen und seine eigene
-- Zustimmung lesen können, bevor die Eltern freigeben. Schreiben geht ohnehin
-- nur über die Funktionen unten.
revoke insert, update, delete on public.einwilligungen from anon, authenticated;

-- Nie ändern, nie einzeln löschen — nur mit dem Konto (cascade).
--
-- Eine Ausnahme (Codex-Fund F1, 31.10.2026): Löscht der Elternteil sein
-- Konto, setzt der Fremdschlüssel `durch … on delete set null` die Spalte
-- per UPDATE auf null. Ohne Ausnahme warf dieser Auslöser 42501, und
-- konto_loeschen() (Schema 103) brach für jeden Elternteil mit
-- freigegebenem Kind ab. Erlaubt ist darum genau das: `durch` wird null,
-- das Konto dahinter gibt es nicht mehr (in diesem Moment schon gelöscht),
-- alle anderen Spalten bleiben gleich. Ein direktes `durch = null` bei
-- bestehendem Konto bleibt verboten.
create or replace function public.einwilligung_unveraenderlich()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.durch is not null and new.durch is null
     and (to_jsonb(new) - 'durch') = (to_jsonb(old) - 'durch')
     and not exists (select 1 from auth.users u where u.id = old.durch) then
    return new;
  end if;
  raise exception 'Einwilligungen werden nicht geändert' using errcode = '42501';
end $$;
revoke execute on function public.einwilligung_unveraenderlich() from public, anon, authenticated;
drop trigger if exists einwilligung_unveraenderlich on public.einwilligungen;
create trigger einwilligung_unveraenderlich before update on public.einwilligungen
  for each row execute function public.einwilligung_unveraenderlich();

-- ---------------------------------------------------------------------
-- 3. Beim Registrieren aus den Metadaten übernehmen
--
-- Nur die Version, die der Client nennt, und nur, wenn es sie gibt. Die
-- Prüfsumme kommt aus rechtstext_fassungen. Fehler hier dürfen das Anlegen
-- des Kontos nicht verhindern (sonst „Database error saving new user" für
-- alle) — dann fehlt die Zeile, und zustimmung_offen() fragt beim ersten
-- Start nach. Das ist der sichere Rückfall.
-- ---------------------------------------------------------------------
create or replace function public.einwilligung_aus_registrierung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  f   record;
  ver text;
begin
  for f in select distinct on (dokument) * from public.rechtstext_fassungen
            order by dokument, version desc loop
    ver := new.raw_user_meta_data ->> ((case f.art when 'zustimmung' then 'zustimmung_' else 'kenntnis_' end) || f.dokument);
    continue when ver is null or ver !~ '^[0-9]{1,4}$';
    -- Nur, wenn der Client die Prüfsumme des Texts mitschickt, den er
    -- gezeigt hat, und sie zur Fassung passt (Codex-Fund F6). Sonst keine
    -- Zeile: zustimmung_offen() fragt beim ersten Start nach.
    insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle, am)
    select new.id, x.dokument, x.version, x.pruefsumme, x.art, new.id, 'registrierung', now()
      from public.rechtstext_fassungen x
     where x.dokument = f.dokument and x.version = ver::int
       and x.pruefsumme = new.raw_user_meta_data ->> ('pruefsumme_' || f.dokument);
  end loop;
  return new;
exception when others then
  raise warning 'einwilligung_aus_registrierung: % (%)', sqlerrm, sqlstate;
  return new;
end $$;
revoke execute on function public.einwilligung_aus_registrierung() from public, anon, authenticated;
drop trigger if exists einwilligung_aus_registrierung on auth.users;
create trigger einwilligung_aus_registrierung after insert on auth.users
  for each row execute function public.einwilligung_aus_registrierung();

-- ---------------------------------------------------------------------
-- 4. Eltern-Einwilligung (Art. 8 DSGVO)
--
-- Der Elternteil willigt in die Verarbeitung für das Kind ein. Vermerkt
-- wird genau die Fassung, die sein Elternblatt gezeigt hat (Codex-Fund
-- F12, 02.11.2026). Bis dahin schrieb ein Auslöser auf konto_alter bei
-- jeder Freigabe die gerade geltenden Fassungen als Elternzustimmung — das
-- Elternblatt zeigte aber gar keinen Text, und bei einem Fassungswechsel
-- während des offenen Blatts stand die neue, ungesehene Fassung im Beleg.
--
-- Jetzt: einwilligung_entscheiden(kind, zustimmen, fassungen) ersetzt die
-- Fassung aus Schema 52. Der Client schickt Version und Prüfsumme jedes
-- Texts, den er im Elternblatt zeigt (Einwilligung.elternFassungen()).
-- Zustimmen geht nur, wenn das für JEDE geltende Fassung passt; Freigabe
-- und Beleg entstehen in derselben Transaktion. Ablehnen braucht keine
-- Fassungen. Die alte Signatur (uuid, boolean) ist weg: eine alte App
-- bekommt einen Fehler statt eines Belegs für ungezeigte Texte.
--
-- Der Auslöser ist weg: Wird ein Konto anders frei (Testbestand, Hand-
-- änderung), entsteht kein Beleg — kein Beleg ist ehrlicher als ein
-- falscher. zustimmung_offen() betrifft nur die eigene Zustimmung.
-- ---------------------------------------------------------------------
drop trigger if exists eltern_einwilligung_vermerken on public.konto_alter;
drop function if exists public.eltern_einwilligung_vermerken();

drop function if exists public.einwilligung_entscheiden(uuid, boolean);
create or replace function public.einwilligung_entscheiden(p_kind uuid, p_zustimmen boolean, p_fassungen jsonb)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich uuid := auth.uid();
  g   record;
  n   int := 0;
begin
  if ich is null or not public.eltern_geeignet(ich, p_kind) then
    return jsonb_build_object('ok', false, 'grund', 'kein_kind',
                              'meldung', 'Du kannst für dieses Konto nicht entscheiden.');
  end if;
  if p_zustimmen is null then
    return jsonb_build_object('ok', false, 'grund', 'netz', 'meldung', 'Die Entscheidung ist gerade nicht möglich.');
  end if;

  -- Zustimmen nur zu dem, was gezeigt wurde: jede geltende Fassung muss mit
  -- Version und Prüfsumme genau so im Aufruf stehen.
  if p_zustimmen then
    if p_fassungen is null or jsonb_typeof(p_fassungen) <> 'object' then
      return jsonb_build_object('ok', false, 'grund', 'veraltet');
    end if;
    for g in select distinct on (dokument) * from public.rechtstext_fassungen
              where gilt_ab <= now() order by dokument, version desc loop
      n := n + 1;
      if (p_fassungen -> g.dokument ->> 'version') is distinct from g.version::text
         or (p_fassungen -> g.dokument ->> 'pruefsumme') is distinct from g.pruefsumme then
        return jsonb_build_object('ok', false, 'grund', 'veraltet');
      end if;
    end loop;
    if n = 0 then
      return jsonb_build_object('ok', false, 'grund', 'dokument');
    end if;
  end if;

  update public.konto_alter
     set status = case when p_zustimmen then 'frei' else 'abgelehnt' end,
         entschieden_am = now()
   where user_id = p_kind
     and eltern_id = ich
     and status = 'wartet';
  if not found then
    return jsonb_build_object('ok', false, 'grund', 'nicht_offen', 'meldung', 'Diese Anfrage ist nicht mehr offen.');
  end if;

  if p_zustimmen then
    -- Beleg aus den geprüften Werten: dieselbe Auswahl wie oben, now() ist
    -- in der Transaktion fest, also dieselben Fassungen.
    insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle)
    select p_kind, g2.dokument, g2.version, g2.pruefsumme, 'eltern', ich, 'eltern'
      from (select distinct on (dokument) * from public.rechtstext_fassungen
             where gilt_ab <= now() order by dokument, version desc) g2
     where (p_fassungen -> g2.dokument ->> 'version') = g2.version::text
       and (p_fassungen -> g2.dokument ->> 'pruefsumme') = g2.pruefsumme;
  end if;

  return jsonb_build_object('ok', true, 'stand', public.konto_stand(p_kind));
end $$;
revoke execute on function public.einwilligung_entscheiden(uuid, boolean, jsonb) from public, anon;
grant execute on function public.einwilligung_entscheiden(uuid, boolean, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Was ist offen, zustimmen
-- ---------------------------------------------------------------------
create or replace function public.zustimmung_offen()
returns jsonb
language sql stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'dokument', g.dokument, 'version', g.version, 'art', g.art,
           'bisher', (select max(e.version) from public.einwilligungen e
                       where e.user_id = auth.uid() and e.dokument = g.dokument
                         and e.art in ('zustimmung', 'kenntnis')))
         order by g.dokument), '[]'::jsonb)
    from (select distinct on (dokument) * from public.rechtstext_fassungen
           where gilt_ab <= now() order by dokument, version desc) g
   where auth.uid() is not null
     and not exists (select 1 from public.einwilligungen e
                      where e.user_id = auth.uid() and e.dokument = g.dokument
                        and e.version = g.version and e.art in ('zustimmung', 'kenntnis'));
$$;
revoke execute on function public.zustimmung_offen() from public, anon;
grant execute on function public.zustimmung_offen() to authenticated;

-- Codex-Fund F6 (31.10.2026): Der Client schickt Version UND Prüfsumme
-- des Texts, den er zeigt (Rechtstexte.fassung). Die alte Fassung ohne
-- Prüfsumme gibt es nicht mehr — eine alte App bekommt einen Fehler und
-- sagt „bitte aktualisieren", statt einer Fassung zuzustimmen, die sie
-- nie gezeigt hat.
drop function if exists public.zustimmen(text, int);
create or replace function public.zustimmen(p_dokument text, p_version int, p_pruefsumme text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich uuid := auth.uid();
  g   public.rechtstext_fassungen;
begin
  if ich is null then
    return jsonb_build_object('ok', false, 'grund', 'anmeldung');
  end if;
  g := public.geltende_fassung(p_dokument);
  if g.dokument is null then
    return jsonb_build_object('ok', false, 'grund', 'dokument');
  end if;
  -- Nur der geltenden Fassung: wer eine alte Seite offen hat, stimmt nicht
  -- versehentlich einem Text zu, den es nicht mehr gibt.
  if p_version is distinct from g.version then
    return jsonb_build_object('ok', false, 'grund', 'fassung', 'version', g.version);
  end if;
  -- Richtige Nummer, anderer Text (alter Client nach einer Textänderung
  -- ohne neue Nummer, oder ein gebauter Aufruf): ablehnen.
  if p_pruefsumme is distinct from g.pruefsumme then
    return jsonb_build_object('ok', false, 'grund', 'veraltet', 'version', g.version);
  end if;
  if exists (select 1 from public.einwilligungen
              where user_id = ich and dokument = g.dokument and version = g.version
                and art in ('zustimmung', 'kenntnis')) then
    return jsonb_build_object('ok', true, 'schon', true);
  end if;
  insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle)
  values (ich, g.dokument, g.version, g.pruefsumme, g.art, ich, 'nachtrag');
  return jsonb_build_object('ok', true);
end $$;
revoke execute on function public.zustimmen(text, int, text) from public, anon;
grant execute on function public.zustimmen(text, int, text) to authenticated;

-- Für Eltern: welchen Fassungen wurde für mein Kind zugestimmt.
-- (Lesen geht auch direkt über die Regel oben; die Funktion liefert
-- zusätzlich den Titel der Fassung nicht — den kennt der Client.)


-- ---------------------------------------------------------------------
-- 5b. Familienbereich: Kinder sehen, Einwilligung widerrufen
--
-- Eltern sehen nur Stand und Namen, nie Inhalte (Richtlinie 2.1). Kontakte
-- und Communitys des Kindes (Richtlinie 2.2) sind bewusst NICHT dabei —
-- das ist ein Eingriff in die Privatsphäre des Kindes und Henriks
-- Entscheidung (Richtlinie ist Entwurf).
-- ---------------------------------------------------------------------
create or replace function public.meine_kinder()
returns jsonb
language sql stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', k.user_id,
           'name', p.name,
           'handle', p.handle,
           'stand', public.konto_stand(k.user_id),
           'mindestalter', k.mindestalter,
           'grenze_am', case when k.geburtsdatum is not null
                             then (k.geburtsdatum + make_interval(years => k.mindestalter))::date end,
           'entschieden_am', k.entschieden_am,
           'widerrufbar', public.konto_stand(k.user_id) = 'frei'
                          and k.status = 'frei'
                          and (k.geburtsdatum is null
                               or public.alter_in_jahren(k.geburtsdatum) < k.mindestalter)
         ) order by p.name), '[]'::jsonb)
    from public.konto_alter k
    join public.profiles p on p.id = k.user_id
   where k.eltern_id = auth.uid()
     and public.konto_freigegeben();
$$;
revoke execute on function public.meine_kinder() from public, anon;
grant execute on function public.meine_kinder() to authenticated;

create or replace function public.elterneinwilligung_widerrufen(p_kind uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich uuid := auth.uid();
  k   public.konto_alter;
begin
  if ich is null or not public.konto_freigegeben() then
    return jsonb_build_object('ok', false, 'grund', 'anmeldung');
  end if;
  select * into k from public.konto_alter where user_id = p_kind and eltern_id = ich for update;
  if k.user_id is null then
    return jsonb_build_object('ok', false, 'grund', 'kein_kind');
  end if;
  -- Hat das Kind die Grenze erreicht, hängt nichts mehr an der Einwilligung
  -- der Eltern — es gibt nichts zu widerrufen.
  if k.geburtsdatum is not null and public.alter_in_jahren(k.geburtsdatum) >= k.mindestalter then
    return jsonb_build_object('ok', false, 'grund', 'ohne_eltern');
  end if;
  if k.status <> 'frei' then
    return jsonb_build_object('ok', true, 'schon', true);
  end if;

  update public.konto_alter
     set status = 'wartet', angefragt_am = now(), entschieden_am = now()
   where user_id = p_kind;

  insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle)
  select p_kind, g.dokument, g.version, g.pruefsumme, 'widerruf', ich, 'widerruf'
    from (select distinct on (dokument) * from public.rechtstext_fassungen
           where gilt_ab <= now() order by dokument, version desc) g;

  return jsonb_build_object('ok', true,
    'grenze_am', case when k.geburtsdatum is not null
                      then (k.geburtsdatum + make_interval(years => k.mindestalter))::date end);
end $$;
revoke execute on function public.elterneinwilligung_widerrufen(uuid) from public, anon;
grant execute on function public.elterneinwilligung_widerrufen(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Altbestand
--
-- Konten mit Metadaten aus RS 1 (ab 24.10.2026) bekommen ihre Zeilen aus
-- den Metadaten, Quelle 'altbestand'. Konten ohne Metadaten bekommen nichts
-- — zustimmung_offen() fragt sie beim nächsten Start (Nutzungsbedingungen
-- „Änderungen": zustimmen oder Konto löschen).
-- ---------------------------------------------------------------------
insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle, am)
select u.id, f.dokument, f.version, f.pruefsumme, f.art, u.id, 'altbestand',
       coalesce(nullif(u.raw_user_meta_data ->> 'zustimmung_am', '')::timestamptz, u.created_at)
  from auth.users u
  join public.rechtstext_fassungen f
    on f.version::text = u.raw_user_meta_data ->> ((case f.art when 'zustimmung' then 'zustimmung_' else 'kenntnis_' end) || f.dokument)
 where not exists (select 1 from public.einwilligungen e
                    where e.user_id = u.id and e.dokument = f.dokument and e.version = f.version);

-- ---------------------------------------------------------------------
-- 7. Selbstprüfung
-- ---------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array['zustimmung_offen()', 'zustimmen(text,integer,text)', 'meine_kinder()', 'elterneinwilligung_widerrufen(uuid)',
                           'einwilligung_entscheiden(uuid,boolean,jsonb)'] loop
    if has_function_privilege('anon', 'public.' || f, 'execute') then
      raise exception 'Schema 106: % ist anonym aufrufbar', f;
    end if;
  end loop;
  foreach f in array array['geltende_fassung(text)', 'einwilligung_aus_registrierung()',
                           'einwilligung_unveraenderlich()'] loop
    if has_function_privilege('authenticated', 'public.' || f, 'execute') then
      raise exception 'Schema 106: % ist für Nutzer aufrufbar', f;
    end if;
  end loop;
  -- F12: keine Freigabe ohne gezeigte Fassung, kein automatischer Beleg.
  if to_regprocedure('public.einwilligung_entscheiden(uuid,boolean)') is not null then
    raise exception 'Schema 106: alte einwilligung_entscheiden(uuid, boolean) gibt es noch';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'eltern_einwilligung_vermerken') then
    raise exception 'Schema 106: Auslöser eltern_einwilligung_vermerken gibt es noch';
  end if;
  if has_table_privilege('authenticated', 'public.einwilligungen', 'insert') then
    raise exception 'Schema 106: einwilligungen direkt beschreibbar';
  end if;
end $$;


-- NACHTRAG BEIM EINSPIELEN: meine_daten() aus Schema 103 um
--   'einwilligungen', (select coalesce(jsonb_agg(to_jsonb(e) - 'id'), '[]') from public.einwilligungen e where e.user_id = ich)
-- ergänzen (Art. 15). Erst wenn 103 eingespielt ist; hier nicht, damit 106
-- nicht von 103 abhängt.
