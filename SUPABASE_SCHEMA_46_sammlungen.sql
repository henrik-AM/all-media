-- ===========================================================================
--  Highlights und Playlists bekommen einen Inhalt
-- ===========================================================================
--
--  BEFUND (20.09.2026)
--
--  Im Profil stehen über den Registern fünf Kreise: zwei Playlists, drei
--  Highlights. Keiner hat ein Vorschaubild, und Antippen tut nichts außer
--  einer Meldung:
--
--      onPress={() => onNotice(`Highlight „${label}"`)}
--
--  Der Grund steht in der Datenbank. `profiles.highlights` und
--  `profiles.playlists` sind Textlisten — nur Namen:
--
--      select highlights, playlists from profiles where handle = '@test';
--      -> {"Test","Reisen","Technik"}   {"Zum Prüfen","Später ansehen"}
--
--  Es gibt keine Zuordnung, welcher Beitrag zu welcher Playlist gehört und
--  welche Story in welchem Highlight liegt. Ein Vorschaubild kann es
--  deshalb gar nicht geben: es gibt nichts, wovon es das Vorschaubild wäre.
--
--  Nach der Stufenregel ist das Stufe drei von vier — vorhanden, bedienbar,
--  gespeichert, aber ohne Wirkung. Anlegen funktioniert; das Angelegte
--  bleibt leer.
--
--  WAS DAS HANDBUCH VERLANGT
--
--    - „Erstellen: Storys, Bilder, ... Highlights, Playlists."
--    - je Beitrag: „zur Playlist hinzufügen"
--    - Profilregister: „... favorisierte Beiträge, Playlists."
--
--  Nichts davon geht ohne Zuordnung.
--
--  WARUM EINE TABELLE FÜR BEIDES
--
--  Playlist und Highlight unterscheiden sich in genau einem Punkt: worauf
--  sie zeigen. Alles andere — Name, Besitzer, Reihenfolge, Rechte — ist
--  dasselbe. Zwei Tabellenpaare hießen dieselbe Regel viermal, und beim
--  nächsten Mal wäre eine davon vergessen. Die Gattung steht in `art`.
--
--  DIE STOLPERSTELLE: STORYS LAUFEN AB
--
--  `stories.expires_at` beendet eine Story nach 24 Stunden, und die
--  Leseregel aus Schema 19 hält sich daran. Ein Highlight, dessen Inhalt
--  nach einem Tag verschwindet, ist kein Highlight.
--
--  Zwei Wege standen zur Wahl:
--
--    (a) beim Einsortieren eine Kopie der Medienadresse in die
--        Zuordnungstabelle schreiben
--    (b) die Leseregel erweitern: eine abgelaufene Story bleibt sichtbar,
--        solange sie in einem Highlight liegt
--
--  (a) wäre eine zweite Wahrheit über dieselbe Story — ändert sich das
--  Original, driften die beiden auseinander. Hier steht (b).
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_46_sammlungen.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Die Sammlung selbst
-- ---------------------------------------------------------------------------
create table if not exists public.sammlungen (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  art        text not null check (art in ('playlist', 'highlight')),
  name       text not null check (length(btrim(name)) between 1 and 60),
  created_at timestamptz not null default now(),
  -- Zwei Playlists desselben Namens beim selben Profil waeren fuer niemanden
  -- unterscheidbar. Eine Playlist und ein Highlight desselben Namens schon.
  unique (user_id, art, name)
);

create index if not exists sammlungen_user_art_idx
  on public.sammlungen (user_id, art, created_at);


-- ---------------------------------------------------------------------------
--  2. Was darin liegt
-- ---------------------------------------------------------------------------
--  `post_id` und `story_id` stehen nebeneinander, aber nie gleichzeitig.
--  Welche der beiden gefuellt sein muss, entscheidet die Gattung der
--  Sammlung — geprueft weiter unten im Ausloeser, weil eine
--  CHECK-Bedingung die andere Tabelle nicht sehen kann.
create table if not exists public.sammlung_inhalte (
  id          uuid primary key default gen_random_uuid(),
  sammlung_id uuid not null references public.sammlungen(id) on delete cascade,
  post_id     uuid references public.posts(id)   on delete cascade,
  story_id    uuid references public.stories(id) on delete cascade,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  constraint sammlung_inhalte_genau_eins check (
    (post_id is not null and story_id is null) or
    (post_id is null and story_id is not null)
  )
);

-- Derselbe Beitrag zweimal in derselben Playlist ist keine Sammlung, sondern
-- ein Versehen. Zwei Teilindizes statt eines: NULL vergleicht sich nicht.
create unique index if not exists sammlung_inhalte_post_uniq
  on public.sammlung_inhalte (sammlung_id, post_id) where post_id is not null;
create unique index if not exists sammlung_inhalte_story_uniq
  on public.sammlung_inhalte (sammlung_id, story_id) where story_id is not null;

create index if not exists sammlung_inhalte_sammlung_idx
  on public.sammlung_inhalte (sammlung_id, position, created_at);


-- ---------------------------------------------------------------------------
--  3. Die Gattung muss zum Inhalt passen
-- ---------------------------------------------------------------------------
create or replace function public.sammlung_inhalt_pruefen()
returns trigger
language plpgsql
as $$
declare
  v_art text;
begin
  select art into v_art from public.sammlungen where id = new.sammlung_id;
  if v_art is null then
    raise exception 'Sammlung % gibt es nicht', new.sammlung_id;
  end if;

  if v_art = 'playlist' and new.post_id is null then
    raise exception 'In eine Playlist gehoert ein Beitrag, keine Story';
  end if;
  if v_art = 'highlight' and new.story_id is null then
    raise exception 'In ein Highlight gehoert eine Story, kein Beitrag';
  end if;

  return new;
end;
$$;

drop trigger if exists sammlung_inhalt_pruefen on public.sammlung_inhalte;
create trigger sammlung_inhalt_pruefen
  before insert or update on public.sammlung_inhalte
  for each row execute function public.sammlung_inhalt_pruefen();


-- ---------------------------------------------------------------------------
--  4. Rechte
-- ---------------------------------------------------------------------------
--  Lesen darf jeder Angemeldete: eine Playlist im fremden Profil ist Teil
--  des Profils. Aendern nur der Besitzer.
alter table public.sammlungen       enable row level security;
alter table public.sammlung_inhalte enable row level security;

drop policy if exists sammlungen_lesen   on public.sammlungen;
drop policy if exists sammlungen_anlegen on public.sammlungen;
drop policy if exists sammlungen_aendern on public.sammlungen;
drop policy if exists sammlungen_loeschen on public.sammlungen;

create policy sammlungen_lesen on public.sammlungen
  for select to authenticated using (true);
create policy sammlungen_anlegen on public.sammlungen
  for insert to authenticated with check (user_id = auth.uid());
create policy sammlungen_aendern on public.sammlungen
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy sammlungen_loeschen on public.sammlungen
  for delete to authenticated using (user_id = auth.uid());

drop policy if exists sammlung_inhalte_lesen    on public.sammlung_inhalte;
drop policy if exists sammlung_inhalte_anlegen  on public.sammlung_inhalte;
drop policy if exists sammlung_inhalte_loeschen on public.sammlung_inhalte;

create policy sammlung_inhalte_lesen on public.sammlung_inhalte
  for select to authenticated using (true);
create policy sammlung_inhalte_anlegen on public.sammlung_inhalte
  for insert to authenticated with check (
    exists (select 1 from public.sammlungen s
             where s.id = sammlung_id and s.user_id = auth.uid())
  );
create policy sammlung_inhalte_loeschen on public.sammlung_inhalte
  for delete to authenticated using (
    exists (select 1 from public.sammlungen s
             where s.id = sammlung_id and s.user_id = auth.uid())
  );

-- Postgres gibt EXECUTE an eine neue Funktion automatisch an PUBLIC. Der
-- Ausloeser laeuft ohne Aufrufrecht; abgenommen wird es trotzdem.
revoke execute on function public.sammlung_inhalt_pruefen() from public;


-- ---------------------------------------------------------------------------
--  5. Eine Story im Highlight laeuft nicht ab
-- ---------------------------------------------------------------------------
--  Die bestehende Leseregel bleibt unberuehrt — es kommt eine zweite dazu.
--  Zwei Regeln zum selben Vorgang verodert Postgres, und genau das ist
--  gemeint: sichtbar, wenn laufend ODER in einem Highlight.
drop policy if exists stories_im_highlight on public.stories;
create policy stories_im_highlight on public.stories
  for select to authenticated using (
    exists (
      select 1
        from public.sammlung_inhalte si
        join public.sammlungen s on s.id = si.sammlung_id
       where si.story_id = stories.id
         and s.art = 'highlight'
    )
  );


-- ---------------------------------------------------------------------------
--  6. Die alten Namenslisten wandern herueber
-- ---------------------------------------------------------------------------
--  `profiles.highlights` und `profiles.playlists` bleiben vorerst stehen —
--  App und Website lesen sie noch. Geloescht werden sie erst, wenn beide
--  Seiten auf den Sammlungen sind; sonst steht das Profil zwischendurch
--  ohne Kreise da.
insert into public.sammlungen (user_id, art, name)
select p.id, 'playlist', btrim(n)
  from public.profiles p, unnest(coalesce(p.playlists, '{}')) as n
 where btrim(n) <> ''
on conflict (user_id, art, name) do nothing;

insert into public.sammlungen (user_id, art, name)
select p.id, 'highlight', btrim(n)
  from public.profiles p, unnest(coalesce(p.highlights, '{}')) as n
 where btrim(n) <> ''
on conflict (user_id, art, name) do nothing;


-- ---------------------------------------------------------------------------
--  7. Gegenprobe
-- ---------------------------------------------------------------------------
--  Die Management-API meldet Erfolg, auch wenn ein UPDATE null Zeilen
--  getroffen hat. Deshalb wird hier gezaehlt statt gehofft.
do $$
declare
  v_namen  integer;
  v_sammel integer;
begin
  select count(*) into v_namen
    from public.profiles p, unnest(coalesce(p.playlists, '{}') || coalesce(p.highlights, '{}')) as n
   where btrim(n) <> '';

  select count(*) into v_sammel from public.sammlungen;

  if v_sammel < v_namen then
    raise exception 'Nur % von % Namen sind Sammlungen geworden', v_sammel, v_namen;
  end if;

  raise notice 'Sammlungen: % (aus % Namen)', v_sammel, v_namen;
end;
$$;
