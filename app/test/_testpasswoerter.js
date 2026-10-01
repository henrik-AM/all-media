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

module.exports = {
  TESTKONTO_PASS: pflicht('AM_TESTKONTO_PASS'),
  PRUEFKONTO_PASS: pflicht('AM_PRUEFKONTO_PASS'),
};
