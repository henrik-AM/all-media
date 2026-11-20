# Paket 9 – Gegenprüfung (Runde 1)

Repo: ~/allmedia-wt/paket9, Zweig claude/paket9-funktionen. Basis 595ca92 (origin/main), Prüfcommit HEAD.
Nur lesen, nichts ändern, keine Live-Datenbank-Schreibzugriffe, keine Prüfläufe gegen Supabase.

## Auftrag
Paket 9 = AF3 „Gefällt mir nicht" unter Videos (privat, Ausschluss mit Like, senkt Feed-Rang),
AF4 gemischte Karussells (beliebig viele Bilder/Videos ordnen/entfernen, Feed/Profil/Vollbild wischbar, Medienregeln je Medium),
AF5 Reels bis 20 Minuten (Grenze in gemeinsam/, App+Website gleich, Sprungleiste, Upload mit Fortschritt und Abbruch; Dauer aus den Bytes am Server),
AF6 Instants für Enge Freunde (private Liste, Kamera, nur Liste sieht es, DB-durchgesetzt, Mitteilung, Blockieren/Minderjährige),
AF7 Konto-Analysen (Reichweite 7/30 Tage, Aufrufe, Follower/Nicht-Follower, Vorwahlland ab 10 Konten, nur echte Messwerte, nur eigenes Konto),
Spendenstand „vorgemerkt, nicht bezahlt". Portiert aus Sammelzweig feedback-ohne-supabase (Entwürfe 108–113) auf den heutigen main/Bunny-Stand.
Schemas 129–133 sind bereits LIVE eingespielt (129 negativ, 130 analysen, 131 instants, 132 videobeleg, 133 karussell).

## Prüfe besonders
- Rechte/RLS/Definer-Funktionen in SUPABASE_SCHEMA_129–133 gegen den Live-Stand 115–128 (Orakel, fehlende beitrag_lesbar/Block-Prüfung, EXECUTE an PUBLIC, zurückgedrehte Regeln aus 122/125/128).
- web/server/medien.js, videopruefung.js, instants.js: Upload-/Löschwege, Bunny vs. Supabase, Abbruch, Dienstschlüssel.
- App (app/lib/beitragSpeichern.ts, supabaseStorage.ts, components/UploadAnzeige.tsx, SheetRahmen.tsx) und Website (web/public/app.js) gleichwertig.
- Datenlecks in Analysen/Instants, Karussell-Fremdmedien, Video ohne Beleg.

## Belege (eigene Abnahme)
Proben verworfen 129:20/20, 130:16/16, 131:22/22, 132:19/19, 133:10/10. test:rechte 322/322, test:angriffe 60/60, test:minderjaehrig 41 OK, test:schema grün.
Live zwei Konten app/test/paket9-live.js 39/39; Website-Bilder paket9-bilder.js 21/21; App im Simulator (Bilder in app/test/ergebnisse-paket9/).

## Antwortformat
Je Befund: Schwere (hoch/mittel/niedrig), Datei:Zeile, Begründung, Vorschlag. Nur echte Befunde.
