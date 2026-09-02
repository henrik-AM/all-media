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
const { anmelden, zuruecksetzen } = require('./_konto');
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
  await zuruecksetzen(page);
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
  /*
   * Erst messen, wenn die Bilder da sind.
   *
   * Seit die Beitraege echte Vorschaubilder tragen, kommen die aus dem Netz.
   * Ein Bild, das mitten in der Messung ankommt, verschiebt die Reihe um ein
   * paar Pixel — und der Prueflauf meldete "30 Knoepfe sind gewandert",
   * obwohl am Aufbau nichts falsch war.
   */
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);

  await pruefe('Die Aktionsspalte bleibt beim Liken an ihrem Platz', async () => {
    const vorher = await kanten('.slide__rail .railbtn');
    await page.click('.slide__rail [data-vaction="like"]');
    // Die Leiste wird nach der Antwort des Servers neu gezeichnet. Wer
    // mittendrin misst, findet die alte Reihe und meldet eine Verschiebung,
    // die es nicht gibt.
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);
    const nachher = await kanten('.slide__rail .railbtn');
    if (vorher.length !== nachher.length) throw new Error('die Zahl der Knöpfe hat sich geändert');
    const verschoben = vorher.map((v, i) => Math.abs(v - nachher[i])).filter((d) => d > 1);
    if (verschoben.length) throw new Error(verschoben.length + ' Knöpfe sind gewandert');
  });

  await pruefe('Auch ein Repost verschiebt nichts', async () => {
    const vorher = await kanten('.slide__rail .railbtn');
    await page.click('.slide__rail [data-vaction="repost"]');
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);
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
    // Locator statt fester Verweis: die Kapitelliste wird beim Aufbau des
    // Spielers neu gezeichnet. Ein vorher geholter Verweis zeigte dann auf
    // ein Element, das nicht mehr im Dokument hing ("not attached to the DOM").
    const zeilen = page.locator('[data-kapitel]');
    const anzahl = await zeilen.count();
    if (anzahl < 3) throw new Error('nur ' + anzahl + ' Kapitel');
    await zeilen.nth(2).click();
    // Der Balken wird beim Klick gesetzt; 300 ms waren dafuer eine Wette.
    await page.waitForFunction(
      () => {
        const b = document.querySelector('#clipFortschritt');
        return !!b && b.style.width && b.style.width !== '0%';
      },
      null, { timeout: 10000 }
    ).catch(() => {});
    const zeit = await page.$eval('#clipZeit', (n) => n.textContent);
    if (zeit === '0:00') throw new Error('die Zeit steht weiter auf 0:00');
    const breite = await page.$eval('#clipFortschritt', (n) => n.style.width);
    if (!breite || breite === '0%') throw new Error('der Balken bewegt sich nicht');
  });

  await pruefe('Ein Video ohne Kapitel zeigt keine leere Überschrift', async () => {
    await page.click('#clipBack');
    await page.waitForTimeout(400);
    /*
     * Eines ohne Kapitel — aber MIT Untertiteln.
     *
     * Der Player bleibt danach offen, und die naechsten Pruefungen sehen sich
     * dessen Einstellungen an. Ein Video ohne Untertitel haette dort den
     * Punkt "Untertitel" gar nicht, und der Fehler stuende an der falschen
     * Stelle.
     */
    await page.click(await K.waehlerClip(page, 'Nachtfotografie am Hafen'));
    await page.waitForSelector('.player');
    /*
     * Auf das Verschwinden warten, nicht auf die Uhr. Der Player baut die
     * Kapitelliste beim Videowechsel neu auf; bis dahin steht noch die des
     * vorigen Videos da. Vierhundert Millisekunden trafen das im Einzellauf
     * und verfehlten es im vollen Durchgang.
     *
     * Bleibt die Überschrift auch nach acht Sekunden stehen, ist es kein
     * Timing mehr, sondern der Fehler, den diese Prüfung sucht.
     */
    await page
      .waitForFunction(() => !document.querySelector('.kapitel'), null, { timeout: 8000 })
      .catch(() => {});
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
    // Eines ohne Untertitel: das Test-Rundumvideo.
    await page.click(await K.waehlerClip(page, 'Test-Rundumvideo'));
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
