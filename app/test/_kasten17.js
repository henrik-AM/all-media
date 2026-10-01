#!/usr/bin/env node
/**
 * Kasten 17 (Henrik 01.10.2026): Playlists und Highlights öffnen.
 *
 *   17.1  Highlight antippen (eigenes und fremdes Profil, App und Website)
 *         → die Storys laufen im vorhandenen Story-Betrachter ab, wie bei
 *         Instagram. Eigenes Highlight: Bearbeiten/Herausnehmen/Löschen.
 *   17.2  Playlist antippen → Ordneransicht: Titel, „Playlist · N Beiträge",
 *         Raster nur mit diesen Beiträgen; im fremden Profil ohne Verwaltung.
 *   17.3  Der Besitzer ordnet jeden eigenen Beitrag selbst einer Playlist zu
 *         (Drei-Punkte-Menü „Zu Playlist hinzufügen", Liste + „Neue
 *         Playlist") und nimmt ihn wieder heraus; Story → Highlight analog.
 *
 * WAS DIESER LAUF KANN UND WAS NICHT
 *
 * Wie _kasten12.js: kein Server, keine Datenbank, keine Anmeldung. Er rechnet
 * die gemeinsamen Regeln nach (gemeinsam/sammlungen.js) und prüft im
 * Quelltext beider Seiten, dass die Wege eingebaut sind. Ob der Betrachter
 * wirklich abspielt und das Häkchen wirklich gespeichert wird, beweist er
 * NICHT — dafür _profil.js / _feinschliff.js (Website) und der Simulator.
 *
 * Start:  node test/_kasten17.js
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const Sammlungen = require('../../gemeinsam/sammlungen');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

const VIDEO = lies('app/screens/videos/VideoProfileScreen.tsx');
const FREMD = lies('app/screens/profile/UserProfileScreen.tsx');
const BETRACHTER = lies('app/screens/messenger/StoryViewerScreen.tsx');
const HL = lies('app/components/HighlightBetrachter.tsx');
const ORDNER = lies('app/components/SammlungOrdner.tsx');
const ZUORDNEN = lies('app/components/SammlungZuordnen.tsx');
const BEITRAG = lies('app/components/BeitragOptionenSheet.tsx');
const STORYOPT = lies('app/components/StoryOptionenSheet.tsx');
const AKTION = lies('app/lib/aktionen.ts');
const WEB = lies('web/public/app.js');
const SERVER = lies('web/server/app.js');

console.log('\nGemeinsame Regeln (gemeinsam/sammlungen.js)');
pruefe('Untertitel Playlist, Mehrzahl', Sammlungen.untertitel('playlist', 3) === 'Playlist · 3 Beiträge');
pruefe('Untertitel Playlist, Einzahl', Sammlungen.untertitel('playlist', 1) === 'Playlist · 1 Beitrag');
pruefe('Untertitel Highlight nennt Storys', Sammlungen.untertitel('highlight', 2) === 'Highlight · 2 Storys');
pruefe('Untertitel Highlight, Einzahl', Sammlungen.untertitel('highlight', 1) === 'Highlight · 1 Story');
pruefe('Untertitel leer', Sammlungen.untertitel('playlist', 0) === 'Playlist · 0 Beiträge');

const jetzt = Date.parse('2026-10-01T12:00:00Z');
const vor = (ms) => new Date(jetzt - ms).toISOString();
const MIN = 60_000;
pruefe('Alter: gerade eben', Sammlungen.storyAlter(vor(10_000), jetzt) === 'gerade eben');
pruefe('Alter: Minuten', Sammlungen.storyAlter(vor(5 * MIN), jetzt) === 'vor 5 Min.');
pruefe('Alter: Stunden', Sammlungen.storyAlter(vor(3 * 60 * MIN), jetzt) === 'vor 3 Std.');
pruefe('Alter: ein Tag', Sammlungen.storyAlter(vor(26 * 60 * MIN), jetzt) === 'vor 1 Tag');
pruefe('Alter: Tage', Sammlungen.storyAlter(vor(3 * 24 * 60 * MIN), jetzt) === 'vor 3 Tagen');
pruefe('Alter: Wochen', Sammlungen.storyAlter(vor(15 * 24 * 60 * MIN), jetzt) === 'vor 2 Wochen');
pruefe('Alter: Datum ab vier Wochen', /^\d\d\.\d\d\.2026$/.test(Sammlungen.storyAlter(vor(40 * 24 * 60 * MIN), jetzt)));
pruefe('Alter: kein Datum → leer', Sammlungen.storyAlter(null, jetzt) === '');

const zeile = {
  id: 's1',
  user_id: 'u-fremd',
  media_url: 'https://x/storage/v1/object/public/media/stories/a.mp4',
  media_type: 'video',
  caption: 'Hallo',
  created_at: '2026-09-01T10:00:00Z',
  overlays: { texte: [] },
  profiles: { name: 'Anna Beispiel' },
};
const fremd = Sammlungen.alsHighlightStory(zeile, { ichId: 'ich', gemocht: new Set(['s1']) });
pruefe('Story: fremd, Kennung bleibt', fremd.userId === 'u-fremd' && fremd.own === false);
pruefe('Story: Vorname wie in der Leiste', fremd.name === 'Anna');
pruefe('Story: Video bleibt Video', fremd.mediaType === 'video');
pruefe('Story: gemocht', fremd.liked === true);
pruefe('Story: Zeitpunkt für den Kopf', fremd.aufgenommen === '2026-09-01T10:00:00Z');
const eigen = Sammlungen.alsHighlightStory({ ...zeile, user_id: 'ich' }, { ichId: 'ich' });
pruefe('Story: eigene heißt „me" wie in der Leiste', eigen.userId === 'me' && eigen.own === true);

console.log('\n17.1  Highlight im Story-Betrachter');
pruefe('App: kein neuer Betrachter — HighlightBetrachter nutzt StoryViewerScreen',
  /<StoryViewerScreen/.test(HL) && !/Animated\.timing/.test(HL));
pruefe('App: Betrachter kennt den Highlight-Modus', /highlight\?: HighlightModus/.test(BETRACHTER));
pruefe('App: Name des Highlights im Kopf', /highlight\.name\} · \$\{alter\(\)\}/.test(BETRACHTER));
pruefe('App: eigenes Highlight — Bearbeiten, Herausnehmen, Löschen',
  /Highlight bearbeiten/.test(BETRACHTER) && /Aus Highlight entfernen/.test(BETRACHTER) && /Highlight löschen/.test(BETRACHTER));
pruefe('App: eigenes Profil spielt Highlights ab', /art === 'highlight'\) return highlightAbspielen/.test(VIDEO));
pruefe('App: fremdes Profil spielt Highlights ab', /highlightStorys\(supabase, s\.id, ichId\)/.test(FREMD) && /<HighlightBetrachter/.test(FREMD));
pruefe('App: fremdes Profil zeigt keinen Hinweis mehr statt der Sammlung',
  !/onNotice\(`\$\{s\.art === 'playlist' \? 'Playlist' : 'Highlight'\} „\$\{s\.name\}"`\)/.test(FREMD));
pruefe('App: Storys des Highlights über sammlung_inhalte', /export async function highlightStorys/.test(AKTION));
pruefe('Website: Highlight-Kreis spielt ab', /if \(sml\.art === 'highlight'\) return highlightAbspielen\(sml\)/.test(WEB));
pruefe('Website: openStory nimmt eine eigene Liste', /function openStory\(storyId, \{[^}]*liste: eigeneListe, highlight = null, danach = null \}/.test(WEB));
pruefe('Website: fremdes Profil kommt nach dem Schließen zurück', /danach: eigen \? null : \(\) => openProfile\(sml\.userId, 'oeffentlich'\)/.test(WEB));
pruefe('Website: Highlight-Optionen im Betrachter', /data-hlopt="bearbeiten"/.test(WEB) && /data-hlopt="entfernen"/.test(WEB) && /data-hlopt="loeschen"/.test(WEB));
pruefe('Server: GET /api/sammlung/:id/storys', /app\.get\('\/api\/sammlung\/:id\/storys'/.test(SERVER));
pruefe('Server und App bauen die Story mit derselben Regel',
  /Sammlungen\.alsHighlightStory/.test(SERVER) && /SammlungRegel\.alsHighlightStory/.test(AKTION));

console.log('\n17.2  Playlist als Ordner');
pruefe('App: Ordner mit Untertitel aus der gemeinsamen Regel', /SammlungRegel\.untertitel\(/.test(ORDNER));
pruefe('App: eigenes Profil nutzt den Ordner', /<SammlungOrdner/.test(VIDEO));
pruefe('App: fremdes Profil nutzt den Ordner — ohne kopfRechts',
  /<SammlungOrdner[\s\S]{0,400}\/>/.test(FREMD) && !/<SammlungOrdner[^>]*kopfRechts/.test(FREMD));
pruefe('App: Kachel im fremden Ordner öffnet den Beitrag', /onKachel=\{\(k\) => \{\s*setOrdner\(null\);\s*onOpenKachel\?\.\(k\);/.test(FREMD));
pruefe('App: Story-Kachel im Ordner hatte mediaUri statt mediaUrl (behoben)',
  /kind: 'story', mediaUrl: z\.stories\.media_url/.test(AKTION));
pruefe('Website: Untertitel aus der gemeinsamen Regel', /Sammlungen\.untertitel\(art, liste\.length\)/.test(WEB));
pruefe('Website: Löschen und Titelbild nur im eigenen Ordner', /userId === 'me' && id\s*\? `<button class="iconbtn" id="titelbildWaehlen"/.test(WEB));

console.log('\n17.3  Selbst einordnen und herausnehmen');
pruefe('App: „Zu Playlist hinzufügen" nur am eigenen Beitrag',
  /eigener && !beitrag\.live\s*\? \[\{ key: 'playlist', label: 'Zu Playlist hinzufügen'/.test(BEITRAG));
pruefe('App: Playlist-Wahl im selben Blatt', /<SammlungZuordnen art="playlist"/.test(BEITRAG));
pruefe('App: „Zu Highlight hinzufügen" an der eigenen Story',
  /key: 'highlight', label: 'Zu Highlight hinzufügen'/.test(STORYOPT) && /<SammlungZuordnen art="highlight"/.test(STORYOPT));
pruefe('App: Häkchen schaltet hinein und heraus', /ausSammlung\(supabase, s\.id, stueck\)/.test(ZUORDNEN) && /inSammlung\(supabase, s\.id, stueck\)/.test(ZUORDNEN));
pruefe('App: „Neue Playlist" legt an und legt hinein', /neueSammlungMit\(/.test(ZUORDNEN));
pruefe('App: langes Drücken im eigenen Ordner nimmt heraus', /onLangDruck=\{\(k\) =>/.test(VIDEO));
pruefe('Website: „Zu Playlist hinzufügen" im Drei-Punkte-Menü',
  /eigener && !beitrag\.live \? \[\{ key: 'playlist', label: 'Zu Playlist hinzufügen'/.test(WEB) && /was === 'playlist'\) return openZuordnen/.test(WEB));
pruefe('Website: „Zu Highlight hinzufügen" an der eigenen Story', /was === 'highlight'\) return openZuordnen\(\{ storyId: story\.id \}/.test(WEB));
pruefe('Website: langes Drücken im eigenen Raster bietet keine Highlights mehr an', !/data-sml=/.test(WEB));
pruefe('Server: Zuordnung lesen, hinein, heraus, neu',
  /app\.get\('\/api\/eigene\/zuordnung'/.test(SERVER) &&
    /app\.post\('\/api\/eigene\/sammlungsinhalt\/:id'/.test(SERVER) &&
    /app\.delete\('\/api\/eigene\/sammlungsinhalt\/:id'/.test(SERVER) &&
    /app\.post\('\/api\/eigene\/sammlung-neu'/.test(SERVER));
pruefe('Server: nur Eigenes lässt sich einordnen', /Einordnen kannst du nur Eigenes/.test(SERVER));
pruefe('Server: Löschen prüft die Zahl der gelöschten Zeilen (RLS)',
  /app\.delete\('\/api\/eigene\/sammlungsinhalt\/:id'[\s\S]{0,700}if \(!data\?\.length\)/.test(SERVER));
{
  // Die DELETE-Route darf nicht unter /api/eigene/sammlung/:art/:name fallen.
  const alt = SERVER.indexOf("app.delete('/api/eigene/sammlung/:art/:name'");
  pruefe('Server: kein Pfad, den DELETE /api/eigene/sammlung/:art/:name verschluckt',
    alt >= 0 && !/app\.delete\('\/api\/eigene\/sammlung\/:id\//.test(SERVER));
}

console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden.`);
process.exit(fehler === 0 ? 0 : 1);
