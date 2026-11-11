/**
 * app/lib/krypto.ts gegen eine Supabase-Attrappe — ohne Netz, ohne Gerät.
 *
 * WARUM ES DAS GIBT (Sicherheitsprüfung 16.10.2026, AR-04/05/08)
 *
 * Die App-Seite der Verschlüsselung wurde bisher nur im Prüfbrowser
 * durchlaufen, mit Demoprofilen ohne Schlüssel — also immer im Klartextzweig
 * (siehe test/_modulquelle.js, „WAS DAMIT TROTZDEM NICHT GEPRUEFT IST").
 * Hier wird die Datei mit TypeScript übersetzt und gegen nachgebaute
 * Tabellen geprüft: Übernahme des alten Schlüsselfachs, gleichzeitige
 * Zugriffe, jeder Weg, auf dem früher still Klartext hinausging, und die
 * Prüfung des Absenderschlüssels.
 *
 * Start:  node test/_krypto_app_einheit.js
 */

const fs = require('fs'), path = require('path'), Module = require('module'), nodeCrypto = require('crypto');
const W = path.join(__dirname, '..', '..');
const ts = require(path.join(W, 'app/node_modules/typescript'));
let ok = 0, fehl = 0;
const pruefe = (n, b, i) => { b ? ok++ : fehl++; console.log((b ? '  OK   ' : '  FEHL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };

const schluesselkette = {};
const SecureStore = {
  getItemAsync: async (k) => (k in schluesselkette ? schluesselkette[k] : null),
  setItemAsync: async (k, v) => { schluesselkette[k] = v; },
  deleteItemAsync: async (k) => { delete schluesselkette[k]; },
};
const ExpoCrypto = { getRandomBytes: (n) => nodeCrypto.randomBytes(n), randomUUID: () => nodeCrypto.randomUUID() };
let gespeicherte = [];
const kontenspeicher = { gespeicherteKonten: async () => gespeicherte };

const quelle = fs.readFileSync(path.join(W, 'app/lib/krypto.ts'), 'utf8');
const js = ts.transpileModule(quelle, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = new Module(path.join(W, 'app/lib/krypto.js'));
m.filename = path.join(W, 'app/lib/krypto.js');
m.paths = Module._nodeModulePaths(path.join(W, 'app/lib'));
const echtesRequire = m.require.bind(m);
m.require = (id) => {
  if (id === 'expo-secure-store') return SecureStore;
  if (id === 'expo-crypto') return ExpoCrypto;
  if (id === './kontenspeicher') return kontenspeicher;
  return echtesRequire(id);
};
m._compile(js, m.filename);
const K = m.exports;
const Krypto = require(path.join(W, 'gemeinsam/krypto.js'));

// --- Supabase-Attrappe: Tabellen im Speicher, Filter eq/gt/in, Fehler auf Wunsch ---
function client(db, stoerung = {}) {
  return {
    from(tabelle) {
      const f = []; let bereich = null; let lim = null; let einzeln = false; let upsertWert = null;
      const q = {
        select() { return q; }, order() { return q; },
        eq(s, v) { f.push((z) => z[s] === v); return q; },
        gt(s, v) { f.push((z) => Number(z[s]) > v); return q; },
        in(s, l) { f.push((z) => l.includes(z[s])); return q; },
        limit(n) { lim = n; return q; },
        range(a, b) { bereich = [a, b]; return q; },
        maybeSingle() { einzeln = 'vielleicht'; return q; }, single() { einzeln = 'genau'; return q; },
        upsert(w) { upsertWert = w; return q; },
        then(res, rej) {
          return Promise.resolve().then(() => {
            if (stoerung[tabelle]) return { data: null, error: { message: 'Störung ' + tabelle } };
            const t = (db[tabelle] = db[tabelle] || []);
            if (upsertWert) {
              let z = t.find((r) => r.user_id === upsertWert.user_id && r.geraet === upsertWert.geraet);
              if (z) Object.assign(z, upsertWert); else { z = { id: 'k-' + (t.length + 1) + '-' + upsertWert.user_id.slice(0, 4), ...upsertWert }; t.push(z); }
              return { data: { id: z.id }, error: null };
            }
            let r = t.filter((z) => f.every((g) => g(z)));
            const count = r.length;
            if (bereich) r = r.slice(bereich[0], bereich[1] + 1);
            if (lim) r = r.slice(0, lim);
            if (einzeln) return { data: r[0] || null, error: null };
            return { data: r, count, error: null };
          }).then(res, rej);
        },
      };
      return q;
    },
  };
}

(async () => {
  const A = 'aaaaaaaa-0000', B = 'bbbbbbbb-0000', C = 'cccccccc-0000';
  // ---- AR-08 ----
  const alt = Krypto.schluesselpaarErzeugen();
  schluesselkette['allmedia.krypto.geheim'] = alt.geheim;
  schluesselkette['allmedia.krypto.geraet'] = 'alt-geraet';
  gespeicherte = [A, B];
  const db = { krypto_schluessel: [], chats: [], chat_members: [], messages: [], message_keys: [] };
  const c = client(db);
  const [m1, m1b] = await Promise.all([K.meinSchluessel(c, A), K.meinSchluessel(c, A)]);
  pruefe('Altbestand übernommen (Konto A, gleiches Paar)', m1 && m1.geheim === alt.geheim && m1.geraet === 'alt-geraet');
  pruefe('Gleichzeitige Zugriffe: ein Paar', m1b && m1b.geheim === m1.geheim);
  pruefe('Altes Fach gelöscht', !('allmedia.krypto.geheim' in schluesselkette) && !('allmedia.krypto.geraet' in schluesselkette));
  pruefe('Zweites angemeldetes Konto B bekommt es auch', schluesselkette['allmedia.krypto.geheim.' + B] === alt.geheim);
  const m3 = await K.meinSchluessel(c, C);
  pruefe('Neues Konto C: eigenes Paar', m3 && m3.geheim !== alt.geheim && schluesselkette['allmedia.krypto.geheim.' + C] === m3.geheim);
  pruefe('Kein Konto: null statt Wurf', (await K.meinSchluessel(c, '')) === null);

  // ---- AR-05 / Nur zu zweit ----
  const du = Krypto.schluesselpaarErzeugen();
  db.krypto_schluessel.push({ id: 'k-b', user_id: B, geraet: 'b1', oeffentlich: du.oeffentlich });
  db.chats.push({ id: 'zwei', is_group: false }, { id: 'gruppe', is_group: true }, { id: 'drei', is_group: false }, { id: 'neu', is_group: false });
  db.chat_members.push({ chat_id: 'zwei', user_id: A }, { chat_id: 'zwei', user_id: B },
    { chat_id: 'drei', user_id: A }, { chat_id: 'drei', user_id: B }, { chat_id: 'drei', user_id: C },
    { chat_id: 'neu', user_id: A }, { chat_id: 'neu', user_id: 'ohne-geraet' });
  let p = await K.fuerChatVerschliessen(c, 'zwei', A, 'Hallo');
  pruefe('Zweierchat: verschlossen, Text leer', p.spalten.krypto === 1 && p.spalten.text === '' && p.kuverts.length >= 2);
  p = await K.fuerChatVerschliessen(c, 'gruppe', A, 'Hallo');
  pruefe('Gruppe: Klartext', p.spalten.krypto === 0 && p.spalten.text === 'Hallo');
  p = await K.fuerChatVerschliessen(c, 'neu', A, 'Hallo');
  pruefe('Gegenüber ohne Gerät: Klartext', p.spalten.krypto === 0);
  let fehler = null;
  try { await K.fuerChatVerschliessen(c, 'drei', A, 'Hallo'); } catch (e) { fehler = e; }
  pruefe('Drittes Mitglied: VerschluesselnFehler', fehler && fehler.name === 'VerschluesselnFehler' && /mehr als zwei/.test(fehler.message), fehler && fehler.message);
  fehler = null;
  try { await K.fuerChatVerschliessen(c, 'drei', A, ''); } catch (e) { fehler = e; }
  pruefe('… auch ein Anhang ohne Text', fehler && fehler.name === 'VerschluesselnFehler');
  fehler = null;
  try { await K.fuerChatVerschliessen(client(db, { krypto_schluessel: true }), 'zwei', A, 'Hallo'); } catch (e) { fehler = e; }
  pruefe('Schlüsselabfrage gestört: abgelehnt statt Klartext', fehler && fehler.name === 'VerschluesselnFehler' && /nicht verschlüsseln/.test(fehler.message), fehler && fehler.message);
  // Downgrade: Server liefert die Schlüssel des Gegenübers nicht mehr, Chat war verschlüsselt (gemerkt)
  const ohneB = { ...db, krypto_schluessel: db.krypto_schluessel.filter((k) => k.user_id !== B) };
  fehler = null;
  try { await K.fuerChatVerschliessen(client(ohneB), 'zwei', A, 'Hallo'); } catch (e) { fehler = e; }
  pruefe('Gemerkter Chat, leere Liste vom Server: abgelehnt', fehler && fehler.name === 'VerschluesselnFehler', fehler && fehler.message);
  // Downgrade ohne Gedächtnis: verschlüsselte Nachricht in der DB
  db.chats.push({ id: 'alt', is_group: false });
  db.chat_members.push({ chat_id: 'alt', user_id: A }, { chat_id: 'alt', user_id: 'weg' });
  db.messages.push({ id: 'x', chat_id: 'alt', krypto: 1 });
  fehler = null;
  try { await K.fuerChatVerschliessen(c, 'alt', A, 'Hallo'); } catch (e) { fehler = e; }
  pruefe('Schon verschlüsselt geschrieben, Gegenüber ohne Schlüssel: abgelehnt', fehler && fehler.name === 'VerschluesselnFehler');
  // Eigener Schlüssel nicht lesbar
  const kaputt = SecureStore.getItemAsync; SecureStore.getItemAsync = async () => { throw new Error('Keychain'); };
  fehler = null;
  try { await K.fuerChatVerschliessen(c, 'zwei', 'dddddddd', 'Hallo'); } catch (e) { fehler = e; }
  SecureStore.getItemAsync = kaputt;
  pruefe('Schlüsselkette nicht lesbar: abgelehnt statt Klartext', fehler && fehler.name === 'VerschluesselnFehler');

  // ---- AR-04: Absender ----
  const meiner = await K.meinSchluessel(c, A);
  const echt = Krypto.verschluesseln('echt', du.geheim, [{ id: meiner.id, oeffentlich: meiner.oeffentlich }]);
  const f = Krypto.schluesselpaarErzeugen();
  const falsch = Krypto.verschluesseln('falsch', f.geheim, [{ id: meiner.id, oeffentlich: meiner.oeffentlich }]);
  const zeile = (pk, id) => ({ id, chat_id: 'zwei', sender_id: B, krypto: 1, chiffre: pk.chiffre, krypto_nonce: pk.nonce, absender_schluessel: pk.absender });
  db.message_keys.push({ message_id: 'e1', schluessel_id: meiner.id, ...echt.kuverts[0] }, { message_id: 'f1', schluessel_id: meiner.id, ...falsch.kuverts[0] });
  const z = [zeile(echt, 'e1'), zeile(falsch, 'f1')];
  await K.aufschliessen(c, z, meiner, { absenderPruefen: true });
  pruefe('Echte Nachricht offen, ohne Kennzeichen', z[0].text === 'echt' && !z[0].nichtPruefbar);
  pruefe('Fälschung offen, als nicht prüfbar gekennzeichnet', z[1].text === 'falsch' && z[1].nichtPruefbar === true);
  const z2 = [zeile(falsch, 'f1')];
  await K.aufschliessen(client(db, { krypto_schluessel: true }), z2, meiner, { absenderPruefen: true });
  pruefe('Schlüssel nicht ladbar: lesbar mit Warnung', z2[0].text === 'falsch' && z2[0].nichtPruefbar === true);

  console.log(`\n${ok} von ${ok + fehl} Pruefungen bestanden.`);
  process.exit(fehl ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
