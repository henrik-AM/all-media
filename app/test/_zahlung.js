/**
 * Spendencode, Zahlungsmethoden, Kontowechsel, nur Testkonten
 * (Feedback 21.09.2026, Kasten 13).
 *
 * WAS GEPRÜFT WIRD
 *
 * Ohne Netz (immer, auch mit --offline):
 *   1. gemeinsam/zahlung.js: Codeform, Normalform, Beträge, keine volle
 *      Kartennummer, PayPal-Maske, Apple Pay nur iOS/Safari, Google Pay nur
 *      Android/Chrome, Ablaufdatum.
 *   2. Der Schemaentwurf: dieselbe Coderegel wie in JS, kein direkter
 *      INSERT in donations mehr, kein Recht für anon/PUBLIC an den neuen
 *      Funktionen, keine Spalte für Kartennummer oder CVC, der Anbieter-Token
 *      ist nicht lesbar.
 *   3. App und Website gleichauf: beide Einstellungen führen Spendencode und
 *      Zahlungsmethoden, jede Spende läuft durch den Spendenweg (App:
 *      useAktionen → SpendenwegContext, Website: openSpende → spendenweg →
 *      /api/spenden → spende_senden), zahlung.js ist eingebunden.
 *   4. Kontowechsel (13.1): abmelden nur lokal, Sitzungen inaktiver Konten
 *      werden widerrufen, kein localStorage.clear() beim Abmelden.
 *   5. Nur Testkonten (13.4): jeder Lauf und jedes Werkzeug mit
 *      Konto-Umgebungsvariable geht durch nurTestkonto().
 *
 * Mit Netz (zwei eigene Testkonten, direkt über supabase-js, kein
 * /api/reset, kein anmelden()):
 *   6. Status, Methoden anlegen (Karte nur mit letzten vier Ziffern),
 *      Standard wechseln, genau ein Standard.
 *   7. Das andere Konto sieht, ändert und löscht die Methoden nicht.
 *   8. Direkter INSERT in donations ist zu; spende_senden weist falschen
 *      Code (mit Restversuchen), Betrag und Selbstspende ab und nimmt die
 *      richtige Spende als „vorgemerkt" an — an das andere TESTKONTO.
 *   9. Ein Code ist eindeutig: das zweite Konto bekommt ihn nicht.
 *  10. Aufräumen mit Gegenprobe. Die Spende selbst kann nur SQL löschen
 *      (SUPABASE_TOKEN); ohne Token bleibt sie beim Testkonto stehen.
 *
 * Start:  node test/_zahlung.js            (alles)
 *         node test/_zahlung.js --offline  (nur 1–5)
 */

const fs = require('fs');
const path = require('path');
const Zahlung = require('../../gemeinsam/zahlung');
const { pruefCode, spendenwegBereit } = require('./_spendencode');
const { TESTKONTEN } = require('./_nur_testkonten');
const { frage } = require('./_aufraeumen');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const OFFLINE = process.argv.includes('--offline');

// Fest, nicht aus der Umgebung: dieser Lauf legt Zahlungsmethoden an.
const PRUEFKONTO = { email: 'all.media.prueflauf@web.de', passwort: 'PruefLauf2026!' };
const TESTKONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

// ------------------------------------------------------------ 1. offline --
function regeln() {
  console.log('\n1. gemeinsam/zahlung.js');
  pruefe('Code „Mein-Code 42" ist gültig', Zahlung.codePruefe('Mein-Code 42') === null);
  pruefe('Normalform ohne Leerzeichen/Bindestrich, groß', Zahlung.codeNormal(' ab-cd 12 ') === 'ABCD12');
  pruefe('Fünf Zeichen sind zu kurz', Zahlung.codePruefe('abc12') !== null);
  pruefe('Siebzehn Zeichen sind zu lang', Zahlung.codePruefe('a'.repeat(17)) !== null);
  pruefe('Umlaute sind nicht erlaubt', Zahlung.codePruefe('Grüße123') !== null);
  pruefe('Leer ist nicht erlaubt', Zahlung.codePruefe('') !== null);
  pruefe('Der Prüfcode besteht die eigene Regel', Zahlung.codePruefe(pruefCode('0f3c9a1e-1234-4bcd-8000-000000000001')) === null);
  pruefe('Prüfcodes zweier Konten unterscheiden sich',
    pruefCode('0f3c9a1e-1234-4bcd-8000-000000000001') !== pruefCode('0f3c9a1f-1234-4bcd-8000-000000000001'));

  pruefe('0,49 € abgewiesen', Zahlung.betragPruefe(49) !== null);
  pruefe('0,50 € angenommen', Zahlung.betragPruefe(50) === null);
  pruefe('1.000 € angenommen', Zahlung.betragPruefe(100000) === null);
  pruefe('1.000,01 € abgewiesen', Zahlung.betragPruefe(100001) !== null);
  pruefe('Kommabeträge in Cent abgewiesen', Zahlung.betragPruefe(250.5) !== null);

  const jetzt = new Date('2026-09-29T12:00:00Z');
  const karte = Zahlung.methodeBauen('karte', { letzte4: '4242', ablauf: '12/28', anzeigename: 'Visa privat' }, null, jetzt);
  pruefe('Karte mit letzten vier Ziffern und Ablauf', karte.zeile && karte.zeile.letzte4 === '4242' && karte.zeile.ablauf_jahr === 2028);
  pruefe('Die Zeile hat kein Feld für Nummer oder CVC',
    karte.zeile && !Object.keys(karte.zeile).some((k) => /nummer|number|cvc|cvv|pan/i.test(k)));
  pruefe('Volle Kartennummer statt letzter vier abgewiesen',
    !!Zahlung.methodeBauen('karte', { letzte4: '4242424242424242', ablauf: '12/28' }, null, jetzt).fehler);
  pruefe('Kartennummer im Namen abgewiesen',
    !!Zahlung.methodeBauen('karte', { letzte4: '4242', ablauf: '12/28', anzeigename: '4242 4242 4242 4242' }, null, jetzt).fehler);
  pruefe('Abgelaufene Karte abgewiesen',
    !!Zahlung.methodeBauen('karte', { letzte4: '4242', ablauf: '08/26' }, null, jetzt).fehler);
  pruefe('Karte im laufenden Monat gilt noch',
    !Zahlung.methodeBauen('karte', { letzte4: '4242', ablauf: '09/26' }, null, jetzt).fehler);
  pruefe('PayPal-Adresse wird maskiert', Zahlung.paypalMaskieren('Max.Mustermann@web.de') === 'ma***@web.de');
  const pp = Zahlung.methodeBauen('paypal', { email: 'max.mustermann@web.de' });
  pruefe('PayPal speichert nur die Maske', pp.zeile && pp.zeile.paypal_maskiert === 'ma***@web.de' && !JSON.stringify(pp.zeile).includes('mustermann'));

  const namen = (u) => Zahlung.anbieterFuer(u).map((a) => a.id).join(',');
  pruefe('iOS-App: Apple Pay, kein Google Pay', namen({ os: 'ios' }) === 'paypal,apple_pay,karte');
  pruefe('Android-App: Google Pay, kein Apple Pay', namen({ os: 'android' }) === 'paypal,google_pay,karte');
  pruefe('Safari: Apple Pay', namen({ os: 'web', browser: 'safari' }) === 'paypal,apple_pay,karte');
  pruefe('Chrome: Google Pay', namen({ os: 'web', browser: 'chrome' }) === 'paypal,google_pay,karte');
  pruefe('Firefox: nur PayPal und Karte', namen({ os: 'web', browser: 'andere' }) === 'paypal,karte');
  const UA = {
    safari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    chrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36',
    edge: 'Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 Edg/128.0',
    crios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/128.0 Mobile/15E148 Safari/604.1',
  };
  pruefe('Browser erkannt: Safari, Chrome, Edge, Chrome auf dem iPhone',
    Zahlung.browserErkennen(UA.safari) === 'safari' && Zahlung.browserErkennen(UA.chrome) === 'chrome' &&
      Zahlung.browserErkennen(UA.edge) === 'andere' && Zahlung.browserErkennen(UA.crios) === 'chrome');
  pruefe('Apple Pay im Firefox wird beim Anlegen abgewiesen',
    !!Zahlung.methodeBauen('apple_pay', {}, { os: 'web', browser: 'andere' }).fehler);
  pruefe('Falscher Code nennt die Restversuche', /noch 3 Versuche/.test(Zahlung.grundText('falscher_code', 3)));
}

function schemaEntwurf() {
  console.log('\n2. SUPABASE_SCHEMA_XX_zahlung_spendencode.sql');
  const sql = lies('SUPABASE_SCHEMA_XX_zahlung_spendencode.sql');
  pruefe('Dieselbe Coderegel wie in JS (6–16, A–Z, Ziffern)',
    sql.includes("'^[A-Za-z0-9]{6,16}$'") && Zahlung.CODE_MIN === 6 && Zahlung.CODE_MAX === 16);
  pruefe('Leerzeichen und Bindestriche fallen auf beiden Seiten weg', sql.includes('[[:space:]-]'));
  pruefe('Die alte INSERT-Regel „Spende senden" wird entfernt', /drop policy if exists "Spende senden" on public\.donations/.test(sql));
  pruefe('… und keine neue angelegt', !/create policy "[^"]*" on public\.donations\s+for insert/i.test(sql));
  pruefe('INSERT/UPDATE/DELETE auf donations entzogen',
    /revoke insert, update, delete on table public\.donations from anon, authenticated/.test(sql));
  const funktionen = [...sql.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
  const ohneRevoke = funktionen.filter(
    (f) => !new RegExp(`revoke (all|execute) on function public\\.${f}\\([^)]*\\)\\s+from public, anon`).test(sql)
  );
  pruefe(`Jede der ${funktionen.length} Funktionen verliert PUBLIC und anon`, ohneRevoke.length === 0, ohneRevoke.join(', '));
  pruefe('Code nur als Hash (bcrypt) und Fingerabdruck (HMAC)',
    sql.includes("extensions.crypt(") && sql.includes("gen_salt('bf'") && sql.includes('extensions.hmac('));
  pruefe('Keine Spalte für Kartennummer oder CVC', !/^\s*(karten)?(nummer|number|cvc|cvv|pan)\s+text/im.test(sql));
  pruefe('Anbieter-Token ist nicht lesbar (nicht in grant select)',
    /grant select \(([^)]*)\)/.test(sql) && !/anbieter_token/.test(sql.match(/grant select \(([^)]*)\)/)[1]));
  pruefe('Name ohne fünf Ziffern am Stück, auch in der Tabelle', sql.includes('[0-9]{5,}'));
  pruefe('Methoden-Regeln nur für die eigene Zeile', (sql.match(/user_id = auth\.uid\(\)/g) || []).length >= 4);
  pruefe('Sperre nach fünf Fehlversuchen', /spendencode_gesperrt/.test(sql) && /\b5\b/.test(sql));
  pruefe('Spenden bleiben vorgemerkt (kein Geld fließt)', sql.includes("'vorgemerkt'"));
  pruefe('Nichts davon steht in SUPABASE_REIHENFOLGE.md', !lies('SUPABASE_REIHENFOLGE.md').includes('XX_zahlung'));

  const t = lies('SUPABASE_SCHEMA_XX_testbestand_nur_testkonten.sql');
  pruefe('Schemaentwurf 13.4 sperrt testbestand_insight und testbestand_profilaufrufe',
    t.includes('testbestand_insight(uuid) from public, anon, authenticated') &&
      t.includes('testbestand_profilaufrufe(uuid) from public, anon, authenticated') &&
      (t.match(/ist_testkonto\(ziel\)/g) || []).length >= 3);
  const pr = lies('berichte/PRUEFUNG_echte_konten_seit_schema62.sql');
  const ohneKommentar = pr.replace(/--.*$/gm, '');
  pruefe('Die Prüfabfrage echter Konten liest nur',
    !/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b/i.test(ohneKommentar));
}

function gleichauf() {
  console.log('\n3. App und Website gleichauf');
  const settings = lies('app/screens/profile/SettingsScreen.tsx');
  const web = lies('web/public/app.js');
  pruefe('App-Einstellungen: Spendencode und Zahlungsmethoden',
    settings.includes("aktion: 'spendencode'") && settings.includes("aktion: 'zahlungsmethoden'"));
  pruefe('Website-Einstellungen: Spendencode und Zahlungsmethoden',
    web.includes("aktion: 'spendencode'") && web.includes("aktion: 'zahlungsmethoden'"));
  const ua = lies('app/lib/useAktionen.ts');
  pruefe('App: jede Spende läuft durch den Spendenweg', ua.includes('spendenweg.spenden(') && ua.includes('SpendenwegContext'));
  pruefe('App: der Provider steht in App.tsx', lies('app/App.tsx').includes('<SpendenwegProvider>'));
  const akt = lies('app/lib/aktionen.ts');
  pruefe('App: spenden() ruft spende_senden, kein INSERT in donations',
    akt.includes("rpc('spende_senden'") && !/from\('donations'\)\s*\.insert/.test(akt));
  const spende = web.slice(web.indexOf('function openSpende('), web.indexOf('function openClip('));
  pruefe('Website: openSpende läuft durch den Spendenweg', spende.includes('spendenweg('));
  pruefe('Website: Server ruft spende_senden', lies('web/server/sync-handlers.js').includes("rpc('spende_senden'"));
  pruefe('Website: /api/spenden reicht Code und Methode weiter',
    /req\.body\?\.code, req\.body\?\.methodeId/.test(lies('web/server/app.js')));
  pruefe('Website: zahlung.js eingebunden', lies('web/public/index.html').includes('/gemeinsam/zahlung.js'));
  pruefe('UMD_BAUSTEINE kennt zahlung', /\['zahlung', 'Zahlung'\]/.test(lies('app/test/_modulquelle.js')));
  pruefe('Beide Blätter nennen die Spende „vorgemerkt"',
    lies('app/components/SpendenwegSheet.tsx').includes('vorgemerkt') && web.includes('Die Spende wird vorgemerkt'));
  pruefe('Kein anderer Weg schreibt in donations',
    !/from\('donations'\)\s*\.(insert|upsert)/.test(web + lies('web/server/sync-handlers.js') + lies('web/server/supabase-api.js') + lies('app/lib/daten.ts')));
}

function kontowechsel() {
  console.log('\n4. Kontowechsel (13.1)');
  const ohneKommentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const auth = ohneKommentar(lies('app/lib/supabaseAuth.ts'));
  pruefe('App: abmelden nur lokal', auth.includes("signOut({ scope: 'local' })") && !auth.includes("scope: 'global'"));
  pruefe('App: Sitzung eines entfernten Kontos wird widerrufen',
    lies('app/lib/kontenspeicher.ts').includes('sitzungWiderrufen') && lies('app/contexts/AuthContext.tsx').includes('sitzungWiderrufen('));
  const anm = lies('web/public/anmeldung.js');
  pruefe('Website: abmelden nur lokal', anm.includes("signOut({ scope: 'local' })"));
  pruefe('Website: Sitzung eines entfernten Kontos wird widerrufen', anm.includes('/auth/v1/logout?scope=local'));
  pruefe('Website: kein localStorage.clear() mehr', !/localStorage\.clear\(\)\s*;/.test(lies('web/public/app.js')));
}

function nurTestkonten() {
  console.log('\n5. Nur Testkonten (13.4)');
  pruefe('Dieselbe Liste wie ist_testkonto()',
    TESTKONTEN.every((m) => lies('SUPABASE_SCHEMA_62_nur_eigene_testkonten.sql').includes(`'${m}'`)));
  const offen = [];
  for (const ordner of ['app/test', 'app/tools']) {
    for (const datei of fs.readdirSync(path.join(WURZEL, ordner))) {
      if (!datei.endsWith('.js')) continue;
      const text = lies(`${ordner}/${datei}`);
      for (const m of text.matchAll(/process\.env\.(AM_TEST_MAIL|TEST_EMAIL)\b/g)) {
        const zeile = text.slice(text.lastIndexOf('\n', m.index) + 1, text.indexOf('\n', m.index));
        if (!zeile.includes('nurTestkonto(') && !/^\s*(\*|\/\/)/.test(zeile)) offen.push(`${ordner}/${datei}`);
      }
    }
  }
  pruefe('Jede Konto-Variable geht durch nurTestkonto()', offen.length === 0, [...new Set(offen)].join(', '));
}

// ---------------------------------------------------------- mit Netz --
async function anmelden(zugang) {
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

async function mitNetz() {
  console.log('\n6. Zahlungsmethoden (@prueflauf)');
  const ich = await anmelden(PRUEFKONTO);
  const du = await anmelden(TESTKONTO);
  const db = ich.client;

  const st = await db.rpc('spendencode_status');
  pruefe('Schema XX_zahlung_spendencode ist eingespielt', !st.error, st.error ? st.error.message : '');
  if (st.error) return;

  const meinCode = pruefCode(ich.id);
  const deinCode = pruefCode(du.id);
  const a = await spendenwegBereit(db, ich.id, meinCode, false);
  const b = await spendenwegBereit(du.client, du.id, deinCode, false);
  pruefe('Beide Testkonten haben Methode und Code', a.ok && b.ok, [a.fehler, b.fehler].filter(Boolean).join(' / '));
  if (!a.ok || !b.ok) return;

  const angelegt = [];
  let spendeId = null;
  try {
    const karte = Zahlung.methodeBauen('karte', { letzte4: '4242', ablauf: '12/30', anzeigename: 'Prüflauf Visa' });
    const k = await db.from('zahlungsmethoden').insert({ ...karte.zeile, standard: true })
      .select('id, anbieter, letzte4, standard').single();
    pruefe('Karte anlegen (nur letzte vier Ziffern)', !k.error && k.data.letzte4 === '4242', k.error && k.error.message);
    if (k.data) angelegt.push(k.data.id);

    const { count: standards } = await db.from('zahlungsmethoden').select('id', { count: 'exact', head: true }).eq('standard', true);
    pruefe('Genau ein Standard, und zwar die neue Karte', standards === 1 && k.data && k.data.standard === true, `Standards: ${standards}`);

    const voll = await db.from('zahlungsmethoden').insert({ anbieter: 'karte', letzte4: '42424242', ablauf_monat: 12, ablauf_jahr: 2030 });
    pruefe('Mehr als vier Ziffern weist die Datenbank ab', !!voll.error);
    const imNamen = await db.from('zahlungsmethoden')
      .insert({ anbieter: 'karte', anzeigename: '4242424242424242', letzte4: '4242', ablauf_monat: 12, ablauf_jahr: 2030 });
    pruefe('Kartennummer im Namen weist die Datenbank ab', !!imNamen.error);
    const token = await db.from('zahlungsmethoden').select('anbieter_token').limit(1);
    pruefe('Anbieter-Token ist für den Client nicht lesbar', !!token.error);
    const pp = await db.from('zahlungsmethoden').insert({ anbieter: 'paypal', paypal_maskiert: 'max.mustermann@web.de' });
    pruefe('Unmaskierte PayPal-Adresse weist die Datenbank ab', !!pp.error);

    console.log('\n7. Das andere Konto (@test) bleibt draußen');
    if (k.data) {
      const sieht = await du.client.from('zahlungsmethoden').select('id').eq('id', k.data.id);
      pruefe('… sieht die Karte nicht', !sieht.error && sieht.data.length === 0);
      const aendert = await du.client.from('zahlungsmethoden').update({ anzeigename: 'fremd' }, { count: 'exact' }).eq('id', k.data.id);
      pruefe('… ändert sie nicht', (aendert.count || 0) === 0);
      const loescht = await du.client.from('zahlungsmethoden').delete({ count: 'exact' }).eq('id', k.data.id);
      const noch = await db.from('zahlungsmethoden').select('id').eq('id', k.data.id);
      pruefe('… löscht sie nicht (Gegenprobe beim Besitzer)', (loescht.count || 0) === 0 && noch.data && noch.data.length === 1);
      const fremdAnlegen = await du.client.from('zahlungsmethoden').insert({ user_id: ich.id, anbieter: 'paypal', paypal_maskiert: 'pr***@web.de' });
      pruefe('… legt keine in fremdem Namen an', !!fremdAnlegen.error);
    }

    console.log('\n8. Spenden');
    const direkt = await db.from('donations').insert({ sender_id: ich.id, empfaenger_id: du.id, betrag_cent: 100 });
    pruefe('Direkter INSERT in donations ist zu', !!direkt.error);

    const senden = (p) => db.rpc('spende_senden', { p_empfaenger: du.id, p_betrag_cent: 150, p_code: meinCode, p_nachricht: 'Prüflauf _zahlung', ...p });
    const selbst = await senden({ p_empfaenger: ich.id });
    pruefe('Selbstspende abgewiesen', selbst.data && selbst.data.grund === 'selbst', JSON.stringify(selbst.data || selbst.error));
    const klein = await senden({ p_betrag_cent: 10 });
    pruefe('0,10 € abgewiesen', klein.data && klein.data.grund === 'betrag', JSON.stringify(klein.data || klein.error));
    const falsch = await senden({ p_code: 'FALSCH' + Date.now().toString().slice(-6) });
    pruefe('Falscher Code abgewiesen, mit Restversuchen',
      falsch.data && falsch.data.grund === 'falscher_code' && typeof falsch.data.verbleibend === 'number',
      JSON.stringify(falsch.data || falsch.error));
    const klein2 = await senden({ p_code: meinCode.toLowerCase().replace(/(....)/, '$1-'), p_methode: k.data ? k.data.id : null });
    pruefe('Richtiger Code (klein, mit Bindestrich) geht durch, vorgemerkt',
      klein2.data && klein2.data.ok && klein2.data.zahlungsstatus === 'vorgemerkt', JSON.stringify(klein2.data || klein2.error));
    if (klein2.data && klein2.data.id) spendeId = klein2.data.id;
    if (spendeId) {
      const zeile = await db.from('donations').select('betrag_cent, empfaenger_id').eq('id', spendeId).single();
      pruefe('Die Spende steht beim Absender, mit Betrag und Empfänger',
        !zeile.error && zeile.data.betrag_cent === 150 && zeile.data.empfaenger_id === du.id, zeile.error && zeile.error.message);
    }

    console.log('\n9. Eindeutigkeit');
    const doppelt = await db.rpc('spendencode_setzen', { p_neu: deinCode, p_bisher: meinCode });
    pruefe('Den Code des anderen Kontos gibt es nicht zweimal', doppelt.data && doppelt.data.grund === 'vergeben', JSON.stringify(doppelt.data || doppelt.error));
  } finally {
    console.log('\n10. Aufräumen');
    for (const id of angelegt) {
      const weg = await db.from('zahlungsmethoden').delete({ count: 'exact' }).eq('id', id);
      const rest = await db.from('zahlungsmethoden').select('id').eq('id', id);
      pruefe('Prüfkarte gelöscht', !weg.error && weg.count === 1 && rest.data && rest.data.length === 0, weg.error && weg.error.message);
    }
    const { count: standards } = await db.from('zahlungsmethoden').select('id', { count: 'exact', head: true }).eq('standard', true);
    pruefe('Nach dem Löschen wieder genau ein Standard', standards === 1, `Standards: ${standards}`);
    if (spendeId) {
      const r = await frage(`delete from donations where id = '${spendeId}' and sender_id in (select id from auth.users where email = $KONTO) returning id`);
      if (r === null) console.log('       (ohne SUPABASE_TOKEN bleibt die Prüfspende an @test stehen — kein echtes Konto)');
      else pruefe('Prüfspende gelöscht', Array.isArray(r) && r.length === 1, JSON.stringify(r).slice(0, 200));
    }
  }
}

(async () => {
  regeln();
  schemaEntwurf();
  gleichauf();
  kontowechsel();
  nurTestkonten();
  if (OFFLINE) {
    console.log('\n(--offline: Teil 6–10 übersprungen)');
  } else if (!URL || !KEY) {
    pruefe('Zugangsdaten für Supabase vorhanden (.env.local)', false);
  } else {
    await mitNetz();
  }
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden.`);
  process.exit(fehler === 0 ? 0 : 1);
})().catch((e) => {
  console.error('  FEHL ', e && e.message ? e.message : e);
  process.exit(1);
});
