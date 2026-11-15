#!/usr/bin/env node
/**
 * Kasten AF 1 — Website mit Prüfattrappe (ohne Supabase): kommt eine neue
 * Nachricht nach einer Klingel sofort auf den Bildschirm, statt erst im
 * nächsten 4-s-Takt? Belegt nur Stufe 1–2 (Aufbau, Weg im Browser); die
 * Klingel selbst ist nachgestellt (window.Anmeldung.client → Attrappe).
 *
 *   BASE=http://localhost:3200 BILDER=<ordner> node test/_af1-website-klingel.js
 */
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3200';
const BILDER = process.env.BILDER || path.join(__dirname, '..', '..', 'test-bilder');
const CHAT = 'b1000000-0000-4000-8000-0000000000af';

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz !== '' ? '  — ' + zusatz : ''));
};

(async () => {
  const { chromium } = require('playwright-core');
  const { attrappe, bestand } = require('./_attrappe');
  require('fs').mkdirSync(BILDER, { recursive: true });

  const daten = bestand({
    users: {
      me: { id: 'me', name: 'Test Konto', handle: 'test', initials: 'TK' },
      'u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: 'anna', initials: 'AS' },
    },
    chats: [{ id: CHAT, name: 'Anna Schmidt', userId: 'u-anna', members: ['u-anna'], preview: 'Hallo', time: '12:00', unread: 0 }],
  });

  // „Datenbank": die Attrappe antwortet je nach Version.
  let version = 1;
  const verlauf = () => [
    { id: 'm1', from: 'u-anna', text: 'Hallo', time: '12:00' },
    ...(version >= 2 ? [{ id: 'm2', from: 'u-anna', text: 'Neue Nachricht nach der Klingel', time: '12:01' }] : []),
  ];
  const standAbrufe = [];

  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    await attrappe(seite, daten, {
      [`/api/messages/${CHAT}/stand`]: () => {
        standAbrufe.push(Date.now());
        return { ok: true, stand: 'v' + version };
      },
      [`/api/messages/${CHAT}`]: () => verlauf(),
    });
    await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
    await seite.waitForSelector('[data-area="messenger"]', { timeout: 15000 });

    // Nachgestellter supabase-js-Client mit Realtime-Kanal.
    await seite.evaluate(() => {
      window.__kanaele = [];
      const client = {
        channel(thema, opt) {
          const k = {
            thema, privat: !!opt?.config?.private, fns: [], weg: false,
            on(_a, f, fn) { this.fns.push({ e: f.event, fn }); return this; },
            subscribe(fn) { setTimeout(() => fn('SUBSCRIBED'), 10); return this; },
          };
          window.__kanaele.push(k);
          return k;
        },
        removeChannel(k) { k.weg = true; },
      };
      window.Anmeldung = Object.assign(window.Anmeldung || {}, { client: () => client });
    });

    await seite.click('[data-area="messenger"]');
    await seite.waitForSelector(`[data-chat="${CHAT}"], [data-chat-id="${CHAT}"], .chatrow`, { timeout: 10000 }).catch(() => {});
    const zeile = (await seite.$(`[data-chat="${CHAT}"]`)) || (await seite.$(`[data-chat-id="${CHAT}"]`)) || (await seite.$('.chatrow'));
    pruefe('Chat in der Liste', !!zeile);
    if (zeile) await zeile.click();
    await seite.waitForSelector('#messages', { timeout: 10000 }).catch(() => {});
    await seite.waitForTimeout(600);

    const kanaele = await seite.evaluate(() => window.__kanaele.map((k) => ({ thema: k.thema, privat: k.privat, weg: k.weg })));
    const chatKanal = kanaele.find((k) => k.thema === 'chat:' + 'b1000000-0000-4000-8000-0000000000af' && !k.weg);
    pruefe('offener Chat hört privaten Kanal chat:<id>', !!chatKanal && chatKanal.privat, JSON.stringify(kanaele));
    await seite.screenshot({ path: path.join(BILDER, 'af1-1-chat-offen.png') });
    pruefe('vor der Klingel: nur „Hallo"', !(await seite.textContent('#messages')).includes('Neue Nachricht'));

    // A schreibt → Datenbank ändert sich → Klingel.
    version = 2;
    const geklingelt = Date.now();
    await seite.evaluate(() => {
      for (const k of window.__kanaele) if (!k.weg && k.thema.startsWith('chat:')) k.fns.forEach((f) => f.e === 'klingel' && f.fn({}));
    });
    let da = null;
    for (let i = 0; i < 30; i++) {
      if ((await seite.textContent('#messages')).includes('Neue Nachricht nach der Klingel')) { da = Date.now() - geklingelt; break; }
      await seite.waitForTimeout(50);
    }
    pruefe('neue Nachricht nach der Klingel in unter 1,5 s sichtbar (Takt wäre 4 s)', da !== null && da < 1500, da === null ? 'nicht da' : da + ' ms');
    await seite.screenshot({ path: path.join(BILDER, 'af1-2-nach-klingel.png') });

    // Mit verbundener Klingel fragt der Takt seltener: in 9 s höchstens ein Abruf.
    const vorher = standAbrufe.length;
    await seite.waitForTimeout(9000);
    pruefe('mit Klingel kein 4-s-Takt mehr', standAbrufe.length - vorher === 0, String(standAbrufe.length - vorher) + ' Abrufe in 9 s');

    // Zurück aus einem anderen Tab → sofort nachsehen.
    const vorTab = standAbrufe.length;
    await seite.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await seite.waitForTimeout(400);
    pruefe('Zurück in den Tab → sofort nachgesehen', standAbrufe.length > vorTab);

    // Chat schließen → Klingel aus.
    await seite.click('#chatBack');
    await seite.waitForTimeout(300);
    const nachZu = await seite.evaluate(() => window.__kanaele.filter((k) => k.thema.startsWith('chat:')).every((k) => k.weg));
    pruefe('Chat zu → Kanal abgemeldet', nachZu);
    pruefe('keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
  console.log(`\n${anzahl - fehler}/${anzahl} bestanden`);
  process.exit(fehler ? 1 : 0);
})();
