// Startet die App unter EINER festen oeffentlichen Adresse.
//
// Start:  npm run up
//
// Warum nur eine Adresse: Henriks kostenloses ngrok-Konto erlaubt genau einen
// Tunnel. Website und Expo Go teilen sie sich deshalb - web-app.js erkennt
// Anfragen von Expo Go am Kopfeintrag "expo-platform" und reicht sie an Metro
// weiter. Die Adresse gehoert dem Konto fest und bleibt ueber Neustarts gleich.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const qr = require('qrcode-terminal');

const ROOT = path.join(__dirname, '..');
const FEST = require('./adressen.json');
const NGROK = path.join(os.homedir(), 'bin', 'ngrok');
const LOGDATEI = path.join(os.homedir(), 'Library', 'Logs', 'all-media.log');

const EXPO_URL = FEST.oeffentlicheAdresse.replace('https://', 'exp://');

function log(zeile) {
  const text = String(zeile) + '\n';
  try { fs.appendFileSync(LOGDATEI, text); } catch { /* egal */ }
  process.stdout.write(text);
}

function aufraeumen() {
  for (const muster of ['ngrok http', 'expo start', 'web-app.js']) {
    try { execSync(`pkill -f "${muster}"`, { stdio: 'ignore' }); } catch { /* lief nicht */ }
  }
  // Die Ports muessen frei sein - weicht Expo auf 8082 aus, findet die
  // Weiterleitung Metro nicht mehr.
  for (const port of [FEST.webPort, FEST.expoPort]) {
    try {
      const pids = execSync(`lsof -ti tcp:${port}`, { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString().trim().split('\n').filter(Boolean);
      for (const pid of pids) process.kill(Number(pid), 'SIGKILL');
    } catch { /* Port war frei */ }
  }
}

function kindLog() { try { return fs.openSync(LOGDATEI, 'a'); } catch { return 'ignore'; } }

let beenden = false;
const kinder = [];

function starte(name, befehl, argumente, zusatzUmgebung) {
  const kind = spawn(befehl, argumente, {
    cwd: ROOT,
    stdio: ['ignore', kindLog(), kindLog()],
    env: { ...process.env, ...zusatzUmgebung },
  });
  kind.on('error', (e) => log(`  [${name}] START FEHLGESCHLAGEN: ${e.message}`));
  kind.on('exit', (code) => { if (!beenden) log(`  [${name}] beendet (Code ${code})`); });
  kinder.push(kind);
}

async function erreichbar(url, kopfzeilen) {
  try {
    const res = await fetch(url, { headers: kopfzeilen, signal: AbortSignal.timeout(20000) });
    return res.status;
  } catch {
    return null;
  }
}

async function pruefenUndAusgeben() {
  let web = null;
  let manifest = null;
  for (let versuch = 0; versuch < 25; versuch++) {
    await new Promise((r) => setTimeout(r, 4000));
    web = await erreichbar(FEST.oeffentlicheAdresse);
    manifest = await erreichbar(FEST.oeffentlicheAdresse, {
      'expo-platform': 'ios',
      accept: 'application/expo+json,application/json',
    });
    if (web === 200 && manifest === 200) break;
  }

  log('');
  log('  ── Eine Adresse fuer beides ────────────────────────');
  log(`  Website : ${FEST.oeffentlicheAdresse}${web === 200 ? '' : '   (NICHT erreichbar)'}`);
  log(`  Expo Go : ${EXPO_URL}${manifest === 200 ? '' : '   (NICHT erreichbar)'}`);
  log('');
  qr.generate(EXPO_URL, { small: true }, (code) => log(code));
  if (web !== 200 || manifest !== 200) log('  Nochmal versuchen mit:  npm run up');
}

log('');
log('  Alte Prozesse werden aufgeraeumt ...');
aufraeumen();

starte('web', process.execPath, ['web-app.js']);
starte('tunnel', NGROK, ['http', String(FEST.webPort), '--log=stdout']);
starte('expo', 'npx', ['expo', 'start', '--port', String(FEST.expoPort)], {
  // Sagt Metro, unter welcher oeffentlichen Adresse es erreichbar ist. Ohne
  // das haengt Expo ":8081" an die Paketadressen und das Handy scheitert.
  EXPO_PACKAGER_PROXY_URL: FEST.oeffentlicheAdresse,
});

process.on('SIGINT', () => {
  beenden = true;
  for (const kind of kinder) kind.kill('SIGTERM');
  process.exit(0);
});

pruefenUndAusgeben();
