// Reproduktion F-Migration: Altpaar geht für ein früher genutztes, aktuell
// nicht gespeichertes Konto verloren. Nur lokal, kein Netz, keine Produktdatei
// wird verändert (nur gelesen). Start: node repro_migration.cjs <worktree>
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), Module = require('module');
const nodeCrypto = require('crypto');
const W = process.argv[2];
const nacl = require(path.join(W, 'gemeinsam/tweetnacl'));
const Krypto = require(path.join(W, 'gemeinsam/krypto'));
Krypto.zufallsquelleSetzen((x, n) => { const b = nodeCrypto.randomBytes(n); for (let i = 0; i < n; i++) x[i] = b[i]; });
let ok = 0, fehl = 0;
const pruefe = (n, b) => { b ? ok++ : fehl++; console.log((b ? 'BELEGT ' : 'NICHT  ') + n); };

// Historische Nachricht an das alte gemeinsame Gerät L (vor AR-08 nutzte jedes Konto L).
const L = Krypto.schluesselpaarErzeugen();
const sender = Krypto.schluesselpaarErzeugen();
const alt = Krypto.verschluesseln('alte Nachricht an B', sender.geheim, [{ id: 'kL', oeffentlich: L.oeffentlich }]);
const altNachricht = { version: alt.version, chiffre: alt.chiffre, nonce: alt.nonce, absender: alt.absender };
const altKuvert = alt.kuverts[0];
pruefe('Vorbedingung: L öffnet die Altnachricht', Krypto.entschluesseln(altNachricht, altKuvert, L.geheim) === 'alte Nachricht an B');

// ---------------- Website: web/public/krypto.js unverändert im VM ----------
(async () => {
  const speicher = new Map([['allmedia.krypto.geheim', L.geheim], ['allmedia.krypto.geraet', 'geraet-L']]);
  let aktiv = 'A';
  const ctx = {
    console, Promise, Map, Set, JSON, Error, Number, String, Boolean, Array, Object,
    localStorage: {
      getItem: (k) => (speicher.has(k) ? speicher.get(k) : null),
      setItem: (k, v) => speicher.set(k, String(v)),
      removeItem: (k) => speicher.delete(k),
    },
    crypto: { randomUUID: () => nodeCrypto.randomUUID() },
    fetch: async () => ({ ok: true, json: async () => ({ id: 'id-' + aktiv }) }),
    nacl, Krypto,
  };
  // Nur A hat aktuell eine Sitzung; B war früher hier angemeldet, ist abgemeldet.
  ctx.window = { Anmeldung: { nutzer: () => ({ id: aktiv }), konten: () => [{ id: 'A' }] } };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(W, 'web/public/krypto.js'), 'utf8'), ctx);
  const KW = ctx.window.KryptoWeb;
  await KW.anmelden();
  pruefe('Web: A erhält L', speicher.get('allmedia.krypto.geheim.A') === L.geheim);
  pruefe('Web: Altfach gelöscht', !speicher.has('allmedia.krypto.geheim'));
  KW.vergessen(); aktiv = 'B';
  await KW.anmelden();
  const bGeheim = speicher.get('allmedia.krypto.geheim.B');
  pruefe('Web: B bekommt NEUES Paar statt L', bGeheim && bGeheim !== L.geheim);
  pruefe('Web: B kann Altnachricht nicht mehr öffnen', Krypto.entschluesseln(altNachricht, altKuvert, bGeheim) === null);
  pruefe('Web: L ist nirgends mehr für B auffindbar', ![...speicher.entries()].some(([k, v]) => k.endsWith('.B') && v === L.geheim));

  // ---------------- App: app/lib/krypto.ts per Typentfernung -------------
  let quelle = fs.readFileSync(path.join(W, 'app/lib/krypto.ts'), 'utf8')
    .replace(/^import \* as (\w+) from '([^']+)';$/mg, "const $1 = require('$2');")
    .replace(/^import type .*$/mg, '')
    .replace(/^export (async function|function|class|const|interface)/mg, '$1');
  quelle = Module.stripTypeScriptTypes(quelle, { mode: 'transform' });
  quelle += '\nmodule.exports = { meinSchluessel };';
  const kette = new Map([['allmedia.krypto.geheim', L.geheim], ['allmedia.krypto.geraet', 'geraet-L']]);
  const stubs = {
    'expo-secure-store': {
      getItemAsync: async (k) => (kette.has(k) ? kette.get(k) : null),
      setItemAsync: async (k, v) => { kette.set(k, v); },
      deleteItemAsync: async (k) => { kette.delete(k); },
    },
    'expo-crypto': { getRandomBytes: (n) => nodeCrypto.randomBytes(n), randomUUID: () => nodeCrypto.randomUUID() },
    './kontenspeicher': { gespeicherteKonten: async () => ['A'] }, // B abgemeldet
  };
  const datei = path.join(W, 'app/lib/krypto.js');
  const m = new Module(datei); m.filename = datei; m.paths = Module._nodeModulePaths(path.dirname(datei));
  const echtesRequire = m.require.bind(m);
  m.require = (id) => (id in stubs ? stubs[id] : echtesRequire(id));
  m._compile(quelle, datei);
  const client = { from: () => { const q = { upsert: () => q, select: () => q, single: async () => ({ data: { id: 'srv' }, error: null }) }; return q; } };
  const a = await m.exports.meinSchluessel(client, 'A');
  pruefe('App: A erhält L', a && a.geheim === L.geheim);
  pruefe('App: Altfach gelöscht', !kette.has('allmedia.krypto.geheim'));
  const b = await m.exports.meinSchluessel(client, 'B');
  pruefe('App: B bekommt NEUES Paar statt L', b && b.geheim !== L.geheim);
  pruefe('App: B kann Altnachricht nicht mehr öffnen', Krypto.entschluesseln(altNachricht, altKuvert, b.geheim) === null);
  console.log(`\nErgebnis: ${ok}/${ok + fehl} Aussagen belegt`);
  process.exit(fehl ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });
