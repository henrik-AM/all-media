// Prueft die Community-Punkte aus Henriks Rueckmeldung vom 26.08.2026:
//
//   Punkt 51  Die Kanalseite folgt dem Prototyp-Frame "CH + Kanal"
//   Punkt 55  Die Liste heisst nach dem, was drinsteht
//   Punkt 62  Die eigene Community laesst sich nicht verlassen
//   Punkt 63  Der Gruppenname fuehrt zu den Einstellungen
//
// Der Frame gibt vor: Zurueck-Pfeil, grosses Kopfbild, Name mit
// Mitgliederzahl, Knopf, "...", Biografie, Link, "neues Unterthema
// erstellen", darunter die Unterthemen.
//
// Start:  node test/_community.js   (Server muss laufen)

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

  const oeffne = async (id) => {
    await page.click('[data-area="communities"]');
    await page.waitForTimeout(400);
    await page.click(`[data-community="${id}"]`);
    await page.waitForTimeout(700);
  };

  console.log('\nCommunitys — die Seite nach dem Prototyp');

  await oeffne('k1');

  const TEILE = [
    ['.kanal__bild', 'das grosse Kopfbild'],
    ['.kanal__zurueck', 'der Zurueck-Pfeil auf dem Bild'],
    ['.kanal__name', 'der Name'],
    ['.kanal__mitglieder', 'die Mitgliederzahl'],
    ['.kanal__mehr', 'das „..."'],
    ['.kanal__bio', 'die Biografie'],
    ['.kanal__link', 'der Link'],
    ['#neuesUnterthema', '„neues Unterthema erstellen"'],
    ['.kanal__thema', 'die Unterthemen'],
  ];

  for (const [wahl, was] of TEILE) {
    await pruefe(`Es gibt ${was}`, async () => {
      if (!(await page.$(wahl))) throw new Error('fehlt');
    });
  }

  await pruefe('Das Kopfbild ist gross, nicht ein Symbol in einer Zeile', async () => {
    const h = await page.$eval('.kanal__bild', (n) => n.getBoundingClientRect().height);
    if (h < 180) throw new Error('nur ' + Math.round(h) + 'px hoch');
  });

  await pruefe('Der Name ist nicht abgeschnitten', async () => {
    const { sichtbar, echt } = await page.$eval('.kanal__name', (n) => ({
      sichtbar: n.clientWidth,
      echt: n.scrollWidth,
    }));
    if (echt > sichtbar + 1) throw new Error('„Design Systeme" passt nicht in die Zeile');
  });

  await pruefe('Der Link ist ein echter Link', async () => {
    const href = await page.$eval('.kanal__link a', (n) => n.getAttribute('href'));
    if (!href || !href.startsWith('http')) throw new Error('href ist „' + href + '"');
  });

  await pruefe('Die Unterthemen tragen die Raute vor dem Namen', async () => {
    const namen = await page.$$eval('.kanal__thema-name', (n) => n.map((x) => x.textContent.trim()));
    const ohne = namen.filter((t) => !t.startsWith('#'));
    if (ohne.length) throw new Error('ohne Raute: ' + ohne.join(', '));
  });

  await pruefe('Ein Unterthema laesst sich oeffnen', async () => {
    await page.click('.kanal__thema');
    await page.waitForTimeout(600);
    if (await page.$('.kanal__bild')) throw new Error('die Seite hat sich nicht geaendert');
  });

  console.log('\nCommunitys — Name, Einstellungen, eigene Community');

  await pruefe('Der Gruppenname fuehrt zu den Einstellungen', async () => {
    await oeffne('k1');
    await page.click('#communityKopf');
    await page.waitForTimeout(500);
    if (!(await page.$('.sheet'))) throw new Error('es geht nichts auf');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  await pruefe('Das „..." fuehrt zu denselben Einstellungen', async () => {
    await oeffne('k1');
    await page.click('#communityMehr');
    await page.waitForTimeout(500);
    if (!(await page.$('.sheet'))) throw new Error('es geht nichts auf');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  await pruefe('Eine fremde Community laesst sich verlassen', async () => {
    await oeffne('k1');
    const knopf = await page.$('[data-join]');
    if (!knopf) throw new Error('kein Knopf');
    const text = await knopf.textContent();
    if (text.trim() !== 'Verlassen') throw new Error('der Knopf sagt „' + text.trim() + '"');
  });

  await pruefe('Die eigene Community laesst sich NICHT verlassen', async () => {
    await oeffne('k4');
    if (await page.$('[data-join]')) throw new Error('der Verlassen-Knopf steht trotzdem da');
    const hinweis = await page.$('.kanal__eigen');
    if (!hinweis) throw new Error('kein Hinweis, dass es die eigene Community ist');
  });

  await pruefe('Ein neues Unterthema laesst sich anlegen', async () => {
    await oeffne('k1');
    const vorher = await page.$$eval('.kanal__thema', (n) => n.length);
    await page.click('#neuesUnterthema');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Ankündigungen');
    await page.click('#formOk');
    await page.waitForTimeout(800);
    const nachher = await page.$$eval('.kanal__thema', (n) => n.length);
    if (nachher !== vorher + 1) throw new Error(`${vorher} vorher, ${nachher} nachher`);
    const namen = await page.$$eval('.kanal__thema-name', (n) => n.map((x) => x.textContent));
    if (!namen.some((t) => t.includes('Ankündigungen'))) throw new Error('steht nicht in der Liste');
  });

  await pruefe('Ein zweites Unterthema mit demselben Namen wird abgelehnt', async () => {
    await page.click('#neuesUnterthema');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Ankündigungen');
    await page.click('#formOk');
    await page.waitForTimeout(600);
    const toast = await page.$eval('#toast', (n) => (n.hidden ? '' : n.textContent));
    if (!toast.includes('gibt es schon')) throw new Error('kein Hinweis, Toast sagt „' + toast + '"');
    await page.click('[data-sheet-close]').catch(() => {});
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
