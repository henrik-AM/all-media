// Prueft das Teilen von Beitraegen und Videos.
//
// Prototyp-Frames "Nutzer B + Beitrag teilen" und "VQ + Video teilen": ein
// Blatt mit einem Raster aus Personen. Wen man antippt, der bekommt es in
// den Chat. Vorher gab der Knopf nur "Beitrag geteilt" aus.
//
// Start:  node test/_teilen.js   (Server muss laufen)

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
    await page.waitForSelector('[data-paction="share"]', { timeout: 10000 });
    await page.click('[data-paction="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });
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
    // "u1" war Annas feste Kennung in den Beispieldaten; jetzt steht sie in
    // der Datenbank. Siehe test/_kennungen.js.
    await page.click(`[data-teilen="${K.person('u1')}"]`);
    // Das Teilen geht in die Datenbank: Nachricht anlegen, Eintrag in
    // "shares". Eine feste Wartezeit reicht dafuer nicht.
    await page.waitForFunction(
      () => document.querySelectorAll('.teilen__kachel.is-gesendet').length === 1,
      null, { timeout: 10000 }
    ).catch(() => {});
    const fertig = await page.$$eval('.teilen__kachel.is-gesendet', (els) => els.length);
    if (fertig !== 1) throw new Error(fertig + ' Kacheln markiert');
  });

  await pruefe('Zweites Antippen sendet nicht noch einmal', async () => {
    await page.click(`[data-teilen="${K.person('u1')}"]`);
    await page.waitForTimeout(600);
    const fertig = await page.$$eval('.teilen__kachel.is-gesendet', (els) => els.length);
    if (fertig !== 1) throw new Error(fertig + ' Kacheln markiert');
    await page.click('[data-sheet-close]');
  });

  await pruefe('Der Beitrag liegt als Karte im Chat', async () => {
    await gehe('messenger', 'chats');
    await page.click(await K.waehlerChat(page, 'Anna Schmidt'));
    await page.waitForSelector('#messages', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(600);
    /*
     * Wer der Autor ist, haengt davon ab, welcher Beitrag im Feed oben steht —
     * und das steht jetzt in der Datenbank. Frueher war es immer Clara Weber
     * aus den Beispieldaten; heute kann es auch ein eigener Testbeitrag sein.
     * Geprueft wird deshalb, dass die Karte da ist und einen Autor traegt.
     */
    await page.waitForSelector('.msg__geteilt', { timeout: 10000 }).catch(() => {});
    const karten = await page.$$eval('.msg__geteilt', (els) =>
      els.map((e) => ({
        autor: e.querySelector('.msg__geteiltText strong')?.textContent?.trim() ?? '',
        text: e.textContent.replace(/\s+/g, ' ').trim(),
      }))
    );
    if (!karten.length) throw new Error('keine Karte im Chat');
    if (!karten[karten.length - 1].autor) throw new Error('Karte ohne Autor: ' + karten[karten.length - 1].text);
  });

  await pruefe('Die Chatliste zeigt "Beitrag geteilt" als Vorschau', async () => {
    /*
     * Zurueck aus dem Chat — aber nicht mit page.goBack().
     *
     * Die Oberflaeche ist eine einzige Seite; "zurueck" im Browser fuehrt
     * deshalb nicht zur Chatliste, sondern aus der App heraus auf
     * about:blank. Dort gibt es kein #main und keinen Server: die naechsten
     * drei Pruefungen scheiterten dann an "Failed to parse URL from
     * /api/bootstrap" und man suchte den Fehler an der falschen Stelle.
     */
    await page.click('#chatBack').catch(() => {});
    await page.waitForSelector('#chatSearch', { timeout: 10000 }).catch(() => {});
    const text = await page.$eval('#main', (e) => e.textContent);
    if (!text.includes('Beitrag geteilt')) throw new Error('Vorschau fehlt');
  });

  console.log('\nVideo teilen');

  await pruefe('Auch im Video-Feed oeffnet Teilen das Raster', async () => {
    await gehe('videos', 'portrait');
    await page.waitForSelector('[data-vaction="share"]', { timeout: 10000 });
    await page.click('[data-vaction="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });
    const titel = await page.$eval('.sheet__titel-mitte', (e) => e.textContent);
    if (titel !== 'Video teilen') throw new Error(titel);
  });

  await pruefe('Gesendetes Video zaehlt bei den Weiterleitungen mit', async () => {
    /*
     * Gezaehlt wird an dem Video, das gerade zu sehen ist — nicht an
     * videos[0]. Das ist zwar meistens dasselbe, aber "meistens" ist bei
     * einer Pruefung zu wenig.
     *
     * Und gewartet wird auf den neuen Stand, nicht auf die Uhr. Vorher stand
     * hier waitForTimeout(1200): das Teilen legt eine Nachricht im Chat an,
     * traegt die Weiterleitung ein und liest den Beitrag neu — auf einer
     * langsamen Verbindung dauert das laenger als 1,2 Sekunden. Dann meldete
     * dieser Schritt "0 -> 0", obwohl alles richtig lief, und weil
     * test:alles eine &&-Kette ist, liefen die vierzehn Pruefläufe danach
     * gar nicht mehr.
     */
    const vid = await page.getAttribute('[data-vaction="share"]', 'data-vid').catch(() => null);
    const zaehler = async () => {
      const boot = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()));
      const v = (boot.videos || []).find((x) => x.id === vid) || boot.videos[0];
      return v ? v.shares : null;
    };

    const vorher = await zaehler();
    await page.click(`[data-teilen="${K.person('u2')}"]`);

    let nachher = vorher;
    for (let i = 0; i < 20 && nachher !== vorher + 1; i++) {
      await page.waitForTimeout(500);
      nachher = await zaehler();
    }
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
