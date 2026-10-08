/**
 * Einheitstest für gemeinsam/bildschirmzeit.js (Kasten 22) — ohne Netz,
 * ohne Browser, ohne Supabase.
 *
 * Geprüft wird die Rechnung, die App und Website teilen: welcher Bildschirm
 * zu welchem Bereich gehört, wann ein Bereich zu ist, was „Immer erlaubt"
 * heißt, Werktag/Wochenende, Auszeit über Mitternacht, „15 Min. mehr",
 * Freigaben mit Code, die Uhr (Messung) und lockerer().
 *
 * Ob die Datenbank dieselben Regeln durchsetzt, prüft test/_bildschirmzeit.js.
 *
 * Start:  node test/_bildschirmzeit_einheit.js
 */

const B = require('../../gemeinsam/bildschirmzeit');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

// Ein fester Zeitpunkt: Dienstag, 06.10.2026, 15:00 in Berlin (13:00 UTC).
const DIENSTAG_15 = Date.parse('2026-10-06T13:00:00Z');
// Samstag, 10.10.2026, 15:00 in Berlin.
const SAMSTAG_15 = Date.parse('2026-10-10T13:00:00Z');
const ZONE = 'Europe/Berlin';

console.log('\n1. Zeit und Tag');
const ort = B.ortszeit(DIENSTAG_15, ZONE);
pruefe('Tag in Berlin', ort.tag === '2026-10-06', ort.tag);
pruefe('Minute in Berlin (15:00 = 900)', ort.minute === 900, String(ort.minute));
pruefe('Dienstag ist kein Wochenende', ort.wochenende === false);
pruefe('Samstag ist Wochenende', B.ortszeit(SAMSTAG_15, ZONE).wochenende === true);
pruefe('Zeitzone verschiebt den Tag (Kiritimati ist schon Mittwoch früh)',
  B.ortszeit(Date.parse('2026-10-06T23:00:00Z'), 'Pacific/Kiritimati').tag === '2026-10-07');
pruefe('Fenster über Mitternacht: 23:30 liegt in 22–7', B.imFenster(23 * 60 + 30, 22 * 60, 7 * 60));
pruefe('… 06:59 auch', B.imFenster(6 * 60 + 59, 22 * 60, 7 * 60));
pruefe('… 07:00 nicht mehr', !B.imFenster(7 * 60, 22 * 60, 7 * 60));
pruefe('dauerText', B.dauerText(4500) === '1 Std. 15 Min.' && B.dauerText(40) === '1 Min.' && B.dauerText(0) === '0 Min.');

console.log('\n2. Bildschirm → Bereich (echte Navigation)');
const faelle = [
  [['messenger', 'chats', null], 'chats'],
  [['messenger', 'friendmap', null], 'friendmap'],
  [['messenger', 'camera', null], 'storys'],
  [['messenger', 'profile', null], 'chats'],
  [['messenger', 'chats', 'chat'], 'chats'],
  [['communities', 'chats', 'chat'], 'communitys'],
  [['messenger', 'chats', 'call'], 'anrufe'],
  [['videos', 'home', 'story'], 'storys'],
  [['messenger', 'chats', 'insights'], 'storys'],
  [['videos', 'home', null], 'videos'],
  [['videos', 'portrait', null], 'videos'],
  [['videos', 'landscape', null], 'querformat'],
  [['videos', 'landscape', 'clip'], 'querformat'],
  [['videos', 'home', 'livestream'], 'live'],
  [['videos', 'search', null], 'suche'],
  [['videos', 'search', 'explorer'], 'suche'],
  [['communities', 'home', null], 'communitys'],
  [['communities', 'search', null], 'suche'],
  [['communities', 'home', 'community'], 'communitys'],
  [['settings', 'home', null], null],
];
for (const [[a, s, o], soll] of faelle) {
  const ist = B.bereichFuer(a, s, o);
  pruefe(`${a}/${s}${o ? ' + ' + o : ''} → ${soll}`, ist === soll, String(ist));
}
pruefe('Kamera aus dem Chat zählt zum Chat', B.bereichFuer('messenger', 'chats', 'camera', 'chat') === 'chats');
pruefe('Einstellungen werden nie gesperrt', B.status({ regeln: { gesamt: { werktag: 1 } }, nutzung: { videos: 9999 } }, null).offen);

console.log('\n3. Regeln prüfen und normalisieren');
pruefe('leere Regeln sind gültig', B.pruefen(B.normalisieren({})) === null);
pruefe('Limit ohne Minuten wird abgelehnt', B.pruefen({ bereiche: { videos: { modus: 'limit' } } }) !== null);
pruefe('unbekannter Bereich wird abgelehnt', B.pruefen({ bereiche: { kino: { modus: 'immer' } } }) !== null);
pruefe('Auszeit mit gleichem Beginn und Ende wird abgelehnt', B.pruefen({ auszeit: { an: true, von: '22:00', bis: '22:00' } }) !== null);
const norm = B.normalisieren({ bereiche: { videos: { modus: 'standard' }, chats: { modus: 'immer', werktag: 5 } }, unsinn: 1 });
pruefe('normalisieren wirft „standard" und Unbekanntes weg',
  !('videos' in norm.bereiche) && norm.bereiche.chats.modus === 'immer' && !('werktag' in norm.bereiche.chats) && !('unsinn' in norm));
pruefe('normalisiert besteht pruefen()', B.pruefen(norm) === null);

console.log('\n4. Sperre — Henriks Beispiel: Messenger immer, Videos 20 Min. pro Tag');
const regeln = {
  gesamt: { werktag: 60, wochenende: 120 },
  bereiche: {
    chats: { modus: 'immer' },
    anrufe: { modus: 'immer' },
    videos: { modus: 'limit', werktag: 20, wochenende: 40 },
    live: { modus: 'gesperrt' },
  },
};
const ein = (nutzung, freigaben = [], jetzt = DIENSTAG_15) => ({ regeln, nutzung, freigaben, jetzt, zeitzone: ZONE });

let st = B.status(ein({ videos: 19 * 60 }), 'videos');
pruefe('19 Min. Videos: offen, 1 Min. Rest, Hinweis an', st.offen && st.rest === 60 && st.hinweis && st.restGrund === 'limit', JSON.stringify(st));
st = B.status(ein({ videos: 14 * 60 }), 'videos');
pruefe('14 Min. Videos: offen, kein Hinweis (6 Min. Rest)', st.offen && !st.hinweis && st.rest === 360);
st = B.status(ein({ videos: 20 * 60 }), 'videos');
pruefe('20 Min. Videos: zu, Grund Limit, 15 Min. mehr möglich', !st.offen && st.grund === 'limit' && st.ziel === 'videos' && st.mehrMoeglich);
pruefe('… Querformat bleibt offen (nur genau der Bereich)', B.status(ein({ videos: 20 * 60 }), 'querformat').offen);
st = B.status(ein({ videos: 20 * 60 }, [], SAMSTAG_15), 'videos');
pruefe('am Samstag gilt das Wochenendlimit (40 Min.)', st.offen && st.rest === 20 * 60, JSON.stringify(st));
st = B.status(ein({}), 'live');
pruefe('Livestreams gesperrt, nur mit Code', !st.offen && st.grund === 'gesperrt' && !st.mehrMoeglich);
st = B.status(ein({ suche: 30 * 60, communitys: 30 * 60 }), 'storys');
pruefe('Tageslimit gesamt (60 Min.) erreicht → Storys zu', !st.offen && st.grund === 'gesamt' && st.ziel === 'gesamt');
pruefe('… Messenger-Chats bleiben offen (Immer erlaubt)', B.status(ein({ suche: 30 * 60, communitys: 30 * 60 }), 'chats').offen);
pruefe('„Immer erlaubt" zählt nicht zum Tageslimit gesamt', B.status(ein({ chats: 300 * 60 }), 'suche').offen);

console.log('\n5. Freigaben');
const mehr = [{ ziel: 'videos', art: 'mehr', minuten: 15, basis: 20 * 60, tag: '2026-10-06', created_at: '2026-10-06T12:50:00.000Z' }];
st = B.status(ein({ videos: 25 * 60 }, mehr), 'videos');
pruefe('nach „15 Min. mehr" wieder offen, 10 Min. Rest', st.offen && st.rest === 10 * 60, JSON.stringify(st));
st = B.status(ein({ videos: 35 * 60 }, mehr), 'videos');
pruefe('nach Ablauf wieder zu, „15 Min. mehr" nicht noch einmal', !st.offen && !st.mehrMoeglich);
const spaet = [{ ziel: 'videos', art: 'mehr', minuten: 15, basis: 40 * 60, tag: '2026-10-06', created_at: '2026-10-06T12:50:00.000Z' }];
pruefe('Freigabe gilt ab der Nutzung beim Freigeben (Limit mittags gesenkt)', B.status(ein({ videos: 41 * 60 }, spaet), 'videos').offen);
const gestern = [{ ziel: 'videos', art: 'mehr', minuten: 15, basis: 0, tag: '2026-10-05', created_at: '2026-10-05T12:00:00.000Z' }];
pruefe('eine Freigabe von gestern gilt heute nicht', !B.status(ein({ videos: 20 * 60 }, gestern), 'videos').offen);
const code = [{ ziel: 'live', art: 'code', minuten: null, basis: 0, tag: '2026-10-06', created_at: '2026-10-06T12:00:00.000Z' }];
pruefe('Code „für heute" öffnet den gesperrten Bereich', B.status(ein({ live: 600 }, code), 'live').offen && B.status(ein({ live: 600 }, code), 'live').rest === 50 * 60);
const code15 = [{ ziel: 'live', art: 'code', minuten: 15, basis: 0, tag: '2026-10-06', created_at: '2026-10-06T12:00:00.000Z' }];
st = B.status(ein({ live: 5 * 60 }, code15), 'live');
pruefe('Code 15 Min. für einen gesperrten Bereich: 10 Min. Rest', st.offen && st.rest === 600, JSON.stringify(st));

console.log('\n6. Auszeit');
const mitAuszeit = { ...regeln, auszeit: { an: true, von: '22:00', bis: '07:00' } };
const nacht = Date.parse('2026-10-06T21:30:00Z'); // 23:30 Berlin
st = B.status({ regeln: mitAuszeit, nutzung: {}, jetzt: nacht, zeitzone: ZONE }, 'suche');
pruefe('23:30: Auszeit, Suche zu', !st.offen && st.grund === 'auszeit' && st.mehrMoeglich);
pruefe('… Messenger-Chats offen (Immer erlaubt)', B.status({ regeln: mitAuszeit, nutzung: {}, jetzt: nacht, zeitzone: ZONE }, 'chats').offen);
st = B.status({ regeln: mitAuszeit, nutzung: {}, jetzt: Date.parse('2026-10-06T19:57:00Z'), zeitzone: ZONE }, 'suche');
pruefe('21:57: offen, Hinweis „in 3 Min. Auszeit"', st.offen && st.hinweis && st.restGrund === 'auszeit' && st.rest === 180, JSON.stringify(st));
pruefe('Hinweistext', B.hinweisText(st, 'suche') === 'In 3 Min. beginnt deine Auszeit', B.hinweisText(st, 'suche'));
const auszeitMehr = [{ ziel: 'auszeit', art: 'mehr', minuten: 15, basis: 0, tag: '2026-10-06', created_at: '2026-10-06T21:25:00.000Z' }];
pruefe('„15 Min. mehr" in der Auszeit hebt sie 15 Min. auf',
  B.status({ regeln: mitAuszeit, nutzung: {}, freigaben: auszeitMehr, jetzt: nacht, zeitzone: ZONE }, 'suche').offen);
st = B.status({ regeln: mitAuszeit, nutzung: {}, freigaben: auszeitMehr, jetzt: nacht + 15 * 60000, zeitzone: ZONE }, 'suche');
pruefe('… danach wieder zu, kein zweites Mal', !st.offen && !st.mehrMoeglich);

console.log('\n7. Lockerer (Eltern-Regeln)');
pruefe('gleich ist nicht lockerer', B.lockerer(regeln, regeln) === null);
pruefe('Videos 20 → 30 ist lockerer', B.lockerer(regeln, { ...regeln, bereiche: { ...regeln.bereiche, videos: { modus: 'limit', werktag: 30, wochenende: 40 } } }) !== null);
pruefe('Videos 20 → gesperrt ist strenger', B.lockerer(regeln, { ...regeln, bereiche: { ...regeln.bereiche, videos: { modus: 'gesperrt' } } }) === null);
pruefe('Live gesperrt → immer ist lockerer', B.lockerer(regeln, { ...regeln, bereiche: { ...regeln.bereiche, live: { modus: 'immer' } } }) !== null);
pruefe('Tageslimit entfernen ist lockerer', B.lockerer(regeln, { ...regeln, gesamt: {} }) !== null);
pruefe('Auszeit verkürzen ist lockerer', B.lockerer(mitAuszeit, { ...mitAuszeit, auszeit: { an: true, von: '23:00', bis: '07:00' } }) !== null);
pruefe('Auszeit verlängern ist strenger', B.lockerer(mitAuszeit, { ...mitAuszeit, auszeit: { an: true, von: '21:00', bis: '07:00' } }) === null);

console.log('\n8. Uhr (Messung)');
const uhr = B.uhr();
const t0 = 1_000_000;
uhr.setzen('videos', true, t0);
uhr.setzen('videos', false, t0 + 40_000); // App in den Hintergrund nach 40 s
uhr.setzen('videos', true, t0 + 100_000); // 60 s weg, dann zurück
uhr.setzen('chats', true, t0 + 110_000); // 10 s Videos, Wechsel zu Chats
let ab = uhr.abgeben(t0 + 125_000); // 15 s Chats
const s = Object.fromEntries(ab.map((x) => [x.bereich, x.sekunden]));
pruefe('nur sichtbare Zeit zählt: Videos 50 s, Chats 15 s', s.videos === 50 && s.chats === 15, JSON.stringify(s));
pruefe('nach dem Abgeben ist nichts mehr offen', Object.keys(uhr.offen(t0 + 125_000)).length === 0 || Math.round(uhr.offen(t0 + 125_000).chats || 0) === 0);
ab = uhr.abgeben(t0 + 125_000 + 500_000);
pruefe('mehr als 120 s je Bereich werden nicht abgegeben', ab[0].sekunden === 120, JSON.stringify(ab));
const u2 = B.uhr();
u2.setzen('suche', true, 0);
pruefe('am Stück: 30 Min.', u2.amStueck(30 * 60000) === 1800);
u2.setzen('suche', false, 30 * 60000);
u2.setzen('suche', true, 32 * 60000);
pruefe('2 Min. weg zählt nicht als Pause', u2.amStueck(33 * 60000) === 33 * 60);
u2.setzen('suche', false, 33 * 60000);
u2.setzen('suche', true, 40 * 60000);
pruefe('7 Min. weg ist eine Pause — die Uhr beginnt neu', u2.amStueck(41 * 60000) === 60);

console.log('\n9. Woche');
const w = B.woche([{ tag: '2026-10-06', bereich: 'videos', sekunden: 600 }, { tag: '2026-10-01', bereich: 'chats', sekunden: 60 }, { tag: '2026-09-20', bereich: 'chats', sekunden: 999 }], '2026-10-06');
pruefe('sieben Tage, ältester zuerst', w.length === 7 && w[0].tag === '2026-09-30' && w[6].tag === '2026-10-06');
pruefe('nur gemessene Werte, alter Tag fällt weg', w[6].gesamt === 600 && w[1].bereiche.chats === 60 && w.reduce((a, t) => a + t.gesamt, 0) === 660);
pruefe('Wochentage', w[6].wochentag === 'Di' && w[0].wochentag === 'Mi');

console.log('\n10. Texte');
pruefe('wertText gesamt', B.wertText('gesamt', regeln) === '1 Std. · Wochenende 2 Std.', B.wertText('gesamt', regeln));
pruefe('bereichWertText Limit', B.bereichWertText(regeln, 'videos') === '20 Min. · Wochenende 40 Min.', B.bereichWertText(regeln, 'videos'));
pruefe('bereichWertText Immer', B.bereichWertText(regeln, 'chats') === 'Immer erlaubt');
pruefe('Sperrtext Limit', B.sperrText({ grund: 'limit' }, 'videos').titel === 'Limit für Videos (Home & Hochformat) erreicht');

console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden`);
process.exit(fehler ? 1 : 0);
