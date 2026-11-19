// Schicken alle Anmeldewege von App und Website ein Captcha mit? (Fahrplan C9, 19.11.2026)
//
// WARUM
//
// `_auth.js` prüfte bis heute nur zwei Dateien (anmeldung.js, supabaseAuth.ts)
// und nur, OB irgendwo „captchaToken“ steht. Die Neuanmeldungen beim
// Spendencode, beim Passwortändern und beim Kontolöschen fehlten. Nach dem
// Captcha-Schalter wären sie still kaputt gewesen, der Lauf trotzdem grün.
//
// Jetzt wird JEDER Aufruf von signInWithPassword / signUp /
// resetPasswordForEmail im Produktcode einzeln gefunden, und in genau
// diesem Aufruf muss `captchaToken` stehen. Prüfcode (test/, tools/) und die
// ausgelieferte Supabase-Bibliothek zählen nicht.
//
// Start:  node test/_captcha_clients.js      (ohne Netz, ohne Token)

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');

// Wo Produktcode liegt. Neue Ordner hier eintragen.
const ORTE = [
  'web/public',
  'web/server',
  'gemeinsam',
  'app/lib',
  'app/screens',
  'app/components',
  'app/contexts',
  'app/hooks',
  'app/navigation',
];
const AUSGENOMMEN = [/[\\/]lib[\\/]supabase-[\d.]+\.js$/, /[\\/]node_modules[\\/]/, /\.min\.js$/];
const ENDUNGEN = /\.(js|cjs|mjs|ts|tsx)$/;
const AUFRUF = /\.auth\.(signInWithPassword|signUp|resetPasswordForEmail)\s*\(/g;

function dateien(ordner) {
  const voll = path.join(WURZEL, ordner);
  if (!fs.existsSync(voll)) return [];
  const raus = [];
  for (const e of fs.readdirSync(voll, { withFileTypes: true })) {
    const p = path.join(voll, e.name);
    if (e.isDirectory()) raus.push(...dateien(path.relative(WURZEL, p)));
    else if (ENDUNGEN.test(e.name) && !AUSGENOMMEN.some((r) => r.test(p))) raus.push(p);
  }
  return raus;
}

/** Text des Aufrufs bis zur passenden schließenden Klammer. */
function aufrufText(text, start) {
  let tiefe = 0;
  for (let i = start; i < text.length && i < start + 4000; i++) {
    const z = text[i];
    if (z === '(') tiefe++;
    else if (z === ')') {
      tiefe--;
      if (tiefe === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start, start + 4000);
}

function aufrufeFinden() {
  const funde = [];
  for (const datei of ORTE.flatMap(dateien)) {
    const text = fs.readFileSync(datei, 'utf8');
    for (const m of text.matchAll(AUFRUF)) {
      const klammer = m.index + m[0].length - 1;
      const stueck = aufrufText(text, klammer);
      funde.push({
        datei: path.relative(WURZEL, datei),
        zeile: text.slice(0, m.index).split('\n').length,
        art: m[1],
        mitToken: /captchaToken/.test(stueck),
      });
    }
  }
  return funde;
}

module.exports = { aufrufeFinden };

if (require.main === module) {
  const funde = aufrufeFinden();
  let fehler = 0;
  for (const f of funde) {
    if (!f.mitToken) fehler++;
    console.log(`${f.mitToken ? 'PASS' : 'FAIL'}  ${f.datei}:${f.zeile}  ${f.art}${f.mitToken ? '' : ' ohne captchaToken'}`);
  }
  // Leere Liste wäre Grün aus falschem Grund (Pfade verschoben).
  if (funde.length < 6) {
    fehler++;
    console.log(`FAIL  nur ${funde.length} Anmeldeaufrufe gefunden — erwartet mindestens 6, Pfade prüfen`);
  }
  console.log(`\n${funde.length - funde.filter((f) => !f.mitToken).length}/${funde.length} Anmeldeaufrufe mit captchaToken`);
  process.exit(fehler ? 1 : 0);
}
