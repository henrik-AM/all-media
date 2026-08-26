// Prueft die Punkte aus Henriks Rueckmeldung vom 26.08.2026, die beim
// Nachziehen am 27.08.2026 drankamen:
//
//   Punkt 15  Langes Druecken auf einen Chat: Kopfzeile statt nackter Liste
//   Punkt 17  Die Kamera fragt, was mit der Aufnahme geschehen soll
//   Punkt 18  Das Bildsymbol geht in die Galerie, nicht in die Kamera
//   Punkt 38  Musik laesst sich zu einem Beitrag waehlen
//   Punkt 42  Folgen zaehlt die eigene "Gefolgt"-Zahl mit
//   Punkt 45  Livestream steht direkt unter Story
//   Punkt 56  Die Ueberschriften der Community-Suche sind anklickbar
//   Punkt 57  Ein privates Profil bekommt eine Anfrage, kein "+ Befreunden"
//
// Start:  node test/_kamera.js   (Server muss laufen)

const path = require('path');
const { chromium } = require('playwright-core');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
const BILD = path.join(__dirname, '_testbild.png');

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

  const gehe = async (bereich, unter) => {
    await page.click(`[data-area="${bereich}"]`);
    await page.waitForTimeout(300);
    if (unter) {
      await page.click(`[data-sub="${unter}"]`);
      await page.waitForTimeout(600);
    }
  };

  /* --------------------------------------------------------- Kamera */
  console.log('\nKamera — Punkt 17 und 18');

  await pruefe('Das Bildsymbol öffnet die Galerie, nicht die Kamera', async () => {
    await gehe('messenger', 'camera');
    const [auswahl] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#camGallery'),
    ]);
    // Ohne capture-Kennzeichen oeffnet das Handy den Bildordner. Playwright
    // meldet das als "kein capture" am Dateifeld.
    const mitCapture = await page.evaluate(
      () => !!document.querySelector('input[type=file][capture]')
    );
    if (mitCapture) throw new Error('das Dateifeld verlangt weiter die Kamera');
    await auswahl.setFiles(BILD);
    await page.waitForTimeout(1000);
  });

  await pruefe('Nach der Galerie steht die Frage nach dem Ziel', async () => {
    if (!(await page.$('[data-verwenden="story"]'))) throw new Error('keine Frage nach dem Ziel');
    if (!(await page.$('.aufnahme__vorschau'))) throw new Error('keine Vorschau der Aufnahme');
  });

  await pruefe('Die Aufnahme lässt sich in einen Chat schicken', async () => {
    await page.click('[data-verwenden="chat"]');
    await page.waitForTimeout(600);
    if (!(await page.$('[data-zielchat]'))) throw new Error('keine Auswahl eines Chats');

    const erster = await page.$eval('[data-zielchat]', (e) => e.dataset.zielchat);
    await page.click(`[data-zielchat="${erster}"]`);
    await page.waitForTimeout(1200);

    const gesendet = await page.$eval('#toast', (e) => e.textContent);
    if (!/gesendet/i.test(gesendet)) throw new Error('Meldung war: ' + gesendet);
    if (!(await page.$('#messages'))) throw new Error('der Chat ist nicht aufgegangen');
  });

  await pruefe('Im Chat steht das Kamerasymbol', async () => {
    if (!(await page.$('#camBtn'))) throw new Error('kein Kamerasymbol in der Nachrichtenzeile');
  });

  await page.evaluate(() => document.querySelector('#chatBack')?.click());
  await page.waitForTimeout(500);

  /* ----------------------------------------------- Chat-Optionen */
  console.log('\nLanges Drücken auf einen Chat — Punkt 15');

  await pruefe('Das Blatt zeigt zuerst, um wen es geht', async () => {
    await gehe('messenger', 'chats');
    const ersterChat = await page.$eval('[data-chat]', (e) => e.dataset.chat);
    await page.evaluate((id) => {
      const zeile = document.querySelector(`[data-chat="${id}"]`);
      zeile.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 200 }));
    }, ersterChat);
    await page.waitForTimeout(900);

    if (!(await page.$('.coptkopf'))) throw new Error('keine Kopfzeile im Blatt');
    if (!(await page.$('.coptkopf .avatar'))) throw new Error('kein Bild in der Kopfzeile');
    if (!(await page.$('.copt__trenner'))) throw new Error('das Löschen ist nicht abgesetzt');
  });

  await zu();

  /* ------------------------------------------------------ Erstellen */
  console.log('\nErstellen — Punkt 38 und 45');

  await pruefe('Livestream steht direkt unter Story', async () => {
    await gehe('videos', 'profile');
    await page.click('[data-oact="create"]');
    await page.waitForSelector('.erstellen');
    const punkte = await page.$$eval('.erstellen__punkt', (n) => n.map((e) => e.textContent.trim()));
    const story = punkte.indexOf('Story');
    if (punkte[story + 1] !== 'Livestream') throw new Error(punkte.join(' | '));
    await page.click('[data-sheet-close]');
    await page.waitForTimeout(300);
  });

  await pruefe('Zum Beitrag lässt sich Musik wählen', async () => {
    const wartet = page.waitForEvent('filechooser');
    await page.click('[data-oact="create"]');
    await page.waitForSelector('.erstellen');
    await page.click('[data-erstellen="post"]');
    const auswahl = await wartet;
    await auswahl.setFiles(BILD);

    await page.waitForSelector('#f_music', { timeout: 4000 });
    const wahl = await page.$$eval('#f_music option', (n) => n.map((e) => e.textContent));
    if (wahl.length < 2) throw new Error('nur ' + wahl.join(' | '));
    if (wahl[0] !== 'Originalton') throw new Error('erste Wahl war ' + wahl[0]);

    await page.selectOption('#f_music', wahl[1]);
    await page.fill('#f_beschreibung', 'Beitrag mit Musik');
    await page.click('#formOk');
    await page.waitForTimeout(1400);

    const musik = await page.$$eval('[data-postsound]', (n) => n.map((e) => e.textContent));
    if (!musik.some((m) => m.includes(wahl[1].split(' – ')[0]))) {
      throw new Error('die gewählte Musik steht nicht am Beitrag: ' + musik.slice(0, 3).join(' | '));
    }
  });

  /* -------------------------------------------------------- Folgen */
  console.log('\nFolgen — Punkt 42');

  await pruefe('Folgen zählt die eigene Gefolgt-Zahl mit', async () => {
    await gehe('videos', 'profile');
    const vorher = await page.$eval('#followingBtn strong', (e) => e.textContent);

    // Der Folgen-Knopf haengt am Beitrag im Feed, nicht am Hochformat-Player.
    await gehe('videos', 'home');
    await page.waitForSelector('[data-paction="follow"]');
    await page.click('[data-paction="follow"]');
    await page.waitForTimeout(800);

    await gehe('videos', 'profile');
    const nachher = await page.$eval('#followingBtn strong', (e) => e.textContent);
    if (vorher === nachher) throw new Error(`stand vorher und nachher bei ${vorher}`);
  });

  /* --------------------------------------------------- Communitys */
  console.log('\nCommunity-Suche — Punkt 56 und 57');

  await pruefe('Die Überschriften sind anklickbar', async () => {
    await gehe('communities', 'search');
    await page.waitForTimeout(600);
    const kopf = await page.$('[data-csmehr="people"]');
    if (!kopf) throw new Error('die Überschrift "Profile" ist kein Knopf');

    await kopf.click();
    await page.waitForTimeout(500);
    const aktiv = await page.$eval('.pill.is-active', (e) => e.textContent.trim());
    if (aktiv !== 'Kontakte') throw new Error('gewechselt wurde zu: ' + aktiv);
  });

  await pruefe('Ein privates Profil bekommt eine Anfrage, kein Befreunden', async () => {
    await gehe('communities', 'search');
    await page.waitForTimeout(600);
    // `state` liegt im Modul, nicht am window - darum direkt beim Server fragen.
    const privateIds = await page.evaluate(async () => {
      const daten = await (await fetch('/api/bootstrap')).json();
      return daten.privateProfile || [];
    });
    if (!privateIds.length) throw new Error('der Server nennt kein privates Profil');

    // Nur wer noch kein Kontakt ist, zeigt ueberhaupt einen Knopf zum
    // Anfragen - bei den uebrigen steht "Befreundet" oder "Angefragt".
    const offeneKnoepfe = (
      await page.$$eval('[data-befriend]', (n) =>
        n.map((e) => ({ id: e.dataset.befriend, text: e.textContent.trim(), zu: e.disabled }))
      )
    ).filter((b) => !b.zu);

    const privat = offeneKnoepfe.find((b) => privateIds.includes(b.id));
    const offen = offeneKnoepfe.find((b) => !privateIds.includes(b.id));

    if (!privat || privat.text !== 'Anfrage senden') {
      throw new Error('privates Profil zeigt: ' + (privat ? privat.text : 'keinen offenen Knopf'));
    }
    if (!offen || offen.text !== '+ Befreunden') {
      throw new Error('offenes Profil zeigt: ' + (offen ? offen.text : 'keinen offenen Knopf'));
    }
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
