/**
 * Stummschalter und stummgeschaltete Konten (Kasten 20, 01.10.2026).
 *
 * Henrik: „Wenn das iPhone stumm geschaltet ist, sollst du auch keine lauten
 * Benachrichtigungen bekommen." und „Stummgeschaltete Konten lösen keine
 * Nachrichten aus."
 *
 * WAS GEPRÜFT WIRD (nur Quelltext, ohne Netz und ohne Gerät)
 *
 *   1. App: Grundzustand lässt den Stummschalter gelten (playsInSilentMode
 *      false), der Nachrichtenton stellt ihn vor jedem Ton neu her und
 *      schweigt, solange ein Video mit Ton oder die Hörprobe läuft; die
 *      Hörprobe setzt den Wiedergabemodus selbst.
 *   2. Website: der Ton ist unverändert (Browser kennen keinen Stummschalter).
 *   3. Weder App noch Website spielen einen Ton oder zeigen einen Hinweis bei
 *      EINGEHENDEN Nachrichten — es gibt also nichts, was ein stummer Chat
 *      unterdrücken müsste. Kommt so etwas dazu, schlägt diese Prüfung an.
 *   4. Schema-Entwurf: mitteilung_anlegen und benachrichtige fragen Konto-,
 *      Community- und Chat-Stummschaltung ab; kein EXECUTE für PUBLIC/anon.
 *
 * WAS SICH SO NICHT PRÜFEN LÄSST
 *
 * Ob der Ton bei eingeschaltetem Stummschalter wirklich schweigt: der
 * Simulator hat keinen Stummschalter. Das geht nur auf einem echten iPhone.
 * Ob die Glocke von stummen Konten leer bleibt: erst nach dem Einspielen des
 * Entwurfs, mit zwei Testkonten (_mitteilungen.js wäre der Ort dafür).
 *
 * Start: node test/_stumm.js
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const ohneKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

console.log('\n1. App: Stummschalter');
const modus = ohneKommentar(lies('app/lib/tonModus.ts'));
const grund = modus.slice(modus.indexOf('export const tonModusSetzen'), modus.indexOf('export const wiedergabeModusSetzen'));
pruefe('Grundzustand: playsInSilentMode false', /playsInSilentMode:\s*false/.test(grund) && !/playsInSilentMode:\s*true/.test(grund));
const wiedergabe = modus.slice(modus.indexOf('export const wiedergabeModusSetzen'), modus.indexOf('const laufend'));
pruefe('Wiedergabemodus: playsInSilentMode true, keine Aufnahme',
  /playsInSilentMode:\s*true/.test(wiedergabe) && /allowsRecording:\s*false/.test(wiedergabe));
pruefe('Hinweiston schweigt, solange etwas mit Ton läuft', /if \(wiedergabeLaeuft\(\)\) return false;/.test(modus));
const toene = ohneKommentar(lies('app/lib/toene.ts'));
pruefe('Nachrichtenton stellt vor dem Abspielen den Grundzustand her',
  /await hinweistonModus\(\)/.test(toene) && toene.indexOf('hinweistonModus()') < toene.indexOf('.play()'));
const explorer = ohneKommentar(lies('app/screens/videos/ExplorerScreen.tsx'));
pruefe('Hörprobe setzt den Wiedergabemodus selbst', explorer.includes('await wiedergabeModusSetzen()'));
pruefe('Hörprobe meldet sich als laufend an', /aktiveWiedergabe\(schluessel, laeuft\)/.test(explorer));
pruefe('Kein anderer Bildschirm setzt playsInSilentMode: true',
  !/setAudioModeAsync\(\{\s*playsInSilentMode:\s*true/.test(explorer));
const video = ohneKommentar(lies('app/components/Videoflaeche.tsx'));
pruefe('Video mit Ton meldet sich als laufend an', /aktiveWiedergabe\(kennung, hoerbar\)/.test(video) && /laeuft && !stumm/.test(video));
pruefe('App-Start setzt den Grundzustand', lies('app/App.tsx').includes('tonModusSetzen();'));

console.log('\n2. Website: unverändert');
const web = lies('web/public/app.js');
const webTon = web.slice(web.indexOf('function nachrichtTon()'), web.indexOf('function nachrichtTon()') + 400);
pruefe('Website spielt den Sendeton weiter nur nach dem Schalter „Töne"', webTon.includes("schalterAn('toene')") && webTon.includes("new Audio('/nachricht.wav')"));

console.log('\n3. Kein Ton und kein Hinweis bei eingehenden Nachrichten');
const appQuellen = ['app/App.tsx', 'app/contexts/ProfilContext.tsx', 'app/contexts/DatenContext.tsx', 'app/screens/messenger/ChatDetailScreen.tsx', 'app/screens/messenger/ChatListScreen.tsx']
  .map(lies).map(ohneKommentar).join('\n');
pruefe('App: nachrichtTon nur beim Senden (ChatDetailScreen.send)',
  (appQuellen.match(/nachrichtTon\(\)/g) || []).length === 1 && /const send = async[\s\S]{0,400}nachrichtTon\(\)/.test(appQuellen));
pruefe('App: keine Echtzeit-Horcher auf neue Nachrichten', !/postgres_changes/.test(appQuellen));
const webOhne = ohneKommentar(web);
pruefe('Website: nachrichtTon nur an einer Stelle gerufen', (webOhne.match(/\bnachrichtTon\(\);/g) || []).length === 1);
pruefe('Website: keine Echtzeit-Horcher, keine Browser-Mitteilungen', !/postgres_changes|new Notification\(/.test(webOhne));

console.log('\n4. Schema-Entwurf: stumm → keine Mitteilung');
const datei = fs.readdirSync(WURZEL).find((d) => /^SUPABASE_SCHEMA_\w+_stumm_mitteilungen\.sql$/.test(d));
pruefe('Entwurf vorhanden', !!datei, datei || '');
if (datei) {
  const sql = lies(datei);
  pruefe('Konto stumm (mutes)', /from public\.mutes m\s+where m\.user_id = p_an and m\.muted_user_id = p_von/.test(sql));
  pruefe('Community stumm (community_members.is_muted)', /community_members cm[\s\S]{0,120}cm\.is_muted/.test(sql));
  pruefe('Chat stumm (chat_members.is_muted)', /chat_members ch[\s\S]{0,120}ch\.is_muted/.test(sql));
  pruefe('mitteilung_anlegen fragt die Regel ab', /function public\.mitteilung_anlegen[\s\S]*?mitteilung_stumm\(p_an, p_von, p_zielart, p_ziel\)[\s\S]*?insert into public\.notifications/.test(sql));
  pruefe('benachrichtige fragt die Regel ab', /function public\.benachrichtige[\s\S]*?mitteilung_stumm\(empfaenger, ausloeser, ziel_typ, ziel_id\)[\s\S]*?insert into public\.notifications/.test(sql));
  const funktionen = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
  const ohneRevoke = funktionen.filter((f) => !new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\)\\s+from public, anon, authenticated`).test(sql));
  pruefe(`Jede der ${funktionen.length} Funktionen verliert EXECUTE für PUBLIC/anon/authenticated`, ohneRevoke.length === 0, ohneRevoke.join(', '));
}

console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden.`);
process.exit(fehler === 0 ? 0 : 1);
