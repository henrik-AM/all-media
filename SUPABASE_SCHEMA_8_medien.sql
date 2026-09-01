-- ===========================================================================
-- All Media — Schema 8: echte Bilder und echte Videos statt Farbflächen
-- ===========================================================================
--
-- Wofür diese Datei da ist
-- ------------------------
-- Bis hierher hatte kein einziger Beispielbeitrag ein Bild. Die Oberfläche
-- hat das aufgefangen: wo kein Bild ist, zeichnet sie eine ruhige Farbfläche
-- mit einem kleinen Symbol darin. Das sieht nicht nach Fehler aus — und
-- genau deshalb ist monatelang niemandem aufgefallen, dass in der App
-- schlicht nichts zu sehen war.
--
-- Bei den Videos war es schlimmer. Die fünf Testvideos aus Schema 7 waren
-- PNG-Dateien mit der Aufschrift „Test-Video". Wer auf Wiedergabe drückte,
-- sah ein Standbild und einen Zähler, der hochlief. Ein Video ansehen konnte
-- man nicht.
--
-- Diese Datei trägt echte Medien ein:
--
--   - Zu jedem der vier Foto-Beiträge ein echtes Foto zum Thema. Der
--     Hafen-Beitrag zeigt den Hamburger Hafen, der Zugspitze-Beitrag die
--     Zugspitze.
--   - Zu jedem der vierzehn Videobeiträge eine echte Videodatei, 52 bis 60
--     Sekunden lang, dazu ein Standbild aus genau diesem Ausschnitt — was
--     im Raster zu sehen ist, ist auch das, was abgespielt wird.
--   - Zu jeder der sechs Beispielstorys ein echtes Foto.
--
-- Die Dateien liegen im Eimer „media" unter beispiel/ und werden von
-- app/tools/testmedien.js erzeugt und hochgeladen. Der Lizenznachweis steht
-- in bilder/MEDIEN-NACHWEIS.md.
--
-- Mit geändert: Laufzeit und Kapitelmarken
-- ----------------------------------------
-- In den Beiträgen stand „18:42" oder „24:10", und die Kapitel sprangen auf
-- Sekunde 620 oder 1100. Solange nichts abgespielt wurde, war das eine
-- Beschriftung. Jetzt gibt es eine echte Datei — und die ist eine Minute
-- lang. Eine Kapitelmarke bei Minute zehn eines Einminutenvideos springt ins
-- Nichts, und die Fortschrittsleiste stünde nie über fünf Prozent. Deshalb
-- werden Laufzeit und Kapitel auf das gesetzt, was wirklich in der Datei
-- steht.
--
-- Setzt SUPABASE_SCHEMA.sql bis SUPABASE_SCHEMA_7_testkonto.sql voraus.
-- Gefahrlos mehrfach ausführbar.
-- ===========================================================================

begin;


-- ===========================================================================
-- Eine eigene Datei ersetzen dürfen
-- ===========================================================================
--
-- Der Eimer „media" kannte bisher Lesen, Anlegen und Löschen — aber nicht
-- Ersetzen. Ein Upload mit „x-upsert" ist für Postgres ein UPDATE, und ohne
-- passende Regel antwortet Supabase mit „new row violates row-level security
-- policy". Beim ersten Hochladen fällt das nicht auf, beim zweiten bricht
-- alles ab. Wer eine Datei hochgeladen hat, darf sie auch überschreiben.

drop policy if exists "Eigene Medien ersetzen" on storage.objects;
create policy "Eigene Medien ersetzen" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and owner = auth.uid())
  with check (bucket_id = 'media');


-- ===========================================================================
-- Eine eigene Story ändern dürfen
-- ===========================================================================
--
-- public.stories kannte Lesen, Anlegen und Löschen — Ändern nicht. Aufgefallen
-- ist es beim Umstellen der Testmedien: der Aufruf kam mit 200 zurück, und
-- geändert war nichts. Genau so verhält sich PostgREST, wenn die Regeln keine
-- Zeile durchlassen: es meldet keinen Fehler, es ändert nur nichts. Wer eine
-- eigene Story anlegen und löschen darf, darf sie auch ändern.

drop policy if exists "Eigene Story aendern" on public.stories;
create policy "Eigene Story aendern" on public.stories
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- ===========================================================================
-- Die achtzehn Beispielbeiträge
-- ===========================================================================
--
-- Ein Beitrag hat zwei Adressen: „media_url" ist das, was abgespielt oder
-- groß angezeigt wird, „thumbnail_url" das Bild fürs Raster. Bei einem Foto
-- ist beides dieselbe Datei, bei einem Video nicht.

--  1. Der Hafen um sechs Uhr morgens — eine Aufnahme des Hamburger Hafens
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-hafen.jpg',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-hafen.jpg'
where id = '22222222-a11e-4d1a-8000-000000000001';

--  2. Das neue Setup — Schreibtisch mit Monitor
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-homeoffice.jpg',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-homeoffice.jpg'
where id = '22222222-a11e-4d1a-8000-000000000002';

--  3. Oben angekommen — der Gipfelbereich der Zugspitze
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-gipfel.jpg',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-gipfel.jpg'
where id = '22222222-a11e-4d1a-8000-000000000003';

--  4. Kleine Commits — Quelltext auf dem Bildschirm
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-code.jpg',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-code.jpg'
where id = '22222222-a11e-4d1a-8000-000000000004';

--  5. Sonnenaufgang über den Alpen
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-01.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-01.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000005';

--  6. Home-Office in 60 Sekunden
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-02.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-02.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000006';

--  7. Pasta in 10 Minuten
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-03.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-03.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000007';

--  8. Erster Laufversuch
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-04.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-04.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000008';

--  9. Warum kleine Commits
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-05.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-05.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000009';

-- 10. Zugspitze bei Sonnenaufgang, 360°
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-01.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-01.jpg',
  duration      = '0:52',
  kapitel       = '[{"bei":0,"titel":"Aufbruch an der Hütte"},{"bei":15,"titel":"Über das Blockfeld"},{"bei":32,"titel":"Der Grat"},{"bei":46,"titel":"Sonnenaufgang am Gipfel"}]'::jsonb
where id = '22222222-a11e-4d1a-8000-000000000010';

-- 11. Design Tokens sauber aufsetzen
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-02.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-02.jpg',
  duration      = '1:00',
  kapitel       = '[{"bei":0,"titel":"Warum Tokens"},{"bei":15,"titel":"Die erste Farbvariable"},{"bei":32,"titel":"Hell und Dunkel"},{"bei":46,"titel":"Übergabe an den Code"}]'::jsonb
where id = '22222222-a11e-4d1a-8000-000000000011';

-- 12. Meal Prep für eine ganze Woche
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-03.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-03.jpg',
  duration      = '1:00',
  kapitel       = '[{"bei":0,"titel":"Einkaufszettel"},{"bei":15,"titel":"Vorbereiten"},{"bei":32,"titel":"Kochen"},{"bei":46,"titel":"Abfüllen"}]'::jsonb
where id = '22222222-a11e-4d1a-8000-000000000012';

-- 13. Expo SDK 57 live erklärt
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-04.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-04.jpg'
where id = '22222222-a11e-4d1a-8000-000000000013';

-- 14. Nachtfotografie am Hafen
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-05.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-05.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000014';

-- 15. Kleine Commits, klare Historie
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-06.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-06.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000015';

-- 16. Hamburger Hafen in 360°
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-07.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-07.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000016';

-- 17. Sonntagsküche live
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-08.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-08.jpg'
where id = '22222222-a11e-4d1a-8000-000000000017';

-- 18. Gipfelpanorama Alpen, 360°
update public.posts set
  media_url     = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-09.mp4',
  thumbnail_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-09.jpg',
  duration      = '1:00'
where id = '22222222-a11e-4d1a-8000-000000000018';


-- ===========================================================================
-- Die sechs Beispielstorys
-- ===========================================================================
--
-- Storys haben nur eine Adresse. Sie sind hochkant, deshalb 720 × 1280.

-- Erstes Licht auf 2500 Metern
update public.stories set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-berge.jpg' where id = '33333333-a11e-4d1a-8000-000000000001';

-- Neuer Build läuft durch
update public.stories set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-build.jpg' where id = '33333333-a11e-4d1a-8000-000000000002';

-- Hafen im Nebel
update public.stories set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-hafen.jpg' where id = '33333333-a11e-4d1a-8000-000000000003';

-- Schreibtisch neu sortiert
update public.stories set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-schreibtisch.jpg' where id = '33333333-a11e-4d1a-8000-000000000004';

-- Pasta in zehn Minuten
update public.stories set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-pasta.jpg' where id = '33333333-a11e-4d1a-8000-000000000005';

-- 20 Kilometer geschafft
update public.stories set media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-laufen.jpg' where id = '33333333-a11e-4d1a-8000-000000000006';


-- ===========================================================================
-- Der eigene Testbestand jedes Kontos
-- ===========================================================================
--
-- Erst die Vorlage — daraus legt public.starter_inhalte() die Inhalte für
-- jedes neu registrierte Konto an. Danach werden die bereits angelegten
-- Beiträge nachgezogen: sie werden an ihrer Beschreibung wiedererkannt,
-- genauso wie starter_inhalte() es tut.

update public.vorlage_eigene_beitraege set
  media_url     = case schluessel
                    when 'eigen-foto'        then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-test.jpg'
                    when 'eigen-hochformat'  then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-05.mp4'
                    when 'eigen-querformat'  then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-09.mp4'
                    when 'eigen-360'         then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-07.mp4'
                    when 'eigen-live'        then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-08.mp4'
                  end,
  thumbnail_url = case schluessel
                    when 'eigen-foto'        then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/foto-test.jpg'
                    when 'eigen-hochformat'  then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/reel-05.jpg'
                    when 'eigen-querformat'  then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-09.jpg'
                    when 'eigen-360'         then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-07.jpg'
                    when 'eigen-live'        then 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/clip-08.jpg'
                  end,
  duration      = case schluessel
                    when 'eigen-hochformat'  then '1:00'
                    when 'eigen-querformat'  then '1:00'
                    when 'eigen-360'         then '1:00'
                    else duration
                  end,
  kapitel       = case schluessel
                    when 'eigen-querformat'
                      then '[{"titel":"Einleitung","bei":0},{"titel":"Hauptteil","bei":15},{"titel":"Beispiel","bei":32},{"titel":"Fazit","bei":46}]'::jsonb
                    else kapitel
                  end
where schluessel in ('eigen-foto', 'eigen-hochformat', 'eigen-querformat', 'eigen-360', 'eigen-live');

update public.vorlage_eigene_storys set
  media_url = 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-test.jpg'
where schluessel = 'eigen-story';


-- Die schon angelegten eigenen Beiträge nachziehen. Ohne diesen Schritt
-- hätte nur ein frisch registriertes Konto echte Medien — die vorhandenen
-- Testkonten blieben bei den PNG-Platzhaltern.
update public.posts b set
  media_url     = v.media_url,
  thumbnail_url = v.thumbnail_url,
  duration      = v.duration,
  kapitel       = v.kapitel
from public.vorlage_eigene_beitraege v
where b.demo and b.description = v.description;

update public.stories s set
  media_url = v.media_url
from public.vorlage_eigene_storys v
where s.demo and s.caption = v.caption;


-- ===========================================================================
-- Probe
-- ===========================================================================
--
-- Sagt beim Einspielen, wie viele Beiträge jetzt ein Medium haben. Steht hier
-- eine Null, ist etwas schiefgegangen — siehe
-- 2.Gehirn.md/…/feedback_gruene_tests_beweisen_nichts.

do $$
declare
  v_mit    integer;
  v_ohne   integer;
  v_storys integer;
begin
  select count(*) into v_mit   from public.posts where demo and media_url is not null;
  select count(*) into v_ohne  from public.posts where demo and media_url is null;
  select count(*) into v_storys from public.stories where demo and media_url is not null;
  raise notice 'Beiträge mit Medium: %, ohne: %, Storys mit Bild: %', v_mit, v_ohne, v_storys;
end $$;

commit;
