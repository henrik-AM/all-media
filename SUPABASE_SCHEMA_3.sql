-- ============================================================================
-- All Media — Schema-Erweiterung 3 (31.08.2026)
--
-- So einspielen: Supabase-Dashboard → SQL Editor → New query → alles hier
-- hineinkopieren → Run. Wiederholbar, löscht nichts.
--
-- Voraussetzung: SUPABASE_SCHEMA.sql und SUPABASE_SCHEMA_2.sql sind drin.
--
-- Warum diese Datei nötig ist
-- ---------------------------
-- Beim Registrieren legt ein Trigger automatisch ein Profil an. Der Benutzer-
-- name kam dabei aus dem Teil vor dem @ der E-Mail-Adresse. „handle" ist aber
-- eindeutig — und damit scheiterte die zweite Registrierung mit demselben
-- Namensteil an einer Schlüsselverletzung.
--
-- Der Trigger läuft in derselben Transaktion wie das Anlegen des Kontos. Sein
-- Fehler nahm also die ganze Registrierung mit: kein Konto, kein Profil, und
-- für den Nutzer eine unverständliche Datenbankmeldung.
--
-- Gegen ein echtes Postgres nachgestellt:
--   henrik@gmx.net    -> @henrik   angelegt
--   anna@beispiel.de  -> @anna     angelegt
--   henrik@gmail.com  -> Fehler: duplicate key ... "profiles_handle_key"
-- ============================================================================

-- Ein freier Benutzername: „@henrik", sonst „@henrik2", „@henrik3" …
create or replace function public.freier_handle(wunsch text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  basis   text;
  kandidat text;
  zaehler int := 1;
begin
  -- Nur Buchstaben, Ziffern, Punkt und Unterstrich; alles andere fliegt raus.
  basis := lower(regexp_replace(coalesce(wunsch, ''), '[^a-zA-Z0-9._]', '', 'g'));
  basis := trim(both '.' from basis);
  if basis = '' then
    basis := 'nutzer';
  end if;
  basis := left(basis, 24);

  kandidat := '@' || basis;
  while exists (select 1 from public.profiles where handle = kandidat) loop
    zaehler := zaehler + 1;
    kandidat := '@' || basis || zaehler::text;
    -- Reißleine, damit die Schleife unter keinen Umständen hängen bleibt.
    if zaehler > 9999 then
      kandidat := '@' || basis || substr(md5(random()::text), 1, 6);
      exit;
    end if;
  end loop;

  return kandidat;
end;
$$;

-- Trigger neu: nutzt den freien Namen und lässt die Registrierung auch dann
-- durchgehen, wenn beim Profil etwas schiefgeht. Ein Konto ohne Profil kann
-- man reparieren — eine gescheiterte Registrierung ist für den Nutzer eine
-- Sackgasse.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wunsch text;
  anzeige text;
begin
  wunsch  := coalesce(
    new.raw_user_meta_data ->> 'handle',
    split_part(coalesce(new.email, ''), '@', 1)
  );
  anzeige := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Neues Konto'
  );

  begin
    insert into public.profiles (id, handle, name)
    values (new.id, public.freier_handle(wunsch), anzeige)
    on conflict (id) do nothing;
  exception when others then
    -- Registrierung nicht scheitern lassen; der Grund landet im Log.
    raise warning 'Profil für % konnte nicht angelegt werden: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------- Nachträglich reparieren --
-- Konten, die durch den alten Fehler ohne Profil geblieben sind, bekommen
-- jetzt eines.
insert into public.profiles (id, handle, name)
select
  u.id,
  public.freier_handle(coalesce(u.raw_user_meta_data ->> 'handle', split_part(coalesce(u.email, ''), '@', 1))),
  coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
    'Neues Konto'
  )
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;
