/**
 * Passwörter der beiden Testkonten (01.10.2026).
 *
 * Bis heute standen sie im Klartext in fast jedem Prüflauf — und weil das
 * Repo öffentlich war, konnte sich jeder damit in Supabase anmelden. Seither
 * ist das Repo privat, die Passwörter sind neu und stehen nur noch in
 * `app/.env.local` (in .gitignore). Ablage im Vault:
 * 04 Ressourcen/Zugangsdaten/Supabase.md
 *
 *   AM_TESTKONTO_PASS=…    test@all-media.app
 *   AM_PRUEFKONTO_PASS=…   all.media.prueflauf@web.de
 *
 * Fehlt einer der Werte, bricht der Lauf sofort ab — sonst meldeten zwanzig
 * Prüfläufe „Anmeldung fehlgeschlagen" und niemand sähe den Grund.
 */

const fs = require('fs');
const path = require('path');

// Wer Passwörter braucht, läuft gegen Supabase — nur mit eigener Belegung des
// Testbestands (_ki_belegung.js), sonst Abbruch vor der Anmeldung.
require('./_ki_belegung').pruefeBelegung('testbestand');

const DATEI = path.join(__dirname, '..', '.env.local');
const UMGEBUNG = fs.existsSync(DATEI) ? fs.readFileSync(DATEI, 'utf8') : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

function pflicht(name) {
  const w = (process.env[name] || wert(name)).trim();
  if (!w) {
    console.error(`\nABBRUCH  ${name} fehlt in app/.env.local.\n` +
      '          Wert steht im Vault: 04 Ressourcen/Zugangsdaten/Supabase.md\n');
    process.exit(2);
  }
  return w;
}

// Kontenpool (Schema 138): Plätze 2–4 haben ein gemeinsames Passwort. Die
// Namen bleiben, damit kein Lauf etwas ändern muss: TESTKONTO_PASS gehört
// zum Partnerkonto, PRUEFKONTO_PASS zum Prüfkonto des aktiven Platzes.
const PLATZ = require('./_kontenpool').platzSetzen();

module.exports = PLATZ === 1
  ? { TESTKONTO_PASS: pflicht('AM_TESTKONTO_PASS'), PRUEFKONTO_PASS: pflicht('AM_PRUEFKONTO_PASS') }
  : { TESTKONTO_PASS: pflicht('AM_POOL_PASS'), PRUEFKONTO_PASS: pflicht('AM_POOL_PASS') };
