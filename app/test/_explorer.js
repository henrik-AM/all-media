// Prueft die drei Explorer-Seiten: Hashtag, Standort und Sound.
//
// Prototyp-Frames "VS# - Hashtagoptionen", "VSS + Standort" und
// "VSSo + Sound". Vorher gab jeder dieser Knoepfe nur "... folgt" aus.
//
// Start:  node test/_explorer.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'networkidle' });

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen

  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {

    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    process.exit(1);

  }

  await page.reload({ waitUntil: 'networkidle' });

  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
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

  const zurSuche = async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(300);
    await page.click('[data-sub="search"]');
    await page.waitForTimeout(500);
  };

  const zurueck = async () => {
    await page.click('#expBack');
    await page.waitForTimeout(400);
  };

  await zurSuche();

  console.log('\nHashtag-Seite');
  await pruefe('Ein Hashtag oeffnet seine eigene Seite', async () => {
    await page.click('[data-tag="#sonnenaufgang"]');
    await page.waitForSelector('.exp__kopf', { timeout: 3000 });
    const titel = await page.$eval('#overlay .exp__titel', (e) => e.textContent);
    if (titel !== '#sonnenaufgang') throw new Error(titel);
  });

  await pruefe('Dort stehen die passenden Beitraege, nicht alle', async () => {
    // Nur die Seite selbst zaehlen: unter dem Overlay liegt die Suche, die
    // ebenfalls ein .exp__grid hat.
    const abschnitte = await page.$$eval('#overlay .exp__head', (els) => els.map((e) => e.textContent));
    if (!abschnitte.length) throw new Error('keine Abschnitte');
    const raster = await page.$$eval('#overlay .exp__grid .griditem', (els) => els.length);
    const gesamt = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).posts.length);
    if (raster >= gesamt) throw new Error(`${raster} von ${gesamt} Beitraegen - nicht gefiltert`);
    if (raster < 1) throw new Error('kein Beitrag');
  });

  await pruefe('Der Zurueck-Pfeil schliesst die Seite wieder', async () => {
    await zurueck();
    const versteckt = await page.$eval('#overlay', (e) => e.hidden);
    if (!versteckt) throw new Error('Seite noch offen');
  });

  console.log('\nStandort-Seite');
  await pruefe('Ein Standort zeigt Adresse, Koordinaten und Karte', async () => {
    // "pl1" war die feste Kennung aus den Beispieldaten. Standorte stehen
    // jetzt in der Datenbank und bekommen ihre Kennung dort — gesucht wird
    // deshalb am Namen. Siehe test/_kennungen.js.
    await page.click(`[data-place="${await K.kennungNachText(page, 'data-place', 'Hamburger Hafen')}"]`);
    await page.waitForSelector('.exp__adresse', { timeout: 8000 });
    const adresse = await page.$eval('.exp__adresse', (e) => e.textContent);
    const koord = await page.$eval('.exp__koordinaten', (e) => e.textContent);
    if (!adresse.includes('Hamburg')) throw new Error(adresse);
    if (!/[NO]/.test(koord)) throw new Error(koord);
    if (!(await page.$('.minikarte__nadel'))) throw new Error('keine Nadel auf der Karte');
  });

  /*
   * Frueher hiess diese Pruefung '"Alle Fotos ansehen" springt zu den
   * Beitraegen' und war zufrieden, wenn ein Hinweis erschien. Genau das hat
   * Henrik am 26.08.2026 als Punkt 10 gemeldet: der Knopf soll auf eine
   * eigene Seite nur mit Fotos fuehren. Die Einzelheiten stehen in
   * test/_feinschliff.js; hier bleibt der Weg hin und zurueck.
   */
  await pruefe('"Alle Fotos ansehen" fuehrt auf die Fotoseite', async () => {
    await page.click('#expFotos');
    await page.waitForSelector('#fotosBack', { timeout: 3000 });
    const titel = await page.$eval('.page__titel', (e) => e.textContent.trim());
    if (titel !== 'Alle Fotos') throw new Error('der Kopf sagt "' + titel + '"');
    await page.click('#fotosBack');
    await page.waitForSelector('#expFotos', { timeout: 3000 });
    await zurueck();
  });

  console.log('\nSound-Seite');
  await pruefe('Ein Sound zeigt Cover, Produzent und Liedtext', async () => {
    await page.click(`[data-sound="${await K.kennungNachText(page, 'data-sound', 'Golden Hour')}"]`);
    await page.waitForSelector('.soundcover', { timeout: 3000 });
    const zahl = await page.$eval('.exp__zahl', (e) => e.textContent);
    if (!zahl.includes('Lys')) throw new Error(zahl);
    // Aus der einen Zeile ist ein ganzer Text geworden - Punkt 11.
    const zeilen = await page.$$eval('.lyrics__zeile', (n) => n.length);
    if (!zeilen) throw new Error('kein Liedtext');
  });

  await pruefe('Der Abspielknopf laesst die Zeit laufen', async () => {
    const vorher = await page.$eval('#welleZeit', (e) => e.textContent);
    await page.click('#soundPlay');
    await page.waitForTimeout(2200);
    const nachher = await page.$eval('#welleZeit', (e) => e.textContent);
    if (vorher === nachher) throw new Error('Zeit steht bei ' + nachher);
    // Die Wellenform faerbt sich anteilig zur Gesamtlaenge - nach zwei
    // Sekunden von dreieinhalb Minuten ist noch kein Balken dran. Darum
    // wird hier nur die Zeit geprueft.
  });

  await pruefe('Noch einmal tippen haelt an', async () => {
    await page.click('#soundPlay');
    const stand = await page.$eval('#welleZeit', (e) => e.textContent);
    await page.waitForTimeout(1600);
    const jetzt = await page.$eval('#welleZeit', (e) => e.textContent);
    if (stand !== jetzt) throw new Error(`${stand} -> ${jetzt}`);
    await zurueck();
  });

  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehler || eindeutig.length ? 1 : 0);
})();
