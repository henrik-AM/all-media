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
   * Kasten 7.1 (Henrik 21.09.2026): "Karte am Standort antippbar -> springt
   * in Kartenansicht wie bei der Friend-Map." Bis zum 28.09.2026 reagierte
   * nur der kleine Knopf in der Ecke; ein Klick auf die Karte tat nichts.
   */
  await pruefe('Ein Klick auf die Karte selbst oeffnet die Kartenansicht', async () => {
    const r = await page.$eval('#expKarteRahmen', (e) => {
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width * 0.3, y: b.top + b.height * 0.6 };
    });
    await page.mouse.click(r.x, r.y);
    await page.waitForSelector('#ortKarte .map__pin', { timeout: 5000 });
  });

  await pruefe('Die Kartenansicht listet die Orte in der Naehe, der Ort selbst zuerst', async () => {
    const zeilen = await page.$$eval('#ortListe [data-ortzeige]', (n) =>
      n.map((z) => z.querySelector('.row__name').textContent.trim() + ' | ' + z.querySelector('.row__preview').textContent.trim())
    );
    if (zeilen.length < 2) throw new Error(zeilen.length + ' Zeile(n)');
    if (!zeilen[0].startsWith('Hamburger Hafen')) throw new Error('erste Zeile: ' + zeilen[0]);
    if (!zeilen[0].includes('Dieser Ort')) throw new Error('erste Zeile ohne "Dieser Ort": ' + zeilen[0]);
    // Jede weitere Zeile nennt eine Entfernung.
    const ohne = zeilen.slice(1).filter((z) => !/\d+(,\d)? (m|km)/.test(z));
    if (ohne.length) throw new Error('ohne Entfernung: ' + ohne.join(' / '));
  });

  await pruefe('Die Kartenansicht hat die Ansichtswahl wie die Friend-Map', async () => {
    await page.click('#ortKarteBlatt [data-ortstil]');
    await page.click('#ortKarteBlatt [data-ortstilwahl="satellit"]');
    const schild = await page.$eval('#ortKarteAnsicht', (e) => e.textContent.trim());
    if (schild !== 'Satellit') throw new Error('Schild sagt ' + schild);
    await page.waitForTimeout(800);
    const esri = await page.$$eval('#ortKarte img.leaflet-tile', (n) => n.filter((i) => i.src.includes('arcgisonline')).length);
    if (!esri) throw new Error('keine Satellitenkacheln');
  });

  await pruefe('Vollbild blendet die Liste aus und wieder ein', async () => {
    await page.click('#ortKarteBlatt [data-ortvoll]');
    await page.waitForTimeout(200);
    if (await page.isVisible('#ortListe')) throw new Error('Liste steht im Vollbild noch da');
    await page.click('#ortKarteBlatt [data-ortvoll]');
    await page.waitForTimeout(200);
    if (!(await page.isVisible('#ortListe'))) throw new Error('Liste kommt nicht zurueck');
  });

  await pruefe('Der Pfeil an einer Zeile oeffnet den anderen Ort', async () => {
    const vorher = await page.$eval('.exp__adresse', (e) => e.textContent);
    await page.click('#ortListe [data-ortoeffnen]');
    await page.waitForTimeout(1200);
    if (await page.$('#ortKarte')) throw new Error('Kartenansicht blieb offen');
    const nachher = await page.$eval('.exp__adresse', (e) => e.textContent).catch(() => '');
    if (!nachher || nachher === vorher) throw new Error('kein anderer Ort: ' + nachher);
    // Zurueck zum Hamburger Hafen fuer die folgenden Pruefungen.
    // Ob openExplorer eine Ebene stapelt oder ersetzt: so lange zurueck,
    // bis die Seite zu ist.
    for (let i = 0; i < 3 && !(await page.$eval('#overlay', (e) => e.hidden)); i++) await zurueck();
    await zurSuche();
    await page.click(`[data-place="${await K.kennungNachText(page, 'data-place', 'Hamburger Hafen')}"]`);
    await page.waitForSelector('.exp__adresse', { timeout: 8000 });
  });

  await pruefe('Das Karussell blaettert zwischen den Standortbildern', async () => {
    if (!(await page.$('#expOrtWeiter'))) throw new Error('keine Pfeile');
    const punkte = await page.$$eval('.ortkarussell__punkte i', (n) => n.length);
    if (punkte < 2) throw new Error(punkte + ' Punkt(e)');
    await page.click('#expOrtWeiter');
    const an = await page.$$eval('.ortkarussell__punkte i', (n) => n.findIndex((p) => p.classList.contains('is-an')));
    if (an !== 1) throw new Error('Punkt ' + an + ' ist an');
    await page.click('#expOrtZurueck');
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

  /*
   * Kasten 7.3: nur die gesungene Zeile, zu ihrem Einsatz aus Schema 63.
   * Bei 11,2 s singt Golden Hour laut Einsaetzen die vierte Zeile ("the
   * harbour holds its breath", Einsatz 11 s). Die alte gleichmaessige
   * Verteilung (30 s / 8 Zeilen) stuende dort noch bei der dritten - die
   * Pruefung unterscheidet also, ob die Einsaetze wirklich ankommen.
   */
  await pruefe('Die Einsaetze der Liedzeilen kommen aus der Datenbank (Schema 63)', async () => {
    const id = await K.kennungNachText(page, 'data-sound', 'Golden Hour').catch(() => null);
    const zeiten = await page.evaluate(async (kennung) => {
      const r = await fetch('/api/explorer/sound/' + encodeURIComponent(kennung));
      return (await r.json()).kopf?.zeiten || null;
    }, id);
    if (!Array.isArray(zeiten) || zeiten.length !== 8) throw new Error('zeiten: ' + JSON.stringify(zeiten) + ' - Schema 63 eingespielt?');
  });

  await pruefe('Bei 11,2 s steht genau die gesungene Zeile da', async () => {
    await page.$eval('#soundTon', (a) => new Promise((ok) => {
      a.addEventListener('seeked', ok, { once: true });
      a.currentTime = 11.2;
    }));
    await page.waitForTimeout(200);
    const jetzt = await page.$eval('#lyricsJetzt', (e) => e.textContent.trim());
    if (jetzt !== 'the harbour holds its breath') throw new Error('es steht „' + jetzt + '"');
    if (await page.$('#lyricsDanach')) throw new Error('die naechste Zeile steht noch darunter');
  });

  await pruefe('Ein Klick auf die Wellenform springt an die Stelle', async () => {
    const r = await page.$eval('#welleBalken', (e) => {
      const b = e.getBoundingClientRect();
      return { x: b.left + b.width * 0.5, y: b.top + b.height / 2 };
    });
    await page.mouse.click(r.x, r.y);
    await page.waitForTimeout(300);
    const t = await page.$eval('#soundTon', (a) => a.currentTime);
    if (t < 12 || t > 18) throw new Error('Stelle ' + t.toFixed(1) + ' s statt ~15 s');
    const punkt = await page.$eval('#wellePunkt', (e) => parseFloat(e.style.left));
    if (!(punkt > 40 && punkt < 60)) throw new Error('roter Punkt bei ' + punkt + ' %');
  });

  await pruefe('"Lyrics ansehen" zeigt den ganzen Text mit der gesungenen Zeile hervorgehoben', async () => {
    await page.click('#lyricsAnsehen');
    await page.waitForSelector('.lyricsseite', { timeout: 3000 });
    const zeilen = await page.$$eval('.lyricsseite__zeile', (n) => n.length);
    if (zeilen !== 8) throw new Error(zeilen + ' Zeilen statt 8');
    const jetzt = await page.$$eval('.lyricsseite__zeile.is-jetzt', (n) => n.map((e) => e.textContent.trim()));
    if (jetzt.length !== 1) throw new Error(jetzt.length + ' hervorgehobene Zeilen');
    await page.click('.sheet [data-sheet-close]');
    await page.waitForTimeout(400);
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
