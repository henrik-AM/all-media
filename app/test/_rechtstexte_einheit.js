#!/usr/bin/env node
/**
 * gemeinsam/rechtstexte.js ohne Netz prüfen (Auftrag Recht/Sicherheit
 * 21.10., Kasten RS 1, eingebaut 24.10.2026). Vorlage _konto_loeschen_einheit.js.
 *
 * Was hier geprüft wird:
 *   - die Texte selbst (vollständig, Altersgrenze aus alter.js, keine alten Fehler)
 *   - Fassung und Text gehören zusammen: Ändert sich ein Text, muss die
 *     Fassung steigen und die Prüfsumme unten nachgetragen werden — sonst
 *     hätten Zustimmungen mit „Fassung 1" zwei verschiedene Texte gemeint.
 *   - App und Website zeigen dieselben Dokumente, haben beide das Häkchen
 *     und beide die Wege ohne Anmeldung.
 *
 * Start: node test/_rechtstexte_einheit.js
 *        node test/_rechtstexte_einheit.js --launch   (zusätzlich: kein ⟦Platzhalter⟧ mehr)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const R = require('../../gemeinsam/rechtstexte');
const Alter = require('../../gemeinsam/alter');

const LAUNCH = process.argv.includes('--launch');
const wurzel = path.join(__dirname, '..', '..');
const lies = (datei) => fs.readFileSync(path.join(wurzel, datei), 'utf8');

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/*
 * Prüfsumme je Dokument und Fassung (erste 16 Zeichen SHA-256 von alsText).
 * Neuer Text → Fassung im Dokument erhöhen, Zeile hier ergänzen. Ausnahme bis zum
 * Launch: Fassung 1 war nie live und niemand hat ihr zugestimmt, sie wird ersetzt.
 */
const PRUEFSUMMEN = {
  kurz_erklaert: { 1: '8bbbd3a159c055f7' },
  nutzungsbedingungen: { 1: '093abb7871ad3802' },
  community_richtlinien: { 1: '78549dde77a7bbe0' },
  datenschutz: { 1: '73aa228acb1edf9d' },
  eltern_info: { 1: 'b14f4267ef4df3fe' },
  impressum: { 1: 'de376c5e63a63a01' },
  kinderschutz: { 1: '8d5531d4ef88510d' },
  konto_loeschen: { 1: 'eb8c47750a80e28d' },
};

console.log('\n1. Die Texte');
const ids = R.liste().map((d) => d.id);
pruefe('sechs Dokumente', ids.length === 6, ids.join(', '));
pruefe('zwei öffentliche Seiten für die Stores', R.SEITEN.join() === 'kinderschutz,konto_loeschen' && R.SEITEN.every((id) => !ids.includes(id)));
for (const id of ids.concat(R.SEITEN)) {
  const d = R.dokument(id);
  pruefe(`${id}: Titel, Fassung, Abschnitte mit Text`,
    !!d.titel && d.version >= 1 && d.abschnitte.length > 0 && d.abschnitte.every((a) => a.titel && a.text.length && a.text.every((t) => t.trim())));
  const summe = crypto.createHash('sha256').update(R.alsText(id)).digest('hex').slice(0, 16);
  const soll = (PRUEFSUMMEN[id] || {})[d.version];
  pruefe(`${id}: Text passt zu Fassung ${d.version}`, summe === soll, soll ? '' : `neue Fassung? Prüfsumme ${summe} eintragen`);
  pruefe(`${id}: fassung() liefert die Prüfsumme des mitgelieferten Texts (F6)`, R.fassung(id) && R.fassung(id).version === d.version && R.fassung(id).pruefsumme === summe,
    R.fassung(id) && R.fassung(id).pruefsumme === summe ? '' : `in gemeinsam/rechtstexte.js PRUEFSUMMEN.${id} = '${summe}' eintragen`);
}
const alles = ids.concat(R.SEITEN).map((id) => R.alsText(id)).join('\n');
const de = Alter.grenzeFuer('DE');
pruefe('Altersgrenze Deutschland aus alter.js', alles.includes(`ab ${de.mindestalter} Jahren`), `ab ${de.mindestalter}`);
pruefe('kein „ab 13" mehr (galt nie für Deutschland)', !/ab 13 Jahren/.test(alles));
pruefe('kein „nicht mit Dritten geteilt"', !/nicht mit Dritten/.test(alles));
pruefe('Datenschutz nennt alle Empfänger', ['Supabase', 'Render', 'Have I Been Pwned', 'OpenStreetMap', 'Esri'].every((w) => R.alsText('datenschutz').includes(w)));
pruefe('Datenschutz: Telefonbuch wird gesendet, nur Hashwert gespeichert', /schickt die App die Telefonnummern/.test(alles) && /nur einen Hashwert \(SHA-256\)/.test(alles));
pruefe('Datenschutz: Zahlungsdaten genannt', /letzten vier Ziffern/.test(R.alsText('datenschutz')));
pruefe('Impressum: § 5 DDG und Art. 11/12 DSA', /§ 5 DDG/.test(R.alsText('impressum')) && /Art\. 11 und 12 DSA/.test(R.alsText('impressum')));
/* Google Play, Child Safety Standards: die fünf Bestandteile (Recherche R2, 6.2). */
const ks = R.alsText('kinderschutz');
pruefe('Kinderschutz: App- und Anbietername, Meldeweg in der App, Umgang, Gesetze, Kontaktperson',
  /App All Media/.test(ks) && ks.includes('Anbieter:') && /„Melden"/.test(ks) && /Bundeskriminalamt/.test(ks) &&
  /Gesetz über digitale Dienste/.test(ks) && /Kinderschutz-Kontaktperson/.test(ks));
pruefe('Kinderschutz: Chats werden nicht gescannt', /scannen sie nicht/.test(ks));
const kl = R.alsText('konto_loeschen');
pruefe('Konto löschen: Weg in der App, Weg ohne App, was gelöscht wird, was bleibt',
  /Einstellungen → Konto → „Konto löschen"/.test(kl) && /Ohne App/.test(kl) && /Was gelöscht wird/.test(kl) && /bis zum Ende der Sperre/.test(kl));
pruefe('nur Zweierchats heißen Ende-zu-Ende', !/(Gruppen|Community-Chats|Anhänge|Anrufe)[^.]*sind Ende-zu-Ende/.test(alles));

console.log('\n2. Zustimmung');
const z = R.zustimmungsDaten(new Date('2026-10-24T12:00:00Z'));
pruefe('Zeitpunkt, Pflicht-Dokumente und Kenntnisnahme mit Fassung',
  z.zustimmung_am === '2026-10-24T12:00:00.000Z' && z.zustimmung_nutzungsbedingungen === '1' &&
  z.zustimmung_community_richtlinien === '1' && z.kenntnis_datenschutz === '1');
pruefe('nur Zeichenketten (signUp-Metadaten)', Object.values(z).every((w) => typeof w === 'string'));

console.log('\n3. App und Website gleichauf');
const rechtIds = (quelle) => [...quelle.matchAll(/rechtstext: '([a-z_]+)'/g)].map((m) => m[1]).sort().join(',');
const app = lies('app/screens/profile/SettingsScreen.tsx');
const web = lies('web/public/app.js');
pruefe('Einstellungen der App zeigen alle Dokumente', rechtIds(app) === [...ids].sort().join(','), rechtIds(app));
pruefe('Einstellungen der Website zeigen dieselben', rechtIds(web) === rechtIds(app), rechtIds(web));
pruefe('keine alten Zwei-Satz-Texte mehr', !/info: 'All Media ist für Menschen ab 13/.test(app + web));
pruefe('App: Häkchen bei der Registrierung', /testID="zustimmung"/.test(lies('app/components/RegistrierFelder.tsx')));
pruefe('App: Prüfung lehnt ohne Zustimmung ab', /if \(!konto\.zustimmung\) return Rechtstexte\.ZUSTIMMUNG_FEHLT/.test(lies('app/lib/registrierung.ts')));
pruefe('Website: Häkchen bei der Registrierung, nie vorbelegt', /id="kontoZustimmung"/.test(web) && /zustimmung: false,/.test(web));
const anm = lies('web/public/anmeldung.js');
pruefe('Website: Prüfung lehnt ohne Zustimmung ab', /if \(!zustimmung\) return/.test(anm));
pruefe('Website: Zustimmung geht in die signUp-Metadaten', /\.\.\.window\.Rechtstexte\.zustimmungsDaten\(\)/.test(anm));
pruefe('Website lädt den Baustein nach alter.js', (() => {
  const h = lies('web/public/index.html');
  return h.includes('/gemeinsam/rechtstexte.js') && h.indexOf('/gemeinsam/alter.js') < h.indexOf('/gemeinsam/rechtstexte.js');
})());
pruefe('UMD_BAUSTEINE kennt rechtstexte', /\['rechtstexte', 'Rechtstexte'\]/.test(lies('app/test/_modulquelle.js')));

console.log('\n4. Ohne Anmeldung erreichbar');
const server = lies('web/server/app.js');
pruefe('Server: /recht und /recht/:id', /app\.get\('\/recht'/.test(server) && /app\.get\('\/recht\/:id'/.test(server));
pruefe('Server: Store-Seiten in der Übersicht und unter kurzer Adresse',
  /Rechtstexte\.SEITEN\.map/.test(server) && /'\/kinderschutz'/.test(server) && /app\.get\('\/konto-loeschen'/.test(server));
pruefe('Website: Links auf der Willkommensseite', /href="\/recht\/impressum"/.test(web) && /href="\/recht\/datenschutz"/.test(web));
pruefe('App: Links auf dem Anmeldebildschirm', /setRechtlich\('impressum'\)/.test(lies('app/screens/LoginScreen.tsx')));
pruefe('App: kein „nicht mit Dritten geteilt"', !/nicht mit Dritten geteilt/.test(lies('app/screens/AuthMethodScreen.tsx')));

/*
 * Richtlinie 7.1: Ein neuer Dienst, der Daten bekommt, kommt erst in die
 * Datenschutzerklärung, dann in den Code. Deshalb wird jede Adresse im Code
 * und jede fremde Quelle der CSP gegen diese Liste geprüft — und jeder
 * Eintrag hier gegen den Text der Datenschutzerklärung.
 */
const DIENSTE = {
  'supabase.co': 'Supabase',
  'all-media-website.onrender.com': 'Render',
  'tile.openstreetmap.org': 'OpenStreetMap',
  'tile.opentopomap.org': 'OpenTopoMap',
  'server.arcgisonline.com': 'Esri',
  'nominatim.openstreetmap.org': 'Ortssuche',
  'api.pwnedpasswords.com': 'Have I Been Pwned',
  'bunny.net': 'Bunny.net',
};
/* Adressen, an die All Media nichts schickt: Beispiele, Kommentare, Lizenzen, Links zum Anklicken. */
const OHNE_DATEN = ['www.openstreetmap.org', 'deine-seite.de', 'fremd.example', 'cdn.jsdelivr.net',
  'github.com', 'tweetnacl.cr.yp.to', 'unlicense.org', 'www.w3.org', 'en.wikipedia.org' /* Kommentar in jsQR.js */,
  'www.internet-beschwerdestelle.de' /* Link für Moderatoren in meldung.js (RS 3) */,
  'u-entrance.bka.de' /* Art.-18-Link für Moderatoren in meldung.js (RS 3) */];
const bekannt = (host) => {
  const h = host.replace(/^(\{s\}|\*)\./, '');
  return Object.keys(DIENSTE).some((d) => h === d || h.endsWith('.' + d)) || OHNE_DATEN.includes(h);
};
/** Alle Code-Dateien unter einem Ordner, ohne Prüfläufe, Abhängigkeiten und mitgelieferte Bibliotheken. */
const codeDateien = (ordner) => {
  const aus = [];
  const gehe = (d) => {
    if (!fs.existsSync(path.join(wurzel, d))) return;
    for (const e of fs.readdirSync(path.join(wurzel, d), { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['node_modules', 'test', 'lib', '.expo', 'ios', 'android', 'assets'].includes(e.name)) gehe(p);
      } else if (/\.(js|ts|tsx|html)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) aus.push(p);
    }
  };
  ordner.forEach(gehe);
  return aus;
};

console.log('\n5. Dritte und Chatpfad');
const ds = R.alsText('datenschutz');
const fehlenImText = Object.values(DIENSTE).filter((w) => !ds.includes(w));
pruefe('Datenschutz nennt jeden Dienst der Liste', fehlenImText.length === 0, fehlenImText.join(', '));
const dateien = codeDateien(['app/lib', 'app/contexts', 'app/components', 'app/screens', 'app/hooks', 'gemeinsam', 'web/public', 'web/server'])
  .concat(['app/App.tsx'].filter((d) => fs.existsSync(path.join(wurzel, d))));
const fremd = new Set();
for (const d of dateien) {
  for (const m of lies(d).matchAll(/https?:\/\/((?:\{s\}|\*|[a-z0-9-]+)(?:\.[a-z0-9-]+)+)/gi)) {
    if (!bekannt(m[1].toLowerCase())) fremd.add(`${m[1]} (${d})`);
  }
}
pruefe(`keine unbekannte Adresse im Code (${dateien.length} Dateien)`, fremd.size === 0 && dateien.length > 100, [...fremd].slice(0, 5).join('; '));
const csp = (() => {
  const anfang = server.indexOf('directives: {');
  const s = server.slice(anfang, server.indexOf('frameAncestors:', anfang));
  const quelle = (name) => ((s.match(new RegExp(name + ':\\s*\\[([^\\]]*)\\]')) || [])[1] || '');
  return { quelle, hosts: [...s.matchAll(/'https:\/\/([^'/]+)'/g)].map((m) => m[1]) };
})();
pruefe('CSP: Skripte, Stile, Schriften nur vom eigenen Server',
  !/https?:/.test(csp.quelle('scriptSrc') + csp.quelle('styleSrc') + csp.quelle('fontSrc')),
  csp.quelle('scriptSrc') + ' | ' + csp.quelle('fontSrc'));
pruefe('CSP: jede fremde Quelle steht in der Datenschutz-Liste',
  csp.hosts.length >= 5 && csp.hosts.every(bekannt), csp.hosts.filter((h) => !bekannt(h)).join(', ') || `${csp.hosts.length} Quellen`);
/*
 * Chatkontrolle (Richtlinie 6.1, Recht/All-Media-EU-Chatkontrolle.md):
 * All Media scannt keine Inhalte — weder auf dem Gerät noch auf dem Server.
 * Gesucht wird nach Diensten und Bibliotheken, die genau das tun.
 */
const SCAN = /photodna|nsfwjs|@tensorflow|tfjs|rekognition|perspectiveapi|moderations?\.openai|api\.openai\.com\/v1\/moderations|hive\.ai|thehive|safer\.io|thorn\.org|clarifai|sightengine|client.?side.?scan/i;
const scanTreffer = dateien.filter((d) => SCAN.test(lies(d)));
pruefe('kein Scan-Dienst und keine Scan-Bibliothek im Code', scanTreffer.length === 0, scanTreffer.join(', '));
const pakete = ['app/package.json', 'web/package.json'].map((d) => Object.keys({ ...JSON.parse(lies(d)).dependencies }).join(' ')).join(' ');
pruefe('keine Scan-Bibliothek in den Abhängigkeiten', !SCAN.test(pakete));
const schemas = fs.readdirSync(wurzel).filter((d) => /^SUPABASE_SCHEMA_.*\.sql$/.test(d));
const httpAusDb = schemas.filter((d) => /net\.http_(get|post)|extensions\.http\b|\bhttp_post\s*\(/i.test(lies(d)));
pruefe(`keine Datenbank-Funktion schickt Inhalte nach außen (${schemas.length} Schemas)`, httpAusDb.length === 0 && schemas.length > 90, httpAusDb.join(', '));

/*
 * Richtlinie 8.1, L11, § 5 UWG: was nicht wirkt, sagt das. Hier stand ein
 * fest eingetragenes Gerät „All Media Web — zuletzt heute“, ein Knopf
 * „Gerät verknüpfen“ ohne Wirkung und eine Zwei-Faktor-Wahl, die nur
 * gespeichert wurde. Gegenstück für Meldestellen: test/rs3-melden.js (Teil A).
 */
console.log('\n6. Keine Attrappen');
const einstApp = lies('app/screens/profile/SettingsScreen.tsx');
const einstWeb = lies('web/public/app.js');
const zweiFaktor = (q) => (q.match(/\{ label: 'Zwei-Faktor-Anmeldung'[^\n]*\}/) || [''])[0];
for (const [name, q] of [['App', einstApp], ['Website', einstWeb]]) {
  pruefe(`${name}: Zwei-Faktor ohne Wahl, „Noch nicht verfügbar“`,
    !/wahlKey: 'zweiFaktor'/.test(q) && /info: 'Noch nicht verfügbar\./.test(zweiFaktor(q)), zweiFaktor(q).slice(0, 80));
  pruefe(`${name}: kein erfundenes Gerät, kein Knopf „Gerät verknüpfen“`,
    !/'All Media Web'/.test(q) && !/knopf: 'Gerät verknüpfen'/.test(q) && /'Weitere Geräte verknüpfen', neben: 'noch nicht verfügbar'/.test(q));
  pruefe(`${name}: Melden, Meine Meldungen, Kontostatus in den Einstellungen`,
    ['problem', 'meinemeldungen', 'kontostatus'].every((a) => q.includes(`aktion: '${a}'`)));
  // L4, RS 2: Konto löschen ist echt — kein „vorgemerkt“, kein Bestätigungsblatt ohne Wirkung.
  pruefe(`${name}: Konto löschen echt (kein „Löschauftrag vorgemerkt“)`,
    !/(toast|onNotice)\('Löschauftrag vorgemerkt/.test(q) && !/bestaetigen: 'Konto endgültig löschen\?'/.test(q) && /label: 'Konto löschen'[^\n]*aktion: 'kontoLoeschen'/.test(q));
}
const loeschApp = lies('app/components/KontoLoeschenSheet.tsx');
pruefe('Konto löschen: App und Website über denselben Ablauf (KontoLoeschen.ablauf + schritteFuer)',
  /KontoLoeschen\.ablauf\(/.test(loeschApp) && /KontoLoeschen\.schritteFuer\(supabase, user\.email/.test(loeschApp) &&
  /K\.ablauf\(/.test(einstWeb) && /K\.schritteFuer\(db, ich\.email/.test(einstWeb));
pruefe('Konto löschen: vorher „Meine Daten herunterladen“ angeboten (App und Website)',
  /onDatenauskunft/.test(loeschApp) && /#loeschDaten'\)\.addEventListener\('click', datenauskunftLaden\)/.test(einstWeb));
pruefe('Passwort ändern beendet die Sitzungen auf anderen Geräten (Richtlinie 8.4, App und Website)',
  /updateUser\(\{ password: neu \}\)[\s\S]{0,700}signOut\(\{ scope: 'others' \}\)/.test(lies('app/lib/supabaseAuth.ts')) &&
  /updateUser\(\{ password: neu \}\)[\s\S]{0,400}signOut\(\{ scope: 'others' \}\)/.test(lies('web/public/anmeldung.js')));
pruefe('Konto löschen: gelöschtes Konto nicht unter „Frühere Konten“',
  /frueheresVergessen\(id\)/.test(loeschApp) && /fruehereVergessen\(ich\.id\)/.test(einstWeb));

console.log('\n6b. Fassungen in der Datenbank (Schema 106, RS 7)');
{
  const fs106 = require('fs');
  const pfad = require('path').join(__dirname, '..', '..', 'SUPABASE_SCHEMA_106_einwilligung_fassung.sql');
  const sql = fs106.existsSync(pfad) ? fs106.readFileSync(pfad, 'utf8') : '';
  pruefe('Schema 106 vorhanden', sql.length > 0);
  const zeilen = [...sql.matchAll(/\('([a-z_]+)',\s*(\d+),\s*'([0-9a-f]{16})',\s*'(zustimmung|kenntnis)'/g)];
  const pflicht = R.ZUSTIMMUNG_PFLICHT.map((id) => [id, 'zustimmung']).concat(R.ZUR_KENNTNIS.map((id) => [id, 'kenntnis']));
  pruefe('jedes zuzustimmende Dokument steht als Fassung im Schema', zeilen.length > 0 &&
    pflicht.every(([id, art]) => zeilen.some((z) => z[1] === id && z[4] === art)), `${zeilen.length} Zeilen`);
  for (const [id] of pflicht) {
    const d = R.dokument(id);
    const z = zeilen.filter((x) => x[1] === id).sort((x, y) => Number(y[2]) - Number(x[2]))[0];
    const summe = crypto.createHash('sha256').update(R.alsText(id)).digest('hex').slice(0, 16);
    pruefe(`${id}: neueste Fassung im Schema = Fassung und Prüfsumme im Text`,
      !!z && Number(z[2]) === d.version && z[3] === summe,
      z ? `Schema ${z[2]}/${z[3]}, Text ${d.version}/${summe}` : 'fehlt');
  }
}

console.log('\n7. Platzhalter');
const offen = R.platzhalter();
console.log(`  ${offen.length} offen:\n` + offen.map((p) => '    ' + p).join('\n'));
if (LAUNCH) pruefe('vor dem Launch: kein ⟦Platzhalter⟧ mehr', offen.length === 0, `${offen.length} offen`);

console.log(`\n${anzahl - fehler}/${anzahl} bestanden.` + (LAUNCH ? '' : ' (Platzhalter erst mit --launch geprüft)'));
process.exit(fehler ? 1 : 0);
