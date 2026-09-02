// Prueft die drei Knoepfe oben rechts im eigenen Profil - Glocke, Plus und
// Menue - in beiden Bereichen, die sie im Prototyp haben.
//
// Prototyp-Frames: "VP + Mitteilung", "VP + erstellen", "VP + Einstellung"
// und die Gegenstuecke "CP + ..." im Community-Profil.
//
// Start:  node test/_erstellen.js   (Server muss laufen)
//         ZIEL=https://all-media-website.onrender.com node test/_erstellen.js

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen } = require('./_konto');
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
      ergebnisse.push({ ok: true, name });
      console.log('  OK   ' + name);
    } catch (e) {
      ergebnisse.push({ ok: false, name, grund: e.message });
      console.log('  FEHL ' + name + ' — ' + (e.message || 'kein Treffer'));
    }
  };

  /*
   * Zu einem Bildschirm wechseln.
   *
   * Feste Wartezeiten reichen hier nicht mehr: jeder Bildschirm holt seine
   * Inhalte aus der Datenbank, und wie lange das dauert, haengt vom Netz ab.
   * Frueher lagen die Inhalte im Arbeitsspeicher des Servers und waren
   * sofort da. Deshalb wird gewartet, bis wirklich etwas dasteht — und ein
   * offenes Blatt vorher weggeraeumt, sonst faengt es die Klicks ab.
   */
  const gehe = async (area, sub) => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await page.click(`[data-area="${area}"]`);
    await page.waitForTimeout(300);
    if (sub) {
      await page.click(`[data-sub="${sub}"]`);
      await page.waitForFunction(
        () => (document.querySelector('#main')?.textContent || '').trim().length > 0,
        null, { timeout: 8000 }
      ).catch(() => {});
      await page.waitForTimeout(300);
    }
  };

  const erstellen = async (punkt) => {
    /*
     * Erst wegraeumen, was noch offen ist.
     *
     * Schlaegt eine Pruefung fehl, bleibt ihr Blatt stehen. Seine Flaeche
     * liegt ueber dem Plus-Knopf, und jede folgende Pruefung wartet dann
     * dreissig Sekunden auf einen Klick, der nie ankommt - aus einem Fehler
     * werden vier. Siehe dieselbe Stelle in test/_kontaktinfo.js.
     */
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await page.click('[data-oact="create"]');
    await page.waitForSelector('.erstellen', { timeout: 3000 });
    await page.click(`[data-erstellen="${punkt}"]`);
  };

  /**
   * Den Hinweis unten abholen, den eine Aktion ausloest.
   *
   * Der Hinweis blendet sich nach 2,2 Sekunden selbst aus. Wer erst danach
   * nachsieht, findet ein leeres Feld und meldet einen Fehler, den es nicht
   * gab. Deshalb: vorher leeren, dann warten, bis etwas dasteht.
   */
  const hinweisNach = async (tue) => {
    await page.evaluate(() => {
      const t = document.querySelector('#toast');
      if (t) { t.textContent = ''; t.hidden = true; }
    });
    await tue();
    await page.waitForFunction(
      () => { const t = document.querySelector('#toast'); return t && !t.hidden && t.textContent.trim().length > 0; },
      null, { timeout: 10000 }
    ).catch(() => {});
    return page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
  };

  /* ------------------------------------------------------------ Glocke */
  console.log('\nGlocke — Mitteilungen');
  await gehe('videos', 'profile');

  await pruefe('Roter Punkt zeigt ungelesene Mitteilungen', async () => {
    // Die Zahl der ungelesenen Mitteilungen kommt vom Server, nicht aus dem
    // ersten Aufbau der Seite — der Punkt erscheint deshalb kurz danach.
    await page.waitForSelector('.oprof__dot', { timeout: 8000 })
      .catch(() => { throw new Error('kein Punkt an der Glocke'); });
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
    await page.waitForFunction(
      () => { const o = document.querySelector('#overlay'); return o && !o.hidden && o.innerHTML.length > 0; },
      null, { timeout: 8000 }
    ).catch(() => { throw new Error('kein Profil geoeffnet'); });
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
    await page.waitForFunction(() => !document.querySelector('.oprof__dot'), null, { timeout: 8000 })
      .catch(() => { throw new Error('Punkt ist noch da'); });
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

  await pruefe('Die neun Punkte stehen wie im Prototyp', async () => {
    await page.click('[data-oact="create"]');
    await page.waitForSelector('.erstellen', { timeout: 3000 });
    const punkte = await page.$$eval('.erstellen__punkt', (els) => els.map((e) => e.textContent.trim()));
    // Punkt 45: Livestream steht direkt unter Story - beides ist im
    // Augenblick aufgenommen. Highlight und Playlist sortieren dagegen
    // vorhandene Beitraege und stehen darum darunter.
    // Die Umfrage kam am 01.09.2026 aus dem Handbuch dazu und steht hinter
    // dem Livestream — sie darf die Nachbarschaft Story/Livestream nicht
    // zerreissen.
    const soll = ['Reels', 'Querformat', 'Beitrag', 'Story', 'Livestream', 'Umfrage', 'Highlight', 'Playlist', 'Spendenaktion'];
    if (JSON.stringify(punkte) !== JSON.stringify(soll)) throw new Error(punkte.join(' | '));
    await page.click('[data-sheet-close]');
  });

  await pruefe('Highlight anlegen erscheint sofort im Profil', async () => {
    await erstellen('highlight');
    await page.waitForSelector('#f_name', { timeout: 3000 });
    await page.fill('#f_name', 'Sommer');
    await page.click('#formOk');
    // Das Highlight wird in der Datenbank angelegt und das Profil danach neu
    // geladen — 800 ms waren dafuer eine Wette.
    await page.waitForFunction(
      () => [...document.querySelectorAll('.highlight__label')].some((n) => n.textContent === 'Sommer'),
      null, { timeout: 10000 }
    ).catch(() => {});
    const labels = await page.$$eval('.highlight__label', (els) => els.map((e) => e.textContent));
    if (!labels.includes('Sommer')) throw new Error(labels.join(' | '));
  });

  await pruefe('Derselbe Name wird kein zweites Mal angelegt', async () => {
    await erstellen('highlight');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Sommer');
    const hinweis = await hinweisNach(() => page.click('#formOk'));
    if (!/schon/.test(hinweis)) throw new Error('Hinweis war: ' + hinweis);
    await page.click('[data-sheet-close]');
  });

  await pruefe('Playlist anlegen erscheint im Profil', async () => {
    await erstellen('playlist');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Beste Momente');
    await page.click('#formOk');
    await page.waitForFunction(
      () => [...document.querySelectorAll('.highlight__label')].some((n) => n.textContent === 'Beste Momente'),
      null, { timeout: 10000 }
    ).catch(() => {});
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
    // Der Beitrag geht erst in die Datenbank, dann wird der Feed neu gebaut.
    // 1200 ms waren dafuer eine Wette: unter Last stand der Text noch nicht da,
    // und der Fehlschlag liess das Blatt offen - alle folgenden Pruefungen
    // liefen danach in einen Klick-Timeout.
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('.post__desc')].some((e) => e.textContent.includes('Testbeitrag aus der Pruefung')),
        null,
        { timeout: 15000 }
      )
      .catch(() => {});

    const texte = await page.$$eval('.post__desc', (els) => els.map((e) => e.textContent));
    if (!texte.some((t) => t.includes('Testbeitrag aus der Pruefung'))) throw new Error(texte.slice(0, 2).join(' | '));

    const mitBild = await page.$$eval('.post__media img.eigenbild', (els) => els.length);
    if (mitBild < 1) throw new Error('das aufgenommene Bild wird nicht angezeigt');

    await gehe('videos', 'profile');
    await page.waitForFunction(
      () => document.querySelectorAll('.griditem img.eigenbild').length > 0,
      null, { timeout: 10000 }
    ).catch(() => { throw new Error('im eigenen Raster fehlt das Bild'); });
  });

  await pruefe('Spendenaktion erscheint mit Fortschrittsbalken im Profil', async () => {
    await erstellen('spende');
    await page.waitForSelector('#f_titel', { timeout: 3000 });
    await page.fill('#f_titel', 'Bäume für den Park');
    await page.fill('#f_ziel', '500');
    await page.fill('#f_text', 'Zwanzig Bäume für den Stadtpark.');
    await page.click('#formOk');
    // Die Aktion geht erst in die Datenbank, dann wird das Profil neu geholt.
    // Feste Wartewerte trafen in der Kette noch die vorige Spendenaktion.
    await page
      .waitForFunction(
        (t) => document.querySelector('.spende__titel')?.textContent === t,
        'Bäume für den Park', { timeout: 15000 }
      )
      .catch(() => {});
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
    await page
      .waitForFunction(
        (t) => document.querySelector('.spende__titel')?.textContent === t,
        'Ohne Ziel', { timeout: 15000 }
      )
      .catch(() => {});
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
    await page
      .waitForFunction(
        () => {
          const t = document.querySelector('#toast');
          return t && !t.hidden && t.textContent.trim();
        },
        null, { timeout: 10000 }
      )
      .catch(() => {});
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
    // Die Aufzeichnung wird als Beitrag in der Datenbank angelegt und danach
    // frisch geladen — das dauert laenger als der fruehere Eintrag im
    // Arbeitsspeicher des Servers.
    await page.waitForFunction(
      () => [...document.querySelectorAll('.clip__title')]
        .some((e) => e.textContent.includes('Livestream-Aufzeichnung')),
      null, { timeout: 10000 }
    ).catch(() => {
      throw new Error('keine Aufzeichnung im Querformat');
    });
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
    await page.waitForFunction(
      () => (document.querySelector('#main')?.textContent || '').includes('Nachtschicht'),
      null, { timeout: 10000 }
    ).catch(() => { throw new Error('Kanal steht nicht im Profil'); });
  });

  await pruefe('Denselben Kanal gibt es kein zweites Mal', async () => {
    await erstellen('kanal');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Nachtschicht');
    await page.fill('#f_thema', 'Doppelt');
    const hinweis = await hinweisNach(() => page.click('#formOk'));
    if (!/schon/.test(hinweis)) throw new Error('Hinweis war: ' + hinweis);
    await page.click('[data-sheet-close]');
  });

  /* ---------------------------------------------------------- Abschluss */
  await zuruecksetzen(page);
  await page.evaluate(() => localStorage.removeItem('am-eigene-medien'));

  const fehlgeschlagen = ergebnisse.filter((e) => !e.ok);
  const eindeutig = [...new Set(browserFehler)];

  console.log(`\n${ergebnisse.length - fehlgeschlagen.length} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await browser.close();
  process.exit(fehlgeschlagen.length || eindeutig.length ? 1 : 0);
})();
