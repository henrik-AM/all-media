// Zeigt die beiden Adressen, unter denen All Media gerade erreichbar ist,
// und ob dort wirklich etwas antwortet.
//
// Start:  npm run links
//
// Bis zum 01.09.2026 stand hier die feste ngrok-Adresse aus adressen.json.
// Die wird seit dem Umzug nicht mehr benutzt: die Website laeuft dauerhaft
// auf Render, Expo Go geht ueber das WLAN (npm run wlan). Das Skript meldete
// deshalb zweimal "NICHT erreichbar" und riet zu `npm run up` — ein Tunnel,
// den es gar nicht mehr braucht.

const os = require('os');
const qr = require('qrcode-terminal');
const FEST = require('./adressen.json');

const WEBSITE = 'https://all-media-website.onrender.com';

/** Die Adresse dieses Rechners im WLAN — wie in tools/lokal.js. */
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
      kandidaten.push({ adresse: a.address, rang: name === 'en0' ? 0 : 1 });
    }
  }
  kandidaten.sort((a, b) => a.rang - b.rang);
  return kandidaten[0] || null;
}

async function status(url, kopfzeilen) {
  try {
    const res = await fetch(url, { headers: kopfzeilen, signal: AbortSignal.timeout(25000) });
    return res.status;
  } catch {
    return null;
  }
}

(async () => {
  const netz = netzwerkAdresse();
  const expoAdresse = netz ? `exp://${netz.adresse}:${FEST.expoPort}` : null;

  // Render schlaeft im kostenlosen Tarif ein und braucht beim ersten Aufruf
  // eine knappe Minute — deshalb der grosszuegige Zeitrahmen oben.
  const web = await status(WEBSITE);
  const api = await status(`${WEBSITE}/api/bootstrap`);
  const metro = netz ? await status(`http://${netz.adresse}:${FEST.expoPort}/status`) : null;

  console.log('');
  console.log('  ── Website (Render, immer an) ──────────────────────');
  console.log(`  ${WEBSITE}`);
  console.log(
    `  Seite ${web === 200 ? 'erreichbar' : 'NICHT erreichbar'}` +
      `  ·  Daten ${api === 200 ? 'erreichbar' : 'NICHT erreichbar'}`
  );

  console.log('');
  console.log('  ── Expo Go (eigenes WLAN) ──────────────────────────');
  if (!expoAdresse) {
    console.log('  Keine WLAN-Adresse gefunden — haengt der Rechner im Netz?');
  } else {
    console.log(`  ${expoAdresse}`);
    console.log(`  Bundler ${metro === 200 ? 'laeuft' : 'laeuft NICHT — starten mit: npm run wlan'}`);
    console.log('');
    qr.generate(expoAdresse, { small: true }, (code) => console.log(code));
  }
  console.log('');
  console.log('  Handy und Rechner muessen im selben WLAN haengen.');
  console.log('');
})();
