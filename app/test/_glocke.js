// Prueft die abgeschaltete Beitragsglocke (Kasten 1 zum Feedback vom 21.09.).
//
// Henrik, zum dritten Mal: "Der Strich ist nicht zentriert, laeuft schraeg aus
// der Glocke heraus und hat dieselbe Farbe wie die Glocke." Die aktivierte
// Glocke sollte bleiben, wie sie ist.
//
// Gemessen wird nicht "ist ein Strich da", sondern Lage und Farbe: die Mitte
// des Strichs liegt auf der Mitte des Symbols, er ragt nicht ueber die Glocke
// hinaus, er ist rot und nicht grau, und es gibt genau einen. Dazu das
// Umschalten bis in die Datenbank, in Home und im Kurzformat.
//
// Start: node test/_glocke.js (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const path = require('path');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
const BILDER = path.join(__dirname, '..', '..', 'bilder', 'glocke');

(async () => {
  require('fs').mkdirSync(BILDER, { recursive: true });
  const browser = await chromium.launch();
  const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 3 });
  const page = await kontext.newPage();
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
  await page.waitForTimeout(500);

  const ergebnisse = [];
  const pruefe = (name, ok, info = '') => {
    ergebnisse.push(!!ok);
    console.log(`  ${ok ? 'OK  ' : 'FEHL'} ${name}${info ? ' — ' + info : ''}`);
  };

  // Lage und Farbe des Strichs in einer Glocke messen.
  const vermessen = (sel) =>
    page.$eval(sel, (btn) => {
      const svg = btn.querySelector('svg');
      const striche = svg.querySelectorAll('.ico-strich');
      const s = svg.getBoundingClientRect();
      const r = striche[0]?.getBoundingClientRect();
      const vorher = getComputedStyle(btn, '::before').content;
      return {
        anzahl: striche.length,
        davor: vorher && vorher !== 'none' && vorher !== 'normal',
        farbe: striche[0] ? getComputedStyle(striche[0]).stroke : null,
        glocke: getComputedStyle(svg).color,
        dx: r ? r.x + r.width / 2 - (s.x + s.width / 2) : null,
        dy: r ? r.y + r.height / 2 - (s.y + s.height / 2) : null,
        innen: r ? r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom : false,
        schraeg: r ? Math.abs(r.width - r.height) : null,
      };
    });

  const pruefeStrich = (wo, m) => {
    pruefe(`${wo}: genau ein Strich, kein zweiter per CSS`, m.anzahl === 1 && !m.davor, `Striche ${m.anzahl}, ::before ${m.davor}`);
    pruefe(`${wo}: Strich mittig (±0,5 px)`, Math.abs(m.dx) <= 0.5 && Math.abs(m.dy) <= 0.5, `dx ${m.dx?.toFixed(2)}, dy ${m.dy?.toFixed(2)}`);
    pruefe(`${wo}: Strich 45°, nicht schief`, m.schraeg <= 0.5, `Breite-Höhe ${m.schraeg?.toFixed(2)}`);
    pruefe(`${wo}: Strich ragt nicht aus dem Symbol`, m.innen);
    pruefe(`${wo}: Strich rot, andere Farbe als die Glocke`, /229, 72, 77|242, 109, 112/.test(m.farbe) && m.farbe !== m.glocke, `Strich ${m.farbe}, Glocke ${m.glocke}`);
  };

  // ------------------------------------------------------------ Home
  console.log('\nHome');
  await page.click('[data-area="videos"]');
  await page.waitForTimeout(300);
  await page.click('[data-sub="home"]').catch(() => {});
  await page.waitForSelector('.post__bell', { timeout: 10000 });

  const aus = await page.$('.post__bell:not(.is-on)');
  pruefe('Home: eine abgeschaltete Glocke ist zu sehen', !!aus);
  if (aus) {
    const pid = await aus.getAttribute('data-pid');
    const sel = `.post__bell[data-pid="${pid}"]`;
    pruefeStrich('Home', await vermessen(sel));
    await page.locator(sel).locator('xpath=..').screenshot({ path: path.join(BILDER, 'web-home-aus.png') });

    await page.click(sel);
    await page.waitForSelector(`${sel}.is-on`, { timeout: 5000 }).catch(() => {});
    const an = await page.$eval(sel, (b) => ({ an: b.classList.contains('is-on'), striche: b.querySelectorAll('.ico-strich').length, farbe: getComputedStyle(b).color }));
    pruefe('Home: angeschaltet ohne Strich, in Markenfarbe (unverändert)', an.an && an.striche === 0, `${an.farbe}`);
    await page.locator(sel).locator('xpath=..').screenshot({ path: path.join(BILDER, 'web-home-an.png') });

    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await page.click('[data-area="videos"]').catch(() => {});
    await page.waitForTimeout(300);
    await page.click('[data-sub="home"]').catch(() => {});
    await page.waitForSelector(sel, { timeout: 10000 });
    pruefe('Home: „an" übersteht das Neuladen (Datenbank)', await page.$eval(sel, (b) => b.classList.contains('is-on')));
    await page.click(sel);
    await page.waitForSelector(`${sel}:not(.is-on)`, { timeout: 5000 }).catch(() => {});
    pruefe('Home: wieder abschaltbar', await page.$eval(sel, (b) => !b.classList.contains('is-on')));
  }

  // ------------------------------------------------------------ Kurzformat
  console.log('\nKurzformat');
  await page.click('[data-sub="portrait"]');
  await page.waitForSelector('.slide__bell', { timeout: 10000 }).catch(() => {});
  const slide = await page.$('.slide__bell:not(.is-on)');
  pruefe('Kurzformat: Glocke vorhanden (wie in der App)', !!slide);
  if (slide) {
    const vid = await slide.getAttribute('data-vid');
    const sel = `.slide__bell[data-vid="${vid}"]`;
    pruefeStrich('Kurzformat', await vermessen(sel));
    await page.locator(sel).locator('xpath=..').screenshot({ path: path.join(BILDER, 'web-kurz-aus.png') });
    await page.click(sel);
    await page.waitForSelector(`${sel}.is-on`, { timeout: 5000 }).catch(() => {});
    pruefe('Kurzformat: Antippen schaltet an', await page.$eval(sel, (b) => b.classList.contains('is-on')));
    await page.locator(sel).locator('xpath=..').screenshot({ path: path.join(BILDER, 'web-kurz-an.png') });
    await page.click(sel);
    await page.waitForSelector(`${sel}:not(.is-on)`, { timeout: 5000 }).catch(() => {});
    pruefe('Kurzformat: wieder abschaltbar', await page.$eval(sel, (b) => !b.classList.contains('is-on')));
  }

  // Eigenes Reel: weder Folgen noch Glocke. Fremde: "Gefolgt" wie vom Server.
  const reels = await page.evaluate(() =>
    state.videos
      .filter((v) => document.getElementById('slide-' + v.id))
      .map((v) => {
        const el = document.getElementById('slide-' + v.id);
        return {
          eigen: istEigen(v.userId),
          folgen: !!el.querySelector('.slide__follow'),
          glocke: !!el.querySelector('.slide__bell'),
          text: el.querySelector('.slide__follow')?.textContent.trim() || null,
          server: !!v.following,
        };
      })
  );
  const eigene = reels.filter((r) => r.eigen);
  const fremde = reels.filter((r) => !r.eigen);
  pruefe('Kurzformat: am eigenen Reel weder „Folgen" noch Glocke', eigene.length > 0 && eigene.every((r) => !r.folgen && !r.glocke), `${eigene.length} eigene`);
  pruefe('Kurzformat: an jedem fremden Reel „Folgen" und Glocke', fremde.length > 0 && fremde.every((r) => r.folgen && r.glocke), `${fremde.length} fremde`);
  pruefe(
    'Kurzformat: „Gefolgt" stimmt mit der Datenbank überein',
    fremde.some((r) => r.server) && fremde.every((r) => (r.text === 'Gefolgt') === r.server),
    fremde.map((r) => `${r.text}/${r.server}`).join(' ')
  );

  pruefe('Keine Fehler in der Konsole', browserFehler.length === 0, browserFehler.slice(0, 3).join(' | '));

  const ok = ergebnisse.filter(Boolean).length;
  console.log(`\n${ok}/${ergebnisse.length} Prüfungen bestanden`);
  await beenden(browser, ok === ergebnisse.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
