// Prueft die drei Explorer-Seiten: Hashtag, Standort und Sound.
//
// Prototyp-Frames "VS# - Hashtagoptionen", "VSS + Standort" und
// "VSSo + Sound". Vorher gab jeder dieser Knoepfe nur "... folgt" aus.
//
// Start:  node test/_explorer.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

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

  /*
   * Henrik am 21.09.2026: "Hashtag-Detailseite: Ueberschrift nicht
   * anklickbar, Liste nicht aufklappbar." Die Ueberschrift oeffnet jetzt
   * denselben Hashtag nur mit diesem Abschnitt, und der Pfeil fuehrt eine
   * Ebene zurueck, nicht aus der Seite heraus.
   */
  await pruefe('Eine Abschnittsueberschrift klappt die volle Liste auf', async () => {
    const knopf = await page.$('#overlay [data-expnur]');
    if (!knopf) throw new Error('keine anklickbare Ueberschrift');
    const welcher = await knopf.getAttribute('data-expnur');
    await knopf.click();
    await page.waitForSelector('#overlay .page__title', { timeout: 4000 });
    const titel = await page.$eval('#overlay .page__title', (e) => e.textContent);
    if (!titel.includes('#sonnenaufgang')) throw new Error('Kopf sagt "' + titel + '"');
    if (await page.$('#overlay [data-expnur]')) throw new Error('aufgeklappt stehen noch Ueberschriften');
    if (await page.$('#overlay .exp__kopf')) throw new Error('der Hashtag-Kopf steht noch da');
    await page.click('#expBack');
    await page.waitForSelector(`#overlay [data-expnur="${welcher}"]`, { timeout: 4000 });
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
    // Seit 21.09.2026 eine echte Karte (Leaflet) statt des gezeichneten
    // Rasters - die Nadel ist ein Kreis auf der Karte.
    await page.waitForSelector('#expKarte .map__pin', { timeout: 5000 }).catch(() => null);
    if (!(await page.$('#expKarte .map__pin'))) throw new Error('keine Nadel auf der Karte');
    const kacheln = await page.$$eval('#expKarte img.leaflet-tile', (n) => n.length);
    if (!kacheln) throw new Error('die Karte hat keine Kacheln');
  });

  await pruefe('Der Vollbild-Knopf oeffnet die grosse Karte mit allen Orten', async () => {
    await page.click('#expKarteVoll');
    await page.waitForSelector('#ortKarte .map__pin', { timeout: 5000 });
    const nadeln = await page.$$eval('#ortKarte .map__pin', (n) => n.length);
    if (nadeln < 2) throw new Error(nadeln + ' Nadel(n)');
    await page.click('.sheet [data-sheet-close]');
    await page.waitForTimeout(500);
    if (await page.$('#ortKarte')) throw new Error('die grosse Karte geht nicht wieder zu');
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
  /*
   * Henrik am 21.09.2026: "Songs: Abspielen, nur die aktuell gesungene
   * Textzeile, Songwriter-Name, offizielles Songbild." Schema 54.
   */
  await pruefe('Ein Sound zeigt Songbild, Interpret, Songwriter und eine Liedzeile', async () => {
    await page.click(`[data-sound="${await K.kennungNachText(page, 'data-sound', 'Golden Hour')}"]`);
    await page.waitForSelector('.soundcover', { timeout: 3000 });
    const interpret = await page.$eval('.exp__interpret', (e) => e.textContent);
    if (!interpret.includes('Lys')) throw new Error(interpret);
    const zahlen = await page.$$eval('.exp__zahl', (n) => n.map((e) => e.textContent).join(' | '));
    if (!zahlen.includes('Songwriter')) throw new Error('kein Songwriter: ' + zahlen);
    const bild = await page.$eval('.soundcover img', (i) => i.complete && i.naturalWidth).catch(() => 0);
    if (!bild) throw new Error('kein Songbild geladen');
    const jetzt = await page.$eval('#lyricsJetzt', (e) => e.textContent.trim());
    if (!jetzt) throw new Error('keine Liedzeile');
    // Nur die aktuelle Zeile - nicht mehr der ganze Text.
    if (await page.$('.lyrics__zeile')) throw new Error('der ganze Liedtext steht noch da');
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

  await pruefe('Die Hoerprobe spielt wirklich', async () => {
    const ton = await page.$eval('#soundTon', (a) => ({ zeit: a.currentTime, pausiert: a.paused }));
    if (ton.pausiert || ton.zeit <= 0) throw new Error(JSON.stringify(ton));
  });

  await pruefe('Noch einmal tippen haelt an', async () => {
    await page.click('#soundPlay');
    // Das letzte timeupdate kommt kurz nach dem Anhalten noch an.
    await page.waitForTimeout(400);
    const stand = await page.$eval('#welleZeit', (e) => e.textContent);
    await page.waitForTimeout(1600);
    const jetzt = await page.$eval('#welleZeit', (e) => e.textContent);
    if (stand !== jetzt) throw new Error(`${stand} -> ${jetzt}`);
    await zurueck();
  });

  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length ? 1 : 0);
})();
