-- ===========================================================================
-- Schema 54: Songs mit Songwriter, Cover und Hörprobe (23.09.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: "Songs: Abspielen, nur die aktuell gesungene
-- Textzeile, Songwriter-Name, offizielles Songbild." Die Tabelle sounds kannte
-- nur Titel, Interpret, Laufzeit und Liedtext. Der Abspielknopf ließ eine Uhr
-- laufen, ohne dass etwas zu hören war.
--
-- Drei neue Spalten:
--   songwriter  wer den Song geschrieben hat (nicht immer der Interpret)
--   cover_url   das Songbild
--   audio_url   die Hörprobe, 30 Sekunden wie ein Sound-Ausschnitt
--
-- Die Adressen sind Pfade auf der Website (/sounds/...). Die Website nimmt
-- sie so, die App setzt die Website-Adresse davor (lib/daten.ts). Die Dateien
-- erzeugt web/tools/testsounds.py selbst — die Test-Sounds sind erfunden, es
-- gibt nichts Offizielles, das man laden dürfte.
--
-- Leserechte ändern sich nicht: "Sounds lesen" gilt für die ganze Zeile.
-- ===========================================================================

alter table public.sounds add column if not exists songwriter text not null default '';
alter table public.sounds add column if not exists cover_url  text not null default '';
alter table public.sounds add column if not exists audio_url  text not null default '';

update public.sounds set songwriter = 'Lys & Jonas Wendt',
  cover_url = '/sounds/golden-hour.jpg', audio_url = '/sounds/golden-hour.m4a'
  where id = '66666666-a11e-4d1a-8000-000000000001';
update public.sounds set songwriter = 'beatlab',
  cover_url = '/sounds/lo-fi-focus.jpg', audio_url = '/sounds/lo-fi-focus.m4a'
  where id = '66666666-a11e-4d1a-8000-000000000002';
update public.sounds set songwriter = 'Milo Brandt, Ana Ruiz',
  cover_url = '/sounds/kitchen-groove.jpg', audio_url = '/sounds/kitchen-groove.m4a'
  where id = '66666666-a11e-4d1a-8000-000000000003';
update public.sounds set songwriter = 'Aster',
  cover_url = '/sounds/runner-high.jpg', audio_url = '/sounds/runner-high.m4a'
  where id = '66666666-a11e-4d1a-8000-000000000004';
update public.sounds set songwriter = 'Nora Kessler',
  cover_url = '/sounds/ambient-sunrise.jpg', audio_url = '/sounds/ambient-sunrise.m4a'
  where id = '66666666-a11e-4d1a-8000-000000000005';
