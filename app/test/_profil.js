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
const { anmelden } = require('./_konto');

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

  await pruefe('Auch das Messenger-Profil hat „Profil bearbeiten"', async () => {
    await zumProfil('messenger');
    if (!(await page.$('#profilBearbeiten'))) throw new Error('kein Knopf');
    await page.click('#profilBearbeiten');
    await page.waitForTimeout(500);
    const felder = await page.$$eval('.sheet input, .sheet textarea', (n) => n.length);
    if (!felder) throw new Error('das Formular geht nicht auf');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  /* --------------------------------------------- Story-Ring am Profil */
  console.log('\nStory-Ring am eigenen Profil');

  await pruefe('Ohne eigene Story ist kein Ring da', async () => {
    await page.evaluate(() => localStorage.removeItem('allmedia.eigeneStory'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#topbar button');
    await zumProfil('videos');
    if (await page.$('[data-eigene-story]')) throw new Error('der Ring steht ohne Story da');
  });

  await pruefe('Mit eigener Story steht der Ring am Profilbild', async () => {
    await page.evaluate(() =>
      localStorage.setItem(
        'allmedia.eigeneStory',
        JSON.stringify({ mediaUri: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=', aufgenommen: Date.now() })
      )
    );
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#topbar button');
    await zumProfil('videos');
    if (!(await page.$('[data-eigene-story]'))) throw new Error('kein Ring');
  });

  await pruefe('Der Ring steht auch im Communitys-Profil', async () => {
    await zumProfil('communities');
    if (!(await page.$('[data-eigene-story]'))) throw new Error('kein Ring');
  });

  await pruefe('Ein Klick auf den Ring oeffnet die Story', async () => {
    await zumProfil('videos');
    await page.click('[data-eigene-story]');
    await page.waitForTimeout(700);
    if (!(await page.$('.viewer, .story-viewer, #storyClose'))) {
      throw new Error('der Betrachter geht nicht auf');
    }
    // Wieder zumachen - sonst liegt er ueber allem, was danach geprueft wird.
    await page.evaluate(() => document.querySelector('#overlay')?.setAttribute('hidden', ''));
    await page.waitForTimeout(300);
  });

  /* ------------------------------------- Playlists und Highlights */
  console.log('\nPlaylists und Highlights');

  const ringe = async () =>
    page.$$eval('.highlight__ring', (n) =>
      n.map((x) => {
        const s = getComputedStyle(x);
        return {
          art: x.classList.contains('is-playlist') ? 'playlist' : 'highlight',
          radius: parseFloat(s.borderTopLeftRadius),
          grund: s.backgroundImage,
        };
      })
    );

  await pruefe('Playlist und Highlight sehen unterschiedlich aus', async () => {
    await zumProfil('videos');
    const alle = await ringe();
    const pl = alle.filter((r) => r.art === 'playlist');
    const hl = alle.filter((r) => r.art === 'highlight');
    if (!pl.length || !hl.length) throw new Error('es gibt nicht von beidem etwas');
    // Form: das Highlight ist ein Kreis, die Playlist nicht.
    if (pl[0].radius >= 30) throw new Error('die Playlist ist auch ein Kreis');
    if (hl[0].radius < 30) throw new Error('das Highlight ist kein Kreis');
    // Grund: zwei verschiedene Verlaeufe.
    if (pl[0].grund === hl[0].grund) throw new Error('beide tragen denselben Verlauf');
  });

  await pruefe('Zwei Playlists sind voneinander zu unterscheiden', async () => {
    const bilder = await page.$$eval('.highlight__ring.is-playlist .motiv', (n) =>
      n.map((x) => getComputedStyle(x).backgroundImage)
    );
    if (bilder.length < 2) throw new Error('nur ' + bilder.length + ' Playlist');
    if (new Set(bilder).size !== bilder.length) throw new Error('gleiches Motiv');
  });

  await pruefe('Eine Playlist laesst sich oeffnen und wieder schliessen', async () => {
    await page.click('.highlight[data-sammlung="playlist"]');
    await page.waitForTimeout(400);
    const unter = await page.$eval('.pagehead__sub', (n) => n.textContent);
    if (!unter.startsWith('Playlist')) throw new Error('Kopf sagt „' + unter + '"');
    await page.click('#sammlungBack');
    await page.waitForTimeout(500);
    if (!(await page.$('#profilBearbeiten'))) throw new Error('der Pfeil fuehrt nicht zurueck');
  });

  await pruefe('Auf einem fremden Profil sind Highlights klickbar', async () => {
    await page.click('[data-area="videos"]');
    await page.click('[data-sub="home"]');
    await page.waitForTimeout(500);
    await page.click('[data-profile="u1"]');
    await page.waitForTimeout(600);
    const knopf = await page.$('.highlight[data-sammlung]');
    if (!knopf) throw new Error('die Highlights sind keine Knoepfe');
    await knopf.click();
    await page.waitForTimeout(500);
    const unter = await page.$eval('.pagehead__sub', (n) => n.textContent);
    if (!unter.startsWith('Highlight')) throw new Error('Kopf sagt „' + unter + '"');
  });

  await pruefe('Der Link auf einem fremden Profil ist ein echter Link', async () => {
    await page.click('[data-area="videos"]');
    await page.click('[data-sub="home"]');
    await page.waitForTimeout(500);
    await page.click('[data-profile="u1"]');
    await page.waitForTimeout(600);
    const href = await page.$eval('.prof__link', (n) => n.getAttribute('href'));
    if (!href || !href.startsWith('http')) throw new Error('href ist „' + href + '"');
    await page.click('#profBack');
    await page.waitForTimeout(300);
  });

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
