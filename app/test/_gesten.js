// Prueft die Wisch- und Kommentar-Punkte aus Henriks Rueckmeldung vom
// 26.08.2026:
//
//   Punkt 5   Story-Betrachter durch Wischen nach unten beenden
//   Punkt 23  Kommentar-Blatt durch Ziehen nach unten schliessen
//   Punkt 24  Anzahl der Likes unter einem Kommentar
//   Punkt 25  Angezeigte Kommentarzahl stimmt mit der echten ueberein
//
// Gesten lassen sich nicht klicken. Playwright kann Beruehrungen aber
// nachstellen - genau das macht `wischen` weiter unten.
//
// Start:  node test/_gesten.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

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

  /**
   * Eine Wischgeste nach unten auf einem Element nachstellen.
   * `weit` ist der Weg in Pixeln, `schritte` wie fein er zerlegt wird -
   * ein einzelner Sprung liest sich fuer den Browser nicht als Zug.
   */
  const wischen = async (wahl, weit, { schritte = 8, dauer = 400 } = {}) => {
    /*
     * Angefasst wird bei einem Viertel der Hoehe. Nicht ganz oben: dort
     * liegen der Schliessen-Pfeil des Story-Betrachters und der Griff des
     * Blattes - ein Beruehren dort haette den Betrachter beendet, noch bevor
     * die Geste ueberhaupt losging. Genau das ist beim ersten Anlauf
     * passiert und sah aus wie ein zu empfindliches Wischen.
     */
    const kasten = await page.$eval(wahl, (n) => {
      const k = n.getBoundingClientRect();
      return { x: k.left + k.width / 2, y: k.top + k.height * 0.25 };
    });
    await page.evaluate(
      ([w, x, y, weite, n, ms]) => {
        const el = document.querySelector(w);
        // TouchEvent verlangt echte Touch-Objekte - schlichte {clientY: …}
        // lehnt der Browser ab.
        const punkt = (klientY) =>
          new Touch({ identifier: 1, target: el, clientX: x, clientY: klientY });
        const werfen = (art, klientY) =>
          el.dispatchEvent(
            new TouchEvent(art, {
              touches: art === 'touchend' ? [] : [punkt(klientY)],
              changedTouches: [punkt(klientY)],
              bubbles: true,
              cancelable: true,
            })
          );

        werfen('touchstart', y);
        return new Promise((fertig) => {
          let i = 0;
          const takt = setInterval(() => {
            i++;
            werfen('touchmove', y + (weite / n) * i);
            if (i >= n) {
              clearInterval(takt);
              werfen('touchend', y + weite);
              fertig();
            }
          }, ms / n);
        });
      },
      [wahl, kasten.x, kasten.y, weit, schritte, dauer]
    );
    await page.waitForTimeout(500);
  };

  /* --------------------------------------------------- Kommentare */
  console.log('\nKommentare');

  const zumFeed = async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="home"]');
    await page.waitForSelector('.postlist');
    await page.waitForTimeout(300);
  };

  await zumFeed();

  /*
   * Der Beitrag, an dem dieser Abschnitt hängt.
   *
   * "p1" war seine feste Kennung in den Beispieldaten; jetzt bekommt er sie
   * beim Anlegen in der Datenbank. Einmal oben geholt, damit alle Prüfungen
   * darunter denselben meinen.
   *
   * Und ausdrücklich der Hafen-Beitrag, nicht einfach der erste im Feed: der
   * ist seit dem 01.09.2026 der eigene Testbeitrag, und der hat noch keine
   * Kommentare. Ohne Kommentare gibt es hier nichts zu zählen.
   */
  const ersterPost = await K.beitrag(page, 'Hafen um sechs');

  await pruefe('Die angezeigte Kommentarzahl stimmt mit der echten überein', async () => {
    const amBeitrag = await page.$eval(`.post__comments[data-pid="${ersterPost}"]`, (n) =>
      (n.textContent.match(/\d+/) || ['0'])[0]
    );
    const echt = await page.evaluate(
      async (id) => (await (await fetch(`/api/comments/${id}`)).json()).length,
      ersterPost
    );
    if (Number(amBeitrag) !== echt) throw new Error(`am Beitrag ${amBeitrag}, wirklich ${echt}`);
  });

  await pruefe('Unter jedem Kommentar steht die Zahl seiner Likes', async () => {
    await page.click(`.post__comments[data-pid="${ersterPost}"]`);
    await page.waitForSelector('.comment');
    await page.waitForTimeout(400);
    const felder = await page.$$eval('.comment__likes', (n) => n.length);
    const zeilen = await page.$$eval('.comment', (n) => n.length);
    if (felder !== zeilen) throw new Error(felder + ' Zahlen bei ' + zeilen + ' Kommentaren');
  });

  await pruefe('Ein Like erhöht die Zahl sofort', async () => {
    const vorher = await page.$eval('.comment .comment__likes', (n) => Number(n.textContent) || 0);
    await page.click('.comment .comment__like');
    await page.waitForTimeout(700);
    const nachher = await page.$eval('.comment .comment__likes', (n) => Number(n.textContent) || 0);
    if (nachher !== vorher + 1) throw new Error(`${vorher} vorher, ${nachher} nachher`);
  });

  await pruefe('Ein neuer Kommentar zieht die Zahl am Beitrag mit', async () => {
    await page.fill('#commentInput', 'Sehr schön geworden');
    await page.click('#commentSend');
    await page.waitForTimeout(800);
    const inListe = await page.$$eval('.comment', (n) => n.length);
    const imTitel = await page.$eval('.sheet__title', (n) => Number((n.textContent.match(/\d+/) || ['0'])[0]));
    if (inListe !== imTitel) throw new Error(`${inListe} Zeilen, Titel sagt ${imTitel}`);

    await page.evaluate(() => document.querySelector('.sheet-backdrop')?.remove());
    await page.waitForTimeout(300);
    await zumFeed();
    const amBeitrag = await page.$eval(`.post__comments[data-pid="${ersterPost}"]`, (n) =>
      Number((n.textContent.match(/\d+/) || ['0'])[0])
    );
    if (amBeitrag !== inListe) throw new Error(`am Beitrag ${amBeitrag}, in der Liste ${inListe}`);
  });

  /* --------------------------------------------- Ziehen zum Schliessen */
  console.log('\nZiehen zum Schließen');

  await pruefe('Ein kurzer Zug schließt das Kommentar-Blatt NICHT', async () => {
    await page.click(`.post__comments[data-pid="${ersterPost}"]`);
    await page.waitForSelector('.comment');
    await page.waitForTimeout(400);
    await wischen('.sheet', 40, { dauer: 600 });
    if (!(await page.$('.sheet'))) throw new Error('es ist trotzdem zugegangen');
  });

  await pruefe('Ein langer Zug nach unten schließt es', async () => {
    await wischen('.sheet', 200);
    await page.waitForTimeout(400);
    if (await page.$('.sheet')) throw new Error('es bleibt offen');
  });

  /* ----------------------------------------------------- Story */
  console.log('\nStory-Betrachter');

  const storyAuf = async () => {
    await page.click('[data-area="messenger"]');
    await page.waitForSelector('#chatSearch');
    await page.waitForTimeout(300);
    await page.click(await K.waehlerStory(page, 'Anna'));
    await page.waitForSelector('.viewer');
    await page.waitForTimeout(400);
  };

  await pruefe('Ein kurzer Zug beendet die Story NICHT', async () => {
    await storyAuf();
    await wischen('.viewer', 50, { dauer: 600 });
    if (!(await page.$('.viewer'))) throw new Error('sie ist trotzdem zugegangen');
  });

  await pruefe('Ein Wischen nach unten beendet sie', async () => {
    await wischen('.viewer', 250);
    await page.waitForTimeout(500);
    if (await page.$('.viewer')) throw new Error('sie bleibt offen');
  });

  await pruefe('Danach steht wieder die Chatliste da', async () => {
    if (!(await page.$('#chatSearch'))) throw new Error('der Messenger ist nicht zurück');
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
