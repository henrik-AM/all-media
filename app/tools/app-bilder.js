// Macht von jedem Bildschirm der APP ein Bild - im iPhone-Simulator.
//
//   npm run mac:bilder          hell
//   npm run mac:bilder dunkel   dunkel
//
// Warum es das gibt: die rund 108 Pruefungen des Projekts laufen alle gegen
// die WEBSITE. Fuer die App gab es nur "tsc --noEmit" und den Metro-Bau -
// beide sagen nichts darueber, wie ein Bildschirm aussieht. Genau deshalb ist
// am 26.08.2026 ein falscher Avatar in der Story-Leiste durchgerutscht: alle
// Pruefungen gruen, TypeScript sauber, und trotzdem stand in der App "A" statt
// "AS".
//
// Wie es funktioniert: ein Tippen laesst sich im Simulator von aussen nicht
// ausloesen (dafuer braeuchte es die Bedienungshilfen-Freigabe fuer
// osascript). Stattdessen wird der Zielbildschirm direkt in den Speicher der
// App geschrieben - AsyncStorage liegt als schlichte JSON-Datei im
// Simulator-Container. App.tsx liest den Schluessel beim Start, aber nur
// unter __DEV__.
//
// Damit die App nicht auf dem Anmeldebildschirm haengen bleibt, legt das
// Skript ausserdem eine angemeldete Sitzung an.

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const DUNKEL = process.argv.includes('dunkel');
const ZIEL = path.join(__dirname, '..', '..', 'bilder', DUNKEL ? 'app-dunkel' : 'app-hell');
const EXPO_GO_ID = 'host.exp.Exponent';
const EXPO_URL = 'exp://127.0.0.1:8081';

// Bereich/Unterpunkt, Name des Bildes. Dieselbe Liste wie test/_ansehen.js
// fuer die Website, damit sich beide Seiten nebeneinander vergleichen lassen.
const SEITEN = [
  ['messenger/chats', 'messenger-chats'],
  ['messenger/friendmap', 'messenger-karte'],
  ['messenger/camera', 'messenger-kamera'],
  ['messenger/profile', 'messenger-profil'],
  ['videos/home', 'videos-start'],
  ['videos/portrait', 'videos-hochformat'],
  ['videos/landscape', 'videos-querformat'],
  ['videos/search', 'videos-suche'],
  ['videos/profile', 'videos-profil'],
  ['communities/home', 'community-start'],
  ['communities/chats', 'community-chats'],
  ['communities/search', 'community-suche'],
  ['communities/profile', 'community-profil'],
  ['settings', 'einstellungen'],
];

const SITZUNG = {
  konten: [
    {
      id: 'me',
      email: 'henrik@example.com',
      profile: {
        id: 'me',
        name: 'Henrik',
        handle: '@henrik',
        status: 'online',
        about: 'Hey, ich nutze All Media!',
        phone: '+49 170 1234567',
      },
    },
  ],
  aktivId: 'me',
};

function log(zeile) { process.stdout.write(zeile + '\n'); }
function sh(befehl) { return execSync(befehl, { encoding: 'utf8' }); }
function still(befehl) { try { return sh(befehl); } catch { return ''; } }
function schlaf(ms) { execSync(`sleep ${ms / 1000}`); }

/** Die manifest.json von AsyncStorage im Container von Expo Go. */
function speicherDatei() {
  const container = sh(`xcrun simctl get_app_container booted ${EXPO_GO_ID} data`).trim();
  const basis = path.join(container, 'Documents', 'ExponentExperienceData');
  // Der Ordnername enthaelt eine Kennung, die sich pro Projekt unterscheidet -
  // deshalb suchen statt raten.
  const treffer = [];
  const suche = (ordner) => {
    for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
      const voll = path.join(ordner, eintrag.name);
      if (eintrag.isDirectory()) suche(voll);
      else if (eintrag.name === 'manifest.json' && voll.includes('RCTAsyncLocalStorage')) treffer.push(voll);
    }
  };
  if (!fs.existsSync(basis)) return null;
  suche(basis);
  return treffer[0] ?? null;
}

function speicherSchreiben(datei, bereich) {
  let daten = {};
  try { daten = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch { /* neu anlegen */ }
  daten['all-media.sitzung.v1'] = JSON.stringify(SITZUNG);
  daten['all-media.pruefbild'] = bereich;
  // Thema ausdruecklich setzen statt auf die Simulator-Einstellung zu bauen:
  // die wirkt nur, wenn app.json userInterfaceStyle "automatic" sagt, und
  // genau das war lange nicht so.
  daten['all-media.thema.v1'] = DUNKEL ? 'dark' : 'light';
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, JSON.stringify(daten));
}

function appNeuStarten() {
  still(`xcrun simctl terminate booted ${EXPO_GO_ID}`);
  schlaf(500);
  execFileSync('xcrun', ['simctl', 'openurl', 'booted', EXPO_URL]);
}

function metroLaeuft() {
  return still('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/status').trim() === '200';
}

(async () => {
  if (!metroLaeuft()) {
    log('  Metro laeuft nicht. Erst "npm run wlan" (oder "npm run up") starten.');
    process.exit(1);
  }
  if (!still('xcrun simctl list devices booted').includes('(Booted)')) {
    log('  Kein Simulator gestartet. Erst "npm run mac" ausfuehren.');
    process.exit(1);
  }

  still(`xcrun simctl ui booted appearance ${DUNKEL ? 'dark' : 'light'}`);
  fs.mkdirSync(ZIEL, { recursive: true });

  // Beim ersten Durchlauf muss Expo Go die App schon einmal geoeffnet haben,
  // sonst gibt es den Speicherordner noch gar nicht.
  let datei = speicherDatei();
  if (!datei) {
    log('  Speicher noch nicht angelegt - App wird einmal geoeffnet ...');
    appNeuStarten();
    schlaf(20000);
    datei = speicherDatei();
  }
  if (!datei) {
    log('  Speicherdatei nicht gefunden. Laeuft die App im Simulator?');
    process.exit(1);
  }

  for (const [bereich, name] of SEITEN) {
    speicherSchreiben(datei, bereich);
    appNeuStarten();
    // Expo Go braucht einen Moment zum Laden des Bundles. 14 Sekunden sind
    // grosszuegig, aber ein zu kurzer Wert liefert ein Bild vom Ladebalken -
    // und das faellt beim Durchsehen nicht sofort auf.
    schlaf(14000);
    execFileSync('xcrun', ['simctl', 'io', 'booted', 'screenshot', path.join(ZIEL, `${name}.png`)]);
    log(`  ${name}.png`);
  }

  // Schalter wieder entfernen, damit die App danach normal startet.
  const daten = JSON.parse(fs.readFileSync(datei, 'utf8'));
  delete daten['all-media.pruefbild'];
  fs.writeFileSync(datei, JSON.stringify(daten));
  appNeuStarten();

  log(`\n  ${SEITEN.length} Bilder in bilder/${DUNKEL ? 'app-dunkel' : 'app-hell'}/`);
})();
