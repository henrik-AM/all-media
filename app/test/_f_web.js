/* Friend Map auf der Website prüfen (F1-F6, 09.09.2026). */
const { chromium } = require('playwright-core');
const { vorbereiten, schliesse } = require('./_konto');
const BASIS = process.env.AM_BASIS || 'http://localhost:3011';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  page.on('console', (m) => m.type() === 'error' && console.log('  KONSOLE', m.text()));
  if (!(await vorbereiten(page, BASIS))) return browser.close();

  await page.evaluate(() => {
    state.area = 'messenger';
    state.sub.messenger = 'friendmap';
    render();
  });
  await page.waitForTimeout(2500);
  console.log('Karte da:', await page.locator('#mapFlaeche').count());

  // F1 Pinch: Leaflet-Optionen
  const zoomOpt = await page.evaluate(() => {
    const m = state.karte?.mapInstance;
    return m ? { touchZoom: m.options.touchZoom, zoomSnap: m.options.zoomSnap, scrollWheelZoom: m.options.scrollWheelZoom } : null;
  });
  console.log('F1 Zoom-Optionen:', JSON.stringify(zoomOpt));

  // F2 Stilwahl
  await page.click('[data-mapstil]');
  await page.waitForTimeout(500);
  const stile = await page.$$eval('[data-stilwahl]', (e) => e.map((x) => x.textContent.trim()));
  console.log('F2 Auswahlfenster:', JSON.stringify(stile));
  await page.screenshot({ path: '/tmp/f2-stile.png' });
  await page.click('[data-stilwahl="gelaende"]');
  await page.waitForTimeout(1500);
  console.log('F2 gewählt:', await page.evaluate(() => state.karteStil));

  // F3 Schalter sofort
  const vor = await page.textContent('.standort__sub');
  await page.click('.schalter');
  await page.waitForTimeout(120);
  const gleichDanach = await page.textContent('.standort__sub');
  await page.waitForTimeout(2000);
  const spaeter = await page.textContent('.standort__sub');
  console.log(`F3 vorher="${vor}" sofort="${gleichDanach}" später="${spaeter}"`);
  await page.click('.schalter');
  await page.waitForTimeout(2000);

  // F4 Suchleiste
  await page.click('#standortStufe');
  await page.waitForTimeout(600);
  await page.click('[data-stufe="alle_bis_auf"]');
  await page.waitForTimeout(1200);
  const suchfeld = await page.locator('#sichtSuche').count();
  const namen = await page.$$eval('.insight__person', (e) => e.map((x) => x.textContent.trim()));
  const kontakte = await page.evaluate(() => (state.contacts || []).length);
  console.log(`F4 Suchfeld=${suchfeld} Namen=${namen.length} Kontakte=${kontakte}`);
  await page.screenshot({ path: '/tmp/f4-ausnahmen.png' });
  if (suchfeld) {
    await page.fill('#sichtSuche', 'ann');
    await page.waitForTimeout(600);
    console.log('F4 gefiltert:', JSON.stringify(await page.$$eval('.insight__person', (e) => e.map((x) => x.textContent.trim().split('\n')[0]))));
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.click('#standortStufe');
  await page.waitForTimeout(500);
  await page.click('[data-stufe="alle"]');
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // F5/F6 Liste
  const liste = await page.$$eval('[data-zoom]', (e) => e.map((x) => x.dataset.zoom));
  const sichtbar = await page.evaluate(() => (state.friends || []).map((f) => f.id));
  console.log('F6 Liste:', JSON.stringify(liste), 'friends:', JSON.stringify(sichtbar));
  if (liste.length) {
    await page.evaluate(() => (document.querySelector('.scroll').scrollTop = 500));
    await page.click(`[data-zoom="${liste[0]}"]`);
    await page.waitForTimeout(1500);
    const nach = await page.evaluate(() => ({ zoom: state.karte.zoom, mitte: state.karte.mitte, scroll: document.querySelector('.scroll')?.scrollTop }));
    console.log('F5 nach dem Tippen:', JSON.stringify(nach));
    await page.screenshot({ path: '/tmp/f5-zoom.png' });
  }
  await schliesse(browser);
})();
