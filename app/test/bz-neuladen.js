#!/usr/bin/env node
/**
 * Bildschirmzeit-Regeln greifen ohne Neustart (09.11.2026).
 *
 * Befund: App und Website luden bildschirmzeit_stand nur beim Start und bei
 * Rückkehr in den Vordergrund. Ein Limit, das woanders gesetzt wurde (Eltern
 * am anderen Gerät, Website, zweites Gerät), griff erst nach Neustart.
 * Lösung: im 30-s-Takt nachladen, sobald der Stand älter als 90 s ist, und
 * beim Bereichswechsel, wenn er älter als 60 s ist (Bildschirmzeit.standFaellig).
 *
 *   A  ohne Netz: Regel im Baustein, App und Website im Quelltext.
 *   B  Website mit Prüfattrappe und gestellter Uhr (Playwright clock):
 *      neues Limit sperrt Videos ohne Neuladen der Seite binnen ~90 s,
 *      Ladezahl je Stunde, Bereichswechsel, kein Laden bei verstecktem Tab.
 *      Belegt Stufe 1–2 — die Datenbank prüft test:bildschirmzeit.
 *
 * Start:  (cd web && PORT=3210 node server/lokal.js)
 *         BASE=http://localhost:3210 BILDER=<ordner> node app/test/bz-neuladen.js
 *         OHNE_BROWSER=1   nur Teil A
 */
const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://localhost:3210';
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK    ' : '  FEHL  ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log('\nA  Baustein und Quelltext');
  const B = require(path.join(WURZEL, 'gemeinsam', 'bildschirmzeit.js'));
  const f = B.standFaellig;
  pruefe('Baustein: standFaellig, 90 s / 60 s', typeof f === 'function' && B.STAND_NEU_SEKUNDEN === 90 && B.STAND_WECHSEL_SEKUNDEN === 60);
  pruefe('nie geladen → fällig', f(null, 0, 'takt') && f(null, 0, 'wechsel'));
  pruefe('Takt: 74 s nein, 75 s ja (jeder dritte 30-s-Takt)', !f(0, 74000, 'takt') && f(0, 75000, 'takt'));
  pruefe('Wechsel: 59 s nein, 60 s ja', !f(0, 59000, 'wechsel') && f(0, 60000, 'wechsel'));
  pruefe('Uhr zurückgestellt → fällig', f(10000, 0, 'takt'));
  // Takt im 30-s-Raster mit Laufzeit: Laden beginnt bei 0, 90, 180 … s.
  let geladen = 0;
  let laeufe = 0;
  for (let t = 30; t <= 3600; t += 30) {
    if (f(geladen, t * 1000 + 40, 'takt')) {
      geladen = t * 1000 + 40;
      laeufe++;
    }
  }
  pruefe('eine Stunde nur Takt: 40 Ladevorgänge', laeufe === 40, String(laeufe));
  const dts = lies('gemeinsam/bildschirmzeit.d.ts');
  pruefe('d.ts kennt standFaellig und die Konstanten', /export function standFaellig\(/.test(dts) && /STAND_NEU_SEKUNDEN/.test(dts) && /STAND_WECHSEL_SEKUNDEN/.test(dts));

  const app = lies('app/contexts/BildschirmzeitContext.tsx');
  pruefe('App: Takt lädt nach dem Schicken, nur im Vordergrund',
    /await schicken\(\);\s*if \(imVordergrund\.current && Bildschirmzeit\.standFaellig\(geladenUm\.current, Date\.now\(\), 'takt'\)\)/.test(app));
  pruefe('App: Bereichswechsel lädt mit Anlass „wechsel“', /Bildschirmzeit\.standFaellig\(geladenUm\.current, Date\.now\(\), 'wechsel'\)/.test(app) && /\}, \[bereich, neuLaden\]\);/.test(app));
  pruefe('App: ältere Antwort überschreibt keinen frischeren Stand', /nr === ladeNr\.current/.test(app));
  pruefe('App: kein Realtime', !/postgres_changes|\.channel\(/.test(app));

  const web = lies('web/public/app.js');
  const bzTeil = web.slice(web.indexOf('/* ------------------------------------------------ eigene Bildschirmzeit */'), web.indexOf('/* --- Einstellungen → Bildschirmzeit'));
  pruefe('Website: Takt lädt nach dem Schicken, nur bei sichtbarem Tab',
    /bzSchicken\(\)\.then\(\(\) => \{\s*if \(document\.visibilityState === 'visible' && bzAngemeldet\(\) && BZ\.standFaellig\(bz\.geladenUm, Date\.now\(\), 'takt'\)\)/.test(bzTeil));
  pruefe('Website: Bereichswechsel lädt mit Anlass „wechsel“', /BZ\.standFaellig\(bz\.geladenUm, Date\.now\(\), 'wechsel'\)/.test(bzTeil));
  pruefe('Website: ältere Antwort überschreibt keinen frischeren Stand', /nr === bz\.ladeNr/.test(bzTeil));
  pruefe('Website: kein Realtime', !/postgres_changes|\.channel\(/.test(bzTeil));
}

/* --------------------------------------------- B Website, Attrappe, Uhr */
const nachbau = () => {
  const client = {
    auth: { signInWithPassword: async () => ({ data: {}, error: null }) },
    rpc: async (name) => (name === 'zustimmung_offen' ? { data: [], error: null } : { data: null, error: null }),
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

async function teilB() {
  console.log(`\nB  Website mit Attrappe und gestellter Uhr (${BASE})`);
  const { chromium } = require('playwright-core');
  const { attrappe, bestand } = require('./_attrappe');
  // Dienstag 10.11.2026, 10:00 Berlin — Werktag, keine Auszeit.
  const START = new Date('2026-11-10T09:00:00Z');
  const TAG = '2026-11-10';
  const LIMIT = { bereiche: { videos: { modus: 'limit', werktag: 1, wochenende: 1 } } };
  let regeln = {};
  const nutzung = { videos: 120 };
  const stand = () => ({
    ok: true, ziel: 'me', ich: true, regeln, zeitzone: 'Europe/Berlin', tag: TAG, nutzung: { ...nutzung },
    woche: [], freigaben: [], eltern: null, code_gesetzt: false, code_art: 'spenden', eigener_code: false, eigene_art: 'spenden', kinder: [],
  });

  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    seite.setDefaultTimeout(15000);
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    await seite.clock.install({ time: START });
    await seite.addInitScript(nachbau);
    const aufrufe = await attrappe(seite, bestand({}), {
      '/api/bildschirmzeit': () => stand(),
      '/api/bildschirmzeit/zaehlen': (a) => {
        for (const s of JSON.parse(a.postData() || '{}').stuecke || []) nutzung[s.bereich] = (nutzung[s.bereich] || 0) + s.sekunden;
        return { ok: true, tag: TAG, nutzung: { ...nutzung } };
      },
    });
    const laden = () => aufrufe.filter((a) => a.methode === 'GET' && a.pfad === '/api/bildschirmzeit').length;
    // Uhr in 2-s-Schritten vorstellen, dazwischen echte Zeit für fetch.
    const vor = async (sekunden) => {
      for (let s = 0; s < sekunden; s += 2) {
        await seite.clock.runFor(2000);
        await seite.waitForTimeout(15);
      }
      await seite.waitForTimeout(80);
    };
    const gesperrt = () => seite.$('main [data-bz-sperre="videos"]').then(Boolean);

    let neuGeladen = 0;
    seite.on('framenavigated', (fr) => { if (fr === seite.mainFrame()) neuGeladen++; });
    await seite.goto(BASE, { waitUntil: 'load' });
    await seite.waitForSelector('[data-area="videos"]');
    await seite.click('[data-area="videos"]');
    await vor(6);
    pruefe('Start: Stand geladen, Videos offen', laden() >= 1 && !(await gesperrt()), `laden=${laden()}`);

    // 1) Limit „woanders“ gesetzt — die Seite wird nicht neu geladen.
    await vor(30);
    regeln = LIMIT;
    const vorLimit = laden();
    let sekunden = 0;
    while (!(await gesperrt()) && sekunden < 150) {
      await vor(2);
      sekunden += 2;
    }
    pruefe('Limit von außen sperrt Videos ohne Neuladen', await gesperrt(), `nach ${sekunden} s`);
    pruefe('… spätestens nach 90 s', sekunden <= 90, `${sekunden} s`);
    pruefe('… dafür genau ein weiterer Stand-Aufruf', laden() - vorLimit === 1, String(laden() - vorLimit));
    pruefe('Seite nie neu geladen', neuGeladen === 1, String(neuGeladen));
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, 'bz-neuladen-web-gesperrt.png') });

    // 2) Limit woanders wieder weg → Videos gehen ohne Neuladen wieder auf.
    regeln = {};
    sekunden = 0;
    while ((await gesperrt()) && sekunden < 150) {
      await vor(2);
      sekunden += 2;
    }
    pruefe('Limit weg → Videos wieder offen, spätestens nach 90 s', !(await gesperrt()) && sekunden <= 90, `${sekunden} s`);

    // 3) Ladezahl: 10 Minuten auf Videos.
    const a0 = laden();
    await vor(600);
    const n10 = laden() - a0;
    pruefe('10 min sichtbar auf einem Bereich: 6–7 Stand-Aufrufe (≈ 40/h)', n10 >= 6 && n10 <= 7, String(n10));
    const z10 = aufrufe.filter((a) => a.pfad === '/api/bildschirmzeit/zaehlen').length;
    pruefe('Zählen bleibt im 30-s-Takt', z10 >= 19, String(z10));

    // 4) Bereichswechsel (die Seite steht auf Videos): frisch geladen erst ab 60 s Alter.
    await seite.evaluate(() => { bz.geladenUm = Date.now() - 30000; });
    const vorW1 = laden();
    await seite.click('[data-area="messenger"]');
    await vor(2);
    pruefe('Bereichswechsel mit 30 s altem Stand → nicht geladen', laden() - vorW1 === 0, String(laden() - vorW1));
    await seite.evaluate(() => { bz.geladenUm = Date.now() - 61000; });
    const vorW2 = laden();
    await seite.click('[data-area="videos"]');
    await vor(2);
    pruefe('Bereichswechsel mit 61 s altem Stand → sofort geladen', laden() - vorW2 === 1, String(laden() - vorW2));

    // 5) Tab versteckt: kein Laden im Takt.
    await seite.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const vorVersteckt = laden();
    await vor(300);
    pruefe('Tab versteckt, 5 min: kein Stand-Aufruf', laden() - vorVersteckt === 0, String(laden() - vorVersteckt));
    await seite.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await vor(4);
    pruefe('Tab wieder sichtbar: gleich frisch geladen', laden() - vorVersteckt === 1, String(laden() - vorVersteckt));

    pruefe('Keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_BROWSER) {
    try {
      await teilB();
    } catch (e) {
      fehler++;
      console.log('  FEHL  Teil B abgebrochen  — ' + (e.message || e).toString().split('\n')[0]);
    }
  }
  console.log(`\n${geprueft - fehler}/${geprueft} OK`);
  process.exit(fehler ? 1 : 0);
})();
