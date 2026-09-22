/**
 * Halten App und Website denselben Stand?
 *
 * Das ist die Prüfung, um die es bei dem ganzen Umbau ging. Beide Fassungen
 * lesen jetzt aus derselben Datenbank, aber sie tun es mit zwei verschiedenen
 * Stücken Code:
 *
 *   Website:  web/server/supabase-api.js  (Node, CommonJS)
 *   App:      app/lib/daten.ts            (TypeScript, läuft in Expo)
 *
 * Zwei Umsetzungen derselben Abfragen können auseinander laufen — genau das
 * ist vorher mit den Beispieldaten passiert, nur unbemerkt. Dieser Prüflauf
 * holt beide Seiten für dasselbe Konto und vergleicht sie Feld für Feld.
 *
 * Start:  node test/_gleichstand.js
 * Voraussetzung: der Webserver läuft (npm start im Ordner web).
 */

const { chromium } = require('playwright-core');
const { zusammengelegt } = require('./_modulquelle');
const { anmelden, MAIL, PASS, beenden, schliesse } = require('./_konto');

const BASIS = process.env.AM_URL || 'http://localhost:3000';

let fehler = 0;
const pruefe = (n, b, z = '') => {
  if (!b) fehler++;
  console.log((b ? 'PASS  ' : 'FAIL  ') + n + (z ? '  — ' + z : ''));
};

/** Vergleicht zwei Listen anhand eines Schlüssels und ausgewählter Felder. */
function vergleicheListen(name, ausWeb, ausApp, schluessel, felder) {
  const webIds = (ausWeb || []).map((e) => e[schluessel]).sort();
  const appIds = (ausApp || []).map((e) => e[schluessel]).sort();

  pruefe(
    `${name}: gleiche Anzahl`,
    webIds.length === appIds.length,
    `Website ${webIds.length}, App ${appIds.length}`
  );

  const fehlend = webIds.filter((id) => !appIds.includes(id));
  const zuviel = appIds.filter((id) => !webIds.includes(id));
  pruefe(
    `${name}: dieselben Einträge`,
    fehlend.length === 0 && zuviel.length === 0,
    fehlend.length || zuviel.length
      ? `nur Website: ${fehlend.slice(0, 3).join(', ')} | nur App: ${zuviel.slice(0, 3).join(', ')}`
      : ''
  );

  // Feld für Feld am ersten gemeinsamen Eintrag.
  const webNach = new Map((ausWeb || []).map((e) => [e[schluessel], e]));
  const appNach = new Map((ausApp || []).map((e) => [e[schluessel], e]));
  const gemeinsam = webIds.filter((id) => appNach.has(id));

  const abweichungen = [];
  for (const id of gemeinsam) {
    const w = webNach.get(id);
    const a = appNach.get(id);
    for (const [webFeld, appFeld] of felder) {
      const wv = JSON.stringify(w[webFeld] ?? null);
      const av = JSON.stringify(a[appFeld] ?? null);
      if (wv !== av) abweichungen.push(`${id}.${webFeld}: Website ${wv} ≠ App ${av}`);
    }
  }
  pruefe(
    `${name}: gleiche Werte`,
    abweichungen.length === 0,
    abweichungen.slice(0, 2).join(' | ')
  );
}

(async () => {
  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  /*
   * `bypassCSP` — seit der Sicherheitspruefung vom 04.09.2026 noetig.
   *
   * Die Website liefert jetzt eine Content-Security-Policy aus, und die
   * erlaubt Skripte nur aus /public sowie von zwei namentlich genannten
   * Quellen. Dieser Prueflauf laedt aber Quelltext aus aktionen.ts ueber eine
   * `blob:`-Adresse in die Seite — genau das verbietet die Regel, und zwar
   * zu Recht: `blob:` im Skript-Verzeichnis ist einer der ueblichen Wege,
   * ueber die aus einem XSS ein ausgefuehrtes Skript wird.
   *
   * Die Regel deswegen aufzuweichen waere der falsche Tausch — dann waere die
   * Luecke in der echten Seite offen, damit ein Prueflauf laeuft. Stattdessen
   * schaltet nur dieser Browser die Durchsetzung ab. Ob die Regel im Betrieb
   * stimmt, prueft `_ansehen.js`/`smoke.js` weiterhin gegen die echte Seite:
   * dort faellt ein CSP-Fehler als Konsolenfehler auf.
   */
  const seite = await browser.newPage({ viewport: { width: 400, height: 860 }, bypassCSP: true });

  await seite.goto(BASIS, { waitUntil: 'load' });
  const an = await anmelden(seite);
  if (!an.ok) {
    console.error(`FEHLER  Prüfkonto ${MAIL} konnte sich nicht anmelden: ${an.fehler}`);
    await beenden(browser, 1);
  }

  // --- Seite 1: was die Website liefert -----------------------------------
  const web = await seite.evaluate(() => fetch('/api/bootstrap').then((r) => r.json()));
  pruefe('Website liefert Daten aus Supabase', web.quelle === 'supabase', String(web.quelle));
  pruefe('Website ist angemeldet', web.angemeldet === true);

  /*
   * --- Seite 2: was die App liefert ---------------------------------------
   *
   * app/lib/daten.ts ist TypeScript und läuft sonst in Expo. Hier wird es
   * übersetzt und im Browser ausgeführt — gegen dieselbe Datenbank, mit
   * demselben Zugangstoken. Damit wird wirklich der Code der App geprüft und
   * nicht eine Nachbildung davon.
   *
   * Ein Bündler ist dafür nicht nötig. Bis zum 04.09.2026 galt: daten.ts
   * importiert nur Typen, und die verschwinden beim Übersetzen. Seit der
   * Sicherheitsprüfung kommt `signiereMedien` aus ./medien dazu — ein echter
   * Wert. Ein blob-Modul kann einen relativen Pfad nicht auflösen, deshalb
   * legt `zusammengelegt()` beide Dateien zu einer ohne Importe zusammen.
   */
  const os = require('os');
  const fs = require('fs');
  const path = require('path');
  const { execFileSync } = require('child_process');

  const bauOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'all-media-gleichstand-'));
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
      path.join(__dirname, '..', 'lib', 'daten.ts'),
      '--ignoreConfig', '--target', 'es2020', '--module', 'es2020',
      '--skipLibCheck', '--outDir', bauOrdner,
    ],
    { stdio: 'pipe' }
  );

  // Mit medien.js verschmelzen — sonst scheitert der Import im blob-Modul.
  const uebersetzt = zusammengelegt(bauOrdner, 'daten.js');
  fs.rmSync(bauOrdner, { recursive: true, force: true });

  /*
   * Das try/catch ist nicht schmückendes Beiwerk.
   *
   * Am 06.09.2026 fiel dieser Lauf einmal aus, und die Meldung lautete
   * vollständig: `page.evaluate: Object`. Supabase wirft im Fehlerfall kein
   * Error-Objekt, sondern ein schlichtes `{ message, code, details, hint }`.
   * Playwright kann so etwas nicht über die Browsergrenze tragen und macht
   * daraus "Object" — Ursache weg. Deshalb wird der Fehler hier im Browser
   * gefangen und in ein Feld gelegt, das die Grenze übersteht.
   */
  const antwort = await seite.evaluate(async (quelltext) => {
    try {
      // Als Modul laden, damit `export` gilt.
      const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
      const modul = await import(url);
      URL.revokeObjectURL(url);

      const client = await window.Anmeldung.aufbauen();
      const ich = window.Anmeldung.nutzer().id;
      return { daten: await modul.ladeAlles(client, ich) };
    } catch (f) {
      return {
        fehler: {
          art: Object.prototype.toString.call(f),
          message: (f && f.message) || String(f),
          code: f && f.code,
          details: f && f.details,
          hint: f && f.hint,
          stack: f && f.stack ? String(f.stack).split('\n').slice(0, 4).join(' | ') : '',
        },
      };
    }
  }, uebersetzt);

  if (antwort.fehler) {
    const f = antwort.fehler;
    console.error(
      `\nFEHLER  Die App konnte nicht laden.\n` +
        `        Art:      ${f.art}\n` +
        `        Meldung:  ${f.message}\n` +
        (f.code ? `        Code:     ${f.code}\n` : '') +
        (f.details ? `        Details:  ${f.details}\n` : '') +
        (f.hint ? `        Hinweis:  ${f.hint}\n` : '') +
        (f.stack ? `        Spur:     ${f.stack}\n` : '')
    );
    await beenden(browser, 1);
  }
  const app = antwort.daten;

  pruefe('App hat Daten geladen', Boolean(app && app.geladen));

  // --- Der Vergleich ------------------------------------------------------
  console.log('\nMenschen:');
  vergleicheListen(
    'Profile',
    Object.values(web.users || {}),
    Object.values(app.users || {}),
    'id',
    [['name', 'name'], ['handle', 'handle'], ['status', 'status'], ['about', 'about']]
  );
  vergleicheListen('Kontakte', web.contacts, app.contacts, 'id', [
    ['name', 'name'],
    ['status', 'status'],
  ]);

  console.log('\nChats:');
  vergleicheListen('Chats', web.chats, app.chats, 'id', [
    ['name', 'name'],
    ['isGroup', 'isGroup'],
    ['preview', 'preview'],
    ['time', 'time'],
  ]);
  vergleicheListen('Community-Chats', web.communityChats, app.communityChats, 'id', [
    ['name', 'name'],
  ]);

  /*
   * Die REIHENFOLGE der Beiträge — nicht nur, welche es sind.
   *
   * `vergleicheListen` sortiert die Kennungen, bevor es sie vergleicht.
   * Das ist für Kontakte und Communitys richtig, für den Feed aber genau
   * die Stelle, an der ein Unterschied unsichtbar bleibt: seit dem
   * 21.09.2026 entscheidet ein Algorithmus, was oben steht (Schema 51 und
   * gemeinsam/rang.js). Laufen App und Website dabei auseinander, sehen
   * beide Feeds trotzdem plausibel aus — es fällt niemandem auf.
   *
   * Beide Seiten müssen dieselbe Datei benutzen, also muss dasselbe
   * herauskommen. Kommt es das nicht, rechnet eine von beiden selbst.
   */
  console.log('\nReihenfolge des Feeds:');
  for (const [name, w, a] of [
    ['Beiträge', web.posts, app.posts],
    ['Hochformat', web.videos, app.videos],
    ['Querformat', web.clips, app.clips],
  ]) {
    const webFolge = (w || []).map((e) => e.id);
    const appFolge = (a || []).map((e) => e.id);
    if (webFolge.length === 0) {
      console.log(`  ----  ${name}: nichts da, nichts zu vergleichen`);
      continue;
    }
    const ersteAbweichung = webFolge.findIndex((id, i) => appFolge[i] !== id);
    pruefe(
      `${name}: App und Website in derselben Reihenfolge`,
      ersteAbweichung === -1,
      ersteAbweichung === -1
        ? `${webFolge.length} Einträge`
        : `ab Platz ${ersteAbweichung + 1}: Website ${webFolge[ersteAbweichung]}, ` +
          `App ${appFolge[ersteAbweichung]}`
    );
  }

  console.log('\nInhalte:');
  vergleicheListen('Beiträge', web.posts, app.posts, 'id', [
    ['description', 'description'],
    ['location', 'location'],
    ['music', 'music'],
    ['likes', 'likes'],
    ['comments', 'comments'],
    ['liked', 'liked'],
    ['saved', 'saved'],
  ]);
  vergleicheListen('Hochformat', web.videos, app.videos, 'id', [
    ['description', 'description'],
    ['likes', 'likes'],
    ['shares', 'shares'],
  ]);
  vergleicheListen('Querformat', web.clips, app.clips, 'id', [
    ['title', 'title'],
    ['duration', 'duration'],
    ['views', 'views'],
    ['art', 'art'],
  ]);
  vergleicheListen('Storys', web.stories, app.stories, 'id', [
    ['name', 'name'],
    ['viewed', 'viewed'],
    ['caption', 'caption'],
  ]);

  console.log('\nCommunitys und Suche:');
  vergleicheListen('Communitys', web.communities, app.communities, 'id', [
    ['name', 'name'],
    ['topic', 'topic'],
    ['members', 'members'],
    ['joined', 'joined'],
    ['eigen', 'eigen'],
  ]);
  vergleicheListen('Hashtags', web.hashtags, app.hashtags, 'tag', [['posts', 'posts']]);
  vergleicheListen('Sounds', web.sounds, app.sounds, 'id', [
    ['title', 'title'],
    ['artist', 'artist'],
    ['uses', 'uses'],
    ['lyrics', 'lyrics'],
  ]);
  vergleicheListen('Standorte', web.places, app.places, 'id', [
    ['name', 'name'],
    ['ort', 'ort'],
    ['adresse', 'adresse'],
  ]);
  vergleicheListen('Kartenpunkte', web.friends, app.friendPins, 'id', [
    ['place', 'place'],
    ['x', 'x'],
    ['y', 'y'],
  ]);

  console.log('\nEigener Zustand:');
  const webGefolgt = Object.entries(web.gefolgt || {})
    .filter(([, ja]) => ja)
    .map(([id]) => id)
    .sort();
  pruefe(
    'Wem ich folge',
    JSON.stringify(webGefolgt) === JSON.stringify([...(app.gefolgt || [])].sort()),
    `Website ${webGefolgt.length}, App ${(app.gefolgt || []).length}`
  );
  pruefe(
    'Blockierte',
    JSON.stringify([...(web.blockiert || [])].sort()) ===
      JSON.stringify([...(app.blockiert || [])].sort())
  );
  pruefe(
    'Stummgeschaltete',
    JSON.stringify([...(web.stummgeschaltet || [])].sort()) ===
      JSON.stringify([...(app.stummgeschaltet || [])].sort())
  );
  pruefe(
    'Eigenes Profil: Bio',
    (web.eigenesProfil?.bio ?? '') === (app.eigenesProfil?.bio ?? ''),
    `"${web.eigenesProfil?.bio}" / "${app.eigenesProfil?.bio}"`
  );
  pruefe(
    'Eigenes Profil: Highlights',
    JSON.stringify(web.eigenesProfil?.highlights ?? []) === JSON.stringify(app.highlights ?? [])
  );

  await schliesse(browser);
  console.log(
    fehler === 0
      ? '\nApp und Website zeigen denselben Stand.'
      : `\n${fehler} Abweichungen zwischen App und Website.`
  );
  process.exit(fehler ? 1 : 0);
})();
