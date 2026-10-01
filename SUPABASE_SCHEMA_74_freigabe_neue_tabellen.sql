-- ===========================================================================
--  SUPABASE_SCHEMA_74_freigabe_neue_tabellen.sql              (29.09.2026)
--
--  Ein Konto, das noch auf die Freigabe eines Elternteils wartet, schreibt und
--  liest hier so wenig wie in jeder anderen Tabelle (Schema 52, Teil 4). Die
--  Schleife dort erfasst nur Tabellen, die es beim Einspielen schon gab —
--  Schema 68 (story_tags) und 72 (Zahlung, Spendencode) kamen danach.
--  Gefunden vom Prüflauf _minderjaehrig.js.
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array['story_tags', 'zahlungsmethoden', 'spendencodes',
                           'spendencode_protokoll', 'spendencode_pfeffer'] loop
    -- spendencode_pfeffer gibt es seit Schema 77 nicht mehr.
    continue when to_regclass('public.' || t) is null;
    execute format('drop policy if exists nur_freigegebene on public.%I', t);
    execute format(
      'create policy nur_freigegebene on public.%I as restrictive for all to authenticated '
      || 'using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()))', t);
  end loop;
end $$;
