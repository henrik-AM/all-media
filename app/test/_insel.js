// Prueft die drei Blocker aus Henriks Rueckmeldung vom 26.08.2026:
//
//   1. Die obere Navigation schwebt als Dynamic Island ueber dem Bildschirm,
//      statt oben angeklebt zu sitzen.
//   2. Ungelesenes steht auf dem Unterpunkt *und* auf dem Bereich.
//   3. Die Filter im Querformat filtern wirklich.
//
// Dazu die Startposition: jeder Bereich faengt auf seiner Hauptseite an.
//
// Start:  node test/_insel.js   (Server muss laufen)

const { chromium } = require('playwright-core');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'networkidle' });
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
  await page.reload({ waitUntil: 'networkidle' });
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

  /* -------------------------------------------------- Dynamic Island */
  console.log('\nDynamic Island');

  await pruefe('Die Leiste schwebt, statt im Fluss zu sitzen', async () => {
    const lage = await page.$eval('#topbar', (n) => getComputedStyle(n).position);
    if (lage !== 'absolute') throw new Error('position: ' + lage);
  });

  await pruefe('Sie ist schmaler als der Bildschirm und rundum von Luft umgeben', async () => {
    const k = await page.$eval('#topbar', (n) => n.getBoundingClientRect().toJSON());
    if (k.width > 340) throw new Error('Breite ' + Math.round(k.width) + 'px — das ist wieder eine Leiste');
    if (k.left < 12) throw new Error('links nur ' + Math.round(k.left) + 'px Luft');
    if (k.top < 6) throw new Error('oben nur ' + Math.round(k.top) + 'px Luft');
  });

  await pruefe('Sie ist eine Pille, keine Kante', async () => {
    const r = await page.$eval('#topbar', (n) => parseFloat(getComputedStyle(n).borderTopLeftRadius));
    if (r < 18) throw new Error('Radius ' + r + 'px');
  });

  await pruefe('Der Inhalt beginnt unter der Insel, nicht dahinter', async () => {
    const insel = await page.$eval('#topbar', (n) => n.getBoundingClientRect().bottom);
    const inhalt = await page.$eval('#main', (n) => n.getBoundingClientRect().top + parseFloat(getComputedStyle(n).paddingTop));
    if (inhalt < insel) throw new Error('Inhalt beginnt ' + Math.round(insel - inhalt) + 'px zu hoch');
  });

  await pruefe('In den Einstellungen gibt es keine Insel', async () => {
    await page.click('[data-area="settings"]');
    await page.waitForTimeout(300);
    const da = await page.$eval('#topbar', (n) => !n.hidden);
    if (da) throw new Error('Insel steht trotzdem da');
    const platz = await page.$eval('#main', (n) => n.classList.contains('main--insel'));
    if (platz) throw new Error('Der Abstand fuer die Insel bleibt stehen');
  });

  /* ------------------------------------------------------- Zaehler */
  console.log('\nBenachrichtigungen');

  await pruefe('Ungelesenes steht auf dem Bereich Messenger', async () => {
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(300);
    const text = await page.$eval('[data-area="messenger"] .navbtn__badge', (n) => n.textContent);
    if (text !== '3') throw new Error('steht "' + text + '" statt "3"');
  });

  await pruefe('Dieselbe Zahl steht auf dem Unterpunkt Chats', async () => {
    const text = await page.$eval('[data-sub="chats"] .topbar__badge', (n) => n.textContent);
    if (text !== '3') throw new Error('steht "' + text + '" statt "3"');
  });

  await pruefe('Ein gelesener Chat nimmt beide Zahlen mit', async () => {
    await page.click('[data-chat="c1"]');
    await page.waitForTimeout(400);
    await page.click('#chatBack');
    await page.waitForTimeout(400);
    const oben = await page.$eval('[data-sub="chats"] .topbar__badge', (n) => n.textContent);
    const unten = await page.$eval('[data-area="messenger"] .navbtn__badge', (n) => n.textContent);
    if (oben !== '1' || unten !== '1') throw new Error('oben "' + oben + '", unten "' + unten + '"');
  });

  /* ------------------------------------------------ Querformat-Filter */
  console.log('\nVideos — Querformat');

  const gefiltert = async (filter) => {
    await page.click(`[data-clipfilter="${filter}"]`);
    await page.waitForTimeout(200);
    return page.$$eval('[data-clip]', (n) => n.map((x) => x.dataset.clip));
  };

  await page.click('[data-area="videos"]');
  await page.click('[data-sub="landscape"]');
  await page.waitForSelector('[data-clipfilter]');

  let alle = [];
  await pruefe('„Alle" zeigt jedes Video', async () => {
    alle = await gefiltert('alle');
    if (alle.length < 6) throw new Error('nur ' + alle.length + ' Videos');
  });

  await pruefe('„Standard" zeigt weniger als „Alle"', async () => {
    const liste = await gefiltert('standard');
    if (!liste.length) throw new Error('leer');
    if (liste.length >= alle.length) throw new Error('gleich viele wie unter „Alle" — der Filter tut nichts');
  });

  await pruefe('„360°" zeigt eine eigene Auswahl', async () => {
    const liste = await gefiltert('360°');
    if (!liste.length) throw new Error('leer');
    if (liste.length >= alle.length) throw new Error('gleich viele wie unter „Alle"');
  });

  await pruefe('„Live" zeigt eine eigene Auswahl', async () => {
    const liste = await gefiltert('live');
    if (!liste.length) throw new Error('leer');
    if (liste.length >= alle.length) throw new Error('gleich viele wie unter „Alle"');
  });

  await pruefe('Die drei Arten ueberschneiden sich nicht und ergeben zusammen „Alle"', async () => {
    const s = await gefiltert('standard');
    const d = await gefiltert('360°');
    const l = await gefiltert('live');
    const zusammen = [...s, ...d, ...l];
    if (new Set(zusammen).size !== zusammen.length) throw new Error('ein Video steht unter zwei Filtern');
    if (zusammen.length !== alle.length) {
      throw new Error(zusammen.length + ' von ' + alle.length + ' Videos haben eine Art');
    }
  });

  await pruefe('Live-Videos sind auf der Kachel als solche erkennbar', async () => {
    await gefiltert('live');
    const marken = await page.$$eval('.clip__art--live', (n) => n.length);
    const kacheln = await page.$$eval('[data-clip]', (n) => n.length);
    if (marken !== kacheln) throw new Error(marken + ' Abzeichen bei ' + kacheln + ' Kacheln');
  });

  /* ------------------------------------------------ Startposition */
  console.log('\nNavigation');

  await pruefe('Ein Bereich faengt immer auf seiner Hauptseite an', async () => {
    await page.click('[data-sub="search"]');
    await page.waitForTimeout(200);
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(200);
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(300);
    const aktiv = await page.$eval('#topbar .is-active', (n) => n.dataset.sub);
    if (aktiv !== 'home') throw new Error('Videos startet bei „' + aktiv + '" statt „home"');
  });

  await pruefe('Der Messenger faengt bei den Chats an', async () => {
    await page.click('[data-sub="camera"]').catch(() => {});
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(300);
    const aktiv = await page.$eval('#topbar .is-active', (n) => n.dataset.sub);
    if (aktiv !== 'chats') throw new Error('startet bei „' + aktiv + '"');
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
