// Prueft das Drei-Punkte-Menue am Beitrag und den weggefallenen Tonknopf.
//
// Henrik am 21.09.2026: "Drei-Punkte-Menü: Link kopieren, herunterladen, zu
// Story hinzufügen, melden, kein Interesse ... Vorbild TikTok" und
// "Lautstärke-Button weg, Ton richtet sich nach der Lautstärke des Handys."
//
// "Kein Interesse" wird bis in die Datenbank verfolgt: nach dem Neuladen muss
// das Reel noch fehlen, nach dem Zuruecksetzen wieder da sein.
//
// Start:  node test/_optionen.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  await kontext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(ZIEL).origin });
  const page = await kontext.newPage();

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
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

  const zumHochformat = async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(300);
    await page.click('[data-sub="portrait"]');
    await page.waitForTimeout(600);
  };

  const punkte = () =>
    page.$$eval('[data-beitragopt] .item__label', (l) => l.map((e) => e.textContent.trim()));

  const toastText = async () => {
    await page.waitForTimeout(700);
    return page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | '));
  };

  // Das erste fremde Reel - an eigenen fehlen "Kein Interesse" und "Melden".
  const fremdesReel = () =>
    page.evaluate(() => {
      const v = state.videos.find((x) => !istEigen(x.userId) && document.getElementById('slide-' + x.id));
      return v ? v.id : null;
    });

  await zumHochformat();
  const reel = await fremdesReel();

  await pruefe('Kein Tonknopf mehr im Hochformat', async () => {
    if (await page.$('#tonKnopf, .tonknopf')) throw new Error('Tonknopf steht noch da');
  });

  await pruefe('Der Ton geht nach dem ersten Tippen an', async () => {
    await page.mouse.click(200, 400);
    await page.waitForTimeout(300);
    const stumm = await page.$$eval('.slide__stage video', (v) => v.filter((x) => x.muted).length);
    if (stumm) throw new Error(stumm + ' Videos noch stumm');
  });

  await pruefe('Fremdes Reel vorhanden', async () => {
    if (!reel) throw new Error('kein fremdes Reel im Feed');
  });

  await pruefe('"Mehr" am Reel zeigt die fuenf Punkte nach TikTok', async () => {
    await page.click(`[data-vaction="mehr"][data-vid="${reel}"]`);
    await page.waitForSelector('[data-beitragopt]', { timeout: 5000 });
    const l = await punkte();
    for (const soll of ['Link kopieren', 'Zu Story hinzufügen', 'Kein Interesse', 'Melden']) {
      if (!l.includes(soll)) throw new Error(`"${soll}" fehlt in ${JSON.stringify(l)}`);
    }
    if (l.some((x) => /whatsapp|snapchat/i.test(x))) throw new Error('fremder Messenger im Menue');
  });

  await pruefe('Link kopieren legt die Website-Adresse ab', async () => {
    await page.click('[data-beitragopt="link"]');
    await page.waitForTimeout(400);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    if (!text.endsWith('/?beitrag=' + reel)) throw new Error(text);
  });

  await pruefe('Der Link oeffnet das Reel', async () => {
    await page.goto(new URL('/?beitrag=' + reel, ZIEL).href, { waitUntil: 'load' });
    await page.waitForSelector('#slide-' + reel, { timeout: 8000 });
    await page.waitForTimeout(500);
    const oben = await page.$eval('#slide-' + reel, (e) => Math.abs(e.getBoundingClientRect().top) < 120);
    if (!oben) throw new Error('Reel steht nicht oben');
    if (new URL(page.url()).search) throw new Error('Parameter bleibt stehen: ' + page.url());
  });

  await pruefe('Zu Story hinzufuegen legt eine Story an', async () => {
    await page.click(`[data-vaction="mehr"][data-vid="${reel}"]`);
    await page.waitForSelector('[data-beitragopt="story"]');
    await page.click('[data-beitragopt="story"]');
    const t = await toastText();
    if (!t.includes('Zu deiner Story hinzugefügt')) throw new Error(t || 'keine Meldung');
  });

  await pruefe('Melden fragt nach dem Grund und kommt an', async () => {
    await page.click(`[data-vaction="mehr"][data-vid="${reel}"]`);
    await page.waitForSelector('[data-beitragopt="melden"]');
    await page.click('[data-beitragopt="melden"]');
    await page.waitForSelector('[data-grund="Spam oder Werbung"]');
    await page.click('[data-grund="Spam oder Werbung"]');
    const t = await toastText();
    if (!t.includes('Danke')) throw new Error(t || 'keine Meldung');
  });

  await pruefe('Kein Interesse nimmt das Reel sofort heraus', async () => {
    await page.click(`[data-vaction="mehr"][data-vid="${reel}"]`);
    await page.waitForSelector('[data-beitragopt="kein"]');
    await page.click('[data-beitragopt="kein"]');
    await page.waitForTimeout(800);
    if (await page.$('#slide-' + reel)) throw new Error('Reel steht noch da');
  });

  await pruefe('... und bleibt nach dem Neuladen weg (Datenbank)', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await zumHochformat();
    const drin = await page.evaluate((id) => state.keinInteresse.includes(id), reel);
    if (!drin) throw new Error('keinInteresse kam nicht aus der Datenbank');
    if (await page.$('#slide-' + reel)) throw new Error('Reel steht wieder im Feed');
  });

  await pruefe('Zuruecksetzen bringt es zurueck', async () => {
    await zuruecksetzen(page);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await zumHochformat();
    if (!(await page.$('#slide-' + reel))) throw new Error('Reel fehlt nach dem Zuruecksetzen');
  });

  await pruefe('Am eigenen Beitrag fehlen "Kein Interesse" und "Melden"', async () => {
    await page.click('[data-sub="home"]');
    await page.waitForTimeout(600);
    const eigener = await page.evaluate(() => state.posts.find((p) => istEigen(p.userId))?.id);
    if (!eigener) throw new Error('kein eigener Beitrag im Home-Feed');
    await page.click(`[data-paction="mehr"][data-pid="${eigener}"]`);
    await page.waitForSelector('[data-beitragopt]');
    const l = await punkte();
    if (l.includes('Kein Interesse') || l.includes('Melden')) throw new Error(JSON.stringify(l));
    if (!l.includes('Herunterladen')) throw new Error('eigenes Bild laesst sich nicht sichern: ' + JSON.stringify(l));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  await pruefe('Querformat-Player hat "Mehr"', async () => {
    const clip = await page.evaluate(() => state.clips[0]?.id);
    if (!clip) throw new Error('kein Querformat-Video');
    await page.evaluate((id) => openClip(id), clip);
    await page.waitForSelector('[data-clipact="mehr"]', { timeout: 5000 });
    await page.click('[data-clipact="mehr"]');
    await page.waitForSelector('[data-beitragopt="link"]');
  });

  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length ? 1 : 0);
})();
