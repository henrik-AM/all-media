// Einen einzelnen Bildschirm der App im Pruefsimulator aufnehmen.
//
//   node tools/bildschirm.js videos/home  bild.png
//
// Setzt den Zielbildschirm in den Speicher der App (App.tsx liest den
// Schluessel "all-media.pruefbild" beim Start, nur unter __DEV__), startet
// Expo Go neu und macht ein Bild.
//
// Die Anmeldung muss vorher stehen: node tools/app-anmelden.js

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { pruefgeraet, EXPO_GO_ID } = require('./pruefgeraet.js');

const ZIEL = process.argv[2] || 'messenger/chats';
const DATEI = process.argv[3] || path.join(__dirname, '..', 'bild.png');
const WARTEN = Number(process.env.AM_WARTEN || 22000);

function sh(b) { return execSync(b, { encoding: 'utf8' }); }
function still(b) { try { return sh(b); } catch { return ''; } }

function speicherDatei(geraet) {
  const container = sh(`xcrun simctl get_app_container ${geraet} ${EXPO_GO_ID} data`).trim();
  const basis = path.join(container, 'Documents', 'ExponentExperienceData');
  if (!fs.existsSync(basis)) return null;
  const treffer = [];
  const suche = (ordner) => {
    for (const e of fs.readdirSync(ordner, { withFileTypes: true })) {
      const voll = path.join(ordner, e.name);
      if (e.isDirectory()) suche(voll);
      else if (e.name === 'manifest.json' && voll.includes('RCTAsyncLocalStorage')) treffer.push(voll);
    }
  };
  suche(basis);
  return treffer[0] ?? null;
}

const geraet = pruefgeraet();
const datei = speicherDatei(geraet);
if (!datei) { console.error('Kein AsyncStorage — erst tools/app-anmelden.js.'); process.exit(1); }

let daten = {};
try { daten = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch { /* neu */ }
daten['all-media.pruefbild'] = ZIEL;
fs.writeFileSync(datei, JSON.stringify(daten));

// Die Adresse des Metro-Bundlers im eigenen WLAN — dieselbe wie npm run wlan.
const ip = still("ipconfig getifaddr en0").trim() || '127.0.0.1';
still(`xcrun simctl terminate ${geraet} ${EXPO_GO_ID}`);
execFileSync('xcrun', ['simctl', 'openurl', geraet, `exp://${ip}:8081`]);
execSync(`sleep ${WARTEN / 1000}`);
execFileSync('xcrun', ['simctl', 'io', geraet, 'screenshot', DATEI], { stdio: 'ignore' });
console.log(`  ${ZIEL} -> ${DATEI}`);
