#!/usr/bin/env node
/**
 * Kasten 12 (Feedback 21.09.2026): das Video-Profil.
 *
 *   12.1  Der gewählte Tab bleibt beim Öffnen/Schließen eines Beitrags und
 *         springt erst beim Verlassen über Ober- oder Unterleiste zurück.
 *   12.2  Der Nutzername steht mittig.
 *   12.3  Antippen des Spendenziels zeigt Einzelheiten und „Spenden".
 *   12.4  „Profil wechseln" bleibt im Video-Profil.
 *   12.5  „Profil bearbeiten" setzt ein neues Profilbild (Eimer media).
 *   12.6  Der grüne Punkt öffnet die Online-Sichtbarkeit.
 *   12.7  Playlist-Titelbild rund, aus einem Beitrag, gespeichert.
 *   12.8  Highlight-Titelbild aus einem Beitrag oder einem Foto.
 *   12.9  Ringfarben je Gattung einheitlich, verschieden, nach Prototyp.
 *
 * WAS DIESER LAUF KANN UND WAS NICHT
 *
 * Er braucht weder Server noch Datenbank noch Anmeldung: er rechnet die
 * gemeinsamen Regeln (gemeinsam/sammlungen.js, gemeinsam/spende.js) nach und
 * prüft im Quelltext beider Seiten, dass die Bausteine eingebaut sind. Ob
 * das Bild wirklich erscheint, beweist er NICHT — dafür braucht es
 * Simulator und Browser, und die Datenbankfelder aus den drei
 * Schemas 69–71 (profilbild, titelbild, spendenziel).
 *
 * Start:  node test/_kasten12.js
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const Sammlungen = require('../../gemeinsam/sammlungen');
const Spende = require('../../gemeinsam/spende');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};
const wirft = (fn) => {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
};

const APP = lies('app/App.tsx');
const VIDEO = lies('app/screens/videos/VideoProfileScreen.tsx');
const KOPF = lies('app/components/OwnProfileHead.tsx');
const FREMD = lies('app/screens/profile/UserProfileScreen.tsx');
const KARTE = lies('app/components/SpendeKarte.tsx');
const BILD = lies('app/components/ProfilbildWahl.tsx');
const AKTION = lies('app/lib/aktionen.ts');
const RUECK = lies('app/lib/rueckkehr.ts');
const WEB = lies('web/public/app.js');
const CSS = lies('web/public/styles.css');
const HTML = lies('web/public/index.html');
const SERVER = lies('web/server/app.js');
const API = lies('web/server/supabase-api.js');
const MODUL = lies('app/test/_modulquelle.js');

/** Den Rumpf einer CSS-Regel holen (erste Fundstelle). */
const regel = (selektor) => {
  const i = CSS.indexOf(selektor + ' {');
  const j = i < 0 ? CSS.indexOf(selektor + '{') : i;
  if (j < 0) return '';
  return CSS.slice(j, CSS.indexOf('}', j));
};

console.log('\nGemeinsame Bausteine');
pruefe('sammlungen.js und spende.js stehen in UMD_BAUSTEINE',
  /\['sammlungen', 'Sammlungen'\]/.test(MODUL) && /\['spende', 'Spende'\]/.test(MODUL));
pruefe('index.html bindet beide ein',
  HTML.includes('/gemeinsam/sammlungen.js') && HTML.includes('/gemeinsam/spende.js'));
pruefe('beide Dateien haben eine UMD-Hülle',
  ['sammlungen', 'spende'].every((d) => /typeof module === 'object'/.test(lies(`gemeinsam/${d}.js`))));

console.log('\n12.9  Ringfarben');
pruefe('Playlist rot wie im Prototyp (#FF0A0A)', Sammlungen.ringfarbe('playlist') === '#FF0A0A');
pruefe('Highlight orange wie im Prototyp (#FF990A)', Sammlungen.ringfarbe('highlight') === '#FF990A');
pruefe('Die beiden Gattungen unterscheiden sich', Sammlungen.ringfarbe('playlist') !== Sammlungen.ringfarbe('highlight'));
pruefe('Strich 4/45 des Durchmessers (64 → 6 px)', Sammlungen.ringstaerke(64) === 6 && Sammlungen.ringstaerke(45) === 4);
pruefe('App: eigenes Profil nimmt die Farbe aus dem Baustein',
  /ringfarbe\('playlist'\)/.test(VIDEO) && /ringfarbe\('highlight'\)/.test(VIDEO));
pruefe('App: fremdes Profil nimmt die Farbe aus dem Baustein', /ringfarbe\(s\.art\)/.test(FREMD));
pruefe('Website: ringStil() nimmt Farbe und Stärke aus dem Baustein',
  /function ringStil[\s\S]{0,200}Sammlungen\.ringfarbe\(art\)[\s\S]{0,80}Sammlungen\.ringstaerke/.test(WEB));
pruefe('Website: kein fest verdrahteter Farbverlauf mehr am Ring',
  !/highlight__ring[^{]*\{[^}]*linear-gradient/.test(CSS));
pruefe('Website: Ring ist rund', /border-radius:\s*50%/.test(regel('.highlight__ring')));

console.log('\n12.7 / 12.8  Titelbild');
const inhalte = [
  { created_at: '2026-09-01', post_id: 'a', posts: { thumbnail_url: 'A.jpg' } },
  { created_at: '2026-09-02', post_id: 'b', posts: { thumbnail_url: 'B.jpg' } },
  { created_at: '2026-09-03', story_id: 's', stories: { media_url: 'S.jpg' } },
];
pruefe('Ohne Wahl: ein Beitrag der Sammlung ist das Titelbild',
  ['A.jpg', 'B.jpg', 'S.jpg'].includes(Sammlungen.vorschaubild({}, inhalte)));
pruefe('Gewählter Beitrag gewinnt', Sammlungen.vorschaubild({ titel_post_id: 'a' }, inhalte) === 'A.jpg');
pruefe('Gewählte Story gewinnt', Sammlungen.vorschaubild({ titel_story_id: 's' }, inhalte) === 'S.jpg');
pruefe('Eigenes Foto gewinnt vor allem',
  Sammlungen.vorschaubild({ titelbild_url: 'F.jpg', titel_post_id: 'a' }, inhalte) === 'F.jpg');
pruefe('Leere Sammlung ohne Foto: kein Bild', Sammlungen.vorschaubild({}, []) === null);
const titelSchema = lies('SUPABASE_SCHEMA_70_titelbild.sql');
pruefe('Schema-Entwurf: Spalten, Prüfung auf Inhalt, idempotent',
  /titel_post_id/.test(titelSchema) && /titelbild_url/.test(titelSchema) &&
  /if not exists/i.test(titelSchema) && /create or replace function/i.test(titelSchema));
pruefe('App: Knopf „Titelbild wählen" im eigenen Profil', /testID="titelbild-waehlen"/.test(VIDEO));
pruefe('App: speichert über aktionen.titelbildSetzen', /export async function titelbildSetzen/.test(AKTION) && /titelbildSetzen/.test(VIDEO));
pruefe('Website: openTitelbildWahl mit Beitrag, Foto und Kamera',
  /function openTitelbildWahl/.test(WEB) && /id="titelFoto"/.test(WEB) && /id="titelKamera"/.test(WEB));
pruefe('Server: POST /api/eigene/sammlung/:id/titelbild', /\/api\/eigene\/sammlung\/:id\/titelbild/.test(SERVER));

console.log('\n12.3  Spendenziel');
const form = Spende.ausFormular({ titel: 'Neue Kamera', ziel: '250', frist: '31.12.2099', text: 'Für Clips' });
pruefe('Formular: Titel, Ziel, Frist, Text werden übernommen',
  form.ok && form.spende.ziel === 250 && form.spende.frist === '2099-12-31' && form.spende.text === 'Für Clips' && Boolean(form.spende.seit));
pruefe('Formular: Ziel bleibt freiwillig', Spende.ausFormular({ titel: 'Ohne Ziel' }).ok);
pruefe('Formular: Unsinn wird abgelehnt',
  !Spende.ausFormular({ titel: 'x', ziel: '-5' }).ok && !Spende.ausFormular({ titel: '' }).ok &&
  !Spende.ausFormular({ titel: 'x', frist: '32.13.2030' }).ok);
pruefe('Frist ungültig: fristAus wirft', wirft(() => Spende.fristAus('32.13.2030')));
const stand = Spende.stand({ titel: 'A', ziel: 100, seit: '2026-01-01' }, { summe_cent: 2500, spender: 3 });
pruefe('Stand: erreicht, Fortschritt, Spender aus den Buchungen',
  stand && stand.erreicht === 25 && stand.prozent === 25 && stand.spender === 3);
const alt = Spende.stand({ titel: 'A', ziel: 100, frist: '2020-01-01' }, null);
pruefe('Abgelaufene Frist wird erkannt', alt && alt.abgelaufen === true && Boolean(alt.fristText));
pruefe('Eigener Betrag: 2,50 → 250 Cent, 0,10 abgelehnt', Spende.centAus('2,50') === 250 && Spende.centAus('0,10') === null);
const spendeSchema = lies('SUPABASE_SCHEMA_71_spendenziel.sql');
pruefe('Schema-Entwurf: spendenstand() nur für angemeldete Nutzer',
  /function public\.spendenstand/i.test(spendeSchema) && /revoke[\s\S]*from public, anon/i.test(spendeSchema) &&
  /grant execute[\s\S]*to authenticated/i.test(spendeSchema));
pruefe('App: Karte, Detailblatt und Spenden-Knopf',
  /testID="spende-karte"/.test(KARTE) && /testID="spende-details"/.test(KARTE) && /testID="spende-knopf"/.test(KARTE));
pruefe('App: Karte im eigenen und im fremden Profil', /<SpendeKarte/.test(VIDEO) && /<SpendeKarte/.test(FREMD));
pruefe('Website: Karte ist ein Knopf und öffnet openSpendenziel',
  /data-spendeziel/.test(WEB) && /async function openSpendenziel/.test(WEB) && /id="spendeKnopf"/.test(WEB));
pruefe('Website: Karte auch im fremden Profil', /bindSpendeKarte\(overlay/.test(WEB));
pruefe('Server: GET /api/spendenstand/:userId', /app\.get\('\/api\/spendenstand\/:userId'/.test(SERVER));
pruefe('Server: Spende-Formular über Spende.ausFormular', /Spende\.ausFormular\(req\.body/.test(SERVER));

console.log('\n12.5  Profilbild');
const bildSchema = lies('SUPABASE_SCHEMA_69_profilbild.sql');
pruefe('Schema-Entwurf: avatar_url nur aus dem Eimer media',
  /avatar_url/.test(bildSchema) && /storage\/v1\/object\/public\/media\/avatars/.test(bildSchema));
pruefe('App: Kopf mit Mediathek, Kamera, Entfernen',
  /testID="profilbild-kopf"/.test(BILD) && /profilbild-mediathek/.test(BILD) && /profilbild-kamera/.test(BILD));
pruefe('App: „Profil bearbeiten" zeigt den Kopf', /kopf:\s*<ProfilbildKopf/.test(APP));
pruefe('App: Ordner avatars, gespeichert über profilbildSetzen',
  /'avatars'/.test(BILD) && /export async function profilbildSetzen/.test(AKTION));
pruefe('Website: kein Profilbild mehr nur im Browser (localStorage)',
  !/localStorage\.setItem\([^)]*eigenesProfilbild/.test(WEB));
pruefe('Website: Upload nach avatars und /api/eigene/profilbild',
  /ordner:\s*'avatars'/.test(WEB) && /\/api\/eigene\/profilbild/.test(WEB));
pruefe('Website: Avatare zeigen das Bild (personenAvatar)', /function personenAvatar/.test(WEB));
pruefe('Server: POST /api/eigene/profilbild prüft Pfad und Zeilenzahl',
  /app\.post\('\/api\/eigene\/profilbild'/.test(SERVER) && /avatars/.test(SERVER));
pruefe('Server: jeder Nutzer bringt sein Bild mit', /avatar/.test(API) && /function profilbilder/.test(API));
pruefe('Website: nur noch EIN bildVerkleinern (das zweite brach Storys)',
  (WEB.match(/function bildVerkleinern\s*\(/g) || []).length === 1);

console.log('\n12.1  Tab bleibt');
pruefe('App: Reiter liegt in der Shell, nicht im Bildschirm',
  /\[profilTab, setProfilTab\]/.test(APP) && /tab=\{profilTab\}/.test(APP));
pruefe('App: Beitrag öffnen merkt sich den Reiter', /profilBeitragOffen\.current\s*=\s*true/.test(APP));
pruefe('App: Verlassen setzt zurück', /function profilVerlassen|const profilVerlassen/.test(APP));
pruefe('Website: profilReiterPruefen bei Ober- und Unterleiste',
  (WEB.match(/profilReiterPruefen\(/g) || []).length >= 3);
pruefe('Website: Kacheln im Raster öffnen den Beitrag', /data-eigenkind/.test(WEB) && /profilBeitragOffen\s*=\s*true/.test(WEB));

console.log('\n12.2  Name mittig');
pruefe('App: Handle mit eigener Mitte (testID profil-handle)', /testID="profil-handle"/.test(KOPF));
const handle = regel('.oprof__handle');
const links = (handle.match(/left:\s*(\d+)px/) || [])[1];
const rechts = (handle.match(/right:\s*(\d+)px/) || [])[1];
pruefe('Website: .oprof__handle links und rechts gleich weit', Boolean(links) && links === rechts, `${links}/${rechts}`);

console.log('\n12.4  Profil wechseln');
pruefe('App: Video-Profil ruft den Wechsel selbst auf', /onSwitchAccount=\{\(\) => \{[\s\S]{0,120}Rueckkehr\.merken\(user\?\.id, 'videos', 'profile'\)/.test(APP));
{
  // rueckkehr.ts wirklich ausführen, nicht nur lesen: mit dem TypeScript der
  // App übersetzen (nur Typen werden importiert, die fallen weg).
  const ts = require(path.join(__dirname, '..', 'node_modules', 'typescript'));
  const js = ts.transpileModule(RUECK, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 } }).outputText;
  const R = { exports: {} };
  new Function('module', 'exports', 'require', js)(R, R.exports, require);
  const Rk = R.exports;
  Rk.merken('konto-a', 'videos', 'profile');
  pruefe('App: nach dem Wechsel landet ein anderes Konto im Video-Profil',
    JSON.stringify(Rk.abholen('konto-b')) === JSON.stringify({ area: 'videos', sub: 'profile' }));
  pruefe('App: zweimal abholen geht (StrictMode ruft den Initialisierer doppelt)', Rk.abholen('konto-b') !== null);
  pruefe('App: dasselbe Konto (Wechsel abgebrochen) springt nicht', Rk.abholen('konto-a') === null);
  const echt = Date.now;
  Date.now = () => echt() + 3 * 60_000;
  pruefe('App: nach drei Minuten gilt die Stelle nicht mehr', Rk.abholen('konto-b') === null);
  Date.now = echt;
  Rk.vergessen();
  pruefe('App: vergessen() räumt ab', Rk.abholen('konto-b') === null);
}
pruefe('App: Messenger und Einstellungen vergessen die Stelle vor dem Wechsel',
  (APP.match(/Rueckkehr\.vergessen\(\);/g) || []).length >= 2);
pruefe('App: neue Shell startet im Video-Profil', /Rueckkehr\.abholen\(user\?\.id\)/.test(APP));
pruefe('Website: #switchProfile öffnet den Wechsel im Video-Profil', /switchProfile[\s\S]{0,200}openKontoWechsel/.test(WEB));

console.log('\n12.6  Online-Punkt');
pruefe('App: grüner Punkt antippbar', /testID="online-punkt"/.test(KOPF));
pruefe('App: öffnet die Sichtbarkeit onlinestatus', /<SichtbarkeitSheet/.test(VIDEO) && /'onlinestatus'/.test(VIDEO));
pruefe('Website: #onlinePunkt öffnet openSichtbarkeit onlinestatus',
  /id="onlinePunkt"/.test(WEB) && /sichtbar:\s*'onlinestatus'/.test(WEB));

console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden.`);
process.exit(fehler === 0 ? 0 : 1);
