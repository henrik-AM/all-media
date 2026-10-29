#!/usr/bin/env node
/**
 * K28/13: echte Filterfunktionen beider Clients, vollständig ohne Cloud.
 * App: tatsächliche TSX-Komponente in kleiner Hook-Hülle, kein nativer Renderer.
 * Web: tatsächliches renderCommunities/communityRow mit Browser-Klicks; nur
 * Avatar, Vorschläge und Beitreten sind isolierte Randfunktionen. Kein Bootstrap,
 * keine Anmeldung, keine .env, keine Datenbank. Keine Abnahme anderer Kästen.
 *
 * node app/test/k28-filter-offline.js
 * Lokaler statischer Server ausschließlich 127.0.0.1:3301. Port vorher belegen.
 * Optional BILDER=/erlaubter/temp/pfad für ein Website-Bild; Simulator bleibt offen.
 * QUELLWURZEL erlaubt die Gegenprobe auf einem anderen Git-Stand.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require('playwright-core');
const ts = require('typescript');

const ROOT = process.env.QUELLWURZEL ? path.resolve(process.env.QUELLWURZEL) : path.resolve(__dirname, '../..');
const ORIGIN = 'http://127.0.0.1:3301';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const fixtures = [
  { id: 'public', name: 'Fotografie', topic: 'Kamera gemeinsam', visibility: 'public', joined: true },
  { id: 'private', name: 'Geheimclub', topic: 'Kamera privat', visibility: 'private', joined: true },
  { id: 'foreign-public', name: 'Kochen', topic: 'Kamera fremd', visibility: 'public', joined: false },
  { id: 'foreign-private', name: 'Unsichtbar', topic: 'Kamera fremd', visibility: 'private', joined: false },
].map((c) => ({ members: 4, unread: 0, unreadCount: 0, eigen: true, ...c }));
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`FEHL ${name}: ${error.message}`); }
}
const ids = (rows) => rows.map((c) => c.id).sort().join(',');

async function appChecks() {
  let communities = fixtures;
  const slots = [];
  let cursor = 0;
  const element = (type, props, ...children) => ({ type, props: { ...props, children } });
  const react = {
    createElement: element,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useMemo(fn) { return fn(); },
  };
  const dependencies = {
    react: { __esModule: true, default: react, ...react },
    'react-native': { FlatList: 'FlatList', Text: 'Text', View: 'View', StyleSheet: {} },
    '@expo/vector-icons/Ionicons': { __esModule: true, default: 'Ionicons' },
    '../../constants/design': { colors: {}, radius: {}, spacing: {}, typography: {}, themenStyles: () => ({}) },
    '../../contexts/ProfilContext': { useProfil: () => ({ communities, kanalBeitreten() {}, kanalGelesen() {} }) },
  };
  for (const name of ['Druck', 'EmptyState', 'FilterPillen', 'SearchBar', 'Avatar', 'PersonenVorschlaege']) {
    dependencies[`../../components/${name}`] = { [name]: name };
  }
  const module = { exports: {} };
  const compiled = ts.transpileModule(read('app/screens/communities/CommunitiesScreen.tsx'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(compiled, {
    module, exports: module.exports,
    require(name) { if (!(name in dependencies)) throw new Error(`Unbekannte App-Abhängigkeit: ${name}`); return dependencies[name]; },
  }, { timeout: 2000 });
  const render = () => { cursor = 0; return module.exports.CommunitiesScreen({ onNotice() {}, onOpenCommunity() {} }); };
  function node(tree, type) {
    if (!tree || typeof tree !== 'object') return undefined;
    if (Array.isArray(tree)) return tree.map((item) => node(item, type)).find(Boolean);
    return tree.type === type ? tree : node(tree.props?.children, type);
  }
  let tree = render();
  const choose = (key) => {
    const pills = node(tree, 'FilterPillen');
    assert.ok(pills, 'FilterPillen fehlen');
    pills.props.onChange(key); tree = render();
  };
  const search = (query) => { node(tree, 'SearchBar').props.onChangeText(query); tree = render(); };
  const visible = () => ids(node(tree, 'FlatList').props.data);
  const emptyTitle = () => node(tree, 'FlatList').props.ListEmptyComponent.props.title;
  await check('App: genau Alle / Öffentlich / Privat', () => assert.deepEqual(
    Array.from(node(tree, 'FilterPillen')?.props.pillen || [], (p) => p.label), ['Alle', 'Öffentlich', 'Privat']));
  await check('App: Alle enthält nur beigetretene Communitys', () => assert.equal(visible(), 'private,public'));
  await check('App: Öffentlich und aktive Auswahl', () => { choose('oeffentlich'); assert.equal(visible(), 'public'); assert.equal(node(tree, 'FilterPillen').props.aktiv, 'oeffentlich'); });
  await check('App: Privat und aktive Auswahl', () => { choose('privat'); assert.equal(visible(), 'private'); assert.equal(node(tree, 'FilterPillen').props.aktiv, 'privat'); });
  await check('App: Themen-Suche kombiniert sich mit Privat', () => { search('  KAMERA  '); assert.equal(visible(), 'private'); });
  await check('App: Namenssuche bleibt beim Filterwechsel erhalten', () => { search('foto'); assert.equal(visible(), ''); choose('oeffentlich'); assert.equal(visible(), 'public'); });
  await check('App: Nulltreffer zeigt passenden Leertext', () => { search('fehlt-vollstaendig'); assert.equal(visible(), ''); assert.equal(emptyTitle(), 'Keine Community gefunden'); });
  await check('App: Privat ohne Treffer zeigt privaten Leertext', () => { search(''); choose('privat'); communities = fixtures.filter((c) => c.visibility !== 'private'); tree = render(); assert.equal(emptyTitle(), 'Keine private Community'); });
  await check('App: Öffentlich ohne Treffer zeigt öffentlichen Leertext', () => { communities = []; choose('oeffentlich'); assert.equal(emptyTitle(), 'Keine öffentliche Community'); });
  await check('App: Alle ohne Mitgliedschaft zeigt passenden Leertext', () => { choose('alle'); assert.equal(emptyTitle(), 'Noch keiner Community beigetreten'); });
}

function between(source, start, end) {
  const from = source.indexOf(start);
  assert.ok(from >= 0, `Quellfunktion fehlt: ${start}`);
  const to = source.indexOf(end, from);
  assert.ok(to > from, `Funktionsgrenze fehlt: ${end}`);
  return source.slice(from, to);
}
async function webChecks() {
  const source = read('web/public/app.js');
  const defaultFilter = source.match(/\bcommunityFilter:\s*'([^']+)'/);
  assert.ok(defaultFilter, 'communityFilter-Vorgabe fehlt');
  const renderSource = between(source, 'function renderCommunities() {', '\n// Beitreten/Verlassen wird an mehreren Stellen angeboten.');
  const rowSource = between(source, 'function communityRow(c) {', '\n/* ------------------------------------------------ eigene Bildschirmzeit */');
  const script = `
    const main = document.querySelector('#main');
    const $ = (selector) => document.querySelector(selector);
    // Sichtbare SVG-Randattrappen mit realer Trefferfläche: Klicken bleibt echt.
    const ICONS = {
      search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/></svg>',
      close: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
      people: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M19 14a5 5 0 0 1 2 4v3"/></svg>',
      lock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    };
    function esc(value) { return String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
    const state = {communities:${JSON.stringify(fixtures)},communityQuery:'',communityFilter:${JSON.stringify(defaultFilter[1])},openCommunityId:null};
    const communityAvatar = () => '<span aria-hidden="true">●</span>';
    const vorschlaegeHtml = () => '';
    const vorschlaegeEinhaengen = () => {};
    const bindJoinButtons = () => {};
    const toast = () => {};
    function renderCommunityChannels() { throw new Error('Anderer Kasten: Community öffnen'); }
    ${rowSource}
    ${renderSource}
    window.k13Empty = () => { state.communities = []; state.communityQuery = ''; renderCommunities(); };
    renderCommunities();
  `;
  const html = '<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles.css"><style>:root{--page-bg:#fff;--text:#111;--text-3:#777;--line:#ddd;--surface:#fff;--brand:#6756dc;--radius:16px}#main{max-width:440px;margin:auto}</style><title>K28/13 isolierte Offline-Prüfung</title><main id="main"></main><script src="/fixture.js"></script></html>';
  const resources = new Map([
    ['/', ['text/html; charset=utf-8', html]],
    ['/fixture.js', ['text/javascript; charset=utf-8', script]],
    ['/styles.css', ['text/css; charset=utf-8', read('web/public/styles.css')]],
  ]);
  const server = http.createServer((req, res) => {
    const resource = resources.get(req.url);
    res.writeHead(resource ? 200 : 404, { 'Content-Type': resource?.[0] || 'text/plain', 'Cache-Control': 'no-store' });
    res.end(resource?.[1] || 'Nicht Teil der isolierten Prüfung');
  });
  let browser;
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(3301, '127.0.0.1', resolve); });
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 400, height: 860 }, serviceWorkers: 'block' });
    const blockedHttp = [];
    const blockedSockets = [];
    const errors = [];
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url());
      if (url.origin !== ORIGIN || !resources.has(url.pathname) || url.search) {
        blockedHttp.push(url.href); return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    assert.equal(typeof context.routeWebSocket, 'function', 'Playwright benötigt routeWebSocket; kein ungeschützter Rückfall');
    await context.routeWebSocket('**/*', (socket) => {
      blockedSockets.push(socket.url()); socket.close({ code: 1008, reason: 'Offline-Prüfung: WebSockets gesperrt' });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(ORIGIN, { waitUntil: 'load' });
    await check('Netzsperre: externer HTTP-Aufruf vor Verbindung abgewiesen', async () => {
      await page.evaluate(() => fetch('https://k13-offline.invalid/probe').catch(() => null));
      assert.deepEqual(blockedHttp, ['https://k13-offline.invalid/probe']);
    });
    await check('Netzsperre: externer WebSocket ohne connectToServer geschlossen', async () => {
      await page.evaluate(() => new Promise((resolve) => {
        const timer = setTimeout(resolve, 2000);
        const socket = new WebSocket('wss://k13-offline.invalid/probe');
        socket.onclose = socket.onerror = () => { clearTimeout(timer); resolve(); };
      }));
      assert.deepEqual(blockedSockets, ['wss://k13-offline.invalid/probe']);
    });
    blockedHttp.length = 0; blockedSockets.length = 0;
    const visible = () => page.locator('[data-community]').evaluateAll((rows) => rows.map((r) => r.dataset.community).sort().join(','));
    const choose = (key) => page.locator(`[data-cfilter="${key}"]`).click();
    const active = () => page.locator('[data-cfilter].is-active').getAttribute('data-cfilter');
    const empty = () => page.locator('.empty__title').textContent().then((s) => s.trim());
    await check('Web: genau Alle / Öffentlich / Privat', async () => assert.deepEqual(await page.locator('[data-cfilter]').allTextContents(), ['Alle', 'Öffentlich', 'Privat']));
    await check('Web: Alle startet aktiv und schließt Nichtmitglieder aus', async () => { assert.equal(await active(), 'alle'); assert.equal(await visible(), 'private,public'); });
    await check('Web: Öffentlich filtert und markiert', async () => { await choose('oeffentlich'); assert.equal(await visible(), 'public'); assert.equal(await active(), 'oeffentlich'); });
    await check('Web: Privat filtert und markiert', async () => { await choose('privat'); assert.equal(await visible(), 'private'); assert.equal(await active(), 'privat'); });
    await check('Web: Themen-Suche mit Leerzeichen und Großschreibung', async () => { await page.locator('#commSearch').fill('  KAMERA  '); assert.equal(await visible(), 'private'); });
    await check('Web: Namenssuche kombiniert sich mit Filter', async () => { await page.locator('#commSearch').fill('foto'); assert.equal(await visible(), ''); assert.equal(await empty(), 'Keine Community gefunden'); });
    await check('Web: Filterwechsel erhält Suchbegriff', async () => { await choose('oeffentlich'); assert.equal(await page.locator('#commSearch').inputValue(), 'foto'); assert.equal(await visible(), 'public'); });
    await check('Web: Suche löschen zeigt gefilterte Liste', async () => { await page.locator('#commSearchClear').click(); assert.equal(await page.locator('#commSearch').inputValue(), ''); assert.equal(await visible(), 'public'); });
    await check('Web: Nulltreffer nennt den Suchbegriff', async () => { await page.locator('#commSearch').fill('fehlt-vollstaendig'); assert.equal(await visible(), ''); assert.equal(await empty(), 'Keine Community gefunden'); assert.match(await page.locator('.empty__text').textContent(), /fehlt-vollstaendig/); });
    await page.locator('#commSearchClear').click(); await choose('alle');
    if (process.env.BILDER) {
      fs.mkdirSync(process.env.BILDER, { recursive: true });
      await page.screenshot({ path: path.join(process.env.BILDER, 'k28-13-filter-offline.png'), fullPage: true });
    }
    await page.evaluate(() => window.k13Empty());
    await check('Web: Alle ohne Mitgliedschaft zeigt passenden Leertext', async () => assert.equal(await empty(), 'Noch keiner Community beigetreten'));
    await check('Web: leerer privater Filter nennt Privat', async () => { await choose('privat'); assert.equal(await empty(), 'Keine private Community'); });
    await check('Web: leerer öffentlicher Filter nennt Öffentlich', async () => { await choose('oeffentlich'); assert.equal(await empty(), 'Keine öffentliche Community'); });
    await check('Web: nach Gegenprobe keinerlei unerwartete Netz-/WS-Versuche', () => { assert.deepEqual(blockedHttp, []); assert.deepEqual(blockedSockets, []); });
    await check('Web: keine JavaScript-Fehler', () => assert.deepEqual(errors, []));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
(async () => {
  await appChecks();
  await webChecks();
  console.log(`\n${passed}/${passed + failed} Prüfungen bestanden. App: Hook-Hülle; Web: isolierter Renderer; keine Live-/Simulatorabnahme.`);
  process.exitCode = failed ? 1 : 0;
})().catch((error) => { console.error(error.stack); process.exitCode = 1; });
