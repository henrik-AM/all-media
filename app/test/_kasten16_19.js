#!/usr/bin/env node
/**
 * Kasten 16 und 19 (Feedback, 01.10.2026): die Oberflächen.
 *
 *   16  Eine Story-Markierung landet als Hinweis-Karte im Chat zwischen den
 *       beiden (Schema 75: messages.hinweis = 'story_markierung').
 *   19  Likes-Sichtbarkeit: neue Stufe „Nur Follower“ nur bei den Likes,
 *       der Ersteller sieht jedes Like (Schema 76).
 *
 * WAS DIESER LAUF KANN UND WAS NICHT
 *
 * Er braucht weder Server noch Datenbank noch Anmeldung: er rechnet die
 * gemeinsamen Regeln (gemeinsam/story.js, gemeinsam/sichtbarkeit.js) nach
 * und prüft im Quelltext beider Seiten, dass sie eingebaut sind. Ob die
 * Karte im Chat wirklich erscheint, beweist er NICHT — dafür braucht es zwei
 * Konten, Simulator und Browser. Ob „Nur Follower“ wirkt, prüft
 * test:likes (_likes_sichtbarkeit.js) mit zwei Konten.
 *
 * Start:  node test/_kasten16_19.js
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const StoryRegeln = require('../../gemeinsam/story');
const Sichtbarkeit = require('../../gemeinsam/sichtbarkeit');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

const CHAT = lies('app/screens/messenger/ChatDetailScreen.tsx');
const MENUE = lies('app/components/NachrichtSheet.tsx');
const APP = lies('app/App.tsx');
const DATEN = lies('app/lib/daten.ts');
const BLATT = lies('app/components/SichtbarkeitSheet.tsx');
const EINST = lies('app/screens/profile/SettingsScreen.tsx');
const WEB = lies('web/public/app.js');
const CSS = lies('web/public/styles.css');
const HTML = lies('web/public/index.html');
const API = lies('web/server/supabase-api.js');
const SYNC = lies('web/server/sync-handlers.js');
const SPALTEN = lies('gemeinsam/spalten.js');
const MODUL = lies('app/test/_modulquelle.js');

console.log('\n16  Gemeinsame Sätze (gemeinsam/story.js)');
pruefe('Empfänger: „Anna hat dich in einer Story markiert“',
  StoryRegeln.markierungSatz(false, 'Anna') === 'Anna hat dich in einer Story markiert');
pruefe('Absender: „Du hast Anna in einer Story markiert“',
  StoryRegeln.markierungSatz(true, 'Anna') === 'Du hast Anna in einer Story markiert');
pruefe('Chatliste Empfänger: „Hat dich in einer Story markiert“',
  StoryRegeln.markierungVorschau(false) === 'Hat dich in einer Story markiert');
pruefe('Abgelaufen: „Story nicht mehr verfügbar“',
  StoryRegeln.STORY_NICHT_VERFUEGBAR === 'Story nicht mehr verfügbar');
pruefe('istMarkierungsHinweis erkennt nur story_markierung',
  StoryRegeln.istMarkierungsHinweis({ hinweis: 'story_markierung' }) &&
    !StoryRegeln.istMarkierungsHinweis({ hinweis: null }) &&
    !StoryRegeln.istMarkierungsHinweis(null));

console.log('\n16  Laden');
pruefe('NACHRICHT_SPALTEN holt hinweis', /' hinweis,'/.test(SPALTEN));
pruefe('App: ladeNachrichten setzt hinweis', /hinweis: StoryRegeln\.istMarkierungsHinweis\(n\)/.test(DATEN));
pruefe('Website-Server: setzt hinweis', /hinweis: StoryRegeln\.istMarkierungsHinweis\(n\)/.test(API));
pruefe('App: Chatliste nennt die Markierung statt leerer Zeile',
  /StoryRegeln\.markierungVorschau\(vorschau\.sender_id === ichId\)/.test(DATEN));
pruefe('Website-Server: Chatliste nennt die Markierung',
  /StoryRegeln\.markierungVorschau\(vorschau\.sender_id === nutzerId\)/.test(API));
pruefe('Story-Einbettung trägt mediaType (Standbild/Video)',
  /mediaType: n\.stories\.media_type === 'video'/.test(DATEN) && /mediaType: n\.stories\.media_type === 'video'/.test(API));

console.log('\n16.4  Karte statt Blase');
pruefe('App: eigene Karte für story_markierung', /item\.hinweis === 'story_markierung'/.test(CHAT) && /testID="story-markierung-karte"/.test(CHAT));
pruefe('App: Karte ohne Story ist nicht antippbar', /disabled=\{!s\}/.test(CHAT));
pruefe('App: Karte öffnet die Story über onOpenStory', /onOpenStory\(s\)/.test(CHAT) && /onOpenStory=\{\(s\) =>/.test(APP));
pruefe('App: Schließen der Story führt zurück in den Chat', /setOverlay\(overlay\.zurueck \?\? null\)/.test(APP));
pruefe('App: Menü ohne Antworten/Zitieren/Weiterleiten bei Hinweisen',
  /hinweis=\{!!gewaehlt\?\.hinweis\}/.test(CHAT) && /\.\.\.\(hinweis\s*\?\s*\[\]/.test(MENUE));
pruefe('Website: eigene Karte für story_markierung',
  /istMarkierungsHinweis\(m\)\) \{/.test(WEB) && /data-testid="story-markierung-karte"/.test(WEB));
pruefe('Website: Karte öffnet die Story mit Ersatz aus der Einbettung',
  /openStory\(m\.story\.id, \{ ersatz: m\.story \}\)/.test(WEB) && /function openStory\(storyId, \{ bereich, ersatz[,}]/.test(WEB));
pruefe('Website: Menü ohne Antworten/Zitieren/Weiterleiten bei Hinweisen',
  /const hinweis = window\.StoryRegeln\.istMarkierungsHinweis\(m\);/.test(WEB));
pruefe('Website: CSS für die Karte', CSS.includes('.msg__hinweis {'));

console.log('\n16  Chat-Anfrage mit Markierung');
pruefe('App: Anfrage-Leiste kennt die Markierung', (CHAT.match(/markierungAnfrageText\(/g) || []).length === 2);
pruefe('Website: Anfrage-Leiste kennt die Markierung', (WEB.match(/markierungAnfrageText\(/g) || []).length === 2);

console.log('\n19  Stufen (gemeinsam/sichtbarkeit.js)');
const likes = Sichtbarkeit.stufenFuer('likes').map((s) => s.key);
pruefe('Likes: fünf Stufen, „Nur Follower“ zwischen den vorhandenen',
  JSON.stringify(likes) === JSON.stringify(['niemand', 'niemand_bis_auf', 'nur_follower', 'alle_bis_auf', 'alle']),
  likes.join(','));
for (const b of ['standort', 'story', 'repost', 'onlinestatus', 'ptt', 'download', 'dm']) {
  pruefe(`${b}: kein „Nur Follower“`, !Sichtbarkeit.stufenFuer(b).some((s) => s.key === 'nur_follower'));
}
pruefe('Name „Nur Follower“', Sichtbarkeit.stufeName('nur_follower') === 'Nur Follower');
pruefe('„Nur Follower“ zeigt keine Ausnahmezahl', Sichtbarkeit.stufeText('nur_follower', 3) === 'Nur Follower');
pruefe('„Alle bis auf …“ zeigt die Zahl', Sichtbarkeit.stufeText('alle_bis_auf', 2) === 'Alle bis auf … (2)');
pruefe('Server-Regel: nur_follower bei likes erlaubt, bei story nicht',
  Sichtbarkeit.stufeErlaubt('likes', 'nur_follower') && !Sichtbarkeit.stufeErlaubt('story', 'nur_follower'));
pruefe('Ersteller-Hinweis (19.1)', /sieht dein Like immer/.test(Sichtbarkeit.LIKES_ERSTELLER_HINWEIS));

console.log('\n19  Eingebaut');
pruefe('sichtbarkeit.js in UMD_BAUSTEINE', /\['sichtbarkeit', 'Sichtbarkeit'\]/.test(MODUL));
pruefe('index.html bindet sichtbarkeit.js ein', HTML.includes('/gemeinsam/sichtbarkeit.js'));
pruefe('Server prüft über stufeErlaubt', /Sichtbarkeit\.stufeErlaubt\(bereich, stufe\)/.test(SYNC));
pruefe('App-Blatt: Stufen je Bereich und Ersteller-Hinweis',
  /stufenFuer\(bereich/.test(BLATT) && /LIKES_ERSTELLER_HINWEIS/.test(BLATT));
pruefe('App-Einstellungen reichen den Bereich ans Blatt', /bereich=\{sichtOffen\.sichtbar\}/.test(EINST));
pruefe('Website-Blatt: Stufen je Bereich und Ersteller-Hinweis',
  /Sichtbarkeit\.stufenFuer\(bereich\)/.test(WEB) && /LIKES_ERSTELLER_HINWEIS/.test(WEB));
pruefe('Website-Zusammenfassung über stufeText', /window\.Sichtbarkeit\.stufeText\(/.test(WEB));

console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden.`);
process.exit(fehler === 0 ? 0 : 1);
