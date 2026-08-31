// Meldet die App im Pruefsimulator am Testkonto an — ohne Tippen.
//
// Warum es das gibt: ein Tippen laesst sich im Simulator von aussen nicht
// ausloesen. Ohne Anmeldung ist die App aber leer, und jedes Bild zeigt nur
// den Anmeldebildschirm.
//
// Wie: das Zugangstoken wird ganz normal ueber die Anmeldung geholt und dann
// dorthin geschrieben, wo die App es sucht — AsyncStorage im Container von
// Expo Go. Zwei Eintraege gehoeren dazu:
//
//   sb-<projekt>-auth-token   die Sitzung von supabase-js
//   all-media.sitzung.v2      die Kontenliste von contexts/AuthContext.tsx
//
// Beide muessen da sein: die Kontenliste sagt der App, WER angemeldet ist,
// die Sitzung gibt ihr das Recht, dessen Daten zu lesen.
//
// Start:  node tools/app-anmelden.js

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { pruefgeraet, EXPO_GO_ID } = require('./pruefgeraet.js');

const ROOT = path.join(__dirname, '..');

const UMGEBUNG = fs.existsSync(path.join(ROOT, '.env.local'))
  ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

// Nicht "URL" nennen: das ueberdeckt Nodes eingebaute URL-Klasse.
const ADRESSE = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const MAIL = process.env.AM_TEST_MAIL || 'test@all-media.app';
const PASS = process.env.AM_TEST_PASS || 'AllMedia2026!';

/** Aus https://abc.supabase.co wird "abc" — so heisst der Speicherschluessel. */
const projektKennung = (adresse) => adresse.replace(/^https?:\/\//, '').split('.')[0];

function sh(befehl) { return execSync(befehl, { encoding: 'utf8' }); }
function still(befehl) { try { return sh(befehl); } catch { return ''; } }

/** Die manifest.json von AsyncStorage im Container von Expo Go. */
function speicherDatei(geraet) {
  const container = sh(`xcrun simctl get_app_container ${geraet} ${EXPO_GO_ID} data`).trim();
  const basis = path.join(container, 'Documents', 'ExponentExperienceData');
  if (!fs.existsSync(basis)) return null;

  const treffer = [];
  const suche = (ordner) => {
    for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
      const voll = path.join(ordner, eintrag.name);
      if (eintrag.isDirectory()) suche(voll);
      else if (eintrag.name === 'manifest.json' && voll.includes('RCTAsyncLocalStorage')) treffer.push(voll);
    }
  };
  suche(basis);
  return treffer[0] ?? null;
}

async function main() {
  if (!ADRESSE || !KEY) {
    console.error('Zugangsdaten fehlen — app/.env.local pruefen.');
    process.exit(1);
  }

  const antwort = await fetch(`${ADRESSE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MAIL, password: PASS }),
  }).then((r) => r.json());

  if (!antwort.access_token) {
    console.error(`Anmeldung als ${MAIL} fehlgeschlagen: ${antwort.error_description || antwort.msg}`);
    process.exit(1);
  }
  console.log(`  Angemeldet als ${MAIL}`);

  const geraet = pruefgeraet();
  const datei = speicherDatei(geraet);
  if (!datei) {
    console.error('Kein AsyncStorage gefunden — die App muss einmal gelaufen sein.');
    process.exit(1);
  }

  let daten = {};
  try { daten = JSON.parse(fs.readFileSync(datei, 'utf8')); } catch { /* neu anlegen */ }

  // Die Sitzung, so wie supabase-js sie selbst ablegen wuerde.
  daten[`sb-${projektKennung(ADRESSE)}-auth-token`] = JSON.stringify({
    access_token: antwort.access_token,
    refresh_token: antwort.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + Number(antwort.expires_in || 3600),
    expires_in: Number(antwort.expires_in || 3600),
    token_type: 'bearer',
    user: antwort.user,
  });

  // Die Kontenliste der App.
  daten['all-media.sitzung.v2'] = JSON.stringify({
    konten: [
      {
        id: antwort.user.id,
        email: antwort.user.email,
        profile: {
          id: antwort.user.id,
          name: 'Test Nutzer',
          handle: '@test',
          status: 'online',
          about: 'Verfügbar',
        },
      },
    ],
    aktivId: antwort.user.id,
  });

  fs.writeFileSync(datei, JSON.stringify(daten));
  console.log('  Sitzung in den Simulator geschrieben.');

  still(`xcrun simctl terminate ${geraet} ${EXPO_GO_ID}`);
  console.log('  Expo Go beendet — beim naechsten Start ist die App angemeldet.');
}

main().catch((e) => { console.error(e); process.exit(1); });
