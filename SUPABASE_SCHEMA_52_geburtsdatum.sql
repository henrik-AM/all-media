-- ===========================================================================
--  SUPABASE_SCHEMA_52_geburtsdatum.sql — Geburtsdatum, Altersgrenze, Eltern
--  22.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 22.09.2026: Beim Anlegen eines Kontos wird das Geburtsdatum
--  abgefragt, weil jedes Land eine eigene Altersgrenze hat. Wer darunter liegt,
--  darf trotzdem ein Konto haben — wenn ein Elternteil mit eigenem
--  All-Media-Konto es von dort aus bestätigt.
--
--  WARUM DAS IN DER DATENBANK STEHT UND NICHT IN DER OBERFLÄCHE
--
--  App und Website schreiben beide direkt nach Supabase. Stünde die Sperre nur
--  in der Oberfläche, käme jeder mit dem öffentlichen Schlüssel an ihr vorbei —
--  und die beiden Oberflächen würden irgendwann verschieden entscheiden. Die
--  Oberflächen zeigen die Grenze vorher an (gemeinsam/alter.js); entschieden
--  wird hier.
--
--  DIE TEILE
--
--  1. `altersgrenzen` — je Landesvorwahl das Mindestalter und, wo es eines
--     gibt, die Untergrenze, unter der auch die Eltern nichts freigeben
--     können. Zeile für Zeile dieselbe Tabelle wie in gemeinsam/alter.js;
--     test/_minderjaehrig.js vergleicht beide.
--  2. `konto_alter` — Geburtsdatum und Stand der Freigabe je Konto. Lesen darf
--     nur das Konto selbst und der eingetragene Elternteil; schreiben niemand
--     direkt, nur die Funktionen unten.
--  3. Ein Auslöser beim Anlegen des Kontos legt die Zeile an.
--  4. Eine einschränkende Regel `nur_freigegebene` auf jeder Tabelle: ein
--     Konto, das auf die Eltern wartet, liest und schreibt nichts außer dem
--     eigenen Profil.
--
--  WARUM EINSCHRÄNKEND (AS RESTRICTIVE)
--
--  Eine zweite, gewöhnliche Regel würde mit den bestehenden verodert und
--  öffnete damit mehr, statt weniger — siehe die Erinnerung „Zweite RLS-Regel
--  öffnet zu viel". Eine einschränkende Regel wird mit allen anderen verundet:
--  sie kann nur wegnehmen.
--
--  BESTEHENDE KONTEN
--
--  Konten von vor diesem Schema haben keine Zeile in `konto_alter` und gelten
--  als freigegeben. Neue Konten ohne Geburtsdatum (etwa ein künftiger Weg über
--  Google oder Apple) bekommen den Stand `ohne_datum` und müssen es nachtragen,
--  bevor sie etwas sehen.
--
--  WER ÄLTER WIRD
--
--  Der Stand wird nicht gespeichert, sondern bei jeder Frage aus dem
--  Geburtsdatum gerechnet (`konto_stand`). Wer auf die Eltern wartet und
--  inzwischen das Mindestalter erreicht hat, ist ohne weiteren Schritt frei.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_52_geburtsdatum.sql
--
--  Danach: npm run test:rechte und node test/_minderjaehrig.js in app/.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Die Altersgrenzen je Land
-- ---------------------------------------------------------------------------

create table if not exists public.altersgrenzen (
  land          text primary key,
  vorwahl       text not null,
  mindestalter  int  not null check (mindestalter between 0 and 21),
  untergrenze   int           check (untergrenze is null or untergrenze <= mindestalter),
  name          text not null
);

comment on table public.altersgrenzen is
  'Ab welchem Alter All Media ohne Eltern erlaubt ist, je Landesvorwahl. Gleiche Tabelle wie gemeinsam/alter.js. XX gilt fuer alle uebrigen.';

insert into public.altersgrenzen (land, vorwahl, mindestalter, untergrenze, name) values
  ('DE', '49', 16, null, 'Deutschland'),
  ('AT', '43', 14, null, 'Österreich'),
  ('CH', '41', 16, null, 'Schweiz'),
  ('LI', '423', 16, null, 'Liechtenstein'),
  ('BE', '32', 13, null, 'Belgien'),
  ('BG', '359', 14, null, 'Bulgarien'),
  ('HR', '385', 16, null, 'Kroatien'),
  ('CY', '357', 14, null, 'Zypern'),
  ('CZ', '420', 15, null, 'Tschechien'),
  ('DK', '45', 13, null, 'Dänemark'),
  ('EE', '372', 13, null, 'Estland'),
  ('FI', '358', 13, null, 'Finnland'),
  ('FR', '33', 15, null, 'Frankreich'),
  ('GR', '30', 15, null, 'Griechenland'),
  ('HU', '36', 16, null, 'Ungarn'),
  ('IE', '353', 16, null, 'Irland'),
  ('IT', '39', 14, null, 'Italien'),
  ('LV', '371', 13, null, 'Lettland'),
  ('LT', '370', 14, null, 'Litauen'),
  ('LU', '352', 16, null, 'Luxemburg'),
  ('MT', '356', 13, null, 'Malta'),
  ('NL', '31', 16, null, 'Niederlande'),
  ('PL', '48', 16, null, 'Polen'),
  ('PT', '351', 13, null, 'Portugal'),
  ('RO', '40', 16, null, 'Rumänien'),
  ('SK', '421', 16, null, 'Slowakei'),
  ('SI', '386', 15, null, 'Slowenien'),
  ('ES', '34', 14, null, 'Spanien'),
  ('SE', '46', 13, null, 'Schweden'),
  ('NO', '47', 13, null, 'Norwegen'),
  ('IS', '354', 13, null, 'Island'),
  ('GB', '44', 13, null, 'Vereinigtes Königreich'),
  ('US', '1', 13, null, 'USA/Kanada'),
  ('AU', '61', 16, 16, 'Australien'),
  ('NZ', '64', 13, null, 'Neuseeland'),
  ('IN', '91', 18, null, 'Indien'),
  ('BR', '55', 16, null, 'Brasilien'),
  ('KR', '82', 14, null, 'Südkorea'),
  ('CN', '86', 14, null, 'China'),
  ('XX', '', 16, null, 'anderes Land')
on conflict (land) do update
   set vorwahl = excluded.vorwahl,
       mindestalter = excluded.mindestalter,
       untergrenze = excluded.untergrenze,
       name = excluded.name;

-- Was hier nicht mehr steht, gilt auch nicht mehr.
delete from public.altersgrenzen
 where land not in ('DE', 'AT', 'CH', 'LI', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'IS', 'GB', 'US', 'AU', 'NZ', 'IN', 'BR', 'KR', 'CN', 'XX');

alter table public.altersgrenzen enable row level security;

-- Öffentlich wie jede Rechtsvorschrift: die Registrierung zeigt sie an, bevor
-- jemand angemeldet ist.
drop policy if exists altersgrenzen_lesen on public.altersgrenzen;
create policy altersgrenzen_lesen on public.altersgrenzen
  for select to anon, authenticated using (true);

revoke all on public.altersgrenzen from anon, authenticated;
grant select on public.altersgrenzen to anon, authenticated;


-- ---------------------------------------------------------------------------
--  2. Geburtsdatum und Freigabe je Konto
--
--  status ist, was zuletzt entschieden wurde:
--    frei        alt genug oder von den Eltern bestätigt
--    wartet      unter dem Mindestalter, die Eltern haben noch nicht entschieden
--    abgelehnt   die Eltern haben abgelehnt
--    ohne_datum  kein (gültiges) Geburtsdatum beim Anlegen
--  Was heute gilt, rechnet `konto_stand` — wer älter geworden ist, ist frei.
-- ---------------------------------------------------------------------------

create table if not exists public.konto_alter (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  geburtsdatum   date,
  land           text not null default 'XX',
  mindestalter   int  not null default 16,
  status         text not null check (status in ('frei', 'wartet', 'abgelehnt', 'ohne_datum')),
  eltern_id      uuid references auth.users (id) on delete set null,
  angefragt_am   timestamptz,
  entschieden_am timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists konto_alter_eltern on public.konto_alter (eltern_id) where eltern_id is not null;

comment on table public.konto_alter is
  'Geburtsdatum und Elternfreigabe. Nur ueber die Funktionen aus Schema 52 beschreibbar.';

alter table public.konto_alter enable row level security;

drop policy if exists konto_alter_lesen on public.konto_alter;
create policy konto_alter_lesen on public.konto_alter
  for select to authenticated
  using (user_id = auth.uid() or eltern_id = auth.uid());

-- Keine Schreibregel: wer sein eigenes Geburtsdatum ändern dürfte, wäre mit
-- einem Aufruf volljährig.
revoke all on public.konto_alter from anon, authenticated;
grant select on public.konto_alter to authenticated;


-- ---------------------------------------------------------------------------
--  Hilfsfunktionen
-- ---------------------------------------------------------------------------

-- Die Grenze zu einer Telefonnummer: längste passende Vorwahl, sonst XX.
-- Gleiche Rechnung wie grenzeFuer() in gemeinsam/alter.js.
create or replace function public.altersgrenze_fuer(p_telefon text)
returns public.altersgrenzen
language sql
stable
security definer set search_path = public
as $$
  select g.*
    from public.altersgrenzen g
   where g.land = 'XX'
      or (g.vorwahl <> '' and public.nummer_vergleichsform(coalesce(p_telefon, '')) like g.vorwahl || '%')
   order by length(g.vorwahl) desc
   limit 1;
$$;

-- Volle Jahre, wie alterAm() in gemeinsam/alter.js.
create or replace function public.alter_in_jahren(p_datum date)
returns int
language sql
stable
as $$
  select case when p_datum is null then null
              else date_part('year', age(current_date, p_datum))::int end;
$$;

-- Der Stand, der heute gilt.
create or replace function public.konto_stand(p_user uuid)
returns text
language sql
stable
security definer set search_path = public
as $$
  select coalesce((
    select case
             when k.status = 'frei' then 'frei'
             when k.geburtsdatum is not null
                  and public.alter_in_jahren(k.geburtsdatum) >= k.mindestalter then 'frei'
             else k.status
           end
      from public.konto_alter k
     where k.user_id = p_user
  ), 'frei');
$$;

-- Für die Regeln: darf das angemeldete Konto etwas sehen?
create or replace function public.konto_freigegeben()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select auth.uid() is null or public.konto_stand(auth.uid()) = 'frei';
$$;

-- Darf dieses Konto für ein Kind zustimmen?
--   nicht es selbst, selbst freigegeben, und — soweit bekannt — volljährig.
-- Konten von vor Schema 52 haben kein Geburtsdatum; sie werden nicht
-- ausgeschlossen, sonst könnte heute niemand zustimmen.
create or replace function public.eltern_geeignet(p_eltern uuid, p_kind uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select p_eltern is not null
     and p_eltern <> p_kind
     and exists (select 1 from public.profiles where id = p_eltern)
     and public.konto_stand(p_eltern) = 'frei'
     and coalesce((
           select public.alter_in_jahren(k.geburtsdatum) >= 18
             from public.konto_alter k
            where k.user_id = p_eltern and k.geburtsdatum is not null
         ), true);
$$;

create or replace function public.profil_zu_handle(p_eingabe text)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select id from public.profiles where handle = '@' || public.handle_normal(p_eingabe) limit 1;
$$;


-- ---------------------------------------------------------------------------
--  3. Beim Anlegen des Kontos
--
--  Läuft nach `on_auth_user_created` (Postgres feuert Auslöser in der
--  Reihenfolge ihrer Namen), damit das Profil schon steht.
--
--  Unter der Untergrenze wird das Anlegen abgewiesen, nicht vermerkt: ein
--  Konto, das nie freigegeben werden darf, soll es gar nicht erst geben. Die
--  Oberflächen fangen den Fall vorher ab (Alter.einordnen → 'verboten').
-- ---------------------------------------------------------------------------

create or replace function public.alter_bei_anmeldung()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  roh     text := nullif(trim(new.raw_user_meta_data ->> 'geburtsdatum'), '');
  grenze  public.altersgrenzen := public.altersgrenze_fuer(new.raw_user_meta_data ->> 'phone');
  datum   date;
  jahre   int;
  eltern  uuid;
  stand   text;
begin
  if roh is not null then
    begin
      datum := roh::date;
    exception when others then
      datum := null;
    end;
  end if;

  jahre := public.alter_in_jahren(datum);
  if jahre is null or jahre < 0 or jahre > 120 then
    datum := null;
    stand := 'ohne_datum';
  elsif grenze.untergrenze is not null and jahre < grenze.untergrenze then
    raise exception 'In % ist All Media erst ab % Jahren erlaubt.', grenze.name, grenze.untergrenze
      using errcode = 'P0001';
  elsif jahre < grenze.mindestalter then
    stand := 'wartet';
    eltern := public.profil_zu_handle(new.raw_user_meta_data ->> 'eltern');
    if not public.eltern_geeignet(eltern, new.id) then
      eltern := null;
    end if;
  else
    stand := 'frei';
  end if;

  insert into public.konto_alter
    (user_id, geburtsdatum, land, mindestalter, status, eltern_id, angefragt_am)
  values
    (new.id, datum, grenze.land, grenze.mindestalter, stand, eltern,
     case when eltern is not null then now() end)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_alter on auth.users;
create trigger on_auth_user_created_alter
  after insert on auth.users
  for each row execute function public.alter_bei_anmeldung();


-- ---------------------------------------------------------------------------
--  Für das eigene Konto: wie steht es?
-- ---------------------------------------------------------------------------

create or replace function public.mein_kontostand()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select case
    when auth.uid() is null then jsonb_build_object('stand', 'abgemeldet')
    else coalesce((
      select jsonb_build_object(
               'stand', public.konto_stand(k.user_id),
               'land', g.name,
               'mindestalter', k.mindestalter,
               'eltern', (select handle from public.profiles where id = k.eltern_id),
               'angefragt_am', k.angefragt_am
             )
        from public.konto_alter k
        left join public.altersgrenzen g on g.land = k.land
       where k.user_id = auth.uid()
    ), jsonb_build_object('stand', 'frei'))
  end;
$$;


-- ---------------------------------------------------------------------------
--  Kind: einen Elternteil (neu) anfragen
-- ---------------------------------------------------------------------------

create or replace function public.eltern_anfragen(p_eltern text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich    uuid := auth.uid();
  eltern uuid := public.profil_zu_handle(p_eltern);
  stand  text := public.konto_stand(auth.uid());
begin
  if ich is null then
    return jsonb_build_object('ok', false, 'meldung', 'Nicht angemeldet.');
  end if;
  if stand not in ('wartet', 'abgelehnt') then
    return jsonb_build_object('ok', false, 'meldung', 'Dein Konto braucht keine Zustimmung.');
  end if;
  if eltern is null then
    return jsonb_build_object('ok', false, 'meldung', 'Diesen Benutzernamen gibt es bei All Media nicht.');
  end if;
  if not public.eltern_geeignet(eltern, ich) then
    return jsonb_build_object('ok', false, 'meldung', 'Dieses Konto kann nicht für dich zustimmen.');
  end if;

  update public.konto_alter
     set eltern_id = eltern, status = 'wartet', angefragt_am = now(), entschieden_am = null
   where user_id = ich;

  return jsonb_build_object('ok', true);
end;
$$;


-- ---------------------------------------------------------------------------
--  Konto ohne Datum: nachtragen. Einmal — danach ist es fest.
-- ---------------------------------------------------------------------------

create or replace function public.geburtsdatum_nachtragen(p_datum date, p_eltern text default null)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich    uuid := auth.uid();
  k      public.konto_alter;
  grenze public.altersgrenzen;
  jahre  int := public.alter_in_jahren(p_datum);
  eltern uuid;
begin
  select * into k from public.konto_alter where user_id = ich;
  if ich is null or k.user_id is null or k.status <> 'ohne_datum' then
    return jsonb_build_object('ok', false, 'meldung', 'Das Geburtsdatum steht schon fest.');
  end if;
  if jahre is null or jahre < 0 or jahre > 120 then
    return jsonb_build_object('ok', false, 'meldung', 'Bitte das Geburtsdatum prüfen.');
  end if;

  select * into grenze from public.altersgrenze_fuer((select phone from public.profiles where id = ich));

  if grenze.untergrenze is not null and jahre < grenze.untergrenze then
    return jsonb_build_object('ok', false, 'meldung',
      format('In %s ist All Media erst ab %s Jahren erlaubt.', grenze.name, grenze.untergrenze));
  end if;

  if jahre < grenze.mindestalter then
    eltern := public.profil_zu_handle(p_eltern);
    if not public.eltern_geeignet(eltern, ich) then eltern := null; end if;
  end if;

  update public.konto_alter
     set geburtsdatum = p_datum,
         land = grenze.land,
         mindestalter = grenze.mindestalter,
         status = case when jahre < grenze.mindestalter then 'wartet' else 'frei' end,
         eltern_id = eltern,
         angefragt_am = case when eltern is not null then now() end
   where user_id = ich;

  return jsonb_build_object('ok', true, 'stand', public.konto_stand(ich));
end;
$$;


-- ---------------------------------------------------------------------------
--  Eltern: wer wartet auf mich, und die Entscheidung
-- ---------------------------------------------------------------------------

create or replace function public.einwilligungen_offen()
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'kind', k.user_id,
           'handle', p.handle,
           'name', p.name,
           'alter', public.alter_in_jahren(k.geburtsdatum),
           'land', g.name,
           'mindestalter', k.mindestalter,
           'angefragt_am', k.angefragt_am
         ) order by k.angefragt_am), '[]'::jsonb)
    from public.konto_alter k
    join public.profiles p on p.id = k.user_id
    left join public.altersgrenzen g on g.land = k.land
   where k.eltern_id = auth.uid()
     and public.konto_stand(k.user_id) = 'wartet'
     and public.konto_freigegeben();
$$;

create or replace function public.einwilligung_entscheiden(p_kind uuid, p_zustimmen boolean)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich uuid := auth.uid();
begin
  if ich is null or not public.eltern_geeignet(ich, p_kind) then
    return jsonb_build_object('ok', false, 'meldung', 'Du kannst für dieses Konto nicht entscheiden.');
  end if;

  update public.konto_alter
     set status = case when p_zustimmen then 'frei' else 'abgelehnt' end,
         entschieden_am = now()
   where user_id = p_kind
     and eltern_id = ich
     and status = 'wartet';

  if not found then
    return jsonb_build_object('ok', false, 'meldung', 'Diese Anfrage ist nicht mehr offen.');
  end if;

  return jsonb_build_object('ok', true, 'stand', public.konto_stand(p_kind));
end;
$$;


-- ---------------------------------------------------------------------------
--  4. Die Sperre auf jeder Tabelle
--
--  Ausgenommen sind nur die Tabellen, die ein wartendes Konto selbst braucht
--  oder die ohnehin niemand direkt liest (die beiden Takt-Tabellen der
--  Bremsen aus Schema 38/39). test/_minderjaehrig.js prüft, dass jede
--  andere Tabelle die Regel trägt — auch eine, die erst später dazukommt.
--
--  `(select public.konto_freigegeben())` statt des blossen Aufrufs: so rechnet
--  Postgres es einmal je Abfrage statt einmal je Zeile.
-- ---------------------------------------------------------------------------

do $$
declare t record;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
       and c.relname not in ('profiles', 'konto_alter', 'altersgrenzen', 'anon_takt', 'nummer_suche_takt')
  loop
    execute format('drop policy if exists nur_freigegebene on public.%I', t.relname);
    execute format(
      'create policy nur_freigegebene on public.%I as restrictive for all to authenticated '
      || 'using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()))',
      t.relname);
  end loop;
end $$;

-- Profile: das eigene bleibt sichtbar (der Wartebildschirm zeigt den Namen),
-- und ein wartendes Konto taucht bei anderen nicht auf — nicht in der Suche,
-- nicht als Kontakt.
create or replace function public.profil_freigegeben(p_user uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select public.konto_stand(p_user) = 'frei';
$$;

drop policy if exists nur_freigegebene on public.profiles;
create policy nur_freigegebene on public.profiles
  as restrictive for all to authenticated
  using (id = auth.uid() or ((select public.konto_freigegeben()) and public.profil_freigegeben(id)))
  with check (id = auth.uid() or (select public.konto_freigegeben()));


-- ---------------------------------------------------------------------------
--  Rechte
--
--  Postgres gibt EXECUTE an PUBLIC (Schema 37). Die Regeln rufen
--  konto_freigegeben und profil_freigegeben im Namen des angemeldeten Kontos
--  auf, deshalb brauchen die `authenticated`. Die Oberflächen rufen die vier
--  Funktionen für Kind und Eltern. Der Rest läuft nur intern.
-- ---------------------------------------------------------------------------

revoke execute on function public.altersgrenze_fuer(text)            from public, anon, authenticated;
revoke execute on function public.alter_in_jahren(date)              from public, anon, authenticated;
revoke execute on function public.konto_stand(uuid)                  from public, anon, authenticated;
revoke execute on function public.eltern_geeignet(uuid, uuid)        from public, anon, authenticated;
revoke execute on function public.profil_zu_handle(text)             from public, anon, authenticated;
revoke execute on function public.alter_bei_anmeldung()              from public, anon, authenticated;

revoke execute on function public.konto_freigegeben()                from public, anon;
revoke execute on function public.profil_freigegeben(uuid)           from public, anon;
revoke execute on function public.mein_kontostand()                  from public, anon;
revoke execute on function public.eltern_anfragen(text)              from public, anon;
revoke execute on function public.geburtsdatum_nachtragen(date, text) from public, anon;
revoke execute on function public.einwilligungen_offen()             from public, anon;
revoke execute on function public.einwilligung_entscheiden(uuid, boolean) from public, anon;

grant execute on function public.konto_freigegeben()                 to authenticated;
grant execute on function public.profil_freigegeben(uuid)            to authenticated;
grant execute on function public.mein_kontostand()                   to authenticated;
grant execute on function public.eltern_anfragen(text)               to authenticated;
grant execute on function public.geburtsdatum_nachtragen(date, text) to authenticated;
grant execute on function public.einwilligungen_offen()              to authenticated;
grant execute on function public.einwilligung_entscheiden(uuid, boolean) to authenticated;
