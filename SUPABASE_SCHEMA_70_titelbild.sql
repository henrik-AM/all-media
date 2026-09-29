-- ===========================================================================
-- Schema 70 (Entwurf): Titelbild für Playlists und Highlights
-- (29.09.2026, Kasten 12.7 und 12.8)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: „Playlist: Titelbild im runden Kreis aus einem
-- Thumbnail eines enthaltenen Beitrags wählbar. Highlight: Vorschaubild aus
-- einem enthaltenen Beitrag oder einem beliebigen Foto wählbar."
--
-- Befund: `sammlungen` (Schema 46) kennt kein Titelbild. Der Kreis zeigt
-- das zuletzt hinzugefügte Stück — die Regel stand in
-- app/lib/aktionen.ts (sammlungenVon) und web/server/app.js
-- (/api/sammlungen); jetzt einmal in gemeinsam/sammlungen.js.
--
-- NEU
--
--   sammlungen.titel_post_id   Playlist: der gewählte Beitrag
--   sammlungen.titel_story_id  Highlight: die gewählte Story
--   sammlungen.titelbild_url   Highlight: ein eigenes Foto (bestaendige Form
--                              im Eimer `media`, ausgeliefert nur
--                              unterschrieben)
--
-- Als Verweis statt als kopierte Adresse: wird der Beitrag gelöscht, fällt
-- die Wahl per `on delete set null` weg, und der Kreis zeigt wieder das
-- neueste Stück — statt einer toten Adresse.
--
-- Höchstens eine der drei Angaben ist gesetzt; wer neu wählt, setzt die
-- anderen beiden auf null (so machen es App und Website).
--
-- RECHTE
--
-- Die Regel `sammlungen_aendern` aus Schema 46 (nur der Besitzer) deckt das
-- Setzen bereits ab. Keine neue Regel, keine Spaltenrechte nötig:
-- `sammlungen` hat keine spaltenweisen Rechte.
--
-- Der Auslöser unten prüft, dass die gewählte Stelle wirklich in DIESER
-- Sammlung liegt und zur Gattung passt — sonst ließe sich über die ID ein
-- fremder, sonst unsichtbarer Beitrag als Titelbild einschmuggeln.
--
-- Alles idempotent.
-- ===========================================================================

alter table public.sammlungen
  add column if not exists titel_post_id  uuid references public.posts(id)   on delete set null;
alter table public.sammlungen
  add column if not exists titel_story_id uuid references public.stories(id) on delete set null;
alter table public.sammlungen
  add column if not exists titelbild_url  text;

alter table public.sammlungen drop constraint if exists sammlungen_titelbild_eimer;
alter table public.sammlungen add constraint sammlungen_titelbild_eimer check (
  titelbild_url is null
  or titelbild_url ~ '/storage/v1/object/public/media/(stories|posts)/[A-Za-z0-9._-]+$'
);

-- Höchstens eine Quelle.
alter table public.sammlungen drop constraint if exists sammlungen_titel_eine_quelle;
alter table public.sammlungen add constraint sammlungen_titel_eine_quelle check (
  (titel_post_id is not null)::int + (titel_story_id is not null)::int + (titelbild_url is not null)::int <= 1
);

create or replace function public.sammlung_titel_pruefen()
returns trigger
language plpgsql
as $$
begin
  if new.art = 'playlist' and (new.titel_story_id is not null or new.titelbild_url is not null) then
    raise exception 'Das Titelbild einer Playlist kommt aus einem ihrer Beiträge';
  end if;
  if new.art = 'highlight' and new.titel_post_id is not null then
    raise exception 'Das Titelbild eines Highlights ist eine Story daraus oder ein eigenes Foto';
  end if;

  if new.titel_post_id is not null and not exists (
       select 1 from public.sammlung_inhalte
        where sammlung_id = new.id and post_id = new.titel_post_id) then
    raise exception 'Dieser Beitrag liegt nicht in der Playlist';
  end if;
  if new.titel_story_id is not null and not exists (
       select 1 from public.sammlung_inhalte
        where sammlung_id = new.id and story_id = new.titel_story_id) then
    raise exception 'Diese Story liegt nicht im Highlight';
  end if;

  return new;
end;
$$;

drop trigger if exists sammlung_titel_pruefen on public.sammlungen;
create trigger sammlung_titel_pruefen
  before insert or update of titel_post_id, titel_story_id, titelbild_url, art
  on public.sammlungen
  for each row execute function public.sammlung_titel_pruefen();

-- Postgres gibt EXECUTE an eine neue Funktion automatisch an PUBLIC.
revoke execute on function public.sammlung_titel_pruefen() from public, anon;

-- Nimmt jemand das gewählte Stück aus der Sammlung heraus (ohne es zu
-- löschen), muss die Wahl mit. Sonst zeigte der Kreis ein Bild, das nicht
-- mehr darin liegt.
create or replace function public.sammlung_titel_freigeben()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sammlungen
     set titel_post_id  = case when titel_post_id  = old.post_id  then null else titel_post_id  end,
         titel_story_id = case when titel_story_id = old.story_id then null else titel_story_id end
   where id = old.sammlung_id
     and (titel_post_id = old.post_id or titel_story_id = old.story_id);
  return old;
end;
$$;

drop trigger if exists sammlung_titel_freigeben on public.sammlung_inhalte;
create trigger sammlung_titel_freigeben
  after delete on public.sammlung_inhalte
  for each row execute function public.sammlung_titel_freigeben();

revoke execute on function public.sammlung_titel_freigeben() from public, anon, authenticated;
