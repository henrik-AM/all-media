// Prueft die Kontaktinfo im Messenger nach dem Prototyp-Frame
// "MC + Kontakteinstellungen" - und den Gruppenanruf.
//
// Start:  node test/_kontaktinfo.js   (Server muss laufen)

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
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
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

  const imChat = async (chatId) => {
    // Erst zurueck: das offene Fenster liegt sonst ueber der unteren Leiste.
    await page.click('#kpBack').catch(() => {});
    await page.click('#chatBack').catch(() => {});
    await page.waitForTimeout(300);
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(300);
    await page.click(`[data-chat="${chatId}"]`);
    await page.waitForTimeout(600);
  };

  const zurKontaktinfo = async () => {
    await imChat('c1');
    await page.click('.chathead__body[data-profile]');
    await page.waitForSelector('.kp__zeileText', { timeout: 3000 });
  };

  console.log('\nKontaktinfo');

  await pruefe('Aus dem Chat heraus kommt die Kontaktinfo, nicht das Beitragsprofil', async () => {
    await zurKontaktinfo();
    const titel = await page.$eval('.chathead__name', (e) => e.textContent);
    if (titel !== 'Kontaktinfo') throw new Error(titel);
  });

  await pruefe('Alle Zeilen aus dem Prototyp-Frame stehen da', async () => {
    const zeilen = await page.$$eval('.kp__zeileText', (els) => els.map((e) => e.textContent));
    const soll = [
      'Medien, Links, Doks',
      'Speicher verwalten',
      'Mit Stern markiert',
      'Benachrichtigungen',
      'Chatdesign',
      'In Fotos speichern',
      'Selbstlöschende Nachrichten',
      'Erweiterter Chat-Datenschutz',
      'Verschlüsselung',
      'Kontaktdetails',
      'Kontakt teilen',
      'Chat exportieren',
      'Chat leeren',
    ];
    const fehlt = soll.filter((z) => !zeilen.includes(z));
    if (fehlt.length) throw new Error('fehlt: ' + fehlt.join(', '));
  });

  await pruefe('Die beiden anderen Profile der Person sind erreichbar', async () => {
    const knoepfe = await page.$$eval('.kp__profile button', (els) => els.map((e) => e.textContent.trim()));
    if (knoepfe.length !== 2) throw new Error(knoepfe.join(' | '));
    if (!knoepfe[0].includes('Videos')) throw new Error(knoepfe.join(' | '));
  });

  await pruefe('Benachrichtigungen lassen sich umschalten', async () => {
    const vorher = await page.$eval('[data-kp-item="Benachrichtigungen"] .kp__zeileWert', (e) => e.textContent);
    await page.click('[data-kp-item="Benachrichtigungen"]');
    await page.waitForTimeout(800);
    const nachher = await page.$eval('[data-kp-item="Benachrichtigungen"] .kp__zeileWert', (e) => e.textContent);
    if (vorher === nachher) throw new Error(`bleibt bei ${nachher}`);
  });

  await pruefe('Chatdesign merkt sich die Auswahl', async () => {
    await page.click('[data-kp-item="Chatdesign"]');
    await page.waitForSelector('[data-wahl]');
    await page.click('[data-wahl="Dunkel"]');
    await page.waitForTimeout(700);
    // Der Wert muss schon ohne Neuaufbau stimmen - dafuer einmal zurueck
    // und wieder hinein.
    await zurKontaktinfo();
    const wert = await page.$eval('[data-kp-item="Chatdesign"] .kp__zeileWert', (e) => e.textContent);
    if (wert !== 'Dunkel') throw new Error(wert);
  });

  await pruefe('Lange Drücken markiert eine Nachricht, sie erscheint in der Liste', async () => {
    await imChat('c1');
    const blasen = await page.$$('[data-msgid]');
    const rahmen = await blasen[1].boundingBox();
    await page.mouse.move(rahmen.x + rahmen.width / 2, rahmen.y + rahmen.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();
    await page.waitForTimeout(600);

    const sterne = await page.$$eval('.msg__stern', (els) => els.length);
    if (sterne !== 1) throw new Error(sterne + ' Sterne');

    await page.click('.chathead__body[data-profile]');
    await page.waitForSelector('.kp__zeileText');
    const anzahl = await page.$eval('[data-kp-item="Mit Stern markiert"] .kp__zeileWert', (e) => e.textContent);
    if (anzahl !== '1') throw new Error('Zähler steht auf ' + anzahl);

    await page.click('[data-kp-item="Mit Stern markiert"]');
    await page.waitForTimeout(600);
    const eintraege = await page.$$eval('.sheet .item__label', (els) => els.length);
    if (eintraege !== 1) throw new Error(eintraege + ' Einträge');
    await page.click('[data-sheet-close]');
  });

  await pruefe('Im Chat suchen findet eine Nachricht', async () => {
    await page.click('[data-kp="search"]');
    await page.waitForSelector('#chatSucheFeld');
    await page.fill('#chatSucheFeld', 'Design');
    await page.waitForTimeout(500);
    const treffer = await page.$$eval('#chatSucheListe .item__label', (els) => els.map((e) => e.textContent));
    if (!treffer.length) throw new Error('nichts gefunden');
    if (!treffer.some((t) => /Design/i.test(t))) throw new Error(treffer.join(' | '));
    await page.click('[data-sheet-close]');
  });

  await pruefe('Chat leeren nimmt die Nachrichten weg', async () => {
    await page.click('[data-kp-item="Chat leeren"]');
    await page.waitForTimeout(900);
    const wert = await page.$eval('[data-kp-item="Speicher verwalten"] .kp__zeileWert', (e) => e.textContent);
    if (!wert.startsWith('0')) throw new Error(wert);
  });

  console.log('\nGruppenanruf');

  await pruefe('Eine Gruppe lässt sich anrufen, alle Mitglieder stehen da', async () => {
    await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await imChat('c4');
    await page.click('[data-call="audio"]');
    await page.waitForSelector('.anruf__teilnehmer', { timeout: 3000 });
    const namen = await page.$eval('.anruf__teilnehmer', (e) => e.textContent);
    if (!namen.includes('Anna')) throw new Error(namen);
    const runde = await page.$$eval('.anruf__runde .avatar', (els) => els.length);
    if (runde < 3) throw new Error(runde + ' Bilder');
  });

  await pruefe('Der Gruppenanruf verbindet und zählt die Dauer', async () => {
    await page.waitForTimeout(2600);
    const status = await page.$eval('#anrufStatus', (e) => e.textContent);
    if (!/\d{2}:\d{2}/.test(status)) throw new Error(status);
  });

  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehler || eindeutig.length ? 1 : 0);
})();
