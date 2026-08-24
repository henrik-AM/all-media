// Prueft die feste oeffentliche Adresse und gibt sie samt QR-Code aus.
//
// Start:  npm run links

const qr = require('qrcode-terminal');
const FEST = require('./adressen.json');

const EXPO_URL = FEST.oeffentlicheAdresse.replace('https://', 'exp://');

async function status(url, kopfzeilen) {
  try {
    const res = await fetch(url, { headers: kopfzeilen, signal: AbortSignal.timeout(20000) });
    return res.status;
  } catch {
    return null;
  }
}

(async () => {
  const web = await status(FEST.oeffentlicheAdresse);
  const api = await status(`${FEST.oeffentlicheAdresse}/api/bootstrap`);
  const manifest = await status(FEST.oeffentlicheAdresse, {
    'expo-platform': 'ios',
    accept: 'application/expo+json,application/json',
  });

  console.log('');
  console.log('  ── Website ─────────────────────────────────────────');
  console.log(`  ${FEST.oeffentlicheAdresse}`);
  console.log(`  Seite ${web === 200 ? 'erreichbar' : 'NICHT erreichbar'}` +
              `  ·  Daten ${api === 200 ? 'erreichbar' : 'NICHT erreichbar'}`);

  console.log('');
  console.log('  ── Expo Go ─────────────────────────────────────────');
  console.log(`  ${EXPO_URL}`);
  console.log(`  App ${manifest === 200 ? 'erreichbar' : 'NICHT erreichbar'}`);
  console.log('');
  qr.generate(EXPO_URL, { small: true }, (code) => console.log(code));
  if (web !== 200 || manifest !== 200) console.log('  Starten mit:  npm run up');
  console.log('');
})();
