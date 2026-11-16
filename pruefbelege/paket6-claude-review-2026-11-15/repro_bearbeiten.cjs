// Reproduktion F-Bearbeiten: Bearbeiten einer offenen Altnachricht schreibt in
// einem inzwischen verschlüsselten Zweierchat neuen Klartext, obwohl derselbe
// Server das Senden dieses Textes ablehnt. Lokal, Supabase-Attrappe, kein Netz.
// Start: node repro_bearbeiten.cjs <worktree>
'use strict';
const path = require('path');
const W = process.argv[2];
const S = require(path.join(W, 'web/server/sync-handlers.js'));
let ok = 0, fehl = 0;
const pruefe = (n, b, i) => { b ? ok++ : fehl++; console.log((b ? 'BELEGT ' : 'NICHT  ') + n + (i ? ' (' + i + ')' : '')); };

const A = '11111111-1111-1111-1111-111111111111', B = '22222222-2222-2222-2222-222222222222', C = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const tab = {
  chats: [{ id: C, is_group: false }],
  chat_members: [{ chat_id: C, user_id: A }, { chat_id: C, user_id: B }],
  // m1 offen geschrieben, als B noch kein Gerät hatte; m2 danach verschlüsselt.
  messages: [
    { id: 'm1', chat_id: C, sender_id: A, text: 'ruf mich an', krypto: 0 },
    { id: 'm2', chat_id: C, sender_id: B, text: '', krypto: 1 },
  ],
  krypto_schluessel: [{ id: 'kA', user_id: A, oeffentlich: 'x' }, { id: 'kB', user_id: B, oeffentlich: 'y' }],
};
const geschrieben = [];
function client() {
  return {
    from(t) {
      let f = [], lim = null, upd = null, ins = null;
      const q = {
        select() { return q; }, order() { return q; }, range() { return q; },
        eq(s, v) { f.push((z) => z[s] === v); return q; },
        gt(s, v) { f.push((z) => Number(z[s]) > v); return q; },
        in(s, l) { f.push((z) => l.includes(z[s])); return q; },
        limit(n) { lim = n; return q; },
        update(u) { upd = u; return q; },
        insert(i) { ins = i; return q; },
        maybeSingle() { return q.then((r) => ({ data: r.data[0] || null, error: null })); },
        single() { return q.maybeSingle(); },
        then(res, rej) {
          let d = (tab[t] || []).filter((z) => f.every((g) => g(z)));
          if (upd) { d.forEach((z) => Object.assign(z, upd)); geschrieben.push({ t, upd }); }
          if (ins) { geschrieben.push({ t, ins }); d = [ins]; }
          if (lim != null) d = d.slice(0, lim);
          return Promise.resolve({ data: d, error: null, count: d.length }).then(res, rej);
        },
      };
      return q;
    },
  };
}

(async () => {
  const s = await S.handleSendMessage(client(), A, C, 'meine neue PIN ist 4711', { klartextPruefen: true });
  pruefe('Senden desselben Klartexts wird abgelehnt (AR-05)', s && s.ok === false, s && s.fehler);
  const vorher = geschrieben.length;
  const e = await S.handleNachrichtBearbeiten(client(), A, 'm1', 'meine neue PIN ist 4711', {});
  pruefe('Bearbeiten derselben Worte wird angenommen', e && e.ok === true, JSON.stringify(e));
  const upd = geschrieben.slice(vorher).find((g) => g.t === 'messages' && g.upd);
  pruefe('Datenbankzeile erhält den neuen Text im Klartext', upd && upd.upd.text === 'meine neue PIN ist 4711');
  pruefe('Zeile bleibt krypto = 0', tab.messages[0].krypto === 0 && tab.messages[0].text === 'meine neue PIN ist 4711');
  console.log(`\nErgebnis: ${ok}/${ok + fehl} Aussagen belegt`);
  process.exit(fehl ? 1 : 0);
})().catch((e) => { console.error('ABBRUCH', e); process.exit(2); });
