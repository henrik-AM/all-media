#!/usr/bin/env node
/**
 * Holt das offizielle Songbild über die iTunes-Suche von Apple.
 *
 * Kasten 7.4 (Feedback 21.09.2026): „offizielles Songbild". Die iTunes
 * Search API ist kostenlos und braucht keinen Schlüssel
 * (https://performance-partners.apple.com/search-api). Apple erlaubt das
 * Bild nur mit Verweis auf den Song bei Apple; deshalb schreibt das Werkzeug
 * neben cover_url auch cover_quelle = 'apple' und cover_link, und App und
 * Website zeigen darunter „Cover: Apple Music ↗" (Schema 67).
 *
 * Übernommen wird nur ein genauer Treffer: Titel UND Interpret gleich
 * (ohne Groß-/Kleinschreibung). Erst ohne Zusätze in Klammern, wenn es
 * keinen genauen gibt - und nie eine andere Fassung (Instrumental, Remix,
 * Live …). Ein ähnlich klingender Song mit fremdem Bild wäre schlimmer als
 * gar keins. Die erfundenen Test-Sounds finden deshalb nichts und behalten
 * ihr selbst gerechnetes Bild (web/tools/testsounds.py).
 *
 * Ausgabe sind SQL-Anweisungen auf stdout, Fehlschläge als Kommentar:
 *
 *     node web/tools/cover-holen.mjs "Titel" "Interpret" ["Titel" "Interpret" …] > /tmp/cover.sql
 *
 * und dann einspielen wie jede Schema-Datei.
 */

const SUCHE = 'https://itunes.apple.com/search';

const glatt = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
// Zusätze wie „(Remastered)" oder „[Radio Edit]" weg - für den zweiten Durchgang.
const ohneZusatz = (s) => glatt(String(s || '').replace(/\s*[([].*?[)\]]\s*/g, ' '));
// Andere Fassung, anderes Stück: deren Bild gehört nicht zum Original.
const FASSUNG = /instrumental|karaoke|remix|live|cover|acoustic|sped|slowed|version/i;

const sql = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function suchen(titel, interpret) {
  const url = `${SUCHE}?${new URLSearchParams({
    term: `${titel} ${interpret}`,
    media: 'music',
    entity: 'song',
    country: 'DE',
    limit: '25',
  })}`;
  const antwort = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!antwort.ok) throw new Error(`iTunes-Suche antwortet ${antwort.status}`);
  const { results = [] } = await antwort.json();
  const vomInterpret = results.filter((r) => r.artworkUrl100 && glatt(r.artistName) === glatt(interpret));
  return (
    vomInterpret.find((r) => glatt(r.trackName) === glatt(titel)) ||
    vomInterpret.find((r) => ohneZusatz(r.trackName) === ohneZusatz(titel) && !FASSUNG.test(r.trackName))
  );
}

async function main() {
  const paare = process.argv.slice(2);
  if (!paare.length || paare.length % 2) {
    console.error('Aufruf: node web/tools/cover-holen.mjs "Titel" "Interpret" […]');
    process.exit(1);
  }
  for (let i = 0; i < paare.length; i += 2) {
    const [titel, interpret] = paare.slice(i, i + 2);
    const treffer = await suchen(titel, interpret);
    if (!treffer) {
      console.log(`-- kein genauer Treffer: ${titel} – ${interpret}`);
      continue;
    }
    // 100×100 ist die kleinste Stufe; dieselbe Adresse gibt es in 600×600.
    const bild = treffer.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.');
    console.log(
      `update public.sounds set cover_url = ${sql(bild)}, cover_quelle = 'apple', cover_link = ${sql(treffer.trackViewUrl)}` +
        ` where title = ${sql(titel)} and artist = ${sql(interpret)};`
    );
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
