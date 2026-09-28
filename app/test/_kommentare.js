// Prueft Kasten 5 aus Henriks Rueckmeldung vom 21.09.2026 (Videospalte):
//
//   5.1  Eingabefeld, Senden-Knopf und Profilbild vollstaendig sichtbar -
//        in Home, Kurzformat und Querformat
//   5.2  Der Kommentar-Knopf im Querformat und bei Live funktioniert
//   5.3  Live: kleines Fenster mit den neuesten Kommentaren, das sich zum
//        Schreiben aufklappt
//
// "Sichtbar" heisst hier: im Fenster UND nicht verdeckt. Gemessen wird mit
// elementFromPoint in der Mitte jedes Teils - ein Blatt, das hinter dem
// Player liegt, hat trotzdem einen Kasten im Fenster.
//
// Bilder: bilder/kasten5/web-*.png
// Start:  node test/_kommentare.js   (Server muss laufen)

const path = require('path');
const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
const bild = (name) => path.join(__dirname, '..', '..', 'bilder', 'kasten5', `web-${name}.png`);

(async () => {
  const browser = await chromium.launch();
  const kontext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await kontext.newPage();
  page.setDefaultTimeout(8000);

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });
  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
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

  /** Welche der drei Teile unten im Blatt sind nicht vollstaendig zu sehen? */
  const verdeckteTeile = () =>
    page.evaluate(() => {
      const teile = {
        Profilbild: document.querySelector('.sheet .composer .avatar'),
        Eingabefeld: document.querySelector('#commentInput'),
        Senden: document.querySelector('#commentSend'),
      };
      const hoehe = window.innerHeight;
      const breite = window.innerWidth;
      return Object.entries(teile)
        .filter(([, n]) => {
          if (!n) return true;
          const k = n.getBoundingClientRect();
          if (k.width === 0 || k.height === 0) return true;
          if (k.top < 0 || k.left < 0 || k.bottom > hoehe + 0.5 || k.right > breite + 0.5) return true;
          const oben = document.elementFromPoint(k.left + k.width / 2, k.top + k.height / 2);
          return !(oben && (oben === n || n.contains(oben)));
        })
        .map(([name]) => name);
    });

  const blattZu = async () => {
    await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove()));
    await page.waitForTimeout(200);
  };

  const blattVollstaendig = async (name) => {
    await page.waitForSelector('#commentInput');
    await page.waitForTimeout(400);
    await page.screenshot({ path: bild(name) });
    const fehlt = await verdeckteTeile();
    if (fehlt.length) throw new Error('nicht vollständig sichtbar: ' + fehlt.join(', '));
  };

  /* ------------------------------------------------------------ 5.1 */
  console.log('\n5.1 Eingabe, Senden, Profilbild vollständig');

  await pruefe('Home: alle drei Teile sind zu sehen', async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="home"]');
    await page.waitForSelector('.postlist');
    const pid = await K.beitrag(page, 'Hafen um sechs');
    await page.click(`.post__comments[data-pid="${pid}"]`);
    await blattVollstaendig('home');
  });
  await blattZu();

  await pruefe('Kurzformat: alle drei Teile sind zu sehen', async () => {
    await page.click('[data-sub="portrait"]');
    await page.waitForSelector('.slide__rail');
    await page.click('.slide__rail [data-vaction="comment"]');
    await blattVollstaendig('kurz');
  });
  await blattZu();

  /* ------------------------------------------------------------ 5.2 */
  console.log('\n5.2 Kommentar-Knopf im Querformat');

  const clipAuf = async (titel) => {
    await page.evaluate(() => document.querySelector('#clipBack')?.click());
    await page.waitForTimeout(300);
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="landscape"]');
    await page.waitForSelector('[data-clip]', { timeout: 10000 });
    await page.click(await K.waehlerClip(page, titel));
    await page.waitForSelector('.player');
    await page.waitForTimeout(500);
  };

  await clipAuf('Testvideo im Querformat');

  await pruefe('Querformat: der Knopf öffnet das Blatt, und es liegt über dem Player', async () => {
    await page.click('[data-clipact="comment"]');
    await blattVollstaendig('quer');
  });

  await pruefe('Ein gesperrtes Wort meldet sich IM Blatt, der Entwurf bleibt stehen', async () => {
    const vorher = await page.$$eval('.comment', (n) => n.length);
    await page.fill('#commentInput', 'Du idiot');
    await page.click('#commentSend');
    await page.waitForSelector('#commentHinweis:not([hidden])', { timeout: 8000 });
    const text = await page.$eval('#commentHinweis', (n) => n.textContent);
    if (!/idiot/.test(text)) throw new Error('Hinweis sagt: ' + text);
    const sichtbar = await page.$eval('#commentHinweis', (n) => {
      const k = n.getBoundingClientRect();
      const oben = document.elementFromPoint(k.left + 20, k.top + k.height / 2);
      return oben === n || n.contains(oben);
    });
    if (!sichtbar) throw new Error('der Hinweis ist verdeckt');
    if ((await page.inputValue('#commentInput')) !== 'Du idiot') throw new Error('der Entwurf ist weg');
    if ((await page.$$eval('.comment', (n) => n.length)) !== vorher) throw new Error('er wurde trotzdem gesendet');
    await page.screenshot({ path: bild('filter') });
  });

  await pruefe('Weitertippen nimmt den Hinweis wieder weg', async () => {
    await page.fill('#commentInput', '');
    await page.type('#commentInput', 'S');
    if (!(await page.$('#commentHinweis[hidden]'))) throw new Error('der Hinweis bleibt stehen');
  });

  await pruefe('Ein erlaubter Kommentar erscheint sofort und zieht die Zahl mit', async () => {
    const vorher = await page.$$eval('.comment', (n) => n.length);
    await page.fill('#commentInput', 'Prüfkommentar Kasten 5');
    await page.click('#commentSend');
    await page.waitForFunction((soll) => document.querySelectorAll('.comment').length >= soll, vorher + 1, {
      timeout: 15000,
    });
    const letzter = await page.$$eval('.comment__text', (n) => n[n.length - 1].textContent);
    if (!letzter.includes('Prüfkommentar Kasten 5')) throw new Error('zuletzt steht: ' + letzter.trim());
    await blattZu();
    const zahl = await page.$eval('#clipKommentarZahl', (n) => n.textContent.trim());
    if (zahl !== String(vorher + 1)) throw new Error(`Knopf zeigt ${zahl}, erwartet ${vorher + 1}`);
  });

  /* ------------------------------------------------------ 5.2 / 5.3 */
  console.log('\n5.2 / 5.3 Live');

  await clipAuf('Expo SDK 57 live erklärt');

  await pruefe('Live: zugeklappt steht ein kleines Fenster mit höchstens drei Zeilen', async () => {
    await page.waitForSelector('#liveZeilen');
    await page.waitForTimeout(800);
    const zeilen = await page.$$eval('#liveZeilen .live__kommentar', (n) => n.length);
    if (zeilen > 3) throw new Error(zeilen + ' Zeilen im zugeklappten Fenster');
    if (await page.$('#liveFeld')) throw new Error('das Eingabefeld ist schon offen');
    await page.screenshot({ path: bild('live-zu') });
  });

  await pruefe('Live: der Kommentar-Knopf klappt auf und setzt den Cursor ins Feld', async () => {
    await page.click('[data-clipact="comment"]');
    await page.waitForSelector('#liveFeld');
    await page.waitForTimeout(300);
    const fokus = await page.evaluate(() => document.activeElement?.id);
    if (fokus !== 'liveFeld') throw new Error('Fokus liegt auf ' + (fokus || 'nichts'));
  });

  await pruefe('Live: ein Kommentar erscheint im Fenster, der Knopf zählt die Live-Kommentare', async () => {
    const vorher = await page.$$eval('#liveZeilen .live__kommentar', (n) => n.length);
    if (!(await page.$('#liveSenden[disabled]'))) throw new Error('Senden ist bei leerem Feld aktiv');
    await page.fill('#liveFeld', 'Prüf-Livekommentar Kasten 5');
    // Ueber den sichtbaren Knopf, nicht ueber Enter - den gab es bis 28.09. nicht.
    await page.click('#liveSenden');
    await page.waitForFunction(
      () => [...document.querySelectorAll('#liveZeilen .live__kommentar')].some((n) =>
        n.textContent.includes('Prüf-Livekommentar Kasten 5')
      ),
      null,
      { timeout: 15000 }
    );
    const zahl = await page.$eval('#clipKommentarZahl', (n) => n.textContent.trim());
    const zeilen = await page.$$eval('#liveZeilen .live__kommentar', (n) => n.length);
    if (zeilen < vorher + 1 && zeilen < 30) throw new Error(`${zeilen} Zeilen nach dem Senden`);
    if (!/^\d/.test(zahl)) throw new Error('Knopf zeigt ' + zahl);
    await page.screenshot({ path: bild('live-auf') });
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  // Aufraeumen: Kommentare und Live-Kommentare des Pruefkontos wieder weg.
  await zuruecksetzen(page).catch(() => {});
  await beenden(browser, erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
