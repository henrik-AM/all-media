/**
 * Video-Storys: die gemeinsamen Grenzen — Kasten 15.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 01.10.2026: „Es sollen auch Video-Stories möglich sein." Bis
 * dahin passten drei Zahlen nicht zusammen: die App nahm bis 60 s auf, beide
 * Betrachter brachen nach 30 s ab, die Website konnte gar kein Video als
 * Story posten. Jetzt steht alles in gemeinsam/story.js — und dieser Lauf
 * hält fest, dass Aufnahme, Hochladen und Betrachter dieselbe Zahl nehmen
 * und dass sie zur Grenze des Speichers passt (SUPABASE_SCHEMA_23_audit.sql).
 *
 * Kein Browser, keine Datenbank, kein Konto: nur die Regeln und ein Blick in
 * den Code, ob beide Seiten sie auch benutzen.
 *
 * Start:  node test/_storyvideo_regeln.js
 */

const fs = require('fs');
const path = require('path');
const S = require('../../gemeinsam/story');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const lies = (...teile) => fs.readFileSync(path.join(__dirname, '..', '..', ...teile), 'utf8');

console.log('\nVideo-Storys — Regeln (Kasten 15)');

pruefe('Höchstlänge 60 s', S.VIDEO_SEKUNDEN_HOECHSTENS === 60);
pruefe('Betrachter-Obergrenze = Höchstlänge', S.DAUER_VIDEO_HOECHSTENS === S.VIDEO_SEKUNDEN_HOECHSTENS * 1000);

const schema23 = lies('SUPABASE_SCHEMA_23_audit.sql');
const grenze = Number((schema23.match(/file_size_limit\s*=\s*(\d+)/) || [])[1]);
pruefe('Größengrenze = file_size_limit des Eimers', grenze === S.VIDEO_BYTES_HOECHSTENS, `Eimer ${grenze}`);
for (const typ of S.VIDEO_TYPEN) {
  pruefe(`Eimer erlaubt ${typ}`, schema23.includes(`'${typ}'`));
}

pruefe('60,3 s geht durch (Kamera schneidet nicht genau)', S.videoPruefen({ sekunden: 60.3 }) === null);
pruefe('61 s wird abgewiesen', /60 Sekunden/.test(S.videoPruefen({ sekunden: 61 }) || ''));
pruefe('51 MB wird abgewiesen', /zu groß/.test(S.videoPruefen({ bytes: 51 * 1048576 }) || ''));
pruefe('MKV wird abgewiesen', /Videoformat/.test(S.videoPruefen({ mime: 'video/x-matroska' }) || ''));
pruefe('Unbekannte Länge geht durch', S.videoPruefen({ sekunden: null, bytes: undefined }) === null);
pruefe('MediaRecorder-Typ ohne Zusatz', S.videoTyp('video/webm;codecs=vp8,opus') === 'video/webm');
pruefe('Endungen', S.videoEndung('video/quicktime') === 'mov' && S.videoEndung('video/webm') === 'webm' && S.videoEndung('video/mp4') === 'mp4');
pruefe('Dauer Bild 6 s', S.storyDauer('image', 12) === S.DAUER_BILD);
pruefe('Dauer Video = Länge', S.storyDauer('video', 12.5) === 12500);
pruefe('Dauer Video gekappt', S.storyDauer('video', 300) === 60000);
pruefe('Dauer Video unbekannt = Obergrenze', S.storyDauer('video', Infinity) === 60000 && S.storyDauer('video', NaN) === 60000);

console.log('\nBenutzen beide Seiten die Regeln?');
const web = lies('web', 'public', 'app.js');
const server = lies('web', 'server', 'app.js') + lies('web', 'server', 'medien.js');
const kamera = lies('app', 'screens', 'messenger', 'CameraScreen.tsx');
const betrachter = lies('app', 'screens', 'messenger', 'StoryViewerScreen.tsx');
const aktionen = lies('app', 'lib', 'useAktionen.ts');

pruefe('Website: Story-Auswahl nimmt Videos', web.includes("'image/*,video/*'") && web.includes('storyMediumHolen'));
pruefe('Website: Video geht roh hoch', web.includes('/api/hochladen/video'));
pruefe('Website: Aufnahme endet nach Höchstlänge', web.includes('StoryRegeln.VIDEO_SEKUNDEN_HOECHSTENS * 1000'));
pruefe('Website: Betrachter rechnet mit storyDauer', web.includes("StoryRegeln.storyDauer('video'"));
pruefe('Website: kein fester Lautsprecher-Knopf mehr', !web.includes('id="storyTon"'));
pruefe('Server: Endpunkt mit Grenze des Eimers', server.includes("'/api/hochladen/video'") && server.includes('StoryRegeln.VIDEO_BYTES_HOECHSTENS'));
pruefe('App: Kamera nimmt höchstens die gemeinsame Länge auf', kamera.includes('maxDuration: StoryRegeln.VIDEO_SEKUNDEN_HOECHSTENS'));
pruefe('App: Galerie-Video wird geprüft', kamera.includes('StoryRegeln.videoPruefen'));
pruefe('App: Betrachter rechnet mit storyDauer', betrachter.includes("StoryRegeln.storyDauer('video'"));
pruefe('App: Hochladen kennt die Größengrenze', aktionen.includes('StoryRegeln.VIDEO_BYTES_HOECHSTENS'));

console.log(`\n${geprueft - fehler}/${geprueft} bestanden`);
process.exit(fehler ? 1 : 0);
