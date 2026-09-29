// Kasten 8 (Feedback 21.09.2026): Ton, Ort/Sound, Drei-Punkte-Menue.
//
// 8.1 "Lautstärke-Button weg ... Ton richtet sich nach der Lautstärke des
//     Handys": kein Tonknopf im Querformat-Player, und das Chat-Vollformat
//     hat keine Browserleiste (controls) mehr — die brachte einen eigenen
//     Stummknopf mit. Das Video dort ist nicht stumm.
// 8.2 "Ort und Sound/Song unter dem Profilnamen sind nicht antippbar": im
//     Querformat-Player stehen sie jetzt unter dem Namen und fuehren zur
//     Standort- bzw. Soundseite. Auch auf der Seite "Alle Fotos" eines Ortes.
// 8.3 prueft test/_optionen.js (Reihenfolge und Aussehen nach TikTok).
//
// Start:  node test/_kasten8.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await kontext.newPage();

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
    await beenden(browser, 1);
  }

  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'load' });
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

  // Ein Clip, der Ort UND Sound mitbringt — sonst prueft 8.2 nur die Haelfte.
  const clip = await page.evaluate(() => {
    const c = state.clips.find((x) => x.location && x.music) || state.clips.find((x) => x.location || x.music);
    return c ? { id: c.id, ort: c.location, sound: c.music } : null;
  });

  const clipOeffnen = async () => {
    await page.evaluate((id) => openClip(id), clip.id);
    await page.waitForSelector('.player__autor', { timeout: 8000 });
  };

  await pruefe('Querformat-Video mit Ort oder Sound im Bestand', async () => {
    if (!clip) throw new Error('kein Clip mit location/music — sonst waere alles Weitere gruen aus falschem Grund');
  });

  if (clip) {
    await pruefe('8.1 Kein Ton-/Lautstaerkeknopf im Querformat-Player', async () => {
      await clipOeffnen();
      const n = await page.$$eval(
        '.player [aria-label*="Ton" i], .player [aria-label*="Lautst" i], .player [aria-label*="stumm" i], #tonKnopf, .tonknopf',
        (l) => l.length
      );
      if (n) throw new Error(n + ' Tonknoepfe');
      const leiste = await page.$eval('#clipVideo', (v) => v.hasAttribute('controls')).catch(() => false);
      if (leiste) throw new Error('Browserleiste mit Stummknopf am Video');
    });

    await pruefe('8.2 Ort und Sound stehen unter dem Namen im Querformat', async () => {
      await clipOeffnen();
      const m = await page.evaluate(() => {
        const z = document.querySelector('.player__autorText .player__ziele');
        return {
          da: !!z,
          ort: document.querySelector('.player__ziele [data-postort]')?.dataset.postort || '',
          sound: document.querySelector('.player__ziele [data-postsound]')?.dataset.postsound || '',
          imProfil: !!document.querySelector('[data-profile] .player__ziele'),
        };
      });
      if (!m.da) throw new Error('keine Zeile unter dem Namen');
      if (clip.ort && m.ort !== clip.ort) throw new Error('Ort: ' + m.ort);
      if (clip.sound && m.sound !== clip.sound) throw new Error('Sound: ' + m.sound);
      if (m.imProfil) throw new Error('Zeile liegt im Profil-Knopf — der Klick ginge aufs Profil');
    });

    if (clip.ort) {
      await pruefe('8.2 Ort antippen oeffnet die Standortseite (nicht das Profil)', async () => {
        await clipOeffnen();
        await page.click('.player__ziele [data-postort]');
        await page.waitForSelector('.exp__kopf', { timeout: 8000 });
        if (await page.$('.player__autor')) throw new Error('Player steht noch da');
        if (await page.$('.prof__hinweis, .prof__kopf')) throw new Error('Profil statt Standort geoeffnet');
      });
    }

    if (clip.sound) {
      await pruefe('8.2 Sound antippen oeffnet die Soundseite oder sagt, warum nicht', async () => {
        await clipOeffnen();
        await page.click('.player__ziele [data-postsound]');
        await page.waitForTimeout(1500);
        const seite = await page.$('.exp__kopf');
        const hinweis = await page.evaluate(() =>
          [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' | ')
        );
        if (!seite && !hinweis) throw new Error('nichts passiert');
      });
    }
  }

  await pruefe('8.1 Chat-Vollformat: Video ohne Browserleiste und mit Ton', async () => {
    const m = await page.evaluate(() => {
      // Ein echtes Video aus dem Bestand, damit kein 404 in der Konsole landet.
      const echt = [...state.clips, ...state.videos].map((x) => x.mediaUrl).find((a) => istVideoAdresse(a));
      if (!echt) return { da: false, grund: 'kein Video im Bestand' };
      oeffneVollformat(echt);
      const v = document.querySelector('.vollformat video');
      const r = v
        ? { da: true, controls: v.hasAttribute('controls') || v.controls, stumm: v.muted, schleife: v.loop }
        : { da: false };
      document.querySelector('.vollformat')?.remove();
      return r;
    });
    if (!m.da) throw new Error(m.grund || 'kein Video im Vollformat');
    if (m.controls) throw new Error('controls gesetzt — Browserleiste mit Stummknopf');
    if (m.stumm) throw new Error('Video stumm');
  });

  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length ? 1 : 0);
})();
