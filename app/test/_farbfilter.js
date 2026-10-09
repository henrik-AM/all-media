/**
 * Farbfilter (Kasten 21): wirkt er — und bleibt er?
 *
 * Geprüft wird nicht, ob es den Schalter gibt, sondern die vier Stufen:
 *
 *   Gegenstand   Abschnitt „Farbfilter" in der Sprungleiste, Blatt mit sechs
 *                Filtern samt Wofür-Satz (wörtlich aus gemeinsam/farbfilter.js)
 *   bedienbar    Filter wählen, Intensität ziehen, Vergleichen, Zurücksetzen
 *   gespeichert  die vier Werte liegen in user_settings (/api/einstellungen
 *                liest sie dort)
 *   wirksam      auf <html> steht ein berechneter `filter: url(#…)`, und die
 *                Matrix im SVG ist genau die aus gemeinsam/farbfilter.js —
 *                nach Neuladen OHNE Browser-Rückfall, also aus dem Konto
 *
 * Dazu: der Sofortwert (Filter steht, während /api/einstellungen noch
 * hängt — kein Aufblitzen), der Filter sitzt nur auf <html> (nicht auf
 * body/.app, sonst kippt position: fixed), und Farbtönung geht über
 * feBlend mode="color".
 *
 * Was hier NICHT geprüft werden kann: die App. Deren Flächen
 * (mixBlendMode) gibt es nur im Simulator — siehe Bericht Kasten 21.
 *
 * Start:  node test/_farbfilter.js   (Server muss auf 3000 laufen)
 */

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const F = require('../../gemeinsam/farbfilter');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(10000);

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
  await page.evaluate(() => localStorage.removeItem('am-einstellungen'));
  await zuruecksetzen(page);
  await page.waitForTimeout(500);

  const ergebnisse = [];
  const pruefe = async (name, fn) => {
    try {
      const info = await fn();
      ergebnisse.push(true);
      console.log('  OK   ' + name + (info ? '  (' + info + ')' : ''));
    } catch (e) {
      ergebnisse.push(false);
      console.log('  FEHL ' + name + ' — ' + (e.message || 'kein Treffer'));
    }
  };

  /** Was auf <html> wirklich gilt: berechneter Filter und die Filterbausteine im SVG. */
  const wurzel = () =>
    page.evaluate(() => {
      const f = getComputedStyle(document.documentElement).filter;
      const id = (f.match(/#([^"')]+)/) || [])[1];
      const el = id ? document.getElementById(id) : null;
      return {
        filter: f,
        body: getComputedStyle(document.body).filter,
        app: getComputedStyle(document.querySelector('.app')).filter,
        matrix: el?.querySelector('feColorMatrix')?.getAttribute('values') || null,
        blend: el?.querySelector('feBlend')?.getAttribute('mode') || null,
        flut: el?.querySelector('feFlood')?.getAttribute('flood-color') || null,
        raum: el?.getAttribute('color-interpolation-filters') || null,
      };
    });

  const werteVomServer = () =>
    page.evaluate(() => fetch('/api/einstellungen').then((r) => r.json()).then((d) => d.einstellungen || {}));

  const gleicheZahlen = (a, b) => {
    const x = String(a || '').trim().split(/\s+/).map(Number);
    const y = String(b || '').trim().split(/\s+/).map(Number);
    return x.length === 20 && y.length === 20 && x.every((v, i) => Math.abs(v - y[i]) < 1e-4);
  };

  const erwartet = (art, staerke, farbton = 30) => F.svgWerte(F.matrix(art, staerke, farbton));

  const zuDenEinstellungen = async () => {
    await page.click('[data-area="settings"]');
    await page.waitForSelector('[data-setting="Farbfilter"]');
  };
  const blattAuf = async () => {
    await page.click('[data-setting="Farbfilter"]');
    await page.waitForSelector('[data-ff-art]');
  };
  const blattZu = async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  };

  console.log('\nFarbfilter — Ausgangslage');

  await pruefe('Ohne Einstellung kein Filter auf <html>', async () => {
    const w = await wurzel();
    if (w.filter !== 'none') throw new Error(w.filter);
  });

  console.log('\nGegenstand');
  await zuDenEinstellungen();

  await pruefe('„Farbfilter" steht als eigener Abschnitt in der Sprungleiste', async () => {
    const pillen = await page.$$eval('.pill[data-jump]', (els) => els.map((e) => e.textContent.trim()));
    if (!pillen.includes('Farbfilter')) throw new Error(pillen.join(' | '));
  });

  await pruefe('Der Punkt zeigt „Aus"', async () => {
    const t = await page.$eval('[data-setting="Farbfilter"] .item__value', (e) => e.textContent);
    if (t !== 'Aus') throw new Error(t);
  });

  await blattAuf();

  await pruefe('Das Blatt zeigt alle sechs Filter mit ihrem Wofür-Satz', async () => {
    const liste = await page.$$eval('[data-ff-art]', (els) =>
      els.map((e) => ({ id: e.dataset.ffArt, text: e.textContent.replace(/\s+/g, ' ') }))
    );
    if (liste.length !== F.FILTER.length) throw new Error(liste.length + ' Filter');
    for (const f of F.FILTER) {
      const z = liste.find((l) => l.id === f.id);
      if (!z || !z.text.includes(f.kurz)) throw new Error('fehlt/abweichend: ' + f.id);
    }
    return liste.map((l) => l.id).join(', ');
  });

  await pruefe('Einleitung, Vorschau und Regler sind da', async () => {
    const d = await page.evaluate(() => ({
      text: document.querySelector('.farbfilter__einleitung')?.textContent,
      stifte: document.querySelectorAll('.farbstift').length,
      regler: !!document.querySelector('[data-ff-staerke]'),
      vergleich: !!document.querySelector('[data-ff-vergleich]'),
      zurueck: !!document.querySelector('[data-ff-zurueck]'),
    }));
    if (d.text !== F.EINLEITUNG) throw new Error('Einleitung weicht ab');
    if (d.stifte !== F.VORSCHAU.length || !d.regler || !d.vergleich || !d.zurueck) throw new Error(JSON.stringify(d));
  });

  console.log('\nBedienbar und wirksam');

  await pruefe('Grün/Rot-Filter antippen schaltet ihn ein und legt die Matrix auf <html>', async () => {
    await page.click('[data-ff-art="deuteranopie"]');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).filter !== 'none');
    await page.waitForTimeout(400);
    const w = await wurzel();
    if (!/url\(/.test(w.filter)) throw new Error(w.filter);
    if (w.raum !== 'sRGB') throw new Error('color-interpolation-filters ' + w.raum);
    if (!gleicheZahlen(w.matrix, erwartet('deuteranopie', 100))) throw new Error(w.matrix);
    const an = await page.$eval('[data-ff-an]', (e) => e.classList.contains('is-on'));
    if (!an) throw new Error('Schalter blieb aus');
  });

  await pruefe('Nur <html> trägt den Filter (body/.app nicht — sonst kippt position: fixed)', async () => {
    const w = await wurzel();
    if (w.body !== 'none' || w.app !== 'none') throw new Error(`body ${w.body}, .app ${w.app}`);
  });

  await pruefe('Intensität auf 60 % ändert die Matrix', async () => {
    await page.$eval('[data-ff-staerke]', (r) => {
      r.value = '60';
      r.dispatchEvent(new Event('input', { bubbles: true }));
      r.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await page.waitForTimeout(800);
    const w = await wurzel();
    if (!gleicheZahlen(w.matrix, erwartet('deuteranopie', 60))) throw new Error(w.matrix);
    const anzeige = await page.$eval('#ffStaerkeWert', (e) => e.textContent);
    if (anzeige !== '60 %') throw new Error(anzeige);
  });

  await pruefe('Gedrückt halten zum Vergleichen nimmt den Filter weg und gibt ihn zurück', async () => {
    const knopf = await page.$('[data-ff-vergleich]');
    await knopf.dispatchEvent('pointerdown');
    await page.waitForTimeout(150);
    const waehrend = (await wurzel()).filter;
    await knopf.dispatchEvent('pointerup');
    await page.waitForTimeout(150);
    const danach = await wurzel();
    if (waehrend !== 'none') throw new Error('während: ' + waehrend);
    if (!gleicheZahlen(danach.matrix, erwartet('deuteranopie', 60))) throw new Error('danach: ' + danach.filter);
  });

  console.log('\nGespeichert');

  await pruefe('Die Werte liegen in user_settings', async () => {
    const w = await werteVomServer();
    const S = F.SCHLUESSEL;
    if (w[S.an] !== 'an' || w[S.art] !== 'deuteranopie' || w[S.staerke] !== '60') throw new Error(JSON.stringify(w));
    return `${S.an}=${w[S.an]}, ${S.art}=${w[S.art]}, ${S.staerke}=${w[S.staerke]}`;
  });

  await blattZu();
  await pruefe('Der Punkt zeigt den Stand', async () => {
    await page.waitForTimeout(300);
    const t = await page.$eval('[data-setting="Farbfilter"] .item__value', (e) => e.textContent);
    if (t !== 'Grün/Rot-Filter · 60 %') throw new Error(t);
  });

  await pruefe('Nach Neuladen OHNE Browser-Rückfall: Filter kommt aus dem Konto', async () => {
    await page.evaluate(() => localStorage.removeItem('am-einstellungen'));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => getComputedStyle(document.documentElement).filter !== 'none', null, { timeout: 20000 });
    const w = await wurzel();
    if (!gleicheZahlen(w.matrix, erwartet('deuteranopie', 60))) throw new Error(w.filter + ' / ' + w.matrix);
  });

  await pruefe('Sofortwert: Filter steht, während /api/einstellungen noch hängt', async () => {
    let freigeben;
    const sperre = new Promise((r) => (freigeben = r));
    await page.route('**/api/einstellungen', async (route) => {
      await sperre;
      await route.continue().catch(() => {});
    });
    await page.goto(ZIEL, { waitUntil: 'domcontentloaded' });
    const w = await wurzel();
    freigeben();
    await page.unroute('**/api/einstellungen');
    await page.waitForSelector('[data-area]', { timeout: 20000 });
    if (!gleicheZahlen(w.matrix, erwartet('deuteranopie', 60))) throw new Error('beim Aufbau: ' + w.filter);
  });

  console.log('\nFarbtönung');
  await page.waitForTimeout(800);
  await zuDenEinstellungen();
  await blattAuf();

  await pruefe('Farbtönung mischt mit feBlend mode="color" und zeigt den Farbton-Regler', async () => {
    await page.click('[data-ff-art="farbton"]');
    await page.waitForSelector('[data-ff-farbton]');
    await page.waitForTimeout(400);
    const w = await wurzel();
    const soll = F.webFilter(F.lesen({ farbfilter: 'an', farbfilterArt: 'farbton', farbfilterStaerke: '60', farbfilterFarbton: '30' }));
    if (w.blend !== 'color') throw new Error('feBlend ' + w.blend);
    if ((w.flut || '').toLowerCase() !== soll.farbe.toLowerCase()) throw new Error(w.flut + ' statt ' + soll.farbe);
  });

  console.log('\nZurücksetzen');

  await pruefe('Zurücksetzen nimmt den Filter weg und schreibt den Auslieferungszustand', async () => {
    await page.click('[data-ff-zurueck]');
    await page.waitForFunction(() => getComputedStyle(document.documentElement).filter === 'none');
    await page.waitForTimeout(800);
    const w = await werteVomServer();
    const soll = Object.fromEntries(F.ZURUECKSETZEN);
    for (const [k, v] of Object.entries(soll)) if (w[k] !== v) throw new Error(`${k}=${w[k]} statt ${v}`);
  });
  await blattZu();

  await pruefe('Keine Fehler im Browser', async () => {
    const eigene = browserFehler.filter((t) => !/favicon|ERR_ABORTED/i.test(t));
    if (eigene.length) throw new Error(eigene.slice(0, 3).join(' | '));
  });

  const bestanden = ergebnisse.filter(Boolean).length;
  console.log(`\n${bestanden}/${ergebnisse.length} bestanden`);
  await beenden(browser, bestanden === ergebnisse.length ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
