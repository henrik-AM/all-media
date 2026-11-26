/**
 * Offene Punkte 0c, „Spendenstand fälschbar" — Teil „Bis dahin: Spendenstand
 * nicht als echtes Geld darstellen" (26.10.2026).
 *
 * Ohne Zahlungsdienst ist jede Spende nur vorgemerkt. Geprüft wird, dass die
 * gemeinsamen Texte (gemeinsam/spende.js) das sagen und dass App und Website
 * keine eigenen „gespendet"/„gesammelt"/„Erreicht"-Texte mehr zeigen.
 * Rotnachweis: dieselben Prüfungen gegen spende.js vor der Änderung schlagen
 * fehl. Offline, ohne Supabase.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const wurzel = path.join(__dirname, '..', '..');
const lies = (datei) => fs.readFileSync(path.join(wurzel, datei), 'utf8');
let n = 0;
const test = (name, f) => {
  f();
  console.log(`OK ${++n} ${name}`);
};

/** Die Prüfungen am Baustein — einmal für den neuen, einmal (rot) für den alten Stand. */
function bausteinPruefen(Spende) {
  const mitZiel = Spende.stand({ titel: 'Ziel', ziel: 100, gesammelt: 5 }, { summe_cent: 250, spender: 1 });
  assert.match(mitZiel.zahlenText, /^7,50 € von 100 € vorgemerkt · nicht bezahlt$/);
  assert.equal(mitZiel.spenderText, '1 Person hat vorgemerkt');
  const ohneZiel = Spende.stand({ titel: 'Ziel', ziel: 0 }, { summe_cent: 1000, spender: 3 });
  assert.equal(ohneZiel.zahlenText, '10 € vorgemerkt · nicht bezahlt');
  assert.equal(ohneZiel.spenderText, '3 Personen haben vorgemerkt');
  assert.equal(Spende.bestaetigung(250, 'Anna'), '2,50 € an Anna vorgemerkt — nicht bezahlt');
  assert.equal(Spende.liveText(1234), '12,34 € vorgemerkt · nicht bezahlt');
  assert.match(Spende.HINWEIS, /nicht bezahlt/);
  assert.match(Spende.HINWEIS, /kein Geld/);
}

test('Karte, Spender, Meldung und Livesumme heißen „vorgemerkt · nicht bezahlt"', () => {
  bausteinPruefen(require('../../gemeinsam/spende'));
});

test('Rotnachweis: der Stand vor der Änderung fällt durch', () => {
  const alt = execFileSync('git', ['show', 'b8c15da:gemeinsam/spende.js'], { cwd: wurzel, encoding: 'utf8' });
  const modul = { exports: {} };
  new Function('module', 'exports', alt)(modul, modul.exports);
  assert.throws(() => bausteinPruefen(modul.exports));
});

// Sichtbare Texte, die echtes Geld behaupten. Kommentare zählen nicht.
const ohneKommentare = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const VERBOTEN = [/€ an \$\{[^}]+\} gespendet/, /€ gespendet/, /gesammelt`/, /haben gespendet/, /hat gespendet/];

for (const datei of [
  'app/components/SpendeKarte.tsx',
  'app/screens/videos/ClipPlayerScreen.tsx',
  'app/screens/videos/LivestreamScreen.tsx',
  'web/public/app.js',
  'gemeinsam/spende.js',
]) {
  test(`${datei}: kein „gespendet"/„gesammelt" als Geldbehauptung`, () => {
    const text = ohneKommentare(lies(datei));
    for (const muster of VERBOTEN) assert.doesNotMatch(text, muster, `${datei}: ${muster}`);
  });
}

test('Detailblatt App und Website: „Vorgemerkt" statt „Erreicht", Hinweis sichtbar', () => {
  const app = lies('app/components/SpendeKarte.tsx');
  const web = lies('web/public/app.js');
  assert.match(app, /label="Vorgemerkt"/);
  assert.doesNotMatch(app, /label="Erreicht"/);
  assert.match(app, /\{Spende\.HINWEIS\}/);
  assert.match(web, /zeile\('Vorgemerkt'/);
  assert.doesNotMatch(web, /zeile\('Erreicht'/);
  assert.match(web, /data-nicht-bezahlt>\$\{esc\(Spende\.HINWEIS\)\}/);
});

test('Meldungen nach dem Spenden kommen aus Spende.bestaetigung (App 3×, Website 1×)', () => {
  const zaehle = (datei) => (lies(datei).match(/Spende\.bestaetigung\(/g) || []).length;
  assert.equal(zaehle('app/components/SpendeKarte.tsx'), 1);
  assert.equal(zaehle('app/screens/videos/ClipPlayerScreen.tsx'), 2);
  assert.equal(zaehle('web/public/app.js'), 1);
  assert.match(lies('app/screens/videos/LivestreamScreen.tsx'), /Spende\.liveText\(spenden\)/);
});

console.log(`${n}/${n} Prüfungen bestanden (offline, keine Zahlungslogik)`);
