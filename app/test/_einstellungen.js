// Prueft, dass in den Einstellungen kein Punkt mehr nur einen Hinweis
// ausgibt: Auswahl, Formular, Liste, Erklaertext und Nachfrage.
//
// Start:  node test/_einstellungen.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');

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
  await page.evaluate(() => localStorage.removeItem('am-einstellungen'));
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

  const zuDenEinstellungen = async () => {
    await page.click('[data-area="settings"]');
    await page.waitForTimeout(600);
  };

  const blattZu = async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  };

  await zuDenEinstellungen();

  console.log('\nEinstellungen');

  await pruefe('Die Sprungleiste zeigt alle neun Abschnitte', async () => {
    const pillen = await page.$$eval('.pill', (els) => els.map((e) => e.textContent));
    if (pillen.length !== 9) throw new Error(pillen.join(' | '));
    if (pillen[0] !== 'Allgemein') throw new Error(pillen.join(' | '));
  });

  await pruefe('Auswahlpunkte zeigen ihren Stand gleich in der Liste', async () => {
    const werte = await page.$$eval('.item__value', (els) => els.map((e) => e.textContent));
    if (werte.length < 10) throw new Error('nur ' + werte.length + ' Werte');
  });

  await pruefe('Eine Auswahl lässt sich ändern und bleibt stehen', async () => {
    await page.click('[data-setting="Zuletzt online"]');
    await page.waitForSelector('[data-wahl]');
    const moeglich = await page.$$eval('[data-wahl]', (els) => els.map((e) => e.dataset.wahl));
    if (moeglich.length !== 3) throw new Error(moeglich.join(' | '));
    await page.click('[data-wahl="Niemand"]');
    await page.waitForTimeout(700);
    const jetzt = await page.$eval('[data-setting="Zuletzt online"] .item__value', (e) => e.textContent);
    if (jetzt !== 'Niemand') throw new Error(jetzt);
  });

  await pruefe('Die Auswahl übersteht einen Neustart der Seite', async () => {
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await zuDenEinstellungen();
    const jetzt = await page.$eval('[data-setting="Zuletzt online"] .item__value', (e) => e.textContent);
    if (jetzt !== 'Niemand') throw new Error(jetzt);
  });

  await pruefe('Ein Formular prüft seine Eingaben', async () => {
    await page.click('[data-setting="Sicherheits-/Entsperrcode"]');
    await page.waitForSelector('#f_code');
    await page.fill('#f_code', '12');
    await page.fill('#f_wdh', '12');
    await page.click('#formOk');
    await page.waitForTimeout(400);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('4 bis 8')) throw new Error(hinweis);
  });

  await pruefe('Zwei verschiedene Eingaben werden abgelehnt', async () => {
    await page.fill('#f_code', '1234');
    await page.fill('#f_wdh', '5678');
    await page.click('#formOk');
    await page.waitForTimeout(400);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('überein')) throw new Error(hinweis);
  });

  await pruefe('Ein richtiger Code wird angenommen', async () => {
    await page.fill('#f_code', '1234');
    await page.fill('#f_wdh', '1234');
    await page.click('#formOk');
    await page.waitForTimeout(600);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (hinweis !== 'Code gesetzt') throw new Error(hinweis);
  });

  await pruefe('Ein Listenpunkt zeigt echte Einträge', async () => {
    await page.click('[data-setting="Speicher verwalten"]');
    await page.waitForTimeout(600);
    const zeilen = await page.$$eval('.sheet .item__label', (els) => els.map((e) => e.textContent));
    if (!zeilen.includes('Chats')) throw new Error(zeilen.join(' | '));
    await blattZu();
  });

  await pruefe('Ein Erklärtext geht auf', async () => {
    await page.click('[data-setting="Datenschutzerklärung"]');
    await page.waitForSelector('.sheet__text');
    const text = await page.$eval('.sheet__text', (e) => e.textContent);
    if (text.length < 60) throw new Error('Text zu kurz: ' + text);
    await blattZu();
  });

  await pruefe('Konto löschen fragt erst nach', async () => {
    await page.click('[data-setting="Konto löschen"]');
    await page.waitForSelector('#loeschJa');
    await page.click('#loeschJa');
    await page.waitForTimeout(500);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('vorgemerkt')) throw new Error(hinweis);
  });

  await pruefe('Kein Punkt gibt mehr "folgt mit dem Backend" aus', async () => {
    const knoepfe = await page.$$eval('[data-setting]', (els) => els.map((e) => e.dataset.setting));
    const uebrig = [];

    for (const label of knoepfe) {
      if (label === 'Abmelden') continue;
      await page.evaluate(() => {
        const t = document.querySelector('#toast');
        if (t) { t.textContent = ''; t.hidden = true; }
      });
      await page.click(`[data-setting="${label}"]`);
      await page.waitForTimeout(350);
      const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
      if (/\bfolgt\b|\bfolgen\b|Phase 3/i.test(hinweis)) uebrig.push(`${label}: ${hinweis}`);

      await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));
      await page.waitForTimeout(120);
    }

    if (uebrig.length) throw new Error(uebrig.join(' | '));
  });

  await page.evaluate(() => localStorage.removeItem('am-einstellungen'));
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehler || eindeutig.length ? 1 : 0);
})();
