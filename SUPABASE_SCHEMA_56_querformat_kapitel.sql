-- ===========================================================================
-- Schema 56: Laufzeit und Kapitel des eigenen Querformat-Testvideos (24.09.2026)
-- ===========================================================================
--
-- WORUM ES GEHT
--
-- Henrik am 21.09.2026: "Kapitel ergeben keinen Sinn (Kapitel bei Minute 11
-- in einem 1-Minuten-Video)." Seitdem zeigt der Player nur Kapitel, die im
-- Video liegen. Das eigene Testvideo im Querformat verlor dadurch drei seiner
-- vier Kapitel - der Prueflauf _player merkte es.
--
-- Schema 8 hatte Laufzeit ("1:00") und Kapitel (0/15/32/46 s) der Vorlage
-- schon passend zu clip-09.mp4 gesetzt. Schema 7, am 18.09.2026 neu
-- eingespielt, schrieb "12:40" und Kapitel bis 700 s zurueck; Schema 45 zog
-- danach nur die Medienadressen nach, nicht Laufzeit und Kapitel.
--
-- Diese Datei gewinnt fuer genau diese beiden Spalten
-- (SUPABASE_REIHENFOLGE.md). Zweimal einspielen aendert nichts.
-- ===========================================================================

update public.vorlage_eigene_beitraege set
  duration = '1:00',
  kapitel  = '[{"titel":"Einleitung","bei":0},{"titel":"Hauptteil","bei":15},{"titel":"Beispiel","bei":32},{"titel":"Fazit","bei":46}]'::jsonb
where schluessel = 'eigen-querformat';

-- Die schon angelegten Testbeitraege nachziehen - erkannt an der
-- Beschreibung, wie starter_inhalte() es tut. Nur Demo-Beitraege; echte
-- Konten werden nicht angefasst.
update public.posts b set
  duration = v.duration,
  kapitel  = v.kapitel
from public.vorlage_eigene_beitraege v
where b.demo
  and v.schluessel = 'eigen-querformat'
  and b.description = v.description;
