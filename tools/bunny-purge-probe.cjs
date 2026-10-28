/** Gezielte Live-Abnahme; Geheimnisse ausschließlich im Prozessspeicher. */
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert/strict');
const { spawn } = require('child_process');
const { once } = require('events');
const Bunny = require('../web/server/bunny');
require('../app/test/_ki_belegung').pruefeBelegung();
const { TESTKONTO_PASS } = require('../app/test/_testpasswoerter');
const { supabaseUrl, supabaseKey, clientFuer } = require('../web/server/supabase');
const aus = path.resolve('pruefbelege/bunny-purge');
fs.mkdirSync(aus, { recursive: true });
const notizen = [];
let zahl = 0, server, token, client, apiPfad, probePfad;
const adapter = Bunny.erstelleBunny(Bunny.konfigurationAus());
const bild = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAgAAABAf/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=', 'base64');
const warte = ms => new Promise(r => setTimeout(r, ms));
function check(name, wert) { assert.ok(wert, name); zahl++; notizen.push('PASS ' + name); console.log('PASS ' + name); }
async function get(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const bytes = Buffer.from(await r.arrayBuffer());
  return { status: r.status, cache: r.headers.get('cdn-cache'), bytes };
}
async function fuellen(url, name) {
  for (let i = 0; i < 2; i++) {
    const r = await get(url);
    check(`${name} GET ${i + 1}: 200, Bytes identisch (Cache ${r.cache})`, r.status === 200 && r.bytes.equals(bild));
  }
}
async function verschwunden(urls, start, name) {
  let status;
  do {
    status = await Promise.all(urls.map(async u => (await get(u)).status));
    if (status.every(s => s !== 200)) break;
    await warte(500);
  } while (Date.now() - start < 30000);
  check(`${name}: gleiche Signaturen nach DELETE ${status.join('/')} in ${Date.now() - start} ms`, status.every(s => s !== 200) && Date.now() - start <= 30000);
}
async function api(route, body, typ = 'application/json') {
  const r = await fetch('http://127.0.0.1:3300' + route, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': typ }, body: typ === 'application/json' ? JSON.stringify(body) : body, signal: AbortSignal.timeout(30000) });
  check(route + ': HTTP 200', r.status === 200);
  return r.json();
}
(async () => {
  check('Alle sechs BUNNY-Variablen gesetzt', ['API_KEY','STORAGE_KEY','STORAGE_ZONE','STORAGE_HOST','PULL_HOST','TOKEN_KEY'].every(k => !!process.env['BUNNY_' + k]));
  const vorher = await adapter.auflisten('_probe');
  check('_probe vorher leer', vorher.ok && vorher.dateien.length === 0);
  probePfad = '_probe/purge-' + Date.now() + '.jpg';
  try {
    check('_probe Upload', (await adapter.hochladen(probePfad, bild, 'image/jpeg', { pruefen: false })).ok);
    const urls = [adapter.signierteAdresse(probePfad, 600), adapter.signierteAdresse(probePfad, 2000)];
    check('Zwei unterschiedliche Signaturvarianten', urls[0] !== urls[1]);
    for (let i = 0; i < urls.length; i++) await fuellen(urls[i], '_probe Variante ' + i);
    const start = Date.now();
    check('_probe loeschen', (await adapter.loeschen(probePfad)).ok);
    await verschwunden(urls, start, '_probe CDN');
    probePfad = null;
  } finally {
    if (probePfad) check('_probe Bereinigung', (await adapter.loeschen(probePfad)).ok);
    const nachher = await adapter.auflisten('_probe');
    check('_probe nachher leer', nachher.ok && nachher.dateien.length === 0);
  }
  let verwaltung = process.env.SUPABASE_TOKEN;
  if (!verwaltung) {
    const datei = path.join(os.homedir(), 'Library/CloudStorage/OneDrive-Persönlich/Business/AI/Henrik/2.Gehirn.md/04 Ressourcen/Zugangsdaten/Supabase.md');
    verwaltung = fs.readFileSync(datei, 'utf8').match(/sbp_[A-Za-z0-9]{40,}/)?.[0];
  }
  assert.ok(verwaltung, 'Verwaltungstoken fehlt');
  const keys = await fetch('https://api.supabase.com/v1/projects/ijztosbjfybdgotpdixw/api-keys?reveal=true', { headers: { Authorization: `Bearer ${verwaltung}` }, signal: AbortSignal.timeout(30000) });
  check('Management-API Dienstschlüsselabruf', keys.ok);
  const dienst = (await keys.json()).find(k => k.name === 'service_role')?.api_key;
  assert.ok(dienst, 'Dienstschlüssel fehlt');
  // Bestehenden Dienst nicht versehentlich prüfen oder beenden.
  const net = require('net');
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', () => reject(Error('Port 3300 bereits belegt')));
    probe.listen(3300, '0.0.0.0', () => probe.close(resolve));
  });
  server = spawn(process.execPath, ['web/server/lokal.js'], { env: { ...process.env, PORT: '3300', SUPABASE_SERVICE_ROLE_KEY: dienst }, stdio: ['ignore', 'ignore', 'ignore'] });
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:3300/', { signal: AbortSignal.timeout(1000) })).ok) break; } catch {}
    if (i === 59) throw Error('Serverstart fehlgeschlagen');
    await warte(250);
  }
  check('Eigener Server 3300 bereit', server.exitCode === null);
  const auth = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: supabaseKey, Authorization: `Bearer ${dienst}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'test@all-media.app', password: TESTKONTO_PASS }), signal: AbortSignal.timeout(15000) });
  check('Testkonto-Anmeldung', auth.ok);
  const login = await auth.json(); token = login.access_token;
  check('Sitzung hat Rolle authenticated', JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).role === 'authenticated');
  client = clientFuer(token);
  const hoch = await api('/api/hochladen/datei?ordner=posts', bild, 'image/jpeg');
  apiPfad = hoch.pfad || Bunny.pfadAus(hoch.url || '');
  check('Upload registriert, signierte Bunny-Adresse', hoch.ok && !!apiPfad && new URL(hoch.anzeige).hostname === new URL(Bunny.konfigurationAus().auslieferung).hostname);
  await fuellen(hoch.anzeige, 'API-Upload');
  const start = Date.now();
  const weg = await api('/api/medien/loeschen', { pfad: apiPfad });
  check('Medienlöschroute erfolgreich', weg.ok);
  await verschwunden([hoch.anzeige], start, 'API CDN');
  const recht = await client.rpc('medium_loeschrecht', { p_pfad: apiPfad });
  check('Registerbeleg entfernt', !recht.error && recht.data === null);
  const liste = await adapter.auflisten('posts');
  check('Eigene API-Datei aus Storage entfernt', liste.ok && !liste.dateien.some(d => 'posts/' + d.name === apiPfad));
  apiPfad = null;
})().catch(() => { notizen.push('FEHL Live-Probe abgebrochen; keine fremden Fehlermeldungen ausgegeben'); console.error(notizen.at(-1)); process.exitCode = 1; }).finally(async () => {
  if (apiPfad && token) {
    try { check('API-Rest bereinigt', (await api('/api/medien/loeschen', { pfad: apiPfad })).ok); } catch { process.exitCode = 1; notizen.push('FEHL API-Bereinigung'); }
  }
  if (server && server.exitCode === null) { const fertig = once(server, 'exit'); server.kill('SIGTERM'); await fertig; }
  notizen.push(`${zahl} bestandene Prüfungen; Exit ${process.exitCode || 0}`);
  fs.writeFileSync(path.join(aus, 'live.txt'), notizen.join('\n') + '\n');
  console.log(notizen.at(-1));
});
