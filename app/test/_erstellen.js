// Prueft die drei Knoepfe oben rechts im eigenen Profil - Glocke, Plus und
// Menue - in beiden Bereichen, die sie im Prototyp haben.
//
// Prototyp-Frames: "VP + Mitteilung", "VP + erstellen", "VP + Einstellung"
// und die Gegenstuecke "CP + ..." im Community-Profil.
//
// Start:  node test/_erstellen.js   (Server muss laufen)
//         ZIEL=https://all-media-website.onrender.com node test/_erstellen.js

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

// Winziges Testbild fuer "Beitrag erstellen".
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

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.removeItem('am-eigene-medien'));
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  const ergebnisse = [];
  const pruefe = async (name, fn) => {
    try {
      await fn();
      ergebnisse.push({ ok: true, name });
      console.log('  OK   ' + name);
    } catch (e) {
      ergebnisse.push({ ok: false, name, grund: e.message });
      console.log('  FEHL ' + name + ' — ' + (e.message || 'kein Treffer'));
    }
  };

  const gehe = async (area, sub) => {
    await page.click(`[data-area="${area}"]`);
    await page.waitForTimeout(300);
    if (sub) {
      await page.click(`[data-sub="${sub}"]`);
      await page.waitForTimeout(400);
    }
  };

  const erstellen = async (punkt) => {
    await page.click('[data-oact="create"]');
    await page.waitForSelector('.erstellen', { timeout: 3000 });
    await page.click(`[data-erstellen="${punkt}"]`);
  };

  /* ------------------------------------------------------------ Glocke */
  console.log('\nGlocke — Mitteilungen');
  await gehe('videos', 'profile');

  await pruefe('Roter Punkt zeigt ungelesene Mitteilungen', async () => {
    if (!(await page.$('.oprof__dot'))) throw new Error('kein Punkt an der Glocke');
  });

  await pruefe('Glocke oeffnet die Liste mit Text und Zeitangabe', async () => {
    await page.click('[data-oact="bell"]');
    await page.waitForSelector('.mitt-liste', { timeout: 3000 });
    const zeilen = await page.$$eval('.mitt', (els) =>
      els.map((e) => ({
        text: e.querySelector('.mitt__text').textContent.trim(),
        zeit: e.querySelector('.mitt__zeit').textContent.trim(),
      }))
    );
    if (zeilen.length < 5) throw new Error('nur ' + zeilen.length + ' Eintraege');
    if (!zeilen.every((z) => z.text && /^vor /.test(z.zeit))) throw new Error('Text oder Zeit fehlt');
  });

  await pruefe('Antippen fuehrt zum Profil, aus dem die Mitteilung stammt', async () => {
    await page.click('.mitt[data-ziel-art="profile"]');
    await page.waitForTimeout(800);
    const offen = await page.$eval('#overlay', (e) => !e.hidden && e.innerHTML.length > 0);
    if (!offen) throw new Error('kein Profil geoeffnet');
    await page.evaluate(() => {
      const o = document.querySelector('#overlay');
      o.hidden = true;
      o.innerHTML = '';
    });
  });

  await pruefe('Alle als gelesen markieren nimmt den roten Punkt weg', async () => {
    await gehe('videos', 'profile');
    await page.click('[data-oact="bell"]');
    await page.waitForSelector('.mitt-liste');
    await page.click('#mittAlle');
    await page.waitForTimeout(600);
    if (await page.$('.oprof__dot')) throw new Error('Punkt ist noch da');
  });

  /* ------------------------------------------------------------- Menue */
  console.log('\nMenue — Einstellungen des Bereichs');

  await pruefe('Menue im Video-Profil springt zum Abschnitt Videos', async () => {
    await gehe('videos', 'profile');
    await page.click('[data-oact="menu"]');
    await page.waitForTimeout(700);
    const bereich = await page.$eval('.navbtn.is-active', (e) => e.dataset.area);
    if (bereich !== 'settings') throw new Error('Bereich ist ' + bereich);
    if (!(await page.$('#sec-videos'))) throw new Error('Abschnitt Videos fehlt');
  });

  await pruefe('Menue im Community-Profil springt zum Abschnitt Communitys', async () => {
    await gehe('communities', 'profile');
    await page.click('[data-oact="menu"]');
    await page.waitForTimeout(700);
    if (!(await page.$('#sec-communitys'))) throw new Error('Abschnitt Communitys fehlt');
  });

  /* --------------------------------------------------------- Erstellen */
  console.log('\nPlus — Erstellen');
  await gehe('videos', 'profile');

  await pruefe('Die acht Punkte stehen wie im Prototyp', async () => {
    await page.click('[data-oact="create"]');
    await page.waitForSelector('.erstellen', { timeout: 3000 });
    const punkte = await page.$$eval('.erstellen__punkt', (els) => els.map((e) => e.textContent.trim()));
    const soll = ['Reels', 'Querformat', 'Beitrag', 'Story', 'Highlight', 'Playlist', 'Livestream', 'Spendenaktion'];
    if (JSON.stringify(punkte) !== JSON.stringify(soll)) throw new Error(punkte.join(' | '));
    await page.click('[data-sheet-close]');
  });

  await pruefe('Highlight anlegen erscheint sofort im Profil', async () => {
    await erstellen('highlight');
    await page.waitForSelector('#f_name', { timeout: 3000 });
    await page.fill('#f_name', 'Sommer');
    await page.click('#formOk');
    await page.waitForTimeout(800);
    const labels = await page.$$eval('.highlight__label', (els) => els.map((e) => e.textContent));
    if (!labels.includes('Sommer')) throw new Error(labels.join(' | '));
  });

  await pruefe('Derselbe Name wird kein zweites Mal angelegt', async () => {
    await erstellen('highlight');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Sommer');
    await page.click('#formOk');
    await page.waitForTimeout(500);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!/schon/.test(hinweis)) throw new Error('Hinweis war: ' + hinweis);
    await page.click('[data-sheet-close]');
  });

  await pruefe('Playlist anlegen erscheint im Profil', async () => {
    await erstellen('playlist');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Beste Momente');
    await page.click('#formOk');
    await page.waitForTimeout(800);
    const labels = await page.$$eval('.highlight__label', (els) => els.map((e) => e.textContent));
    if (!labels.includes('Beste Momente')) throw new Error(labels.join(' | '));
  });

  await pruefe('Beitrag mit Foto landet im Feed und im eigenen Raster', async () => {
    const wartet = page.waitForEvent('filechooser');
    await erstellen('post');
    const auswahl = await wartet;
    await auswahl.setFiles(BILD);

    await page.waitForSelector('#f_beschreibung', { timeout: 3000 });
    await page.fill('#f_beschreibung', 'Testbeitrag aus der Pruefung');
    await page.fill('#f_ort', 'Köln');
    await page.click('#formOk');
    await page.waitForTimeout(1200);

    const texte = await page.$$eval('.post__desc', (els) => els.map((e) => e.textContent));
    if (!texte.some((t) => t.includes('Testbeitrag aus der Pruefung'))) throw new Error(texte.slice(0, 2).join(' | '));

    const mitBild = await page.$$eval('.post__media img.eigenbild', (els) => els.length);
    if (mitBild < 1) throw new Error('das aufgenommene Bild wird nicht angezeigt');

    await gehe('videos', 'profile');
    const rasterBilder = await page.$$eval('.griditem img.eigenbild', (els) => els.length);
    if (rasterBilder < 1) throw new Error('im eigenen Raster fehlt das Bild');
  });

  await pruefe('Spendenaktion erscheint mit Fortschrittsbalken im Profil', async () => {
    await erstellen('spende');
    await page.waitForSelector('#f_titel', { timeout: 3000 });
    await page.fill('#f_titel', 'Bäume für den Park');
    await page.fill('#f_ziel', '500');
    await page.fill('#f_text', 'Zwanzig Bäume für den Stadtpark.');
    await page.click('#formOk');
    await page.waitForTimeout(800);
    const titel = await page.$eval('.spende__titel', (e) => e.textContent);
    if (titel !== 'Bäume für den Park') throw new Error(titel);
    const zahlen = await page.$eval('.spende__zahlen', (e) => e.textContent);
    if (!zahlen.includes('500')) throw new Error(zahlen);
  });

  /*
   * Frueher stand hier "Spendenziel ohne Betrag wird abgelehnt". Henrik hat
   * am 26.08.2026 gemeldet, dass das Ziel freiwillig sein soll (Punkt 44) -
   * nicht jede Sammlung laeuft auf einen Betrag zu. Die Pruefung dreht sich
   * deshalb um: ohne Ziel muss es gehen, und unsinnige Eingaben muessen
   * weiterhin abgelehnt werden.
   */
  await pruefe('Eine Spendenaktion geht auch ohne Ziel', async () => {
    await erstellen('spende');
    await page.waitForSelector('#f_titel');
    await page.fill('#f_titel', 'Ohne Ziel');
    await page.click('#formOk');
    await page.waitForTimeout(900);
    const titel = await page.$eval('.spende__titel', (e) => e.textContent);
    if (titel !== 'Ohne Ziel') throw new Error('es steht „' + titel + '"');
    // Ohne Ziel gibt es keinen Balken - er haette keine Bezugsgroesse.
    if (await page.$('.spende__balken')) throw new Error('der Balken steht ohne Ziel da');
  });

  await pruefe('Ein unsinniges Spendenziel wird weiterhin abgelehnt', async () => {
    await erstellen('spende');
    await page.waitForSelector('#f_titel');
    await page.fill('#f_titel', 'Mit Unsinn');
    await page.fill('#f_ziel', '-5');
    await page.click('#formOk');
    await page.waitForTimeout(500);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis) throw new Error('kein Hinweis');
    await page.click('[data-sheet-close]');
  });

  await pruefe('Livestream laeuft und hinterlaesst die Aufzeichnung', async () => {
    await gehe('videos', 'profile');
    await erstellen('livestream');
    await page.waitForSelector('.live__marke', { timeout: 3000 });
    await page.waitForTimeout(1300);
    const zeit = await page.$eval('#liveZeit', (e) => e.textContent);
    if (zeit === '00:00') throw new Error('die Zeit laeuft nicht');
    await page.click('#liveStop');
    await page.waitForTimeout(1000);
    const titel = await page.$$eval('.clip__title', (els) => els.map((e) => e.textContent));
    if (!titel.includes('Livestream-Aufzeichnung')) throw new Error(titel.slice(0, 3).join(' | '));
  });

  /* -------------------------------------------------------- Communitys */
  console.log('\nCommunity-Profil');

  await pruefe('Community-Glocke zeigt eigene Mitteilungen', async () => {
    await gehe('communities', 'profile');
    await page.click('[data-oact="bell"]');
    await page.waitForSelector('.mitt-liste', { timeout: 3000 });
    const texte = await page.$$eval('.mitt__text', (els) => els.map((e) => e.textContent));
    if (texte.length < 3) throw new Error('nur ' + texte.length);
    if (!texte.some((t) => t.includes('Kanal') || t.includes('beigetreten'))) throw new Error(texte.join(' | '));
    await page.click('[data-sheet-close]');
  });

  await pruefe('Neuen Kanal erstellen legt ihn unter Erstellt an', async () => {
    await erstellen('kanal');
    await page.waitForSelector('#f_name', { timeout: 3000 });
    await page.fill('#f_name', 'Nachtschicht');
    await page.fill('#f_thema', 'Alles nach 22 Uhr');
    await page.click('#formOk');
    await page.waitForTimeout(1000);
    const text = await page.$eval('#main', (e) => e.textContent);
    if (!text.includes('Nachtschicht')) throw new Error('Kanal steht nicht im Profil');
  });

  await pruefe('Denselben Kanal gibt es kein zweites Mal', async () => {
    await erstellen('kanal');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Nachtschicht');
    await page.fill('#f_thema', 'Doppelt');
    await page.click('#formOk');
    await page.waitForTimeout(500);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!/schon/.test(hinweis)) throw new Error('Hinweis war: ' + hinweis);
    await page.click('[data-sheet-close]');
  });

  /* ---------------------------------------------------------- Abschluss */
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
  await page.evaluate(() => localStorage.removeItem('am-eigene-medien'));

  const fehlgeschlagen = ergebnisse.filter((e) => !e.ok);
  const eindeutig = [...new Set(browserFehler)];

  console.log(`\n${ergebnisse.length - fehlgeschlagen.length} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehlgeschlagen.length || eindeutig.length ? 1 : 0);
})();
