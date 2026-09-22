/**
 * Übersetzten App-Code zu EINER Datei ohne Importe zusammenlegen.
 *
 * WARUM ES DAS GIBT
 *
 * Drei Prüfläufe (_aktionen, _handbuch, _gleichstand) führen echten App-Code
 * im Browser aus: `aktionen.ts` bzw. `daten.ts` werden mit tsc übersetzt und
 * als `blob:`-Modul in die Seite geladen. Das ging nur, solange diese Dateien
 * ausschließlich Typen importierten — Typen verschwinden beim Übersetzen, und
 * übrig blieb eine Datei ohne jeden Import. Genau so stand es auch als
 * Annahme in _gleichstand.js.
 *
 * Mit der Sicherheitsprüfung vom 04.09.2026 stimmt das nicht mehr: beide
 * Dateien importieren jetzt `signiereMedien` aus `./medien` — einen echten
 * Wert, keinen Typ. Ein `blob:`-Modul hat keine Herkunft, an der ein
 * relativer Pfad hängen könnte, und der Browser meldet
 * „Failed to resolve module specifier './medien'".
 *
 * Hier wird deshalb aus zwei übersetzten Dateien eine gemacht: die Exporte
 * des Hilfsmoduls werden zu gewöhnlichen Deklarationen, die Importzeile im
 * Hauptteil fällt weg. Kein Bündler nötig, und die Annahme „eine Datei ohne
 * Importe" gilt wieder.
 */

const fs = require('fs');
const path = require('path');

/** Eine bestimmte übersetzte Datei im Bauordner finden. */
function finde(ordner, name) {
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const voll = path.join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      const treffer = finde(voll, name);
      if (treffer) return treffer;
    } else if (eintrag.name === name) {
      return voll;
    }
  }
  return null;
}

/**
 * Die gemeinsamen Spaltenlisten als Deklarationen ohne `module.exports`.
 *
 * `gemeinsam/spalten.js` benutzen App und Website zusammen. Die Datei ist
 * CommonJS, damit der Node-Server sie ohne Uebersetzungsschritt laden kann —
 * im blob:-Modul des Browsers gibt es aber weder `module` noch einen Pfad,
 * an dem `../../gemeinsam/spalten` haengen koennte. Uebrig bleiben soll nur
 * das, was die Datei ohnehin ist: ein paar `const`-Zeilen.
 *
 * Ohne das schlagen _gleichstand und _aktionen mit
 * „Failed to resolve module specifier" fehl — und zwar mitten im Lauf, nach
 * ein paar bestandenen Pruefungen. Genau so ist es beim Zusammenlegen der
 * Spaltenlisten passiert.
 */
function gemeinsameSpalten() {
  const datei = path.join(__dirname, '..', '..', 'gemeinsam', 'spalten.js');
  if (!fs.existsSync(datei)) return '';
  return fs
    .readFileSync(datei, 'utf8')
    // Der Exportblock am Ende faellt weg, die Deklarationen bleiben stehen.
    .replace(/module\.exports\s*=\s*\{[\s\S]*?\};?\s*$/m, '');
}

/**
 * Die uebrigen gemeinsamen Bausteine aus `gemeinsam/` beilegen.
 *
 * `telefon.js` und `passwort.js` sind — wie `krypto.js` — UMD: unter Node
 * setzen sie `module.exports`, im Browser `globalThis.<Name>`. Im blob:-Modul
 * gibt es kein `module`, also greift von selbst der Browser-Zweig; nur der
 * `require(...)`-Aufruf im uebersetzten App-Code muss noch auf das Ergebnis
 * zeigen.
 *
 * Nachgetragen am 07.09.2026, nachdem `aktionen.ts` und `personSuche.ts` die
 * Telefonregel aus `gemeinsam/telefon.js` holten. Drei Laeufe (_aktionen,
 * _handbuch, _kanal) kippten daraufhin mit „require is not defined" — und
 * zwar mitten im Lauf, nach ein paar bestandenen Pruefungen. Wer hier einen
 * neuen gemeinsamen Baustein einfuehrt, muss ihn in diese Liste eintragen.
 */
const UMD_BAUSTEINE = [
  ['telefon', 'Telefon'],
  ['passwort', 'Passwort'],
  // 21.09.2026: `kommentar.js` kam fuer „Meine Kommentare" dazu — und genau
  // dieselben drei Laeufe kippten wieder. Der Hinweis oben stand da, der
  // Eintrag fehlte trotzdem.
  ['kommentar', 'Kommentar'],
  // 21.09.2026: `rang.js` kam mit dem Feed-Algorithmus dazu (Schema 51).
  // Diesmal gleich mit dem Baustein eingetragen statt hinterher.
  ['rang', 'Rang'],
];

function umdTeile() {
  const gemeinsam = path.join(__dirname, '..', '..', 'gemeinsam');
  return UMD_BAUSTEINE.map(([datei]) => {
    const voll = path.join(gemeinsam, `${datei}.js`);
    return fs.existsSync(voll) ? fs.readFileSync(voll, 'utf8') : '';
  })
    .filter(Boolean)
    .join('\n');
}

/**
 * Aus `require('../../gemeinsam/telefon')` wird `globalThis.Telefon`.
 *
 * UND aus `import { a, b } from '../../gemeinsam/rang'` wird
 * `const { a, b } = globalThis.Rang;`.
 *
 * Der zweite Fall kam am 21.09.2026 dazu. `aktionen.ts` holt seine
 * Bausteine mit `require`, `daten.ts` dagegen mit einem ESM-`import` — und
 * den liess die Ersetzung stehen. Der Lauf kippte dann nicht mit „require
 * is not defined", sondern mit „Failed to resolve module specifier", also
 * mit einer anderen Meldung an derselben Stelle. Der Eintrag in
 * UMD_BAUSTEINE war da, er griff nur fuer die halbe Datei.
 *
 * Fuer `gemeinsam/spalten.js` gibt es weiter unten eine eigene Behandlung:
 * die Datei hat keine UMD-Huelle und wird als blanke Deklarationen
 * vorangestellt.
 */
function umdAufloesen(quelltext) {
  return UMD_BAUSTEINE.reduce((text, [datei, name]) => {
    const mitRequire = text.replace(
      new RegExp(`require\\(['"][^'"]*gemeinsam/${datei}(?:\\.js)?['"]\\)`, 'g'),
      `globalThis.${name}`
    );
    return mitRequire.replace(
      new RegExp(
        `^\\s*import\\s*(\\{[^}]*\\})\\s*from\\s*['"][^'"]*gemeinsam/${datei}(?:\\.js)?['"];?\\s*$`,
        'gm'
      ),
      `const $1 = globalThis.${name};`
    );
  }, quelltext);
}

/**
 * Die Verschluesselung so einbauen, dass sie im Browser wirklich rechnet.
 *
 * WARUM NICHT EINFACH EINE ATTRAPPE
 *
 * Seit dem 07.09.2026 laufen `aktionen.ts` und `daten.ts` durch
 * `lib/krypto.ts`. Man koennte das hier durch eine Huelle ersetzen, die alles
 * im Klartext durchreicht — dann liefen die Pruefungen wieder, und geprueft
 * waere weniger als vorher. Genau die Sorte gruener Zahl, die nichts beweist.
 *
 * Stattdessen kommt die echte Rechnung mit: `gemeinsam/tweetnacl.js` und
 * `gemeinsam/krypto.js` sind reines JavaScript und laufen im Browser wie auf
 * dem Geraet. Ersetzt werden nur die drei Stellen, die es im Browser nicht
 * gibt:
 *
 *   - `expo-secure-store`  → `localStorage`. Im Browser gibt es keine
 *     Schluesselkette; der Pruefschluessel liegt unter einem eigenen Namen,
 *     damit er nicht mit dem der Website zusammenfaellt.
 *   - `expo-crypto`        → `crypto.getRandomValues`. Derselbe Zufall, nur
 *     ein anderer Name davor.
 *   - `require(...)`       → die globalen Namen, die die beiden UMD-Dateien
 *     oben ohnehin setzen. Ein blob:-Modul hat kein `require`.
 *
 * WAS DAMIT TROTZDEM NICHT GEPRUEFT IST
 *
 * Die Chats dieser Pruefläufe laufen gegen Demoprofile, und ein Demoprofil hat
 * kein Geraet und damit keinen Schluessel. `fuerChatVerschliessen` steigt
 * deshalb aus und schickt Klartext — richtig so, aber es heisst: geprueft ist
 * hier nur, dass der Krypto-Pfad *durchlaeuft*, nicht dass er verschliesst.
 * Wer sich auf eine gruene Zahl von hier beruft, beruft sich auf zu wenig.
 *
 * Dass wirklich verschlossen wird, weist `test/_krypto.js` nach — dort mit
 * zwei echten Konten, aber ohne App-Code. Der App-Code *mit* zwei echten
 * Konten im Browser fehlt noch.
 */
function kryptoteil(bauOrdner) {
  const datei = finde(bauOrdner, 'krypto.js');
  if (!datei) return '';

  const gemeinsam = path.join(__dirname, '..', '..', 'gemeinsam');
  const nacl = fs.readFileSync(path.join(gemeinsam, 'tweetnacl.js'), 'utf8');
  const rechnung = fs.readFileSync(path.join(gemeinsam, 'krypto.js'), 'utf8');

  const attrappen = `
const SecureStore = {
  getItemAsync: async (k) => localStorage.getItem('prueflauf.' + k),
  setItemAsync: async (k, v) => localStorage.setItem('prueflauf.' + k, v),
};
const ExpoCrypto = {
  getRandomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
  randomUUID: () => crypto.randomUUID(),
};
`;

  const app = fs
    .readFileSync(datei, 'utf8')
    .replace(/^\s*import\s+\*\s+as\s+\w+\s+from\s+['"]expo-[\w-]+['"];?\s*$/gm, '')
    .replace(/require\(['"][^'"]*gemeinsam\/tweetnacl['"]\)/g, 'globalThis.nacl')
    .replace(/require\(['"][^'"]*gemeinsam\/krypto['"]\)/g, 'globalThis.Krypto')
    // Im Blob gibt es nur ein Modul — aus `export const x` wird `const x`.
    .replace(/^export\s+/gm, '');

  return `${nacl}\n${rechnung}\n${attrappen}\n${app}\n`;
}

/**
 * Den Quelltext einer übersetzten Datei holen, mit `medien.js` und den
 * gemeinsamen Spaltenlisten verschmolzen.
 *
 * @param {string} bauOrdner  Ausgabeordner von tsc
 * @param {string} name       etwa 'aktionen.js' oder 'daten.js'
 * @returns {string|null}
 */
function zusammengelegt(bauOrdner, name) {
  const haupt = finde(bauOrdner, name);
  if (!haupt) return null;

  let quelltext = umdAufloesen(fs.readFileSync(haupt, 'utf8'));

  // Der Import der gemeinsamen Spaltenlisten faellt weg; ihr Inhalt kommt
  // stattdessen vorne dazu.
  quelltext = quelltext.replace(
    /^\s*import\s*\{[^}]*\}\s*from\s*['"][./]*gemeinsam\/spalten(?:\.js)?['"];?\s*$/gm,
    ''
  );
  const spaltenteil = gemeinsameSpalten();

  // Der Import der Verschluesselung faellt ebenso weg; sie kommt vorne dazu.
  quelltext = quelltext.replace(
    /^\s*import\s*\{[^}]*\}\s*from\s*['"]\.\/krypto(?:\.js)?['"];?\s*$/gm,
    ''
  );
  const kryptoQuelle = kryptoteil(bauOrdner);

  const bausteine = umdTeile();

  const medien = finde(bauOrdner, 'medien.js');
  if (!medien) return `${spaltenteil}\n${bausteine}\n${kryptoQuelle}\n${quelltext}`; // Ohne medien.js.

  // Aus `export function x` wird `function x` — im Blob gibt es nur ein Modul.
  const hilfsteil = umdAufloesen(fs.readFileSync(medien, 'utf8')).replace(/^export\s+/gm, '');

  // Die Importzeile fliegt raus, egal ob mit oder ohne Strichpunkt.
  quelltext = quelltext.replace(
    /^\s*import\s*\{[^}]*\}\s*from\s*['"]\.\/medien(?:\.js)?['"];?\s*$/gm,
    ''
  );

  return `${spaltenteil}\n${bausteine}\n${kryptoQuelle}\n${hilfsteil}\n${quelltext}`;
}

module.exports = { zusammengelegt, finde };
