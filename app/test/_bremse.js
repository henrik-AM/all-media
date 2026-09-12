// Prueft die Bremse der Nummernsuche (SUPABASE_SCHEMA_38_nummer_bremse.sql).
//
// Warum es diesen Test gibt: `finde_per_nummer` uebersetzt eine Telefonnummer
// in eine Person. Am 13.09.2026 liefen zwoelf Aufrufe hintereinander alle mit
// 200 durch — wer eine Vorwahl durchzaehlt, haette zu jeder vergebenen Nummer
// einen Namen bekommen. Seit Schema 38 sind es 40 Nachschlaege je Stunde und
// Konto.
//
// Der Test ruft absichtlich so lange auf, bis die Bremse greift. Das ist die
// einzige Art, sie zu pruefen: eine Bremse, die man nur im SQL liest, ist
// keine.
//
// Start:  node test/_bremse.js
//
// Mit SUPABASE_TOKEN im Aufruf wird der Zaehler des Testkontos vorher
// zurueckgesetzt, damit sich der Lauf innerhalb einer Stunde wiederholen
// laesst. Ohne Token laeuft er trotzdem — dann zaehlt nur noch, DASS die
// Bremse greift, nicht ab welchem Aufruf.

const fs = require('fs');
const path = require('path');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const PROJEKT = (URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || '';

// Das Testkonto aus SUPABASE_SCHEMA_7_testkonto.sql.
const KONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };

// Muss zur Konstanten `grenze` in Schema 38 passen.
const GRENZE = 40;

let fehler = 0;
const pruefe = (name, bedingung, zusatz = '') => {
  if (!bedingung) fehler++;
  console.log((bedingung ? 'PASS  ' : 'FAIL  ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/** Ein Aufruf von finde_per_nummer. Gibt Status und Fehlercode zurueck. */
async function suchen(token, nummer) {
  const antwort = await fetch(`${URL}/rest/v1/rpc/finde_per_nummer`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ nummer }),
  });
  const text = await antwort.text();
  let code = '';
  try {
    code = JSON.parse(text).code || '';
  } catch {
    /* 200 liefert kein Fehlerobjekt */
  }
  return { status: antwort.status, code };
}

/** Zaehler des Testkontos leeren — nur moeglich mit Management-Token. */
async function zaehlerLeeren(nutzerId) {
  const token = process.env.SUPABASE_TOKEN;
  if (!token || !PROJEKT) return false;

  const antwort = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `delete from public.nummer_suche_takt where nutzer = '${nutzerId}';`,
    }),
  });
  return antwort.ok;
}

async function main() {
  if (!URL || !KEY) {
    console.log('FAIL  Zugangsdaten fehlen — app/.env.local pruefen');
    process.exit(1);
  }

  // ------------------------------------------------------------ Anmelden --
  const anmeldung = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    // Supabase will `password`, die Konstante heisst `passwort` — genau hier
    // lief der erste Lauf am 13.09.2026 in eine leere Antwort.
    body: JSON.stringify({ email: KONTO.email, password: KONTO.passwort }),
  });
  const sitzung = await anmeldung.json();
  const token = sitzung.access_token;
  pruefe('Testkonto angemeldet', Boolean(token), sitzung.error_description || '');
  if (!token) process.exit(1);

  const zurueckgesetzt = await zaehlerLeeren(sitzung.user.id);
  console.log(
    zurueckgesetzt
      ? '      (Zaehler vorher geleert)'
      : '      (ohne SUPABASE_TOKEN: Zaehler nicht geleert, Zahlen koennen niedriger sein)'
  );

  // ------------------------------------------------- Anonym geht gar nichts --
  const ohne = await fetch(`${URL}/rest/v1/rpc/finde_per_nummer`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nummer: '+491700000001' }),
  });
  pruefe(
    'Ohne Anmeldung keine Nummernsuche',
    ohne.status !== 200,
    `HTTP ${ohne.status}`
  );

  // --------------------------------------------------- Die Bremse greift --
  let durch = 0;
  let gebremst = false;
  let letzterStatus = 0;

  for (let i = 0; i < GRENZE + 5; i++) {
    // Verschiedene Nummern, wie beim echten Durchzaehlen. Keine davon gehoert
    // zu einem Konto — geprueft wird die Bremse, nicht das Finden.
    const { status, code } = await suchen(token, '+4917' + String(10000000 + i));
    letzterStatus = status;
    if (status === 200) {
      durch++;
      continue;
    }
    if (code === '54000') {
      gebremst = true;
      break;
    }
    break;
  }

  pruefe(
    'Die Bremse greift',
    gebremst,
    gebremst ? `nach ${durch} Suchen` : `letzter Status ${letzterStatus}, ${durch} durchgelassen`
  );
  pruefe(
    'Sie laesst nicht mehr als die Grenze durch',
    durch <= GRENZE,
    `${durch} von hoechstens ${GRENZE}`
  );
  if (zurueckgesetzt) {
    pruefe(
      'Sie laesst die erlaubten Suchen auch wirklich durch',
      durch === GRENZE,
      `${durch} statt ${GRENZE}`
    );
  }

  // ------------------------------------------- Der Zaehler ist nicht lesbar --
  const tabelle = await fetch(`${URL}/rest/v1/nummer_suche_takt?select=*`, {
    headers: { apikey: KEY, Authorization: `Bearer ${token}` },
  });
  const inhalt = await tabelle.text();
  pruefe(
    'Der Zaehler ist von aussen nicht lesbar',
    tabelle.status !== 200 || inhalt.trim() === '[]',
    `HTTP ${tabelle.status}, ${inhalt.slice(0, 60)}`
  );

  // Fuer den naechsten Lauf wieder freigeben, soweit moeglich.
  await zaehlerLeeren(sitzung.user.id);

  const gesamt = zurueckgesetzt ? 5 : 4;
  console.log(`\n${gesamt - fehler} von ${gesamt} Pruefungen bestanden`);
  process.exit(fehler ? 1 : 0);
}

main().catch((e) => {
  console.log('FAIL  Lauf abgebrochen — ' + (e?.message || e));
  process.exit(1);
});
