/**
 * web/public/krypto.js im nachgebauten Browser — ohne Netz, ohne Server.
 *
 * WARUM ES DAS GIBT (Sicherheitsprüfung 16.10.2026, AR-04/05/08)
 *
 * Die Website verschließt im Browser. Was dort passiert, sah bisher nur der
 * Prüflauf mit echtem Konto — und der kommt in die Fehlerfälle gar nicht
 * hinein: Server antwortet 500, Netz weg, leere Schlüsselliste in einem
 * verschlüsselten Chat, drittes Mitglied, altes Fach ohne Kontokennung,
 * gefälschter Absenderschlüssel. Hier läuft dieselbe Datei in einem
 * `vm`-Kontext mit nachgebautem localStorage, fetch und Anmeldung.
 *
 * Start:  node test/_krypto_web_einheit.js
 */

const fs = require('fs'), path = require('path'), vm = require('vm'), nodeCrypto = require('crypto');
const W = path.join(__dirname, '..', '..');
let ok = 0, fehl = 0;
const pruefe = (n, b, i) => { b ? ok++ : fehl++; console.log((b ? '  OK   ' : '  FEHL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };

function umgebung(speicher, konto, konten, routen) {
  const ls = {
    getItem: (k) => (k in speicher ? speicher[k] : null),
    setItem: (k, v) => { speicher[k] = String(v); },
    removeItem: (k) => { delete speicher[k]; },
  };
  const ctx = {
    console, localStorage: ls, Uint8Array, Promise, Date, JSON, Math, Error, Set, Map, Object, Array, String, Number, Boolean,
    crypto: { randomUUID: () => nodeCrypto.randomUUID(), getRandomValues: (a) => nodeCrypto.randomFillSync(a) },
    fetch: async (url, opt) => {
      const r = routen(url, opt);
      if (r instanceof Error) throw r;
      return { ok: r.status ? r.status < 400 : true, status: r.status || 200, json: async () => r.body };
    },
  };
  ctx.window = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  ctx.Anmeldung = { nutzer: () => (konto.id ? { id: konto.id } : null), konten: () => konten.map((id) => ({ id })) };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(W, 'gemeinsam/tweetnacl.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(W, 'gemeinsam/krypto.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(W, 'web/public/krypto.js'), 'utf8'), ctx);
  return ctx;
}

(async () => {
  const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = '33333333-3333-3333-3333-333333333333';
  // --- AR-08: Altbestand ---
  const speicher = {};
  let ctx0 = umgebung(speicher, { id: A }, [A, B], () => ({ body: { id: 'k1' } }));
  const altPaar = ctx0.Krypto.schluesselpaarErzeugen();
  speicher['allmedia.krypto.geheim'] = altPaar.geheim;
  speicher['allmedia.krypto.geraet'] = 'alt-geraet';
  const angemeldet = [];
  const konto = { id: A };
  const ctx = umgebung(speicher, konto, [A, B], (url, opt) => {
    if (url === '/api/krypto/schluessel') { const b = JSON.parse(opt.body); angemeldet.push(b); return { body: { id: 'k-' + b.geraet } }; }
    return { status: 404, body: {} };
  });
  const m1 = await ctx.KryptoWeb.anmelden();
  pruefe('Altbestand: Konto A übernimmt das alte Paar', m1 && m1.geheim === altPaar.geheim && m1.geraet === 'alt-geraet');
  pruefe('Altbestand: altes Fach gelöscht', !('allmedia.krypto.geheim' in speicher) && !('allmedia.krypto.geraet' in speicher));
  pruefe('Altbestand: auch das zweite angemeldete Konto B behält es', speicher['allmedia.krypto.geheim.' + B] === altPaar.geheim);
  konto.id = C;
  const m3 = await ctx.KryptoWeb.anmelden();
  pruefe('Neues Konto C erbt nichts, eigenes Paar', m3 && m3.geheim !== altPaar.geheim && m3.kontoId === C);
  pruefe('… mit eigener Gerätekennung', m3.geraet !== 'alt-geraet');
  konto.id = A;
  const m4 = await ctx.KryptoWeb.anmelden();
  pruefe('Kontowechsel ohne vergessen(): wieder As Schlüssel', m4.geheim === altPaar.geheim && m4.kontoId === A);

  // --- AR-05: verschliessen ---
  const du = ctx.Krypto.schluesselpaarErzeugen();
  let fakten;
  const ctx2 = umgebung({}, { id: A }, [A], (url, opt) => {
    if (url === '/api/krypto/schluessel') return { body: { id: 'k-a' } };
    if (url.startsWith('/api/krypto/empfaenger/')) return typeof fakten === 'function' ? fakten() : { body: fakten };
    if (url === '/api/krypto/absender') {
      const { paare } = JSON.parse(opt.body);
      return { body: { gefunden: paare.filter((p) => p.schluessel === du.oeffentlich && p.userId === B).map((p) => ({ user_id: p.userId, oeffentlich: p.schluessel })) } };
    }
    return { status: 404, body: {} };
  });
  const ich = await ctx2.KryptoWeb.anmelden();
  const sA = { id: 'k-a', user_id: A, oeffentlich: ich.oeffentlich };
  const sB = { id: 'k-b', user_id: B, oeffentlich: du.oeffentlich };
  const basis = { istGruppe: false, mitglieder: [A, B], ichId: A, schonVerschluesselt: false };

  fakten = { ...basis, schluessel: [sA, sB] };
  const paket = await ctx2.KryptoWeb.verschliessen('chat1', 'Hallo');
  pruefe('Beide mit Schlüssel: verschlossen', paket && paket.krypto === 1 && paket.kuverts.length === 2);

  fakten = { ...basis, schluessel: [sA] };
  pruefe('Gegenüber ohne Gerät, neuer Chat: Klartext (null)', (await ctx2.KryptoWeb.verschliessen('chat2', 'Hallo')) === null);

  let fehler = null;
  try { await ctx2.KryptoWeb.verschliessen('chat1', 'Hallo'); } catch (e) { fehler = e.message; }
  pruefe('Gemerkter Chat, Server liefert Gegenüber leer: abgelehnt', /nicht verschlüsseln und wurde nicht gesendet/.test(fehler || ''), fehler);

  fakten = () => ({ status: 500, body: { ok: false } });
  fehler = null;
  try { await ctx2.KryptoWeb.verschliessen('chat3', 'Hallo'); } catch (e) { fehler = e.message; }
  pruefe('Server-Fehler bei den Fakten: abgelehnt statt Klartext', /nicht verschlüsseln/.test(fehler || ''), fehler);

  fakten = () => new Error('offline');
  fehler = null;
  try { await ctx2.KryptoWeb.verschliessen('chat3', 'Hallo'); } catch (e) { fehler = e.message; }
  pruefe('Kein Netz: abgelehnt statt Klartext', /nicht verschlüsseln/.test(fehler || ''), fehler);

  fakten = { ...basis, mitglieder: [A, B, C], schluessel: [sA, sB] };
  fehler = null;
  try { await ctx2.KryptoWeb.verschliessen('chat4', 'Hallo'); } catch (e) { fehler = e.message; }
  pruefe('Drittes Mitglied: abgelehnt', /mehr als zwei Mitglieder/.test(fehler || ''), fehler);

  fakten = { ichId: A, istGruppe: true, mitglieder: [], schluessel: [], schonVerschluesselt: false };
  pruefe('Gruppe: Klartext', (await ctx2.KryptoWeb.verschliessen('gruppe', 'Hallo')) === null);

  // --- AR-04: Absender ---
  const vonB = ctx.Krypto.verschluesseln('echt', du.geheim, [{ id: 'k-a', oeffentlich: ich.oeffentlich }]);
  const faelscher = ctx.Krypto.schluesselpaarErzeugen();
  const falsch = ctx.Krypto.verschluesseln('falsch', faelscher.geheim, [{ id: 'k-a', oeffentlich: ich.oeffentlich }]);
  const zuNachricht = (p, id) => ({ id, chatId: 'chat1', senderId: B, krypto: p.version, chiffre: p.chiffre, kryptoNonce: p.nonce, absenderSchluessel: p.absender, kuvert: p.kuverts[0] });
  const verlauf = [zuNachricht(vonB, 'm1'), zuNachricht(falsch, 'm2')];
  ctx2.KryptoWeb.stapelOeffnen(verlauf);
  await ctx2.KryptoWeb.absenderPruefen(verlauf);
  pruefe('Echte Nachricht geöffnet, nicht gekennzeichnet', verlauf[0].text === 'echt' && !verlauf[0].nichtPruefbar);
  pruefe('Fälschung geöffnet UND als nicht prüfbar gekennzeichnet', verlauf[1].text === 'falsch' && verlauf[1].nichtPruefbar === true);

  // Sicherheitsnummer
  const nr = ctx2.KryptoWeb.sicherheitsnummer([du.oeffentlich, ich.oeffentlich]);
  pruefe('Sicherheitsnummer im Browser = in Node', nr.nummer === require(path.join(W, 'gemeinsam/krypto.js')).sicherheitsnummer([ich.oeffentlich, du.oeffentlich]).nummer && nr.geraete === 2);

  console.log(`\n${ok} von ${ok + fehl} Pruefungen bestanden.`);
  process.exit(fehl ? 1 : 0);
})();
