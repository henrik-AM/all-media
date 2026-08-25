// Oeffnet die App im iPhone-Simulator auf dem Mac.
//
// Start:  npm run mac      (setzt voraus, dass "npm run up" schon laeuft)
//
// Warum ein eigenes Skript: "expo start --ios" belegt eigene Ports und kollidiert
// mit up.js (feste Ports 3000/8081 fuer die ngrok-Adresse). Dieses Skript nutzt
// den bereits laufenden Metro-Server und schiebt die App nur in den Simulator.
//
// Zwei Eigenheiten von iOS 26, die hier abgefangen werden:
//  1. Expo Go ist in einem frischen Simulator nicht vorhanden und muss als
//     .app-Bundle installiert werden (Download passend zur SDK-Version).
//  2. "simctl openurl" zeigt beim allerersten Mal den Dialog "In Expo Go
//     oeffnen?", den niemand per Skript wegklicken kann. Deshalb wird Expo Go
//     vorher einmal mit der URL als Startargument gestartet - danach kennt iOS
//     das Ziel und der zweite openurl-Aufruf laeuft ohne Rueckfrage durch.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FEST = require('./adressen.json');
const EXPO_GO_ID = 'host.exp.Exponent';
const GERAET = process.env.SIM_GERAET || 'iPhone 17 Pro';
const EXPO_URL = `exp://127.0.0.1:${FEST.expoPort}`;

function log(zeile) { process.stdout.write(zeile + '\n'); }
function sh(befehl) { return execSync(befehl, { encoding: 'utf8' }); }
function still(befehl) { try { return sh(befehl); } catch { return ''; } }
function schlaf(ms) { execSync(`sleep ${ms / 1000}`); }

// --- 1. Laeuft der Server ueberhaupt? --------------------------------------
function serverLaeuft() {
  const code = still(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${FEST.expoPort}/status`);
  return code.trim() === '200';
}

// --- 2. Simulator starten ---------------------------------------------------
function simulatorStarten() {
  const laufend = still('xcrun simctl list devices booted');
  if (laufend.includes('(Booted)')) {
    log('  Simulator laeuft bereits.');
  } else {
    log(`  Simulator "${GERAET}" wird gestartet ...`);
    still(`xcrun simctl boot "${GERAET}"`);
  }
  still('open -a Simulator');
  schlaf(6000);
}

// --- 3. Expo Go sicherstellen ----------------------------------------------
function sdkVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const roh = pkg.dependencies.expo.replace(/[^0-9.]/g, '');   // "~57.0.16" -> "57.0.16"
  return roh.split('.')[0] + '.0.0';                            // -> "57.0.0"
}

function expoGoInstallieren() {
  if (still(`xcrun simctl listapps booted`).includes(EXPO_GO_ID)) {
    log('  Expo Go ist im Simulator vorhanden.');
    return;
  }
  const sdk = sdkVersion();
  log(`  Expo Go fehlt - wird fuer SDK ${sdk} geladen (ca. 140 MB) ...`);

  const antwort = sh('curl -s https://api.expo.dev/v2/versions/latest');
  const url = JSON.parse(antwort).data.sdkVersions[sdk]?.iosClientUrl;
  if (!url) throw new Error(`Keine Expo-Go-Version fuer SDK ${sdk} gefunden.`);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-go-'));
  const archiv = path.join(tmp, 'expo-go.tar.gz');
  const bundle = path.join(tmp, 'Expo Go.app');

  execFileSync('curl', ['-sL', '-o', archiv, url], { stdio: 'inherit' });
  fs.mkdirSync(bundle);
  execFileSync('tar', ['-xzf', archiv, '-C', bundle]);
  execFileSync('xcrun', ['simctl', 'install', 'booted', bundle]);
  fs.rmSync(archiv, { force: true });
  log('  Expo Go installiert.');
}

// --- 4. App oeffnen ---------------------------------------------------------
function appOeffnen() {
  log('  App wird geladen ...');
  still(`xcrun simctl terminate booted ${EXPO_GO_ID}`);
  schlaf(2000);
  // Erster Start macht das Ziel bei iOS bekannt, damit der Bestaetigungsdialog
  // beim zweiten Aufruf ausbleibt.
  still(`xcrun simctl launch booted ${EXPO_GO_ID} "${EXPO_URL}"`);
  schlaf(8000);
  still(`xcrun simctl openurl booted "${EXPO_URL}"`);
  schlaf(12000);
}

// --- Ablauf -----------------------------------------------------------------
log('');
if (!serverLaeuft()) {
  log('  Der Server laeuft nicht.');
  log('  Erst in einem zweiten Terminal starten:  npm run up');
  log('');
  process.exit(1);
}
simulatorStarten();
expoGoInstallieren();
appOeffnen();
log('');
log('  Fertig - die App ist im Simulator offen.');
log(`  Screenshot bei Bedarf:  xcrun simctl io booted screenshot bild.png`);
log('');
