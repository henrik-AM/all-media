-- ===========================================================================
--  Die Beiträge, die jeder sieht, hatten als einzige kein Bild
-- ===========================================================================
--
--  BEFUND (18.09.2026)
--
--  Henrik meldete „einfarbige Screens": Profilkacheln ohne Bild, ein
--  geteiltes Video, das im Chat als graue Fläche ankommt. Die Ursache ist
--  nicht die Anzeige — `Motiv` zeichnet die Farbfläche genau dann, wenn kein
--  Bild da ist, und das war richtig.
--
--  Gezählt in der Datenbank:
--
--      Autor ist KEIN Demoprofil   40 Beiträge, alle 40 mit Bild
--      Autor IST ein Demoprofil    18 Beiträge, kein einziges mit Bild
--
--  Das ist genau verkehrt herum. Die 40 sind die Starterinhalte, die
--  `starter_inhalte()` jedem Konto anlegt — sichtbar ausschließlich für
--  dessen Besitzer. Die 18 sind die Beiträge von Anna, Bob, Clara, David,
--  Elif und Finn, also alles, was man von anderen Menschen zu sehen bekommt.
--
--  Alles mit Bild war privat. Alles Öffentliche war grau.
--
--  DIE MEDIEN GAB ES LÄNGST
--
--  `app/tools/testmedien.js` hat sie erzeugt und hochgeladen: neun Clips,
--  fünf Reels, jeweils mit einem echten Standbild aus dem Film selbst, dazu
--  Fotos zum Thema. Sie liegen seither in `media/beispiel` — 9 clip-*.mp4,
--  5 reel-*.mp4, foto-gipfel, foto-hafen, foto-homeoffice, foto-code.
--
--  Zugeordnet hat sie nie jemand. Die Beiträge zeigten stattdessen auf fünf
--  Platzhalter-PNGs aus dem Vorgängerwerkzeug `testbilder.js` — deshalb war
--  ein „Video" im Raster eine PNG-Datei, und der Abspielknopf lief ins Leere.
--
--  Die Zahlen passen exakt: neun Clips brauchen Bilder, neun Clips liegen
--  bereit. Fünf Reels, fünf Reels. Die Medien wurden für diese Beiträge
--  gebaut.
--
--  ADRESSFORM
--
--  Gespeichert wird die öffentliche Form
--  `…/storage/v1/object/public/media/…`, so wie bei allen vorhandenen Zeilen.
--  Ausgeliefert wird sie nie: `signiereMedien()` in app/lib/medien.ts und
--  web/server/medien.js erkennen genau dieses Stück und tauschen es gegen
--  eine unterschriebene Adresse. Die öffentliche Form ist der Schlüssel, nicht
--  der Zugang.
--
--  Einspielen:
--    SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs \
--      SUPABASE_SCHEMA_43_demo_medien.sql
-- ===========================================================================


-- ---------------------------------------------------------------------------
--  Die Zuordnung
--
--  Getroffen wird über Handle, Art und ein Stück des Titels — nicht über die
--  Kennung: die vergibt die Datenbank, und in einer frisch aufgesetzten
--  Instanz wäre sie eine andere. `ilike` mit einem kurzen, eindeutigen
--  Ausschnitt überlebt auch eine geänderte Beschreibung.
--
--  Fotos bekommen kein eigenes `thumbnail_url`: bei einem Bild IST das Bild
--  die Vorschau. Videos brauchen eins, sonst müsste das Raster eine .mp4
--  laden, um eine Kachel zu zeichnen.
-- ---------------------------------------------------------------------------

do $$
declare
  v_basis text := 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/';
  v_zeile record;
  v_zahl  int := 0;
begin
  for v_zeile in
    select * from (values
      -- handle,   art,     Titelausschnitt,            Datei ohne Endung, Video?
      ('@anna',  'post', 'Oben angekommen',            'foto-gipfel',     false),
      ('@clara', 'post', 'Hafen um sechs',             'foto-hafen',      false),
      ('@elif',  'post', 'Neues Setup steht',          'foto-homeoffice', false),
      ('@finn',  'post', 'Kleine Commits, klare',      'foto-code',       false),

      ('@anna',  'reel', 'Sonnenaufgang über den',     'reel-01',         true),
      ('@bob',   'reel', 'Kamera-Stabilisierung',      'reel-02',         true),
      ('@david', 'reel', 'Home-Office in 60',          'reel-03',         true),
      ('@elif',  'reel', 'Pasta in 10 Minuten',        'reel-04',         true),
      ('@finn',  'reel', 'kleine Commits dein Leben',  'reel-05',         true),

      ('@anna',  'clip', 'Gipfelpanorama',             'clip-01',         true),
      ('@anna',  'clip', 'Zugspitze bei Sonnenaufgang','clip-02',         true),
      ('@bob',   'clip', 'Expo SDK 57 live',           'clip-03',         true),
      ('@clara', 'clip', 'Nachtfotografie am Hafen',   'clip-04',         true),
      ('@clara', 'clip', 'Hamburger Hafen in 360',     'clip-05',         true),
      ('@david', 'clip', 'Design Tokens sauber',       'clip-06',         true),
      ('@elif',  'clip', 'Sonntagsküche live',         'clip-07',         true),
      ('@elif',  'clip', 'Meal Prep für eine ganze',   'clip-08',         true),
      ('@finn',  'clip', 'Kleine Commits, klare',      'clip-09',         true)
    ) as t(handle, art, stueck, datei, ist_video)
  loop
    update public.posts p
       set media_url = v_basis || v_zeile.datei || case when v_zeile.ist_video then '.mp4' else '.jpg' end,
           -- Bei einem Video das Standbild, bei einem Foto das Foto selbst.
           thumbnail_url = v_basis || v_zeile.datei || '.jpg'
      from public.profiles pr
     where pr.id = p.user_id
       and pr.demo
       and pr.handle = v_zeile.handle
       and p.kind    = v_zeile.art
       and coalesce(nullif(p.title, ''), p.description) ilike '%' || v_zeile.stueck || '%';

    get diagnostics v_zahl = row_count;
    if v_zahl = 0 then
      -- Nicht abbrechen: ein Beitrag, den es in dieser Instanz nicht gibt,
      -- ist kein Grund, die übrigen siebzehn stehen zu lassen.
      raise notice 'Kein Treffer: % / % / %', v_zeile.handle, v_zeile.art, v_zeile.stueck;
    end if;
  end loop;
end $$;


-- ---------------------------------------------------------------------------
--  Gegenprobe
--
--  Sie steht hier, damit das Einspielen selbst sagt, ob es gewirkt hat. Eine
--  Zahl, die man hinterher von Hand nachschlagen muss, schaut niemand nach.
-- ---------------------------------------------------------------------------

do $$
declare v_ohne int;
begin
  select count(*) into v_ohne
    from public.posts p
    join public.profiles pr on pr.id = p.user_id
   where pr.demo and p.media_url is null;

  raise notice 'Beitraege von Demoprofilen noch ohne Bild: %', v_ohne;
end $$;


-- ---------------------------------------------------------------------------
--  Dasselbe für die Storys
--
--  Gleiches Bild wie bei den Beiträgen: die acht Storys der Starterinhalte
--  hatten alle ein Foto, die sechs Storys der Demoprofile keines. Die
--  Story-Leiste oben im Messenger — der erste Bildschirm der App — bestand
--  damit aus sechs farbigen Kreisen ohne Inhalt.
--
--  Auch hier liegen die Fotos seit `testmedien.js` bereit, und auch hier
--  passt die Zahl genau: sechs Storys, sechs story-*.jpg, jedes zum Thema.
--
--  Das zählt doppelt, seit ein Herz auf eine Story im Chat die Vorschau
--  zeigt (Schema 41): ohne Bild wäre die Nachricht eine graue Fläche.
-- ---------------------------------------------------------------------------

do $$
declare
  v_basis text := 'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/public/media/beispiel/';
  v_zeile record;
begin
  for v_zeile in
    select * from (values
      ('@anna',  'Erstes Licht',      'story-berge'),
      ('@bob',   'Neuer Build',       'story-build'),
      ('@clara', 'Hafen im Nebel',    'story-hafen'),
      ('@david', 'Schreibtisch neu',  'story-schreibtisch'),
      ('@elif',  'Pasta in zehn',     'story-pasta'),
      ('@finn',  'Kilometer geschafft', 'story-laufen')
    ) as t(handle, stueck, datei)
  loop
    update public.stories s
       set media_url = v_basis || v_zeile.datei || '.jpg',
           media_type = 'image'
      from public.profiles pr
     where pr.id = s.user_id
       and pr.demo
       and pr.handle = v_zeile.handle
       and s.caption ilike '%' || v_zeile.stueck || '%';
  end loop;
end $$;

do $$
declare v_ohne int;
begin
  select count(*) into v_ohne
    from public.stories s
    join public.profiles pr on pr.id = s.user_id
   where pr.demo and s.media_url is null and s.expires_at > now();

  raise notice 'Storys von Demoprofilen noch ohne Bild: %', v_ohne;
end $$;
