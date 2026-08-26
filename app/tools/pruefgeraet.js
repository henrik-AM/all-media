// Ein zweiter Simulator, der nur den Pruefwerkzeugen gehoert.
//
// Warum: bisher haben alle Werkzeuge mit "booted" gearbeitet - also mit dem
// Geraet, das gerade laeuft. Das ist genau das Geraet, auf dem Henrik testet.
// Ein Durchlauf von "npm run mac:bilder" hat ihm deshalb die App unter den
// Fingern weggeschaltet: 14 Neustarts, jedes Mal ein anderer Bildschirm.
//
// Ab jetzt gibt es ein eigenes Geraet "All-Media Test". Es wird gestartet,
// sein Fenster sofort ins Dock gelegt und alles laeuft nur noch mit seiner
// Kennung statt mit "booted". Screenshots holt simctl aus dem Bildspeicher des
// Geraets - das funktioniert auch bei zugeklapptem Fenster, geprueft.
//
// Henriks Geraet (npm run mac) bleibt unberuehrt.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const NAME = 'All-Media Test';
const EXPO_GO_ID = 'host.exp.Exponent';
const ROOT = path.join(__dirname, '..');

function sh(befehl) { return execSync(befehl, { encoding: 'utf8' }); }
function still(befehl) { try { return sh(befehl); } catch { return ''; } }
function schlaf(ms) { execSync(`sleep ${ms / 1000}`); }
function log(zeile) { process.stdout.write(zeile + '\n'); }

/** Alle Geraete als flache Liste, unabhaengig von der iOS-Fassung. */
function geraeteListe() {
  const roh = JSON.parse(still('xcrun simctl list devices available --json') || '{"devices":{}}');
  return Object.entries(roh.devices).flatMap(([laufzeit, geraete]) =>
    geraete.map((g) => ({ ...g, laufzeit }))
  );
}

function kennungSuchen() {
  return geraeteListe().find((g) => g.name === NAME) ?? null;
}

function anlegen() {
  const liste = geraeteListe();
  // Dieselbe Bauform wie Henriks Geraet, damit die Bilder vergleichbar sind.
  const vorlage = liste.find((g) => g.name === 'iPhone 17 Pro') ?? liste[0];
  if (!vorlage) throw new Error('Kein Simulator vorhanden, aus dem sich die Bauform ableiten laesst.');
  log(`  Pruefgeraet "${NAME}" wird angelegt ...`);
  sh(`xcrun simctl create "${NAME}" "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro" "${vorlage.laufzeit}"`);
  return kennungSuchen();
}

/**
 * Fenster ins Dock legen. Nur ein Versuch - klappt es nicht (fehlende
 * Bedienungshilfen-Freigabe), laeuft alles trotzdem, das Fenster steht dann
 * eben offen. Deshalb kein Abbruch.
 */
function fensterZuklappen() {
  still(
    `osascript -e 'tell application "System Events" to tell process "Simulator" ` +
    `to set value of attribute "AXMinimized" of (first window whose name starts with "${NAME}") to true'`
  );
}

/**
 * Den Dialog "In Expo Go oeffnen?" wegklicken.
 *
 * iOS fragt beim allerersten openurl auf einem Geraet nach - danach nie
 * wieder. Ein Tippen laesst sich von aussen nicht ausloesen, aber der Dialog
 * nimmt die Eingabetaste als Bestaetigung ("Oeffnen" ist die Vorgabe). Also:
 * Fenster nach vorn, Eingabetaste, Fenster wieder ins Dock.
 *
 * Das holt einmalig den Fokus. Es passiert nur beim Einrichten eines frischen
 * Pruefgeraets, nicht bei jedem Durchlauf.
 */
function dialogBestaetigen() {
  const skript = [
    'tell application "System Events" to tell process "Simulator"',
    '  set frontmost to true',
    `  set w to first window whose name starts with "${NAME}"`,
    '  set value of attribute "AXMinimized" of w to false',
    '  perform action "AXRaise" of w',
    'end tell',
    'delay 1',
    'tell application "System Events" to key code 36',   // Eingabetaste
  ];
  try {
    execFileSync('osascript', skript.flatMap((zeile) => ['-e', zeile]), { stdio: 'ignore' });
  } catch {
    log('  Hinweis: Der Dialog "In Expo Go oeffnen?" liess sich nicht bestaetigen.');
    log('  Einmal von Hand im Fenster "' + NAME + '" auf "Oeffnen" tippen.');
  }
  schlaf(1500);
  fensterZuklappen();
}

function sdkVersion() {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  return pkg.dependencies.expo.replace(/[^0-9.]/g, '').split('.')[0] + '.0.0';
}

/**
 * Expo Go besorgen. Erst beim Nachbarn abschauen - irgendein Geraet hat es
 * meist schon, und ein Kopieren dauert Sekunden statt eines 140-MB-Downloads.
 */
function expoGoSichern(kennung) {
  if (still(`xcrun simctl listapps ${kennung}`).includes(EXPO_GO_ID)) return;

  for (const geraet of geraeteListe()) {
    if (geraet.udid === kennung) continue;
    const bundle = still(`xcrun simctl get_app_container ${geraet.udid} ${EXPO_GO_ID} app`).trim();
    if (bundle && fs.existsSync(bundle)) {
      log('  Expo Go wird vom anderen Simulator uebernommen ...');
      execFileSync('xcrun', ['simctl', 'install', kennung, bundle]);
      return;
    }
  }

  const sdk = sdkVersion();
  log(`  Expo Go fehlt - wird fuer SDK ${sdk} geladen (ca. 140 MB) ...`);
  const url = JSON.parse(sh('curl -s https://api.expo.dev/v2/versions/latest')).data.sdkVersions[sdk]?.iosClientUrl;
  if (!url) throw new Error(`Keine Expo-Go-Version fuer SDK ${sdk} gefunden.`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-go-'));
  const archiv = path.join(tmp, 'expo-go.tar.gz');
  const bundle = path.join(tmp, 'Expo Go.app');
  execFileSync('curl', ['-sL', '-o', archiv, url]);
  fs.mkdirSync(bundle);
  execFileSync('tar', ['-xzf', archiv, '-C', bundle]);
  execFileSync('xcrun', ['simctl', 'install', kennung, bundle]);
  fs.rmSync(tmp, { recursive: true, force: true });
}

/**
 * Startet das Pruefgeraet und gibt seine Kennung zurueck.
 * Henriks Geraet wird dabei weder gestartet noch gestoppt noch angefasst.
 */
function pruefgeraet() {
  let geraet = kennungSuchen() ?? anlegen();
  if (geraet.state !== 'Booted') {
    log(`  Pruefgeraet "${NAME}" wird gestartet ...`);
    still(`xcrun simctl boot ${geraet.udid}`);
    schlaf(8000);
  }
  // Simulator.app oeffnet fuer jedes gestartete Geraet ein Fenster. Es klaut
  // zwar nicht den Fokus, liegt aber ueber Henriks Fenster - also weg damit.
  fensterZuklappen();
  expoGoSichern(geraet.udid);
  return geraet.udid;
}

module.exports = { pruefgeraet, fensterZuklappen, dialogBestaetigen, NAME, EXPO_GO_ID };
