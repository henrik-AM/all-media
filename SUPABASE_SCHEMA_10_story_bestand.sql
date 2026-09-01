-- ===========================================================================
--  All Media — Schema 10: die Story des Testbestands läuft nicht mehr ab
--  Stand 01.09.2026
--
--  WARUM ES DIESE DATEI GIBT
--
--  Storys laufen nach 24 Stunden ab, und die Regel auf `stories` zeigt nur
--  Zeilen mit expires_at > now(). Für die Beispielstorys von Anna, Bob und
--  den anderen ist das längst gelöst: SUPABASE_SCHEMA_6_inhalte.sql setzt
--  ihnen zehn Jahre, sonst wäre die Story-Leiste am Tag nach dem Einspielen
--  leer.
--
--  Für die eigene Story des Testkontos galt das nicht — sie bekam die üblichen
--  24 Stunden. Einen Tag nach dem Einspielen meldete test:datenbank deshalb
--  "Eigene Story: FAIL", und im Testkonto war der eigene Storykreis leer, ohne
--  dass jemand etwas gelöscht hätte.
--
--  Die Funktion zuruecksetzen() ist in SUPABASE_SCHEMA_7_testkonto.sql
--  korrigiert. Diese Datei repariert zusätzlich, was schon in der Datenbank
--  steht: die abgelaufene Zeile ist noch da, sie wird nur nicht mehr gezeigt.
--
--  Betroffen sind ausschließlich Zeilen mit demo = true — also der
--  Testbestand. Was ein Mensch selbst aufnimmt, läuft weiterhin nach einem
--  Tag ab. Das soll so sein.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_… node tools/sql-einspielen.mjs SUPABASE_SCHEMA_10_story_bestand.sql
-- ===========================================================================

update public.stories
   set expires_at = now() + interval '10 years'
 where demo = true
   and expires_at <= now() + interval '48 hours';
