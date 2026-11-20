#!/usr/bin/env node
/**
 * Paket 8 (Sicherheit/OWASP) — Offline-Regressionen ohne Netz und Supabase.
 * Start: node test/_paket8_einheit.js   (npm run test:paket8-einheit)
 *
 *  1 fuerMenschen: Postgres-Innenleben bleibt im Server, eigene Sätze gehen durch
 *  2 Website-Routen: kein `error: error.message` mehr, keine Adressen im Log
 *  3 Konto-Bremse: zählt je Konto, nur Schreibendes
 *  4 bildUrl: nur Bildadressen in CSS-url(), Reaktions-Emoji maskiert
 *  5 Token nur an die eigene Herkunft (anmeldung.js)
 *  6 Server-Zwischenspeicher der Unterschriften je Nutzer
 *  7 Expo-Weiche sperrt Debugger-Pfade
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const wurzel = path.join(__dirname, '../..');
const lies = (d) => fs.readFileSync(path.join(wurzel, d), 'utf8');

let anzahl = 0;
let fehler = 0;
async function pruefe(name, fn) {
  try {
    await fn();
    anzahl++;
    console.log('  OK   ' + name);
  } catch (e) {
    fehler++;
    console.log('  FEHL ' + name + '  — ' + e.message.split('\n')[0]);
  }
}

(async () => {
  // --------------------------------------------------------------- 1
  console.log('1 Fehlertexte');
  delete process.env.BUNNY_STORAGE_ZONE;
  const sync = require(path.join(wurzel, 'web/server/sync-handlers.js'));
  const NEUTRAL = 'Das hat nicht geklappt. Bitte versuch es noch einmal.';
  const intern = [
    [{ code: '42501', message: 'new row violates row-level security policy for table "posts"' }, 'Das ist nicht erlaubt.'],
    [{ code: '42703', message: 'column profiles.geheim does not exist' }, NEUTRAL],
    [{ code: '23505', message: 'duplicate key value violates unique constraint "profiles_handle_key"' }, NEUTRAL],
    [{ code: 'PGRST202', message: 'Could not find the function public.x(a) in the schema cache' }, NEUTRAL],
    [{ code: '22P02', message: 'invalid input syntax for type uuid: "abc"' }, NEUTRAL],
    [{ code: '57014', message: 'canceling statement due to statement timeout' }, NEUTRAL],
    [{ code: '40P01', message: 'deadlock detected' }, NEUTRAL],
    [{ code: '40001', message: 'could not serialize access due to concurrent update' }, NEUTRAL],
    [{ code: '42883', message: 'permission denied for function telefonbuch_schluessel' }, NEUTRAL],
  ];
  for (const [f, soll] of intern) {
    await pruefe(`intern ${f.code} → fester Satz`, () => assert.equal(sync.fuerMenschen(f), soll));
  }
  const eigen = [
    { code: '42501', message: 'Dieses Medium darfst du nicht verwenden' },
    { code: 'P0001', message: 'Diese Sammlung nimmt nur Beiträge auf' },
    { code: '54000', message: 'Zu viele Meldungen in kurzer Zeit' },
    { message: 'Bitte anmelden' },
  ];
  for (const f of eigen) {
    await pruefe(`eigener Satz geht durch: „${f.message}"`, () => assert.equal(sync.fuerMenschen(f), f.message));
  }
  await pruefe('leerer Fehler → fester Satz', () => assert.equal(sync.fuerMenschen(null), NEUTRAL));

  // --------------------------------------------------------------- 2
  console.log('\n2 Website-Routen');
  const appJs = lies('web/server/app.js');
  await pruefe('keine Route gibt error.message roh weiter', () => {
    const roh = appJs.split('\n').filter((z) => /(error|fehler):\s*(error|fehler|e)\.message/.test(z) && !/^\s*(\*|\/\/)/.test(z));
    assert.deepEqual(roh, []);
  });
  await pruefe('kein Log enthält req.originalUrl oder req.path', () => {
    const logs = appJs.split('\n').filter((z) => /console\.(error|warn|log)/.test(z) && /req\.(originalUrl|path|url)\b/.test(z));
    assert.deepEqual(logs, []);
  });
  await pruefe('Bremsen-Handler ohne originalUrl', () => assert.ok(!/\$\{req\.originalUrl\}/.test(appJs)));

  // --------------------------------------------------------------- 3
  console.log('\n3 Konto-Bremse');
  const bremsen = [];
  {
    const app = { disable() {}, set() {}, use() {}, get() {}, post() {}, delete() {}, put() {}, patch() {}, listen() {} };
    const express = () => app;
    express.json = express.raw = express.static = express.urlencoded = () => () => {};
    express.Router = () => app;
    function attrappe() {
      const f = function () { return attrappe(); };
      return new Proxy(f, { get: (_z, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : attrappe()) });
    }
    const importe = {
      express, path,
      'express-rate-limit': (o) => { bremsen.push(o); return () => {}; },
      './medien': { mitBunny: () => false, signiereMedien: async (_d, x) => x },
      './bunny': { konfigurationAus: () => ({ ok: false }) },
      './supabase': { supabaseUrl: 'https://example.invalid', supabaseKey: 'x', isConfigured: () => true },
    };
    const modul = { exports: {} };
    vm.runInNewContext(appJs, {
      module: modul, exports: modul.exports, __dirname: path.join(wurzel, 'web/server'),
      process: { env: {}, on() {}, exit() {} }, Buffer, URL, setTimeout, setInterval, clearTimeout, clearInterval,
      console: { error() {}, warn() {}, log() {} },
      require: (id) => (Object.hasOwn(importe, id) ? importe[id] : attrappe()),
    });
  }
  const konto = bremsen.find((b) => b.keyGenerator);
  await pruefe('zweite Bremse vorhanden, 300 je Minute wie je Anschluss', () => {
    assert.equal(bremsen.length, 2);
    assert.ok(konto);
    assert.equal(konto.max, 300);
    assert.equal(konto.windowMs, 60000);
  });
  await pruefe('zählt je Konto, nicht je Anschluss', () => {
    assert.equal(konto.keyGenerator({ nutzerId: 'A', ip: '1.1.1.1' }), konto.keyGenerator({ nutzerId: 'A', ip: '2.2.2.2' }));
    assert.notEqual(konto.keyGenerator({ nutzerId: 'A' }), konto.keyGenerator({ nutzerId: 'B' }));
  });
  await pruefe('lässt Lesen und Abgemeldete durch, bremst Schreiben', () => {
    assert.equal(konto.skip({ nutzerId: 'A', method: 'GET' }), true);
    assert.equal(konto.skip({ nutzerId: null, method: 'POST' }), true);
    assert.equal(konto.skip({ nutzerId: 'A', method: 'POST' }), false);
    assert.equal(konto.skip({ nutzerId: 'A', method: 'DELETE' }), false);
  });
  await pruefe('lesender POST (Unterschreiben) zählt nicht', () => {
    assert.equal(konto.skip({ nutzerId: 'A', method: 'POST', path: '/medien/unterschreiben' }), true);
    assert.equal(konto.skip({ nutzerId: 'A', method: 'POST', path: '/kontakte/x/chat' }), false);
  });

  // --------------------------------------------------------------- 4
  console.log('\n4 Website-Ausgaben');
  const webApp = lies('web/public/app.js');
  const bildUrlQuelle = webApp.match(/function bildUrl\(adresse\) \{[\s\S]*?\n\}/)[0];
  const bildUrl = vm.runInNewContext(`(${bildUrlQuelle})`);
  const erlaubt = [
    'https://ijztosbjfybdgotpdixw.supabase.co/storage/v1/object/sign/media/stories/x.jpg?token=eyJ.a-b_c',
    'https://allmedia.b-cdn.net/stories/x.jpg?token=AbC-_&expires=1763600000',
    'data:image/jpeg;base64,/9j/4AAQSkZJRg+/=',
    'blob:https://all-media.onrender.com/1b2c',
    '/beispiel/foto.jpg',
    'http://localhost:3000/beispiel/foto.jpg',
  ];
  for (const a of erlaubt) await pruefe(`Bild erlaubt: ${a.slice(0, 40)}`, () => assert.equal(bildUrl(a), `url(${a})`));
  const boese = [
    'x);"><meta http-equiv="refresh" content="0;url=https://boese.example">',
    "https://a.example/x.jpg');background:url('https://b",
    'https://a.example/x.jpg) , url(https://boese.example/y',
    'javascript:alert(1)',
    '//boese.example/x.jpg',
    'http://boese.example/x.jpg',
    'data:text/html;base64,PHNjcmlwdD4=',
    'https://a.example/x y.jpg',
    null,
  ];
  for (const a of boese) await pruefe(`Bild abgewiesen: ${String(a).slice(0, 40)}`, () => assert.equal(bildUrl(a), 'none'));
  await pruefe('kein url( ohne bildUrl im Stil', () => {
    const roh = webApp.split('\n').filter((z) => /url\(/.test(z) && !/new URL|bildUrl|^\s*(\*|\/\/)|return `url\(\$\{a\}\)`/.test(z));
    assert.deepEqual(roh, []);
  });
  await pruefe('Reaktions-Emoji wird maskiert', () => {
    assert.ok(/<span class="msg__reaktion">\$\{esc\(e\)\}/.test(webApp));
    assert.ok(!/<span class="msg__reaktion">\$\{e\}/.test(webApp));
  });

  // --------------------------------------------------------------- 5
  console.log('\n5 Token nur an die eigene Herkunft');
  {
    const quelle = lies('web/public/anmeldung.js');
    const start = quelle.indexOf('  const echtesFetch = window.fetch.bind(window);');
    const ende = quelle.indexOf('\n  };', quelle.indexOf('window.fetch = function', start)) + 5;
    assert.ok(start > 0 && ende > start, 'fetch-Hülle nicht gefunden');
    const gesehen = [];
    const fensterFetch = (ziel, opt) => {
      const kopf = opt && opt.headers instanceof Headers ? opt.headers.get('Authorization') : null;
      gesehen.push({ ziel: String(ziel instanceof URL ? ziel.href : ziel), token: kopf });
      return Promise.resolve({ status: 200, ok: true, clone() { return this; }, json: async () => ({}) });
    };
    const kontext = {
      window: { fetch: fensterFetch, KryptoWeb: null },
      location: { href: 'https://all-media.onrender.com/feed', origin: 'https://all-media.onrender.com', host: 'all-media.onrender.com' },
      sitzung: { access_token: 'GEHEIM' },
      Headers, URL, Promise, console,
    };
    vm.runInNewContext(`(function(){ ${quelle.slice(start, ende)} })()`, kontext);
    const rufe = async (ziel) => {
      gesehen.length = 0;
      try { await kontext.window.fetch(ziel, {}); } catch { /* Antwortbehandlung egal */ }
      return gesehen[0];
    };
    const mit = ['/api/bootstrap', 'https://all-media.onrender.com/api/x', 'api/../api/feed'];
    for (const z of mit) await pruefe(`Token an ${z}`, async () => assert.equal((await rufe(z)).token, 'Bearer GEHEIM'));
    const ohne = [
      'https://boese.example/?x=all-media.onrender.com/api',
      'https://all-media.onrender.com.boese.example/api/x',
      '//boese.example/api/x',
      'https://boese.example/api/x',
      '/apifremd',
      'https://ijztosbjfybdgotpdixw.supabase.co/rest/v1/x',
    ];
    for (const z of ohne) await pruefe(`kein Token an ${z}`, async () => assert.equal((await rufe(z)).token, null));
    await pruefe('URL-Objekt der eigenen Herkunft bekommt Token', async () =>
      assert.equal((await rufe(new URL('https://all-media.onrender.com/api/y'))).token, 'Bearer GEHEIM'));
  }

  // --------------------------------------------------------------- 6
  console.log('\n6 Unterschriften je Nutzer (Server)');
  {
    for (const k of ['BUNNY_STORAGE_ZONE', 'BUNNY_STORAGE_KEY', 'BUNNY_STORAGE_HOST', 'BUNNY_PULL_HOST', 'BUNNY_TOKEN_KEY']) delete process.env[k];
    const medien = require(path.join(wurzel, 'web/server/medien.js'));
    const { supabaseUrl } = require(path.join(wurzel, 'web/server/supabase.js'));
    const adresse = `${supabaseUrl}/storage/v1/object/public/media/avatars/a1b2c3-kontakt.jpg`;
    const client = (nutzerId, darf) => {
      const c = {
        nutzerId,
        aufrufe: 0,
        storage: { from: () => ({ createSignedUrls: async (pfade) => {
          c.aufrufe++;
          return { data: pfade.map((p) => (darf ? { path: p, signedUrl: `${supabaseUrl}/sign/${p}?token=${nutzerId}` } : { path: p, error: 'nicht erlaubt' })), error: null };
        } }) },
      };
      return c;
    };
    const A = client('konto-a', true);
    const B = client('konto-b', false);
    const a = await medien.signiereMedien(A, { bild: adresse });
    await pruefe('A bekommt seine Unterschrift', () => assert.match(a.bild, /token=konto-a/));
    const b = await medien.signiereMedien(B, { bild: adresse });
    await pruefe('B bekommt A\'s Unterschrift nicht aus dem Speicher', () => {
      assert.equal(B.aufrufe, 1, 'B muss selbst bei Supabase fragen');
      assert.ok(!String(b.bild).includes('token=konto-a'));
    });
    const a2 = await medien.signiereMedien(A, { bild: adresse });
    await pruefe('A trifft den eigenen Speicher (Egress-Schutz bleibt)', () => {
      assert.equal(A.aufrufe, 1);
      assert.equal(a2.bild, a.bild);
    });
    await medien.signiereMedien(A, { bild: adresse }, 300);
    await pruefe('kurzer Link (5 min) kommt nie aus dem 4-h-Speicher', () => assert.equal(A.aufrufe, 2));
    const ohneKonto = client(undefined, false);
    await medien.signiereMedien(ohneKonto, { bild: adresse });
    await pruefe('Client ohne Konto bekommt keine fremde Unterschrift', () => assert.equal(ohneKonto.aufrufe, 1));
  }

  // --------------------------------------------------------------- 7
  console.log('\n7 Expo-Weiche');
  {
    const weiche = lies('app/web-app.js');
    const gesperrt = vm.runInNewContext(`${weiche.match(/const GESPERRT = \[[^\]]*\];/)[0]}\n${weiche.match(/function normalerPfad\(url\) \{[\s\S]*?\n\}/)[0]}\n${weiche.match(/function istGesperrt\(req\) \{[\s\S]*?\n\}/)[0]}\nistGesperrt`);
    for (const u of ['/inspector/debug?device=0', '/json', '/json/list', '/open-debugger', '/debugger-frontend/x', '//inspector/debug', '/%69nspector/debug', '/x/../json/list', '/JSON/list', '/./json', '/%2Fjson', '/%25%36%39nspector', '/%zz']) {
      await pruefe(`gesperrt: ${u}`, () => assert.equal(gesperrt({ url: u }), true));
    }
    for (const u of ['/', '/index.bundle?platform=ios', '/jsonx', '/assets/x.png']) {
      await pruefe(`frei: ${u}`, () => assert.equal(gesperrt({ url: u }), false));
    }
    await pruefe('Sperre greift vor dem Weiterreichen und beim Upgrade', () => {
      assert.ok(/if \(istGesperrt\(req\)\) \{\s*res\.writeHead\(403/.test(weiche));
      assert.ok(/if \(istGesperrt\(req\)\) return socket\.destroy\(\);/.test(weiche));
    });
  }

  console.log(`\n${anzahl}/${anzahl + fehler} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(1);
});
