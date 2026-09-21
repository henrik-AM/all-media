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
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

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

  /*
   * Zum eigenen Profil — und warten, bis es wirklich dasteht.
   *
   * Das Profil holt seine Zahlen aus der Datenbank. 500 ms reichten dafuer
   * nicht: der Prueflauf griff auf .oprof__handle zu, das es noch gar nicht
   * gab, und meldete "Cannot read properties of null".
   */
  const zumProfil = async (bereich) => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await page.click(`[data-area="${bereich}"]`);
    await page.waitForTimeout(250);
    await page.click('[data-sub="profile"]');
    await page.waitForSelector('.oprof__handle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(400);
  };

  /*
   * Zu einem fremden Profil — ueber einen Beitrag im Feed.
   *
   * Vorher standen die beiden Fremdprofil-Pruefungen mit festen Wartewerten
   * da und ohne aufzuraeumen. Blieb vorher ein Blatt offen, landete der Klick
   * nicht im Feed, und die Meldung ("die Highlights sind keine Knoepfe")
   * zeigte auf etwas, das gar nicht der Fehler war.
   */
  const zumFremdprofil = async (userId) => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(250);
    await page.click('[data-sub="home"]');
    await page.waitForSelector(`[data-profile="${userId}"]`, { timeout: 10000 });
    await page.click(`[data-profile="${userId}"]`);
    await page.waitForSelector('.prof__name, .prof__link, .highlight', { timeout: 10000 });
    await page.waitForTimeout(300);
  };

  /* ------------------------------------------ Einstellungen aus dem Profil */
  console.log('\nEinstellungen aus dem Profil');

  await pruefe('Ein Unterpunkt oeffnet seine eigene Seite, nicht die lange Liste', async () => {
    await zumProfil('messenger');
    await page.click('[data-mact="story"]');
    await page.waitForTimeout(600);
    /*
     * Das Auswahl-Blatt des Punktes muss offen sein. Die Story-Sichtbarkeit
     * ist seit dem Handbuch-Abgleich am 01.09.2026 kein Dreier-Wahlblatt
     * mehr ("Alle / Meine Kontakte / Enge Freunde"), sondern die vier Stufen
     * des Handbuchs — deshalb steht hier data-stufe und nicht data-wahl.
     */
    const stufen = await page.$$eval('[data-stufe]', (n) => n.map((x) => x.dataset.stufe));
    if (!stufen.length) throw new Error('kein Auswahl-Blatt — man landet wieder in der Liste');
    const soll = ['niemand', 'niemand_bis_auf', 'alle_bis_auf', 'alle'];
    if (JSON.stringify(stufen) !== JSON.stringify(soll)) {
      throw new Error('falscher Punkt: ' + stufen.join(' | '));
    }
  });

  await pruefe('Der Pfeil oben links fuehrt zurueck ins Profil', async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    /*
     * Ueber den Waehler klicken, nicht ueber einen vorher geholten Knoten.
     *
     * Am 21.09.2026 kippte die Pruefung im Gesamtlauf mit „Element is not
     * attached to the DOM": zwischen dem `$('#settingsBack')` und dem Klick
     * zeichnet die Seite ihre Kopfzeile neu, und der Knoten in der Hand ist
     * dann ein anderer als der auf dem Bildschirm. `page.click` sucht ihn
     * beim Klicken erneut. Einzeln lief derselbe Lauf gruen — der Unterschied
     * war nur, wie viel sonst gerade lief.
     */
    await page.waitForSelector('#settingsBack', { timeout: 10000 });
    await page.click('#settingsBack');
    // Auf das Ziel warten statt auf die Uhr: die 400 ms waren eine Wette.
    await page
      .waitForFunction(
        () => document.querySelector('.navbtn.is-active')?.dataset.area === 'messenger',
        null, { timeout: 10000 }
      )
      .catch(() => {});
    const aktiv = await page.$eval('.navbtn.is-active', (n) => n.dataset.area);
    const sub = await page.$eval('#topbar .is-active', (n) => n.dataset.sub);
    if (aktiv !== 'messenger' || sub !== 'profile') throw new Error(`landet bei ${aktiv}/${sub}`);
  });

  await pruefe('Die dicke Schrift fuehrt weiterhin in die Haupt-Einstellungen', async () => {
    await page.click('[data-mact="settings"]');
    // Dieselbe Stelle, derselbe Grund: gewartet wird, bis die Abschnitte da
    // sind, nicht eine halbe Sekunde ins Blaue.
    await page
      .waitForFunction(() => document.querySelectorAll('.pill[data-jump]').length >= 9, null, {
        timeout: 10000,
      })
      .catch(() => {});
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

  /*
   * Die eigene Story kommt seit dem 09.09.2026 aus `state.stories`, also vom
   * Server. Vorher stand sie im Browserspeicher unter
   * `allmedia.eigeneStory` — und genau den hat diese Pruefung bis heute
   * geleert. Das hatte laengst keine Wirkung mehr: der Ring stand zu Recht
   * da, weil im Pruefbestand eine echte Story liegt, und die beiden
   * folgenden Pruefungen waren nur zufaellig gruen.
   *
   * Deshalb jetzt an der Quelle, die der Code wirklich liest. Ein Neuladen
   * darf es dabei nicht geben — das holt die Storys sofort wieder.
   */
  const storysSetzen = (eigene) =>
    page.evaluate((eigene) => {
      const fremde = (state.stories || []).filter((s) => !s.own);
      state.stories = eigene
        ? [{ own: true, mediaUri: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' }, ...fremde]
        : fremde;
      render();
    }, eigene);

  /*
   * Auf den Ring warten, nicht auf die Uhr.
   *
   * `renderVideoProfile` ist async und holt erst `/api/profile/me` und je nach
   * Reiter noch Reposts und Markierungen, bevor es schreibt. Bis zum
   * 10.09.2026 stand hier ein festes `waitForTimeout(300)` — gemessen dauert
   * es 500 bis 800 ms, und die Pruefung las verlaesslich das alte Bild.
   */
  const ringWarten = (soll) =>
    page.waitForFunction(
      (soll) => Boolean(document.querySelector('[data-eigene-story]')) === soll,
      soll,
      { timeout: 10000 }
    );

  await pruefe('Ohne eigene Story ist kein Ring da', async () => {
    await zumProfil('videos');
    await storysSetzen(false);
    await ringWarten(false).catch(() => {
      throw new Error('der Ring steht ohne Story da');
    });
  });

  await pruefe('Mit eigener Story steht der Ring am Profilbild', async () => {
    await storysSetzen(true);
    await ringWarten(true).catch(() => {
      throw new Error('kein Ring');
    });
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

  /*
   * Diese Pruefung hiess bis zum 20.09.2026 „Zwei Playlists sind voneinander
   * zu unterscheiden" und verlangte von JEDER Playlist ein eigenes Motiv. Sie
   * war gruen — weil die Website sich die Bilder ausgedacht hat:
   *
   *   const bild = i % 2 === name.length % 2 ? …
   *
   * Ein Name entschied ueber das Bild, nicht der Inhalt. Seit die Kreise ihr
   * echtes Titelbild tragen (SCHEMA_46), sehen zwei LEERE Playlists gleich
   * aus, und das ist richtig: es gibt nichts, wovon ein Bild das Bild waere.
   * Gefragt ist also nicht „alle verschieden", sondern der Unterschied, den
   * es wirklich gibt — gefuellt traegt ein Bild, leer nicht.
   */
  await pruefe('Eine gefuellte Playlist traegt ihr Titelbild, eine leere nicht', async () => {
    // Ein gefuellter Kreis traegt ein <img class="eigenbild"> mit dem
    // unterschriebenen Titelbild, ein leerer nur die Farbflaeche .motiv.
    const kreise = await page.$$eval('.highlight[data-sammlung="playlist"]', (n) =>
      n.map((x) => ({
        name: x.querySelector('.highlight__label')?.textContent?.trim() || '',
        bild: x.querySelector('.highlight__ring img.eigenbild')?.getAttribute('src') || '',
      }))
    );
    if (kreise.length < 2) throw new Error('nur ' + kreise.length + ' Playlist');

    // Der Testbestand fuellt „Später ansehen" und laesst „Zum Prüfen" leer
    // (SUPABASE_SCHEMA_47_sammlungen_testbestand.sql). Herum liegt es so,
    // weil andere Laeufe selbst etwas in „Zum Prüfen" legen.
    const voll = kreise.find((k) => k.name === 'Später ansehen');
    const leer = kreise.find((k) => k.name === 'Zum Prüfen');
    if (!voll || !leer) {
      throw new Error('Testbestand fehlt, gefunden: ' + kreise.map((k) => k.name).join(', '));
    }
    if (!voll.bild) throw new Error('„Später ansehen" hat kein Titelbild');
    if (!/token=/.test(voll.bild)) throw new Error('das Titelbild ist nicht unterschrieben: ' + voll.bild);
    if (leer.bild) throw new Error('„Zum Prüfen" ist leer und zeigt trotzdem ein Bild');
  });

  await pruefe('Eine Playlist laesst sich oeffnen und wieder schliessen', async () => {
    await page.click('.highlight[data-sammlung="playlist"]');
    await page.waitForSelector('.pagehead__sub', { timeout: 10000 });
    const unter = await page.$eval('.pagehead__sub', (n) => n.textContent);
    if (!unter.startsWith('Playlist')) throw new Error('Kopf sagt „' + unter + '"');
    await page.click('#sammlungBack');
    // Das eigene Profil holt seine Zahlen aus der Datenbank, bevor es steht.
    // 500 ms waren dafuer eine Wette.
    await page.waitForSelector('#profilBearbeiten', { timeout: 10000 }).catch(() => {});
    if (!(await page.$('#profilBearbeiten'))) throw new Error('der Pfeil fuehrt nicht zurueck');
  });

  await pruefe('Auf einem fremden Profil sind Highlights klickbar', async () => {
    await zumFremdprofil(K.person('u1'));
    const knopf = await page.$('.highlight[data-sammlung]');
    if (!knopf) throw new Error('die Highlights sind keine Knoepfe');
    await knopf.click();
    await page.waitForTimeout(500);
    const unter = await page.$eval('.pagehead__sub', (n) => n.textContent);
    if (!unter.startsWith('Highlight')) throw new Error('Kopf sagt „' + unter + '"');
  });

  await pruefe('Der Link auf einem fremden Profil ist ein echter Link', async () => {
    await zumFremdprofil(K.person('u1'));
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

  await beenden(browser, erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
