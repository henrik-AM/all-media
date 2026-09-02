// Prueft die Kontaktinfo im Messenger nach dem Prototyp-Frame
// "MC + Kontakteinstellungen" - und den Gruppenanruf.
//
// Start:  node test/_kontaktinfo.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen } = require('./_konto');
const K = require('./_kennungen');

const { chatOffen } = require('./_warten');
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
  /*
   * Nur die eigenen Einträge wegräumen, nicht den ganzen Speicher.
   *
   * Seit dem 31.08.2026 liegt dort auch das Zugangstoken von Supabase.
   * localStorage.clear() meldete den Prüflauf deshalb ab: die Seite zeigte
   * ab da den Anmeldebildschirm, und alle zehn Prüfungen fielen mit
   * "waiting for [data-area=messenger]" um — ein Fehler, der nichts mit dem
   * Geprüften zu tun hatte.
   */
  await page.evaluate(() => {
    for (const schluessel of Object.keys(localStorage)) {
      if (schluessel.startsWith('allmedia.') || schluessel.startsWith('am-')) {
        localStorage.removeItem(schluessel);
      }
    }
  });
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

  const imChat = async (chatId) => {
    // Erst zurueck: das offene Fenster liegt sonst ueber der unteren Leiste.
    await page.click('#kpBack').catch(() => {});
    await page.click('#chatBack').catch(() => {});
    /*
     * Und was danach noch offen ist, wegraeumen.
     *
     * Die Knoepfe oben helfen nur, wenn sie da sind. Bleibt ein Blatt offen
     * — etwa weil eine Pruefung vorher fehlschlug —, liegt seine Flaeche
     * ueber der unteren Leiste, und der naechste Klick wartet acht Sekunden
     * auf einen Knopf, den er nie erreicht. Der Prueflauf meldete dann
     * lauter Folgefehler statt des einen echten.
     */
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await page.waitForTimeout(300);
    await page.click('[data-area="messenger"]');
    await page.waitForTimeout(300);
    // chatId ist jetzt ein Name, kein "c1" mehr: Chats bekommen ihre
    // Kennung beim Anlegen in der Datenbank. Siehe test/_kennungen.js.
    await page.click(await K.waehlerChat(page, chatId));
    await chatOffen(page);
  };

  const zurKontaktinfo = async () => {
    await imChat('Anna Schmidt');
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
    // Die Kontaktinfo wird nach dem Umschalten neu aufgebaut und holt sich
    // dafuer Profil und Chatmedien vom Server. 800 ms waren dafuer eine
    // Wette: mal stand der neue Wert da, mal noch der alte.
    await page
      .waitForFunction(
        (alt) => {
          const e = document.querySelector('[data-kp-item="Benachrichtigungen"] .kp__zeileWert');
          return e && e.textContent !== alt;
        },
        vorher,
        { timeout: 10000 }
      )
      .catch(() => {});
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
    await imChat('Anna Schmidt');
    const blasen = await page.$$('[data-msgid]');
    const rahmen = await blasen[1].boundingBox();
    await page.mouse.move(rahmen.x + rahmen.width / 2, rahmen.y + rahmen.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();

    /*
     * Seit dem Handbuch-Abgleich am 01.09.2026 setzt langes Druecken nicht
     * mehr sofort einen Stern, sondern oeffnet das Nachrichtenmenue. Der
     * Stern ist dort ein Punkt unter sieben. Das ist kein Umweg, sondern der
     * Grund fuer das Menue: bearbeiten, antworten, zitieren, weiterleiten
     * und zuruecknehmen brauchen alle denselben Griff.
     */
    await page.waitForSelector('[data-msgaktion="markieren"]', { timeout: 4000 });
    await page.click('[data-msgaktion="markieren"]');
    await page.waitForTimeout(800);

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
    // Geleert wird in der Datenbank, danach holt die Seite die Zahl neu.
    await page.waitForFunction(
      () => (document.querySelector('[data-kp-item="Speicher verwalten"] .kp__zeileWert')?.textContent ?? '').startsWith('0'),
      null, { timeout: 10000 }
    ).catch(() => {});
    const wert = await page.$eval('[data-kp-item="Speicher verwalten"] .kp__zeileWert', (e) => e.textContent);
    if (!wert.startsWith('0')) throw new Error(wert);
  });

  console.log('\nGruppenanruf');

  await pruefe('Eine Gruppe lässt sich anrufen, alle Mitglieder stehen da', async () => {
    await zuruecksetzen(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await imChat('Projekt Team');
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

  /*
   * Nur die eigenen Einträge wegräumen, nicht den ganzen Speicher.
   *
   * Seit dem 31.08.2026 liegt dort auch das Zugangstoken von Supabase.
   * localStorage.clear() meldete den Prüflauf deshalb ab: die Seite zeigte
   * ab da den Anmeldebildschirm, und alle zehn Prüfungen fielen mit
   * "waiting for [data-area=messenger]" um — ein Fehler, der nichts mit dem
   * Geprüften zu tun hatte.
   */
  await page.evaluate(() => {
    for (const schluessel of Object.keys(localStorage)) {
      if (schluessel.startsWith('allmedia.') || schluessel.startsWith('am-')) {
        localStorage.removeItem(schluessel);
      }
    }
  });
  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehler || eindeutig.length ? 1 : 0);
})();
