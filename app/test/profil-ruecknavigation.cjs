// Führt die tatsächlichen JSX-Handler aus App.tsx aus; kein nativer Renderer.
// Die Gegenprobe mit APP_QUELLE=<alter Stand> muss die verlorene Rückkehr finden.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');

const quelle = fs.readFileSync(process.env.APP_QUELLE || path.join(__dirname, '../App.tsx'), 'utf8');
const baum = ts.createSourceFile('App.tsx', quelle, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function handler(komponente, prop, werte) {
  const treffer = [];
  function suchen(k) {
    if ((ts.isJsxOpeningElement(k) || ts.isJsxSelfClosingElement(k)) && k.tagName.getText(baum) === komponente) {
      const a = k.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(baum) === prop);
      if (a?.initializer?.expression) treffer.push(a.initializer.expression.getText(baum));
    }
    ts.forEachChild(k, suchen);
  }
  suchen(baum);
  assert.equal(treffer.length, 1, `${komponente}.${prop}: genau ein Handler`);
  const js = ts.transpileModule(`(${treffer[0]})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
  return vm.runInNewContext(js, werte);
}

let bestanden = 0;
for (const [art, oeffnen, screen] of [
  ['followers', 'onOpenFollowers', 'FollowersScreen'],
  ['following', 'onOpenFollowing', 'FollowingScreen'],
]) {
  // Auch zusätzliche Profilinformationen müssen beim Zurück erhalten bleiben.
  const profil = { kind: 'profile', userId: 'nicht-vorgeladene-person', variant: 'oeffentlich', versatz: 37 };
  let liste;
  handler('UserProfileScreen', oeffnen, { overlay: profil, setOverlay: wert => { liste = wert; } })(profil.userId);
  assert.equal(liste.kind, art);
  assert.equal(liste.userId, profil.userId);
  let zurueck;
  handler(screen, 'onBack', { overlay: liste, setOverlay: wert => { zurueck = wert; } })();
  assert.equal(zurueck, profil, `${art}: Rückkehr zum selben Profil statt zur Suche`);
  console.log(`OK ${art}: ursprüngliches Profil vollständig wiederhergestellt`);
  bestanden++;

  handler(screen, 'onBack', { overlay: { kind: art, userId: 'me' }, setOverlay: wert => { zurueck = wert; } })();
  assert.equal(zurueck, null, `${art}: eigene Liste ohne Vorgänger schließt normal`);
  console.log(`OK ${art}: direkte eigene Liste schließt normal`);
  bestanden++;
}
console.log(`${bestanden}/4 Prüfungen bestanden`);
