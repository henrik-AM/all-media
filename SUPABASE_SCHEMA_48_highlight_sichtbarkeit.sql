-- ===========================================================================
-- Eine Story im Highlight umging die Sichtbarkeit
-- ===========================================================================
--
-- BEFUND (20.09.2026, Gesamtlauf)
--
--   test:sichtbarkeit → „Bei ‚Niemand' sieht es keine mehr — 1 sichtbar"
--                     → „‚Alle bis auf …' sperrt sie wieder aus — 1 sichtbar"
--
-- Beide Punkte waren am Vormittag noch gruen. Rot wurden sie erst, als der
-- Testbestand zum ersten Mal wirklich eine Story in ein Highlight gelegt hat
-- (SUPABASE_SCHEMA_47). Vorher war jedes Highlight leer — und eine Regel,
-- die nur fuer Inhalt gilt, den es nicht gibt, kann nichts kaputt machen.
--
-- DER FEHLER
--
-- SUPABASE_SCHEMA_46 hat neben die bestehende Leseregel eine zweite gelegt:
--
--   create policy stories_im_highlight on public.stories
--     for select to authenticated using (
--       exists (select 1 from sammlung_inhalte si join sammlungen s ...
--                where si.story_id = stories.id and s.art = 'highlight')
--     );
--
-- Der Kommentar dort sagt: „Zwei Regeln zum selben Vorgang verodert Postgres,
-- und genau das ist gemeint: sichtbar, wenn laufend ODER in einem Highlight."
--
-- Das ODER stimmt — aber die bestehende Regel prueft ZWEI Dinge:
--
--   expires_at > now()  AND  sichtbar_fuer(user_id, 'story', auth.uid())
--
-- Veroderte Regeln heben BEIDE Bedingungen auf, nicht nur die erste.
-- Gemeint war: ein Highlight laeuft nicht ab. Gebaut war: ein Highlight ist
-- fuer jeden Angemeldeten sichtbar, ganz gleich, was in den
-- Sichtbarkeitseinstellungen steht.
--
-- Damit war die Luecke wieder offen, die SUPABASE_SCHEMA_19 geschlossen hat:
-- „Story-Sichtbarkeit → Niemand" liess sich einstellen, wurde gespeichert,
-- wurde richtig angezeigt — und jeder sah die Story trotzdem. Nur diesmal
-- ausschliesslich fuer Storys in einem Highlight.
--
-- DIE KORREKTUR
--
-- Die zweite Regel hebt nur noch den Ablauf auf, nicht die Sichtbarkeit.
-- `sichtbar_fuer` steht deshalb in BEIDEN Regeln. Sie doppelt dort zu
-- fuehren ist keine zweite Wahrheit: es ist dieselbe Funktion, einmal
-- geschrieben, zweimal aufgerufen.
--
-- Start:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--     SUPABASE_SCHEMA_48_highlight_sichtbarkeit.sql
-- ===========================================================================

drop policy if exists stories_im_highlight on public.stories;
create policy stories_im_highlight on public.stories
  for select to authenticated using (
    public.sichtbar_fuer(user_id, 'story', auth.uid())
    and exists (
      select 1
        from public.sammlung_inhalte si
        join public.sammlungen s on s.id = si.sammlung_id
       where si.story_id = stories.id
         and s.art = 'highlight'
    )
  );


-- ---------------------------------------------------------------------------
-- Nachweis
-- ---------------------------------------------------------------------------
-- Die Verwaltungs-API meldet auch dann Erfolg, wenn nichts passiert ist.
do $$
declare
  v_text text;
begin
  select pg_get_expr(pol.polqual, pol.polrelid)
    into v_text
    from pg_policy pol
    join pg_class c on c.oid = pol.polrelid
   where c.relname = 'stories' and pol.polname = 'stories_im_highlight';

  if v_text is null then
    raise exception 'Die Regel stories_im_highlight gibt es nicht';
  end if;
  if v_text not like '%sichtbar_fuer%' then
    raise exception 'Die Regel prueft die Sichtbarkeit nicht: %', v_text;
  end if;

  raise notice 'stories_im_highlight prueft die Sichtbarkeit mit.';
end $$;
