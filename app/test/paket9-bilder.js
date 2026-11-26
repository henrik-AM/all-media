#!/usr/bin/env node
/**
 * Paket 9: Bildbelege der Website mit echter Anmeldung (Prüfkonto) gegen den
 * lokalen Server (Port 3000, Code dieses Zweigs) und die echte Ablage.
 * Legt eigene Beiträge an und räumt sie am Ende wieder weg.
 * Bilder: app/test/ergebnisse-paket9/web-*.png
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { vorbereiten, mitZeitgrenze } = require('./_konto');
const { testpaarSichern, testpaarLoesen, TESTKONTO } = require('./_testpaar');

const BASIS = process.env.ZIEL || 'http://localhost:3000';
const ORDNER = path.join(__dirname, 'ergebnisse-paket9');
const MEDIEN = path.join(ORDNER, 'medien');
let ok = 0, fehl = 0;
const pruefe = (name, wahr, zusatz = '') => { wahr ? ok++ : fehl++; console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : '')); };

(async () => {
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 900 }, permissions: ['camera'] });
  const page = await ctx.newPage();
  mitZeitgrenze(page);
  const fehlerKonsole = [];
  page.on('console', (m) => { if (m.type() === 'error') fehlerKonsole.push(m.text()); });
  if (!(await vorbereiten(page, BASIS))) process.exit(1);
  const bild = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: path.join(ORDNER, `web-${name}.png`) }); };
  const angelegt = [];
  const api = (pfad, json) => page.evaluate(async ({ pfad, json }) => {
    const c = window.Anmeldung.client(); const t = (await c.auth.getSession()).data.session.access_token;
    const r = await fetch(pfad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(json) });
    return r.json();
  }, { pfad, json });
  const hoch = (name, typ) => page.evaluate(async ({ b64, typ }) => {
    const c = window.Anmeldung.client(); const t = (await c.auth.getSession()).data.session.access_token;
    const bytes = Uint8Array.from(atob(b64), (x) => x.charCodeAt(0));
    const r = await fetch('/api/hochladen/datei?ordner=posts', { method: 'POST', headers: { 'Content-Type': typ, Authorization: 'Bearer ' + t }, body: bytes });
    return r.json();
  }, { b64: fs.readFileSync(path.join(MEDIEN, name)).toString('base64'), typ });

  try {
    // ---------------------------------------------------- AF4 Karussell --
    const b1 = await hoch('bild1.jpg', 'image/jpeg'), v1 = await hoch('kurz.mp4', 'video/mp4'), b2 = await hoch('bild2.jpg', 'image/jpeg');
    const kar = await api('/api/eigene/beitrag', { beschreibung: 'Paket 9 Karussell (Bildbeleg)', medien: [{ url: b1.url, typ: 'image' }, { url: v1.url, typ: 'video' }, { url: b2.url, typ: 'image' }] });
    if (kar.beitrag?.id) angelegt.push(kar.beitrag.id);
    pruefe('Karussell angelegt', !!kar.beitrag?.id, kar.error);
    await page.evaluate(() => { state.area = 'videos'; state.sub.videos = 'home'; return bootstrap?.(); });
    await page.waitForTimeout(2500);
    const k = page.locator(`[data-kid="${kar.beitrag.id}"]`).first();
    await k.scrollIntoViewIfNeeded().catch(() => {});
    pruefe('Karussell im Feed mit Zähler 1/3', (await k.locator('[data-k-zaehler]').textContent().catch(() => '')) === '1/3');
    const geladen = await k.locator('img').first().evaluate((i) => new Promise((r) => (i.complete && i.naturalWidth ? r(i.naturalWidth) : (i.onload = () => r(i.naturalWidth), setTimeout(() => r(i.naturalWidth), 8000))))).catch(() => 0);
    pruefe('Erstes Bild geladen', geladen > 0, 'Breite ' + geladen);
    await k.screenshot({ path: path.join(ORDNER, 'web-af4-karussell-1.png') }).catch(() => {});
    await k.locator('[data-k-nach]').click();
    await page.waitForTimeout(1200);
    pruefe('Weiter → 2/3 (Video)', (await k.locator('[data-k-zaehler]').textContent()) === '2/3');
    await k.screenshot({ path: path.join(ORDNER, 'web-af4-karussell-2.png') }).catch(() => {});

    // ------------------------------------------- AF4 Auswahl beim Erstellen --
    await page.evaluate(() => { erstelle('post'); });
    await page.waitForSelector('.karusselleditor [data-add]', { timeout: 15000 });
    const [waehler] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.locator('.karusselleditor [data-add]').click()]);
    await waehler.setFiles([path.join(MEDIEN, 'bild1.jpg'), path.join(MEDIEN, 'kurz.mp4'), path.join(MEDIEN, 'bild2.jpg')]);
    await page.waitForTimeout(1000);
    pruefe('Auswahl zeigt 3 gemischte Medien', (await page.locator('.karusselleditor li').count()) === 3);
    await page.locator('.karusselleditor [data-nach="0"]').click();
    await page.waitForTimeout(500);
    const erstes = await page.locator('.karusselleditor li').first().innerText();
    pruefe('Ordnen: erstes nach hinten verschoben', /kurz\.mp4/.test(erstes), erstes.replace(/\n/g, ' '));
    await page.locator('.karusselleditor [data-weg="2"]').click();
    await page.waitForTimeout(500);
    pruefe('Entfernen: 2 Medien übrig', (await page.locator('.karusselleditor li').count()) === 2);
    await bild('af4-auswahl');
    await page.locator('.karusselleditor [data-abbrechen]').click();
    await page.waitForTimeout(600);
    await page.evaluate(() => document.querySelectorAll('.sheet, .overlay, [role=dialog]').forEach((e) => e.remove()));

    // ------------------------------------------ AF5 Sprungleiste im Reel --
    const v2 = await hoch('kurz.mp4', 'video/mp4');
    const reel = await api('/api/eigene/video', { beschreibung: 'Paket 9 Reel (Bildbeleg)', mediaUrl: v2.url, sekunden: 5, format: 'hoch' });
    const reelId = reel.beitrag?.id || reel.video?.id;
    if (reelId) angelegt.push(reelId);
    await page.evaluate(() => { state.area = 'videos'; state.sub.videos = 'portrait'; return bootstrap?.(); });
    await page.waitForTimeout(3000);
    pruefe('Reels zeigen Sprungleiste', (await page.locator('[data-reelposition]').count()) > 0);
    pruefe('Reels zeigen „Gefällt mir nicht"', (await page.locator('[data-vaction="dislike"]').count()) > 0);
    await bild('af5-sprungleiste');
    // ---------------------------------------- AF3 Gefällt mir nicht (Klick) --
    const knopf = page.locator('[data-vaction="dislike"]').first();
    const vid = await knopf.getAttribute('data-vid');
    await knopf.click();
    const an = await page.waitForFunction((v) => document.querySelector(`[data-vaction="dislike"][data-vid="${v}"]`)?.getAttribute('aria-pressed') === 'true' ? 'true' : null, vid, { timeout: 10000 }).then(() => 'true').catch(() => 'false');
    pruefe('Klick setzt „Gefällt mir nicht" (aria-pressed)', an === 'true', an);
    await bild('af3-gefaellt-nicht');
    await page.locator(`[data-vaction="dislike"][data-vid="${vid}"]`).first().click();
    const aus = await page.waitForFunction((v) => document.querySelector(`[data-vaction="dislike"][data-vid="${v}"]`)?.getAttribute('aria-pressed') === 'false' ? true : null, vid, { timeout: 10000 }).then(() => true).catch(() => false);
    pruefe('Erneuter Klick nimmt zurück', aus);

    // ------------------------------------------ AF5.3 Fortschritt + Abbruch --
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 50, downloadThroughput: 2e6, uploadThroughput: 4000 });
    const [w2] = await Promise.all([page.waitForEvent('filechooser', { timeout: 15000 }), page.evaluate(() => { erstelle('reels'); })]);
    await w2.setFiles(path.join(MEDIEN, 'lang1200.mp4'));
    await page.waitForTimeout(2500);
    await page.locator('#f_beschreibung').fill('Paket 9 Abbruchprobe').catch(() => {});
    await page.locator('#formOk').click().catch(() => {});
    await page.waitForSelector('.medienupload', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    pruefe('Upload zeigt Fortschritt', (await page.locator('.medienupload progress').count()) === 1);
    await bild('af5-upload-fortschritt');
    await page.locator('.medienupload button').click().catch(() => {});
    await page.waitForTimeout(1500);
    pruefe('Abbrechen beendet den Upload', (await page.locator('.medienupload').count()) === 0);
    await bild('af5-upload-abgebrochen');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
    await page.evaluate(() => document.querySelectorAll('.sheet, .overlay, [role=dialog]').forEach((e) => e.remove()));

    // --------------------------------------------- AF7 Konto-Analysen --
    await page.evaluate(() => { state.area = 'settings'; render(); openEinstellung({ label: 'Konto-Analysen', liste: 'kontoanalysen' }); });
    await page.waitForTimeout(2500);
    const text7 = await page.locator('.sheet').last().innerText().catch(() => '');
    pruefe('Konto-Analysen zeigen 7/30 Tage', /7 Tage/i.test(text7) && /30 Tage/i.test(text7), text7.slice(0, 120).replace(/\n/g, ' | '));
    await bild('af7-kontoanalysen');
    await page.evaluate(() => document.querySelectorAll('.sheet, .overlay, [role=dialog]').forEach((e) => e.remove()));

    // ----------------------------------------------- AF6 Enge Freunde --
    await page.evaluate(() => openEngeFreunde());
    await page.waitForTimeout(2000);
    pruefe('Enge-Freunde-Blatt offen, Liste privat', /privat/i.test(await page.locator('.sheet').last().innerText().catch(() => '')));
    await bild('af6-enge-freunde');
    await page.evaluate(() => document.querySelectorAll('.sheet, .overlay, [role=dialog]').forEach((e) => e.remove()));
    // Ganzer Weg: B auf die Liste, Kamera (Testgerät von Chromium), Vorschau, senden.
    await testpaarSichern();
    const liste = await page.evaluate(async (b) => { const c = window.Anmeldung.client(); const me = (await c.auth.getUser()).data.user.id;
      await c.from('enge_freunde').delete().eq('user_id', me); const r = await c.from('enge_freunde').insert({ user_id: me, freund_id: b }); return r.error?.message || 'ok'; }, TESTKONTO);
    pruefe('Testkonto auf Enge Freunde', liste === 'ok', liste);
    await page.evaluate(() => openInstants());
    await page.waitForSelector('#instantKamera:not([disabled])', { timeout: 15000 });
    pruefe('Instants-Blatt mit Postfach und Kamera-Knopf', (await page.locator('#instantStapel').count()) === 1);
    await bild('af6-instants');
    await page.locator('#instantKamera').click();
    await page.waitForSelector('#instantAusloeser', { timeout: 15000 });
    await page.waitForTimeout(1500);
    await bild('af6-kamera');
    await page.locator('#instantAusloeser').click();
    await page.waitForSelector('#instantSenden', { timeout: 15000 });
    await page.locator('#instantText').fill('Paket 9 Bildbeleg');
    await bild('af6-vorschau');
    await page.locator('#instantSenden').click();
    await page.waitForTimeout(4000);
    const gesendet = await page.locator('[data-instantzurueck]').count();
    pruefe('Instant gesendet (erscheint unter „Gesendet")', gesendet >= 1, (await page.locator('#instantFehler').innerText().catch(() => '')));
    await bild('af6-gesendet');
    if (gesendet) { await page.locator('[data-instantzurueck]').first().click(); await page.waitForTimeout(2500); }
    pruefe('Zurückgezogen', (await page.locator('[data-instantzurueck]').count()) === 0);
    await page.evaluate(async () => { const c = window.Anmeldung.client(); const me = (await c.auth.getUser()).data.user.id; await c.from('enge_freunde').delete().eq('user_id', me); });
    await testpaarLoesen();
  } finally {
    for (const id of angelegt) await page.evaluate(async (id) => { const c = window.Anmeldung.client(); await c.from('posts').delete().eq('id', id); }, id);
    const rest = await page.evaluate(async () => { const c = window.Anmeldung.client(); const { count } = await c.from('posts').select('id', { count: 'exact', head: true }).like('description', 'Paket 9%'); return count; });
    pruefe('Bildbeleg-Beiträge wieder entfernt', rest === 0, String(rest));
    pruefe('Keine Konsolenfehler mit 404/500', !fehlerKonsole.some((t) => /404|500/.test(t)), fehlerKonsole.slice(0, 3).join(' | '));
    await browser.close();
  }
  console.log(`\n${ok} von ${ok + fehl} Prüfungen bestanden`);
  process.exitCode = fehl ? 1 : 0;
})().catch((e) => { console.error('ABBRUCH', e.message); process.exitCode = 1; });
