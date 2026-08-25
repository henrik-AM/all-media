// Startet die App OHNE ngrok - ueber das eigene WLAN.
//
// Start:  npm run wlan
//
// Warum es diesen zweiten Weg gibt: "npm run up" spannt einen ngrok-Tunnel auf,
// damit Handy und Rechner nicht im selben Netz sein muessen. Der Tunnel ist
// aber die haeufigste Fehlerquelle - das gemeinsam genutzte Konto ist oft am
// Limit, und eine uebrig gebliebene Sitzung blockiert die feste Adresse.
//
// Hier laeuft alles direkt ueber die Netzwerkadresse des Rechners
// (192.168.x.x). Voraussetzung: Handy und Rechner haengen im selben WLAN.
// Dafuer gibt es keinen Tunnel, kein Konto und kein Limit.
//
// Die Website braucht diesen Weg gar nicht mehr - sie laeuft dauerhaft unter
// https://all-media-website.onrender.com. Dieses Skript ist nur noch fuer
// Expo Go da, weil das den Metro-Bundler von diesem Rechner braucht.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, execSync } = require('child_process');
const qr = require('qrcode-terminal');

const ROOT = path.join(__dirname, '..');
const FEST = require('./adressen.json');
const LOGDATEI = path.join(os.homedir(), 'Library', 'Logs', 'all-media.log');

function log(zeile) {
  const text = String(zeile) + '\n';
  try { fs.appendFileSync(LOGDATEI, text); } catch { /* egal */ }
  process.stdout.write(text);
}

/**
 * Die Adresse dieses Rechners im WLAN.
 *
 * Nicht jede Schnittstelle taugt: "lo0" ist der Rechner selbst, und macOS
 * legt fuer Docker und VPNs weitere an, die das Handy nicht erreicht. Ein
 * privater Adressbereich (192.168.x, 10.x, 172.16-31.x) ist das Kennzeichen
 * des Heimnetzes.
 */
function netzwerkAdresse() {
  const kandidaten = [];
  for (const [name, adressen] of Object.entries(os.networkInterfaces())) {
    for (const a of adressen || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      const privat =
        a.address.startsWith('192.168.') ||
        a.address.startsWith('10.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(a.address);
      if (!privat) continue;
      // en0 ist am Mac das WLAN - die kommt zuerst.
      kandidaten.push({ name, adresse: a.address, rang: name === 'en0' ? 0 : 1 });
    }
  }
  kandidaten.sort((a, b) => a.rang - b.rang);
  return kandidaten[0] || null;
}

function aufraeumen() {
  for (const muster of ['ngrok', 'expo start', 'web-app.js']) {
    try { execSync(`pkill -f "${muster}"`, { stdio: 'ignore' }); } catch { /* lief nicht */ }
  }
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
    const res = await fetch(url, { headers: kopfzeilen, signal: AbortSignal.timeout(8000) });
    return res.status;
  } catch {
    return null;
  }
}

async function ausgeben(netz) {
  const webAdresse = `http://${netz.adresse}:${FEST.webPort}`;
  const expoAdresse = `exp://${netz.adresse}:${FEST.expoPort}`;

  let manifest = null;
  for (let versuch = 0; versuch < 20; versuch++) {
    await new Promise((r) => setTimeout(r, 3000));
    manifest = await erreichbar(`http://${netz.adresse}:${FEST.expoPort}`, {
      'expo-platform': 'ios',
      accept: 'application/expo+json,application/json',
    });
    if (manifest === 200) break;
  }

  log('');
  log('  ── Ohne Tunnel, ueber das WLAN ─────────────────────');
  log(`  Schnittstelle : ${netz.name} (${netz.adresse})`);
  log('');
  log(`  Expo Go  : ${expoAdresse}${manifest === 200 ? '' : '   (NICHT erreichbar)'}`);
  log(`  Website  : ${webAdresse}   (lokal - dauerhaft: https://all-media-website.onrender.com)`);
  log('');
  log('  Handy und Rechner muessen im selben WLAN sein.');
  log('');
  qr.generate(expoAdresse, { small: true }, (code) => log(code));
}

log('');
const netz = netzwerkAdresse();
if (!netz) {
  log('  Keine WLAN-Adresse gefunden - ist der Rechner mit einem Netz verbunden?');
  log('  Solange das nicht geht, hilft "npm run up" (mit Tunnel).');
  log('');
  process.exit(1);
}

log('  Alte Prozesse werden aufgeraeumt ...');
aufraeumen();

starte('web', process.execPath, ['web-app.js']);
starte('expo', 'npx', ['expo', 'start', '--port', String(FEST.expoPort), '--lan'], {
  // Metro muss wissen, unter welcher Adresse es fuer das Handy erreichbar ist.
  // Ohne das haengt es "localhost" an die Paketadressen - und localhost ist
  // auf dem Handy das Handy selbst.
  REACT_NATIVE_PACKAGER_HOSTNAME: netz.adresse,
});

ausgeben(netz);

process.on('SIGINT', () => {
  beenden = true;
  for (const kind of kinder) { try { kind.kill('SIGTERM'); } catch { /* schon weg */ } }
  log('\n  Beendet.\n');
  process.exit(0);
});
