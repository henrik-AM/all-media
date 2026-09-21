-- ===========================================================================
--  Die eigenen Beiträge waren die letzten ohne echtes Medium
-- ===========================================================================
--
--  BEFUND (20.09.2026)
--
--  Schema 43 hat den 18 Beiträgen der Demoprofile echte Medien gegeben. Übrig
--  blieben die 40 Starterbeiträge — die, die `starter_inhalte()` jedem Konto
--  anlegt und die nur dessen Besitzer sieht. Gezählt:
--
--      beispiel/test-foto.png         8 Beiträge   kind = post
--      beispiel/test-hochformat.png   8 Beiträge   kind = reel   ← Video!
--      beispiel/test-querformat.png   8 Beiträge   kind = clip   ← Video!
--      beispiel/test-360.png          8 Beiträge   kind = clip   ← Video!
--      beispiel/test-live.png         8 Beiträge   kind = clip   ← Video!
--      beispiel/test-story.png        8 Storys
--
--  **32 der 40 sind als Video deklariert und zeigen auf eine PNG-Datei.** Der
--  Abspieler bekommt nichts zum Abspielen; im Raster steht die Verlaufsfläche
--  aus `testbilder.js` mit dem Wort „Test-Video" darauf. Genau das hat Henrik
--  als „einfarbige Screens" gemeldet — nur eben auf dem eigenen Profil, wo
--  Schema 43 nicht hingesehen hat.
--
--  DAS WAR SCHON EINMAL REPARIERT
--
--  `SUPABASE_SCHEMA_8_medien.sql` enthält ab Zeile 249 exakt diese Zuordnung
--  und hat sie damals auch gesetzt. Sie ist wieder verschwunden, weil
--  `SUPABASE_SCHEMA_7_testkonto.sql` die Tabelle `vorlage_eigene_beitraege`
--  ebenfalls befüllt — mit den Platzhaltern — und am 18.09.2026 vollständig
--  neu eingespielt wurde.
--
--  Das ist derselbe Fehler wie bei `"Medien lesen"`, `starter_inhalte()` und
--  `finde_per_nummer()`, nur eine Ebene tiefer: **nicht eine Regel wurde
--  zurückgedreht, sondern ein Datenbestand.**
--
--  WARUM DAS NIEMAND GEMERKT HAT
--
--  `test:schema` prüft `SUPABASE_REIHENFOLGE.md` gegen die Schemadateien —
--  aber nur für Funktionen und Regeln. Eine Tabelle, die in zwei Dateien
--  unterschiedlich **befüllt** wird, ist für diese Prüfung unsichtbar.
--  `vorlage_eigene_beitraege` stand deshalb in keiner der 37 Zeilen.
--
--  Gegenmaßnahme in zwei Teilen:
--    1. Diese Datei ist ab jetzt die gewinnende Quelle der Zuordnung; sie
--       steht mit dieser Rolle in SUPABASE_REIHENFOLGE.md.
--    2. `app/test/_datenbank.js` prüft neu: kein Beitrag der Art `clip` oder
--       `reel` darf auf eine Bilddatei zeigen. Diese Prüfung schlägt an,
--       egal welche Schemadatei den Rückschritt verursacht hat.
--
--  DIE ZUORDNUNG
--
--  Gewählt wird nach Format, nicht nach Bequemlichkeit: der 360-Beitrag
--  bekommt den Clip, den auch ein Demoprofil als 360 zeigt, der Livebeitrag
--  den Live-Clip. Die 14 echten Videos sind je einmal bei einem Demoprofil
--  vergeben; eine Doppelnutzung ist unvermeidlich und unschädlich, weil es
--  verschiedene Beiträge verschiedener Konten sind.
--
--  Adressform wie überall: die öffentliche `…/object/public/media/…`. Sie ist
--  der Schlüssel, nicht der Zugang — `signiereMedien()` tauscht sie vor der
--  Auslieferung gegen eine unterschriebene Adresse.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_45_starter_medien.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  1. Die Vorlagen — damit jedes künftig angelegte Konto es richtig bekommt
-- ---------------------------------------------------------------------------

update public.vorlage_eigene_beitraege set
  media_url =
    'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/'
    || case schluessel
         when 'eigen-foto'       then 'foto-test.jpg'
         when 'eigen-hochformat' then 'reel-05.mp4'
         when 'eigen-querformat' then 'clip-09.mp4'
         when 'eigen-360'        then 'clip-05.mp4'
         when 'eigen-live'       then 'clip-03.mp4'
       end,
  thumbnail_url =
    'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/'
    || case schluessel
         when 'eigen-foto'       then 'foto-test.jpg'
         when 'eigen-hochformat' then 'reel-05.jpg'
         when 'eigen-querformat' then 'clip-09.jpg'
         when 'eigen-360'        then 'clip-05.jpg'
         when 'eigen-live'       then 'clip-03.jpg'
       end
where schluessel in
  ('eigen-foto', 'eigen-hochformat', 'eigen-querformat', 'eigen-360', 'eigen-live');

update public.vorlage_eigene_storys set
  media_url =
    'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/story-test.jpg'
where media_url like '%test-story.png';


-- ---------------------------------------------------------------------------
--  2. Die Beiträge, die es schon gibt
--
--  Getroffen wird über die Platzhalteradresse selbst, nicht über Kennung oder
--  Konto: damit erwischt es genau die Zeilen, die den Rückschritt abbekommen
--  haben, und keine einzige andere. Ein zweiter Lauf ändert nichts mehr.
-- ---------------------------------------------------------------------------

update public.posts p set
  media_url     = v.media_url,
  thumbnail_url = v.thumbnail_url
from public.vorlage_eigene_beitraege v
where p.media_url like '%/beispiel/test-' || split_part(v.schluessel, '-', 2) || '.png'
  and v.schluessel in
    ('eigen-foto', 'eigen-hochformat', 'eigen-querformat', 'eigen-360', 'eigen-live');

update public.stories s set
  media_url = v.media_url
from public.vorlage_eigene_storys v
where s.media_url like '%/beispiel/test-story.png';


-- ---------------------------------------------------------------------------
--  3. Gegenprobe — bricht ab, wenn etwas übrig bleibt
--
--  Ohne diesen Block meldet die Verwaltungs-API auch dann Erfolg, wenn die
--  UPDATEs null Zeilen getroffen haben. Genau diese stille Form hat uns beim
--  verbotenen DELETE und beim Lesehaken schon zweimal getäuscht.
-- ---------------------------------------------------------------------------

do $$
declare
  v_png   integer;
  v_video integer;
begin
  select count(*) into v_png
  from public.posts where media_url like '%/beispiel/test-%.png';

  select count(*) into v_video
  from public.posts
  where kind in ('clip', 'reel')
    and media_url ~* '\.(png|jpe?g|webp|gif)$';

  if v_png > 0 then
    raise exception 'Noch % Beitraege auf einem Platzhalter-PNG', v_png;
  end if;

  if v_video > 0 then
    raise exception 'Noch % Videobeitraege zeigen auf eine Bilddatei', v_video;
  end if;

  raise notice 'Alle Starterbeitraege zeigen auf ein echtes Medium.';
end $$;
