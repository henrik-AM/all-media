-- =====================================================================
-- SUPABASE_SCHEMA_26_community_loeschen.sql — 04.09.2026
--
-- Die eigene Community laesst sich nicht loeschen — und niemand hat es
-- gemerkt.
--
-- WIE ES AUFFIEL
--
-- Beim Nachsehen im Bestand standen fuenfzehn Communitys mit dem Namen
-- "Prüflauf PTT", angelegt zwischen dem 03.09.2026 12:58 und dem 04.09.2026
-- 11:34 — alle vom Testkonto. Angelegt werden sie in
-- `app/test/_sichtbarkeit.js`, und derselbe Lauf loescht sie am Ende auch
-- wieder:
--
--     await eigner.client.from('communities').delete().eq('id', ...);
--
-- Diese Zeile meldet keinen Fehler. Sie loescht nur nichts:
--
--     DELETE meldet: kein Fehler, 0 Zeilen
--     Nachgezaehlt: Zeile noch da? true
--
-- Das ist der bekannte Fall — ein von Row Level Security abgelehntes DELETE
-- ist kein Fehler, es trifft schlicht keine Zeile. Der Grund: auf
-- `public.communities` gibt es Regeln fuer SELECT und INSERT, aber keine
-- einzige fuer DELETE. Ohne Regel gilt bei eingeschaltetem RLS: verboten.
--
-- WAS AUSSER DEM PRUEFLAUF DARAN HAENGT
--
-- Zwei Stellen im echten Code verlassen sich auf genau dieses Loeschen —
-- beide als Ruecknahme, wenn das Eintragen des ersten Mitglieds scheitert:
--
--   app/lib/aktionen.ts:380        communityAnlegen()
--   web/server/sync-handlers.js    handleCreateCommunity()
--
-- Der Kommentar dort sagt "halb angelegte Community wieder weggeraeumt".
-- Weggeraeumt wurde nie etwas: eine Community ohne Mitglieder waere fuer
-- immer stehen geblieben, sichtbar in jeder Liste, und niemand haette sie
-- betreten koennen.
--
-- Start:
--   SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--     ../SUPABASE_SCHEMA_26_community_loeschen.sql
-- =====================================================================

/*
 * Loeschen darf, wer sie angelegt hat — sonst niemand.
 *
 * Nicht "wer Mitglied ist": dann koennte jeder Beigetretene die Community
 * aller anderen entfernen. `created_by` ist dieselbe Spalte, an der die
 * Oberflaeche schon heute entscheidet, ob "Verlassen" angeboten wird
 * (web/server/supabase-api.js: `eigen: c.created_by === nutzerId`).
 *
 * Kanaele, Mitglieder und PTT-Nachrichten haengen mit `on delete cascade`
 * daran und gehen mit.
 */
drop policy if exists "Eigene Community loeschen" on public.communities;
create policy "Eigene Community loeschen" on public.communities
  for delete to authenticated
  using (created_by = auth.uid());

/*
 * Umbenennen bleibt bewusst weiterhin verboten.
 *
 * Es gibt keine Stelle in App oder Website, die eine Community aendert — eine
 * UPDATE-Regel waere Recht ohne Verwendung. Kommt der Bildschirm dazu, kommt
 * die Regel mit ihm.
 */

-- ---------------------------------------------- Die Reste wegraeumen --

/*
 * Die fuenfzehn liegengebliebenen Pruefstuecke.
 *
 * Bewusst eng gefasst: nur dieser eine Name, den ausschliesslich
 * `test/_sichtbarkeit.js` vergibt. Keine Communitys mit Beitraegen, keine
 * fremden — der Lauf haette sie selbst entfernt, wenn er gedurft haette.
 */
do $$
declare weg integer;
begin
  delete from public.communities where name = 'Prüflauf PTT';
  get diagnostics weg = row_count;
  raise notice 'Liegengebliebene Pruefcommunitys entfernt: %', weg;
end
$$;

-- ------------------------------------------------------------ Nachweis --

do $$
begin
  if not exists (
    select 1 from pg_policies
     where schemaname = 'public' and tablename = 'communities' and cmd = 'DELETE'
  ) then
    raise exception 'Die Loeschregel steht nicht.';
  end if;

  if exists (select 1 from public.communities where name = 'Prüflauf PTT') then
    raise exception 'Es stehen weiterhin Pruefcommunitys im Bestand.';
  end if;

  raise notice 'Schema 26: Die eigene Community laesst sich loeschen.';
end
$$;
