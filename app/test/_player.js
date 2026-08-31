// Prueft die Video-Punkte aus Henriks Rueckmeldung vom 26.08.2026:
//
//   Punkt 26  Die Aktionsspalte im Hochformat verschiebt sich beim Liken
//   Punkt 28  Dasselbe im Querformat
//   Punkt 29  Alle fuenf Aktionen sauber nebeneinander
//   Punkt 30  Vollbildmodus
//   Punkt 31  Video-Einstellungen (Untertitel, Geschwindigkeit, Qualitaet)
//   Punkt 32  Kapitel anzeigen und direkt dorthin springen
//
// Bei 26 und 28 geht es um Pixel: die Knoepfe muessen vor und nach dem Liken
// an derselben Stelle stehen. Genau das laesst sich nur messen, nicht ansehen.
//
// Start:  node test/_player.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

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

  /** Die linken Kanten aller Knoepfe einer Leiste. */
  const kanten = (wahl) =>
    page.$$eval(wahl, (n) => n.map((x) => Math.round(x.getBoundingClientRect().left)));

  /* ------------------------------------------------- Hochformat */
  console.log('\nVideos — Hochformat');

  await page.click('[data-area="videos"]');
  await page.click('[data-sub="portrait"]');
  await page.waitForSelector('.slide__rail');

  await pruefe('Die Aktionsspalte bleibt beim Liken an ihrem Platz', async () => {
    const vorher = await kanten('.slide__rail .railbtn');
    await page.click('.slide__rail [data-vaction="like"]');
    await page.waitForTimeout(700);
    const nachher = await kanten('.slide__rail .railbtn');
    if (vorher.length !== nachher.length) throw new Error('die Zahl der Knöpfe hat sich geändert');
    const verschoben = vorher.map((v, i) => Math.abs(v - nachher[i])).filter((d) => d > 1);
    if (verschoben.length) throw new Error(verschoben.length + ' Knöpfe sind gewandert');
  });

  await pruefe('Auch ein Repost verschiebt nichts', async () => {
    const vorher = await kanten('.slide__rail .railbtn');
    await page.click('.slide__rail [data-vaction="repost"]');
    await page.waitForTimeout(700);
    const nachher = await kanten('.slide__rail .railbtn');
    const verschoben = vorher.map((v, i) => Math.abs(v - nachher[i])).filter((d) => d > 1);
    if (verschoben.length) throw new Error(verschoben.length + ' Knöpfe sind gewandert');
  });

  /* ------------------------------------------------- Querformat */
  console.log('\nVideos — Querformat-Player');

  const zumPlayer = async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="landscape"]');
    // Ein Video mit Kapiteln und Untertiteln — daran haengen die meisten
    // Pruefungen dieses Laufs. Gesucht am Titel statt an "q1", siehe
    // test/_kennungen.js.
    await page.waitForSelector('[data-clip]', { timeout: 10000 });
    await page.click(await K.waehlerClip(page, 'Testvideo im Querformat'));
    await page.waitForSelector('.player');
    await page.waitForTimeout(400);
  };

  await zumPlayer();

  await pruefe('Alle fünf Aktionen stehen nebeneinander', async () => {
    const knoepfe = await page.$$eval('.post__actions--fuenf .postbtn', (n) => n.length);
    if (knoepfe !== 5) throw new Error(knoepfe + ' Knöpfe');
  });

  await pruefe('Sie sind gleichmäßig verteilt, keiner klebt am Rand', async () => {
    const mitten = await page.$$eval('.post__actions--fuenf .postbtn', (n) =>
      n.map((x) => {
        const k = x.getBoundingClientRect();
        return k.left + k.width / 2;
      })
    );
    const abstaende = mitten.slice(1).map((m, i) => m - mitten[i]);
    const groesster = Math.max(...abstaende);
    const kleinster = Math.min(...abstaende);
    // Bei gleicher Verteilung sind alle vier Abstaende praktisch identisch.
    if (groesster - kleinster > 2) {
      throw new Error(`Abstände zwischen ${Math.round(kleinster)} und ${Math.round(groesster)} px`);
    }
  });

  await pruefe('Die Reihe bleibt beim Liken an ihrem Platz', async () => {
    const vorher = await kanten('.post__actions--fuenf .postbtn');
    await page.click('[data-clipact="like"]');
    await page.waitForTimeout(700);
    const nachher = await kanten('.post__actions--fuenf .postbtn');
    const verschoben = vorher.map((v, i) => Math.abs(v - nachher[i])).filter((d) => d > 1);
    if (verschoben.length) throw new Error(verschoben.length + ' Knöpfe sind gewandert');
  });

  /* ------------------------------------------------- Kapitel */
  console.log('\nVideos — Kapitel');

  await pruefe('Ein Video mit Kapiteln zeigt sie an', async () => {
    const zeilen = await page.$$eval('[data-kapitel]', (n) => n.length);
    if (zeilen < 2) throw new Error('nur ' + zeilen + ' Kapitel');
  });

  await pruefe('Ein Klick springt an die Stelle', async () => {
    const zeilen = await page.$$('[data-kapitel]');
    await zeilen[2].click();
    await page.waitForTimeout(300);
    const zeit = await page.$eval('#clipZeit', (n) => n.textContent);
    if (zeit === '0:00') throw new Error('die Zeit steht weiter auf 0:00');
    const breite = await page.$eval('#clipFortschritt', (n) => n.style.width);
    if (!breite || breite === '0%') throw new Error('der Balken bewegt sich nicht');
  });

  await pruefe('Ein Video ohne Kapitel zeigt keine leere Überschrift', async () => {
    await page.click('#clipBack');
    await page.waitForTimeout(400);
    // Eines ohne Kapitel.
    await page.click(await K.waehlerClip(page, 'Test-Rundumvideo'));
    await page.waitForSelector('.player');
    await page.waitForTimeout(400);
    if (await page.$('.kapitel')) throw new Error('die Überschrift steht ohne Kapitel da');
  });

  /* ---------------------------------------- Vollbild und Einstellungen */
  console.log('\nVideos — Vollbild und Einstellungen');

  await pruefe('Es gibt einen Vollbild-Knopf', async () => {
    if (!(await page.$('#clipVollbild'))) throw new Error('kein Knopf');
  });

  await pruefe('Er legt den Player über den ganzen Bildschirm', async () => {
    const vorher = await page.$eval('.player', (n) => n.getBoundingClientRect().height);
    await page.click('#clipVollbild');
    await page.waitForTimeout(500);
    const nachher = await page.$eval('.player', (n) => n.getBoundingClientRect().height);
    if (nachher <= vorher) throw new Error(`${Math.round(vorher)}px vorher, ${Math.round(nachher)}px nachher`);
  });

  await pruefe('Und wieder zurück', async () => {
    await page.click('#clipVollbild');
    await page.waitForTimeout(500);
    const voll = await page.$eval('.player', (n) => n.classList.contains('player--voll'));
    if (voll) throw new Error('der Player bleibt im Vollbild');
  });

  await pruefe('Es gibt Video-Einstellungen mit drei Punkten', async () => {
    await page.click('#clipOptionen');
    await page.waitForTimeout(500);
    const punkte = await page.$$eval('[data-vopt]', (n) => n.map((x) => x.dataset.vopt));
    for (const noetig of ['tempo', 'qualitaet', 'untertitel']) {
      if (!punkte.includes(noetig)) throw new Error('„' + noetig + '" fehlt: ' + punkte.join(' | '));
    }
  });

  await pruefe('Die Geschwindigkeit lässt sich ändern und bleibt stehen', async () => {
    await page.click('[data-vopt="tempo"]');
    await page.waitForTimeout(500);
    const werte = await page.$$eval('[data-vwahl]', (n) => n.map((x) => x.dataset.vwahl));
    if (werte.length < 5) throw new Error('nur ' + werte.length + ' Stufen');
    await page.click('[data-vwahl="1.5"]');
    await page.waitForTimeout(600);

    await page.click('#clipOptionen');
    await page.waitForTimeout(500);
    const steht = await page.$eval('[data-vopt="tempo"] .item__value', (n) => n.textContent.trim());
    if (steht !== '1,5×') throw new Error('steht „' + steht + '"');
  });

  await pruefe('Untertitel merken sich ihren Stand über einen Neustart', async () => {
    await page.click('[data-vopt="untertitel"]');
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#topbar button');
    await zumPlayer();
    await page.click('#clipOptionen');
    await page.waitForTimeout(500);
    const an = await page.$eval('[data-vopt="untertitel"]', (n) => n.classList.contains('is-on'));
    if (!an) throw new Error('nach dem Neustart wieder aus');
  });

  await pruefe('Ein Video ohne Untertitel bietet den Punkt nicht an', async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    await page.evaluate(() => document.querySelector('.sheet-backdrop')?.remove());
    await page.click('#clipBack');
    await page.waitForTimeout(400);
    // Eines ohne Untertitel.
    await page.click(await K.waehlerClip(page, 'Test-Livestream'));
    await page.waitForSelector('.player');
    await page.click('#clipOptionen');
    await page.waitForTimeout(500);
    if (await page.$('[data-vopt="untertitel"]')) throw new Error('der Punkt steht trotzdem da');
    const hinweis = await page.$eval('.sheet__hint', (n) => n.textContent);
    if (!hinweis.includes('keine Untertitel')) throw new Error('kein Hinweis, es steht „' + hinweis + '"');
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
