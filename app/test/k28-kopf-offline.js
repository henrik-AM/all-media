#!/usr/bin/env node
/**
 * K28/11.1–2: tatsächlicher TSX-Kopf und tatsächliche Web-Renderer, isoliert.
 * Keine Voll-App-, native-, Datenbank- oder Cloud-Abnahme. Keine .env.
 * node app/test/k28-kopf-offline.js (Port 127.0.0.1:3301 vorher belegen).
 * Optional BILDER=temp-Pfad; QUELLWURZEL=anderer-Stand für Gegenprobe.
 * App-Abhängigkeiten außerhalb des Kopfes und Web-Randfunktionen sind Attrappen.
 * Der originale Polling-Callback läuft manuell, seine Antworten sind echte lokale
 * HTTP-Antworten; die zweite Antwort wird gezielt erst nach Navigation freigegeben.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { chromium } = require('playwright-core');
const ROOT = process.env.QUELLWURZEL ? path.resolve(process.env.QUELLWURZEL) : path.resolve(__dirname, '../..');
const ORIGIN = 'http://127.0.0.1:3301';
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
let passed = 0;
let failed = 0;
async function check(name, fn) {
  try { await fn(); passed++; console.log(`OK ${name}`); }
  catch (error) { failed++; console.error(`FEHL ${name}: ${error.message}`); }
}
function between(text, start, end) {
  const a = text.indexOf(start); assert.ok(a >= 0, `Anfang fehlt: ${start}`);
  const b = text.indexOf(end, a + start.length); assert.ok(b > a, `Ende fehlt: ${end}`);
  return text.slice(a, b);
}
const community = {
  id: 'com-b', name: 'Foto <Club> "B" & Freunde', members: 37, joined: true, eigen: true,
  channels: [{ id: '11111111-1111-4111-8111-111111111111', name: 'Allgemein <img src=x onerror="window.k11Xss=1"> & "Team"', topics: ['Anderes Thema'] }],
};

async function appChecks() {
  const source = read('app/screens/messenger/ChatDetailScreen.tsx');
  const headerAt = source.indexOf('style={styles.headerBody}');
  assert.ok(headerAt >= 0, 'Header fehlt');
  const header = source.slice(source.lastIndexOf('<Druck', headerAt), source.indexOf('</Druck>', headerAt) + '</Druck>'.length);
  // Tatsächliche Deklarationsausdrücke aus dem TS-AST, keine Nachbildung der Suche.
  const tree = ts.createSourceFile('ChatDetailScreen.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['kanalCommunity', 'kanalName', 'istKanal'].includes(node.name.text)) {
      declarations.set(node.name.text, `const ${node.getText(tree)};`);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  const statements = [...declarations.values()].join('\n');
  const code = ts.transpileModule(`module.exports = function(props) {
    const {chat,communities,onOpenCommunity,onOpenProfile,onOpenGroupSettings,praesenz='Online'}=props;
    ${statements}
    return (${header});
  };`, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  vm.runInNewContext(code, { module, React, Druck: 'Druck', Text: 'Text', styles: { headerBody: 'body', headerName: 'name', headerStatus: 'status', headerStatusMuted: 'muted' } }, { timeout: 2000 });
  const communities = [
    { id: 'com-a', name: 'A', unterthemen: [{ id: 'anderer-kanal', name: 'Allgemein' }] },
    { id: 'com-b', name: 'B', unterthemen: [{ id: community.channels[0].id, name: 'Allgemein' }] },
  ];
  const calls = [];
  const base = {
    communities,
    onOpenCommunity: (id) => calls.push(['community', id]),
    onOpenProfile: (id) => calls.push(['profile', id]),
    onOpenGroupSettings: (id) => calls.push(['group', id]),
  };
  const flatten = (value) => value == null || value === false ? '' : Array.isArray(value) ? value.map(flatten).join('') : typeof value === 'object' ? flatten(value.props?.children) : String(value);
  const channelChat = { id: community.channels[0].id, name: 'B · Allgemein', isGroup: true, memberIds: ['u1', 'u2'] };
  let headerTree = module.exports({ ...base, chat: channelChat });
  await check('App: nur # Unterthema, ohne Community oder Mitgliederzahl, Kopf aktiv', () => { assert.equal(flatten(headerTree), '# Allgemein'); assert.equal(headerTree.props.disabled, false); });
  await check('App: technische Chatbezeichnung bleibt unverändert', () => assert.equal(channelChat.name, 'B · Allgemein'));
  await check('App: Kopfklick nimmt richtige ID bei gleichnamigen Unterthemen', () => { headerTree.props.onPress(); assert.deepEqual(calls.pop(), ['community', 'com-b']); });
  await check('App: Zugänglichkeitslabel bezeichnet Ziel-Community', () => assert.equal(headerTree.props.accessibilityLabel, '# Allgemein, zur Community B'));
  await check('App: Einzelchat behält Name, Präsenz und Profilklick', () => {
    headerTree = module.exports({ ...base, chat: { id: 'chat-einzeln', name: 'Anna', userId: 'u-anna', isGroup: false } });
    assert.equal(flatten(headerTree), 'AnnaOnline'); headerTree.props.onPress(); assert.deepEqual(calls.pop(), ['profile', 'u-anna']);
  });
  // Paket 5: seit Kasten 28/7.9 (main) öffnet schon das Antippen die Gruppeninfo — gewollt.
  await check('App: Gruppenkopf-Klick öffnet die Gruppeninfo (Kasten 7.9), nicht die Community', () => {
    headerTree = module.exports({ ...base, chat: { id: 'gruppe', name: 'Gruppe', isGroup: true, memberIds: ['a', 'b'] } });
    assert.equal(flatten(headerTree), 'Gruppe3 Mitglieder'); headerTree.props.onPress(); assert.deepEqual(calls.pop(), ['group', 'gruppe']);
  });
  await check('App: Gruppe öffnet bestehende Gruppeninfo weiterhin per LongPress', () => { headerTree.props.onLongPress(); assert.deepEqual(calls.pop(), ['group', 'gruppe']); });
  // Tatsächliche App.tsx-Prop aus TS-AST ausführen, ohne ganze Shell zu booten.
  const shellText = read('app/App.tsx');
  const shell = ts.createSourceFile('App.tsx', shellText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function findCallback(node) {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(shell) === 'ChatDetailScreen' || ts.isJsxSelfClosingElement(node) && node.tagName.getText(shell) === 'ChatDetailScreen') {
      callback = node.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(shell) === 'onOpenCommunity')?.initializer?.expression;
    }
    ts.forEachChild(node, findCallback);
  }
  findCallback(shell);
  await check('App: Shell-Kopfrückweg setzt Community-Overlay ohne Optionsblatt', () => {
    assert.ok(callback, 'onOpenCommunity an ChatDetailScreen fehlt');
    const compiled = ts.transpileModule(`module.exports = ${callback.getText(shell)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    let overlay;
    const target = { exports: {} };
    vm.runInNewContext(compiled, { module: target, setOverlay: (value) => { overlay = value; } }, { timeout: 2000 });
    target.exports('com-b'); assert.deepEqual(JSON.parse(JSON.stringify(overlay)), { kind: 'community', communityId: 'com-b' });
  });
}

async function webChecks() {
  const source = read('web/public/app.js');
  const functions = [
    between(source, 'async function renderCommunityChannels(communityId) {', '\n/*\n * "neues Unterthema erstellen"'),
    between(source, 'function renderKanalThemen(community, kanal) {', '\n/** Dritte Ebene: der Chat zu einem Thema. */'),
    between(source, 'async function renderCommunityChat(community, kanal, thema) {', '\n/*\n * Eine Nachricht im Kanal.'),
  ].join('\n');
  const escSource = between(source, 'const esc = (s) =>', '\n\nfunction user(id)');
  const svg = '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" stroke="currentColor" fill="none" stroke-width="2"/></svg>';
  const script = `
    const main=document.querySelector('#main'); const $=(s)=>document.querySelector(s);
    ${escSource}
    const ICONS=new Proxy({}, {get:()=>${JSON.stringify(svg)}});
    const state={openCommunityId:'com-b',communities:[${JSON.stringify(community)}],places:[]};
    let renderLauf=0; let kanalUhr=null; const community=${JSON.stringify(community)};
    const medienFlaeche=()=>''; const bioLink=(s)=>esc(s); const pttEinhaengen=()=>{};
    const neuesUnterthema=()=>{}; const kanalNachricht=()=>''; const markierungsEingabe=()=>{};
    const openAnhang=()=>{}; const schalterAn=()=>false; const toast=()=>{};
    // Paket 5: main nutzt seit Kasten 7/9/15 geteiltBinden und den Baustein Beitritt (echter Code).
    const geteiltBinden=()=>{}; let kanalAntwort=null;
    // Homeseite-Zurück ruft in main render() (Liste neu zeichnen) statt renderCommunities direkt.
    const render=()=>renderCommunities();
    ${read('gemeinsam/beitritt.js')}
    const openCommunityEinstellungen=()=>{window.k11Settings=(window.k11Settings||0)+1;};
    const renderCommunities=()=>{main.innerHTML='<div id="communityListe">Communityliste</div>';};
    ${functions}
    // Nur Promise-Erfassung: ursprüngliche Rendererlogik und Aufrufargumente bleiben.
    // Auch nicht-awaited Aufrufe aus dem tatsächlichen Polling werden erfasst.
    const originalRenderCommunityChat=renderCommunityChat;
    renderCommunityChat=function(...args){
      const result=originalRenderCommunityChat.apply(this,args);
      window.k11LastRender=Promise.resolve(result);
      return result;
    };
    const intervals=new Map(); let timerId=0;
    window.setInterval=(fn)=>{intervals.set(++timerId,fn);return timerId;};
    window.clearInterval=(id)=>intervals.delete(id);
    window.k11Poll=async()=>{for(const fn of [...intervals.values()])await fn();};
    window.k11Open=()=>renderCommunityChat(community,community.channels[0],community.channels[0].topics[0]);
    window.k11Pending=null;
    window.k11Open();
  `;
  const html='<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><link rel="stylesheet" href="/styles.css"><style>:root{--page-bg:white;--text:#111;--text-2:#555;--text-3:#777;--surface:white;--surface-3:#eee}#main{max-width:440px;margin:auto}</style><main id="main"></main><script src="/fixture.js"></script></html>';
  const resources = new Map([
    ['/', ['text/html; charset=utf-8', html]], ['/fixture.js', ['text/javascript; charset=utf-8', script]],
    ['/styles.css', ['text/css; charset=utf-8', read('web/public/styles.css')]],
    ['/api/communities/com-b', ['application/json', JSON.stringify(community)]],
    [`/api/communities/com-b/channels/${community.channels[0].id}`, ['application/json', '{"messages":[]}']],
  ]);
  const standPath=`/api/communities/com-b/channels/${community.channels[0].id}/stand`;
  const server=http.createServer((req,res)=>{
    const resource=resources.get(req.url); res.writeHead(resource?200:404,{'Content-Type':resource?.[0]||'text/plain','Cache-Control':'no-store'});res.end(resource?.[1]||'Nicht Teil dieser Prüfung');
  });
  let browser; let held; let heldResolve; let holdNext=false;
  const requests=[]; const blockedHttp=[]; const blockedWs=[]; const errors=[];
  try {
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3301,'127.0.0.1',resolve);});
    browser=await chromium.launch();
    const context=await browser.newContext({viewport:{width:400,height:860},serviceWorkers:'block'});
    await context.route('**/*',async(route)=>{
      const url=new URL(route.request().url());
      if(url.origin!==ORIGIN || (!resources.has(url.pathname)&&url.pathname!==standPath) || url.search){blockedHttp.push(url.href);return route.abort('blockedbyclient');}
      requests.push(url.pathname);
      if(url.pathname===standPath){
        if(holdNext){holdNext=false;held=route;await new Promise((resolve)=>{heldResolve=resolve;});return;}
        return route.fulfill({json:{stand:1}});
      }
      return route.continue();
    });
    assert.equal(typeof context.routeWebSocket,'function','Keine ungeschützte WebSocket-Ausweichroute');
    await context.routeWebSocket('**/*',(socket)=>{blockedWs.push(socket.url());socket.close({code:1008,reason:'Offline-Prüfung'});});
    const page=await context.newPage();page.setDefaultTimeout(3000);page.on('pageerror',(error)=>errors.push(error.message));
    await page.goto(ORIGIN,{waitUntil:'load'});await page.locator('#commMsgs').waitFor();
    await check('Netzsperre: externer HTTP-Aufruf abgewiesen',async()=>{await page.evaluate(()=>fetch('https://k11-offline.invalid/probe').catch(()=>null));assert.deepEqual(blockedHttp,['https://k11-offline.invalid/probe']);});
    await check('Netzsperre: externer WebSocket ohne connectToServer geschlossen',async()=>{
      await page.evaluate(()=>new Promise((resolve)=>{const timer=setTimeout(resolve,1500);const socket=new WebSocket('wss://k11-offline.invalid/probe');socket.onclose=socket.onerror=()=>{clearTimeout(timer);resolve();};}));assert.deepEqual(blockedWs,['wss://k11-offline.invalid/probe']);
    });blockedHttp.length=0;blockedWs.length=0;
    await check('Web: Kopf nur # Kanalname, nicht Thema oder Community',async()=>{assert.equal((await page.locator('#kanalKopf').textContent()).trim(),`# ${community.channels[0].name}`);assert.equal(await page.locator('#kanalKopf .kanalkopf__sub').count(),0);});
    await check('Web: Sonderzeichen sicher in Text und aria-label',async()=>{assert.equal(await page.locator('#kanalKopf img').count(),0);assert.equal(await page.evaluate(()=>window.k11Xss),undefined);assert.equal(await page.locator('#kanalKopf').getAttribute('aria-label'),`# ${community.channels[0].name}, zur Community ${community.name}`);});
    if(process.env.BILDER){fs.mkdirSync(process.env.BILDER,{recursive:true});await page.screenshot({path:path.join(process.env.BILDER,'k28-11-kopf-offline.png'),fullPage:true});}
    await check('Web: Kopfklick öffnet richtige Community-Homeseite ohne Einstellungen',async()=>{await page.locator('#kanalKopf').click();await page.locator('#communityKopf').waitFor();assert.equal((await page.locator('#communityKopf .kanal__name').textContent()).trim(),community.name);assert.equal(await page.evaluate(()=>window.k11Settings||0),0);});
    await check('Web: Zurück auf Community-Homeseite führt zur bestehenden Liste',async()=>{await page.locator('#backBtn').click();await page.locator('#communityListe').waitFor();});
    await check('Web: Chat-Zurück führt getrennt zur Themenliste',async()=>{await page.evaluate(()=>window.k11Open());await page.locator('#backBtn').click();assert.equal((await page.locator('.listhead').textContent()).trim(),'Themen');assert.equal(await page.locator('#commMsgs').count(),0);});
    await check('Web: Themenliste-Zurück führt zur Community-Homeseite',async()=>{await page.locator('#backBtn').click();await page.locator('#communityKopf').waitFor();});
    // Normale, nicht verzögerte Pollantwort setzt zuerst den echten Closure-Stand.
    async function delayedPollAfterNavigation(target){
      await page.evaluate(()=>window.k11Open());await page.locator('#commMsgs').waitFor();
      await page.evaluate(()=>window.k11Poll());
      holdNext=true;held=null;
      await page.evaluate(()=>{window.k11Pending=window.k11Poll();});
      const until=Date.now()+3000;
      while(!held && Date.now()<until)await new Promise((resolve)=>setTimeout(resolve,10));
      assert.ok(held,'verzögerte Stand-Abfrage fehlt');
      await page.locator(target==='kopf'?'#kanalKopf':'#backBtn').click();
      if(target==='kopf')await page.locator('#communityKopf').waitFor();
      else assert.equal((await page.locator('.listhead').textContent()).trim(),'Themen');
      const before=requests.filter((p)=>p===`/api/communities/com-b/channels/${community.channels[0].id}`).length;
      await held.fulfill({json:{stand:2}});held=null;heldResolve();heldResolve=null;
      await page.evaluate(async()=>{
        await window.k11Pending;
        // Der originale Polling-Callback awaited seinen Renderer nicht selbst.
        // Deshalb dessen zuletzt gestartete Promise ausdrücklich abwarten.
        await window.k11LastRender;
      });
      await page.waitForLoadState('networkidle');
      const after=requests.filter((p)=>p===`/api/communities/com-b/channels/${community.channels[0].id}`).length;
      assert.equal(after,before,'überholte Pollantwort lädt Chat erneut');
      assert.equal(await page.locator('#commMsgs').count(),0,'überholte Pollantwort zeichnet Chat erneut');
    }
    await check('Web: verzögerte Pollantwort holt Chat nach Kopfklick nicht zurück',()=>delayedPollAfterNavigation('kopf'));
    await check('Web: verzögerte Pollantwort holt Chat nach Chat-Zurück nicht zurück',()=>delayedPollAfterNavigation('zurueck'));
    await check('Web: keine unerwarteten HTTP-/WS-Versuche',()=>{assert.deepEqual(blockedHttp,[]);assert.deepEqual(blockedWs,[]);});
    await check('Web: keine JavaScript-Fehler',()=>assert.deepEqual(errors,[]));
  } finally {
    if(held){await held.abort().catch(()=>{});if(heldResolve)heldResolve();}
    if(browser)await browser.close();
    await new Promise((resolve)=>server.close(resolve));
  }
}
(async()=>{await appChecks();await webChecks();console.log(`\n${passed}/${passed+failed} Prüfungen bestanden; isolierter Kopf/Renderer, native und echte Daten offen.`);process.exitCode=failed?1:0;})().catch((error)=>{console.error(error.stack);process.exitCode=1;});
