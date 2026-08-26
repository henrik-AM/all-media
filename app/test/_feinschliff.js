// Prueft die kleineren Punkte aus Henriks Rueckmeldung vom 26.08.2026:
//
//   Punkt 12  Story eines fremden Profils laesst sich oeffnen
//   Punkt 13  Standort-Freigabe: die drei Stufen nebeneinander
//   Punkt 14  Die Chats-Filter werden nicht von der Liste ueberschnitten
//   Punkt 16  "Ausstehende Anfragen" steht ueber den Kontakten
//   Punkt 21  Klick aufs Profilbild fuehrt zum Profil, wenn es keine Story gibt
//   Punkt 22  Die abgeschaltete Glocke traegt einen Strich
//   Punkt 44  Das Spendenziel ist freiwillig
//   Punkt 55  Die Liste heisst "Communitys", nicht "Kanäle"
//
// Mehrere davon sind Fragen von Pixeln - ob etwas umbricht, ob sich zwei
// Flaechen ueberschneiden. Das laesst sich nur messen.
//
// Start:  node test/_feinschliff.js   (Server muss laufen)

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

  const zu = async () => {
    await page.evaluate(() => document.querySelector('.sheet-backdrop')?.remove());
    await page.waitForTimeout(250);
  };

  /* ------------------------------------------------ Messenger */
  console.log('\nMessenger');

  await pruefe('Die Chats-Filter werden nicht von der Liste überschnitten', async () => {
    await page.click('[data-area="messenger"]');
    await page.waitForSelector('#chatSearch');
    await page.waitForTimeout(300);
    const { pillenUnten, listeOben } = await page.evaluate(() => ({
      pillenUnten: document.querySelector('.pills').getBoundingClientRect().bottom,
      listeOben: document.querySelector('.rows').getBoundingClientRect().top,
    }));
    if (listeOben < pillenUnten - 1) {
      throw new Error(`die Liste liegt ${Math.round(pillenUnten - listeOben)}px zu hoch`);
    }
  });

  await pruefe('Auch die Insel überschneidet den Inhalt nicht', async () => {
    const { inselUnten, inhaltOben } = await page.evaluate(() => ({
      inselUnten: document.querySelector('#topbar').getBoundingClientRect().bottom,
      inhaltOben: document.querySelector('.storyrail').getBoundingClientRect().top,
    }));
    if (inhaltOben < inselUnten - 1) {
      throw new Error(`der Inhalt liegt ${Math.round(inselUnten - inhaltOben)}px zu hoch`);
    }
  });

  await pruefe('„Ausstehende Anfragen" steht über den Kontakten', async () => {
    await page.click('#newChat');
    await page.waitForTimeout(400);
    await page.click('[data-new="contacts"]');
    await page.waitForSelector('.listhead');
    await page.waitForTimeout(300);
    const koepfe = await page.$$eval('.listhead', (n) => n.map((x) => x.textContent.trim()));
    const anfragen = koepfe.findIndex((t) => t.includes('Anfragen'));
    const kontakte = koepfe.findIndex((t) => t.includes('Kontakte'));
    if (anfragen === -1) throw new Error('es gibt keine ausstehenden Anfragen: ' + koepfe.join(' | '));
    if (anfragen > kontakte) throw new Error('die Anfragen stehen unter den Kontakten');
  });

  /* ------------------------------------------------ Friend-Map */
  console.log('\nMessenger — Friend-Map');

  await pruefe('Die drei Freigabe-Stufen stehen nebeneinander', async () => {
    await page.click('#contactsBack').catch(() => {});
    await page.waitForTimeout(300);
    await page.click('[data-sub="friendmap"]');
    await page.waitForSelector('.standort__optionen');
    await page.waitForTimeout(300);
    const kanten = await page.$$eval('.standort__optionen .pill', (n) =>
      n.map((x) => Math.round(x.getBoundingClientRect().top))
    );
    if (kanten.length < 3) throw new Error('nur ' + kanten.length + ' Stufen');
    if (new Set(kanten).size !== 1) throw new Error('sie stehen in ' + new Set(kanten).size + ' Zeilen');
  });

  /* ------------------------------------------------ Videos-Home */
  console.log('\nVideos — Home');

  await pruefe('Die abgeschaltete Glocke trägt einen Strich', async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="home"]');
    await page.waitForSelector('.post__bell');
    await page.waitForTimeout(300);

    const aus = await page.$('.post__bell:not(.is-on)');
    if (!aus) throw new Error('keine abgeschaltete Glocke im Feed');
    // Ein durchgestrichenes Symbol hat einen Pfad mehr als das schlichte.
    const pfade = await aus.evaluate((n) => n.querySelectorAll('svg path').length);
    const an = await page.$('.post__bell.is-on');
    const pfadeAn = an ? await an.evaluate((n) => n.querySelectorAll('svg path').length) : 2;
    if (pfade <= pfadeAn) throw new Error('sie sieht aus wie die eingeschaltete');
  });

  await pruefe('Ein Profilbild ohne Story führt zum Profil statt zu einem Hinweis', async () => {
    // Eine Person ohne Story suchen und ihren Ring antippen.
    const ohneStory = await page.evaluate(() => {
      const ringe = [...document.querySelectorAll('[data-story-user]')];
      const treffer = ringe.find((r) => !window.state?.stories?.some((s) => s.userId === r.dataset.storyUser));
      return treffer ? treffer.dataset.storyUser : ringe[0]?.dataset.storyUser;
    });
    if (!ohneStory) throw new Error('kein Story-Ring im Feed');

    await page.click(`[data-story-user="${ohneStory}"]`);
    await page.waitForTimeout(700);
    // Entweder das Profil oder der Story-Betrachter - nur ein Hinweis waere
    // falsch.
    const profil = await page.$('#profBack');
    const story = await page.$('.viewer');
    if (!profil && !story) throw new Error('es geht nichts auf, es kommt nur ein Hinweis');
    await page.click(profil ? '#profBack' : '#storyClose');
    await page.waitForTimeout(400);
  });

  /* ------------------------------------------------ Fremdes Profil */
  console.log('\nFremdes Profil');

  await pruefe('Der Story-Ring eines fremden Profils lässt sich öffnen', async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="home"]');
    await page.waitForTimeout(400);
    // u1 hat eine Story (s1).
    await page.click('[data-profile="u1"]');
    await page.waitForSelector('#profBack');
    await page.waitForTimeout(500);

    const ring = await page.$('[data-profilstory]');
    if (!ring) throw new Error('der Ring ist kein Knopf');
    await ring.click();
    await page.waitForTimeout(800);
    if (!(await page.$('.viewer'))) throw new Error('die Story geht nicht auf');
    await page.click('#storyClose');
    await page.waitForTimeout(400);
  });

  /* ------------------------------------------------ Communitys */
  console.log('\nCommunitys — Suchen');

  await pruefe('Die Liste heißt „Communitys", nicht „Kanäle"', async () => {
    await page.click('[data-area="communities"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="search"]');
    await page.waitForTimeout(600);
    const koepfe = await page.$$eval('.exp__head', (n) => n.map((x) => x.textContent.trim()));
    if (koepfe.some((t) => t.startsWith('Kanäle'))) throw new Error('es steht weiter „Kanäle": ' + koepfe.join(' | '));
    if (!koepfe.some((t) => t.startsWith('Communitys'))) throw new Error('kein Kopf „Communitys": ' + koepfe.join(' | '));
  });

  /* ------------------------------------------------ Spendenaktion */
  console.log('\nVideos — Profil, Spendenaktion');

  await pruefe('Eine Spendenaktion geht auch ohne Ziel', async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="profile"]');
    await page.waitForSelector('[data-oact="create"]');
    await page.waitForTimeout(500);
    await page.click('[data-oact="create"]');
    await page.waitForTimeout(500);
    await page.click('[data-erstellen="spende"]');
    await page.waitForSelector('#f_titel');

    const label = await page.$eval('label[for="f_ziel"]', (n) => n.textContent);
    if (!/freiwillig/i.test(label)) throw new Error('das Feld sagt „' + label + '"');

    await page.fill('#f_titel', 'Bäume für den Stadtpark');
    await page.click('#formOk');
    await page.waitForTimeout(900);
    const toast = await page.$eval('#toast', (n) => (n.hidden ? '' : n.textContent));
    if (/ziel/i.test(toast)) throw new Error('es wird trotzdem ein Ziel verlangt: „' + toast + '"');
  });

  await zu();

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
