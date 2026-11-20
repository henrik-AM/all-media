/**
 * OWASP-Regressionen der Express-Routen ohne Netz oder Supabase.
 * Start: node test/_owasp_server_einheit.js (aus app/), npm run test:owasp-server.
 * Express und alle externen Dienste sind Attrappen (Codex 25.10.2026;
 * Paket 8, 20.11.2026: unbekannte Module als stille Attrappe, weil app.js
 * seit Bunny mehr lädt).
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const wurzel = path.join(__dirname, '../..');
const routen = new Map(), bremsen = [], middleware = [], logs = [];
const app = { disable() {}, set() {}, use(...args) { middleware.push(...args.filter((a) => typeof a === 'function')); } };
for (const methode of ['get', 'post', 'delete']) {
  app[methode] = (pfad, ...handler) => routen.set(`${methode} ${pfad}`, handler.at(-1));
}
const express = () => app;
express.json = express.raw = express.static = () => (_req, _res, next) => next?.();
const neutraleMeldung = 'Das hat nicht geklappt. Bitte versuch es noch einmal.';
const importe = {
  express, path,
  helmet: () => (_req, _res, next) => next?.(),
  'express-rate-limit': (optionen) => { bremsen.push(optionen); return (_req, _res, next) => next?.(); },
  './supabase-api': {},
  './sync-handlers': { fuerMenschen: () => neutraleMeldung },
  './medien': { signiereMedien: async (_db, daten) => daten, mitBunny: () => false },
  './bunny': { konfigurationAus: () => ({ ok: false }) },
  './supabase': { supabaseUrl: 'https://example.invalid', supabaseKey: 'oeffentliche-attrappe', isConfigured: () => true },
  './version': { commit: 'attrappe' },
  qrcode: {},
};
// Jede Eigenschaft und jeder Aufruf liefert wieder eine Attrappe.
function attrappe() {
  const f = function () { return attrappe(); };
  return new Proxy(f, { get: (_z, k) => (k === Symbol.toPrimitive ? () => '' : k === 'then' ? undefined : attrappe()) });
}
const modul = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(wurzel, 'web/server/app.js'), 'utf8'), {
  module: modul, exports: modul.exports, __dirname: path.join(wurzel, 'web/server'),
  process: { env: {}, on() {}, exit() {} }, Buffer, URL, setTimeout, setInterval, clearTimeout, clearInterval,
  console: { error: (...a) => logs.push(a.join(' ')), warn: (...a) => logs.push(a.join(' ')), log() {} },
  require: (id) => {
    if (Object.hasOwn(importe, id)) return importe[id];
    return attrappe();
  },
});

function antwort() {
  return {
    statusCode: 200, headersSent: false, daten: null,
    status(code) { this.statusCode = code; return this; },
    json(daten) { this.daten = daten; this.headersSent = true; return this; },
    setHeader() {},
  };
}
async function aufrufen(methode, pfad, db, zusatz = {}) {
  const res = antwort();
  const req = { method: methode.toUpperCase(), route: { path: pfad }, path: '/api/einladung/VERTRAULICH',
    originalUrl: '/api/einladung/VERTRAULICH?code=VERTRAULICH', nutzerId: 'konto', db,
    body: {}, params: {}, query: {}, headers: {}, ...zusatz };
  await routen.get(`${methode} ${pfad}`)(req, res);
  await Promise.resolve();
  assert.ok(res.daten, 'Route muss eine Antwort liefern');
  return res;
}
let anzahl = 0;
async function pruefe(name, fn) { await fn(); anzahl++; console.log('OK ' + name); }

(async () => {
  await pruefe('Beide Bremsen protokollieren keine Einladungscodes', async () => {
    assert.equal(bremsen.length, 2);
    logs.length = 0;
    for (const b of bremsen) b.handler({ method: 'POST', ip: '127.0.0.1', nutzerId: 'konto',
      originalUrl: '/api/einladung/VERTRAULICH?code=VERTRAULICH' }, antwort(), () => {},
    { max: 1, statusCode: 429, message: { ok: false } });
    assert.equal(logs.length, 2);
    assert.ok(!logs.join('\n').includes('VERTRAULICH'));
  });
  await pruefe('Praesenz gibt keinen Datenbankfehler weiter', async () => {
    const res = await aufrufen('post', '/api/praesenz', { rpc: async () => ({ error: { code: '42P01', message: 'INTERN_TABELLE' } }) });
    assert.equal(res.daten.error, neutraleMeldung);
  });
  await pruefe('Zustandsabfrage gibt keinen Datenbankfehler weiter', async () => {
    const res = await aufrufen('get', '/api/zustand', { from: () => ({ select: async () => ({ error: { code: '42P01', message: 'INTERN_TABELLE' } }) }) });
    assert.equal(res.daten.supabase.fehler, neutraleMeldung);
  });
  await pruefe('Routenfehler protokolliert weder Codeinhalt noch Rohfehler', async () => {
    logs.length = 0;
    const res = await aufrufen('post', '/api/praesenz', { rpc: async () => { throw Object.assign(new Error('VERTRAULICH'), { code: 'XX000' }); } });
    assert.equal(res.statusCode, 500);
    assert.ok(logs.join('\n').includes('/api/praesenz'));
    assert.ok(logs.join('\n').includes('XX000'));
    assert.ok(!logs.join('\n').includes('VERTRAULICH'));
  });
  await pruefe('Parserfehler protokolliert keine Anfrageinhalte', async () => {
    logs.length = 0;
    const handler = middleware.find((fn) => fn.length === 4);
    const res = antwort();
    handler(Object.assign(new Error('VERTRAULICH'), { status: 400 }),
      { method: 'POST', path: '/api/einladung/VERTRAULICH' }, res, () => {});
    assert.equal(res.statusCode, 400);
    assert.ok(!logs.join('\n').includes('VERTRAULICH'));
  });
  await pruefe('Fehlgeschlagene Loeschkontrolle meldet keinen Erfolg', async () => {
    const q = { delete() { this.antwort = { data: null, error: null }; return this; },
      select() { this.antwort = { data: null, error: { code: '08006', message: 'INTERN_TABELLE' } }; return this; },
      eq() { return this; }, then(resolve, reject) { return Promise.resolve(this.antwort).then(resolve, reject); } };
    const res = await aufrufen('post', '/api/kontaktbild', { from: () => q },
      { body: { kontaktId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', url: null } });
    assert.equal(res.daten.ok, false);
    assert.equal(res.daten.error, neutraleMeldung);
  });
  console.log(`${anzahl}/6 Regressionen bestanden`);
})().catch((e) => { console.error(e); process.exitCode = 1; });
