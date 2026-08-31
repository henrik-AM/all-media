-- ============================================================================
-- All Media — Schema-Erweiterung 4 (31.08.2026)
--
-- So einspielen: Supabase-Dashboard → SQL Editor → New query → alles hier
-- hineinkopieren → Run. Wiederholbar, löscht nichts.
--
-- Voraussetzung: SUPABASE_SCHEMA.sql, _2 und _3 sind eingespielt.
--
-- Der Benutzername gehört dem Nutzer
-- ----------------------------------
-- Bisher erzeugte der Trigger den Benutzernamen aus der E-Mail und hängte bei
-- Konflikt eine Zahl an. Das war ein Notnagel gegen abstürzende Registrierungen
-- — aber es ist nicht, was der Prototyp vorsieht.
--
-- Im Prototyp („neues Profil erstellen") gibt der Nutzer als Allererstes seinen
-- Benutzernamen selbst ein, danach Passwort, danach Telefonnummer oder E-Mail.
-- Der Name ist also eine Eingabe, keine Ableitung.
--
-- Damit das funktioniert, braucht es zwei Dinge, die es hier gibt:
--   1. eine Prüfung „ist dieser Name noch frei?", die schon VOR dem
--      Registrieren beantwortbar ist — ohne die Profilliste preiszugeben
--   2. einen Trigger, der den gewünschten Namen unverändert übernimmt
-- ============================================================================

-- --------------------------------------------------- Regeln für den Namen --
-- Drei bis vierundzwanzig Zeichen, Buchstaben, Ziffern, Punkt und Unterstrich.
-- Kein führender oder abschließender Punkt. Das @ gehört nicht dazu, es wird
-- beim Anzeigen davorgesetzt.
create or replace function public.handle_gueltig(eingabe text)
returns boolean
language sql
immutable
as $$
  select eingabe is not null
     and eingabe ~ '^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$'
     and eingabe !~ '\.\.';
$$;

-- Vereinheitlicht die Eingabe: Kleinschreibung, ohne führendes @, ohne
-- Leerzeichen. „@Henrik " und „henrik" sind derselbe Name.
create or replace function public.handle_normal(eingabe text)
returns text
language sql
immutable
as $$
  select lower(trim(both from regexp_replace(coalesce(eingabe, ''), '^@+', '')));
$$;

-- ------------------------------------------------ Ist der Name noch frei? --
-- security definer, damit die Prüfung auch ohne Anmeldung möglich ist: Beim
-- Registrieren ist noch niemand angemeldet. Die Funktion gibt ausschließlich
-- ja/nein zurück — die Profilliste selbst bleibt geschützt.
create or replace function public.handle_frei(eingabe text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
begin
  if not public.handle_gueltig(v_name) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'ungueltig',
      'meldung', 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.'
    );
  end if;

  if exists (select 1 from public.profiles where handle = '@' || v_name) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'vergeben',
      'meldung', 'Dieser Benutzername ist schon vergeben.'
    );
  end if;

  return jsonb_build_object('frei', true, 'handle', '@' || v_name);
end;
$$;

revoke all on function public.handle_frei(text) from public;
grant execute on function public.handle_frei(text) to anon, authenticated;

-- ------------------------------------------------------- Trigger anpassen --
-- Der gewünschte Name wird übernommen, wie er ist. Nur wenn gar keiner
-- mitgeschickt wurde — etwa weil sich jemand über einen anderen Weg
-- registriert —, wird einer erzeugt, damit die Registrierung nicht scheitert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wunsch  text := public.handle_normal(new.raw_user_meta_data ->> 'handle');
  anzeige text;
  final   text;
begin
  anzeige := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(wunsch, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Neues Konto'
  );

  if public.handle_gueltig(wunsch)
     and not exists (select 1 from public.profiles where handle = '@' || wunsch) then
    -- Der Wunschname ist gültig und frei: genau so übernehmen.
    final := '@' || wunsch;
  else
    -- Kein oder kein brauchbarer Wunsch: einen erzeugen, damit die
    -- Registrierung durchgeht. Die Oberfläche soll diesen Fall verhindern,
    -- indem sie vorher handle_frei() fragt.
    final := public.freier_handle(
      coalesce(nullif(wunsch, ''), split_part(coalesce(new.email, ''), '@', 1))
    );
  end if;

  begin
    insert into public.profiles (id, handle, name)
    values (new.id, final, anzeige)
    on conflict (id) do nothing;
  exception when others then
    raise warning 'Profil für % konnte nicht angelegt werden: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------- Anmelden per Benutzername ermöglichen --
-- Der Prototyp lässt beim Anmelden „Benutzername, E-Mail, Telefonnummer" zu.
-- Supabase meldet aber nur mit E-Mail oder Telefonnummer an. Diese Funktion
-- übersetzt einen Benutzernamen in die hinterlegte E-Mail-Adresse, damit die
-- Oberfläche danach ganz normal anmelden kann.
--
-- Sie gibt nur dann etwas zurück, wenn der Name wirklich existiert — und auch
-- dann nur die E-Mail, die zum Anmelden nötig ist. Ohne diese Funktion müsste
-- die Profilliste öffentlich lesbar sein, was deutlich mehr preisgäbe.
create or replace function public.email_zu_handle(eingabe text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
  ziel   text;
begin
  if not public.handle_gueltig(v_name) then
    return null;
  end if;

  select u.email into ziel
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.handle = '@' || v_name;

  return ziel;
end;
$$;

revoke all on function public.email_zu_handle(text) from public;
grant execute on function public.email_zu_handle(text) to anon, authenticated;

-- --------------------------------------------- Benutzername später ändern --
-- Auch nachträglich soll der Name dem Nutzer gehören. Die Regeln gelten
-- genauso, und der Name muss frei sein.
create or replace function public.handle_aendern(eingabe text)
returns jsonb
language plpgsql
security definer set search_path = public
as $$
declare
  v_name text := public.handle_normal(eingabe);
  wer    uuid := auth.uid();
begin
  if wer is null then
    return jsonb_build_object('ok', false, 'meldung', 'Nicht angemeldet.');
  end if;

  if not public.handle_gueltig(v_name) then
    return jsonb_build_object(
      'ok', false,
      'meldung', 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich.'
    );
  end if;

  if exists (select 1 from public.profiles where handle = '@' || v_name and id <> wer) then
    return jsonb_build_object('ok', false, 'meldung', 'Dieser Benutzername ist schon vergeben.');
  end if;

  update public.profiles set handle = '@' || v_name, updated_at = now() where id = wer;
  return jsonb_build_object('ok', true, 'handle', '@' || v_name);
end;
$$;

revoke all on function public.handle_aendern(text) from public;
grant execute on function public.handle_aendern(text) to authenticated;
