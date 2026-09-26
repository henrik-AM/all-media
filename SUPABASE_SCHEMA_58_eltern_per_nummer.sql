-- ===========================================================================
--  SUPABASE_SCHEMA_58_eltern_per_nummer.sql — den Elternteil über die Nummer
--  26.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 26.09.2026: Das Eltern-Konto wird nicht über den @-Namen
--  gefunden — das ist der Weg der Videospalte, zu Fremden. „Eltern sind
--  natürlich wichtige Personen im Leben eines Kindes, deshalb suchst du das
--  Eltern-Profil immer mit der Telefonnummer, da die Eltern auch die
--  Telefonnummer der Kinder und umgekehrt haben dürfen."
--
--  WAS SICH ÄNDERT
--
--  Schema 52 suchte den Elternteil an drei Stellen über profil_zu_handle:
--  beim Anlegen des Kontos (alter_bei_anmeldung), beim erneuten Anfragen
--  (eltern_anfragen) und beim Nachtragen des Geburtsdatums
--  (geburtsdatum_nachtragen). Alle drei suchen jetzt über profil_zu_nummer,
--  mit derselben Vergleichsform wie finde_per_nummer (Schema 24): „0151 …",
--  „+49 151 …" und „0049-151-…" sind dieselbe Nummer.
--
--  Der Elternteil sieht in der Anfrage zusätzlich die Nummer des Kindes —
--  daran erkennt er es, auch wenn ihm der Benutzername nichts sagt.
--
--  DIE BREMSE
--
--  eltern_anfragen verrät, ob es zu einer Nummer ein Konto gibt. Es zählt
--  deshalb in dieselbe Tabelle wie finde_per_nummer (Schema 38): vierzig
--  Nachschlagen je Stunde und Konto, gemeinsam für beide Wege.
--
--  Die Funktionen sind bis auf die Suche wortgleich mit Schema 52.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_58_eltern_per_nummer.sql
--
--  Danach: npm run test:rechte und node test/_minderjaehrig.js in app/.
--  Mehrfach einspielbar.
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Das Konto zu einer Nummer. Unter sechs Ziffern nichts — dieselbe Grenze
--  wie finde_per_nummer, sonst passte die Suche auf halbe Nummern.
-- ---------------------------------------------------------------------------

create or replace function public.profil_zu_nummer(p_eingabe text)
returns uuid
language sql
stable
security definer set search_path = public
as $$
  select p.id
    from public.profiles p
   where length(public.nummer_vergleichsform(p_eingabe)) >= 6
     and p.phone is not null
     and p.phone <> ''
     and public.nummer_vergleichsform(p.phone) = public.nummer_vergleichsform(p_eingabe)
   limit 1;
$$;


-- ---------------------------------------------------------------------------
--  Beim Anlegen des Kontos: `eltern` in den Registrierungsdaten ist jetzt
--  die Nummer des Elternteils.
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
    eltern := public.profil_zu_nummer(new.raw_user_meta_data ->> 'eltern');
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


-- ---------------------------------------------------------------------------
--  Kind: einen Elternteil (neu) anfragen — über seine Nummer, gebremst.
-- ---------------------------------------------------------------------------

create or replace function public.eltern_anfragen(p_eltern text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  ich     uuid := auth.uid();
  stand   text := public.konto_stand(auth.uid());
  eltern  uuid;
  bisher  integer;
  grenze  constant integer  := 40;
  fenster constant interval := interval '1 hour';
begin
  if ich is null then
    return jsonb_build_object('ok', false, 'meldung', 'Nicht angemeldet.');
  end if;
  if stand not in ('wartet', 'abgelehnt') then
    return jsonb_build_object('ok', false, 'meldung', 'Dein Konto braucht keine Zustimmung.');
  end if;
  if coalesce(p_eltern, '') ~ '[A-Za-z@]' then
    return jsonb_build_object('ok', false, 'meldung', 'Bitte die Telefonnummer deines Elternteils eingeben, nicht den Benutzernamen.');
  end if;
  if length(public.nummer_vergleichsform(p_eltern)) < 6 then
    return jsonb_build_object('ok', false, 'meldung', 'Die Nummer ist zu kurz.');
  end if;

  -- Derselbe Zähler wie finde_per_nummer (Schema 38).
  delete from public.nummer_suche_takt where nutzer = ich and zeit < now() - fenster;
  select count(*) into bisher from public.nummer_suche_takt where nutzer = ich;
  if bisher >= grenze then
    return jsonb_build_object('ok', false, 'meldung', 'Zu viele Versuche. Bitte versuche es später noch einmal.');
  end if;
  insert into public.nummer_suche_takt (nutzer) values (ich);

  eltern := public.profil_zu_nummer(p_eltern);
  if eltern = ich then
    return jsonb_build_object('ok', false, 'meldung', 'Das ist deine eigene Nummer.');
  end if;
  if eltern is null then
    return jsonb_build_object('ok', false, 'meldung', 'Zu dieser Nummer gibt es bei All Media kein Konto.');
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
--  Konto ohne Datum: nachtragen. `p_eltern` ist jetzt die Nummer.
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
    eltern := public.profil_zu_nummer(p_eltern);
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
--  Eltern: wer wartet auf mich — jetzt mit der Nummer des Kindes.
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
           'telefon', p.phone,
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


-- ---------------------------------------------------------------------------
--  Rechte — wie Schema 52. profil_zu_handle bleibt stehen (nichts ruft sie
--  mehr), bleibt aber gesperrt.
-- ---------------------------------------------------------------------------

revoke execute on function public.profil_zu_nummer(text)              from public, anon, authenticated;
revoke execute on function public.alter_bei_anmeldung()               from public, anon, authenticated;

revoke execute on function public.eltern_anfragen(text)               from public, anon;
revoke execute on function public.geburtsdatum_nachtragen(date, text) from public, anon;
revoke execute on function public.einwilligungen_offen()              from public, anon;

grant execute on function public.eltern_anfragen(text)                to authenticated;
grant execute on function public.geburtsdatum_nachtragen(date, text)  to authenticated;
grant execute on function public.einwilligungen_offen()               to authenticated;
