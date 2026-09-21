/**
 * Was darf jemand OHNE Anmeldung? — geprüft von außen, mit dem öffentlichen
 * Schlüssel, so wie ein Fremder es täte.
 *
 * WARUM ES DAS GIBT
 *
 * Am 13.09.2026 war `testbestand_insight(uuid)` ohne jede Anmeldung
 * aufrufbar. Nicht, weil jemand ein Recht vergeben hätte, sondern weil
 * Postgres jeder neuen Funktion `EXECUTE` für PUBLIC mitgibt und der
 * Rechteentzug aus Schema 23 nur für die Funktionen galt, die es damals
 * schon gab. Schema 37 hat es geschlossen — aber Schema 38 würde dasselbe
 * Loch wieder aufmachen, und niemand würde es merken.
 *
 * Genau deshalb prüft dieser Lauf nicht den Code und nicht die SQL-Dateien,
 * sondern die laufende Datenbank: er liest alle Funktionsnamen aus den
 * Schemadateien und ruft jede einzelne ohne Anmeldung auf.
 *
 *   Antwort 401/403  — das Recht ist entzogen. Gut.
 *   Antwort 404      — für einen Fremden gar nicht erst sichtbar. Gut.
 *   Antwort 200      — FUND. Die Funktion läuft für jeden im Internet.
 *
 * Zwei Funktionen dürfen antworten, weil beim Registrieren noch niemand
 * angemeldet ist: `handle_frei` und `nummer_frei`. Für sie gilt die Prüfung
 * umgekehrt — antworten sie NICHT, ist die Registrierung kaputt.
 *
 * EIN GRÜNER LAUF HIER HEISST NICHT „SICHER"
 *
 * Er heisst: kein Fremder kann eine Funktion ausführen und keine Tabelle
 * lesen. Über die Rechte eines ANGEMELDETEN Nutzers sagt er nichts — das
 * prüfen _sichtbarkeit.js und _krypto.js.
 *
 * Start:  node test/_rechte.js
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');

// Derselbe Zugang wie in den übrigen Läufen: der publishable key ist für den
// Client gedacht und steckt ohnehin im App-Bundle.
const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

/** Ohne Anmeldung aufrufbar sein DÜRFEN nur diese zwei — siehe Schema 37. */
const ERLAUBT = new Set(['handle_frei', 'nummer_frei']);

let gut = 0;
let schlecht = 0;
const pruefe = (name, bedingung, zusatz = '') => {
  if (bedingung) gut++;
  else schlecht++;
  console.log((bedingung ? 'PASS  ' : 'FAIL  ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/**
 * Alle Funktionen aus den Schemadateien: Name und Argumentliste.
 *
 * Die Argumente werden gebraucht, weil PostgREST eine Funktion nur an ihrer
 * Signatur erkennt. Mit leerem Rumpf antwortet es auf JEDEN Aufruf mit 404 —
 * auch auf einen, der in Wahrheit erlaubt wäre. Der Lauf wäre grün und
 * wertlos.
 */
function funktionenAusSql() {
  const gefunden = new Map();
  for (const datei of fs.readdirSync(WURZEL).filter((d) => d.endsWith('.sql'))) {
    const text = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
    const muster = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z_0-9]+)\s*\(([^)]*)\)/gi;
    for (const treffer of text.matchAll(muster)) {
      const name = treffer[1];
      const roh = treffer[2].trim();
      // Trigger-Funktionen haben keine Argumente und sind über PostgREST
      // ohnehin nicht aufrufbar — sie kommen trotzdem mit, denn ein Recht,
      // das niemand braucht, gehört auch dann weg.
      const argumente = roh
        ? roh
            .split(',')
            .map((teil) => teil.trim().split(/\s+/))
            .filter((teile) => teile.length >= 2)
            .map((teile) => ({ name: teile[0], typ: teile.slice(1).join(' ').toLowerCase() }))
        : [];
      gefunden.set(name, argumente);
    }
  }
  return gefunden;
}

/** Ein Wert, den Postgres für diesen Typ annimmt. Der Inhalt ist gleichgültig. */
function beispielwert(typ) {
  if (typ.includes('[]')) return [];
  if (typ.includes('uuid')) return '00000000-0000-0000-0000-000000000000';
  if (typ.includes('bool')) return false;
  if (typ.includes('int') || typ.includes('numeric') || typ.includes('float')) return 0;
  if (typ.includes('json')) return {};
  if (typ.includes('timestamp') || typ.includes('date')) return '2026-01-01';
  return 'x';
}

async function rpc(name, argumente) {
  const koerper = {};
  for (const arg of argumente) koerper[arg.name] = beispielwert(arg.typ);

  try {
    const antwort = await fetch(`${URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(koerper),
    });
    return { status: antwort.status, text: (await antwort.text()).slice(0, 120) };
  } catch (fehler) {
    return { status: 0, text: String(fehler.message || fehler) };
  }
}

async function main() {
  if (!URL || !KEY) {
    console.log('FAIL  Zugangsdaten fehlen — app/.env.local anlegen oder SUPABASE_URL/_ANON_KEY setzen');
    process.exit(1);
  }

  console.log('Prüft ohne Anmeldung gegen ' + URL + '\n');

  const funktionen = funktionenAusSql();
  console.log(`${funktionen.size} Funktionen aus den Schemadateien gelesen\n`);

  const funde = [];

  for (const [name, argumente] of [...funktionen].sort()) {
    const { status, text } = await rpc(name, argumente);

    if (ERLAUBT.has(name)) {
      // Umgekehrte Richtung: diese beiden MÜSSEN ohne Anmeldung antworten.
      pruefe(`${name} bleibt für die Registrierung erreichbar`, status === 200, `HTTP ${status}`);
      continue;
    }

    const zu = status === 401 || status === 403 || status === 404;
    if (!zu) funde.push(`${name} → HTTP ${status} ${text}`);
    pruefe(`${name} ist ohne Anmeldung zu`, zu, zu ? `HTTP ${status}` : `HTTP ${status} — ${text}`);
  }

  // Zweite Richtung: Tabellen. Ein Fremder darf keine Zeile sehen.
  for (const tabelle of [
    'profiles',
    'posts',
    'messages',
    'chats',
    'stories',
    'contacts',
    // Seit Schema 46. Ihre Leseregeln lauten `to authenticated` — ein
    // Fremder bekommt dort nichts. Geprueft wird es trotzdem: genau diese
    // Annahme war bei `notifications` schon einmal falsch.
    'sammlungen',
    'sammlung_inhalte',
  ]) {
    try {
      const antwort = await fetch(`${URL}/rest/v1/${tabelle}?select=id&limit=1`, {
        headers: { apikey: KEY },
      });
      const text = await antwort.text();
      const leer = antwort.status !== 200 || text.trim() === '[]';
      pruefe(`${tabelle} gibt Fremden nichts heraus`, leer, `HTTP ${antwort.status} ${text.slice(0, 80)}`);
    } catch (fehler) {
      pruefe(`${tabelle} gibt Fremden nichts heraus`, false, String(fehler.message || fehler));
    }
  }

  console.log(`\n${gut} von ${gut + schlecht} Pruefungen bestanden`);

  if (funde.length) {
    console.log('\nOFFEN OHNE ANMELDUNG — das gehört repariert:');
    for (const f of funde) console.log('  ' + f);
    console.log('\nReparatur: das Muster aus SUPABASE_SCHEMA_37_rechte_nachziehen.sql');
    console.log('noch einmal einspielen — es entzieht PUBLIC und anon alle Rechte');
    console.log('und gibt nur handle_frei und nummer_frei zurück.');
  }

  process.exit(schlecht ? 1 : 0);
}

main();
