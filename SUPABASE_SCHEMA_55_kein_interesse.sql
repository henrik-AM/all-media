-- ===========================================================================
-- Schema 55: "Kein Interesse" am Beitrag (23.09.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: "Drei-Punkte-Menü (unten eingeblendet): Link
-- kopieren, herunterladen, zu Story hinzufügen, melden, kein Interesse ...
-- Vorbild TikTok." Ein Knopf "Kein Interesse", der nur eine Meldung zeigt,
-- ist eine Einstellung ohne Wirkung. Deshalb steht die Wahl hier, und beide
-- Feeds (app/lib/daten.ts, web/server/supabase-api.js) lassen die Beiträge
-- weg.
--
-- Nur im Feed. Auf dem Profil der Person und in der Suche steht der Beitrag
-- weiter - man will ihn nicht mehr vorgeschlagen bekommen, er ist nicht
-- verboten.
--
-- Jeder sieht nur die eigenen Zeilen. Wer "kein Interesse" an einem Beitrag
-- hat, geht die Person, die ihn gestellt hat, nichts an.
--
-- Der Testbestand wird in /api/reset (web/server/app.js) geleert, nicht in
-- zuruecksetzen(): die Funktion noch einmal ganz zu schreiben hieße, eine
-- sechste Fassung davon in Umlauf zu bringen (SUPABASE_REIHENFOLGE.md).
-- ===========================================================================

create table if not exists public.kein_interesse (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  post_id    uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.kein_interesse enable row level security;

revoke all on public.kein_interesse from anon;
grant select, insert, delete on public.kein_interesse to authenticated;

drop policy if exists "Kein Interesse lesen" on public.kein_interesse;
create policy "Kein Interesse lesen" on public.kein_interesse
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Kein Interesse setzen" on public.kein_interesse;
create policy "Kein Interesse setzen" on public.kein_interesse
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "Kein Interesse zuruecknehmen" on public.kein_interesse;
create policy "Kein Interesse zuruecknehmen" on public.kein_interesse
  for delete to authenticated using (auth.uid() = user_id);

-- Ein Konto, das noch auf die Freigabe eines Elternteils wartet, schreibt und
-- liest hier so wenig wie in jeder anderen Tabelle (Schema 52, Teil 4). Die
-- Schleife dort erfasst nur Tabellen, die es beim Einspielen schon gab.
drop policy if exists nur_freigegebene on public.kein_interesse;
create policy nur_freigegebene on public.kein_interesse
  as restrictive for all to authenticated
  using ((select public.konto_freigegeben())) with check ((select public.konto_freigegeben()));
