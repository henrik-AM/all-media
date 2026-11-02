#!/usr/bin/env node
/**
 * Kasten RS 7/5 auf der Website ansehen — mit Attrappe, ohne Supabase.
 *
 *   A  Tür „Unsere Bedingungen“: erscheint bei offener Fassung, Text lesbar,
 *      Zustimmen schickt Dokument, Fassung und Prüfsumme des gezeigten Texts
 *      (Codex-Fund F6), danach geht die Seite auf. Ohne Schema 106 keine Tür.
 *   A3 Server nennt eine neuere Fassung als der Text der Seite: „bitte
 *      aktualisieren", kein Aufruf, einmal neu geladen, Tür bleibt zu.
 *   A4 Löschblatt (Codex-Funde F1): scheitert der Trockenlauf
 *      konto_loeschen_probe (grund 'datenbank'), meldet das Blatt „es wurde
 *      nichts gelöscht" und ruft weder Dateien- noch Kontolöschen.
 *   B  Bildschirmzeit → Kind: Stand der Zustimmung, Rückfrage mit Hinweis,
 *      Widerruf schickt die Kind-Kennung.
 *
 * Der Supabase-Client im Browser (Anmeldung.aufbauen) wird durch einen
 * Nachbau ersetzt, der wie Schema 106 antwortet. Belegt Stufe 1–2 (Gegenstand,
 * bedienbar), nicht die Datenbank (dafür _probe106.js).
 *
 * Start: (cd web && PORT=3210 node server/lokal.js) und
 *        BASE=http://localhost:3210 BILDER=<ordner> node test/rs7-einwilligung.js
 */
const path = require('path');
const { attrappe, bestand } = require('./_attrappe');

const BASE = process.env.BASE || 'http://localhost:3000';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const bild = async (seite, name) => {
  if (!process.env.BILDER) return;
  await seite.waitForTimeout(700);
  await seite.screenshot({ path: path.join(process.env.BILDER, `rs7-${name}.png`) });
};

/** Ersetzt window.Anmeldung, sobald die Seite es setzt; rpc antwortet wie Schema 106. */
const nachbau = (modus) => {
  const mitSchema = modus !== false;
  const fassung = (modus && modus.fassung) || 1;
  window.__rpc = [];
  let zugestimmt = false;
  let widerrufen = false;
  const client = {
    auth: { signInWithPassword: async () => ({ data: {}, error: null }) },
    storage: { from: () => ({ remove: async (namen) => { window.__rpc.push(['dateien', namen]); return { error: null }; } }) },
    rpc: async (name, args) => {
      window.__rpc.push([name, args || null]);
      if (!mitSchema) return { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
      if (name === 'zustimmung_offen') {
        return {
          data: zugestimmt ? [] : [
            { dokument: 'nutzungsbedingungen', version: fassung, art: 'zustimmung', bisher: fassung > 1 ? fassung - 1 : null },
            { dokument: 'datenschutz', version: 1, art: 'kenntnis', bisher: null },
          ],
          error: null,
        };
      }
      if (name === 'meine_medien') return { data: [{ bucket: 'media', name: 'posts/me-1.jpg' }], error: null };
      if (name === 'konto_loeschen_probe') return { data: { ok: false, grund: 'datenbank' }, error: null };
      if (name === 'konto_loeschen') return { data: { ok: true }, error: null };
      if (name === 'zustimmen') {
        zugestimmt = true;
        return { data: { ok: true }, error: null };
      }
      if (name === 'meine_kinder') {
        return { data: [{ id: 'k1', name: 'Mia', handle: '@mia', stand: widerrufen ? 'wartet' : 'frei', mindestalter: 16, grenze_am: '2030-03-01', entschieden_am: widerrufen ? new Date().toISOString() : '2026-10-01T10:00:00Z', widerrufbar: !widerrufen }], error: null };
      }
      if (name === 'elterneinwilligung_widerrufen') {
        widerrufen = true;
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: null };
    },
  };
  let echt;
  Object.defineProperty(window, 'Anmeldung', {
    configurable: true,
    get: () => echt,
    set: (wert) => {
      echt = Object.assign({}, wert, {
        aufbauen: async () => client,
        angemeldet: () => true,
        nutzer: () => ({ id: 'me', email: 'me@prueflauf.invalid' }),
        kontostand: async () => ({ stand: 'frei' }),
        abmelden: async () => {},
      });
    },
  });
};

const BZ_STAND = {
  ok: true,
  regeln: {},
  kinder: [{ id: 'k1', name: 'Mia', handle: '@mia' }],
  woche: [],
  tag: new Date().toISOString().slice(0, 10),
  zeitzone: 'Europe/Berlin',
  nutzung: {},
};

(async () => {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch();
  try {
    console.log('\nA. Tür „Unsere Bedingungen“');
    const a = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const fehlerA = [];
    a.on('pageerror', (e) => fehlerA.push(e.message));
    await a.addInitScript(nachbau, true);
    await attrappe(a, bestand(), { '/api/bildschirmzeit': BZ_STAND });
    await a.goto(BASE);
    const da = await a.waitForSelector('#bedingungen', { timeout: 15000 }).then(() => true, () => false);
    pruefe('Tür erscheint bei offener Fassung', da);
    const text = da ? await a.textContent('#bedingungen') : '';
    pruefe('bittet um Zustimmung und nennt den Ausweg „Konto löschen“', /Bitte stimme/.test(text) && /Konto löschen/.test(text));
    pruefe('Liste: Nutzungsbedingungen, Datenschutz zur Kenntnis',
      /Nutzungsbedingungen/.test(text) && /Fassung 1/.test(text) && /Datenschutzerklärung/.test(text) && /zur Kenntnis/.test(text));
    pruefe('App-Inhalt ist nicht zu sehen', !(await a.$('[data-area="communities"]:not([hidden])')));
    await bild(a, 'a-tuer');
    await a.click('[data-bedingung="nutzungsbedingungen"]');
    const blatt = await a.waitForSelector('.sheet-backdrop', { timeout: 5000 }).then(() => true, () => false);
    pruefe('Text öffnet sich im Blatt', blatt && /Nutzungsbedingungen/.test(await a.textContent('.sheet-backdrop:last-of-type')));
    await bild(a, 'a-lesen');
    await a.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));
    await a.click('#bedingungenOk');
    await a.click('#bedingungenOk').catch(() => {});
    const auf = await a.waitForSelector('#bedingungen', { state: 'detached', timeout: 15000 }).then(() => true, () => false);
    pruefe('nach Zustimmen geht die Seite auf', auf);
    const rpc = await a.evaluate(() => window.__rpc);
    const zu = rpc.filter(([n]) => n === 'zustimmen');
    pruefe('zustimmen je Fassung genau einmal (Doppelklick)', zu.length === 2, JSON.stringify(zu));
    const R = require('../../gemeinsam/rechtstexte');
    pruefe('F6: Dokument, Fassung und Prüfsumme des gezeigten Texts',
      zu.length > 0 && zu.every(([, x]) => Object.keys(x).join() === 'p_dokument,p_version,p_pruefsumme'
        && x.p_version === R.fassung(x.p_dokument).version && x.p_pruefsumme === R.PRUEFSUMMEN[x.p_dokument]), JSON.stringify(zu));
    pruefe('keine Seitenfehler', fehlerA.length === 0, fehlerA.join(' | '));

    console.log('\nA3. Seite zeigt eine ältere Fassung als die geltende (F6)');
    const v = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const fehlerV = [];
    v.on('pageerror', (e) => fehlerV.push(e.message));
    await v.addInitScript(nachbau, { fassung: 2 });
    await attrappe(v, bestand(), { '/api/bildschirmzeit': BZ_STAND });
    let ladungen = 0;
    v.on('load', () => { ladungen++; });
    await v.goto(BASE);
    await v.waitForSelector('#bedingungen', { timeout: 15000 });
    await v.click('#bedingungenOk');
    await v.waitForTimeout(1500);
    await v.waitForSelector('#bedingungen', { timeout: 15000 });
    await v.click('#bedingungenOk');
    const meldung = await v.waitForFunction(() => /aktualisiere/.test((document.querySelector('#bedingungenMeldung') || {}).textContent || ''),
      null, { timeout: 8000 }).then(() => true, () => false);
    await v.waitForTimeout(800);
    const rpcV = await v.evaluate(() => window.__rpc);
    pruefe('Meldung „bitte aktualisieren“, Tür bleibt', meldung && !!(await v.$('#bedingungen')));
    pruefe('kein zustimmen-Aufruf', rpcV.every(([n]) => n !== 'zustimmen'), JSON.stringify(rpcV));
    pruefe('genau einmal neu geladen, keine Schleife', ladungen === 2, String(ladungen));
    pruefe('keine Seitenfehler', fehlerV.length === 0, fehlerV.join(' | '));
    await bild(v, 'a3-veraltet');
    await v.close();

    console.log('\nA4. Löschblatt: Trockenlauf scheitert (F1)');
    await a.evaluate(() => { window.__rpc = []; openKontoLoeschen(); });
    await a.waitForSelector('[data-konto-loeschen]', { timeout: 5000 });
    await a.fill('#loeschPasswort', 'geheim123');
    await a.click('#loeschJa');
    const loeschText = await a.waitForFunction(() => {
      const f = document.querySelector('#loeschFehler');
      return f && !f.hidden && f.textContent;
    }, null, { timeout: 8000 }).then((h) => h.jsonValue(), () => '');
    const rpcL = await a.evaluate(() => window.__rpc.map(([n]) => n));
    pruefe('Meldung „nichts gelöscht“ im Blatt', /nichts gelöscht/.test(loeschText), loeschText);
    pruefe('Trockenlauf gefragt, aber weder Dateien noch Konto gelöscht',
      rpcL.includes('konto_loeschen_probe') && !rpcL.includes('dateien') && !rpcL.includes('konto_loeschen'), rpcL.join(','));
    pruefe('Knopf wieder bedienbar', await a.$eval('#loeschJa', (k) => !k.disabled && /endgültig/.test(k.textContent)));
    await bild(a, 'a4-loeschen-datenbank');
    await a.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));

    console.log('\nA2. Ohne Schema 106');
    const o = await browser.newPage({ viewport: { width: 400, height: 860 } });
    await o.addInitScript(nachbau, false);
    await attrappe(o, bestand(), { '/api/bildschirmzeit': BZ_STAND });
    await o.goto(BASE);
    const ohne = await o.waitForSelector('[data-area="communities"]', { timeout: 15000 }).then(() => true, () => false);
    pruefe('keine Tür, Seite geht auf', ohne && !(await o.$('#bedingungen')));
    await o.close();

    console.log('\nB. Eltern nehmen die Zustimmung zurück');
    await a.evaluate(() => openBildschirmzeit('kinder'));
    await a.waitForSelector('[data-bz-kind="k1"]', { timeout: 8000 });
    await a.click('[data-bz-kind="k1"]');
    const knopf = await a.waitForSelector('[data-bz-widerruf]', { timeout: 8000 }).then(() => true, () => false);
    pruefe('Kind-Menü zeigt Zustimmung und Knopf', knopf && /Freigegeben/.test(await a.textContent('.sheet-backdrop:last-of-type')));
    await bild(a, 'b-kind');
    await a.click('[data-bz-widerruf]');
    const frage = await a.textContent('.sheet-backdrop:last-of-type');
    pruefe('Rückfrage mit ehrlichem Hinweis', /ruht/.test(frage) && /01\.03\.2030/.test(frage) && /bleiben erhalten/.test(frage) && /Ja, zurücknehmen/.test(frage));
    pruefe('erst der zweite Klick widerruft', !(await a.evaluate(() => window.__rpc.some(([n]) => n === 'elterneinwilligung_widerrufen'))));
    await bild(a, 'b-rueckfrage');
    await a.click('[data-bz-widerruf]');
    await a.waitForTimeout(500);
    const w = (await a.evaluate(() => window.__rpc)).filter(([n]) => n === 'elterneinwilligung_widerrufen');
    pruefe('Widerruf mit Kind-Kennung', w.length === 1 && w[0][1].p_kind === 'k1', JSON.stringify(w));
    const danach = await a.textContent('.sheet-backdrop:last-of-type');
    pruefe('Bestätigung im Blatt', /Zustimmung zurückgenommen/.test(danach));
    pruefe('danach Stand „Wartet“, kein Knopf mehr', /Wartet auf deine Zustimmung/.test(danach) && !(await a.$('[data-bz-widerruf]')));
    await bild(a, 'b-fertig');
    pruefe('keine Seitenfehler', fehlerA.length === 0, fehlerA.join(' | '));
  } finally {
    await browser.close();
  }
  console.log(`\n${anzahl - fehler}/${anzahl} Prüfungen bestanden.`);
  process.exit(fehler ? 1 : 0);
})();
