// Prueft die Profil- und Einstellungspunkte aus Henriks Rueckmeldung vom
// 26.08.2026:
//
//   Punkt 20  Einstellungs-Unterpunkte oeffnen ihre eigene Seite,
//             Pfeil oben links fuehrt zurueck ins Profil
//   Punkt 36  Username im Videos-Profil mittig
//   Punkt 58  Username im Communitys-Profil mittig
//   Punkt 59  "Profil bearbeiten" auch im Communitys-Profil
//   Punkt 60  "Erstellt" und "Beigetreten" sind klickbar
//   Punkt 61  Der Link in der Beschreibung ist ein echter Link
//
// Start:  node test/_profil.js   (Server muss laufen)

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

  const zumProfil = async (bereich) => {
    await page.click(`[data-area="${bereich}"]`);
    await page.waitForTimeout(200);
    await page.click('[data-sub="profile"]');
    await page.waitForTimeout(500);
  };

  /* ------------------------------------------ Einstellungen aus dem Profil */
  console.log('\nEinstellungen aus dem Profil');

  await pruefe('Ein Unterpunkt oeffnet seine eigene Seite, nicht die lange Liste', async () => {
    await zumProfil('messenger');
    await page.click('[data-mact="story"]');
    await page.waitForTimeout(600);
    // Das Auswahl-Blatt des Punktes muss offen sein.
    const wahl = await page.$$eval('[data-wahl]', (n) => n.map((x) => x.dataset.wahl));
    if (!wahl.length) throw new Error('kein Auswahl-Blatt — man landet wieder in der Liste');
    if (!wahl.includes('Enge Freunde')) throw new Error('falscher Punkt: ' + wahl.join(' | '));
  });

  await pruefe('Der Pfeil oben links fuehrt zurueck ins Profil', async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
    const zurueck = await page.$('#settingsBack');
    if (!zurueck) throw new Error('kein Zurueck-Pfeil');
    await zurueck.click();
    await page.waitForTimeout(400);
    const aktiv = await page.$eval('.navbtn.is-active', (n) => n.dataset.area);
    const sub = await page.$eval('#topbar .is-active', (n) => n.dataset.sub);
    if (aktiv !== 'messenger' || sub !== 'profile') throw new Error(`landet bei ${aktiv}/${sub}`);
  });

  await pruefe('Die dicke Schrift fuehrt weiterhin in die Haupt-Einstellungen', async () => {
    await page.click('[data-mact="settings"]');
    await page.waitForTimeout(500);
    const abschnitte = await page.$$eval('.pill[data-jump]', (n) => n.length);
    if (abschnitte < 9) throw new Error('nur ' + abschnitte + ' Abschnitte');
    const blatt = await page.$('[data-wahl]');
    if (blatt) throw new Error('es geht trotzdem ein einzelner Punkt auf');
  });

  await pruefe('Ueber die untere Leiste geoeffnet gibt es keinen Zurueck-Pfeil', async () => {
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(200);
    await page.click('[data-area="settings"]');
    await page.waitForTimeout(400);
    if (await page.$('#settingsBack')) throw new Error('der Pfeil steht da, obwohl es kein Zurueck gibt');
  });

  /* -------------------------------------------------- Username mittig */
  console.log('\nEigene Profile');

  const mittigPruefen = async (bereich) => {
    await zumProfil(bereich);
    const { mitte, breite } = await page.evaluate(() => {
      const n = document.querySelector('.oprof__handle');
      const app = document.querySelector('.app');
      const k = n.getBoundingClientRect();
      const a = app.getBoundingClientRect();
      return { mitte: k.left + k.width / 2 - a.left, breite: a.width };
    });
    const abweichung = Math.abs(mitte - breite / 2);
    if (abweichung > 4) throw new Error(Math.round(abweichung) + 'px neben der Mitte');
  };

  await pruefe('Der Username im Videos-Profil steht mittig', () => mittigPruefen('videos'));
  await pruefe('Der Username im Communitys-Profil steht mittig', () => mittigPruefen('communities'));

  /* ------------------------------------------------ Communitys-Profil */
  console.log('\nCommunitys — Profil');

  await pruefe('Es gibt einen Knopf „Profil bearbeiten"', async () => {
    await zumProfil('communities');
    if (!(await page.$('#profilBearbeiten'))) throw new Error('kein Knopf');
  });

  await pruefe('Der Knopf oeffnet wirklich das Formular', async () => {
    await page.click('#profilBearbeiten');
    await page.waitForTimeout(500);
    const felder = await page.$$eval('.sheet input, .sheet textarea', (n) => n.length);
    if (!felder) throw new Error('kein Formular');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  await pruefe('Der Link in der Beschreibung ist ein echter Link', async () => {
    await zumProfil('communities');
    const href = await page.$eval('.prof__link', (n) => n.getAttribute('href'));
    if (!href || !href.startsWith('http')) throw new Error('href ist „' + href + '"');
  });

  for (const [ziel, titel] of [['erstellt', 'Erstellte'], ['beigetreten', 'Beigetretene']]) {
    await pruefe(`„${titel} Communitys" oeffnet eine eigene Seite`, async () => {
      await zumProfil('communities');
      const knopf = await page.$(`[data-commview="${ziel}"]`);
      if (!knopf) throw new Error('nicht klickbar');
      await knopf.click();
      await page.waitForTimeout(400);
      const kopf = await page.$eval('.pagehead__title', (n) => n.textContent);
      if (!kopf.includes(titel)) throw new Error('Kopf sagt „' + kopf + '"');
      await page.click('#commListeBack');
      await page.waitForTimeout(400);
      if (!(await page.$('#profilBearbeiten'))) throw new Error('der Pfeil fuehrt nicht zurueck ins Profil');
    });
  }

  await pruefe('Ein Bereichswechsel laesst die Seite nicht haengen', async () => {
    await zumProfil('communities');
    await page.click('[data-commview="erstellt"]');
    await page.waitForTimeout(300);
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(400);
    if (!(await page.$('#chatSearch'))) throw new Error('der Messenger geht nicht auf');
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
