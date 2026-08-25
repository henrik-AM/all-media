// Prueft das Teilen von Beitraegen und Videos.
//
// Prototyp-Frames "Nutzer B + Beitrag teilen" und "VQ + Video teilen": ein
// Blatt mit einem Raster aus Personen. Wen man antippt, der bekommt es in
// den Chat. Vorher gab der Knopf nur "Beitrag geteilt" aus.
//
// Start:  node test/_teilen.js   (Server muss laufen)

const { chromium } = require('playwright-core');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'networkidle' });
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

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
      await page.waitForTimeout(400);
    }
  };

  console.log('\nBeitrag teilen');
  await gehe('videos', 'home');

  await pruefe('Der Teilen-Knopf oeffnet das Personen-Raster', async () => {
    await page.click('[data-paction="share"]');
    await page.waitForSelector('.teilen', { timeout: 3000 });
    const namen = await page.$$eval('.teilen__name', (els) => els.map((e) => e.textContent));
    if (namen.length < 6) throw new Error('nur ' + namen.length + ' Personen');
    if (!namen.includes('Anna Schmidt')) throw new Error(namen.join(' | '));
  });

  await pruefe('Kontakte stehen vor den weiteren Vorschlaegen', async () => {
    const koepfe = await page.$$eval('.teilen__kopf', (els) => els.map((e) => e.textContent));
    if (koepfe[0] !== 'Deine Kontakte') throw new Error(koepfe.join(' | '));
    if (!koepfe.includes('Weitere Vorschläge')) throw new Error(koepfe.join(' | '));
  });

  await pruefe('Antippen markiert die Person als gesendet', async () => {
    await page.click('[data-teilen="u1"]');
    await page.waitForTimeout(600);
    const fertig = await page.$$eval('.teilen__kachel.is-gesendet', (els) => els.length);
    if (fertig !== 1) throw new Error(fertig + ' Kacheln markiert');
  });

  await pruefe('Zweites Antippen sendet nicht noch einmal', async () => {
    await page.click('[data-teilen="u1"]');
    await page.waitForTimeout(400);
    const fertig = await page.$$eval('.teilen__kachel.is-gesendet', (els) => els.length);
    if (fertig !== 1) throw new Error(fertig + ' Kacheln markiert');
    await page.click('[data-sheet-close]');
  });

  await pruefe('Der Beitrag liegt als Karte im Chat', async () => {
    await gehe('messenger', 'chats');
    await page.click('[data-chat="c1"]');
    await page.waitForTimeout(800);
    const karten = await page.$$eval('.msg__geteilt', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    if (!karten.length) throw new Error('keine Karte im Chat');
    if (!karten[karten.length - 1].includes('Clara Weber')) throw new Error(karten.join(' | '));
  });

  await pruefe('Die Chatliste zeigt "Beitrag geteilt" als Vorschau', async () => {
    await page.click('#chatBack, [data-back]').catch(() => page.goBack());
    await page.waitForTimeout(600);
    const text = await page.$eval('#main', (e) => e.textContent);
    if (!text.includes('Beitrag geteilt')) throw new Error('Vorschau fehlt');
  });

  console.log('\nVideo teilen');

  await pruefe('Auch im Video-Feed oeffnet Teilen das Raster', async () => {
    await gehe('videos', 'portrait');
    await page.click('[data-vaction="share"]');
    await page.waitForSelector('.teilen', { timeout: 3000 });
    const titel = await page.$eval('.sheet__titel-mitte', (e) => e.textContent);
    if (titel !== 'Video teilen') throw new Error(titel);
  });

  await pruefe('Gesendetes Video zaehlt bei den Weiterleitungen mit', async () => {
    const vorher = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).videos[0].shares);
    await page.click('[data-teilen="u2"]');
    await page.waitForTimeout(700);
    const nachher = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).videos[0].shares);
    if (nachher !== vorher + 1) throw new Error(`${vorher} -> ${nachher}`);
    await page.click('[data-sheet-close]');
  });

  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehler || eindeutig.length ? 1 : 0);
})();
