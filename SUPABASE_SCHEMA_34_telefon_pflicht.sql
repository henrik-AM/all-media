-- ===========================================================================
--  SUPABASE_SCHEMA_34_telefon_pflicht.sql — die Nummer gehoert zum Konto
--  07.09.2026
-- ===========================================================================
--
--  WORUM ES GEHT
--
--  Henrik am 07.09.2026: „Telefonnummer bei Accounterstellung Pflicht (auch
--  Website)."
--
--  Bisher entstand ein Konto ganz ohne Nummer. Das war nicht nur eine fehlende
--  Angabe, sondern nahm dem Messenger seinen Kern: „Kontakt hinzufuegen" laeuft
--  ueber die Telefonnummer (finde_per_nummer, Schema 24). Wer keine hinterlegt
--  hat, ist fuer niemanden auffindbar — und merkt es nie, weil nichts fehlt,
--  was man sehen koennte.
--
--  ZWEI DINGE STEHEN HIER
--
--  1. `handle_new_user` traegt die Nummer aus den Registrierungsdaten in
--     `profiles.phone` ein. Ohne diesen Schritt haette die Oberflaeche die
--     Nummer zwar abgefragt, aber nirgends abgelegt: das Profil entsteht im
--     Trigger, und der kannte bis heute nur Name und Benutzername.
--
--  2. `nummer_frei` beantwortet vor dem Anlegen, ob eine Nummer schon jemandem
--     gehoert. `finde_per_nummer` kann das nicht: die verlangt eine Anmeldung,
--     und beim Registrieren ist noch niemand angemeldet. Die Antwort ist
--     ausschliesslich ja/nein — wer zu der Nummer gehoert, steht nicht darin.
--     Damit ist sie dieselbe Bauart wie `handle_frei` aus Schema 4, die als
--     einzige Funktion fuer `anon` freigegeben ist (Schema 23, Teil C).
--
--  WARUM DER TRIGGER DIE DOPPELUNG NICHT SELBST ABWEIST
--
--  Er schreibt die Nummer nur, wenn sie frei ist, und laesst sie sonst weg.
--  Die Registrierung an einer belegten Nummer scheitern zu lassen hiesse: das
--  Konto in auth.users steht schon, das Profil fehlt, und die Person kommt in
--  eine App ohne Profil. Die Oberflaeche fragt vorher mit `nummer_frei` und
--  faengt den Fall dort ab, wo er noch zu beheben ist — im Formular.
--
--  Verglichen wird mit `nummer_vergleichsform` aus Schema 24, nicht Zeichen
--  fuer Zeichen: „0152 3456789" und „+49 152 3456789" sind dieselbe Nummer.
--
--  EINSPIELEN
--
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      ../SUPABASE_SCHEMA_34_telefon_pflicht.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Ist diese Nummer noch frei?
--
--  security definer, damit die Frage ohne Anmeldung beantwortet wird. Gelesen
--  wird nur, OB es einen Treffer gibt — die Profilliste selbst bleibt zu.
-- ---------------------------------------------------------------------------
create or replace function public.nummer_frei(eingabe text)
returns jsonb
language plpgsql
stable
security definer set search_path = public
as $$
declare
  gesucht text := public.nummer_vergleichsform(eingabe);
begin
  -- Dieselbe Untergrenze wie in finde_per_nummer: kuerzere Eingaben passen auf
  -- halbe Nummern und machten aus der Frage ein Rateverfahren.
  if length(gesucht) < 6 then
    return jsonb_build_object(
      'frei', false,
      'grund', 'ungueltig',
      'meldung', 'Die Nummer ist zu kurz.'
    );
  end if;

  if exists (
    select 1
      from public.profiles p
     where p.phone is not null
       and p.phone <> ''
       and public.nummer_vergleichsform(p.phone) = gesucht
  ) then
    return jsonb_build_object(
      'frei', false,
      'grund', 'vergeben',
      'meldung', 'Diese Telefonnummer gehört schon zu einem Konto.'
    );
  end if;

  return jsonb_build_object('frei', true);
end;
$$;

comment on function public.nummer_frei(text) is
  'Ja/Nein, ob eine Telefonnummer schon zu einem Konto gehoert. Fuer die Registrierung, deshalb auch ohne Anmeldung.';

revoke all on function public.nummer_frei(text) from public;
grant execute on function public.nummer_frei(text) to anon, authenticated;

-- `nummer_vergleichsform` war seit Schema 24 fuer `anon` gesperrt. `nummer_frei`
-- laeuft als security definer und braucht das Recht deshalb nicht — die Sperre
-- bleibt, damit anonym weiterhin nicht gerechnet und probiert werden kann.


-- ---------------------------------------------------------------------------
--  Das neue Profil bekommt die Nummer mit.
--
--  Sonst unveraendert gegenueber SUPABASE_SCHEMA_4.sql: Wunschname, wenn er
--  gueltig und frei ist, sonst ein erzeugter; Anzeigename aus den Metadaten.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  wunsch  text := public.handle_normal(new.raw_user_meta_data ->> 'handle');
  anzeige text;
  final   text;
  nummer  text := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
begin
  anzeige := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(wunsch, ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Neues Konto'
  );

  if public.handle_gueltig(wunsch)
     and not exists (select 1 from public.profiles where handle = '@' || wunsch) then
    final := '@' || wunsch;
  else
    final := public.freier_handle(
      coalesce(nullif(wunsch, ''), split_part(coalesce(new.email, ''), '@', 1))
    );
  end if;

  /*
   * Eine schon vergebene Nummer wird weggelassen, nicht abgewiesen. Gruende
   * oben im Kopf dieser Datei. Ohne diese Pruefung schlaegt der
   * Eindeutigkeits-Index `profiles_phone_einmalig` zu, der insert faellt in
   * den exception-Block, und das Konto stuende ganz ohne Profil da.
   */
  if nummer is not null and exists (
    select 1
      from public.profiles p
     where p.phone is not null
       and p.phone <> ''
       and public.nummer_vergleichsform(p.phone) = public.nummer_vergleichsform(nummer)
  ) then
    raise warning 'Telefonnummer für % ist schon vergeben und wurde nicht übernommen', new.id;
    nummer := null;
  end if;

  begin
    insert into public.profiles (id, handle, name, phone)
    values (new.id, final, anzeige, nummer)
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
