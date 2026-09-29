// Prueft Kasten 6 aus Henriks Rueckmeldung vom 21.09.2026 (Videospalte,
// Querformat und Live):
//
//   6.1  Keine Geschwindigkeitsregelung bei Live
//   6.2  Kein Vorspulen bei Live, nur zurueck
//   6.3  Rote Zeitleiste: Vor- und Zurueckspulen funktioniert
//   6.4  Kapitel passen zur Videolaenge
//   6.5  Beim Spenden laesst sich ein eigener Betrag waehlen
//   6.6  "Aehnliche Videos" laesst sich antippen und oeffnet das Video
//   6.7  Vollbild dreht das Bild ins Querformat, statt hineinzuzoomen
//
// Gemessen wird am echten <video>: currentTime und playbackRate, nicht nur
// die Zahl neben der Leiste. Die Leiste konnte schon einmal eine Zeit
// anzeigen, waehrend das Video an seiner Stelle blieb.
//
// Bilder: bilder/kasten6/web-*.png
// Start:  SUPABASE_TOKEN=… node test/_querformat.js   (Server muss laufen)
//         Ohne Token fehlt nur der Datenbank-Abgleich der Spende.

const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const { frage } = require('./_aufraeumen');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
const ORDNER = path.join(__dirname, '..', '..', 'bilder', 'kasten6');
const bild = (name) => path.join(ORDNER, `web-${name}.png`);

const QUER = 'Testvideo im Querformat';
const LIVE = 'Expo SDK 57 live erklärt';
const LANG = 'Design Tokens sauber aufsetzen';

(async () => {
  fs.mkdirSync(ORDNER, { recursive: true });
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

  const blattZu = async () => {
    await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((n) => n.remove()));
    await page.waitForTimeout(200);
  };

  const clipAuf = async (titel) => {
    await blattZu();
    await page.evaluate(() => document.querySelector('#clipBack')?.click());
    await page.waitForTimeout(300);
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="landscape"]');
    await page.waitForSelector('[data-clip]', { timeout: 10000 });
    await page.click(await K.waehlerClip(page, titel));
    await page.waitForSelector('.player');
    // Auf die Datei warten, nicht auf die Uhr: erst mit ihr kennt die Seite
    // die echte Laenge, und nach ihr richten sich Leiste und Kapitel.
    await page.waitForFunction(() => {
      const v = document.querySelector('#clipVideo');
      return v && v.readyState >= 1 && isFinite(v.duration) && v.duration > 0;
    }, null, { timeout: 15000 });
  };

  const video = () =>
    page.$eval('#clipVideo', (v) => ({ bei: v.currentTime, laenge: v.duration, tempo: v.playbackRate }));

  /** Auf die Leiste tippen, `anteil` von ihrem Anfang aus gezaehlt. */
  const leisteAntippen = async (anteil, senkrecht = false) => {
    const k = await page.$eval('#clipBalken', (n) => {
      const r = n.getBoundingClientRect();
      return { x: r.left, y: r.top, b: r.width, h: r.height };
    });
    const x = senkrecht ? k.x + k.b / 2 : k.x + k.b * anteil;
    const y = senkrecht ? k.y + k.h * anteil : k.y + k.h / 2;
    await page.mouse.click(x, y);
    await page.waitForTimeout(250);
  };

  const ungefaehr = (ist, soll, text) => {
    if (Math.abs(ist - soll) > 2) throw new Error(`${text}: ${ist.toFixed(1)} s statt etwa ${soll.toFixed(1)} s`);
  };

  /* ------------------------------------------------------------ 6.3 */
  console.log('\n6.3 Rote Zeitleiste');
  await clipAuf(QUER);

  // Gegenprobe zu den Live-Punkten unten: ein fertiges Video behaelt alles.
  await pruefe('Ein fertiges Video hat Speichern, Aufrufe und „Zu Story" im Menü', async () => {
    if (!(await page.$('[data-clipact="save"]'))) throw new Error('Speichern fehlt');
    const sub = await page.$eval('.player__sub', (n) => n.textContent);
    if (!/Aufrufe/.test(sub)) throw new Error('Unterzeile: ' + sub);
    await page.click('[data-clipact="mehr"]');
    await page.waitForSelector('.sheet');
    await page.waitForTimeout(400);
    const punkte = await page.$$eval('.sheet .item__label', (n) => n.map((x) => x.textContent.trim()));
    if (!punkte.includes('Zu Story hinzufügen')) throw new Error('Punkte: ' + punkte.join(', '));
    await blattZu();
  });

  await pruefe('Antippen weit hinten spult vor — das Video springt mit', async () => {
    const { laenge } = await video();
    await leisteAntippen(0.75);
    ungefaehr((await video()).bei, laenge * 0.75, 'Video steht bei');
    const zeit = await page.$eval('#clipZeit', (n) => n.textContent);
    if (zeit === '0:00') throw new Error('die Zeit neben der Leiste bleibt 0:00');
    await page.screenshot({ path: bild('leiste-vor') });
  });

  await pruefe('Antippen weiter vorn spult zurück', async () => {
    const { laenge } = await video();
    await leisteAntippen(0.2);
    ungefaehr((await video()).bei, laenge * 0.2, 'Video steht bei');
  });

  await pruefe('Ziehen über die Leiste spult mit', async () => {
    const { laenge } = await video();
    const k = await page.$eval('#clipBalken', (n) => n.getBoundingClientRect().toJSON());
    await page.mouse.move(k.left + k.width * 0.1, k.top + k.height / 2);
    await page.mouse.down();
    for (const a of [0.2, 0.35, 0.5, 0.6]) await page.mouse.move(k.left + k.width * a, k.top + k.height / 2);
    await page.mouse.up();
    await page.waitForTimeout(250);
    ungefaehr((await video()).bei, laenge * 0.6, 'nach dem Ziehen steht das Video bei');
  });

  /* ------------------------------------------------------------ 6.4 */
  console.log('\n6.4 Kapitel');

  await pruefe('Alle Kapitel liegen im Video, jede Dauer passt', async () => {
    const { laenge } = await video();
    const zeilen = await page.$$eval('[data-kapitel]', (n) =>
      n.map((z) => ({ bei: Number(z.dataset.kapitel), dauer: z.querySelector('.kapitel__dauer').textContent }))
    );
    if (zeilen.length < 2) throw new Error(zeilen.length + ' Kapitel');
    const sek = (t) => t.split(':').reduce((a, b) => a * 60 + Number(b), 0);
    zeilen.forEach((z, i) => {
      if (z.bei >= laenge) throw new Error(`Kapitel bei ${z.bei} s in einem Video von ${laenge} s`);
      const bis = zeilen[i + 1]?.bei ?? Math.round(laenge);
      if (sek(z.dauer) !== bis - z.bei) throw new Error(`Kapitel bei ${z.bei} s dauert angeblich ${z.dauer}`);
    });
    await page.screenshot({ path: bild('kapitel') });
  });

  await pruefe('Rechts neben der Leiste steht die Länge der Datei', async () => {
    const { laenge } = await video();
    const text = await page.$eval('#clipLaenge', (n) => n.textContent.trim());
    const soll = `${Math.floor(Math.round(laenge) / 60)}:${String(Math.round(laenge) % 60).padStart(2, '0')}`;
    if (text !== soll) throw new Error(`da steht ${text}, die Datei ist ${soll} lang`);
  });

  await pruefe('Ein kurzes Video mit Kapiteln weit hinter dem Ende zeigt keine sinnlosen', async () => {
    await clipAuf(LANG);
    await page.waitForTimeout(300);
    const { laenge } = await video();
    const zeilen = await page.$$eval('[data-kapitel]', (n) => n.map((z) => Number(z.dataset.kapitel)));
    const falsch = zeilen.filter((b) => b >= laenge);
    if (falsch.length) throw new Error(`Kapitel bei ${falsch.join(', ')} s in ${Math.round(laenge)} s`);
    if (zeilen.length === 1) throw new Error('ein einzelnes Kapitel über das ganze Video');
    const text = await page.$eval('#clipLaenge', (n) => n.textContent.trim());
    if (text !== '1:00') throw new Error('neben der Leiste steht ' + text);
    await page.screenshot({ path: bild('kapitel-kurz') });
  });

  /* ------------------------------------------------------------ 6.7 */
  /*
   * Zwei Wege, beide werden gefahren: ein Browser mit Vollbild-API (Android,
   * Rechner) und das iPhone, dessen Safari sie fuer einen Player gar nicht
   * hat. Dort dreht der Player sich selbst.
   */
  for (const [weg, ohneApi] of [['Browser mit Vollbild-API', false], ['iPhone ohne Vollbild-API', true]]) {
    console.log(`\n6.7 Vollbild — ${weg}`);
    await clipAuf(QUER);
    if (ohneApi) await page.evaluate(() => (Element.prototype.requestFullscreen = undefined));
    const name = ohneApi ? 'vollbild-iphone' : 'vollbild';

    await pruefe('Vollbild im Hochkant-Handy dreht den Player um 90 Grad', async () => {
      await page.click('#clipVollbild');
      await page.waitForFunction(() => document.querySelector('.player')?.classList.contains('player--quer'), null, {
        timeout: 8000,
      });
      await page.waitForTimeout(400);
      const m = await page.$eval('.player', (n) => {
        const r = n.getBoundingClientRect();
        return { t: getComputedStyle(n).transform, b: r.width, h: r.height };
      });
      // rotate(90deg) ergibt matrix(0, 1, -1, 0, …)
      const teile = (m.t.match(/matrix\(([^)]+)\)/) || [])[1]?.split(',').map((x) => Math.round(Number(x)));
      if (!teile || teile[0] !== 0 || teile[1] !== 1 || teile[2] !== -1) throw new Error('Transform: ' + m.t);
      if (Math.abs(m.b - 390) > 2 || Math.abs(m.h - 844) > 2) {
        throw new Error(`der Player bedeckt ${Math.round(m.b)}×${Math.round(m.h)} statt 390×844`);
      }
      await page.screenshot({ path: bild(name) });
    });

    await pruefe('Das Bild nutzt die lange Seite und ist ganz zu sehen', async () => {
      const m = await page.$eval('#clipVideo', (v) => ({
        fit: getComputedStyle(v).objectFit,
        // Masse vor der Drehung: so liegt die Flaeche im Player.
        b: v.offsetWidth,
        h: v.offsetHeight,
        vb: v.videoWidth,
        vh: v.videoHeight,
      }));
      if (m.fit !== 'contain') throw new Error('object-fit: ' + m.fit);
      if (!(m.vb > m.vh)) throw new Error(`die Datei ist ${m.vb}×${m.vh}, kein Querformat`);
      if (m.b < 800) throw new Error(`die Videofläche ist nur ${m.b} px breit, die lange Seite hat 844`);
      /*
       * 16:9 auf 844×390 kann nicht beide Seiten fuellen — unter der Leiste
       * bleibt die Hoehe die Grenze. Gemessen wird deshalb, was Henrik
       * wollte: das Bild ist gross und ganz, nicht hineingezoomt. Hochkant
       * war es 390 px breit.
       */
      const bildBreite = Math.min(m.b, (m.h * m.vb) / m.vh);
      if (m.h < 300) throw new Error(`die Videofläche ist nur ${m.h} px hoch`);
      if (bildBreite < 550) throw new Error(`das Bild ist nur ${Math.round(bildBreite)} px breit, hochkant waren es 390`);
    });

    await pruefe('Auch gedreht springt die Leiste an die angetippte Stelle', async () => {
      const { laenge } = await video();
      await leisteAntippen(0.8, true);
      ungefaehr((await video()).bei, laenge * 0.8, 'Video steht bei');
      await leisteAntippen(0.25, true);
      ungefaehr((await video()).bei, laenge * 0.25, 'Video steht bei');
    });

    await pruefe('Der Knopf beendet das Vollbild wieder', async () => {
      await page.click('#clipVollbild');
      await page.waitForTimeout(300);
      const voll = await page.$eval('.player', (n) => n.classList.contains('player--voll'));
      if (voll) throw new Error('der Player bleibt im Vollbild');
    });
  }

  /* ------------------------------------------------------------ 6.6 */
  console.log('\n6.6 Ähnliche Videos');

  await pruefe('Ein ähnliches Video antippen öffnet genau dieses', async () => {
    const ziel = await page.$eval('[data-anderesclip]', (n) => ({
      id: n.dataset.anderesclip,
      titel: n.querySelector('.clip__title').textContent.trim(),
    }));
    await page.click(`[data-anderesclip="${ziel.id}"]`);
    await page.waitForTimeout(400);
    const titel = await page.$eval('.player__titel', (n) => n.textContent.trim());
    if (titel !== ziel.titel) throw new Error(`geöffnet: „${titel}", angetippt: „${ziel.titel}"`);
    await page.screenshot({ path: bild('aehnlich') });
  });

  await pruefe('„Ähnliche Videos →" führt zur ganzen Querformat-Liste', async () => {
    await page.click('#clipAehnlich');
    await page.waitForSelector('[data-openclip]', { timeout: 10000 });
    if (await page.$('.player')) throw new Error('der Player bleibt offen');
    const anzahl = await page.$$eval('[data-openclip]', (n) => n.length);
    if (anzahl < 5) throw new Error('nur ' + anzahl + ' Videos in der Liste');
    await page.screenshot({ path: bild('aehnlich-liste') });
    // Und aus der Liste geht es wieder in ein Video.
    await page.click('[data-openclip]');
    await page.waitForSelector('.player');
  });

  /* ------------------------------------------------------- 6.1 / 6.2 */
  console.log('\n6.1 / 6.2 Live');

  // Erst im gewoehnlichen Video 2x einstellen - Live darf das nicht erben.
  await clipAuf(QUER);
  await page.click('#clipOptionen');
  await page.click('.sheet .item:has-text("Geschwindigkeit")');
  await page.click('[data-vwahl="2"]');
  await page.waitForTimeout(300);

  await clipAuf(LIVE);

  await pruefe('Live zeigt das Bild, nicht nur die Leiste', async () => {
    const m = await page.$eval('.player__stage', (n) => ({
      h: Math.round(n.getBoundingClientRect().height),
      stil: n.getAttribute('style'),
      klasse: n.closest('.player').className,
      rolle: document.scrollingElement.scrollTop,
    }));
    if (m.h < 150) throw new Error(JSON.stringify(m));
  });

  await pruefe('Live läuft in Echtzeit, auch wenn sonst 2× eingestellt ist', async () => {
    const { tempo } = await video();
    if (tempo !== 1) throw new Error('playbackRate ' + tempo);
  });

  await pruefe('Die Video-Einstellungen bieten bei Live keine Geschwindigkeit an', async () => {
    await page.click('#clipOptionen');
    await page.waitForSelector('.sheet');
    const punkte = await page.$$eval('.sheet .item__label', (n) => n.map((x) => x.textContent.trim()));
    if (punkte.some((p) => /geschwindigkeit/i.test(p))) throw new Error('Punkte: ' + punkte.join(', '));
    if (!punkte.length) throw new Error('das Blatt ist leer');
    await page.waitForTimeout(500); // das Blatt faehrt herein
    await page.screenshot({ path: bild('live-einstellungen') });
    await blattZu();
  });

  /* Die gesendete Stelle steht als aria-valuemax am Regler (seit 28.09.2026). */
  const kante = () => page.$eval('#clipBalken', (n) => Number(n.getAttribute('aria-valuemax')));

  await pruefe('Live beginnt an der Stelle, die gerade gesendet wird, nicht bei 0:00', async () => {
    await page.waitForFunction(() => isFinite(document.querySelector('#clipVideo')?.duration), null, {
      timeout: 15000,
    });
    await page.waitForTimeout(300);
    // Dieselbe Rechnung wie im Player: Sekunden seit Sendebeginn, im Kreis ueber die Datei.
    const zeile = await frage(`select created_at from posts where title like '${LIVE}%' and format = 'live' limit 1`);
    if (!Array.isArray(zeile) || !zeile[0]) throw new Error('Sendebeginn nicht gefunden: ' + JSON.stringify(zeile));
    const { laenge } = await video();
    const soll = Math.floor((Date.now() - new Date(zeile[0].created_at).getTime()) / 1000) % Math.round(laenge);
    const k = await kante();
    const { bei } = await video();
    if (Math.abs(k - soll) > 3) throw new Error(`Kante ${k} s statt etwa ${soll} s`);
    if (Math.abs(bei - k) > 2) throw new Error(`Video steht bei ${bei.toFixed(1)} s, gesendet ist ${k} s`);
  });

  await pruefe('Vorspulen über die gesendete Stelle hinaus geht nicht', async () => {
    await leisteAntippen(0.97);
    const k = await kante();
    const { bei, laenge } = await video();
    if (k < laenge * 0.9 && bei > k + 1.5) throw new Error(`das Video sprang nach vorn auf ${bei.toFixed(1)} s, gesendet ist ${k} s`);
  });

  await pruefe('Zurückspulen geht, um Verpasstes zu sehen', async () => {
    const k = await kante();
    const { laenge } = await video();
    const ziel = k / 2;
    await leisteAntippen(ziel / laenge);
    ungefaehr((await video()).bei, ziel, 'Video steht bei');
    await page.screenshot({ path: bild('live-zurueck') });
  });

  await pruefe('„LIVE" führt zurück an die gesendete Stelle, nicht weiter', async () => {
    await page.click('#clipLiveKante');
    await page.waitForTimeout(250);
    const k = await kante();
    const { bei } = await video();
    if (Math.abs(bei - k) > 1.5) throw new Error(`nach „LIVE" steht das Video bei ${bei.toFixed(1)} s statt ${k} s`);
  });

  await pruefe('Bei Live: kein Speichern, Zuschauer statt Aufrufe', async () => {
    if (await page.$('[data-clipact="save"]')) throw new Error('Speichern steht da');
    const sub = await page.$eval('.player__sub', (n) => n.textContent);
    if (!/sehen zu · live seit/.test(sub)) throw new Error('Unterzeile: ' + sub);
    await page.screenshot({ path: bild('live-aktionen') });
  });

  await pruefe('Das Drei-Punkte-Menü bietet bei Live weder Herunterladen noch Story', async () => {
    await page.click('[data-clipact="mehr"]');
    await page.waitForSelector('.sheet');
    await page.waitForTimeout(400);
    const punkte = await page.$$eval('.sheet .item__label', (n) => n.map((x) => x.textContent.trim()));
    if (!punkte.includes('Link kopieren')) throw new Error('Punkte: ' + punkte.join(', '));
    if (punkte.some((p) => /Herunterladen|Story/.test(p))) throw new Error('Punkte: ' + punkte.join(', '));
    await page.screenshot({ path: bild('live-menue') });
    await blattZu();
  });

  await pruefe('Live zeigt keine Kapitel', async () => {
    if (await page.$('.kapitel')) throw new Error('Kapitel bei Live');
  });

  /* ------------------------------------------------------------ 6.5 */
  console.log('\n6.5 Spenden mit eigenem Betrag');

  const vorher = new Date().toISOString();

  await pruefe('Das Spendenblatt bietet „Eigener Betrag" an', async () => {
    await page.click('#liveSpende');
    await page.waitForSelector('[data-spendecent="eigen"]');
    await page.screenshot({ path: bild('spende-blatt') });
    await page.click('[data-spendecent="eigen"]');
    await page.waitForSelector('.sheet input');
  });

  await pruefe('Ein zu kleiner Betrag wird abgewiesen, das Feld bleibt offen', async () => {
    await page.fill('.sheet input', '0,10');
    await page.click('.sheet button[type="submit"], .sheet .sheet__primary, .sheet button:has-text("Spenden")');
    await page.waitForTimeout(500);
    const text = await page.$eval('.sheet', (n) => n.textContent);
    if (!/0,50/.test(text)) throw new Error('kein Hinweis auf die Grenzen');
    if (!(await page.$('.sheet input'))) throw new Error('das Blatt ist zu');
    await page.screenshot({ path: bild('spende-zu-klein') });
  });

  await pruefe('2,50 € gehen durch und stehen so in der Datenbank', async () => {
    await page.fill('.sheet input', '2,50');
    await page.click('.sheet button[type="submit"], .sheet .sheet__primary, .sheet button:has-text("Spenden")');
    await page.waitForFunction(() => /2,50 € an .* gespendet/.test(document.body.textContent), null, {
      timeout: 10000,
    });
    await page.screenshot({ path: bild('spende-ok') });
    const zeilen = await frage(`select d.betrag_cent, p.title from donations d join posts p on p.id = d.post_id
      where d.sender_id = (select id from auth.users where email = $KONTO) and d.created_at >= '${vorher}'`);
    if (zeilen === null) return console.log('       (ohne SUPABASE_TOKEN kein Datenbank-Abgleich)');
    if (!Array.isArray(zeilen) || zeilen.length !== 1) throw new Error('Datenbank: ' + JSON.stringify(zeilen));
    if (zeilen[0].betrag_cent !== 250) throw new Error(`gebucht: ${zeilen[0].betrag_cent} Cent`);
    if (!zeilen[0].title.includes('Expo SDK 57')) throw new Error('am falschen Beitrag: ' + zeilen[0].title);
  });

  // Zurueck auf 1x, damit der naechste Lauf nicht mit 2x anfaengt.
  await blattZu();
  await clipAuf(QUER);
  await page.click('#clipOptionen');
  await page.click('.sheet .item:has-text("Geschwindigkeit")');
  await page.click('[data-vwahl="1"]');

  /* ------------------------------------------------------------ 6.8 */
  console.log('\n6.8 Livestream beenden: veröffentlichen oder löschen');

  /*
   * Henrik am 28.09.2026: "Erst wenn das Live Video beendet wurde, gibt's die
   * Möglichkeit, dass der Administrator des Live Videos das als normales
   * Querformat Video veröffentlicht oder es automatisch veröffentlicht wird."
   * Alles hier laeuft auf dem Pruefkonto; was entsteht, raeumt das Ende weg.
   */
  const eigeneStreams = () =>
    frage(`select id, format, title, duration from posts
      where user_id = (select id from auth.users where email = $KONTO)
        and title like 'Livestream%' and created_at >= '${vorher}' order by created_at`);

  const liveStarten = async () => {
    await blattZu();
    await page.evaluate(() => document.querySelector('#clipBack')?.click());
    await page.waitForTimeout(300);
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(200);
    await page.click('[data-sub="profile"]');
    await page.waitForTimeout(400);
    await page.click('[data-oact="create"]');
    await page.waitForTimeout(400);
    await page.click('[data-erstellen="livestream"]');
    // Freigegeben wird das Eingabefeld erst, wenn der Stream-Beitrag steht.
    await page.waitForSelector('#liveText:not([disabled])', { timeout: 10000 });
    await page.waitForTimeout(1200);
  };

  const hinweis = (text) =>
    page.waitForFunction((t) => (document.querySelector('#toast')?.textContent || '').includes(t), text, {
      timeout: 10000,
    });

  let ersterStream = null;

  await pruefe('Während der Sendung steht genau ein Beitrag, und zwar als Live', async () => {
    await liveStarten();
    const zeilen = await eigeneStreams();
    if (zeilen === null) return console.log('       (ohne SUPABASE_TOKEN kein Datenbank-Abgleich)');
    if (zeilen.length !== 1 || zeilen[0].format !== 'live') throw new Error(JSON.stringify(zeilen));
    ersterStream = zeilen[0].id;
  });

  await pruefe('Beenden fragt: als Video veröffentlichen oder löschen', async () => {
    await page.click('#liveStop');
    await page.waitForSelector('#liveEnde:not([hidden])', { timeout: 3000 });
    if (!(await page.isVisible('#liveVeroeffentlichen'))) throw new Error('kein Veröffentlichen');
    if (!(await page.isVisible('#liveLoeschen'))) throw new Error('kein Löschen');
    if (await page.isVisible('#liveStop')) throw new Error('Beenden steht noch da');
    await page.screenshot({ path: bild('live-ende-wahl') });
  });

  await pruefe('Veröffentlichen macht denselben Beitrag zum Standard-Video, ohne Duplikat', async () => {
    await page.click('#liveVeroeffentlichen');
    await hinweis('steht im Querformat');
    await page.waitForFunction(
      () => [...document.querySelectorAll('.clip__title')].some((e) => e.textContent.includes('Livestream-Aufzeichnung')),
      null,
      { timeout: 10000 }
    );
    await page.screenshot({ path: bild('live-ende-veroeffentlicht') });
    const zeilen = await eigeneStreams();
    if (zeilen === null) return;
    if (zeilen.length !== 1) throw new Error(`${zeilen.length} Beiträge: ${JSON.stringify(zeilen)}`);
    const z = zeilen[0];
    if (z.id !== ersterStream) throw new Error('nicht derselbe Beitrag');
    if (z.format !== 'standard' || z.title !== 'Livestream-Aufzeichnung' || !/^\d\d:\d\d$/.test(z.duration || '')) {
      throw new Error(JSON.stringify(z));
    }
    const live = await frage(`select live from profiles where id = (select id from auth.users where email = $KONTO)`);
    if (live?.[0]?.live) throw new Error('Profil steht noch auf live');
  });

  await pruefe('Löschen lässt keinen Beitrag zurück', async () => {
    await liveStarten();
    const vorher2 = await eigeneStreams();
    const neu = vorher2?.find((z) => z.format === 'live');
    await page.click('#liveStop');
    await page.waitForSelector('#liveEnde:not([hidden])', { timeout: 3000 });
    await page.click('#liveLoeschen');
    await hinweis('gelöscht');
    if (vorher2 === null) return;
    if (!neu) throw new Error('kein Live-Beitrag angelegt');
    const nachher = await frage(`select id from posts where id = '${neu.id}'`);
    if (nachher.length) throw new Error('der Beitrag steht noch');
  });

  await pruefe('Mit „automatisch veröffentlichen" endet der Stream ohne Rückfrage', async () => {
    await liveStarten();
    await page.click('.live__auto');
    await page.waitForTimeout(800);
    const gespeichert = await frage(`select wert from user_settings
      where user_id = (select id from auth.users where email = $KONTO) and schluessel = 'liveAutoVeroeffentlichen'`);
    if (gespeichert && gespeichert[0]?.wert !== 'an') throw new Error('Schalter nicht gespeichert: ' + JSON.stringify(gespeichert));
    await page.screenshot({ path: bild('live-auto-schalter') });
    await page.click('#liveStop');
    await hinweis('steht im Querformat');
    if (await page.$('#liveEnde:not([hidden])')) throw new Error('es wurde trotzdem gefragt');
    const zeilen = await eigeneStreams();
    if (zeilen === null) return;
    const standard = zeilen.filter((z) => z.format === 'standard');
    if (standard.length !== 2 || zeilen.some((z) => z.format === 'live')) throw new Error(JSON.stringify(zeilen));
  });

  // Was 6.8 angelegt hat, wieder weg - Beitraege und Schalter des Pruefkontos.
  await frage(`delete from posts where user_id = (select id from auth.users where email = $KONTO)
    and title like 'Livestream%' and created_at >= '${vorher}'`).catch(() => {});
  await frage(`delete from user_settings where user_id = (select id from auth.users where email = $KONTO)
    and schluessel = 'liveAutoVeroeffentlichen'`).catch(() => {});

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  // Die Pruefspende wieder weg - sie gehoert dem Pruefkonto.
  await frage(`delete from donations where sender_id = (select id from auth.users where email = $KONTO)
    and created_at >= '${vorher}'`).catch(() => {});
  await zuruecksetzen(page).catch(() => {});
  await beenden(browser, erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
