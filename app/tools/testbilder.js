// Erzeugt die Bilder fuer die Testinhalte und legt sie in Supabase ab.
//
//   node tools/testbilder.js
//
// Warum: die Testbeitraege aus SUPABASE_SCHEMA_7_testkonto.sql hatten kein
// Bild — im Feed stand nur ein grauer Platzhalter. Zum Pruefen der App
// braucht es aber etwas zu sehen: ein Hochformat, ein Querformat, ein Foto.
//
// Die Bilder entstehen hier im Browser (dieselbe Technik wie die Pruefbilder)
// und werden in den Eimer "media" hochgeladen. Danach traegt das Skript die
// Adressen in die Beitraege ein — bei jedem Konto, das den Testbestand hat.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('playwright-core');

const ROOT = path.join(__dirname, '..');
const UMGEBUNG = fs.existsSync(path.join(ROOT, '.env.local'))
  ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  : '';
const wert = (n) => (UMGEBUNG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';

const ADRESSE = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const SCHLUESSEL = process.env.SUPABASE_SECRET_KEY || '';

if (!SCHLUESSEL) {
  console.error('SUPABASE_SECRET_KEY fehlt. Hochladen in einen fremden Ordner darf nur der geheime Schluessel.');
  process.exit(1);
}

/*
 * Die Bilder. Jedes traegt seinen Zweck als Aufschrift — wer im Simulator ein
 * Bild sieht, soll auf einen Blick wissen, welchen Testfall er vor sich hat.
 */
const BILDER = [
  { name: 'test-foto.png',       breite: 1080, hoehe: 1080, titel: 'Test-Foto',              unter: 'Beitrag im Feed', farben: ['#2E6BE6', '#7C46EE'] },
  { name: 'test-hochformat.png', breite: 1080, hoehe: 1920, titel: 'Test-Video',             unter: 'Hochformat · 9:16', farben: ['#E0457A', '#EE5F2A'] },
  { name: 'test-querformat.png', breite: 1920, hoehe: 1080, titel: 'Test-Video',             unter: 'Querformat · 16:9', farben: ['#12907F', '#419A32'] },
  { name: 'test-360.png',        breite: 1920, hoehe: 1080, titel: 'Test-Rundumvideo',       unter: '360° · Querformat', farben: ['#D88F1C', '#E04570'] },
  { name: 'test-live.png',       breite: 1920, hoehe: 1080, titel: 'Test-Livestream',        unter: 'Live · 128 sehen zu', farben: ['#7C46EE', '#1791BA'] },
  { name: 'test-story.png',      breite: 1080, hoehe: 1920, titel: 'Test-Story',             unter: 'Antippen, halten, weiterwischen', farben: ['#2E6BE6', '#E0457A'] },
];

const seiteHtml = (b) => `
  <style>
    html,body{margin:0;height:100%}
    body{display:flex;align-items:center;justify-content:center;
      background:linear-gradient(150deg, ${b.farben[0]} 0%, ${b.farben[1]} 100%);
      font-family:-apple-system,'Segoe UI',Roboto,sans-serif;color:#fff;text-align:center}
    .k{padding:0 6%}
    .t{font-size:${Math.round(b.breite / 14)}px;font-weight:700;letter-spacing:-.02em;line-height:1.05}
    .u{margin-top:${Math.round(b.breite / 45)}px;font-size:${Math.round(b.breite / 32)}px;opacity:.88}
    .m{margin-top:${Math.round(b.breite / 18)}px;font-size:${Math.round(b.breite / 48)}px;opacity:.6}
  </style>
  <div class="k">
    <div class="t">${b.titel}</div>
    <div class="u">${b.unter}</div>
    <div class="m">All Media · Beispielinhalt · ${b.breite} × ${b.hoehe}</div>
  </div>`;

async function main() {
  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'am-bilder-'));

  for (const b of BILDER) {
    const seite = await browser.newPage({ viewport: { width: b.breite / 2, height: b.hoehe / 2 }, deviceScaleFactor: 2 });
    await seite.setContent(seiteHtml(b));
    const datei = path.join(ordner, b.name);
    fs.writeFileSync(datei, await seite.screenshot({ type: 'png' }));
    await seite.close();

    const antwort = await fetch(`${ADRESSE}/storage/v1/object/media/beispiel/${b.name}`, {
      method: 'POST',
      headers: {
        apikey: SCHLUESSEL,
        Authorization: `Bearer ${SCHLUESSEL}`,
        'Content-Type': 'image/png',
        'x-upsert': 'true',
        'cache-control': 'max-age=31536000',
      },
      body: fs.readFileSync(datei),
    });
    console.log(`  ${b.name.padEnd(22)} ${antwort.ok ? 'hochgeladen' : 'FEHLER ' + (await antwort.text())}`);
  }

  await browser.close();
  fs.rmSync(ordner, { recursive: true, force: true });
  console.log(`\nAdressen: ${ADRESSE}/storage/v1/object/public/media/beispiel/<name>`);
}

main().catch((e) => { console.error(e); process.exit(1); });
