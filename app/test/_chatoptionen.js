// Prueft Punkt 2 aus Henriks Rueckmeldung vom 26.08.2026:
//
//   "Bearbeitungsansicht wirkt leer; Einstellungen (z. B. Chat sperren) sind
//    nicht funktionsfähig. Inspiration WhatsApp — mehr Felder hinzufügen;
//    Einstellungen müssen echte Funktion haben."
//
// Der Punkt hier ist nicht, dass die Schalter DA sind - das waren sie vorher
// auch. Geprueft wird, dass sie WIRKEN: also dass ihr Stand nach dem
// Schliessen und erneuten Oeffnen noch derselbe ist und dass er sich
// ausserhalb des Blattes bemerkbar macht.
//
// Start:  node test/_chatoptionen.js   (Server muss laufen)

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

  const zurListe = async () => {
    await page.click('[data-area="messenger"]');
    await page.waitForSelector('#chatSearch');
    await page.waitForTimeout(200);
  };

  /** Die Chat-Einstellungen zu c2 oeffnen (langes Druecken auf die Zeile). */
  const optionen = async () => {
    await zurListe();
    const zeile = await page.$('[data-chat="c2"]');
    const kasten = await zeile.boundingBox();
    await page.mouse.move(kasten.x + kasten.width / 2, kasten.y + kasten.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(700);
    await page.mouse.up();
    await page.waitForTimeout(400);
    await page.click('[data-copt="einstellungen"]');
    await page.waitForTimeout(500);
  };

  const zu = async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    await page.evaluate(() => document.querySelector('.sheet-backdrop')?.remove());
    await page.waitForTimeout(300);
  };

  console.log('\nChat-Einstellungen');

  await pruefe('Das Blatt zeigt, um wen es geht', async () => {
    await optionen();
    const name = await page.$eval('.chatopt__name', (n) => n.textContent.trim());
    if (name !== 'Bob Müller') throw new Error('steht „' + name + '"');
  });

  await pruefe('Es steht mehr darin als die frueheren sechs Punkte', async () => {
    const punkte = await page.$$eval('.sheet .item', (n) => n.length);
    if (punkte < 10) throw new Error('nur ' + punkte + ' Punkte');
  });

  await pruefe('Die Punkte sind in Abschnitte sortiert', async () => {
    const koepfe = await page.$$eval('.sheet .listhead', (n) => n.map((x) => x.textContent.trim()));
    for (const noetig of ['Benachrichtigungen', 'Datenschutz', 'Inhalt', 'Verwalten']) {
      if (!koepfe.includes(noetig)) throw new Error('„' + noetig + '" fehlt: ' + koepfe.join(' | '));
    }
  });

  await pruefe('„Chat sperren" gibt es überhaupt', async () => {
    if (!(await page.$('[data-chatopt="sperren"]'))) throw new Error('kein Schalter');
  });

  await pruefe('„Chat sperren" merkt sich seinen Stand', async () => {
    await page.click('[data-chatopt="sperren"]');
    await page.waitForTimeout(500);
    const an = await page.$eval('[data-chatopt="sperren"]', (n) => n.classList.contains('is-on'));
    if (!an) throw new Error('der Schalter bleibt aus');

    await zu();
    await optionen();
    const nochAn = await page.$eval('[data-chatopt="sperren"]', (n) => n.classList.contains('is-on'));
    if (!nochAn) throw new Error('nach dem erneuten Öffnen wieder aus — das ist keine echte Funktion');
  });

  await pruefe('Ein gesperrter Chat zeigt in der Liste keine Vorschau', async () => {
    await zu();
    await zurListe();
    const zeile = await page.$eval('[data-chat="c2"]', (n) => n.textContent);
    if (zeile.includes('Schicke dir die Datei')) throw new Error('die Vorschau steht weiter da');
    if (!zeile.includes('Gesperrt')) throw new Error('kein Hinweis auf die Sperre');
  });

  await pruefe('Ein gesperrter Chat fragt vor dem Öffnen nach', async () => {
    await page.click('[data-chat="c2"]');
    await page.waitForTimeout(500);
    const nachfrage = await page.$('#nachfrageJa');
    if (!nachfrage) throw new Error('er geht ohne Nachfrage auf');
    await page.click('#nachfrageNein');
    await page.waitForTimeout(400);
    if (await page.$('#chatBack')) throw new Error('„Abbrechen" öffnet den Chat trotzdem');
  });

  await pruefe('Nach „Öffnen" geht der Chat auf', async () => {
    await page.click('[data-chat="c2"]');
    await page.waitForTimeout(400);
    await page.click('#nachfrageJa');
    await page.waitForTimeout(700);
    if (!(await page.$('#chatBack'))) throw new Error('er bleibt zu');
    await page.click('#chatBack');
    await page.waitForTimeout(400);
  });

  await pruefe('Die Sperre laesst sich wieder aufheben', async () => {
    await optionen();
    await page.click('[data-chatopt="sperren"]');
    await page.waitForTimeout(500);
    await zu();
    await zurListe();
    const zeile = await page.$eval('[data-chat="c2"]', (n) => n.textContent);
    if (zeile.includes('Gesperrt')) throw new Error('die Sperre steht noch');
  });

  await pruefe('„Stumm" merkt sich seinen Stand', async () => {
    await optionen();
    await page.click('[data-chatopt="stumm"]');
    await page.waitForTimeout(500);
    await zu();
    await optionen();
    const an = await page.$eval('[data-chatopt="stumm"]', (n) => n.classList.contains('is-on'));
    if (!an) throw new Error('nach dem erneuten Öffnen wieder aus');
  });

  await pruefe('Ein langes Blatt scrollt, statt oben aus dem Bild zu laufen', async () => {
    const { hoehe, inhalt, scrollt } = await page.$eval('.sheet', (n) => ({
      hoehe: n.getBoundingClientRect().height,
      inhalt: n.scrollHeight,
      scrollt: getComputedStyle(n).overflowY,
    }));
    if (hoehe > 844) throw new Error('das Blatt ist ' + Math.round(hoehe) + 'px hoch');
    if (inhalt > hoehe + 1 && scrollt !== 'auto' && scrollt !== 'scroll') {
      throw new Error('der Inhalt passt nicht und das Blatt scrollt nicht');
    }
  });

  await pruefe('„Mitteilungen" merkt sich seinen Stand', async () => {
    await page.locator('[data-chatopt="mitteilungen"]').scrollIntoViewIfNeeded();
    await page.click('[data-chatopt="mitteilungen"]');
    await page.waitForTimeout(500);
    await zu();
    await optionen();
    const an = await page.$eval('[data-chatopt="mitteilungen"]', (n) => n.classList.contains('is-on'));
    if (an) throw new Error('nach dem erneuten Öffnen wieder an');
  });

  await pruefe('„Melden" fragt nach einem Grund statt nur zu bestätigen', async () => {
    await page.click('[data-chatopt-aktion="melden"]');
    await page.waitForTimeout(500);
    if (!(await page.$('#f_grund'))) throw new Error('kein Feld für den Grund');
    await page.fill('#f_grund', 'Unerwünschte Werbung');
    await page.click('#formOk');
    await page.waitForTimeout(600);
    const toast = await page.$eval('#toast', (n) => (n.hidden ? '' : n.textContent));
    if (!toast.includes('angekommen')) throw new Error('Toast sagt „' + toast + '"');
  });

  await pruefe('„Blockieren" wirkt und laesst sich wieder aufheben', async () => {
    await zu();
    await optionen();
    await page.click('[data-chatopt="blockieren"]');
    await page.waitForTimeout(600);
    const text = await page.$eval('[data-chatopt="blockieren"]', (n) => n.textContent.trim());
    if (text !== 'Blockierung aufheben') throw new Error('der Knopf sagt „' + text + '"');
    await page.click('[data-chatopt="blockieren"]');
    await page.waitForTimeout(600);
    const zurueck = await page.$eval('[data-chatopt="blockieren"]', (n) => n.textContent.trim());
    if (zurueck !== 'Blockieren') throw new Error('der Knopf sagt „' + zurueck + '"');
    await zu();
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
