#!/usr/bin/env node
/**
 * Kasten RS 3 — Melden und Moderation (DSA Art. 16, 17, 20; Schema 102).
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  App im Quelltext: jede Meldestelle hängt am Melden-Blatt mit der
 *      richtigen Art (Story mit Story-ID, nicht mit dem Profil), Einstellungen
 *      speichern „Problem melden" wirklich, Kontostatus, Rechtsmitteilungen.
 *   L  App-LOGIK ohne Netz: lib/aktionen.ts und lib/krypto.ts werden mit tsc
 *      übersetzt und gegen einen nachgebauten Supabase-Client ausgeführt —
 *      inhalt_melden mit den richtigen Feldern, alter Weg NUR bei fehlender
 *      Funktion (42883/PGRST202), „update" für Arten ohne alten Weg, Beleg einer
 *      ECHT verschlüsselten Nachricht (Sitzungsschlüssel, nie Gerätschlüssel).
 *   B  Website im Prüfbrowser mit der Attrappe (test/_attrappe.js), OHNE
 *      Supabase: jede Meldestelle anklicken, Pflichtfelder im Blatt,
 *      Absenden ruft /api/... mit den richtigen Feldern, ehrlicher Hinweis bei
 *      fehlendem Schema 102, Meine Meldungen/Kontostatus/Widerspruch,
 *      Moderationsbereich (nur für Moderatoren) mit verborgenem Beleg und
 *      Belegprüfung echt/stimmt nicht.
 *   X  Was außerhalb der Dateiliste von RS 3 nachgetragen werden muss
 *      (index.html, UMD_BAUSTEINE, NachrichtSheet …). Diese Prüfungen sind rot,
 *      bis der Hauptagent die Einträge gemacht hat — absichtlich.
 *
 * WAS ER NICHT ZEIGT: die App-Oberfläche (Simulator) und die Datenbank selbst
 * (Schema 102 ist nicht eingespielt; Probe dafür: test/_probe102.js).
 *
 * Start:  BASE=http://localhost:3201 node test/rs3-melden.js
 *         (Server: cd web && PORT=3201 node server/lokal.js)
 *         OHNE_BROWSER=1 nur A, L, X.  BILDER=<ordner> legt Bildschirmfotos ab
 *         (Vorgabe: test/bilder-rs3).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const WURZEL = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://localhost:3201';
const BILDER = process.env.BILDER || path.join(__dirname, 'bilder-rs3');
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};

/*
 * Gate 2, Fund 32: Eine Prüfung auf ein FEHLEN ist sofort wahr, wenn die Datei
 * fehlt (lies gibt '') oder der Suchblock nicht gefunden wird. Deshalb gehen
 * alle Fehlen-Prüfungen über diese zwei Helfer: erst muss es die Datei bzw.
 * den Block geben, dann darf das Muster darin fehlen.
 */
const fehltIn = (rel, muster) => {
  const t = lies(rel);
  return t.length > 0 && !muster.test(t);
};
const fehltImBlock = (block, muster) => typeof block === 'string' && block.length > 0 && !muster.test(block);

const zaehler = { eigen: [0, 0], aussen: [0, 0] };
let bereich = 'eigen';
const pruefe = (name, wahr, zusatz = '') => {
  zaehler[bereich][1]++;
  if (wahr) zaehler[bereich][0]++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + String(zusatz).slice(0, 200) : ''));
};

/* ------------------------------------------------------------ A Quelltext */
function teilA() {
  console.log('\nA  App im Quelltext');
  const blatt = lies('app/components/MeldenSheet.tsx');
  pruefe('MeldenSheet prüft wie die Datenbank (Meldung.pruefen)', /Meldung\.pruefen\(eingabe\)/.test(blatt));
  pruefe('MeldenSheet sendet über Aktion.inhaltMelden', /Aktion\.inhaltMelden\(supabase, ichId/.test(blatt));
  pruefe('Häkchen nicht vorausgefüllt (useState(false))', /const \[haken, setHaken\] = useState\(false\)/.test(blatt));
  pruefe('Fehler im Blatt (testID melden-fehler), kein onNotice', /testID="melden-fehler"/.test(blatt) && fehltIn('app/components/MeldenSheet.tsx', /onNotice/));
  pruefe('Eingangsbestätigung im Blatt', /Meldung\.eingangText\(art, alterWeg\)/.test(blatt));
  pruefe('„kommt mit dem nächsten Update" bei grund update', /r\.grund === 'update' \? Meldung\.updateText\(art\)/.test(blatt));
  pruefe('Hinweis je Kategorie (Kindesmissbrauch/Selbstverletzung)', /Meldung\.hinweisFuer\(kat\)/.test(blatt) && /tel:\$\{hinweis\.notruf\}/.test(blatt));

  const orte = [
    ['Beitrag/Reel/Clip (BeitragOptionenSheet)', 'app/components/BeitragOptionenSheet.tsx', /<MeldenSheet\s+ziel=\{\{ art: 'post', id: beitrag\.id \}\}/],
    ['Profil (ProfilOptionenSheet)', 'app/components/ProfilOptionenSheet.tsx', /<MeldenSheet ziel=\{\{ art: 'user', id: userId \}\}/],
    ['Kontakt (ContactProfileScreen)', 'app/screens/messenger/ContactProfileScreen.tsx', /art: 'user', id: userId \}/],
    ['Story mit Story-ID (StoryOptionenSheet)', 'app/components/StoryOptionenSheet.tsx', /<MeldenSheet ziel=\{\{ art: 'story', id: story\.id \}\}/],
    ['Kommentar (CommentSheet)', 'app/components/CommentSheet.tsx', /art: 'comment', id: meldeKommentar/],
    ['Nachricht mit Beleg (ChatDetailScreen)', 'app/screens/messenger/ChatDetailScreen.tsx', /art: 'message',[\s\S]{0,80}beleg: \(\) =>[\s\S]{0,80}meldebelegHolen\(supabase, ichId, m\.id/],
    ['Nachricht im Unterthema (ChatDetailScreen)', 'app/screens/messenger/ChatDetailScreen.tsx', /if \(istKanal\) return setMeldeZiel\(\{ art: 'kanal_nachricht', id: m\.id \}\)/],
    ['Community (CommunityDetailScreen)', 'app/screens/communities/CommunityDetailScreen.tsx', /art: 'community', id: community\.id/],
    ['Problem melden (SettingsScreen)', 'app/screens/profile/SettingsScreen.tsx', /<MeldenSheet ziel=\{problemOffen \? \{ art: 'problem' \} : null\}/],
  ];
  for (const [name, datei, muster] of orte) pruefe(`Meldeort ${name}`, muster.test(lies(datei)));
  pruefe('ClipPlayer/Reels nutzen das BeitragOptionenSheet', /<BeitragOptionenSheet/.test(lies('app/screens/videos/ClipPlayerScreen.tsx')) && /<BeitragOptionenSheet/.test(lies('app/screens/video/VideoFeedScreen.tsx')));
  pruefe('Story meldet nicht mehr das Profil', fehltIn('app/components/StoryOptionenSheet.tsx', /melden\(story\.userId/));
  pruefe('Kommentar melden nur bei fremden', /item\.userId !== CURRENT_USER_ID && item\.userId !== ichId && \(/.test(lies('app/components/CommentSheet.tsx')));
  pruefe('Community melden nicht bei der eigenen', /\{!community\.eigen && \(\s*<Druck\s+style=\{styles\.melden\}/.test(lies('app/screens/communities/CommunityDetailScreen.tsx')));
  pruefe('Nachricht melden nur fremde', /if \(m\.senderId === CURRENT_USER_ID \|\| m\.senderId === ichId\) return;/.test(lies('app/screens/messenger/ChatDetailScreen.tsx')));
  pruefe('keine alten Grundlisten mehr (GRUENDE)', ['app/components/BeitragOptionenSheet.tsx', 'app/components/ProfilOptionenSheet.tsx', 'app/components/StoryOptionenSheet.tsx', 'app/screens/messenger/ContactProfileScreen.tsx'].every((d) => fehltIn(d, /const GRUENDE = \[/)));
  pruefe('ProfilContext ohne altes melden(userId) mit art user', fehltIn('app/contexts/ProfilContext.tsx', /Aktion\.melden\(c, ich, id, grund, 'user'\)/));

  const einst = lies('app/screens/profile/SettingsScreen.tsx');
  pruefe('„Problem melden" speichert (kein fertig-Satz ohne Speichern)', /label: 'Problem melden', icon: 'bug-outline', aktion: 'problem'/.test(einst) && !/fertig: 'Danke, die Meldung ist bei uns angekommen'/.test(einst));
  pruefe('Einstellungen: Meine Meldungen und Kontostatus', /aktion: 'meinemeldungen'/.test(einst) && /aktion: 'kontostatus'/.test(einst) && /<KontostatusSheet ansicht=\{kontostatus\}/.test(einst));
  const ks = lies('app/components/KontostatusSheet.tsx');
  pruefe('Kontostatus: echte Daten aus Schema 102', /Aktion\.meineMeldungen\(supabase\)/.test(ks) && /Aktion\.michBetreffendeEntscheidungen\(supabase\)/.test(ks));
  pruefe('Kontostatus: ehrlicher Hinweis ohne Schema 102', /if \(r\.fehlt\) return setFehlt\(true\)/.test(ks) && /Meldung\.OHNE_SCHEMA/.test(ks));
  pruefe('Kontostatus: Leertext, Widersprechen mit Textfeld', /Meldung\.LEER\.(meine|kontostatus)/.test(ks) && /Aktion\.entscheidungWidersprechen\(supabase, id, text\)/.test(ks) && /testID="widerspruch-text"/.test(ks));

  const pc = lies('app/contexts/ProfilContext.tsx');
  pruefe('Rechtsmitteilung (system): Text aus der Datenbank', /case 'system':\s*return m\.text \|\|/.test(pc));
  pruefe('Rechtsmitteilung in beiden Glocken', /m\.bereich === bereich \|\| m\.bereich === 'system'/.test(pc));
  pruefe('Website zeigt den Text der Rechtsmitteilung (mitteilungText system)', /system: m\.text \|\|/.test(lies('web/server/app.js')));
  pruefe('Website lädt Rechtsmitteilungen in beide Glocken', /abfrage\.in\('bereich', \[bereich, 'system'\]\)/.test(lies('web/server/supabase-api.js')));

  // Gleichstand der Einträge App/Website
  const web = lies('web/public/app.js');
  pruefe('gleiche Einträge App/Website: Problem melden, Meine Meldungen, Kontostatus',
    ['Problem melden', 'Meine Meldungen', 'Kontostatus'].every((l) => einst.includes(`label: '${l}'`) && web.includes(`label: '${l}'`)));
  const hilfeBlock = einst.match(/id: 'hilfe'[\s\S]*?\]\s*,\s*\}/)?.[0];
  pruefe('Moderation nur auf der Website (Hilfe-Block der App gefunden, ohne Moderation)', web.includes("aktion: 'moderation', nurModerator: true") && fehltImBlock(hilfeBlock, /Moderation/), hilfeBlock ? '' : 'Hilfe-Block nicht gefunden');

  // Gate 2 (31.10.2026)
  pruefe('Fund 32: Fehlen-Prüfungen prüfen erst die Datei (Selbsttest)', !fehltIn('app/gibt-es-nicht.tsx', /x/) && !fehltImBlock(undefined, /x/));
  pruefe('Fund 23: MeldenSheet sperrt Doppeltipps mit useRef', /const laeuft = useRef\(false\)/.test(blatt) && /if \(laeuft\.current\) return;/.test(blatt) && /laeuft\.current = true;\s*setSendet\(true\)/.test(blatt));
  pruefe('Fund 23: KontostatusSheet sperrt Doppeltipps mit useRef', /const laeuft = useRef\(false\)/.test(ks) && /laeuft\.current\) return;\s*laeuft\.current = true;/.test(ks));
  pruefe('Fund 12: Rechtsbehelfe in beiden Ansichten der App', /\{!fehlt && \(\s*<Text style=\{styles\.leise\} testID="kontostatus-weitere">/.test(ks) && fehltIn('app/components/KontostatusSheet.tsx', /ansicht === 'kontostatus' && !fehlt && <Text/));
  pruefe('Fund 12: Rechtsbehelfe in beiden Ansichten der Website', /<p class="sheet__hint" data-kstatus-weitere>\$\{esc\(M\.WIDERSPRUCH\.weitere\)\}<\/p>/.test(web));
  const akt = lies('app/lib/aktionen.ts');
  pruefe('Fund 28: App nennt die gerufene Funktion', /fehltFunktion\(error, 'inhalt_melden'\)/.test(akt) && /fehltFunktion\(error, funktion\)/.test(akt) && /fehltFunktion\(error, 'entscheidung_widersprechen'\)/.test(akt));
  const sh = lies('web/server/sync-handlers.js');
  pruefe('Fund 28: Server nennt die gerufene Funktion', /fehltFunktion\(error, 'inhalt_melden'\)/.test(sh) && (sh.match(/fehltFunktion\(error, funktion\)/g) || []).length === 2 && sh.length > 0 && !/fehltFunktion\(error\)/.test(sh));
  const srv = lies('web/server/app.js');
  pruefe('Fund 6: Route /api/moderation/art18', /app\.post\('\/api\/moderation\/art18'/.test(srv) && /handleArt18Vermerken/.test(srv) && /'art18_vermerken'/.test(sh));
  pruefe('Fund 7: Route für das Medium, 5 Minuten', /app\.get\('\/api\/moderation\/meldungen\/:id\/medium'/.test(srv) && /MEDIUM_SEKUNDEN = 300/.test(srv) && /signiereMedien\(req\.db, \{ url: r\.adresse \}, MEDIUM_SEKUNDEN\)/.test(srv));
  pruefe('Fund 5: p_bestaetigt geht an meldung_entscheiden', /p_bestaetigt: bestaetigt \|\| null/.test(sh));
  pruefe('Fund 30: Website lädt die Nachricht vor dem Beleg frisch', /beleg: async \(\) => \{[\s\S]{0,200}fetch\(`\/api\/messages\/\$\{encodeURIComponent\(chat\.id\)\}`\)/.test(web) && /beleg = ziel\.beleg \? await ziel\.beleg\(\) : null/.test(web));
}

/* --------------------------------------------- L App-Logik ohne Netz */
function uebersetzen(datei) {
  const ts = require(path.join(WURZEL, 'app', 'node_modules', 'typescript'));
  const quelle = fs.readFileSync(path.join(WURZEL, 'app', 'lib', datei), 'utf8');
  return ts.transpileModule(quelle, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText;
}

function laden(datei, ersatz) {
  const code = uebersetzen(datei);
  const mod = { exports: {} };
  const libOrdner = path.join(WURZEL, 'app', 'lib');
  const req = (name) => {
    if (ersatz[name]) return ersatz[name];
    if (/gemeinsam\//.test(name)) return require(path.resolve(libOrdner, name));
    throw new Error(`nicht nachgebaut: ${name}`);
  };
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports);
  return mod.exports;
}

/** Ein nachgebauter Supabase-Client: hält fest, was gerufen wird, und antwortet nach Vorgabe. */
function attrappenClient(vorgaben = {}) {
  const aufrufe = [];
  const abfrage = (tabelle) => {
    const q = { tabelle, filter: {}, art: 'select' };
    const ergebnis = () => {
      aufrufe.push(q);
      const v = vorgaben[`${q.art}:${tabelle}`];
      return Promise.resolve(typeof v === 'function' ? v(q) : v || { data: null, error: null });
    };
    const kette = {
      select(s) { q.spalten = s; return kette; },
      eq(k, w) { q.filter[k] = w; return kette; },
      in(k, w) { q.filter[k] = w; return kette; },
      is(k, w) { q.filter[k] = w; return kette; },
      insert(z) { q.art = 'insert'; q.zeile = z; return kette; },
      upsert(z) { q.art = 'upsert'; q.zeile = z; return kette; },
      update(z) { q.art = 'update'; q.zeile = z; return kette; },
      maybeSingle: ergebnis,
      single: ergebnis,
      then: (a, b) => ergebnis().then(a, b),
    };
    return kette;
  };
  return {
    aufrufe,
    from: abfrage,
    rpc(name, argumente) {
      aufrufe.push({ rpc: name, argumente });
      const v = vorgaben[`rpc:${name}`];
      return Promise.resolve(typeof v === 'function' ? v(argumente) : v || { data: null, error: null });
    },
  };
}

async function teilL() {
  console.log('\nL  App-Logik ohne Netz (aktionen.ts, krypto.ts übersetzt)');
  const Krypto = require('../../gemeinsam/krypto');
  Krypto.zufallsquelleSetzen((x, n) => {
    const b = crypto.randomBytes(n);
    for (let i = 0; i < n; i++) x[i] = b[i];
  });
  const fach = new Map();
  const SecureStore = {
    getItemAsync: async (k) => (fach.has(k) ? fach.get(k) : null),
    setItemAsync: async (k, v) => void fach.set(k, v),
    deleteItemAsync: async (k) => void fach.delete(k),
  };
  const ExpoCrypto = { getRandomBytes: (n) => new Uint8Array(crypto.randomBytes(n)), randomUUID: () => crypto.randomUUID() };
  const KryptoApp = laden('krypto.ts', { 'expo-secure-store': SecureStore, 'expo-crypto': ExpoCrypto, './kontenspeicher': { gespeicherteKonten: async () => [] } });
  const A = laden('aktionen.ts', { './medien': { signiereMedien: async (x) => x }, './krypto': KryptoApp, './impressionen': {} });

  const ZIEL = '11111111-1111-4111-8111-111111111111';
  const ok = { art: 'post', ziel: ZIEL, kategorie: 'hass', begruendung: 'Hetze gegen Geflüchtete', gutglaeubig: true };

  // 1) Schema 102 da
  let c = attrappenClient({ 'rpc:inhalt_melden': { data: { ok: true, id: 'r-1' }, error: null } });
  let r = await A.inhaltMelden(c, 'ich', ok);
  const arg = c.aufrufe[0]?.argumente || {};
  pruefe('inhalt_melden mit allen Feldern', c.aufrufe[0]?.rpc === 'inhalt_melden' && arg.p_art === 'post' && arg.p_ziel === ZIEL && arg.p_kategorie === 'hass' && arg.p_begruendung === ok.begruendung && arg.p_gutglaeubig === true && arg.p_beleg === null, JSON.stringify(arg));
  pruefe('Erfolg mit Kennung, kein alter Weg', r.ok === true && r.id === 'r-1' && !r.alterWeg && c.aufrufe.length === 1);
  // 2) Datenbank sagt nein
  c = attrappenClient({ 'rpc:inhalt_melden': { data: { ok: false, grund: 'selbst' }, error: null } });
  r = await A.inhaltMelden(c, 'ich', ok);
  pruefe('Ablehnung der Datenbank kommt als grund an', r.ok === false && r.grund === 'selbst' && c.aufrufe.length === 1);
  // 3) Eingabe falsch → gar kein Aufruf
  c = attrappenClient();
  r = await A.inhaltMelden(c, 'ich', { ...ok, gutglaeubig: false });
  pruefe('ohne Häkchen: kein Aufruf, grund gutglaeubig', r.ok === false && r.grund === 'gutglaeubig' && c.aufrufe.length === 0);
  // 4) Schema 102 fehlt → alter Weg
  c = attrappenClient({ 'rpc:inhalt_melden': { data: null, error: { code: 'PGRST202', message: 'Could not find the function public.inhalt_melden' } }, 'insert:reports': { data: null, error: null } });
  r = await A.inhaltMelden(c, 'ich', ok);
  const ins = c.aufrufe.find((x) => x.art === 'insert');
  pruefe('ohne Schema 102: alter Eintrag in reports', !!ins && ins.tabelle === 'reports' && ins.zeile.target_type === 'post' && ins.zeile.target_id === ZIEL && ins.zeile.reported_by === 'ich' && ins.zeile.reason.startsWith('[hass] Hetze'), JSON.stringify(ins));
  pruefe('… und sagt alterWeg', r.ok === true && r.alterWeg === true);
  c = attrappenClient({ 'rpc:inhalt_melden': { data: null, error: { code: '42883', message: 'function public.inhalt_melden does not exist' } } });
  r = await A.inhaltMelden(c, 'ich', { ...ok, art: 'community' });
  pruefe('ohne Schema 102: Community → update, KEIN Eintrag', r.ok === false && r.grund === 'update' && !c.aufrufe.some((x) => x.art === 'insert'));
  r = await A.inhaltMelden(c, 'ich', { art: 'problem', begruendung: 'Die App stürzt beim Hochladen ab' });
  pruefe('ohne Schema 102: Problem → update, KEIN Eintrag', r.ok === false && r.grund === 'update' && !c.aufrufe.some((x) => x.art === 'insert'));
  c = attrappenClient({ 'rpc:inhalt_melden': { data: null, error: { code: '42501', message: 'permission denied' } } });
  let geworfen = false;
  try { await A.inhaltMelden(c, 'ich', ok); } catch { geworfen = true; }
  pruefe('anderer Fehler wird NICHT zum alten Weg', geworfen && !c.aufrufe.some((x) => x.art === 'insert'));
  c = attrappenClient({ 'rpc:inhalt_melden': { data: null, error: { code: '42883', message: 'function public.beitrag_sichtbar(uuid, boolean) does not exist' } } });
  geworfen = false;
  try { await A.inhaltMelden(c, 'ich', ok); } catch { geworfen = true; }
  pruefe('Fund 28: fehlende Hilfsfunktion im Rumpf → Fehler, KEIN alter Weg', geworfen && !c.aufrufe.some((x) => x.art === 'insert'));
  c = attrappenClient({ 'rpc:inhalt_melden': { data: { ok: true, id: 'r-2' }, error: null } });
  await A.inhaltMelden(c, 'ich', { art: 'problem', begruendung: 'Die App stürzt beim Hochladen ab' });
  pruefe('Problem: p_ziel null, p_kategorie problem', c.aufrufe[0]?.argumente.p_ziel === null && c.aufrufe[0]?.argumente.p_kategorie === 'problem');

  c = attrappenClient({ 'rpc:meine_meldungen': { data: null, error: { code: 'PGRST202' } } });
  r = await A.meineMeldungen(c);
  pruefe('Meine Meldungen ohne Schema 102 → fehlt (keine leere Liste)', r.fehlt === true && !('zeilen' in r));
  c = attrappenClient({ 'rpc:mich_betreffende_entscheidungen': { data: [{ id: 'm1' }], error: null } });
  r = await A.michBetreffendeEntscheidungen(c);
  pruefe('Kontostatus mit Schema 102 → Zeilen', r.fehlt === false && r.zeilen.length === 1);
  c = attrappenClient({ 'rpc:entscheidung_widersprechen': { data: { ok: false, grund: 'frist' }, error: null } });
  r = await A.entscheidungWidersprechen(c, 'm1', 'Das war Satire');
  pruefe('Widerspruch: Argumente und grund', c.aufrufe[0]?.argumente.p_meldung === 'm1' && c.aufrufe[0]?.argumente.p_text === 'Das war Satire' && r.grund === 'frist');

  // 5) Meldebeleg einer ECHT verschlüsselten Nachricht
  const anna = Krypto.schluesselpaarErzeugen();
  const ben = Krypto.schluesselpaarErzeugen();
  fach.set('allmedia.krypto.geheim.ben', ben.geheim);
  fach.set('allmedia.krypto.geraet.ben', 'geraet-ben');
  // main (vor der Sicherheitsprüfung 16.10.) hat ein Fach je Gerät, nicht je Konto.
  fach.set('allmedia.krypto.geheim', ben.geheim);
  fach.set('allmedia.krypto.geraet', 'geraet-ben');
  const text = 'Wenn du das jemandem sagst, passiert was.';
  const v = Krypto.verschluesseln(text, anna.geheim, [{ id: 'k-ben', oeffentlich: ben.oeffentlich }, { id: 'k-anna', oeffentlich: anna.oeffentlich }]);
  const kuvert = v.kuverts.find((k) => k.schluesselId === 'k-ben');
  c = attrappenClient({
    'select:messages': { data: { krypto: v.version, chiffre: v.chiffre, krypto_nonce: v.nonce, absender_schluessel: v.absender }, error: null },
    'upsert:krypto_schluessel': { data: { id: 'k-ben' }, error: null },
    'select:message_keys': (q) => ({ data: q.filter.schluessel_id === 'k-ben' ? { nonce: kuvert.nonce, chiffre: kuvert.chiffre } : null, error: null }),
  });
  const beleg = await KryptoApp.meldebelegHolen(c, 'ben', 'n-1', 'angezeigt');
  pruefe('App-Beleg: Klartext aus der Chiffre (nicht der angezeigte Text)', beleg && beleg.text === text, JSON.stringify(beleg));
  pruefe('App-Beleg: Sitzungsschlüssel prüft gegen die Chiffre', beleg && Krypto.belegPruefen({ chiffre: v.chiffre, nonce: v.nonce }, beleg.sitzung, text) === true);
  pruefe('App-Beleg: Gerätschlüssel steht nicht drin', beleg && !JSON.stringify(beleg).includes(ben.geheim));
  c = attrappenClient({ 'select:messages': { data: { krypto: 0 }, error: null } });
  const offen = await KryptoApp.meldebelegHolen(c, 'ben', 'n-2', 'Hallo du');
  pruefe('App-Beleg unverschlüsselt: nur der Text', offen && offen.text === 'Hallo du' && !offen.sitzung);

  // Server-Handler der Website (sync-handlers.js) gegen den nachgebauten Client
  const S = require('../../web/server/sync-handlers.js');
  const MEDIUM = 'https://x.supabase.co/storage/v1/object/public/media/posts/u/clip.mp4';
  const zeilen = [
    { id: 'm1', kategorie: 'hass', status: 'eingegangen', beleg: { text: 'Hetze', medien: MEDIUM } },
    { id: 'm2', kategorie: 'kindesmissbrauch', status: 'eingegangen', beleg: null, beleg_verborgen: true },
  ];
  c = attrappenClient({ 'rpc:meldungen_liste': { data: zeilen, error: null } });
  let l = await S.handleModerationMeldungen(c, 'mod', 'eingegangen');
  pruefe('Fund 7: Liste gibt die Medienadresse NICHT heraus (nur medium + Dateiname)', l.zeilen[0].beleg.medium === true && l.zeilen[0].beleg.medium_datei === 'clip.mp4' && !JSON.stringify(l).includes('/storage/v1/'), JSON.stringify(l.zeilen[0]));
  c = attrappenClient({ 'rpc:beschwerden_liste': { data: [{ id: 'b1', beleg: { medien: MEDIUM } }], error: null } });
  l = await S.handleModerationBeschwerden(c, 'mod', 'offen');
  pruefe('Fund 7: auch die Widerspruchsliste ohne Medienadresse', !JSON.stringify(l).includes('/storage/v1/') && l.zeilen[0].beleg.medium === true);
  c = attrappenClient({ 'rpc:meldungen_liste': { data: zeilen, error: null } });
  let md = await S.handleModerationMedium(c, 'mod', 'm1');
  pruefe('Fund 7: Medium einer offenen Meldung → Adresse und Typ, nur aus offenen Meldungen', md.adresse === MEDIUM && md.typ === 'video' && c.aufrufe[0].argumente.p_status === 'eingegangen');
  md = await S.handleModerationMedium(c, 'mod', 'm2');
  pruefe('Fund 7: Kindesmissbrauch → verborgen, keine Adresse', md.grund === 'verborgen' && !md.adresse);
  md = await S.handleModerationMedium(c, 'mod', 'gibtsnicht');
  pruefe('Fund 7: unbekannte/entschiedene Meldung → grund medium', md.grund === 'medium' && !md.adresse);
  c = attrappenClient({ 'rpc:art18_vermerken': { data: { ok: true }, error: null } });
  let ar = await S.handleArt18Vermerken(c, 'mod', 'm1', 'u-entrance, 31.10.2026');
  pruefe('Fund 6: art18_vermerken mit p_meldung und p_vermerk', ar.erledigt === true && c.aufrufe[0].rpc === 'art18_vermerken' && c.aufrufe[0].argumente.p_meldung === 'm1' && c.aufrufe[0].argumente.p_vermerk === 'u-entrance, 31.10.2026');
  c = attrappenClient({ 'rpc:art18_vermerken': { data: { ok: false, grund: 'vermerk' }, error: null } });
  ar = await S.handleArt18Vermerken(c, 'mod', 'm1', 'x');
  pruefe('Fund 6: zu kurzer Vermerk → grund vermerk (Satz auf Deutsch)', ar.erledigt === false && ar.grund === 'vermerk' && /BKA/.test(require('../../gemeinsam/meldung').grundText(ar.grund)));
  c = attrappenClient({ 'rpc:meldung_entscheiden': { data: { ok: false, grund: 'bestaetigung' }, error: null } });
  const en = await S.handleMeldungEntscheiden(c, 'mod', 'm2', { massnahme: 'entfernen_sperren', grundlage: 'gesetz', begruendung: 'x', bestaetigt: '  Sichtung 31.10.  ', sperreTage: '' });
  pruefe('Fund 5: p_bestaetigt (getrimmt) und grund bestaetigung', c.aufrufe[0].argumente.p_bestaetigt === 'Sichtung 31.10.' && c.aufrufe[0].argumente.p_sperre_tage === null && en.grund === 'bestaetigung');
  c = attrappenClient({ 'rpc:meldung_entscheiden': { data: { ok: true }, error: null } });
  await S.handleMeldungEntscheiden(c, 'mod', 'm1', { massnahme: 'entfernen', grundlage: 'gesetz', begruendung: 'xyz' });
  pruefe('Fund 5: ohne Bestätigung → p_bestaetigt null', c.aufrufe[0].argumente.p_bestaetigt === null);
  c = attrappenClient({ 'rpc:meldungen_liste': { data: null, error: { code: '42883', message: 'function public.ist_moderator() does not exist' } } });
  l = await S.handleModerationMeldungen(c, 'mod', 'eingegangen');
  pruefe('Fund 28: Server — 42883 einer Hilfsfunktion ist ein Fehler, nicht „Schema fehlt"', l && l.ok === false && !l.fehlt, JSON.stringify(l));
}

/* --------------------------------------------- B Website mit Attrappe */
/** Die erwartete Auswahl „2. Kinder schützen|…|11. Falschinformationen". */
const window_klauseln = () => require('../../gemeinsam/meldung').KLAUSELN.map((k) => `${k.nr}. ${k.titel}`).join('|');
async function teilB() {
  console.log(`\nB  Website mit Attrappe (${BASE})`);
  const { chromium } = require('playwright-core');
  const { attrappe, bestand, community, ICH } = require('./_attrappe');
  const Krypto = require('../../gemeinsam/krypto');
  fs.mkdirSync(BILDER, { recursive: true });
  const bild = async (seite, name) => {
    await seite.waitForTimeout(350);
    await seite.screenshot({ path: path.join(BILDER, `${name}.png`) });
  };

  // Ein echter E2E-Beleg für die Moderation — und einer mit verändertem Text.
  const anna = Krypto.schluesselpaarErzeugen();
  const ben = Krypto.schluesselpaarErzeugen();
  const echtText = 'Ich weiß, wo du wohnst.';
  const v = Krypto.verschluesseln(echtText, anna.geheim, [{ id: 'k-ben', oeffentlich: ben.oeffentlich }]);
  const bBeleg = Krypto.meldebeleg({ version: v.version, chiffre: v.chiffre, nonce: v.nonce, absender: v.absender }, v.kuverts[0], ben.geheim);

  const ID = {
    post: '20000000-0000-4000-8000-000000000001',
    story: '30000000-0000-4000-8000-000000000001',
    kommentar: '40000000-0000-4000-8000-000000000001',
    nachricht: '50000000-0000-4000-8000-000000000001',
    kanalmsg: '60000000-0000-4000-8000-000000000001',
    meldung: '70000000-0000-4000-8000-000000000001',
  };
  const daten = (mod) =>
    bestand({
      users: {
        [ICH]: { id: ICH, name: 'Test Konto', handle: 'test', initials: 'TK' },
        'u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: 'anna', initials: 'AS' },
      },
      posts: [{ id: ID.post, userId: 'u-anna', description: 'Ein Foto', likes: 0, comments: 1, reposts: 0, liked: false, saved: false, likedBy: [], mediaUrl: '', location: '' }],
      chats: [{ id: 'chat-anna', name: 'Anna Schmidt', userId: 'u-anna', isGroup: false, preview: 'Hallo', time: '12:00', unread: 0 }],
      communities: [community('c-fremd', 'Kochen', { joined: true }), community('c-eigen', 'Meine', { eigen: true })],
      istModerator: mod,
    });

  let nachrichtJetzt = 'Ich weiß, wo du wohnst.';
  const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const mitt = [{ id: 'n-1', userId: null, art: 'system', bereich: 'system', ziel: { art: 'meldung', id: ID.meldung }, text: 'Danke, deine Meldung ist angekommen. Wir prüfen sie und sagen dir, was wir entschieden haben.', zeit: 'jetzt', gelesen: false }];
  const entschiedene = [
    { id: 'm-km2', art: 'post', ziel: ID.post, kategorie: 'kindesmissbrauch', begruendung_meldung: '', status: 'entschieden', ziel_profil: 'u-anna', ziel_name: 'Anna Schmidt', ziel_handle: 'anna', beleg: null, beleg_verborgen: true, gleiches_ziel: 1, erstellt: '2026-10-22T11:00:00Z', massnahme: 'entfernen', begruendung: 'Darstellung nach § 184b StGB, entfernt.', entschieden: '2026-10-30T10:00:00Z', art18: true, zurueckgestellt: true },
  ];
  const meldungen = [
    { id: 'm-spam', art: 'post', ziel: ID.post, kategorie: 'betrug_spam', begruendung_meldung: 'Werbung für Abzocke', status: 'eingegangen', ziel_profil: 'u-anna', ziel_name: 'Anna Schmidt', ziel_handle: 'anna', beleg: { beschreibung: 'Gewinne jetzt 1000 €', medium: true, medium_datei: 'bild.jpg' }, beleg_verborgen: false, gleiches_ziel: 3, erstellt: '2026-10-22T08:00:00Z' },
    { id: 'm-echt', art: 'message', ziel: ID.nachricht, kategorie: 'gewalt_drohung', begruendung_meldung: 'Er droht mir', status: 'eingegangen', ziel_profil: 'u-anna', ziel_name: 'Anna Schmidt', ziel_handle: 'anna', beleg: { krypto: 1, chiffre: v.chiffre, nonce: v.nonce, klartext_gemeldet: echtText, sitzung: bBeleg.sitzung }, beleg_verborgen: false, gleiches_ziel: 1, erstellt: '2026-10-22T09:00:00Z' },
    { id: 'm-falsch', art: 'message', ziel: ID.nachricht, kategorie: 'mobbing', begruendung_meldung: 'Beleidigung', status: 'eingegangen', ziel_profil: 'u-anna', ziel_name: 'Anna Schmidt', ziel_handle: 'anna', beleg: { krypto: 1, chiffre: v.chiffre, nonce: v.nonce, klartext_gemeldet: 'Ganz anderer Text', sitzung: bBeleg.sitzung }, beleg_verborgen: false, gleiches_ziel: 1, erstellt: '2026-10-22T10:00:00Z' },
    { id: 'm-km', art: 'post', ziel: ID.post, kategorie: 'kindesmissbrauch', begruendung_meldung: '', status: 'eingegangen', ziel_profil: 'u-anna', ziel_name: 'Anna Schmidt', ziel_handle: 'anna', beleg: null, beleg_verborgen: true, gleiches_ziel: 1, erstellt: '2026-10-22T11:00:00Z' },
  ];

  const browser = await chromium.launch();
  const seitenfehler = [];
  try {
    const neueSeite = async (mod, antworten) => {
      const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });
      seite.on('pageerror', (e) => seitenfehler.push(e.message));
      const aufrufe = await attrappe(seite, daten(mod), antworten);
      await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
      await seite.waitForSelector('[data-area="communities"]', { timeout: 15000 });
      return { seite, aufrufe };
    };
    const meldenBody = (aufrufe, pfad = '/api/melden') => {
      const a = [...aufrufe].reverse().find((x) => x.pfad === pfad && x.methode === 'POST');
      return a ? JSON.parse(a.body || '{}') : null;
    };
    // Zwischen zwei Meldestellen: offene Blätter weg (das Kommentarblatt hat kein Escape).
    const aufraeumen = (seite) =>
      seite.evaluate(() => {
        document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
        // Ein offener Chat liegt als Overlay über allem.
        if (typeof closeOverlay === 'function' && document.querySelector('#overlay:not([hidden])')) {
          state.openChatId = null;
          closeOverlay();
        }
      });
    const imBlatt = (seite, sel) => seite.evaluate((s) => !!document.querySelector('.sheet-backdrop:last-of-type ' + s) && !document.querySelector(s)?.hidden, sel);

    const antworten = {
      // Die Einstellungsseite lädt nach, solange hier `{}` statt der echten Form käme — Endlosschleife.
      '/api/statistik': { statistik: { follower: 0 } },
      '/api/gelikt': [],
      '/api/kommentiert': [],
      '/api/banne': { banne: [] },
      '/api/melden': (a) => {
        const b = JSON.parse(a.postData() || '{}');
        if (b.art === 'community') return { ok: true, gemeldet: false, grund: 'update' };
        return { ok: true, gemeldet: true, id: 'neu-1' };
      },
      '/api/chats/chat-anna/melden': { ok: true, gemeldet: true, id: 'neu-2' },
      [`/api/comments/${ID.post}`]: [{ id: ID.kommentar, userId: 'u-anna', text: 'Du bist dumm', time: '1 Std', likes: 0, liked: false }],
      // Fund 30: die Nachricht wird vor dem Beleg frisch geholt — `nachrichtJetzt` ändert der Lauf.
      '/api/messages/chat-anna': () => [{ id: ID.nachricht, from: 'u-anna', text: nachrichtJetzt, time: '12:00' }],
      '/api/communities/c-fremd/channels/c-fremd-k1': { messages: [{ id: ID.kanalmsg, from: 'u-anna', text: 'Alle hier sind Idioten', time: '12:00' }] },
      '/api/mitteilungen/videos': { eintraege: mitt, ungelesen: 1 },
      '/api/meldungen/meine': { ok: true, fehlt: true, zeilen: [] },
      '/api/meldungen/kontostatus': { ok: true, fehlt: false, zeilen: [{ id: ID.meldung, art: 'post', kategorie: 'mobbing', massnahme: 'entfernen', begruendung: 'Der Beitrag beleidigt eine Mitschülerin namentlich.', grundlage: 'regeln', sperre_bis: null, entschieden: '2026-10-20T10:00:00Z', widerspruch_bis: '2027-04-20T10:00:00Z', beschwerde_status: null }] },
      [`/api/meldungen/${ID.meldung}/widersprechen`]: { ok: true, erledigt: true, id: 'b-1' },
      // „Entschieden“ (31.10.): zweite Stufe bei Kindesmissbrauch, zurückgestellte Begründung.
    '/api/moderation/meldungen': (anfrage) =>
      new URL(anfrage.url()).searchParams.get('status') === 'entschieden'
        ? { ok: true, fehlt: false, zeilen: entschiedene }
        : { ok: true, fehlt: false, zeilen: meldungen },
    '/api/moderation/meldungen/m-km2/sperre': { ok: true, erledigt: true },
    '/api/moderation/meldungen/m-km2/nachsenden': { ok: true, erledigt: true },
      '/api/moderation/meldungen/m-spam': { ok: true, erledigt: true },
      '/api/moderation/meldungen/m-falsch': { ok: true, erledigt: true },
      '/api/moderation/meldungen/m-km': { ok: true, erledigt: true },
      '/api/moderation/meldungen/m-spam/medium': { ok: true, url: PIXEL, typ: 'bild', sekunden: 300 },
      '/api/moderation/art18': (a) => {
        const b = JSON.parse(a.postData() || '{}');
        return String(b.vermerk || '').trim().length >= 5 ? { ok: true, erledigt: true } : { ok: true, erledigt: false, grund: 'vermerk' };
      },
      '/api/moderation/beschwerden': { ok: true, fehlt: false, zeilen: [{ id: 'b-1', meldung_id: ID.meldung, rolle: 'betroffen', text: 'Das war ein Witz unter Freunden', status: 'offen', erstellt: '2026-10-21T10:00:00Z', art: 'post', kategorie: 'mobbing', massnahme: 'entfernen', begruendung_entscheidung: 'Beleidigt namentlich', entschieden_von_mir: false, beleg: { beschreibung: 'Lisa ist hässlich' }, beleg_verborgen: false }] },
      '/api/moderation/beschwerden/b-1': { ok: true, erledigt: true },
      '/api/moderation/zahlen': { ok: true, zahlen: { meldungen: 12, je_kategorie: { hass: 4, betrug_spam: 8 }, je_massnahme: { entfernen: 3 }, median_stunden: 5.5, beschwerden: 2, aufgehoben: 1, automatisiert: 0 } },
    };

    const { seite, aufrufe } = await neueSeite(true, antworten);
    // index.html gehört dem Hauptagenten: fehlt dort noch das Skript, legt der Lauf es bei (X prüft den Eintrag).
    if (!(await seite.evaluate(() => !!window.Meldung))) await seite.addScriptTag({ url: '/gemeinsam/meldung.js' });
    pruefe('window.Meldung ist da', await seite.evaluate(() => !!window.Meldung && window.Meldung.KATEGORIEN.length === 13));

    /* 1 Beitrag: Kategorie → Pflichtfelder → Häkchen → Senden → Bestätigung */
    await seite.click('[data-area="videos"]');
    await seite.click('[data-sub="home"]').catch(() => {});
    await seite.waitForSelector(`[data-paction="mehr"][data-pid="${ID.post}"]`, { timeout: 10000 });
    await seite.click(`[data-paction="mehr"][data-pid="${ID.post}"]`);
    await seite.click('[data-beitragopt="melden"]');
    await seite.waitForSelector('[data-mkat]', { timeout: 5000 });
    pruefe('Beitrag: 13 Kategorien mit Erklärung', (await seite.$$('[data-mkat] small')).length === 13);
    await bild(seite, 'rs3-1-kategorien');
    await seite.click('[data-mkat="hass"]');
    pruefe('Häkchen nicht vorausgefüllt', (await seite.$eval('#meldenHaken', (e) => e.checked)) === false);
    await seite.click('#meldenSenden');
    const f1 = await seite.$eval('#meldenFehler', (e) => (e.hidden ? '' : e.textContent));
    pruefe('ohne Begründung: Fehler IM Blatt', /mindestens 10 Zeichen/.test(f1) && (await imBlatt(seite, '#meldenFehler')), f1);
    pruefe('… und nichts gesendet', !meldenBody(aufrufe));
    await seite.fill('#meldenText', 'Hetze gegen Geflüchtete');
    pruefe('Zähler läuft mit', /reicht/.test(await seite.textContent('#meldenZaehler')));
    await seite.click('#meldenSenden');
    const f2 = await seite.$eval('#meldenFehler', (e) => (e.hidden ? '' : e.textContent));
    pruefe('ohne Häkchen: Fehler IM Blatt', /bestem Wissen/.test(f2), f2);
    await bild(seite, 'rs3-2-pflichtfelder');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b1 = meldenBody(aufrufe);
    pruefe('Beitrag: POST /api/melden mit art, ziel, kategorie, begruendung, gutglaeubig', b1 && b1.art === 'post' && b1.ziel === ID.post && b1.kategorie === 'hass' && b1.begruendung === 'Hetze gegen Geflüchtete' && b1.gutglaeubig === true, JSON.stringify(b1));
    pruefe('Eingangsbestätigung im Blatt', /Danke, deine Meldung ist angekommen/.test((await seite.textContent('[data-melden-bestaetigung]').catch(() => '')) || ''));
    await bild(seite, 'rs3-3-bestaetigung');
    await seite.click('#meldenFertig');

    /* 2 Kindesmissbrauch: Hinweis, ohne Begründung erlaubt */
    await seite.click(`[data-paction="mehr"][data-pid="${ID.post}"]`);
    await seite.click('[data-beitragopt="melden"]');
    await seite.click('[data-mkat="kindesmissbrauch"]');
    const km = (await seite.textContent('[data-mhinweis="kindesmissbrauch"]').catch(() => '')) || '';
    pruefe('Kindesmissbrauch: nicht beschreiben, nicht weiterleiten/speichern', /Beschreib den Inhalt nicht/.test(km) && /speichere/.test(km));
    pruefe('Kindesmissbrauch: Beschwerdestelle und 110', !!(await seite.$('a[href="https://www.internet-beschwerdestelle.de"]')) && !!(await seite.$('a[href="tel:110"]')));
    await bild(seite, 'rs3-4-kindesmissbrauch');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b2 = meldenBody(aufrufe);
    pruefe('Kindesmissbrauch: ohne Begründung gesendet', b2 && b2.kategorie === 'kindesmissbrauch' && b2.begruendung === '', JSON.stringify(b2));
    await seite.click('#meldenFertig').catch(() => {});

    /* 3 Selbstverletzung: Hilfe zuerst */
    await seite.click(`[data-paction="mehr"][data-pid="${ID.post}"]`);
    await seite.click('[data-beitragopt="melden"]');
    await seite.click('[data-mkat="selbstverletzung"]');
    const sv = (await seite.textContent('[data-mhinweis="selbstverletzung"]').catch(() => '')) || '';
    pruefe('Selbstverletzung: Telefonseelsorge und Nummer gegen Kummer', sv.includes('0800 111 0 111') && sv.includes('116 111'));
    await bild(seite, 'rs3-5-selbstverletzung');
    await seite.keyboard.press('Escape');

    /* 4 Kommentar */
    await seite.click(`[data-paction="comment"][data-pid="${ID.post}"]`).catch(async () => seite.evaluate((id) => openComments(id), ID.post));
    await seite.waitForSelector(`[data-kmelden="${ID.kommentar}"]`, { timeout: 5000 }).catch(() => {});
    pruefe('Kommentar: „Melden" am fremden Kommentar', !!(await seite.$(`[data-kmelden="${ID.kommentar}"]`)));
    await seite.click(`[data-kmelden="${ID.kommentar}"]`);
    await seite.click('[data-mkat="mobbing"]');
    await seite.fill('#meldenText', 'Beleidigt mich unter meinem Foto');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b3 = meldenBody(aufrufe);
    pruefe('Kommentar: art comment mit Kommentar-ID', b3 && b3.art === 'comment' && b3.ziel === ID.kommentar, JSON.stringify(b3));
    await bild(seite, 'rs3-6-kommentar');
    await seite.keyboard.press('Escape');
    await seite.keyboard.press('Escape');

    await aufraeumen(seite);
    /* 5 Story: echte Story-ID, nicht das Profil */
    await seite.evaluate((id) => openStoryOptionen({ id, userId: 'u-anna', mediaUri: '' }), ID.story);
    await seite.click('[data-storyopt="melden"]');
    await seite.click('[data-mkat="sexuell"]');
    await seite.fill('#meldenText', 'Nacktbild in der Story');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b4 = meldenBody(aufrufe);
    pruefe('Story: art story mit Story-ID (nicht u-anna)', b4 && b4.art === 'story' && b4.ziel === ID.story, JSON.stringify(b4));
    pruefe('Story: kein Aufruf mehr an /api/profile/u-anna/melden', !aufrufe.some((a) => a.pfad === '/api/profile/u-anna/melden'));
    await seite.click('#meldenFertig').catch(() => {});

    await aufraeumen(seite);
    /* 6 Profil */
    await seite.evaluate(() => openProfilOptionen({ id: 'u-anna', name: 'Anna Schmidt', handle: '@anna' }));
    await seite.click('[data-popt="melden"]');
    await seite.click('[data-mkat="betrug_spam"]');
    await seite.fill('#meldenText', 'Gefälschtes Konto einer Firma');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b5 = meldenBody(aufrufe);
    pruefe('Profil: art user mit Profil-ID', b5 && b5.art === 'user' && b5.ziel === 'u-anna', JSON.stringify(b5));
    await seite.click('#meldenFertig').catch(() => {});

    await aufraeumen(seite);
    /* 7 Nachricht im Chat (lange drücken → Melden) */
    await seite.evaluate(() => openChat('chat-anna'));
    await seite.waitForSelector(`[data-msgid="${ID.nachricht}"]`, { timeout: 8000 });
    const blase = await seite.$(`[data-msgid="${ID.nachricht}"]`);
    const kasten = await blase.boundingBox();
    await seite.mouse.move(kasten.x + 10, kasten.y + kasten.height / 2);
    await seite.mouse.down();
    await seite.waitForTimeout(700);
    await seite.mouse.up();
    await seite.waitForSelector('[data-msgaktion="melden"]', { timeout: 3000 }).catch(() => {});
    pruefe('Nachricht: „Melden" im Nachrichtenmenü', !!(await seite.$('[data-msgaktion="melden"]')));
    await seite.click('[data-msgaktion="melden"]');
    await seite.click('[data-mkat="gewalt_drohung"]');
    pruefe('Nachricht: Hinweis, dass nur diese eine Nachricht mitgeht', /genau dieser einen Nachricht/.test(await seite.textContent('[data-melden]')));
    await seite.fill('#meldenText', 'Sie droht mir mit Gewalt');
    await seite.check('#meldenHaken');
    await bild(seite, 'rs3-7-nachricht');
    // Inzwischen bearbeitet: der Beleg muss die AKTUELLE Fassung tragen (Fund 30).
    nachrichtJetzt = 'Ich weiß, wo du wohnst. (bearbeitet)';
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b6 = meldenBody(aufrufe);
    pruefe('Nachricht: art message, Nachricht-ID und Beleg mit Text', b6 && b6.art === 'message' && b6.ziel === ID.nachricht && b6.beleg && typeof b6.beleg.text === 'string', JSON.stringify(b6));
    pruefe('Fund 30: Beleg aus der frisch geladenen Nachricht (bearbeitete Fassung)', b6 && b6.beleg && b6.beleg.text === 'Ich weiß, wo du wohnst. (bearbeitet)', JSON.stringify(b6 && b6.beleg));
    nachrichtJetzt = 'Ich weiß, wo du wohnst.';
    await seite.click('#meldenFertig').catch(() => {});

    await aufraeumen(seite);
    /* 8 Chat-Einstellungen „Chat melden" → neue Route mit Pflichtfeldern */
    await seite.evaluate(() => openChatSettings('chat-anna'));
    await seite.waitForSelector('[data-chatopt-aktion="melden"]', { timeout: 5000 });
    await seite.click('[data-chatopt-aktion="melden"]');
    await seite.click('[data-mkat="mobbing"]');
    await seite.fill('#meldenText', 'Schreibt mir ständig Beleidigungen');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b7 = meldenBody(aufrufe, '/api/chats/chat-anna/melden');
    pruefe('Chat melden: /api/chats/:id/melden mit Kategorie, Begründung, Häkchen', b7 && b7.art === 'user' && b7.kategorie === 'mobbing' && b7.gutglaeubig === true && b7.begruendung.length >= 10, JSON.stringify(b7));
    await seite.click('#meldenFertig').catch(() => {});
    await seite.keyboard.press('Escape');

    await aufraeumen(seite);
    /* 9 Community: ehrlicher Hinweis, wenn Schema 102 fehlt */
    await seite.evaluate(() => renderCommunityChannels('c-fremd'));
    await seite.waitForSelector('#commMelden', { timeout: 5000 }).catch(() => {});
    pruefe('Community: „Community melden" an der fremden', !!(await seite.$('#commMelden')));
    await seite.click('#commMelden');
    await seite.click('[data-mkat="hass"]');
    await seite.fill('#meldenText', 'Die Gruppe hetzt gegen Juden');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForTimeout(500);
    const f3 = await seite.$eval('#meldenFehler', (e) => (e.hidden ? '' : e.textContent)).catch(() => '');
    const b8 = meldenBody(aufrufe);
    pruefe('Community: art community gesendet', b8 && b8.art === 'community' && b8.ziel === 'c-fremd', JSON.stringify(b8));
    pruefe('ohne Schema 102: „kommt mit dem nächsten Update", keine Bestätigung', /Community melden kommt mit dem nächsten Update/.test(f3) && !(await seite.$('[data-melden-bestaetigung]')), f3);
    await bild(seite, 'rs3-8-community-update');
    await seite.keyboard.press('Escape');
    await seite.evaluate(() => renderCommunityChannels('c-eigen'));
    await seite.waitForTimeout(400);
    pruefe('eigene Community: kein „Community melden"', !(await seite.$('#commMelden')));

    await aufraeumen(seite);
    /* 10 Nachricht im Unterthema (Rechtsklick → Melden) */
    const com = await seite.evaluate(() => {
      const c = state.communities.find((x) => x.id === 'c-fremd');
      renderCommunityChat(c, c.channels[0], 'Allgemein');
      return !!c;
    });
    await seite.waitForSelector(`#commMsgs [data-msgid="${ID.kanalmsg}"]`, { timeout: 8000 }).catch(() => {});
    if (com) await seite.click(`#commMsgs [data-msgid="${ID.kanalmsg}"]`, { button: 'right' }).catch(() => {});
    await seite.waitForSelector('[data-kanalmelden]', { timeout: 3000 }).catch(() => {});
    pruefe('Unterthema: Nachricht melden per Rechtsklick/lange drücken', !!(await seite.$('[data-kanalmelden]')));
    await seite.click('[data-kanalmelden]');
    await seite.click('[data-mkat="mobbing"]');
    await seite.fill('#meldenText', 'Beleidigt alle im Unterthema');
    await seite.check('#meldenHaken');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b9 = meldenBody(aufrufe);
    pruefe('Unterthema: art kanal_nachricht mit Nachricht-ID', b9 && b9.art === 'kanal_nachricht' && b9.ziel === ID.kanalmsg, JSON.stringify(b9));
    await seite.click('#meldenFertig').catch(() => {});

    await aufraeumen(seite);
    /* 11 Einstellungen: Problem melden, Meine Meldungen, Kontostatus, Moderation */
    await seite.evaluate(() => zuDenEinstellungen('hilfe'));
    await seite.waitForSelector('[data-setting="Problem melden"]', { timeout: 8000 });
    pruefe('Hilfe: Problem melden, Meine Meldungen, Kontostatus, Moderation', !!(await seite.$('[data-setting="Meine Meldungen"]')) && !!(await seite.$('[data-setting="Kontostatus"]')) && !!(await seite.$('[data-setting="Moderation"]')));
    await bild(seite, 'rs3-9-einstellungen');
    await seite.click('[data-setting="Problem melden"]');
    await seite.waitForSelector('#meldenText', { timeout: 5000 });
    pruefe('Problem: ohne Kategorie und ohne Häkchen', !(await seite.$('[data-mkat]')) && !(await seite.$('#meldenHaken')));
    await seite.fill('#meldenText', 'Videos laden nicht im WLAN');
    await seite.click('#meldenSenden');
    await seite.waitForSelector('[data-melden-bestaetigung]', { timeout: 5000 }).catch(() => {});
    const b10 = meldenBody(aufrufe);
    pruefe('Problem melden speichert: POST /api/melden art problem', b10 && b10.art === 'problem' && b10.begruendung === 'Videos laden nicht im WLAN', JSON.stringify(b10));
    pruefe('Problem: eigene Eingangsbestätigung', /Danke, deine Nachricht ist angekommen/.test((await seite.textContent('[data-melden-bestaetigung]').catch(() => '')) || ''));
    await seite.click('#meldenFertig').catch(() => {});

    await seite.click('[data-setting="Meine Meldungen"]');
    await seite.waitForSelector('[data-kstatus-ohne-schema]', { timeout: 5000 }).catch(() => {});
    pruefe('Meine Meldungen ohne Schema 102: ehrlicher Hinweis, keine leere Liste', /kommt mit dem nächsten Update/.test((await seite.textContent('[data-kstatus-ohne-schema]').catch(() => '')) || '') && !(await seite.$('[data-kstatus-leer]')));
    await bild(seite, 'rs3-10-meine-ohne-schema');
    await seite.keyboard.press('Escape');
    // Fund 12: mit Schema 102 stehen die weiteren Rechtsbehelfe auch unter „Meine Meldungen".
    antworten['/api/meldungen/meine'] = { ok: true, fehlt: false, zeilen: [{ id: 'mm-1', art: 'post', kategorie: 'hass', status: 'entschieden', massnahme: 'keine', begruendung: 'Kein Verstoß erkennbar: Zitat in einem Nachrichtenbeitrag.', erstellt: '2026-10-20T10:00:00Z', entschieden: '2026-10-21T10:00:00Z', widerspruch_bis: '2027-04-21T10:00:00Z', beschwerde_status: null }] };
    await seite.click('[data-setting="Meine Meldungen"]');
    await seite.waitForSelector('[data-kstatus="mm-1"]', { timeout: 5000 }).catch(() => {});
    pruefe('Fund 12: Meine Meldungen nennen Streitbeilegungsstelle und Gericht', /Streitbeilegungsstelle/.test((await seite.textContent('[data-kstatus-weitere]').catch(() => '')) || '') && /Gericht/.test((await seite.textContent('[data-kontostatus="meine"]').catch(() => '')) || ''));
    await bild(seite, 'rs3-10b-meine-rechtsbehelfe');
    await seite.keyboard.press('Escape');

    await seite.click('[data-setting="Kontostatus"]');
    await seite.waitForSelector(`[data-kstatus="${ID.meldung}"]`, { timeout: 5000 }).catch(() => {});
    const kst = (await seite.textContent(`[data-kstatus="${ID.meldung}"]`).catch(() => '')) || '';
    pruefe('Kontostatus: Maßnahme, Grund, Begründung, Frist', /Der Inhalt wurde entfernt/.test(kst) && /Community-Richtlinien/.test(kst) && /beleidigt eine Mitschülerin/.test(kst) && /Widerspruch möglich bis 20\.04\.2027/.test(kst), kst);
    await seite.click(`[data-widersprechen="${ID.meldung}"]`);
    await seite.fill('#widerspruchText', 'Das war ein Witz unter Freunden');
    await bild(seite, 'rs3-11-kontostatus');
    await seite.click('#widerspruchSenden');
    await seite.waitForTimeout(500);
    const w = [...aufrufe].reverse().find((a) => a.pfad === `/api/meldungen/${ID.meldung}/widersprechen`);
    pruefe('Widersprechen: POST mit Text', !!w && JSON.parse(w.body || '{}').text === 'Das war ein Witz unter Freunden');
    pruefe('Widerspruch bestätigt im Blatt', /Dein Widerspruch ist angekommen/.test(await seite.textContent('[data-kontostatus]')));
    await seite.keyboard.press('Escape');

    /* 12 Moderation */
    await seite.click('[data-setting="Moderation"]');
    await seite.waitForSelector('[data-modmeldung]', { timeout: 5000 }).catch(() => {});
    const reihe = await seite.$$eval('[data-modmeldung]', (e) => e.map((x) => x.dataset.modmeldung));
    pruefe('Moderation: dringende oben (Kindesmissbrauch, dann Drohung)', reihe[0] === 'm-km' && reihe[1] === 'm-echt', reihe.join(','));
    pruefe('Moderation: Mehrfachmeldung sichtbar', /3× gemeldet/.test(await seite.textContent('[data-modmeldung="m-spam"]')));
    await bild(seite, 'rs3-12-moderation-liste');
    await seite.click('[data-modmeldung="m-km"]');
    await seite.waitForSelector('[data-beleg-verborgen]', { timeout: 3000 }).catch(() => {});
    const verborgen = (await seite.textContent('[data-moddetail]').catch(() => '')) || '';
    pruefe('verborgener Beleg: KEIN Inhalt, nur der Ablauf', !!(await seite.$('[data-beleg-verborgen]')) && !(await seite.$('[data-beleg]')) && /nicht öffnen/.test(verborgen) && /BKA/.test(verborgen) && /Internet-Beschwerdestelle/.test(verborgen));
    pruefe('Fund 7: kein „Inhalt anzeigen" bei Kindesmissbrauch', !(await seite.$('[data-modmedium]')));
    pruefe('Fund 5: Grundlage nur Gesetz, Richtlinien gesperrt', (await seite.$eval('[name="modGrundlage"][value="gesetz"]', (e) => e.checked)) && (await seite.$eval('[name="modGrundlage"][value="regeln"]', (e) => e.disabled)));
    pruefe('Fund 5: Vorbelegt ist „Inhalt entfernen", nicht „Entfernen und sperren"', await seite.$eval('[name="modMassnahme"][value="entfernen"]', (e) => e.checked));
    const kmVorlage = await seite.$eval('#modBegruendung', (e) => e.value);
    pruefe('Fund 17: Vorlage ohne „Behörden"', /§ 184b StGB/.test(kmVorlage) && !/Behörde|BKA|gemeldet/i.test(kmVorlage), kmVorlage);
    pruefe('Fund 6: Art.-18-Pflichtschritt mit u-entrance und Feld', !!(await seite.$('[data-art18] a[href="https://u-entrance.bka.de"]')) && !!(await seite.$('#modArt18')));
    await bild(seite, 'rs3-13-verborgen');
    await seite.check('[name="modMassnahme"][value="keine"]');
    pruefe('Fund 17: bei „Nichts tun" keine Vorlage', (await seite.$eval('#modBegruendung', (e) => e.value)) === '');
    await seite.check('[name="modMassnahme"][value="entfernen_sperren"]');
    pruefe('Fund 5: „Bestätigt durch" erscheint erst bei der Sperre', await seite.$eval('#modBestaetigtGruppe', (e) => !e.hidden));
    pruefe('Fund 5: Vorlage kommt bei Entfernen zurück', /§ 184b StGB/.test(await seite.$eval('#modBegruendung', (e) => e.value)));
    await seite.click('#modEntscheiden');
    pruefe('Fund 5: Sperre ohne Bestätigung → Fehler, nichts gesendet', /bestätigt/.test(await seite.$eval('#modFehler', (e) => (e.hidden ? '' : e.textContent))) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-km'));
    await seite.fill('#modBestaetigt', 'Sichtung durch geschulte Person, 31.10.2026');
    await seite.click('#modEntscheiden');
    pruefe('Fund 6: Sperre ohne BKA-Vermerk → Fehler, nichts gesendet', /BKA/.test(await seite.$eval('#modFehler', (e) => (e.hidden ? '' : e.textContent))) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-km'));
    await seite.fill('#modArt18', 'kurz');
    await seite.click('#modArt18Senden');
    await seite.waitForTimeout(300);
    pruefe('Fund 6: zu kurzer Vermerk → Fehler im Block', /mindestens 5 Zeichen/.test(await seite.$eval('#modArt18Fehler', (e) => (e.hidden ? '' : e.textContent))));
    await seite.fill('#modArt18', 'u-entrance, 31.10.2026, Vorgang 4711');
    await seite.click('#modArt18Senden');
    await seite.waitForSelector('[data-art18-vermerkt]', { timeout: 3000 }).catch(() => {});
    const a18 = [...aufrufe].reverse().find((a) => a.pfad === '/api/moderation/art18');
    pruefe('Fund 6: POST /api/moderation/art18 mit Meldung und Vermerk', !!a18 && JSON.parse(a18.body).meldung === 'm-km' && /Vorgang 4711/.test(JSON.parse(a18.body).vermerk) && !!(await seite.$('[data-art18-vermerkt]')));
    await bild(seite, 'rs3-13b-kindesmissbrauch-sperre');
    pruefe('Fund 17: „Begründung zurückstellen“ bei Kindesmissbrauch', await seite.$eval('#modZurueckGruppe', (e) => !e.hidden));
    await seite.check('#modZurueck');
    await seite.click('#modEntscheiden');
    await seite.waitForTimeout(500);
    const ekm = [...aufrufe].reverse().find((a) => a.pfad === '/api/moderation/meldungen/m-km');
    const ekb = ekm ? JSON.parse(ekm.body || '{}') : {};
    pruefe('Fund 5: Entscheidung mit bestaetigt, Grundlage Gesetz, Vorschrift in der Begründung', ekb.massnahme === 'entfernen_sperren' && ekb.grundlage === 'gesetz' && /geschulte Person/.test(ekb.bestaetigt || '') && /§ 184b StGB/.test(ekb.begruendung || ''), JSON.stringify(ekb));
    pruefe('Fund 17: zurückstellen geht mit', ekb.zurueckstellen === true);

    /* 12b Entschieden: Sperre nachtragen, Begründung nachsenden (31.10.) */
    await seite.waitForSelector('[data-modstatus="entschieden"]', { timeout: 3000 }).catch(() => {});
    if (!(await seite.$('[data-modstatus="entschieden"]')) && (await seite.$('[data-modzurueck]'))) await seite.click('[data-modzurueck]');
    await seite.waitForSelector('[data-modstatus="entschieden"]', { timeout: 3000 });
    await seite.click('[data-modstatus="entschieden"]');
    await seite.waitForSelector('[data-modmeldung="m-km2"]', { timeout: 3000 });
    pruefe('Liste zeigt „zurückgestellt“', !!(await seite.$('[data-modmeldung="m-km2"] [data-zurueckgestellt]')));
    await seite.click('[data-modmeldung="m-km2"]');
    await seite.waitForSelector('[data-modnachtrag]', { timeout: 3000 }).catch(() => {});
    pruefe('Fund 5: nach Entfernen „Konto sperren“ mit Bestätigung möglich', !!(await seite.$('[data-modnachtrag] #modNBestaetigt')) && !!(await seite.$('#modNachtrag')));
    pruefe('Fund 17: „Begründung jetzt senden“ bei zurückgestellter Begründung', !!(await seite.$('#modNachsenden')));
    await seite.click('#modNachtrag');
    pruefe('Sperre nachtragen ohne Bestätigung → Fehler, nichts gesendet', /bestätigt/.test(await seite.$eval('#modNFehler', (e) => (e.hidden ? '' : e.textContent))) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-km2/sperre'));
    await seite.fill('#modNBestaetigt', 'Sichtung durch geschulte Person, 31.10.2026');
    await seite.fill('#modNBegruendung', 'Bestätigt: Darstellung nach § 184b StGB im entfernten Beitrag.');
    await bild(seite, 'rs3-13c-sperre-nachtragen');
    await seite.click('#modNachtrag');
    await seite.waitForTimeout(500);
    const nt = [...aufrufe].reverse().find((a) => a.pfad === '/api/moderation/meldungen/m-km2/sperre');
    const ntb = nt ? JSON.parse(nt.body || '{}') : {};
    pruefe('POST …/sperre mit Bestätigung und Vorschrift', /geschulte Person/.test(ntb.bestaetigt || '') && /§ 184b/.test(ntb.begruendung || ''), JSON.stringify(ntb));
    await seite.waitForSelector('[data-modmeldung="m-km2"]', { timeout: 3000 });
    await seite.click('[data-modmeldung="m-km2"]');
    await seite.waitForSelector('#modNachsenden', { timeout: 3000 });
    await seite.click('#modNachsenden');
    await seite.waitForTimeout(500);
    pruefe('POST …/nachsenden', aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-km2/nachsenden' && a.methode === 'POST'));
    await seite.waitForSelector('[data-modstatus="eingegangen"]', { timeout: 3000 });
    await seite.click('[data-modstatus="eingegangen"]');
    await seite.waitForSelector('[data-modmeldung]', { timeout: 3000 }).catch(() => {});
    if (await seite.$('[data-modzurueck]')) await seite.click('[data-modzurueck]');
    await seite.waitForSelector('[data-modmeldung="m-echt"]', { timeout: 3000 });
    pruefe('Fund 6: Liste zeigt „Art. 18 offen" bei der Drohung', /Art\. 18 offen/.test(await seite.textContent('[data-modmeldung="m-echt"]')) && !/Art\. 18 offen/.test(await seite.textContent('[data-modmeldung="m-spam"]')));
    await seite.click('[data-modmeldung="m-echt"]');
    await seite.waitForSelector('[data-beleg-urteil]', { timeout: 3000 }).catch(() => {});
    pruefe('Fund 6: Drohung hat den Art.-18-Schritt, Ablauf „zusätzlich Beschwerdestelle", 110', /ersetzt die Meldung an das BKA nicht/.test((await seite.textContent('[data-art18]').catch(() => '')) || '') && !!(await seite.$('[data-art18] a[href="tel:110"]')));
    pruefe('E2E-Beleg geprüft: „echt"', (await seite.getAttribute('[data-beleg-urteil]', 'data-beleg-urteil').catch(() => '')) === 'echt');
    await bild(seite, 'rs3-14-beleg-echt');
    await seite.click('[data-modzurueck]');
    await seite.waitForSelector('[data-modmeldung="m-falsch"]', { timeout: 3000 });
    await seite.click('[data-modmeldung="m-falsch"]');
    await seite.waitForSelector('[data-beleg-urteil]', { timeout: 3000 }).catch(() => {});
    pruefe('veränderter Text: „stimmt nicht"', (await seite.getAttribute('[data-beleg-urteil]', 'data-beleg-urteil').catch(() => '')) === 'falsch');
    pruefe('Fund 30: Urteilstext neutral (Chiffre, später bearbeitet)', /gespeicherten Chiffre/.test(await seite.textContent('[data-beleg-urteil]')) && /bearbeitet/.test(await seite.textContent('[data-beleg-urteil]')));
    await bild(seite, 'rs3-14b-beleg-neutral');
    await seite.check('[name="modMassnahme"][value="entfernen"]');
    pruefe('Fund 8: Klausel-Auswahl bei Richtlinien, Mobbing → Abschnitt 5', (await seite.$eval('#modKlauselGruppe', (e) => !e.hidden)) && (await seite.$eval('#modKlausel', (e) => e.value)) === '5');
    pruefe('Fund 8: zehn Verbots-Abschnitte mit Nummer zur Wahl', (await seite.$$eval('#modKlausel option', (o) => o.filter((x) => x.value).map((x) => x.textContent))).join('|') === window_klauseln());
    await seite.fill('#modBegruendung', 'Die Nachricht nennt die Mitschülerin „fett und dumm".');
    await seite.selectOption('#modKlausel', '');
    await seite.click('#modEntscheiden');
    pruefe('Fund 8: ohne Klausel → Fehler, nichts gesendet', /Abschnitt der Community-Richtlinien/.test(await seite.$eval('#modFehler', (e) => (e.hidden ? '' : e.textContent))) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-falsch'));
    await seite.selectOption('#modKlausel', '5');
    await bild(seite, 'rs3-14c-klausel');
    await seite.click('#modEntscheiden');
    await seite.waitForTimeout(500);
    const ef = [...aufrufe].reverse().find((a) => a.pfad === '/api/moderation/meldungen/m-falsch');
    const efb = ef ? JSON.parse(ef.body || '{}') : {};
    pruefe('Fund 8: Begründung nennt Nummer und Titel der Klausel', efb.grundlage === 'regeln' && /Community-Richtlinien, Abschnitt 5 „Mobbing und Belästigung“/.test(efb.begruendung || ''), JSON.stringify(efb));
    await seite.waitForSelector('[data-modmeldung]', { timeout: 3000 }).catch(() => {});
    if (await seite.$('[data-modzurueck]')) await seite.click('[data-modzurueck]');
    await seite.waitForSelector('[data-modmeldung="m-spam"]', { timeout: 3000 });
    await seite.click('[data-modmeldung="m-spam"]');
    await seite.waitForSelector('#modEntscheiden', { timeout: 3000 });
    pruefe('Vorlage je Kategorie vorbelegt', /Betrug/.test(await seite.$eval('#modBegruendung', (e) => e.value)));
    pruefe('Fund 7: Medium nur als Knopf, kein Bild vor dem Klick', !!(await seite.$('[data-modmedium]')) && !(await seite.$('[data-modmedium-zeigt]')) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-spam/medium'));
    await seite.click('[data-modmedium]');
    await seite.waitForSelector('[data-modmedium-zeigt]', { timeout: 3000 }).catch(() => {});
    pruefe('Fund 7: „Inhalt anzeigen" holt die Adresse und zeigt das Bild', aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-spam/medium') && (await seite.$eval('[data-modmedium-zeigt]', (e) => e.tagName === 'IMG' && e.naturalWidth === 1).catch(() => false)));
    await bild(seite, 'rs3-15a-medium');
    await seite.check('[name="modMassnahme"][value="entfernen_sperren"]');
    pruefe('Sperrdauer erscheint bei „sperren"', await seite.$eval('#modSperreGruppe', (e) => !e.hidden));
    pruefe('Fund 19: bei Betrug kein „Ohne Enddatum"', !(await seite.$$eval('#modSperre option', (o) => o.map((x) => x.textContent))).includes('Ohne Enddatum'));
    pruefe('Fund 11: Feld Vorschrift bei Grundlage Gesetz sichtbar', await seite.$eval('#modNormGruppe', (e) => !e.hidden));
    await seite.click('#modEntscheiden');
    const mf = await seite.$eval('#modFehler', (e) => (e.hidden ? '' : e.textContent));
    pruefe('nur die Vorlage: Fehler im Bereich, nichts gesendet', /Tatsachen/.test(mf) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-spam'), mf);
    await seite.fill('#modBegruendung', 'Kurz');
    await seite.click('#modEntscheiden');
    pruefe('Begründung < 20 Zeichen: Fehler im Bereich', /20 Zeichen/.test(await seite.$eval('#modFehler', (e) => e.textContent)));
    await seite.fill('#modBegruendung', 'Der Beitrag wirbt mit einem falschen Gewinnspiel um Kontodaten.');
    await seite.selectOption('#modSperre', '30');
    await seite.click('#modEntscheiden');
    const nf = await seite.$eval('#modFehler', (e) => (e.hidden ? '' : e.textContent));
    pruefe('Fund 11: ohne Vorschrift → verständlicher Fehler, nichts gesendet', /Vorschrift/.test(nf) && /§/.test(nf) && !aufrufe.some((a) => a.pfad === '/api/moderation/meldungen/m-spam'), nf);
    await seite.fill('#modNorm', '§ 263 StGB');
    await bild(seite, 'rs3-15-entscheidung');
    await seite.click('#modEntscheiden');
    await seite.waitForTimeout(500);
    const e1 = [...aufrufe].reverse().find((a) => a.pfad === '/api/moderation/meldungen/m-spam');
    const eb = e1 ? JSON.parse(e1.body || '{}') : {};
    pruefe('Entscheidung: Maßnahme, Grundlage, Begründung, Sperrdauer', eb.massnahme === 'entfernen_sperren' && eb.grundlage === 'gesetz' && /Gewinnspiel/.test(eb.begruendung) && String(eb.sperreTage) === '30', JSON.stringify(eb));
    pruefe('Fund 11: Vorschrift steht in der Begründung', /\(Vorschrift: § 263 StGB\)$/.test(eb.begruendung || ''), eb.begruendung);

    await seite.click('[data-modtab="beschwerden"]');
    await seite.waitForSelector('[data-modbeschwerde="b-1"]', { timeout: 3000 }).catch(() => {});
    pruefe('Widersprüche: Liste mit Text und Entscheidung', /Witz unter Freunden/.test((await seite.textContent('[data-modbeschwerde="b-1"]').catch(() => '')) || ''));
    await seite.click('[data-bergebnis="aufgehoben"]');
    pruefe('Aufheben ohne Begründung: Fehler im Bereich', /20 Zeichen/.test(await seite.$eval('[data-bfehler]', (e) => (e.hidden ? '' : e.textContent))));
    await seite.fill('[data-bbegruendung]', 'Im Zusammenhang erkennbar ein Scherz unter Freunden.');
    await bild(seite, 'rs3-16-widersprueche');
    await seite.click('[data-bergebnis="aufgehoben"]');
    await seite.waitForTimeout(500);
    const bb = [...aufrufe].reverse().find((a) => a.pfad === '/api/moderation/beschwerden/b-1');
    pruefe('Widerspruch aufheben: POST ergebnis + Begründung', !!bb && JSON.parse(bb.body).ergebnis === 'aufgehoben' && /Scherz/.test(JSON.parse(bb.body).begruendung));
    await seite.click('[data-modtab="zahlen"]');
    await seite.waitForSelector('[data-modzahlen]', { timeout: 3000 }).catch(() => {});
    const zahlen = (await seite.textContent('[data-moderation]').catch(() => '')) || '';
    pruefe('Zahlen aus moderation_zahlen', /Meldungen\s*12/.test(zahlen) && /5\.5 Std/.test(zahlen) && /Betrug oder Spam\s*8/.test(zahlen), zahlen.replace(/\s+/g, ' ').slice(0, 160));
    await bild(seite, 'rs3-17-zahlen');
    await seite.keyboard.press('Escape');

    await aufraeumen(seite);
    /* 13 Rechtsmitteilung in der Glocke */
    const glocke = await seite.evaluate(async () => {
      await openMitteilungen('videos');
      return document.querySelector('.mitt__text')?.textContent || '';
    });
    pruefe('Glocke: Rechtsmitteilung mit Text aus der Datenbank', /Danke, deine Meldung ist angekommen/.test(glocke), glocke);
    await bild(seite, 'rs3-18-glocke');
    await seite.click('[data-mitt="n-1"]');
    await seite.waitForSelector('[data-kontostatus="meine"]', { timeout: 3000 }).catch(() => {});
    pruefe('Antippen führt zu „Meine Meldungen"', !!(await seite.$('[data-kontostatus="meine"]')));
    await seite.close();

    /* 14 Ohne Moderatorrolle kein Moderationsbereich */
    const ohne = await neueSeite(false, antworten);
    if (!(await ohne.seite.evaluate(() => !!window.Meldung))) await ohne.seite.addScriptTag({ url: '/gemeinsam/meldung.js' });
    await ohne.seite.evaluate(() => zuDenEinstellungen('hilfe'));
    await ohne.seite.waitForSelector('[data-setting="Problem melden"]', { timeout: 8000 });
    pruefe('kein Moderator: kein Eintrag „Moderation"', !(await ohne.seite.$('[data-setting="Moderation"]')));
    await ohne.seite.close();

    pruefe('keine Fehler in der Seite', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
}

/* -------------------------------------- X außerhalb der Dateiliste */
function teilX() {
  bereich = 'aussen';
  console.log('\nX  Außerhalb der Dateiliste von RS 3 (Hauptagent) — rot, bis nachgetragen');
  pruefe('web/public/index.html lädt /gemeinsam/meldung.js', /<script src="\/gemeinsam\/meldung\.js"><\/script>/.test(lies('web/public/index.html')));
  pruefe("app/test/_modulquelle.js: ['meldung', 'Meldung'] in UMD_BAUSTEINE", /\['meldung', 'Meldung'\]/.test(lies('app/test/_modulquelle.js')));
  pruefe("NachrichtSheet: Punkt 'melden' bei fremden Nachrichten", /key: 'melden'/.test(lies('app/components/NachrichtSheet.tsx')) && /'melden'/.test(lies('app/components/NachrichtSheet.tsx').match(/export type NachrichtAktion[\s\S]*?;/)?.[0] || ''));
  pruefe('lib/daten.ts reicht notifications.text durch', /text: b\.text/.test(lies('app/lib/daten.ts').match(/export async function ladeMitteilungen[\s\S]*?\n}\n/)?.[0] || ''));
  pruefe("App.tsx: Mitteilung 'meldung' öffnet Meine Meldungen/Kontostatus", /ziel\.art === 'meldung'/.test(lies('app/App.tsx')));
}

(async () => {
  teilA();
  await teilL();
  if (!process.env.OHNE_BROWSER) await teilB();
  teilX();
  const [e1, e2] = zaehler.eigen;
  const [x1, x2] = zaehler.aussen;
  console.log(`\nRS 3: ${e1}/${e2} Prüfungen bestanden · außerhalb der Liste: ${x1}/${x2}`);
  console.log(`${e1 + x1}/${e2 + x2} Prüfungen bestanden`);
  process.exit(e1 === e2 && x1 === x2 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
