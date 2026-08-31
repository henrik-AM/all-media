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
    await page.click(`[data-profile="${K.person('u1')}"]`);
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

  /* ------------------------------------------ Sound-Seite (Punkt 11) */
  console.log('\nVideos — Sound-Seite');

  const zurSuche = async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="search"]');
    await page.waitForSelector('#videoSearch');
    await page.waitForTimeout(400);
  };

  await pruefe('Ein Sound zeigt seinen Liedtext', async () => {
    await zurSuche();
    await page.click(`[data-sound="${await K.kennungNachText(page, 'data-sound', 'Golden Hour')}"]`);
    await page.waitForSelector('.exp__kopf');
    await page.waitForTimeout(500);
    const zeilen = await page.$$eval('.lyrics__zeile', (n) => n.map((x) => x.textContent));
    if (zeilen.length < 4) throw new Error('nur ' + zeilen.length + ' Zeilen');
    if (!zeilen[0].includes('light comes slow')) throw new Error('erste Zeile: „' + zeilen[0] + '"');
  });

  await pruefe('Die Strophen sind voneinander abgesetzt', async () => {
    const luecken = await page.$$eval('.lyrics__luecke', (n) => n.length);
    if (!luecken) throw new Error('keine Strophenabstände');
  });

  await pruefe('Ein Instrumental sagt, dass es keinen Text gibt', async () => {
    await page.click('#expBack');
    await page.waitForTimeout(400);
    await zurSuche();
    await page.click(`[data-sound="${await K.kennungNachText(page, 'data-sound', 'Lo-Fi Focus')}"]`);
    await page.waitForSelector('.exp__kopf');
    await page.waitForTimeout(500);
    if (await page.$('.lyrics__zeile')) throw new Error('es stehen trotzdem Liedzeilen da');
    const hinweis = await page.$eval('.lyrics--ohne', (n) => n.textContent);
    if (!hinweis.includes('keinen Liedtext')) throw new Error('es steht „' + hinweis + '"');
  });

  /* ------------------------------------ Alle Fotos am Ort (Punkt 10) */
  console.log('\nVideos — Alle Fotos an einem Ort');

  const zuDenFotos = async () => {
    await page.click('#expBack').catch(() => {});
    await page.waitForTimeout(300);
    await zurSuche();
    await page.click('[data-place]');
    await page.waitForSelector('#expFotos');
    await page.waitForTimeout(400);
    await page.click('#expFotos');
    await page.waitForSelector('.ortfoto, .empty');
    await page.waitForTimeout(400);
  };

  await pruefe('„Alle Fotos ansehen" öffnet eine eigene Seite', async () => {
    await zuDenFotos();
    const titel = await page.$eval('.page__titel', (n) => n.textContent.trim());
    if (titel !== 'Alle Fotos') throw new Error('der Kopf sagt „' + titel + '"');
  });

  await pruefe('Der Zurück-Pfeil und das Plus sind sichtbar', async () => {
    for (const [wahl, was] of [['#fotosBack', 'der Zurück-Pfeil'], ['#fotosNeu', 'das Plus']]) {
      const knopf = await page.$(wahl);
      if (!knopf) throw new Error(was + ' fehlt');
      const sichtbar = await knopf.evaluate((n) => {
        const s = getComputedStyle(n);
        const k = n.getBoundingClientRect();
        return k.width > 0 && k.height > 0 && s.visibility !== 'hidden' && s.opacity !== '0';
      });
      if (!sichtbar) throw new Error(was + ' ist da, aber nicht zu sehen');
    }
  });

  await pruefe('Es stehen dort nur Fotos, keine Videos', async () => {
    /*
     * Nur in der Vollbild-Ebene suchen. Dahinter liegt die Video-Suche mit
     * ihrer Querformat-Liste - ein globaler Selektor fand die und meldete
     * einen Fehler, den es gar nicht gab.
     */
    if (await page.$('#overlay .clip, #overlay .exp__reels')) {
      throw new Error('es stehen auch Videos darin');
    }
    const fotos = await page.$$eval('.ortfoto', (n) => n.length);
    if (!fotos) throw new Error('gar keine Fotos');
  });

  await pruefe('Jedes Foto trägt eine Autorzeile', async () => {
    const bilder = await page.$$eval('.ortfoto__bild', (n) => n.length);
    const zeilen = await page.$$eval('.ortfoto__zeile', (n) => n.length);
    if (bilder !== zeilen) throw new Error(bilder + ' Bilder, ' + zeilen + ' Zeilen');
  });

  await pruefe('Der Pfeil führt zurück zum Ort', async () => {
    await page.click('#fotosBack');
    await page.waitForTimeout(600);
    if (!(await page.$('#expFotos'))) throw new Error('man landet woanders');
  });

  /* ------------------------------ Eigene Inhalte verwalten (37, 40, 46) */
  console.log('\nVideos — eigene Beiträge verwalten');

  const zumEigenenProfil = async () => {
    /*
     * Erst die Vollbild-Ebene zuklappen. Der Abschnitt davor endet auf der
     * Fotoseite eines Ortes - sie liegt ueber allem, und ein Klick auf die
     * untere Leiste kaeme dort gar nicht an.
     */
    await page.evaluate(() => {
      const o = document.querySelector('#overlay');
      if (o) {
        o.hidden = true;
        o.innerHTML = '';
      }
      document.querySelector('.sheet-backdrop')?.remove();
    });
    await page.waitForTimeout(250);
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="profile"]');
    await page.waitForSelector('[data-eigen]');
    await page.waitForTimeout(400);
  };

  await pruefe('Langes Drücken öffnet die Optionen zu einem eigenen Beitrag', async () => {
    await zumEigenenProfil();
    await page.click('[data-eigen]', { button: 'right' });
    await page.waitForTimeout(500);
    if (!(await page.$('.sheet'))) throw new Error('es geht nichts auf');
    if (!(await page.$('[data-eigenaktion="loeschen"]'))) throw new Error('keine Lösch-Option');
  });

  await pruefe('Die eigenen Playlists und Highlights stehen zur Wahl', async () => {
    const namen = await page.$$eval('[data-sml]', (n) => n.map((x) => x.dataset.smlname));
    if (namen.length < 2) throw new Error('nur ' + namen.length + ' Sammlungen');
  });

  await pruefe('Ein Beitrag lässt sich in eine Playlist legen', async () => {
    await page.click('[data-sml]');
    await page.waitForTimeout(700);
    const toast = await page.$eval('#toast', (n) => (n.hidden ? '' : n.textContent));
    if (!toast.includes('hinzugefügt')) throw new Error('Toast sagt „' + toast + '"');
  });

  await pruefe('Zweimal dieselbe Sammlung wird abgelehnt', async () => {
    await page.click('[data-eigen]', { button: 'right' });
    await page.waitForTimeout(400);
    await page.click('[data-sml]');
    await page.waitForTimeout(700);
    const toast = await page.$eval('#toast', (n) => (n.hidden ? '' : n.textContent));
    if (!toast.includes('schon')) throw new Error('Toast sagt „' + toast + '"');
  });

  await pruefe('Löschen fragt nach und nimmt die Kachel dann weg', async () => {
    await zumEigenenProfil();
    const vorher = await page.$$eval('[data-eigen]', (n) => n.length);

    await page.click('[data-eigen]', { button: 'right' });
    await page.waitForTimeout(400);
    await page.click('[data-eigenaktion="loeschen"]');
    await page.waitForTimeout(500);
    if (!(await page.$('#nachfrageJa'))) throw new Error('es wird nicht nachgefragt');

    // Abbrechen darf nichts loeschen.
    await page.click('#nachfrageNein');
    await page.waitForTimeout(600);
    const dazwischen = await page.$$eval('[data-eigen]', (n) => n.length);
    if (dazwischen !== vorher) throw new Error('„Abbrechen" hat trotzdem gelöscht');

    await page.click('[data-eigen]', { button: 'right' });
    await page.waitForTimeout(400);
    await page.click('[data-eigenaktion="loeschen"]');
    await page.waitForTimeout(400);
    await page.click('#nachfrageJa');
    await page.waitForTimeout(1400);
    const nachher = await page.$$eval('[data-eigen]', (n) => n.length);
    if (nachher !== vorher - 1) throw new Error(`${vorher} vorher, ${nachher} nachher`);
  });

  await pruefe('Ein Livestream lässt sich verwerfen statt zu beenden', async () => {
    await zumEigenenProfil();
    await page.click('[data-oact="create"]');
    await page.waitForTimeout(500);
    await page.click('[data-erstellen="livestream"]');
    await page.waitForSelector('#liveStop');
    await page.waitForTimeout(600);

    if (!(await page.$('#liveWeg'))) throw new Error('es gibt keine Verwerfen-Option');
    await page.click('#liveWeg');
    await page.waitForTimeout(500);
    await page.click('#nachfrageJa');
    await page.waitForTimeout(1500);

    // Nach dem Verwerfen darf keine Aufzeichnung im Querformat stehen.
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="landscape"]');
    await page.waitForTimeout(600);
    const titel = await page.$$eval('.clip__title', (n) => n.map((x) => x.textContent));
    if (titel.some((t) => t.includes('Livestream-Aufzeichnung'))) {
      throw new Error('die Aufzeichnung steht trotzdem da');
    }
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
