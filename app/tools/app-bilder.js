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
//
// Wichtig: das Ganze laeuft auf einem EIGENEN Simulator ("All-Media Test",
// siehe tools/pruefgeraet.js) und nicht mehr auf dem Geraet, das gerade
// gestartet ist. Vorher hat jeder Durchlauf Henriks Simulator 14-mal neu
// gestartet und jedes Mal auf einen anderen Bildschirm gesprungen - Testen war
// waehrenddessen unmoeglich.

const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const { pruefgeraet, fensterZuklappen, dialogBestaetigen, EXPO_GO_ID } = require('./pruefgeraet');

const DUNKEL = process.argv.includes('dunkel');
/*
 * Ein Durchlauf ueber alle Bildschirme dauert rund fuenf Minuten - jeder
 * braucht einen App-Neustart. Wer nur einen Bildschirm geaendert hat, gibt
 * seinen Namen mit:
 *
 *   npm run mac:bilder karte        nur Bilder, deren Name "karte" enthaelt
 */
const NUR = process.argv.slice(2).filter((a) => a !== 'dunkel');
const ZIEL = path.join(__dirname, '..', '..', 'bilder', DUNKEL ? 'app-dunkel' : 'app-hell');
const EXPO_URL = 'exp://127.0.0.1:8081';
/** Kennung des Pruefgeraets - wird im Ablauf gesetzt, danach ueberall statt "booted". */
let GERAET = null;

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

  // Detailbildschirme. Die vierzehn Bereiche darueber sind nur die
  // Einstiegsseiten - ein Chat, ein Story-Betrachter oder ein fremdes Profil
  // kam in keinem Bild vor, obwohl ein Nutzer dort die meiste Zeit verbringt.
  // Ein Fehler an einer Sprechblase waere nie aufgefallen.
  ['messenger/chats#chat:c1', 'detail-chat'],
  ['messenger/chats#chat:c4', 'detail-chat-gruppe'],
  ['messenger/chats#story:s1', 'detail-story'],
  ['messenger/chats#kontakt:u1', 'detail-kontaktprofil'],
  ['messenger/chats#kontakte', 'detail-kontakte'],
  ['messenger/chats#anruf:u1:audio', 'detail-anruf'],
  ['messenger/chats#blatt:erstellen', 'detail-erstellen'],
  ['videos/profile#profil:u1', 'detail-fremdprofil'],
  ['videos/landscape#clip:q1', 'detail-clip'],
  // Die Community-Seite nach dem Prototyp-Frame "CH + Kanal". Sie kam in
  // keinem Bild vor - den Bildschirm gab es bis zum 26.08.2026 nicht.
  ['communities/home#community:k1', 'detail-community'],
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
  const container = sh(`xcrun simctl get_app_container ${GERAET} ${EXPO_GO_ID} data`).trim();
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
  still(`xcrun simctl terminate ${GERAET} ${EXPO_GO_ID}`);
  schlaf(500);
  execFileSync('xcrun', ['simctl', 'openurl', GERAET, EXPO_URL]);
}

/**
 * Beim allerersten Aufruf auf einem frischen Geraet fragt iOS "In Expo Go
 * oeffnen?". Der Umweg ueber ein Startargument (simctl launch mit der Adresse)
 * hilft nicht - Expo Go wertet das nicht aus und bleibt auf seiner Startseite.
 * Also einmal bestaetigen; danach merkt sich iOS das Ziel.
 */
function erstesOeffnen() {
  still(`xcrun simctl openurl ${GERAET} "${EXPO_URL}"`);
  schlaf(4000);
  dialogBestaetigen();
  schlaf(20000);
}

function metroLaeuft() {
  return still('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/status').trim() === '200';
}

(async () => {
  if (!metroLaeuft()) {
    log('  Metro laeuft nicht. Erst "npm run wlan" (oder "npm run up") starten.');
    process.exit(1);
  }
  GERAET = pruefgeraet();

  still(`xcrun simctl ui ${GERAET} appearance ${DUNKEL ? 'dark' : 'light'}`);
  fs.mkdirSync(ZIEL, { recursive: true });

  // Beim ersten Durchlauf muss Expo Go die App schon einmal geoeffnet haben,
  // sonst gibt es den Speicherordner noch gar nicht.
  let datei = speicherDatei();
  if (!datei) {
    log('  Speicher noch nicht angelegt - App wird einmal geoeffnet ...');
    erstesOeffnen();
    schlaf(8000);
    datei = speicherDatei();
  }
  if (!datei) {
    log('  Speicherdatei nicht gefunden. Laeuft die App im Simulator?');
    process.exit(1);
  }

  /*
   * Das Bundle einmal vorweg bauen lassen. Beim ersten Durchlauf nach einem
   * Metro-Neustart dauert der Bau laenger als die Wartezeit je Bildschirm -
   * dann kommt ein Bild vom Ladebalken zurueck statt vom Bildschirm.
   */
  log('  Bundle wird vorgewaermt ...');
  try {
    execSync(
      'curl -s -o /dev/null --max-time 240 ' +
      '"http://127.0.0.1:8081/index.bundle?platform=ios&dev=true&minify=false"'
    );
  } catch {
    log('  Hinweis: Metro antwortete nicht - laeuft "npm run wlan"?');
  }

  const gewaehlt = NUR.length
    ? SEITEN.filter(([, name]) => NUR.some((n) => name.includes(n)))
    : SEITEN;
  if (!gewaehlt.length) {
    log(`  Kein Bildschirm passt auf "${NUR.join(' ')}".`);
    process.exit(1);
  }

  for (const [bereich, name] of gewaehlt) {
    speicherSchreiben(datei, bereich);
    appNeuStarten();
    // Expo Go braucht einen Moment zum Laden des Bundles. 14 Sekunden waren zu
    // knapp: am 27.08.2026 kamen zwei Durchlaeufe hintereinander mit einem
    // Bild vom Ladebalken zurueck, und das faellt beim Durchsehen nicht
    // sofort auf. Das Bundle ist durch das Vorwaermen oben zwar gebaut, Expo
    // Go muss es aber je Neustart neu holen und auswerten.
    schlaf(35000);
    execFileSync('xcrun', ['simctl', 'io', GERAET, 'screenshot', path.join(ZIEL, `${name}.png`)], {
      stdio: 'ignore',
    });
    log(`  ${name}.png`);
    // Simulator.app klappt das Fenster beim Starten der App gern wieder auf.
    fensterZuklappen();
  }

  // Schalter wieder entfernen, damit die App danach normal startet.
  const daten = JSON.parse(fs.readFileSync(datei, 'utf8'));
  delete daten['all-media.pruefbild'];
  fs.writeFileSync(datei, JSON.stringify(daten));
  appNeuStarten();

  log(`\n  ${gewaehlt.length} Bilder in bilder/${DUNKEL ? 'app-dunkel' : 'app-hell'}/`);
})();
