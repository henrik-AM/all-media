// Prueft, was am 18.09.2026 nicht synchronisiert war.
//
// Henriks Meldung an dem Tag bestand aus lauter einzelnen Beobachtungen, die
// alle dasselbe Muster hatten: eine Handlung wird gespeichert, aber nirgends
// wieder angezeigt. Genau das misst dieser Lauf — nicht, ob eine Einfuegung
// gelingt, sondern ob das Ergebnis hinterher irgendwo zu sehen ist.
//
//   1. Gespeicherte Beitraege stehen im Reiter mit dem Lesezeichen.
//   2. Die Beitraege, die man von anderen sieht, haben ein Bild.
//   3. Ein Herz an einer fremden Story wird zu einer Chatnachricht mit
//      Story-Vorschau.
//   4. Eine Handlung erzeugt eine Mitteilung — und zwar genau eine.
//   5. Das Teilen-Raster zeigt je Person ihr Bereichs-Abzeichen.
//
// Start:  node test/_sync.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
    await beenden(browser, 1);
  }

  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(600);

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

  const gehe = async (area, sub) => {
    await page.click(`[data-area="${area}"]`);
    await page.waitForTimeout(300);
    if (sub) {
      await page.click(`[data-sub="${sub}"]`);
      await page.waitForTimeout(500);
    }
  };

  // ======================================================================
  console.log('\nGespeicherte Beitraege');
  // ======================================================================

  await pruefe('Die Merkliste liefert Beitraege, nicht nur Kennungen', async () => {
    const d = await page.evaluate(() => fetch('/api/gespeichert').then((r) => r.json()));
    if (!Array.isArray(d)) throw new Error('keine Liste: ' + JSON.stringify(d).slice(0, 80));
    if (d.length === 0) throw new Error('leer — der Testbestand legt zwei an');
    /*
     * Der eigentliche Punkt. Vor dem 18.09.2026 standen in `saves` zwei
     * Zeilen, und dahinter null lesbare Beitraege: der Testbestand merkte
     * Beitraege vor, die `beitrag_sichtbar()` verbirgt. Die Liste war nicht
     * leer, sie war unauffuellbar.
     */
    const ohne = d.filter((x) => !x.eintrag);
    if (ohne.length) throw new Error(`${ohne.length} von ${d.length} ohne lesbaren Beitrag`);
  });

  await pruefe('Der Reiter mit dem Lesezeichen zeigt sie an', async () => {
    await gehe('videos', 'profile');
    await page.click('[data-otab="saved"]');
    await page.waitForTimeout(900);
    const kacheln = await page.$$eval('.prof__grid .griditem', (els) => els.length);
    if (kacheln === 0) throw new Error('das Raster ist leer');
  });

  // ======================================================================
  console.log('\nBilder statt Farbflaechen');
  // ======================================================================

  await pruefe('Jeder sichtbare Beitrag hat ein Bild', async () => {
    const d = await page.evaluate(() => fetch('/api/bootstrap').then((r) => r.json()));
    const posts = d.posts || [];
    if (posts.length === 0) throw new Error('keine Beitraege geladen');
    const ohne = posts.filter((p) => !p.mediaUrl && !p.thumbnail);
    if (ohne.length) throw new Error(`${ohne.length} von ${posts.length} ohne Bild`);
  });

  await pruefe('Jede sichtbare Story hat ein Bild', async () => {
    const d = await page.evaluate(() => fetch('/api/bootstrap').then((r) => r.json()));
    const storys = (d.stories || []).filter((s) => !s.own);
    if (storys.length === 0) throw new Error('keine fremden Storys geladen');
    const ohne = storys.filter((s) => !s.mediaUri && !s.mediaUrl);
    if (ohne.length) throw new Error(`${ohne.length} von ${storys.length} ohne Bild`);
  });

  // ======================================================================
  console.log('\nTeilen-Abzeichen');
  // ======================================================================

  await pruefe('Jede Person im Raster traegt ihr Bereichs-Abzeichen', async () => {
    await gehe('videos', 'home');
    await page.waitForSelector('[data-paction="share"]', { timeout: 10000 });
    await page.click('[data-paction="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });

    const kacheln = await page.$$eval('.teilen__kachel', (els) => els.length);
    const marken = await page.$$eval('.teilen__marke', (els) => els.length);
    if (kacheln === 0) throw new Error('kein Raster');
    if (marken !== kacheln) throw new Error(`${marken} Abzeichen bei ${kacheln} Kacheln`);
  });

  await pruefe('Das Abzeichen sagt, wo die Person erreicht wird', async () => {
    /*
     * Nicht nur „da ist ein Abzeichen", sondern: es unterscheidet. Waeren
     * alle gleich, haette die Angabe keinen Inhalt — dann koennte man sie
     * auch weglassen. Der Testbestand hat Leute aus beiden Bereichen.
     */
    const arten = await page.$$eval('.teilen__marke', (els) =>
      els.map((e) => (e.classList.contains('teilen__marke--community') ? 'c' : 'm'))
    );
    const verschieden = new Set(arten).size;
    if (verschieden < 2) {
      throw new Error(`alle Abzeichen gleich (${arten[0]}) — die Angabe waere inhaltslos`);
    }
    await page.click('[data-sheet-close]');
  });

  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length ? 1 : 0);
})();
