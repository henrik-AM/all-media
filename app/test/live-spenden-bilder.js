/**
 * Restpunkt Livespenden (Gegenprüfung 27.10.): die Website zeigt im laufenden
 * Livestream die Spendensumme wie die App (LivestreamScreen, Spende.liveText).
 * Wie in der App nur in der Sendeansicht des Hosts — `donations` liest nur, wer
 * Sender oder Empfänger ist (Schema 11), der Host also alle seines Streams.
 *
 * 1. Echte Express-Route GET /api/stream/:id/kommentare auf 127.0.0.1:3300,
 *    Datenbank nachgebaut (keine Live-RLS).
 * 2. Website im Browser mit Prüfattrappe auf derselben Adresse; Bild:
 *    app/test/ergebnisse-spende/live.png.
 * Kein Supabase, keine Anmeldung, keine Cloud-Medien.
 */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const { attrappe, bestand } = require('./_attrappe');

(async () => {
  let n = 0, gesamt = 0;
  const test = async (name, f) => {
    gesamt++;
    await f();
    console.log(`OK ${++n} ${name}`);
  };

  // Nachgebaute Datenbank: Spenden je Beitrag, Kommentare über supabase-api.
  const spenden = [{ post_id: 'live-1', betrag_cent: 500 }, { post_id: 'live-1', betrag_cent: 250 }, { post_id: 'anders', betrag_cent: 9900 }];
  let spendenFehler = false;
  const db = {
    auth: { getUser: async () => ({ data: { user: { id: 'host' } }, error: null }) },
    from: (t) => {
      assert.equal(t, 'donations');
      const f = {};
      const kette = {
        select: () => kette,
        eq: (k, v) => ((f[k] = v), kette),
        then: (ok, nein) => Promise.resolve(spendenFehler ? { data: null, error: Error('Probe') } : { data: spenden.filter((z) => z.post_id === f.post_id), error: null }).then(ok, nein),
      };
      return kette;
    },
  };
  const S = require('../../web/server/supabase');
  const altClient = S.clientFuer;
  S.clientFuer = (t) => (t === 'lokal-host' ? db : null);
  const api = require('../../web/server/supabase-api');
  const altKommentare = api.ladeStreamKommentare;
  api.ladeStreamKommentare = async () => [{ id: 'k1', name: 'Anna', text: 'Hallo' }];
  const app = require('../../web/server/app');
  const server = await new Promise((ja, nein) => { const s = app.listen(3300, '127.0.0.1', () => ja(s)); s.on('error', nein); });
  const browser = await chromium.launch();
  try {
    const hole = (id) => fetch(`http://127.0.0.1:3300/api/stream/${id}/kommentare`, { headers: { Authorization: 'Bearer lokal-host' } }).then((r) => r.json());
    await test('Route liefert Spendensumme des Streams in Cent (nur dieser Beitrag)', async () => {
      const r = await hole('live-1');
      assert.equal(r.ok, true);
      assert.equal(r.spendenCent, 750);
      assert.equal(r.kommentare.length, 1);
    });
    await test('Spenden nicht lesbar → Kommentare kommen trotzdem, Summe null', async () => {
      spendenFehler = true;
      const r = await hole('live-1');
      spendenFehler = false;
      assert.equal(r.kommentare.length, 1);
      assert.equal(r.spendenCent, null);
    });

    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    page.setDefaultTimeout(8000);
    await page.route('**/*', (r) => (new URL(r.request().url()).origin === 'http://127.0.0.1:3300' ? r.continue() : r.abort()));
    let cent = 0, abrufe = 0;
    await attrappe(page, bestand(), {
      '/api/stream/start': { ok: true, id: 'live-1' },
      '/api/stream/live-1/kommentare': () => { abrufe++; return { ok: true, kommentare: [{ id: 'k1', name: 'Anna', text: 'Hallo' }], spendenCent: cent }; },
    });
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto('http://127.0.0.1:3300/');
    await page.waitForFunction(() => typeof window.openLivestream === 'function' && window.Spende);
    await page.evaluate(() => window.openLivestream());
    const feld = page.locator('#liveSpenden');

    await test('Ohne Spende bleibt die Zeile verborgen (wie App: spenden > 0)', async () => {
      await page.waitForFunction(() => document.querySelector('#liveSpalte')?.textContent.includes('Hallo'));
      assert.equal(await feld.isHidden(), true);
    });
    await test('Nach Spende: „7,50 € vorgemerkt · nicht bezahlt" sichtbar, Text aus gemeinsam/spende.js', async () => {
      cent = 750;
      await feld.waitFor({ state: 'visible', timeout: 6000 });
      const text = (await feld.textContent()).trim();
      assert.equal(text, await page.evaluate(() => Spende.liveText(750)));
      assert.equal(text, '7,50 € vorgemerkt · nicht bezahlt');
      assert.ok(abrufe >= 2);
    });
    await page.screenshot({ animations: 'disabled', path: path.join(__dirname, 'ergebnisse-spende/live.png') });
    await test('Summe null (nicht lesbar) behält den letzten Stand wie die App', async () => {
      cent = null;
      const vorher = abrufe;
      await page.waitForTimeout(4500);
      assert.ok(abrufe > vorher);
      assert.equal((await feld.textContent()).trim(), '7,50 € vorgemerkt · nicht bezahlt');
      assert.equal(await feld.isVisible(), true);
    });
    await test('Keine Seitenfehler', async () => assert.deepEqual(fehler, []));
  } finally {
    await browser.close();
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
    S.clientFuer = altClient;
    api.ladeStreamKommentare = altKommentare;
  }
  console.log(`${n}/${gesamt} Prüfungen bestanden`);
})().catch((e) => {
  console.error('FEHL', e.message);
  process.exit(1);
});
