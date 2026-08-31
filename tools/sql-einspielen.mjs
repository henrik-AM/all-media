// Spielt eine SQL-Datei in die Supabase-Datenbank ein — ohne Dashboard.
//
// Der oeffentliche Schluessel darf nur lesen und schreiben, was die Regeln
// erlauben. Tabellen anlegen kann er nicht. Dafuer gibt es die Management-API
// von Supabase; sie braucht einen persoenlichen Zugriffstoken (sbp_...) aus
// https://supabase.com/dashboard/account/tokens
//
// Start:  SUPABASE_TOKEN=sbp_... node tools/sql-einspielen.mjs ../SUPABASE_EINSPIELEN.sql
//
// Die Datei wird als eine einzige Anweisungsfolge geschickt. Schlaegt etwas
// fehl, kommt der Fehler von Postgres unveraendert zurueck.

import fs from 'node:fs';

const PROJEKT = process.env.SUPABASE_PROJEKT || 'ijztosbjfybdgotpdixw';
const TOKEN = process.env.SUPABASE_TOKEN || '';
const DATEI = process.argv[2];

if (!TOKEN) { console.error('SUPABASE_TOKEN fehlt.'); process.exit(1); }
if (!DATEI) { console.error('Keine SQL-Datei angegeben.'); process.exit(1); }

const sql = fs.readFileSync(DATEI, 'utf8');
console.log(`${DATEI} — ${sql.split('\n').length} Zeilen an Projekt ${PROJEKT}`);

const antwort = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});

const text = await antwort.text();
if (!antwort.ok) {
  console.error(`FEHLER ${antwort.status}\n${text}`);
  process.exit(1);
}
console.log('Erfolgreich eingespielt.');
if (text && text !== '[]') console.log(text.slice(0, 2000));
