// Prueft zwei Knoepfe, die vorher nur einen Hinweis ausgegeben haben:
//   - das Plus in der Nachrichtenzeile (Foto, Standort, Kontakt)
//   - die drei Punkte im Profil einer anderen Person
//
// Start:  node test/_anhang.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen } = require('./_konto');
const K = require('./_kennungen');
const fs = require('fs');
const path = require('path');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

const BILD = path.join(__dirname, '_testbild.png');
if (!fs.existsSync(BILD)) {
  fs.writeFileSync(
    BILD,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVQIW2P8z8Dwn4EIwDiqkL4hRQAAAP//AwDPUAX3rN6iSwAAAABJRU5ErkJggg==',
      'base64'
    )
  );
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  // Ohne Deckel wartet ein blockierter Klick sonst endlos.
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
  await page.evaluate(() => localStorage.removeItem('am-eigene-medien'));
  await zuruecksetzen(page);
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

  const imChat = async () => {
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(300);
    await page.click(await K.waehlerChat(page, 'Anna Schmidt'));
    await page.waitForTimeout(600);
  };

  const anhangAuf = async (art) => {
    await page.click('#attach');
    await page.waitForSelector('[data-anhang]', { timeout: 3000 });
    await page.click(`[data-anhang="${art}"]`);
  };

  console.log('\nAnhang im Chat');
  await imChat();

  // Seit dem Handbuch-Abgleich am 01.09.2026 haengen vier weitere Arten
  // darin: Datei, Gif, Sticker und "Standort anfragen". Die Liste wird hier
  // vollstaendig geprueft, weil ein verschwundener Punkt sonst niemandem
  // auffaellt.
  await pruefe('Das Plus zeigt alle Anhang-Arten', async () => {
    try {
      await page.click('#attach');
      await page.waitForSelector('[data-anhang]', { timeout: 3000 });
      const punkte = await page.$$eval('[data-anhang]', (els) => els.map((e) => e.textContent.trim()));
      const soll = [
        'Foto aufnehmen',
        'Aus der Galerie',
        'Datei senden',
        'Gif senden',
        'Sticker',
        'Standort senden',
        'Standort anfragen',
        'Kontakt senden',
      ];
      if (JSON.stringify(punkte) !== JSON.stringify(soll)) throw new Error(punkte.join(' | '));
    } finally {
      // Das Anhang-Menue schliesst wie das Neu-Menue: Tippen daneben. Das
      // muss auch nach einem Fehlschlag passieren — ein offenes Blatt legt
      // sonst jede folgende Pruefung lahm, und dann sieht es aus, als waere
      // alles kaputt statt nur diese eine Sache.
      await page.mouse.click(195, 60);
      await page.waitForTimeout(300);
    }
  });

  await pruefe('Standort landet als Karte im Chat', async () => {
    await anhangAuf('standort');
    await page.waitForSelector('[data-ort]', { timeout: 3000 });
    // "pl2" war die feste Kennung aus den Beispieldaten — Standorte stehen
    // jetzt in der Datenbank. Siehe test/_kennungen.js.
    await page.click(`[data-ort="${await K.kennungNachText(page, 'data-ort', 'Zugspitze')}"]`);
    await page.waitForFunction(
      () => [...document.querySelectorAll('.msg__standortName')]
        .some((n) => n.textContent.includes('Zugspitze')),
      null, { timeout: 10000 }
    ).catch(() => {});
    const namen = await page.$$eval('.msg__standortName', (els) => els.map((e) => e.textContent));
    if (!namen.includes('Zugspitze')) throw new Error(namen.join(' | '));
    const adresse = await page.$eval('.msg__standortSub', (e) => e.textContent);
    if (!adresse.trim()) throw new Error('keine Adresse auf der Karte');
  });

  await pruefe('Die Standort-Karte fuehrt zur Standort-Seite', async () => {
    await page.click('[data-msgort]');
    await page.waitForSelector('.exp__adresse', { timeout: 3000 });
    const titel = await page.$eval('#overlay .exp__titel', (e) => e.textContent);
    if (titel !== 'Zugspitze') throw new Error(titel);
    await page.click('#expBack');
    await page.waitForTimeout(400);
    await imChat();
  });

  await pruefe('Kontakt landet als Karte im Chat', async () => {
    await anhangAuf('kontakt');
    await page.waitForSelector('[data-kontakt]', { timeout: 3000 });
    await page.click(`[data-kontakt="${K.person('u4')}"]`);
    // Der Anhang geht jetzt in die Datenbank; danach wird der Chat neu
    // gezeichnet. Warten statt raten.
    await page.waitForFunction(
      () => [...document.querySelectorAll('.msg__kontaktText strong')]
        .some((n) => n.textContent.includes('David König')),
      null, { timeout: 10000 }
    ).catch(() => {});
    const namen = await page.$$eval('.msg__kontaktText strong', (els) => els.map((e) => e.textContent));
    if (!namen.includes('David König')) throw new Error(namen.join(' | '));
  });

  await pruefe('Der Chatpartner steht nicht in der Auswahl', async () => {
    await anhangAuf('kontakt');
    await page.waitForSelector('[data-kontakt]', { timeout: 3000 });
    const ids = await page.$$eval('[data-kontakt]', (els) => els.map((e) => e.dataset.kontakt));
    if (ids.includes(K.person('u1'))) throw new Error('Anna Schmidt steht in ihrem eigenen Chat zur Auswahl');
    await page.click('[data-sheet-close]');
  });

  await pruefe('Foto wird wirklich angezeigt, nicht nur benannt', async () => {
    // Der Fehlschlag darf nicht als unbehandelte Zusage enden - sonst
    // bricht Node ab, statt die Pruefung rot zu melden.
    const wartet = page.waitForEvent('filechooser').catch(() => null);
    await anhangAuf('kamera');
    const auswahl = await wartet;
    if (!auswahl) throw new Error('die Dateiauswahl ging nicht auf');
    await auswahl.setFiles(BILD);

    /*
     * Auf die Blase warten, nicht auf die Uhr.
     *
     * Hier stand waitForTimeout(1000). Das Bild wird erst hochgeladen und der
     * Chat danach neu gezeichnet — unter Last dauert das laenger als eine
     * Sekunde, und dann meldete dieser Schritt "kein Bild in der Blase",
     * obwohl das Bild Bruchteile spaeter dastand.
     */
    await page
      .waitForFunction(() => document.querySelectorAll('.msg__bild').length > 0, null, {
        timeout: 15000,
      })
      .catch(() => {});
    const bilder = await page.$$eval('.msg__bild', (els) => els.length);
    if (bilder < 1) throw new Error('kein Bild in der Blase');
  });

  await pruefe('Die Chatliste zeigt den Anhang als Vorschau', async () => {
    await page.click('#chatBack');
    await page.waitForTimeout(600);
    const text = await page.$eval('#main', (e) => e.textContent);
    if (!text.includes('Foto')) throw new Error('Vorschau fehlt');
  });

  console.log('\nWeitere Optionen im Profil');

  await pruefe('Der Mehr-Knopf zeigt fuenf Optionen', async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(600);
    /*
     * Ein FREMDES Profil — nicht das erste im Feed.
     *
     * Seit jedes Konto eigene Testbeiträge hat, steht ganz oben der eigene.
     * Stummschalten und Blockieren gehen bei sich selbst nicht, und die
     * Datenbank lehnt es zu Recht ab ("mutes_nicht_selbst"). Der Prüflauf
     * meldete daraufhin drei Fehler, die keine waren.
     */
    await page.waitForSelector('[data-profile]', { timeout: 10000 });
    const fremd = await page.$$eval('.post__name[data-profile]', (n) => {
      const treffer = n.find((x) => x.getAttribute('data-profile') !== 'me');
      return treffer ? treffer.getAttribute('data-profile') : null;
    });
    if (!fremd) throw new Error('kein fremdes Profil im Feed');
    await page.click(`.post__name[data-profile="${fremd}"]`);
    await page.waitForSelector('.prof__name', { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.click('#profMore');
    await page.waitForSelector('[data-popt]', { timeout: 3000 });
    const punkte = await page.$$eval('[data-popt]', (els) => els.map((e) => e.textContent.trim()));
    if (punkte.length !== 5) throw new Error(punkte.join(' | '));
    if (!punkte.some((t) => t.includes('Blockieren'))) throw new Error(punkte.join(' | '));
  });

  await pruefe('Stummschalten wird im Profil angezeigt', async () => {
    await page.click('[data-popt="stumm"]');
    // Stummschalten geht in die Datenbank, danach wird das Profil frisch
    // geholt — feste Wartezeiten reichen dafuer nicht.
    await page.waitForFunction(
      () => /stummgeschaltet/.test(document.querySelector('.prof__hinweis')?.textContent ?? ''),
      null, { timeout: 10000 }
    ).catch(() => {});
    const hinweis = await page.$eval('.prof__hinweis', (e) => e.textContent).catch(() => 'kein Hinweis');
    if (!hinweis.includes('stummgeschaltet')) throw new Error(hinweis);
  });

  await pruefe('Blockieren nimmt die Person aus den Kontakten', async () => {
    const vorher = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).contacts.length);
    await page.click('#profMore');
    await page.waitForSelector('[data-popt]');
    await page.click('[data-popt="block"]');
    await page.waitForFunction(
      () => /blockiert/.test(document.querySelector('.prof__hinweis')?.textContent ?? ''),
      null, { timeout: 10000 }
    ).catch(() => {});
    const hinweis = await page.$eval('.prof__hinweis', (e) => e.textContent).catch(() => 'kein Hinweis');
    if (!hinweis.includes('blockiert')) throw new Error(hinweis);
    const nachher = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).contacts.length);
    if (nachher !== vorher - 1) throw new Error(`${vorher} -> ${nachher}`);
  });

  await pruefe('Der Nachricht-Knopf ist dann gesperrt', async () => {
    const aus = await page.$eval('#profMessage', (e) => e.disabled);
    if (!aus) throw new Error('Knopf ist noch aktiv');
  });

  await pruefe('Melden fragt nach einem Grund', async () => {
    await page.click('#profMore');
    await page.waitForSelector('[data-popt]');
    await page.click('[data-popt="melden"]');
    await page.waitForSelector('[data-grund]', { timeout: 3000 });
    const gruende = await page.$$eval('[data-grund]', (els) => els.length);
    if (gruende < 3) throw new Error('nur ' + gruende + ' Gruende');
    /*
     * Der Hinweis unten blendet sich nach 2,2 Sekunden aus.
     *
     * Vorher wurde erst 600 ms gewartet und dann nachgesehen. Seit die
     * Meldung über die Datenbank läuft, war das mal zu früh und mal zu spät —
     * der Prüflauf fand ein leeres Feld und meldete "kein Treffer". Deshalb:
     * das Feld leeren, dann auf den Text warten.
     */
    await page.evaluate(() => {
      const t = document.querySelector('#toast');
      if (t) { t.textContent = ''; t.hidden = true; }
    });
    await page.click('[data-grund]');
    await page.waitForFunction(
      () => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.trim().length > 0; },
      null, { timeout: 10000 }
    ).catch(() => {});
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('Danke')) throw new Error(hinweis || 'kein Hinweis erschienen');
  });

  await zuruecksetzen(page);
  await page.evaluate(() => localStorage.removeItem('am-eigene-medien'));

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehler || eindeutig.length ? 1 : 0);
})();
