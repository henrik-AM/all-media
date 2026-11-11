/**
 * Die Server-Handler der Website gegen eine Supabase-Attrappe — ohne Netz.
 *
 * WARUM ES DAS GIBT (Sicherheitsprüfung 16.10.2026, AR-05)
 *
 * Der Server ist die letzte Stelle, an der Klartext in einen
 * verschlüsselten Chat geraten kann: eine alte app.js im Zwischenspeicher,
 * Weiterleiten, Story-Antwort, Story-Herz. Geprüft wird, dass er dort
 * ablehnt, dass ein Zweierchat mit drittem Mitglied nichts annimmt, und dass
 * Verschlossenes samt Kuverts durchgeht.
 *
 * Start:  node test/_krypto_server_einheit.js
 */

const path = require('path');
const W = path.join(__dirname, '..', '..');
const S = require(path.join(W, 'web/server/sync-handlers.js'));
const Krypto = require(path.join(W, 'gemeinsam/krypto.js'));
Krypto.zufallsquelleSetzen((x, n) => { const b = require('crypto').randomBytes(n); for (let i = 0; i < n; i++) x[i] = b[i]; });
let ok = 0, fehl = 0;
const pruefe = (n, b, i) => { b ? ok++ : fehl++; console.log((b ? '  OK   ' : '  FEHL ') + n + (i !== undefined ? '  (' + i + ')' : '')); };

let zaehler = 0;
function client(db) {
  return {
    rpc: async () => ({ data: true, error: null }),
    from(tabelle) {
      const f = []; let bereich = null; let lim = null; let einzeln = false; let art = 'select'; let wert = null; let auswahl = '';
      const q = {
        select(a) { if (art === 'select') auswahl = a || ''; return q; }, order() { return q; },
        eq(s, v) { f.push((z) => z[s] === v); return q; },
        neq(s, v) { f.push((z) => z[s] !== v); return q; },
        gt(s, v) { f.push((z) => Number(z[s]) > v); return q; },
        in(s, l) { f.push((z) => l.includes(z[s])); return q; },
        limit(n) { lim = n; return q; },
        range(a, b) { bereich = [a, b]; return q; },
        maybeSingle() { einzeln = true; return q; }, single() { einzeln = true; return q; },
        insert(w) { art = 'insert'; wert = w; return q; },
        update(w) { art = 'update'; wert = w; return q; },
        delete() { art = 'delete'; return q; },
        then(res, rej) {
          return Promise.resolve().then(() => {
            const t = (db[tabelle] = db[tabelle] || []);
            if (art === 'insert') {
              const zeilen = (Array.isArray(wert) ? wert : [wert]).map((z) => ({ id: 'id' + ++zaehler, created_at: new Date().toISOString(), ...z }));
              t.push(...zeilen);
              return { data: einzeln ? zeilen[0] : zeilen, error: null };
            }
            const treffer = t.filter((z) => f.every((g) => g(z)));
            if (art === 'update') { treffer.forEach((z) => Object.assign(z, wert)); return { data: treffer, error: null }; }
            if (art === 'delete') { db[tabelle] = t.filter((z) => !treffer.includes(z)); return { data: treffer, error: null }; }
            let r = treffer.map((z) => (tabelle === 'chat_members' && auswahl.includes('chats(') ? { ...z, chats: (db.chats || []).find((c) => c.id === z.chat_id) } : z));
            const count = r.length;
            if (bereich) r = r.slice(bereich[0], bereich[1] + 1);
            if (lim) r = r.slice(0, lim);
            return { data: einzeln ? r[0] || null : r, count, error: null };
          }).then(res, rej);
        },
      };
      return q;
    },
  };
}

(async () => {
  const A = 'aaaaaaaa-0000', B = 'bbbbbbbb-0000', C = 'cccccccc-0000';
  const pa = Krypto.schluesselpaarErzeugen(), pb = Krypto.schluesselpaarErzeugen();
  const db = {
    chats: [{ id: 'zwei', is_group: false, bereich: 'messenger' }, { id: 'gruppe', is_group: true }, { id: 'drei', is_group: false }, { id: 'offen', is_group: false, bereich: 'messenger' }],
    chat_members: [
      { chat_id: 'zwei', user_id: A }, { chat_id: 'zwei', user_id: B },
      { chat_id: 'gruppe', user_id: A }, { chat_id: 'gruppe', user_id: B }, { chat_id: 'gruppe', user_id: C },
      { chat_id: 'drei', user_id: A }, { chat_id: 'drei', user_id: B }, { chat_id: 'drei', user_id: C },
      { chat_id: 'offen', user_id: A }, { chat_id: 'offen', user_id: C },
    ],
    krypto_schluessel: [{ id: 'k-a', user_id: A, oeffentlich: pa.oeffentlich }, { id: 'k-b', user_id: B, oeffentlich: pb.oeffentlich }],
    messages: [], message_keys: [], stories: [{ id: 's1', user_id: B }], story_likes: [],
  };
  const c = client(db);

  let e = await S.handleSendMessage(c, A, 'zwei', 'Klartext', { klartextPruefen: true });
  pruefe('POST /api/messages: Klartext in verschlüsselbaren Chat abgelehnt', e.ok === false && /nicht verschlüsseln/.test(e.fehler), e.fehler);
  pruefe('… und nichts geschrieben', db.messages.length === 0);
  e = await S.handleSendMessage(c, A, 'gruppe', 'Hallo Gruppe', { klartextPruefen: true });
  pruefe('Gruppe: Klartext geht', e.ok === true);
  e = await S.handleSendMessage(c, A, 'offen', 'Hallo', { klartextPruefen: true });
  pruefe('Gegenüber ohne Gerät: Klartext geht', e.ok === true);
  e = await S.handleSendMessage(c, A, 'drei', 'Hallo', { klartextPruefen: true });
  pruefe('Drittes Mitglied: abgelehnt', e.ok === false && /mehr als zwei/.test(e.fehler), e.fehler);
  e = await S.handleSendMessage(c, A, 'drei', 'Gif', { typ: 'gif' });
  pruefe('… auch ein Anhang', e.ok === false && /mehr als zwei/.test(e.fehler));
  e = await S.handleSendMessage(c, A, 'zwei', 'Gif', { typ: 'gif' });
  pruefe('Anhang-Beschriftung ohne Chiffre abgelehnt', e.ok === false);
  e = await S.handleSendMessage(c, A, 'zwei', '', { typ: 'gif' });
  pruefe('Anhang ohne Text bleibt möglich', e.ok === true);

  const weg = Krypto.sendeweg({ ...(await S.kryptoFakten(c, 'zwei', A)), meiner: { id: 'k-a', oeffentlich: pa.oeffentlich } });
  const pk = Krypto.verschluesseln('geheim', pa.geheim, weg.empfaenger);
  e = await S.handleSendMessage(c, A, 'zwei', '', { klartextPruefen: true, krypto: 1, chiffre: pk.chiffre, kryptoNonce: pk.nonce, absenderSchluessel: pk.absender, kuverts: pk.kuverts });
  pruefe('Verschlüsselt: geschrieben, mit Kuverts', e.ok === true && db.message_keys.length === 2 && e.nachricht.text === '');
  const quelle = e.nachricht.id;

  // Weiterleiten
  e = await S.handleNachrichtWeiterleiten(c, A, quelle, ['gruppe'], []);
  pruefe('Weiterleiten verschlüsselt → Gruppe ohne Browsertext: abgelehnt statt leerer Blase', e.ok === false, e.fehler);
  const vorher = db.messages.length;
  e = await S.handleNachrichtWeiterleiten(c, A, quelle, ['gruppe', 'zwei'], [{ chatId: 'gruppe', text: 'geheim' }, { chatId: 'zwei', text: 'geheim' }]);
  pruefe('Ein Ziel bräuchte Verschlüsselung: alles abgelehnt, nichts geschrieben', e.ok === false && db.messages.length === vorher, e.fehler);
  const pk2 = Krypto.verschluesseln('geheim', pa.geheim, weg.empfaenger);
  e = await S.handleNachrichtWeiterleiten(c, A, quelle, ['gruppe', 'zwei'], [
    { chatId: 'gruppe', text: 'geheim' },
    { chatId: 'zwei', krypto: 1, chiffre: pk2.chiffre, kryptoNonce: pk2.nonce, absenderSchluessel: pk2.absender, kuverts: pk2.kuverts },
  ]);
  const neue = db.messages.slice(vorher);
  pruefe('Je Ziel richtig: Gruppe offen, Zweierchat verschlüsselt', e.ok === true && neue.length === 2 &&
    neue.find((m) => m.chat_id === 'gruppe').text === 'geheim' && neue.find((m) => m.chat_id === 'zwei').krypto === 1 &&
    neue.find((m) => m.chat_id === 'zwei').text === '', JSON.stringify(e));
  e = await S.handleNachrichtWeiterleiten(c, A, quelle, ['drei'], [{ chatId: 'drei', text: 'geheim' }]);
  pruefe('Weiterleiten in Chat mit drittem Mitglied: abgelehnt', e.ok === false && /mehr als zwei/.test(e.fehler));

  // Story-Antwort / Herz (Story von B, Chat A–B = 'zwei')
  const sc = await S.handleStoryChat(c, A, 's1');
  pruefe('Story-Chat gefunden', sc.ok && sc.chatId === 'zwei', JSON.stringify(sc));
  e = await S.handleStoryReply(c, A, 's1', 'schönes Bild', {});
  pruefe('Story-Antwort im Klartext in verschlüsselten Chat: abgelehnt', e.ok === false && /nicht verschlüsseln/.test(e.fehler), e.fehler);
  const pk3 = Krypto.verschluesseln('schönes Bild', pa.geheim, weg.empfaenger);
  e = await S.handleStoryReply(c, A, 's1', '', { chatId: 'zwei', krypto: 1, chiffre: pk3.chiffre, kryptoNonce: pk3.nonce, absenderSchluessel: pk3.absender, kuverts: pk3.kuverts });
  pruefe('Story-Antwort verschlüsselt: geschrieben mit reply_to_story', e.ok === true && e.nachricht.reply_to_story === 's1' && e.nachricht.krypto === 1, JSON.stringify(e).slice(0, 120));
  e = await S.handleStoryReply(c, A, 's1', '', { chatId: 'gruppe', krypto: 1, chiffre: pk3.chiffre, kryptoNonce: pk3.nonce, kuverts: pk3.kuverts });
  pruefe('Für falschen Chat verschlossen: abgelehnt', e.ok === false);
  const nVorher = db.messages.length;
  e = await S.handleLikeStory(c, A, 's1');
  pruefe('Story-Herz: Server schreibt kein Klartext-Herz, gibt Chat zurück', e.ok && e.herzChatId === 'zwei' && db.messages.length === nVorher, JSON.stringify(e));

  console.log(`\n${ok} von ${ok + fehl} Pruefungen bestanden.`);
  process.exit(fehl ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
