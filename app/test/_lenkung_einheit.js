/**
 * Einheitstest „Feed steuern" (Kasten 24) — ohne Datenbank, ohne Netz.
 *
 * Geprüft wird die Rechnung, die App (app/lib/daten.ts) und Website
 * (web/server/supabase-api.js) gemeinsam benutzen: gemeinsam/lenkung.js
 * macht aus den Einträgen einen Faktor je Beitrag, gemeinsam/rang.js legt
 * ihn auf die Punkte von `feed_rang()`.
 *
 * Geprüft wird die WIRKUNG an gebauten Fällen mit feststehendem Ergebnis:
 *   1. Normalisieren und Treffer je Art.
 *   2. „mehr #x" hebt einen Beitrag über einen sonst besseren.
 *   3. „weniger @profil" schiebt alle Beiträge der Person ans Ende —
 *      auch einen frischen Neuling, der sonst den Erprobungsplatz hätte.
 *   4. Altersdämpfung bleibt: alter Beitrag mit „mehr" schlägt nicht jeden
 *      frischen, weil der Faktor multipliziert und gedeckelt ist.
 *   5. Neulingsplatz bleibt für Beiträge ohne „weniger" erhalten.
 *   6. Ohne Einträge ändert sich nichts (Rückfall wie vorher).
 *   7. Vorschläge kommen aus den übergebenen Daten, nichts dazuerfunden.
 *
 * Start:  node test/_lenkung_einheit.js   (oder npm run test:lenkung-einheit)
 */

const Rang = require('../../gemeinsam/rang');
const L = require('../../gemeinsam/lenkung');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';
const SOUND = '66666666-a11e-4d1a-8000-000000000001';

console.log('\nNormalisieren');
pruefe('Hashtag bekommt # und wird klein', L.normalisieren('hashtag', ' Hafen ') === '#hafen');
pruefe('Doppeltes # wird eins', L.normalisieren('hashtag', '##Laufen') === '#laufen');
pruefe('Leerer Hashtag taugt nicht', L.normalisieren('hashtag', '#') === null);
pruefe('Profil braucht eine Kennung', L.normalisieren('profil', 'anna') === null && L.normalisieren('profil', A) === A);
pruefe('Ort wird klein', L.normalisieren('ort', '  Hamburg ') === 'hamburg');
pruefe('Stichwort mindestens zwei Zeichen', L.normalisieren('wort', 'a') === null && L.normalisieren('wort', 'Ab') === 'ab');
pruefe('Unbekannte Art taugt nicht', L.normalisieren('community', 'x') === null);

console.log('\nTreffer je Art');
const beitrag = {
  id: 'p', user_id: A, tags: ['#Hafen', '#nachtfotografie'], location: 'Hamburg, Altona',
  sound_id: SOUND, music: 'Golden Hour – Lys', description: 'Abendlauf am Hafen', title: '',
};
pruefe('Hashtag trifft ohne Rücksicht auf Groß/klein', L.treffer(beitrag, { art: 'hashtag', wert: '#hafen' }));
pruefe('Fremder Hashtag trifft nicht', !L.treffer(beitrag, { art: 'hashtag', wert: '#laufen' }));
pruefe('Profil trifft den Verfasser', L.treffer(beitrag, { art: 'profil', wert: A }));
pruefe('Profil trifft nicht jemand anderen', !L.treffer(beitrag, { art: 'profil', wert: B }));
pruefe('Sound trifft über sound_id', L.treffer(beitrag, { art: 'sound', wert: SOUND }));
pruefe('Sound ohne sound_id trifft über den Liednamen',
  L.treffer({ id: 'q', music: 'Golden Hour – Lys' }, { art: 'sound', wert: SOUND, anzeige: 'Golden Hour – Lys' }));
pruefe('Ort trifft einen Teil der Ortsangabe', L.treffer(beitrag, { art: 'ort', wert: 'hamburg' }));
pruefe('Ort trifft nicht als Wortteil', !L.treffer(beitrag, { art: 'ort', wert: 'ham' }));
pruefe('Stichwort trifft Wortanfang', L.treffer(beitrag, { art: 'wort', wert: 'abend' }));
pruefe('Stichwort trifft nicht mitten im Wort', !L.treffer(beitrag, { art: 'wort', wert: 'lauf' }));
pruefe('Stichwort trifft auch Hashtags', L.treffer(beitrag, { art: 'wort', wert: 'nachtfoto' }));

console.log('\nFaktoren');
pruefe('Ohne Treffer 1', L.faktor(beitrag, [{ art: 'hashtag', wert: '#x', richtung: 'mehr' }]) === 1);
pruefe('Ein „mehr" = MEHR_FAKTOR', L.faktor(beitrag, [{ art: 'hashtag', wert: '#hafen', richtung: 'mehr' }]) === L.MEHR_FAKTOR);
pruefe('Drei „mehr" sind gedeckelt', L.faktor(beitrag, [
  { art: 'hashtag', wert: '#hafen', richtung: 'mehr' },
  { art: 'ort', wert: 'hamburg', richtung: 'mehr' },
  { art: 'sound', wert: SOUND, richtung: 'mehr' },
]) === L.MEHR_DECKEL);
pruefe('„weniger" Hashtag = WENIGER_FAKTOR', L.faktor(beitrag, [{ art: 'hashtag', wert: '#hafen', richtung: 'weniger' }]) === L.WENIGER_FAKTOR);
pruefe('„weniger" Profil fast ausblenden', L.faktor(beitrag, [{ art: 'profil', wert: A, richtung: 'weniger' }]) === L.PROFIL_WENIGER_FAKTOR);
pruefe('„mehr" und „weniger" zugleich: weniger gewinnt', L.faktor(beitrag, [
  { art: 'hashtag', wert: '#hafen', richtung: 'mehr' },
  { art: 'sound', wert: SOUND, richtung: 'weniger' },
]) < 1);
pruefe('Faktorenkarte enthält nur gelenkte Beiträge',
  L.faktoren([beitrag, { id: 'leer', user_id: B, tags: [] }], [{ art: 'hashtag', wert: '#hafen', richtung: 'mehr' }]).size === 1);
pruefe('Kaputte Einträge werden übergangen',
  L.faktoren([beitrag], [{ art: 'unsinn', wert: '#hafen', richtung: 'mehr' }, { art: 'hashtag', wert: '#hafen', richtung: 'quer' }]).size === 0);

console.log('\n„mehr #x" hebt, „weniger @profil" senkt — im Rang');
/*
 * Sechs Beiträge, sechs Verfasser (das Auffächern verschiebt nichts).
 * Punkte, wie feed_rang() sie liefern könnte — x1 mit #x steht auf Platz 4.
 */
const feed = [
  { id: 'o1', user_id: C, kind: 'post', tags: ['#y'] },
  { id: 'o2', user_id: 'U2', kind: 'post', tags: ['#y'] },
  { id: 'o3', user_id: 'U3', kind: 'post', tags: [] },
  { id: 'x1', user_id: 'U4', kind: 'post', tags: ['#x'] },
  { id: 'b1', user_id: B, kind: 'post', tags: ['#y'] },
  { id: 'o6', user_id: 'U6', kind: 'post', tags: [] },
];
const punkte = new Map([['o1', 6], ['b1', 5.5], ['o2', 5], ['o3', 4], ['x1', 3.5], ['o6', 3]]);
const ohne = Rang.ordnen(feed, punkte).map((b) => b.id);
pruefe('Ohne Lenkung: b1 auf Platz 2, x1 auf Platz 5', ohne[1] === 'b1' && ohne[4] === 'x1', ohne.join(' '));

const eintraege = [
  { art: 'hashtag', wert: '#x', richtung: 'mehr' },
  { art: 'profil', wert: B, richtung: 'weniger' },
];
const mit = Rang.ordnen(feed, punkte, { lenkung: L.faktoren(feed, eintraege) }).map((b) => b.id);
pruefe('„mehr #x": x1 steigt (3,5 · 1,8 = 6,3 > 6)', mit[0] === 'x1', mit.join(' '));
pruefe('„weniger @profil": b1 fällt ans Ende', mit[mit.length - 1] === 'b1', mit.join(' '));
pruefe('Es geht kein Beitrag verloren', mit.length === feed.length && new Set(mit).size === feed.length);

// Dasselbe je Art — so rufen App und Website es auf.
const jeArt = Rang.ordnenJeArt(feed, punkte, (b) => b.kind, { lenkung: L.faktoren(feed, eintraege) }).map((b) => b.id);
pruefe('ordnenJeArt lenkt genauso', jeArt.join() === mit.join(), jeArt.join(' '));

// Die übergebenen Punkte bleiben unangetastet.
pruefe('Die Punktekarte wird nicht verändert', punkte.get('x1') === 3.5 && punkte.get('b1') === 5.5);

console.log('\nNeulingsplatz und Lenkung');
const zwoelf = Array.from({ length: 12 }, (_, i) => ({ id: 'z' + i, user_id: 'V' + i, kind: 'post', tags: [] }));
zwoelf[11].user_id = B;                // Der Neuling gehört der Person mit „weniger".
zwoelf[10].tags = ['#x'];              // Ein zweiter Neuling mit „mehr #x".
const zPunkte = new Map(zwoelf.map((b, i) => [b.id, 100 - i]));
const neulinge = new Set(['z11']);
const ohneLenkung = Rang.ordnen(zwoelf, zPunkte, { neulinge }).map((b) => b.id);
pruefe('Ohne Lenkung bekommt der Neuling Platz 4', ohneLenkung[4] === 'z11', ohneLenkung.join(' '));
const gelenkt = Rang.ordnen(zwoelf, zPunkte, { neulinge, lenkung: L.faktoren(zwoelf, eintraege) }).map((b) => b.id);
pruefe('Mit „weniger @profil" verliert er den Erprobungsplatz', gelenkt[4] !== 'z11', gelenkt.join(' '));
pruefe('… und steht ganz hinten', gelenkt[gelenkt.length - 1] === 'z11');

const neulinge2 = new Set(['z10']);
const mitMehr = Rang.ordnen(zwoelf, zPunkte, { neulinge: neulinge2, lenkung: L.faktoren(zwoelf, eintraege) }).map((b) => b.id);
pruefe('Ein Neuling mit „mehr" behält seinen Platz (spätestens 4)', mitMehr.indexOf('z10') <= 4, mitMehr.join(' '));

console.log('\nAltersdämpfung bleibt erhalten');
/*
 * Gleiche Rohsumme 6, einmal frisch (Dämpfung 1,0), einmal vier Wochen alt
 * (Boden 0,25) — so wie feed_rang() es multipliziert. Der alte mit „mehr"
 * kommt auf 6 · 0,25 · 1,8 = 2,7, der frische ohne bleibt bei 6.
 */
const alt = [
  { id: 'frisch', user_id: 'F', kind: 'post', tags: [] },
  { id: 'altmehr', user_id: 'G', kind: 'post', tags: ['#x'] },
];
const altPunkte = new Map([['frisch', 6 * 1.0], ['altmehr', 6 * 0.25]]);
const altFolge = Rang.ordnen(alt, altPunkte, { lenkung: L.faktoren(alt, eintraege) }).map((b) => b.id);
pruefe('Alter Beitrag mit „mehr" steht nicht über dem frischen', altFolge[0] === 'frisch', altFolge.join(' '));

console.log('\nRückfall');
pruefe('Ohne Einträge bleibt die Reihenfolge gleich',
  Rang.ordnen(feed, punkte, { lenkung: L.faktoren(feed, []) }).map((b) => b.id).join() === ohne.join());
const ohnePunkte = Rang.ordnen(feed, null, { lenkung: L.faktoren(feed, eintraege) }).map((b) => b.id);
pruefe('Ohne Punkte wirkt „weniger" trotzdem', ohnePunkte[ohnePunkte.length - 1] === 'b1', ohnePunkte.join(' '));
const ohnePunkteJeArt = Rang.ordnenJeArt(feed, null, (b) => b.kind, { lenkung: L.faktoren(feed, eintraege) }).map((b) => b.id);
pruefe('Ohne Punkte wirkt „weniger" auch je Art (Rückfall in daten.ts/supabase-api.js)',
  ohnePunkteJeArt[ohnePunkteJeArt.length - 1] === 'b1', ohnePunkteJeArt.join(' '));
pruefe('Ohne Punkte und ohne Lenkung bleibt die Eingabe', Rang.ordnen(feed, null).map((b) => b.id).join() === feed.map((b) => b.id).join());

console.log('\nVorschläge nur aus echten Daten');
const quellen = {
  hashtags: [{ tag: '#hafen', posts: 12 }, { tag: '#hamburg', posts: 40 }, { tag: '#laufen', posts: 3 }],
  sounds: [{ id: SOUND, title: 'Golden Hour', artist: 'Lys', uses: 9 }],
  places: [{ name: 'Hamburger Hafen', ort: 'Hamburg', posts: 5 }, { name: 'Zugspitze', ort: 'Zugspitze', posts: 1 }],
  users: { me: { id: 'me', name: 'Ich', handle: '@ich' }, [A]: { id: A, name: 'Anna', handle: '@anna' }, [B]: { id: B, name: 'Bob', handle: 'bob' } },
  beitraege: [{ tags: ['#hafenkran'], location: 'Hamburg, Altona' }],
  ich: [C],
};
const h = L.vorschlaege('hashtag', 'ha', quellen);
pruefe('Hashtag: eigene Eingabe zuerst', h[0].wert === '#ha' && h[0].zusatz === 'eigene Eingabe', h.map((v) => v.wert).join(' '));
pruefe('Hashtag: Funde nach Beitragszahl', h[1].wert === '#hamburg' && h[2].wert === '#hafen', h.map((v) => v.wert).join(' '));
pruefe('Hashtag: auch aus Beiträgen ohne Tabelleneintrag', h.some((v) => v.wert === '#hafenkran'));
pruefe('Hashtag: nichts Unpassendes', !h.some((v) => v.wert === '#laufen'));
const h2 = L.vorschlaege('hashtag', '#hafen', quellen);
pruefe('Hashtag: bekannte Eingabe trägt ihre Zahl', h2[0].wert === '#hafen' && h2[0].zusatz === '12 Beiträge', JSON.stringify(h2[0]));
const s = L.vorschlaege('sound', 'lys', quellen);
pruefe('Sound: über den Interpreten gefunden', s.length === 1 && s[0].wert === SOUND && s[0].anzeige === 'Golden Hour – Lys');
pruefe('Sound: keine eigene Eingabe (nur echte Sounds)', L.vorschlaege('sound', 'gibtsnicht', quellen).length === 0);
const o = L.vorschlaege('ort', 'hamb', quellen);
pruefe('Ort: Standort mit Ort als Wert', o.some((v) => v.wert === 'hamburg'), o.map((v) => v.wert).join(' | '));
pruefe('Ort: Ortsangabe aus Beiträgen', o.some((v) => v.wert === 'hamburg, altona'));
const p = L.vorschlaege('profil', 'an', quellen);
pruefe('Profil: Anna gefunden, mit @', p.length === 1 && p[0].wert === A && p[0].anzeige === '@anna');
pruefe('Profil: man selbst steht nicht drin', !L.vorschlaege('profil', '', quellen).some((v) => v.wert === 'me' || v.wert === C));
pruefe('Profil: Handle ohne @ bekommt eines', L.vorschlaege('profil', 'bob', quellen)[0].anzeige === '@bob');
pruefe('Stichwort: nur die eigene Eingabe', L.vorschlaege('wort', 'Abend', quellen).length === 1);

console.log('\nAnzeige');
pruefe('eintragText Hashtag', L.eintragText({ art: 'hashtag', wert: '#x', anzeige: '#x', richtung: 'mehr' }) === '#x');
pruefe('eintragText Sound', L.eintragText({ art: 'sound', wert: SOUND, anzeige: 'Golden Hour – Lys', richtung: 'mehr' }) === 'Sound: Golden Hour – Lys');
pruefe('Sortiert: mehr vor weniger', L.sortiert([
  { art: 'hashtag', wert: '#a', richtung: 'weniger', created_at: '2026-10-06' },
  { art: 'hashtag', wert: '#b', richtung: 'mehr', created_at: '2026-10-01' },
])[0].wert === '#b');

console.log(fehler === 0 ? `\n${geprueft} von ${geprueft} Prüfungen bestanden.\n` : `\n${fehler} von ${geprueft} Prüfungen fehlgeschlagen.\n`);
process.exit(fehler === 0 ? 0 : 1);
