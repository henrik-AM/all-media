-- ===========================================================================
-- All Media — Schema 6: die Inhalte
-- ===========================================================================
--
-- ERZEUGT, NICHT VON HAND GESCHRIEBEN.
-- Quelle: web/server/app.js, Stand 2026-08-31.
-- Erzeuger: scratchpad/baue-inhalte-sql.mjs
--
-- Bis hierher standen diese Inhalte als Beispieldaten im Quelltext — einmal
-- im Webserver, einmal in app/mocks/index.ts. Zwei Bestände, die auseinander
-- liefen. Ab jetzt stehen sie an einer Stelle: hier, in der Datenbank. Website
-- und App lesen beide von dort und können deshalb gar nicht mehr abweichen.
--
-- Setzt SUPABASE_SCHEMA.sql bis SUPABASE_SCHEMA_5.sql voraus.
-- Gefahrlos mehrfach ausführbar: alle Kennungen sind fest, alles läuft über
-- "on conflict do update".
-- ===========================================================================

begin;


-- --------------------------------------------------------- Beispielprofile
-- Anna, Bob, Clara und die anderen. Sie brauchen einen Eintrag in auth.users,
-- weil profiles.id dorthin zeigt. Ein Passwort haben sie nicht — als Anna
-- anmelden kann sich niemand.
insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000001', 'authenticated', 'authenticated',
   'anna@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000002', 'authenticated', 'authenticated',
   'bob@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000003', 'authenticated', 'authenticated',
   'clara@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000004', 'authenticated', 'authenticated',
   'david@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000005', 'authenticated', 'authenticated',
   'elif@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000006', 'authenticated', 'authenticated',
   'finn@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000007', 'authenticated', 'authenticated',
   'greta@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000008', 'authenticated', 'authenticated',
   'hakan@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb),
  ('00000000-0000-0000-0000-000000000000', '11111111-a11e-4d1a-8000-000000000009', 'authenticated', 'authenticated',
   'ida@beispiel.all-media.app', now(), now(), now(),
   '{"provider":"beispiel","providers":["beispiel"]}'::jsonb, '{"beispiel":true}'::jsonb)
on conflict (id) do nothing;

insert into public.profiles (id, name, handle, initials, color, phone, privat, about,
                             bio, link, highlights, playlists, status, demo,
                             followers_basis, following_basis, beitraege_basis)
values
  ('11111111-a11e-4d1a-8000-000000000001', 'Anna Schmidt', '@anna', 'AS', 'linear-gradient(135deg,#FCA2BC,#E04570)',
   '+49 151 2345678', false, 'Verfügbar',
   'Bergsteigerin und Fotografin. Immer auf der Suche nach dem ersten Licht.', 'anna-schmidt.de', array['Alpen', 'Ausrüstung', 'Touren']::text[], '{}',
   'offline', true, 12400, 312, 148),
  ('11111111-a11e-4d1a-8000-000000000002', 'Bob Müller', '@bob', 'BM', 'linear-gradient(135deg,#75DCF2,#1791BA)',
   '+49 152 3456789', true, 'Im Meeting',
   'Entwickler. Schreibt über Expo, Navigation und Performance.', 'bobmueller.dev', array['Talks', 'Setup']::text[], '{}',
   'offline', true, 2140, 189, 63),
  ('11111111-a11e-4d1a-8000-000000000003', 'Clara Weber', '@clara', 'CW', 'linear-gradient(135deg,#FBD277,#D88F1C)',
   '+49 160 4567890', false, 'Anfrage gesendet',
   'Hafen, Hamburg, Hochformat.', 'clara.photo', array['Hafen', 'Nebel', 'Nacht']::text[], '{}',
   'offline', true, 8730, 640, 421),
  ('11111111-a11e-4d1a-8000-000000000004', 'David König', '@david', 'DK', 'linear-gradient(135deg,#9FDD84,#419A32)',
   '+49 171 5678901', false, 'Beschäftigt',
   'Produktdesign und Design Systeme. Kaffee als Grundnahrungsmittel.', 'davidkoenig.design', array['Tokens', 'Prozess']::text[], '{}',
   'offline', true, 5310, 274, 97),
  ('11111111-a11e-4d1a-8000-000000000005', 'Elif Yilmaz', '@elif', 'EY', 'linear-gradient(135deg,#FFB877,#EE5F2A)',
   '+49 172 6789012', true, 'Hey, ich nutze All Media!',
   'Kochen ohne Schnickschnack. Rezepte unter zehn Minuten.', 'elif-kocht.de', array['Pasta', 'Meal Prep', 'Basics']::text[], '{}',
   'offline', true, 31200, 128, 289),
  ('11111111-a11e-4d1a-8000-000000000006', 'Finn Bauer', '@finn', 'FB', 'linear-gradient(135deg,#93AEFF,#4152D8)',
   '+49 173 7890123', false, 'Nur dringende Anrufe',
   'Schreibt Software und läuft danach zwanzig Kilometer.', 'finnbauer.io', array['Laufen']::text[], '{}',
   'offline', true, 1180, 402, 54),
  ('11111111-a11e-4d1a-8000-000000000007', 'Greta Hoffmann', '@greta', 'GH', 'linear-gradient(135deg,#FBA0C4,#DC3F7C)',
   '+49 174 8901234', true, '',
   '', '', '{}', '{}',
   'offline', true, 0, 0, 0),
  ('11111111-a11e-4d1a-8000-000000000008', 'Hakan Demir', '@hakan', 'HD', 'linear-gradient(135deg,#6FE2D0,#12907F)',
   '+49 175 9012345', false, '',
   '', '', '{}', '{}',
   'offline', true, 0, 0, 0),
  ('11111111-a11e-4d1a-8000-000000000009', 'Ida Nowak', '@ida', 'IN', 'linear-gradient(135deg,#C4A4F7,#7C46EE)',
   '+49 176 0123456', false, '',
   '', '', '{}', '{}',
   'offline', true, 0, 0, 0)
on conflict (id) do update set
  name = excluded.name, handle = excluded.handle, initials = excluded.initials,
  color = excluded.color, phone = excluded.phone, privat = excluded.privat,
  about = excluded.about, bio = excluded.bio, link = excluded.link,
  highlights = excluded.highlights, playlists = excluded.playlists, demo = true,
  followers_basis = excluded.followers_basis, following_basis = excluded.following_basis,
  beitraege_basis = excluded.beitraege_basis;


-- ----------------------------------------------------------------- Beiträge
-- Ein Video ist ein Beitrag mit kind = 'reel' (Hochformat) oder 'clip'
-- (Querformat). "format" trennt davon unabhängig die Knöpfe der Filterleiste
-- im Querformat: Standard, 360°, Live.
insert into public.posts (id, user_id, kind, format, title, description, location, music,
                          duration, tags, views, zuschauer, untertitel, kapitel,
                          likes_basis, shares_basis, comments_basis, created_at, demo)
values
  ('22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000003', 'post', 'standard',
   '', 'Der Hafen um sechs Uhr morgens. Ganz ohne Menschen.', 'Hamburg', 'Golden Hour – Lys',
   '', array['#hafen', '#nachtfotografie']::text[], 0, null,
   false, '[]'::jsonb,
   342, 0, 24, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000005', 'post', 'standard',
   '', 'Neues Setup steht. Zwei Monitore waren doch die richtige Entscheidung.', 'Köln', 'Originalton',
   '', array['#homeoffice', '#designsystem']::text[], 0, null,
   false, '[]'::jsonb,
   128, 0, 12, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000001', 'post', 'standard',
   '', 'Oben angekommen. Der Aufstieg war jede Minute wert.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '', array['#sonnenaufgang']::text[], 0, null,
   false, '[]'::jsonb,
   1204, 0, 95, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000006', 'post', 'standard',
   '', 'Kleine Commits, klare Historie. Mein Team dankt es mir.', 'Berlin', 'Lo-Fi Focus – beatlab',
   '', array['#reactnative']::text[], 0, null,
   false, '[]'::jsonb,
   87, 0, 8, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000001', 'reel', 'standard',
   '', 'Sonnenaufgang über den Alpen. Vier Uhr aufstehen hat sich gelohnt.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '', array['#sonnenaufgang']::text[], 0, null,
   false, '[]'::jsonb,
   12400, 96, 216, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000004', 'reel', 'standard',
   '', 'So richtet ihr euer Home-Office in 60 Sekunden ein.', 'Köln', 'Lo-Fi Focus – beatlab',
   '', array['#homeoffice', '#designsystem']::text[], 0, null,
   false, '[]'::jsonb,
   8210, 61, 142, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000005', 'reel', 'standard',
   '', 'Rezept: Pasta in 10 Minuten, ohne Sahne und trotzdem cremig.', 'Hamburg', 'Kitchen Groove – Milo',
   '', array['#mealprep']::text[], 0, null,
   false, '[]'::jsonb,
   24800, 340, 510, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000008', '11111111-a11e-4d1a-8000-000000000002', 'reel', 'standard',
   '', 'Erster Laufversuch mit der neuen Kamera-Stabilisierung.', 'Rheinpark', 'Runner High – Aster',
   '', array['#laufen']::text[], 0, null,
   false, '[]'::jsonb,
   3140, 22, 74, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000009', '11111111-a11e-4d1a-8000-000000000006', 'reel', 'standard',
   '', 'Warum kleine Commits dein Leben leichter machen.', 'Berlin', 'Originalton',
   '', array['#reactnative']::text[], 0, null,
   false, '[]'::jsonb,
   5670, 118, 188, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000001', 'clip', '360',
   'Zugspitze bei Sonnenaufgang – die ganze Tour', 'Die ganze Tour von der Hütte bis zum Gipfel, ungeschnitten. Kapitel in der Beschreibung.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '18:42', array['#sonnenaufgang']::text[], 128400, null,
   true, '[{"bei":0,"titel":"Aufbruch an der Hütte"},{"bei":240,"titel":"Über das Blockfeld"},{"bei":620,"titel":"Der Grat"},{"bei":900,"titel":"Sonnenaufgang am Gipfel"}]'::jsonb,
   8420, 0, 211, now() - interval '2880 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000004', 'clip', 'standard',
   'Design Tokens sauber aufsetzen', 'Von der ersten Farbvariable bis zum fertigen Theme — Schritt für Schritt mitgebaut.', 'Köln', 'Lo-Fi Focus – beatlab',
   '24:10', array['#designsystem']::text[], 41200, null,
   true, '[{"bei":0,"titel":"Warum Tokens"},{"bei":180,"titel":"Die erste Farbvariable"},{"bei":600,"titel":"Hell und Dunkel"},{"bei":1100,"titel":"Übergabe an den Code"}]'::jsonb,
   3110, 0, 94, now() - interval '7200 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000005', 'clip', 'standard',
   'Meal Prep für eine ganze Woche', 'Fünf Gerichte, eine Stunde Arbeit, eine ganze Woche satt. Einkaufszettel unten.', 'Hamburg', 'Kitchen Groove – Milo',
   '11:07', array['#mealprep']::text[], 302900, null,
   true, '[{"bei":0,"titel":"Einkaufszettel"},{"bei":120,"titel":"Vorbereiten"},{"bei":400,"titel":"Kochen"},{"bei":580,"titel":"Abfüllen"}]'::jsonb,
   24800, 0, 609, now() - interval '10080 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000013', '11111111-a11e-4d1a-8000-000000000002', 'clip', 'live',
   'Expo SDK 57 live erklärt – Fragen willkommen', 'Was sich mit Expo SDK 57 ändert und worauf man beim Umstieg achten muss.', 'Köln', 'Originalton',
   'LIVE', array['#reactnative']::text[], 18700, 1240,
   false, '[]'::jsonb,
   1240, 0, 57, now() - interval '0 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000014', '11111111-a11e-4d1a-8000-000000000003', 'clip', 'standard',
   'Nachtfotografie am Hafen', 'Blaue Stunde am Hafen: Einstellungen, Stativ, Nachbearbeitung.', 'Hamburg', 'Golden Hour – Lys',
   '15:31', array['#hafen', '#nachtfotografie']::text[], 87300, null,
   true, '[]'::jsonb,
   6180, 0, 141, now() - interval '20160 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000015', '11111111-a11e-4d1a-8000-000000000006', 'clip', 'standard',
   'Kleine Commits, klare Historie', 'Warum kleine Commits das Review leichter machen — mit Beispielen aus echten Projekten.', 'Berlin', 'Originalton',
   '07:44', array['#reactnative']::text[], 22100, null,
   true, '[]'::jsonb,
   1870, 0, 73, now() - interval '30240 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000016', '11111111-a11e-4d1a-8000-000000000003', 'clip', '360',
   'Hamburger Hafen in 360° – einmal um die Elbphilharmonie', 'Rundumblick vom Wasser aus. Zum Umsehen ziehen oder das Handy drehen.', 'Hamburg', 'Harbour Drift – Lys',
   '12:20', array['#hafen', '#360']::text[], 64500, null,
   false, '[]'::jsonb,
   4820, 0, 118, now() - interval '5760 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000017', '11111111-a11e-4d1a-8000-000000000005', 'clip', 'live',
   'Sonntagsküche live – wir kochen zusammen', 'Zwei Gerichte, eine Pfanne, alle Fragen im Chat.', 'Hamburg', 'Originalton',
   'LIVE', array['#mealprep']::text[], 9400, 412,
   false, '[]'::jsonb,
   730, 0, 205, now() - interval '0 minutes', true),
  ('22222222-a11e-4d1a-8000-000000000018', '11111111-a11e-4d1a-8000-000000000001', 'clip', '360',
   'Gipfelpanorama Alpen – 360° Rundflug', 'Einmal über die Gipfelkette, aufgenommen mit einer 360°-Kamera an der Drohne.', 'Zugspitze', 'Ambient Sunrise – Nora K.',
   '08:05', array['#sonnenaufgang', '#360']::text[], 51200, null,
   false, '[]'::jsonb,
   3940, 0, 87, now() - interval '10080 minutes', true)
on conflict (id) do update set
  kind = excluded.kind, format = excluded.format, title = excluded.title,
  description = excluded.description, location = excluded.location, music = excluded.music,
  duration = excluded.duration, tags = excluded.tags, views = excluded.views,
  zuschauer = excluded.zuschauer, untertitel = excluded.untertitel, kapitel = excluded.kapitel,
  likes_basis = excluded.likes_basis, shares_basis = excluded.shares_basis,
  comments_basis = excluded.comments_basis, demo = true;


-- --------------------------------------------------------------- Kommentare
insert into public.comments (id, post_id, user_id, text, created_at)
values
  ('88888888-a11e-4d1a-8000-000000000001', '22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000001',
   'Das Licht ist der Wahnsinn. Welche Blende?', now() - interval '648 minutes'),
  ('88888888-a11e-4d1a-8000-000000000002', '22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000003',
   'f/8, Stativ und zehn Sekunden Belichtung.', now() - interval '640 minutes'),
  ('88888888-a11e-4d1a-8000-000000000003', '22222222-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000004',
   'Da will ich auch mal hin.', now() - interval '598 minutes'),
  ('88888888-a11e-4d1a-8000-000000000004', '22222222-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000002',
   'Welche Monitore sind das?', now() - interval '1740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000005', '22222222-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000005',
   'Zwei 27 Zoll, nichts Besonderes, aber gleiche Höhe ist wichtig.', now() - interval '1740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000006', '22222222-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000006',
   'Respekt für den Aufstieg!', now() - interval '9040 minutes'),
  ('88888888-a11e-4d1a-8000-000000000007', '22222222-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000001',
   'Kann ich nur unterschreiben.', now() - interval '3280 minutes'),
  ('88888888-a11e-4d1a-8000-000000000008', '22222222-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000004',
   'Wie früh musstest du los?', now() - interval '740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000009', '22222222-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000001',
   'Vier Uhr ab Parkplatz, dann zwei Stunden hoch.', now() - interval '725 minutes'),
  ('88888888-a11e-4d1a-8000-000000000010', '22222222-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000006',
   'Kurz und hilfreich, danke.', now() - interval '1740 minutes'),
  ('88888888-a11e-4d1a-8000-000000000011', '22222222-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000002',
   'Ohne Sahne cremig? Verrate das Geheimnis.', now() - interval '9040 minutes'),
  ('88888888-a11e-4d1a-8000-000000000012', '22222222-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000005',
   'Nudelwasser. Immer Nudelwasser.', now() - interval '9040 minutes'),
  ('88888888-a11e-4d1a-8000-000000000013', '22222222-a11e-4d1a-8000-000000000009', '11111111-a11e-4d1a-8000-000000000003',
   'Mache ich seit einem Jahr, will nicht mehr zurück.', now() - interval '4720 minutes'),
  ('88888888-a11e-4d1a-8000-000000000014', '22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000002',
   'Die Kapitelmarken sind Gold wert.', now() - interval '2880 minutes'),
  ('88888888-a11e-4d1a-8000-000000000015', '22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000005',
   'Wie lange wart ihr insgesamt unterwegs?', now() - interval '2880 minutes'),
  ('88888888-a11e-4d1a-8000-000000000016', '22222222-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000001',
   'Neun Stunden mit Pausen.', now() - interval '1440 minutes'),
  ('88888888-a11e-4d1a-8000-000000000017', '22222222-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000006',
   'Endlich mal ohne Framework-Geplänkel erklärt.', now() - interval '5760 minutes'),
  ('88888888-a11e-4d1a-8000-000000000018', '22222222-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000003',
   'Teil zwei zu Dark Mode wäre super.', now() - interval '4320 minutes'),
  ('88888888-a11e-4d1a-8000-000000000019', '22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000001',
   'Der Einkaufszettel spart mir jede Woche eine Stunde.', now() - interval '8640 minutes'),
  ('88888888-a11e-4d1a-8000-000000000020', '22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000004',
   'Hält das wirklich fünf Tage frisch?', now() - interval '7200 minutes'),
  ('88888888-a11e-4d1a-8000-000000000021', '22222222-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000005',
   'Vier sicher, am fünften würde ich einfrieren.', now() - interval '7200 minutes'),
  ('88888888-a11e-4d1a-8000-000000000022', '22222222-a11e-4d1a-8000-000000000013', '11111111-a11e-4d1a-8000-000000000004',
   'Der Hinweis zum Umstieg hat mir zwei Stunden gespart.', now() - interval '8640 minutes'),
  ('88888888-a11e-4d1a-8000-000000000023', '22222222-a11e-4d1a-8000-000000000014', '11111111-a11e-4d1a-8000-000000000006',
   'Blaue Stunde ist einfach unschlagbar.', now() - interval '20160 minutes'),
  ('88888888-a11e-4d1a-8000-000000000024', '22222222-a11e-4d1a-8000-000000000014', '11111111-a11e-4d1a-8000-000000000002',
   'Welches Stativ nutzt du?', now() - interval '17280 minutes'),
  ('88888888-a11e-4d1a-8000-000000000025', '22222222-a11e-4d1a-8000-000000000015', '11111111-a11e-4d1a-8000-000000000005',
   'Mein Team hat es nach dem Video übernommen.', now() - interval '30240 minutes')
on conflict (id) do update set text = excluded.text;


-- -------------------------------------------------------------------- Storys
-- Beispielstorys laufen nicht ab: die Regel zeigt nur Storys mit
-- expires_at > now(). Mit den üblichen 24 Stunden wäre die Story-Leiste am
-- Tag nach dem Einspielen leer.
insert into public.stories (id, user_id, media_url, media_type, caption, created_at, expires_at)
values
  ('33333333-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000001', null, 'image', 'Erstes Licht auf 2500 Metern',
   now() - interval '90 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000002', null, 'image', 'Neuer Build läuft durch',
   now() - interval '180 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000003', null, 'image', 'Hafen im Nebel',
   now() - interval '270 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000004', null, 'image', 'Schreibtisch neu sortiert',
   now() - interval '360 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000005', null, 'image', 'Pasta in zehn Minuten',
   now() - interval '450 minutes', now() + interval '10 years'),
  ('33333333-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000006', null, 'image', '20 Kilometer geschafft',
   now() - interval '540 minutes', now() + interval '10 years')
on conflict (id) do update set
  caption = excluded.caption, expires_at = excluded.expires_at;


-- -------------------------------------------------------------------- Sounds
-- lyrics ist strophenweise: eine leere Zeile trennt zwei Strophen.
-- Instrumentalstücke haben null, keinen Ersatztext.
insert into public.sounds (id, title, artist, uses, dauer, lyrics)
values
  ('66666666-a11e-4d1a-8000-000000000001', 'Golden Hour', 'Lys', 12400, '3:46', array['And the light comes slow over the water', 'nobody up but the gulls and me', '', 'Cranes in the mist like a paper drawing', 'the harbour holds its breath', '', 'Golden hour, golden hour', 'stay a little longer now', 'Golden hour, golden hour', 'nothing here needs fixing']::text[]),
  ('66666666-a11e-4d1a-8000-000000000002', 'Lo-Fi Focus', 'beatlab', 8210, '2:58', null),
  ('66666666-a11e-4d1a-8000-000000000003', 'Kitchen Groove', 'Milo', 24800, '3:12', array['Ten minutes and the table is set', 'onions going soft in the pan', '', 'Nobody taught me, I just kept going', 'burnt a lot of Sundays learning how', '', 'Kitchen groove, kitchen groove', 'dinner is an easy thing']::text[]),
  ('66666666-a11e-4d1a-8000-000000000004', 'Runner High', 'Aster', 3140, '4:05', array['One more mile, one more morning', 'the city still asleep behind me', '', 'Legs remember what the head forgets', 'keep the rhythm, keep the rhythm', '', 'Runner high, runner high', 'nothing hurts until I stop']::text[]),
  ('66666666-a11e-4d1a-8000-000000000005', 'Ambient Sunrise', 'Nora K.', 5670, '5:21', null)
on conflict (id) do update set
  title = excluded.title, artist = excluded.artist, uses = excluded.uses,
  dauer = excluded.dauer, lyrics = excluded.lyrics;


-- ----------------------------------------------------------------- Standorte
insert into public.places (id, name, ort, adresse, koordinaten, x, y, beitraege_basis)
values
  ('77777777-a11e-4d1a-8000-000000000001', 'Hamburger Hafen', 'Hamburg', 'Am Sandtorkai, 20457 Hamburg, Deutschland',
   '53.5413° N, 9.9891° O', 44, 28, 8730),
  ('77777777-a11e-4d1a-8000-000000000002', 'Zugspitze', 'Zugspitze', 'Zugspitzplatt, 82475 Garmisch-Partenkirchen, Deutschland',
   '47.4211° N, 10.9853° O', 52, 78, 12400),
  ('77777777-a11e-4d1a-8000-000000000003', 'Rheinpark Köln', 'Rheinpark', 'Sachsenbergstraße, 50679 Köln, Deutschland',
   '50.9494° N, 6.9722° O', 30, 52, 3140),
  ('77777777-a11e-4d1a-8000-000000000004', 'Berlin Mitte', 'Berlin', 'Unter den Linden, 10117 Berlin, Deutschland',
   '52.5170° N, 13.3889° O', 70, 34, 22100),
  ('77777777-a11e-4d1a-8000-000000000005', 'Alster', 'Hamburg', 'An der Alster, 20099 Hamburg, Deutschland',
   '53.5586° N, 10.0011° O', 46, 25, 5310)
on conflict (id) do update set
  name = excluded.name, ort = excluded.ort, adresse = excluded.adresse,
  koordinaten = excluded.koordinaten, x = excluded.x, y = excluded.y,
  beitraege_basis = excluded.beitraege_basis;


-- ------------------------------------------------------------------ Hashtags
insert into public.hashtags (tag, beitraege_basis)
values
  ('#sonnenaufgang', 128400),
  ('#designsystem', 41200),
  ('#mealprep', 302900),
  ('#reactnative', 18700),
  ('#hafen', 87300),
  ('#laufen', 220100),
  ('#homeoffice', 64800),
  ('#nachtfotografie', 39100)
on conflict (tag) do update set beitraege_basis = excluded.beitraege_basis;


-- ------------------------------------------------------------- Freundeskarte
insert into public.friend_pins (user_id, x, y, place, updated_at)
values
  ('11111111-a11e-4d1a-8000-000000000001', 24, 30, 'Zugspitze', now() - interval '5 minutes'),
  ('11111111-a11e-4d1a-8000-000000000002', 62, 22, 'Köln Innenstadt', now() - interval '12 minutes'),
  ('11111111-a11e-4d1a-8000-000000000003', 45, 55, 'Hamburger Hafen', now() - interval '60 minutes'),
  ('11111111-a11e-4d1a-8000-000000000004', 76, 63, 'Köln Ehrenfeld', now() - interval '120 minutes'),
  ('11111111-a11e-4d1a-8000-000000000005', 18, 72, 'Zuhause', now() - interval '0 minutes'),
  ('11111111-a11e-4d1a-8000-000000000006', 58, 82, 'Rheinpark', now() - interval '20 minutes')
on conflict (user_id) do update set
  x = excluded.x, y = excluded.y, place = excluded.place, updated_at = excluded.updated_at;


-- ------------------------------------------------------ Öffentliche Gruppen
-- Diese Communitys gehören allen: eine Welt, die jeder Angemeldete sieht.
-- Die privaten („Team Intern", „Laufgruppe Köln") bekommt jeder Nutzer als
-- eigene angelegt — siehe die Vorlagen weiter unten.
insert into public.communities (id, name, topic, bio, link, visibility, created_by,
                                mitglieder_basis, demo)
values
  ('44444444-a11e-4d1a-8000-000000000001', 'Design Systeme', 'Komponenten, Tokens, Figma', 'Alles rund um Komponenten, Tokens und den Weg von Figma in den Code. Fragen jederzeit willkommen.', 'designsysteme.de',
   'public', '11111111-a11e-4d1a-8000-000000000001', 1284, true),
  ('44444444-a11e-4d1a-8000-000000000002', 'React Native DE', 'Expo, Navigation, Performance', 'Deutschsprachige Runde zu React Native und Expo. Von der ersten App bis zum Store-Release.', 'rn-de.dev',
   'public', '11111111-a11e-4d1a-8000-000000000002', 842, true),
  ('44444444-a11e-4d1a-8000-000000000003', 'Fotografie', 'Licht, Komposition, Nachbearbeitung', 'Licht, Komposition, Nachbearbeitung. Jeden Sonntag ein gemeinsames Thema.', 'lichtundschatten.foto',
   'public', '11111111-a11e-4d1a-8000-000000000003', 3120, true),
  ('44444444-a11e-4d1a-8000-000000000004', 'Musikproduktion', 'Ableton, Mixing, Sounddesign', 'Ableton, Mixing, Sounddesign. Feedback-Runden am Monatsende.', 'musikproduktion.club',
   'public', '11111111-a11e-4d1a-8000-000000000004', 671, true)
on conflict (id) do update set
  name = excluded.name, topic = excluded.topic, bio = excluded.bio, link = excluded.link,
  visibility = excluded.visibility, mitglieder_basis = excluded.mitglieder_basis, demo = true;


-- ------------------------------------------------- Kanäle dieser Communitys
-- Aufbau: Community -> Kanal -> Thema.
insert into public.community_channels (id, community_id, slug, name, topics, position)
values
  ('55555555-a11e-4d1a-8000-000000000001', '44444444-a11e-4d1a-8000-000000000001', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000002', '44444444-a11e-4d1a-8000-000000000001', 'ch-tokens', 'Design Tokens', array['Struktur', 'Best Practices']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000003', '44444444-a11e-4d1a-8000-000000000001', 'ch-figma', 'Figma', array['Plugins', 'Workflows']::text[], 2),
  ('55555555-a11e-4d1a-8000-000000000004', '44444444-a11e-4d1a-8000-000000000002', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000005', '44444444-a11e-4d1a-8000-000000000002', 'ch-expo', 'Expo', array['SDK Updates', 'Debugging']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000006', '44444444-a11e-4d1a-8000-000000000002', 'ch-navigation', 'Navigation', array['React Navigation', 'Router']::text[], 2),
  ('55555555-a11e-4d1a-8000-000000000007', '44444444-a11e-4d1a-8000-000000000003', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000008', '44444444-a11e-4d1a-8000-000000000003', 'ch-licht', 'Licht & Belichtung', array['Goldene Stunde', 'ISO']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000009', '44444444-a11e-4d1a-8000-000000000003', 'ch-nachbearbeitung', 'Nachbearbeitung', array['Lightroom', 'Capture One']::text[], 2),
  ('55555555-a11e-4d1a-8000-000000000010', '44444444-a11e-4d1a-8000-000000000004', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('55555555-a11e-4d1a-8000-000000000011', '44444444-a11e-4d1a-8000-000000000004', 'ch-ableton', 'Ableton Live', array['Devices', 'Workflow']::text[], 1),
  ('55555555-a11e-4d1a-8000-000000000012', '44444444-a11e-4d1a-8000-000000000004', 'ch-mixing', 'Mixing & Mastering', array['Techniken', 'Feedback']::text[], 2)
on conflict (id) do update set
  name = excluded.name, topics = excluded.topics, position = excluded.position;

-- Verlauf in den Kanälen. Beim erneuten Einspielen zuerst leeren,
-- sonst stünde jede Nachricht doppelt da.
delete from public.community_channel_messages
 where channel_id in (select id from public.community_channels
                       where community_id in (select id from public.communities where demo and visibility = 'public'));

insert into public.community_channel_messages (channel_id, sender_id, text, created_at)
values
  ('55555555-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000001', 'Hat jemand Erfahrung mit Design Tokens in Figma Variables?', now() - interval '528 minutes'),
  ('55555555-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000004', 'Ja, wir nutzen das seit einem halben Jahr produktiv', now() - interval '520 minutes'),
  ('55555555-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000004', 'Zwei Modi in einer Collection, das reicht meistens', now() - interval '509 minutes'),
  ('55555555-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000003', 'Welches Plugin nutzt ihr zum Exportieren?', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000001', 'Wir gehen inzwischen ohne Plugin über die API', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000004', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000002', 'Expo SDK 57 läuft bei mir stabil', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000005', 'Bei mir auch, nur der Metro Cache zickt manchmal', now() - interval '1740 minutes'),
  ('55555555-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000006', 'Router oder React Navigation für neue Projekte?', now() - interval '9040 minutes'),
  ('55555555-a11e-4d1a-8000-000000000006', '11111111-a11e-4d1a-8000-000000000002', 'Router, wenn du sowieso auf Expo setzt', now() - interval '9040 minutes'),
  ('55555555-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000008', '11111111-a11e-4d1a-8000-000000000003', 'Goldene Stunde heute um 19:40', now() - interval '9040 minutes'),
  ('55555555-a11e-4d1a-8000-000000000009', '11111111-a11e-4d1a-8000-000000000005', 'Capture One für Farben, Lightroom für alles andere', now() - interval '4720 minutes'),
  ('55555555-a11e-4d1a-8000-000000000010', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', now() - interval '570 minutes'),
  ('55555555-a11e-4d1a-8000-000000000011', '11111111-a11e-4d1a-8000-000000000005', 'Neuer Track ist fertig gemischt', now() - interval '4720 minutes'),
  ('55555555-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000002', 'Wie laut mastert ihr für Streaming?', now() - interval '3280 minutes'),
  ('55555555-a11e-4d1a-8000-000000000012', '11111111-a11e-4d1a-8000-000000000005', '-14 LUFS integrated, dann macht keine Plattform Ärger', now() - interval '3280 minutes')
;


-- ===========================================================================
-- Vorlagen: was ein neu registrierter Nutzer vorfindet
-- ===========================================================================
--
-- Chats und Kontakte gehören einer Person, nicht allen. Sie werden deshalb
-- nicht hier angelegt, sondern für jedes neue Konto einzeln — aus diesen
-- Vorlagen, von public.starter_inhalte() aus SUPABASE_SCHEMA_5.sql.

delete from public.vorlage_kontakte;
insert into public.vorlage_kontakte (kontakt_id, status, position)
values
  ('11111111-a11e-4d1a-8000-000000000001', 'friend', 0),
  ('11111111-a11e-4d1a-8000-000000000002', 'friend', 1),
  ('11111111-a11e-4d1a-8000-000000000003', 'pending', 2),
  ('11111111-a11e-4d1a-8000-000000000004', 'friend', 3),
  ('11111111-a11e-4d1a-8000-000000000005', 'friend', 4),
  ('11111111-a11e-4d1a-8000-000000000006', 'friend', 5)
;

delete from public.vorlage_nachrichten;
delete from public.vorlage_chats;
insert into public.vorlage_chats (schluessel, name, is_group, bereich, mitglieder, position)
values
  ('c1', 'Anna Schmidt', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000001']::uuid[], 0),
  ('c2', 'Bob Müller', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000002']::uuid[], 1),
  ('c3', 'Clara Weber', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000003']::uuid[], 2),
  ('c4', 'Projekt Team', true, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000001', '11111111-a11e-4d1a-8000-000000000002', '11111111-a11e-4d1a-8000-000000000004']::uuid[], 3),
  ('c5', 'David König', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000004']::uuid[], 4),
  ('c6', 'Elif Yilmaz', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000005']::uuid[], 5),
  ('c7', 'Wochenend-Crew', true, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000003', '11111111-a11e-4d1a-8000-000000000005', '11111111-a11e-4d1a-8000-000000000006']::uuid[], 6),
  ('c8', 'Finn Bauer', false, 'messenger',
   array['11111111-a11e-4d1a-8000-000000000006']::uuid[], 7),
  ('cc1', 'Greta Hoffmann', false, 'community',
   array['11111111-a11e-4d1a-8000-000000000007']::uuid[], 8),
  ('cc2', 'Hakan Demir', false, 'community',
   array['11111111-a11e-4d1a-8000-000000000008']::uuid[], 9),
  ('cc3', 'Design-Runde', true, 'community',
   array['11111111-a11e-4d1a-8000-000000000007', '11111111-a11e-4d1a-8000-000000000008', '11111111-a11e-4d1a-8000-000000000009']::uuid[], 10),
  ('cc4', 'Ida Nowak', false, 'community',
   array['11111111-a11e-4d1a-8000-000000000009']::uuid[], 11)
;

-- sender_id null bedeutet: der Nutzer selbst hat das geschrieben.
insert into public.vorlage_nachrichten (chat, sender_id, text, minuten_zurueck)
values
  ('c1', '11111111-a11e-4d1a-8000-000000000001', 'Hey! Wie läuft das Projekt?', 243),
  ('c1', null, 'Läuft gut, bin fast fertig mit dem Design', 239),
  ('c1', '11111111-a11e-4d1a-8000-000000000001', 'Super, kannst du mir das nachher zeigen?', 223),
  ('c1', null, 'Klar, so gegen 17 Uhr?', 214),
  ('c1', '11111111-a11e-4d1a-8000-000000000001', 'Klingt gut, bis später!', 209),
  ('c2', '11111111-a11e-4d1a-8000-000000000002', 'Hast du die Unterlagen schon?', 323),
  ('c2', null, 'Noch nicht, kannst du sie schicken?', 307),
  ('c2', '11111111-a11e-4d1a-8000-000000000002', 'Schicke dir die Datei gerade', 296),
  ('c3', '11111111-a11e-4d1a-8000-000000000003', 'Schau mal, was ich gefunden habe', 382),
  ('c3', '11111111-a11e-4d1a-8000-000000000003', 'Foto', 373),
  ('c4', '11111111-a11e-4d1a-8000-000000000001', 'Sind alle für morgen bereit?', 1744),
  ('c4', '11111111-a11e-4d1a-8000-000000000002', 'Von meiner Seite ja', 1743),
  ('c4', null, 'Ich auch', 1742),
  ('c4', '11111111-a11e-4d1a-8000-000000000004', 'Meeting verschoben auf 15 Uhr', 1741),
  ('c5', null, 'Ich melde mich morgen bei dir', 1742),
  ('c5', '11111111-a11e-4d1a-8000-000000000004', 'Alles klar 👍', 1741),
  ('c6', '11111111-a11e-4d1a-8000-000000000005', 'Sprachnachricht', 9041),
  ('c7', '11111111-a11e-4d1a-8000-000000000003', 'Samstag Grillen?', 9042),
  ('c7', '11111111-a11e-4d1a-8000-000000000005', 'Wer ist dabei?', 9041),
  ('c8', null, 'Kein Problem!', 3282),
  ('c8', '11111111-a11e-4d1a-8000-000000000006', 'Danke dir!', 3281),
  ('cc1', '11111111-a11e-4d1a-8000-000000000007', 'Dein Reel vom Hafen ist stark!', 177),
  ('cc2', '11111111-a11e-4d1a-8000-000000000008', 'Schaust du mal in den Tokens-Kanal?', 321),
  ('cc2', null, 'Mache ich heute Abend', 309),
  ('cc3', '11111111-a11e-4d1a-8000-000000000008', 'Wann passt es euch diese Woche?', 1742),
  ('cc3', '11111111-a11e-4d1a-8000-000000000009', 'Donnerstag passt mir', 1741),
  ('cc4', '11111111-a11e-4d1a-8000-000000000009', 'Danke für den Tipp mit dem Stativ', 9041)
;

delete from public.vorlage_kanalnachrichten;
delete from public.vorlage_kanaele;
delete from public.vorlage_communities;
insert into public.vorlage_communities (schluessel, name, topic, bio, link, mitglieder_basis, position)
values
  ('k4', 'Team Intern', 'Nur für das Kernteam', 'Interner Kanal des Kernteams. Sprintplanung, Entscheidungen, alles Kurzfristige.', '', 12, 0),
  ('k5', 'Laufgruppe Köln', 'Treffpunkte und Termine', 'Wir laufen dienstags und samstags. Treffpunkte und Termine stehen hier.', 'laufgruppe-koeln.de', 96, 1)
;

insert into public.vorlage_kanaele (community, slug, name, topics, position)
values
  ('k4', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('k4', 'ch-sprint', 'Sprint Planning', array['Backlog', 'Reviews']::text[], 1),
  ('k5', 'ch-allgemein', 'Allgemein', array['Diskussionen', 'News']::text[], 0),
  ('k5', 'ch-termine', 'Termine', array['Diese Woche', 'Nächste Woche']::text[], 1)
;

insert into public.vorlage_kanalnachrichten (community, slug, sender_id, text, minuten_zurueck)
values
  ('k4', 'ch-allgemein', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', 571),
  ('k4', 'ch-sprint', '11111111-a11e-4d1a-8000-000000000001', 'Sprint-Planung morgen um 10 Uhr', 420),
  ('k4', 'ch-sprint', null, 'Bin dabei', 416),
  ('k5', 'ch-allgemein', '11111111-a11e-4d1a-8000-000000000004', 'Willkommen allen Neuen hier!', 571),
  ('k5', 'ch-termine', '11111111-a11e-4d1a-8000-000000000006', 'Samstag 8 Uhr am Rheinpark?', 3282),
  ('k5', 'ch-termine', '11111111-a11e-4d1a-8000-000000000004', 'Passt, ich bringe Wasser mit', 3281)
;

delete from public.vorlage_mitteilungen;
insert into public.vorlage_mitteilungen (bereich, art, actor_id, target_type, target_id,
                                         target_name, minuten_zurueck, gelesen)
values
  ('videos', 'like', '11111111-a11e-4d1a-8000-000000000001', 'post',
   '22222222-a11e-4d1a-8000-000000000001', null, 10, false),
  ('videos', 'follow', '11111111-a11e-4d1a-8000-000000000005', 'profile',
   '11111111-a11e-4d1a-8000-000000000005', null, 95, false),
  ('videos', 'comment', '11111111-a11e-4d1a-8000-000000000003', 'post',
   '22222222-a11e-4d1a-8000-000000000002', null, 260, false),
  ('videos', 'repost', '11111111-a11e-4d1a-8000-000000000004', 'video',
   '22222222-a11e-4d1a-8000-000000000005', null, 1500, true),
  ('videos', 'mention', '11111111-a11e-4d1a-8000-000000000002', 'profile',
   '11111111-a11e-4d1a-8000-000000000002', null, 7200, true),
  ('videos', 'story', '11111111-a11e-4d1a-8000-000000000006', 'profile',
   '11111111-a11e-4d1a-8000-000000000006', null, 11000, true),
  ('videos', 'like', '11111111-a11e-4d1a-8000-000000000003', 'video',
   '22222222-a11e-4d1a-8000-000000000006', null, 30000, true),
  ('videos', 'follow', '11111111-a11e-4d1a-8000-000000000007', 'profile',
   '11111111-a11e-4d1a-8000-000000000007', null, 46000, true),
  ('communities', 'kanal', '11111111-a11e-4d1a-8000-000000000002', 'community',
   null, 'Design Systeme', 25, false),
  ('communities', 'beitritt', '11111111-a11e-4d1a-8000-000000000005', 'community',
   null, 'React Native DE', 180, false),
  ('communities', 'nachricht', '11111111-a11e-4d1a-8000-000000000001', 'community',
   null, 'Design Systeme', 1400, true),
  ('communities', 'einladung', '11111111-a11e-4d1a-8000-000000000004', 'community',
   null, 'Fotografie', 6000, true),
  ('communities', 'beitritt', '11111111-a11e-4d1a-8000-000000000006', 'community',
   null, 'Team Intern', 20000, true)
;


-- ===========================================================================
-- Bestehende Konten nachziehen
-- ===========================================================================
-- Wer sich vor dem Einspielen registriert hat, hat noch keine Startinhalte.
-- Diese Schleife holt das nach. Für neue Konten erledigt es der Trigger aus
-- SUPABASE_SCHEMA_5.sql.
do $$
declare p record;
begin
  for p in select id from public.profiles where not demo loop
    perform public.starter_inhalte(p.id);
  end loop;
end $$;

commit;
