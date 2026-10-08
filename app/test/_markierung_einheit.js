/**
 * Einheitstest @-Markierungen (Kasten 25) — ohne Datenbank, ohne Netz.
 *
 * Geprüft wird gemeinsam/markierung.js, das App (MarkierungsEingabe,
 * MarkierterText), Website (markierterText, markierungsEingabe) und — als
 * gleiches Muster — die Datenbank (markierung_handles) benutzen:
 *   1. Erkennen: welche @-Wörter Markierungen sind, welche nicht
 *      (E-Mail-Adressen, zu kurz/lang, Punkt am Satzende, zwei Punkte).
 *   2. Zerlegen in Text- und Markierungsstücke; unbekannte Namen bleiben Text.
 *   3. Das @-Wort am Cursor finden und ersetzen (Vorschlagsliste).
 *   4. Vorschläge ordnen: Mitglieder vor Nahen vor Suche.
 *   5. Verschlüsselte Zweierchats: nur Mitglieder, ohne mich.
 *   6. Das Muster ist dasselbe wie in der Schema-Datei.
 *
 * Start:  node test/_markierung_einheit.js   (oder npm run test:markierung-einheit)
 */

const fs = require('fs');
const path = require('path');
const M = require('../../gemeinsam/markierung');
const Benutzername = require('../../gemeinsam/benutzername');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nErkennen');
pruefe('Einfacher Name', gleich(M.handles('Hallo @anna'), ['anna']));
pruefe('Groß geschrieben meint denselben Namen', gleich(M.handles('Hallo @Anna und @ANNA'), ['anna']));
pruefe('Am Textanfang', gleich(M.handles('@ben schau mal'), ['ben']));
pruefe('Punkt am Satzende gehört nicht dazu', gleich(M.handles('Danke @anna.'), ['anna']));
pruefe('Punkt im Namen gehört dazu', gleich(M.handles('mit @anna.meier heute'), ['anna.meier']));
pruefe('Komma und Klammern trennen', gleich(M.handles('(@anna),@ben;@carla!'), ['anna', 'ben', 'carla']));
pruefe('E-Mail-Adresse ist keine Markierung', gleich(M.handles('schreib an anna@web.de'), []));
pruefe('Zwei Zeichen sind zu kurz', gleich(M.handles('@ab'), []));
pruefe('Drei Zeichen reichen', gleich(M.handles('@abc'), ['abc']));
pruefe('25 Zeichen sind zu lang (nichts abgeschnitten)', gleich(M.handles('@' + 'a'.repeat(25)), []));
pruefe('24 Zeichen gehen', gleich(M.handles('@' + 'a'.repeat(24)), ['a'.repeat(24)]));
pruefe('Zwei Punkte hintereinander nicht', gleich(M.handles('@an..na'), []));
pruefe('Unterstrich am Ende nicht (kein Teilname)', gleich(M.handles('@anna_'), []));
pruefe('@@anna ist keine Markierung', gleich(M.handles('@@anna'), []));
pruefe('Doppelte nur einmal', gleich(M.handles('@anna @ben @anna'), ['anna', 'ben']));
pruefe('Höchstens HOECHSTENS verschiedene',
  M.handles(Array.from({ length: 30 }, (_, i) => '@name' + i).join(' ')).length === M.HOECHSTENS);
pruefe('Umlaut beendet den Namen nicht mittendrin falsch', gleich(M.handles('@jörg'), []));
pruefe('Zeilenumbruch davor', gleich(M.handles('Hallo\n@anna'), ['anna']));

console.log('\nJeder erkannte Name ist ein gültiger Benutzername');
const proben = ['Hallo @anna.meier.', '@x_y_z hi', '@a1b2c3', '(@ben)', '@Henrik_D'];
pruefe('benutzername.pruefe() nimmt alle an',
  proben.every((t) => M.handles(t).every((h) => Benutzername.pruefe(h) === null)),
  JSON.stringify(proben.map(M.handles)));

console.log('\nPositionen');
const f = M.finden('Hi @Anna, und @ben.');
pruefe('Zwei Treffer', f.length === 2);
pruefe('Erster Treffer an Stelle 3 bis 8', f[0].start === 3 && f[0].ende === 8 && f[0].text === '@Anna');
pruefe('Zweiter Treffer ohne Punkt', f[1].text === '@ben' && 'Hi @Anna, und @ben.'.slice(f[1].start, f[1].ende) === '@ben');

console.log('\nZerlegen');
const s = M.stuecke('Hi @Anna, und @niemand!');
pruefe('Ohne Liste wird jeder Name eine Markierung', s.filter((x) => x.art === 'markierung').length === 2);
const s2 = M.stuecke('Hi @Anna, und @niemand!', new Set(['anna']));
pruefe('Unbekannter Name bleibt Text', gleich(s2, [
  { art: 'text', text: 'Hi ' },
  { art: 'markierung', text: '@Anna', handle: 'anna' },
  { art: 'text', text: ', und @niemand!' },
]), JSON.stringify(s2));
pruefe('Funktion als Liste', M.stuecke('@ben', (h) => h === 'ben')[0].art === 'markierung');
pruefe('Objekt als Liste', M.stuecke('@ben', { ben: { id: 1 } })[0].art === 'markierung');
pruefe('Text ohne @ bleibt ein Stück', gleich(M.stuecke('nur Text'), [{ art: 'text', text: 'nur Text' }]));
pruefe('Leerer Text gibt nichts', gleich(M.stuecke(''), []));
pruefe('Zusammengesetzt ergibt den Ausgangstext',
  M.stuecke('a @bcd e @fgh.', new Set(['fgh'])).map((x) => x.text).join('') === 'a @bcd e @fgh.');

console.log('\nWort am Cursor');
pruefe('Direkt nach @ beginnt die Suche (leer)', gleich(M.aktuellesWort('Hallo @', 7), { start: 6, ende: 7, suche: '' }));
pruefe('Teilwort', gleich(M.aktuellesWort('Hallo @An', 9), { start: 6, ende: 9, suche: 'an' }));
pruefe('Cursor mitten im Wort, Ende dahinter', gleich(M.aktuellesWort('Hallo @Anna toll', 9), { start: 6, ende: 11, suche: 'an' }));
pruefe('Nach Leerzeichen kein Wort mehr', M.aktuellesWort('Hallo @Anna ', 12) === null);
pruefe('E-Mail ist kein Wort', M.aktuellesWort('anna@we', 7) === null);
pruefe('Ohne @ kein Wort', M.aktuellesWort('Hallo Anna', 10) === null);
pruefe('Ohne Cursor gilt das Ende', gleich(M.aktuellesWort('x @be'), { start: 2, ende: 5, suche: 'be' }));

console.log('\nEinsetzen');
const e1 = M.einsetzen('Hallo @An', 9, '@anna.meier');
pruefe('Ersetzt das Wort und hängt ein Leerzeichen an', e1.text === 'Hallo @anna.meier ' && e1.cursor === 18, JSON.stringify(e1));
const e2 = M.einsetzen('Hallo @An und du', 9, 'anna');
pruefe('Mitten im Text, vorhandenes Leerzeichen bleibt einfach', e2.text === 'Hallo @anna und du' && e2.cursor === 12, JSON.stringify(e2));
const e3 = M.einsetzen('Hallo ', 6, 'ben');
pruefe('Ohne @-Wort wird eingefügt', e3.text === 'Hallo @ben ' && e3.cursor === 11, JSON.stringify(e3));

console.log('\nVorschläge ordnen');
const liste = [
  { id: '3', name: 'Zora', handle: '@zora', rang: 'suche' },
  { id: '2', name: 'Bert', handle: '@bert', rang: 'nah' },
  { id: '1', name: 'Anna', handle: '@anna', rang: 'mitglied' },
  { id: '4', name: 'Abel', handle: '@abel', rang: 'nah' },
  { id: '5', name: 'Ohne Handle', handle: '', rang: 'mitglied' },
];
pruefe('Mitglieder vor Nahen vor Suche', gleich(M.vorschlaegeOrdnen(liste).map((p) => p.id), ['1', '4', '2', '3']));
pruefe('Suche filtert nach Name oder Handle', gleich(M.vorschlaegeOrdnen(liste, 'b').map((p) => p.id), ['4', '2']));
pruefe('Wer mit der Suche beginnt, steht innerhalb der Stufe vorn',
  gleich(M.vorschlaegeOrdnen([
    { id: 'x', name: 'Xaver Bert', handle: '@xaver', rang: 'nah' },
    { id: 'y', name: 'Bert', handle: '@bert', rang: 'nah' },
  ], 'bert').map((p) => p.id), ['y', 'x']));

console.log('\nVerschlüsselter Zweierchat (25.6)');
const mitglieder = [{ id: 'ich', handle: '@ich' }, { id: 'du', handle: '@Du_Da' }];
pruefe('Partner wird erkannt', gleich(M.markierteMitglieder('Hey @du_da!', mitglieder, 'ich'), ['du']));
pruefe('Nicht-Mitglied wird nicht gemeldet', gleich(M.markierteMitglieder('Hey @fremder', mitglieder, 'ich'), []));
pruefe('Ich selbst nicht', gleich(M.markierteMitglieder('ich bin @ich', mitglieder, 'ich'), []));

console.log('\nGleiches Muster in der Datenbank');
const schemaDatei = fs.readdirSync(path.join(__dirname, '..', '..'))
  .find((d) => /^SUPABASE_SCHEMA_[0-9X]+_markierungen\.sql$/.test(d));
pruefe('Schema-Datei vorhanden', Boolean(schemaDatei), schemaDatei || 'fehlt');
if (schemaDatei) {
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', schemaDatei), 'utf8');
  pruefe('markierung_handles() benutzt dasselbe Muster wie gemeinsam/markierung.js',
    sql.includes(M.MUSTER_QUELLE.replace(/\\\\/g, '\\')));
  pruefe('Datenbank und Baustein haben dieselbe Obergrenze',
    new RegExp('limit\\s+' + M.HOECHSTENS + '\\b').test(sql));
}

console.log('\nEingebunden');
const lies = (p) => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');
pruefe('UMD_BAUSTEINE kennt markierung', /\['markierung', 'Markierung'\]/.test(lies('app/test/_modulquelle.js')));
pruefe('index.html bindet markierung.js ein', lies('web/public/index.html').includes('/gemeinsam/markierung.js'));

console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
process.exit(fehler ? 1 : 0);
