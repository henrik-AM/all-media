// Prueft die Video-Suche aus Henriks Rueckmeldung vom 26.08.2026:
//
//   Punkt 33  Zurueck-Pfeil auf den Uebersichtsseiten
//   Punkt 34  "Nach Klick auf einen Unterpunkt buggt die ganze App"
//   Punkt 35  Profile, Hashtags, Standorte und Sounds fuehren auf eine
//             eigene Seite
//
// Start:  node test/_suche.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen

  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {

    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    // Ohne diesen Schluss lebt das chrome-headless-shell weiter, haelt die
    // geerbte Ausgabe-Pipe offen und laesst den Gesamtlauf haengen (09.09.2026).
    await beenden(browser, 1);

  }

  await page.reload({ waitUntil: 'load' });

  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#topbar button');

  const ergebnisse = [];
  const pruefe = async (name, fn) => {
    try {
      await fn();
      ergebnisse.push(true);
      console.log('  OK   ' + name);
    } catch (e) {
      ergebnisse.push(false);
      console.log('  FEHL ' + name + ' — ' + (e.message || 'kein Treffer'));
    }
  };

  const zurSuche = async () => {
    await page.click('[data-area="videos"]');
    await page.click('[data-sub="search"]');
    await page.waitForSelector('#videoSearch');
  };

  await zurSuche();

  console.log('\nVideos — Suche');

  const KATEGORIEN = ['reels', 'clips', 'posts', 'profile', 'hashtags', 'standorte', 'sounds'];

  await pruefe('Jede der sieben Kategorien hat einen Pfeil zum Mehr anzeigen', async () => {
    const ziele = await page.$$eval('[data-explorer]', (n) => n.map((x) => x.dataset.explorer));
    const fehlend = KATEGORIEN.filter((k) => !ziele.includes(k));
    if (fehlend.length) throw new Error('ohne Pfeil: ' + fehlend.join(', '));
  });

  /*
   * Die Uebersicht hat sieben Reihen mit Vorschaubildern. Solange die
   * nachladen, wandert jede Reihe darunter nach unten — Playwright bricht den
   * Klick dann mit „element is not stable" ab. Im Einzellauf sind die Bilder
   * lange da, im vollen Durchgang vom 17.09.2026 traf es „posts", die dritte
   * Reihe von oben. Deshalb erst warten, bis die Zeile zweimal hintereinander
   * an derselben Stelle steht, und dann klicken.
   */
  const warteStabil = async (waehler) => {
    // Zuruecksetzen, sonst vergleicht der erste Durchgang mit der Zeile der
    // vorigen Kategorie und haelt einen Zufallstreffer fuer Ruhe.
    await page.evaluate(() => {
      window.__letzteHoehe = null;
    });
    await page
      .waitForFunction(
        (w) => {
          const el = document.querySelector(w);
          if (!el) return false;
          const jetzt = Math.round(el.getBoundingClientRect().top);
          const vorher = window.__letzteHoehe;
          window.__letzteHoehe = jetzt;
          return vorher === jetzt;
        },
        waehler,
        { timeout: 8000, polling: 200 }
      )
      .catch(() => {});
  };

  for (const kat of KATEGORIEN) {
    await pruefe(`„${kat}" oeffnet eine eigene Seite mit Zurueck-Pfeil`, async () => {
      await zurSuche();
      await warteStabil(`[data-explorer="${kat}"]`);
      await page.click(`[data-explorer="${kat}"]`);
      await page.waitForSelector('[data-explorer-back]', { timeout: 8000 }).catch(() => {});
      const zurueck = await page.$('[data-explorer-back]');
      if (!zurueck) throw new Error('kein Zurueck-Pfeil');
      await zurueck.click();
      await page.waitForSelector('#videoSearch', { timeout: 8000 }).catch(() => {});
      const wiederSuche = await page.$('#videoSearch');
      if (!wiederSuche) throw new Error('der Pfeil fuehrt nicht zurueck zur Suche');
    });
  }

  console.log('\nVideos — Suche, der gemeldete Bug');

  await pruefe('Ein Unterpunkt fuehrt aus der Uebersichtsseite heraus', async () => {
    await zurSuche();
    await page.click('[data-explorer="reels"]');
    await page.waitForTimeout(250);
    await page.click('[data-sub="landscape"]');
    await page.waitForTimeout(300);
    const pillen = await page.$('[data-clipfilter]');
    if (!pillen) throw new Error('das Querformat geht nicht auf — die Uebersichtsseite steht noch');
  });

  await pruefe('Ein Bereich fuehrt aus der Uebersichtsseite heraus', async () => {
    await zurSuche();
    await page.click('[data-explorer="sounds"]');
    await page.waitForTimeout(250);
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(300);
    const chats = await page.$('#chatSearch');
    if (!chats) throw new Error('der Messenger geht nicht auf — die Uebersichtsseite steht noch');
  });

  await pruefe('Danach ist die App wieder normal bedienbar', async () => {
    await page.click('[data-area="communities"]');
    await page.waitForTimeout(300);
    await page.click('[data-area="settings"]');
    await page.waitForTimeout(300);
    const aktiv = await page.$eval('.navbtn.is-active', (n) => n.dataset.area);
    if (aktiv !== 'settings') throw new Error('haengt bei „' + aktiv + '"');
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await beenden(browser, erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
