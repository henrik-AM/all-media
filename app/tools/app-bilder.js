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
  //
  // Angegeben wird der NAME, nicht die Kennung.
  //
  // Bis hierher standen feste Kennungen (c1, c4, s1, u1, q1, k1). Die gab es
  // nach dem Umzug nach Supabase nicht mehr - die Datenbank vergibt sie beim
  // Anlegen. Die Ueberlagerung ging still nicht auf, und dieses Skript legte
  // fuer acht Detailbildschirme in Wahrheit das Bild der Einstiegsseite ab:
  // ein Fehler an einer Sprechblase, im Kontaktprofil oder im Spieler waere
  // in keinem Bild zu sehen gewesen.
  ['messenger/chats#chat:Anna Schmidt', 'detail-chat'],
  ['messenger/chats#chat:Projekt Team', 'detail-chat-gruppe'],
  ['messenger/chats#story:Anna Schmidt', 'detail-story'],
  ['messenger/chats#kontakt:Anna Schmidt', 'detail-kontaktprofil'],
  /*
   * Dieselbe Liste, nur weiter unten begonnen. Am 07.09.2026 kam die Zeile
   * "Verschluesselung" dazu — und lag im Bild oben unter dem Rand. Das Bild
   * war da und zeigte die Aenderung nicht.
   */
  ['messenger/chats#kontakt:Anna Schmidt:520', 'detail-kontaktprofil-unten'],
  ['messenger/chats#kontakte', 'detail-kontakte'],
  ['messenger/chats#anruf:Anna Schmidt:audio', 'detail-anruf'],
  ['messenger/chats#blatt:erstellen', 'detail-erstellen'],
  /*
   * „Kontakt hinzufuegen". Kam in keinem Bild vor — und genau dieses Blatt hat
   * Henrik am 07.09.2026 beanstandet („nur ueber Telefonnummer/QR-Code, nicht
   * Username"). Ein Blatt, das nie fotografiert wird, kann sich unbemerkt
   * anders verhalten als seine Fassung auf der Website.
   */
  ['messenger/chats#blatt:contact', 'detail-kontakt-hinzufuegen'],
  ['videos/profile#profil:Anna Schmidt', 'detail-fremdprofil'],
  ['videos/landscape#clip:Testvideo im Querformat', 'detail-clip'],
  // Die Community-Seite nach dem Prototyp-Frame "CH + Kanal". Sie kam in
  // keinem Bild vor - den Bildschirm gab es bis zum 26.08.2026 nicht.
  ['communities/home#community:Design Systeme', 'detail-community'],
  /*
   * Das Unterthema selbst — ein eigener Chat mit eigener Ablage, der bis zum
   * 04.09.2026 in keinem Bild vorkam. Genau dort fiel jeder Anhang lautlos
   * durch (siehe SUPABASE_SCHEMA_25_kanal_anhang.sql); kein Bild haette es
   * gezeigt.
   */
  ['communities/home#kanal:Design Systeme:Allgemein', 'detail-kanal'],

  // Die Bildschirme der Handbuch-Erweiterung vom 01./02.09.2026. Sie waren
  // geprueft, aber nur auf die Datenbank hin: dass ein Insight ankommt, sagt
  // nichts darueber, wie der Betrachter dafuer aussieht.
  /*
   * Absender ist Anna Schmidt (feste Kennung aus Schema 6, siehe
   * test/_kennungen.js). Hier stand `insights:me` — also Insights, die das
   * Konto sich selbst geschickt hat. Die gibt es nicht und kann es nicht
   * geben, und der Bildschirm zeigte am 06.09.2026 zuverlaessig „Dieser
   * Insight ist nicht mehr da." Den Insight selbst legt
   * SUPABASE_SCHEMA_29_testbestand_insight.sql an.
   */
  ['messenger/chats#insights:11111111-a11e-4d1a-8000-000000000001', 'detail-insights'],
  ['messenger/camera', 'handbuch-kamera-filter'],
  /*
   * Das Sichtbarkeits-Blatt. Es kam in keinem Bild vor, obwohl dort die vier
   * Stufen des Handbuchs stehen — und seit dem 07.09.2026 der Zusatz "Story
   * auch in Videos teilen", der nur bei der Stufe "Alle" bedienbar ist.
   */
  ['settings#sicht:story', 'detail-sichtbarkeit-story'],
  // Die zwei Bildschirme aus Henriks Profil-Feedback vom 07.09.2026: der
  // Zurueck-Pfeil in den Einstellungen und die Kontoliste mit den frueheren
  // Konten. Beide kommen nur ueber einen Fingertipp zustande.
  ['settings#aus:messenger', 'detail-einstellungen-ausProfil'],
  ['messenger/profile#blatt:konto', 'detail-kontowechsel'],
  /*
   * Dieselbe Wahl fuer den Standort — sie haengt an der Friend-Map und an den
   * Einstellungen. Henrik am 07.09.2026: "Bei „Alle bis auf"/„Niemand bis
   * auf" fehlt Suchleiste; Liste zeigt nicht alle Messenger-Kontakte." Ohne
   * Bild war beides nicht nachzusehen.
   */
  ['settings#sicht:standort', 'detail-sichtbarkeit-standort'],
  /*
   * Das Auswahlfenster der Kartenansichten. Henrik am 07.09.2026:
   * "Kartenstil-Button switcht direkt statt Auswahlfenster."
   */
  ['messenger/friendmap#karte:stile', 'detail-kartenansichten'],
];

/*
 * ANGEMELDET WIRD ECHT — seit dem 04.09.2026.
 *
 * Hier stand eine erfundene Sitzung: ein Konto mit der Kennung "me" unter dem
 * Schluessel `all-media.sitzung.v1`. Aus der Zeit vor Supabase, als die App
 * ihre Daten aus dem Quelltext nahm.
 *
 * Seither liest die App `all-media.sitzung.v2` und braucht dazu ein echtes
 * Zugangstoken. Der erfundene Eintrag wurde nur noch ignoriert — und dieses
 * Werkzeug legte, ohne sich zu beschweren, von jedem Bildschirm ein Bild des
 * ANMELDEBILDSCHIRMS ab. "1 Bilder in bilder/app-hell/" stand trotzdem da.
 * Aufgefallen ist es erst, als jemand die Bilder wirklich angesehen hat.
 *
 * Angemeldet wird deshalb ueber `tools/app-anmelden.js` — dieselbe Anmeldung,
 * die auch `tools/bildschirm.js` voraussetzt, mit einem echten Token.
 */
function anmelden() {
  log('  Anmeldung am Testkonto ...');
  execFileSync(process.execPath, [path.join(__dirname, 'app-anmelden.js')], { stdio: 'inherit', timeout: 120000 });
}

/**
 * Steht die Anmeldung wirklich da, wo die App sie sucht?
 *
 * Nicht ueber die Bildgroesse geraten — ein leerer Kanal ist genauso klein
 * wie die Anmeldemaske, und eine Warnung, die falsch anschlaegt, liest nach
 * dem dritten Mal niemand mehr. Geprueft wird stattdessen genau der Fehler,
 * der passiert ist: die Sitzung lag unter einem Schluessel, den die App gar
 * nicht mehr liest.
 *
 * `all-media.sitzung.v2`   die Kontenliste (contexts/AuthContext.tsx)
 * `sb-<projekt>-auth-token` die Sitzung von supabase-js
 */
function anmeldungPruefen(datei) {
  let daten = {};
  try { daten = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch { /* leer */ }

  const konten = daten['all-media.sitzung.v2'];
  const token = Object.keys(daten).find((k) => /^sb-.+-auth-token$/.test(k));

  if (!konten || !token) {
    log('  Die App ist nicht angemeldet — jedes Bild zeigte sonst die Anmeldemaske.');
    log(`  Fehlt: ${!konten ? 'all-media.sitzung.v2 ' : ''}${!token ? 'sb-…-auth-token' : ''}`);
    process.exit(1);
  }
}

/*
 * Jede Meldung mit Uhrzeit — seit dem 06.09.2026.
 *
 * Am 05.09.2026 stand hier zwanzig Minuten lang nichts auf dem Schirm und der
 * Lauf wurde abgebrochen. Ein Durchlauf ueber alle 27 Bildschirme dauert
 * regulaer rund achtzehn Minuten (35 s je Bildschirm) — er war also womoeglich
 * kurz vorm Ziel. Ohne Uhrzeit und ohne Zaehler ist "es tut sich nichts" von
 * "es dauert eben" nicht zu unterscheiden, und man bricht das Falsche ab.
 */
function log(zeile) {
  const uhr = new Date().toTimeString().slice(0, 8);
  process.stdout.write(`  [${uhr}]${zeile}\n`);
}
/*
 * Zeitgrenzen wie in tools/pruefgeraet.js: ein Aufruf, der ohne Grenze
 * wartet, haelt das ganze Werkzeug stumm fest.
 */
const GRENZE = 60000;
function sh(befehl, grenze = GRENZE) {
  try {
    return execSync(befehl, { encoding: 'utf8', timeout: grenze });
  } catch (fehler) {
    if (fehler.signal === 'SIGTERM' || fehler.code === 'ETIMEDOUT') {
      throw new Error(`Nach ${grenze / 1000}s keine Antwort: ${befehl}`);
    }
    throw fehler;
  }
}
function still(befehl, grenze = GRENZE) { try { return sh(befehl, grenze); } catch { return ''; } }
/*
 * Warten ohne Unterprozess. Vorher stand hier execSync('sleep 35') — das
 * bricht ab, sobald die Umgebung ein blockierendes sleep in der Shell nicht
 * zulaesst, und riss den ganzen Bilderlauf mit. Atomics.wait haelt denselben
 * Thread genauso an, nur ohne /bin/sh.
 */
function schlaf(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

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
  // Die Sitzung steht schon drin — sie kommt aus anmelden() und wird hier
  // ausdruecklich nicht ueberschrieben.
  daten['all-media.pruefbild'] = bereich;
  // Thema ausdruecklich setzen statt auf die Simulator-Einstellung zu bauen:
  // die wirkt nur, wenn app.json userInterfaceStyle "automatic" sagt, und
  // genau das war lange nicht so.
  daten['all-media.thema.v1'] = DUNKEL ? 'dark' : 'light';
  fs.mkdirSync(path.dirname(datei), { recursive: true });
  fs.writeFileSync(datei, JSON.stringify(daten));
}

function appNeuStarten() {
  // "found nothing to terminate" ist der Normalfall, wenn die App gar nicht
  // lief - diese Meldung soll die echten nicht zudecken.
  still(`xcrun simctl terminate ${GERAET} ${EXPO_GO_ID} 2>/dev/null`);
  schlaf(500);
  execFileSync('xcrun', ['simctl', 'openurl', GERAET, EXPO_URL], { timeout: 60000 });
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
  return still('curl -s --max-time 10 -o /dev/null -w "%{http_code}" http://127.0.0.1:8081/status', 15000).trim() === '200';
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

  anmelden();
  anmeldungPruefen(datei);

  const gewaehlt = NUR.length
    ? SEITEN.filter(([, name]) => NUR.some((n) => name.includes(n)))
    : SEITEN;
  if (!gewaehlt.length) {
    log(`  Kein Bildschirm passt auf "${NUR.join(' ')}".`);
    process.exit(1);
  }

  log(`  ${gewaehlt.length} Bildschirme, je rund 35 s — das dauert etwa ${Math.ceil(gewaehlt.length * 38 / 60)} Minuten.`);
  let fertig = 0;
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
      timeout: 60000,
    });
    const groesse = fs.statSync(path.join(ZIEL, `${name}.png`)).size;
    log(`  ${String(++fertig).padStart(2)}/${gewaehlt.length}  ${name}.png  (${Math.round(groesse / 1024)} kB)`);
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
