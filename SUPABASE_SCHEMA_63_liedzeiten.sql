-- ===========================================================================
-- Schema 63: Einsätze der Liedzeilen (28.09.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: "Lyrics zeigen den gesamten Text; gewünscht ist nur
-- die gerade gesungene Zeile/Passage." Schema 54 brachte die Hörprobe, aber
-- keine Angabe, wann welche Zeile dran ist. App und Website haben die Zeilen
-- deshalb gleichmäßig über die 30 Sekunden verteilt — geraten, nicht gewusst.
--
-- Neue Spalte:
--   lyrics_zeiten  Sekunden ab Beginn der Hörprobe, ab der jede Zeile
--                  gesungen wird. Eine Zahl je NICHT-LEERER Zeile in
--                  `lyrics` (leere Einträge sind Strophenabstände), aufsteigend.
--                  null = keine Einsätze bekannt, dann verteilt
--                  gemeinsam/liedtext.js gleichmäßig wie bisher.
--
-- Passt die Anzahl nicht oder steigen die Zahlen nicht an, verwirft
-- gemeinsam/liedtext.js die Angabe und fällt auf die Verteilung zurück —
-- eine falsch gepflegte Zeile kann die Seite also nicht zerlegen.
--
-- Die Test-Sounds sind erfunden (siehe Schema 54, web/tools/testsounds.py);
-- in ihren Hörproben singt niemand. Die Einsätze unten sind deshalb gesetzt,
-- nicht gehört: sie geben dem Mechanismus etwas zum Zeigen, mehr nicht.
--
-- Leserechte ändern sich nicht: "Sounds lesen" (Schema 5) gilt für die ganze
-- Zeile. Keine neue Funktion, also auch keine EXECUTE-Rechte an PUBLIC.
--
-- App und Website fragen die Spalte ab. Fehlt sie (Schema 63 noch nicht
-- eingespielt), laden beide die Sounds ohne sie weiter — siehe ladeSounds in
-- app/lib/daten.ts und web/server/supabase-api.js.
-- ===========================================================================

alter table public.sounds add column if not exists lyrics_zeiten real[];

-- Golden Hour: 8 gesungene Zeilen in drei Strophen.
update public.sounds set lyrics_zeiten = array[0, 3.5, 7.5, 11, 15, 18.5, 22.5, 26]::real[]
  where id = '66666666-a11e-4d1a-8000-000000000001';
-- Kitchen Groove: 6 Zeilen.
update public.sounds set lyrics_zeiten = array[0, 4.5, 9.5, 14, 19.5, 24]::real[]
  where id = '66666666-a11e-4d1a-8000-000000000003';
-- Runner High: 6 Zeilen, mit kurzem Vorspiel.
update public.sounds set lyrics_zeiten = array[1.5, 5.5, 10, 14.5, 19.5, 24]::real[]
  where id = '66666666-a11e-4d1a-8000-000000000004';
-- Lo-Fi Focus und Ambient Sunrise sind Instrumentals (lyrics null) und
-- bekommen keine Einsätze.
