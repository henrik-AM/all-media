// Schlussprüfung ee57c82: N1 (Zeit) und N4 (Vergleich) unabhängig. Offline.
'use strict';
const path = require('path'), nodeCrypto = require('crypto');
const W = process.argv[2];
require(path.join(W, 'app/test/_offline_sperre.cjs'));
const Krypto = require(path.join(W, 'gemeinsam/krypto'));
Krypto.zufallsquelleSetzen((x, n) => { const b = nodeCrypto.randomBytes(n); for (let i = 0; i < n; i++) x[i] = b[i]; });
const S = require(path.join(W, 'web/server/sync-handlers.js'));
let ok = 0, n = 0;
const p = (t, b, i) => { n++; if (b) ok++; console.log((b ? 'OK   ' : 'FEHL ') + t + (i ? '  (' + i + ')' : '')); };
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222', C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const a = Krypto.schluesselpaarErzeugen(), b = Krypto.schluesselpaarErzeugen(), x = Krypto.schluesselpaarErzeugen(), a2 = Krypto.schluesselpaarErzeugen();
function client(tab, log) {
  return { from(t) { const f = []; let lim = null, ins = null; const q = {
    select() { return q; }, order() { return q; }, range() { return q; },
    eq(s, v) { f.push((z) => z[s] === v); return q; }, gt(s, v) { f.push((z) => Number(z[s]) > v); return q; },
    in(s, l) { f.push((z) => l.includes(z[s])); return q; }, limit(k) { lim = k; return q; },
    insert(i) { ins = i; return q; }, update() { return q; }, maybeSingle() { return q.then((r) => ({ data: r.data[0] || null, error: null })); }, single() { return q.maybeSingle(); },
    then(res, rej) { let d = ins ? [ins] : (tab[t] || []).filter((z) => f.every((g) => g(z))); if (ins) log.push({ t, ins }); if (lim != null) d = d.slice(0, lim); return Promise.resolve({ data: d, error: null, count: d.length }).then(res, rej); },
  }; return q; } };
}
(async () => {
  console.log('[N1] Sendezeit');
  const tab = { chats: [{ id: C, is_group: false }], chat_members: [{ chat_id: C, user_id: A }, { chat_id: C, user_id: B }], messages: [],
    krypto_schluessel: [{ id: 'kA', user_id: A, oeffentlich: a.oeffentlich }, { id: 'kB', user_id: B, oeffentlich: b.oeffentlich }] };
  const senden = async (zeit) => {
    const id = nodeCrypto.randomUUID(); const log = [];
    const pk = Krypto.verschluesseln('t', a.geheim, [{ id: 'kB', oeffentlich: b.oeffentlich }], { id, zeit, chatId: C, senderId: A });
    const e = await S.handleSendMessage(client(tab, log), A, C, '', { nachrichtId: id, gesendetAm: zeit, krypto: pk.version, chiffre: pk.chiffre, kryptoNonce: pk.nonce, absenderSchluessel: pk.absender, kuverts: pk.kuverts });
    return { e, log, pk, id };
  };
  const alt = await senden(new Date(Date.now() - 14 * 864e5).toISOString());
  p('Server lehnt zurückdatierte Zeit ab, nichts geschrieben', alt.e && alt.e.ok === false && !alt.log.some((l) => l.t === 'messages'), alt.e && alt.e.fehler);
  const vor = await senden(new Date(Date.now() + 10 * 60e3).toISOString());
  p('Server lehnt +10 min ab', vor.e && vor.e.ok === false);
  const jetzt = new Date().toISOString(); const gut = await senden(jetzt);
  p('Server nimmt aktuelle Zeit an', gut.e && gut.e.ok !== false, JSON.stringify(gut.e && gut.e.fehler));
  // Dechiffrierer: Datenbankschreiber verschiebt created_at (Anzeige) weit weg.
  const kv = gut.pk.kuverts[0];
  const oeffne = (created) => Krypto.entschluesseln({ version: 2, chiffre: gut.pk.chiffre, nonce: gut.pk.nonce, absender: gut.pk.absender,
    kontext: Krypto.kontextAusZeile({ id: gut.id, chat_id: C, sender_id: A, krypto_gesendet_am: jetzt, created_at: created }) }, kv, b.geheim);
  p('Öffnen mit created_at innerhalb 5 min', oeffne(new Date(Date.parse(jetzt) + 60e3).toISOString()) === 't');
  p('Öffnen mit created_at 2 Tage später → unlesbar', oeffne(new Date(Date.parse(jetzt) + 2 * 864e5).toISOString()) === null);
  p('Ohne created_at (empfangenAm fehlt) wird nicht geprüft → öffnet', oeffne(undefined) === 't');
  const fs = require('fs');
  const daten = fs.readFileSync(path.join(W, 'app/lib/daten.ts'), 'utf8');
  p('Hinweis: App-Bezugs-Select ohne created_at (Zeitprüfung dort aus)', /\.select\('id, chat_id, sender_id, reply_to, quote_of, krypto_gesendet_am, text/.test(daten));
  const kr = fs.readFileSync(path.join(W, 'app/lib/krypto.ts'), 'utf8');
  p('App ersetzt created_at nicht mehr', !/z\.created_at = z\.krypto_gesendet_am/.test(kr));

  console.log('[N4] Vergleich');
  const paar = Krypto.paarSicherheitsnummer(A, [a.oeffentlich, a2.oeffentlich], B, [b.oeffentlich, x.oeffentlich]);
  const textA = Krypto.vergleichstext(paar, a.oeffentlich, [a.oeffentlich, a2.oeffentlich], [b.oeffentlich, x.oeffentlich]);
  const textB = Krypto.vergleichstext(Krypto.paarSicherheitsnummer(B, [b.oeffentlich, x.oeffentlich], A, [a.oeffentlich, a2.oeffentlich]), b.oeffentlich, [b.oeffentlich, x.oeffentlich], [a.oeffentlich, a2.oeffentlich]);
  p('Zahl je Konto sichtbar', /registrierten Geräteschlüssel \(2\)/.test(textA) && /des Gegenübers \(2\)/.test(textA));
  p('B sieht eingeschobenes X in eigener Liste neben eigenem lokalem Fingerabdruck', textB.includes(Krypto.fingerabdruck(x.oeffentlich)) && textB.includes('Lokaler Fingerabdruck dieses Geräts:\n' + Krypto.fingerabdruck(b.oeffentlich)));
  let wurf = null; try { Krypto.vergleichstext(paar, a.oeffentlich, [a2.oeffentlich], [b.oeffentlich]); } catch (e) { wurf = e.message; }
  p('Fehlender lokaler Schlüssel lehnt Vergleich ab', !!wurf, wurf);
  p('Grenze ausdrücklich benannt', /beim bloßen Nummernvergleich nicht auf/.test(textA));
  p('Kein geheimes Material im Text', !textA.includes(a.geheim) && !textA.includes(a.oeffentlich));
  console.log(`\nErgebnis: ${ok}/${n}`); process.exit(ok === n ? 0 : 1);
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });
