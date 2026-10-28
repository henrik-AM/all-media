/** Abbruchfest: erst Main abwarten, dann beide auffälligen Läufe und Bereinigung. */
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const root = path.resolve(__dirname, '..');
const aus = path.join(root, 'pruefbelege/bunny-live2');
require('../app/test/_ki_belegung').pruefeBelegung();
const warte = ms => new Promise(resolve => setTimeout(resolve, ms));
let server;
const ergebnisse = [];
function start(args, cwd, env, datei) {
  const fd = fs.openSync(path.join(aus, datei), 'w');
  const kind = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', fd, fd] });
  fs.closeSync(fd);
  return kind;
}
function ende(kind, zeit) {
  return new Promise((resolve, reject) => {
    let abgelaufen = false;
    const uhr = zeit && setTimeout(() => { abgelaufen = true; kind.kill('SIGKILL'); }, zeit);
    kind.once('error', e => { clearTimeout(uhr); reject(e); });
    kind.once('exit', (code, signal) => {
      clearTimeout(uhr);
      resolve({ code, signal, abgelaufen });
    });
  });
}
async function serverAus() {
  if (!server) return;
  const kind = server;
  server = null;
  if (kind.exitCode !== null || kind.signalCode !== null) return;
  const fertig = ende(kind, 10000);
  kind.kill('SIGTERM');
  await fertig;
}
async function serverAn(cwd, env, name) {
  server = start(['web/server/lokal.js'], cwd, env, `07-${name}-server.txt`);
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw Error('Nachprüfserver beendet');
    try {
      const r = await fetch('http://127.0.0.1:3300/', { signal: AbortSignal.timeout(1000) });
      if (r.ok) return;
    } catch {}
    await warte(500);
  }
  throw Error('Nachprüfserver nicht bereit');
}
(async () => {
  const hintergrund = JSON.parse(fs.readFileSync(path.join(aus, '05-main-hintergrund-pid.json')));
  for (;;) {
    let lebt = false;
    try { process.kill(hintergrund.pid, 0); lebt = true; } catch (e) { if (e.code !== 'ESRCH') throw e; }
    if (!lebt) break;
    console.log('Main wird abgewartet: ' + new Date().toISOString());
    await warte(300000);
  }
  const status = JSON.parse(fs.readFileSync(path.join(aus, '05-status.json')));
  if (!status.some(z => z.name === 'main' && z.beginn >= hintergrund.start && z.ende)) {
    throw Error('Main ohne vollständigen Abschluss; keine parallele Nachprüfung');
  }
  const auswertung = start(['tools/bunny-live2-auswertung.cjs'], root, process.env, '07-auswertung.txt');
  if ((await ende(auswertung, 30000)).code !== 0) throw Error('Main-Übersicht unvollständig');
  const r = await fetch('https://api.supabase.com/v1/projects/ijztosbjfybdgotpdixw/api-keys?reveal=true', {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_TOKEN}` }, signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw Error('Dienstschlüsselabruf fehlgeschlagen');
  const key = (await r.json()).find(k => k.name === 'service_role')?.api_key;
  if (!key) throw Error('Dienstschlüssel fehlt');
  for (const name of ['main', 'bunny-live']) {
    const cwd = name === 'main' ? path.resolve(root, '../bunny-live2-main') : root;
    const env = { ...process.env, PORT: '3300', SUPABASE_SERVICE_ROLE_KEY: key };
    if (name === 'main') for (const k of Object.keys(env)) if (k.startsWith('BUNNY_')) delete env[k];
    await serverAn(cwd, env, name);
    env.BUNNY_PRUEF_ROOT = path.join(cwd, 'app/test');
    env.NODE_OPTIONS = [process.env.NODE_OPTIONS || '', `--require=${path.join(root, 'app/test/_bunny_port3300.cjs')}`].filter(Boolean).join(' ');
    for (const lauf of ['profil', 'chatsync']) {
      console.log(`${name}/${lauf} Start ${new Date().toISOString()}`);
      const kind = start([`test/_${lauf}.js`], path.join(cwd, 'app'), env, `07-${name}-${lauf}.txt`);
      ergebnisse.push({ name, lauf, ...await ende(kind, 15 * 60 * 1000) });
      fs.writeFileSync(path.join(aus, '07-status.json'), JSON.stringify(ergebnisse, null, 2) + '\n');
    }
    if (name === 'bunny-live') {
      const kind = start(['tools/bunny-live2-aufraeumen.cjs', '--nach-gesamtlauf'], root, env, '06-bereinigung.txt');
      const z = await ende(kind, 10 * 60 * 1000);
      if (z.code !== 0) throw Error('Abschlussbereinigung nicht erfolgreich');
      console.log('Abschlussbereinigung erfolgreich');
    }
    await serverAus();
  }
  console.log('Nachprüfungen abgeschlossen: ' + JSON.stringify(ergebnisse));
})().catch(e => { console.error('Abschlussläufe fehlgeschlagen: ' + e.message); process.exitCode = 1; }).finally(serverAus);
