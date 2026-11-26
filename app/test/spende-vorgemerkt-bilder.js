/**
 * Offene Punkte 0c — Spendenziel auf der Website als „vorgemerkt, nicht
 * bezahlt" (26.10.2026). Lokale Prüfattrappe auf 3300 (`PORT=3300 node
 * web/server/lokal.js`); keine Anmeldung, kein Supabase, keine Cloud-Medien.
 * Belegt Darstellung und Bedienung, nicht die Datenbank.
 */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const { attrappe, bestand } = require('./_attrappe');

(async () => {
  const browser = await chromium.launch();
  let n = 0;
  const test = async (name, f) => {
    await f();
    console.log(`OK ${++n} ${name}`);
  };
  try {
    const page = await browser.newPage({ viewport: { width: 430, height: 932 } });
    page.setDefaultTimeout(8000);
    await page.route('**/*', (r) =>
      new URL(r.request().url()).origin === 'http://localhost:3300' ? r.continue() : r.abort()
    );
    const spende = { titel: 'Neue Kamera', ziel: 100, gesammelt: 5, text: 'Für bessere Videos', seit: '2026-10-01T00:00:00Z' };
    const daten = bestand();
    let standAbrufe = 0;
    await attrappe(page, daten, {
      '/api/profile/u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: 'anna', initials: 'AS', bio: '', color: '#1261d7', followers: 0, following: 0, posts: 0, playlists: [], highlights: [], grid: [], spende },
      '/api/spendenstand/u-anna': () => {
        standAbrufe++;
        return { ok: true, stand: { summe_cent: 250, spender: 2 } };
      },
    });
    const fehler = [];
    page.on('pageerror', (e) => fehler.push(e.message));
    await page.goto('http://localhost:3300/');
    await page.waitForFunction(() => typeof window.openProfile === 'function' && window.Spende);
    await page.evaluate(() => window.openProfile('u-anna', 'oeffentlich'));

    const karte = page.locator('[data-spendeziel="u-anna"]');
    await test('Karte im fremden Profil: „5 € von 100 € vorgemerkt · nicht bezahlt"', async () => {
      await karte.waitFor();
      assert.equal((await karte.locator('.spende__zahlen').textContent()).trim(), '5 € von 100 € vorgemerkt · nicht bezahlt');
      assert.doesNotMatch(await karte.textContent(), /gesammelt|gespendet/);
    });
    await page.screenshot({ animations: 'disabled', path: path.join(__dirname, 'ergebnisse-spende/karte.png') });

    await test('Detailblatt: „Vorgemerkt" statt „Erreicht", Stand mit Buchungen', async () => {
      await karte.click();
      const blatt = page.locator('#spendeDetails');
      await blatt.waitFor();
      const text = await blatt.textContent();
      assert.match(text, /Vorgemerkt\s*7,50 €/);
      assert.doesNotMatch(text, /Erreicht|gesammelt|gespendet/);
      assert.match(text, /7,50 € von 100 € vorgemerkt · nicht bezahlt · 2 Personen haben vorgemerkt/);
      assert.equal(standAbrufe, 1);
    });
    await test('Hinweis „kein Geld geflossen" sichtbar', async () => {
      const hinweis = page.locator('[data-nicht-bezahlt]');
      assert.ok(await hinweis.isVisible());
      assert.match(await hinweis.textContent(), /Vorgemerkt, nicht bezahlt: .*kein Geld geflossen/);
    });
    await page.screenshot({ animations: 'disabled', path: path.join(__dirname, 'ergebnisse-spende/details.png') });

    await test('Meldung nach dem Spenden nutzt denselben Text wie die App', async () => {
      assert.equal(
        await page.evaluate(() => window.Spende.bestaetigung(250, 'Anna Schmidt')),
        '2,50 € an Anna Schmidt vorgemerkt — nicht bezahlt'
      );
    });
    await test('Keine JavaScriptfehler', async () => assert.deepEqual(fehler, []));
    console.log(`${n}/${n} Browserprüfungen bestanden (Attrappe: nur Darstellung, keine DB)`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
