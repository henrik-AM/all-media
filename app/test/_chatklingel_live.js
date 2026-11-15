#!/usr/bin/env node
/**
 * Kasten AF 1 — Chat-Klingel mit ZWEI echten Testkonten gegen Supabase.
 * Erst nach der Entsperrung und nach Schema 100 lauffähig (vorher: 402 bzw.
 * keine Klingel). Vorlage: Teil 2 von _chatsync.js.
 *
 *   A = test@all-media.app, B = Prüfkonto. Beide hören wie App und Website
 *   über gemeinsam/chatabgleich.js (klingelHoeren).
 *
 *   1. A schreibt → B hört chat:<id> und nutzer:<B> in unter 2 s
 *   2. B reagiert → A hört chat:<id>
 *   3. A bearbeitet, A nimmt zurück → B hört chat:<id>
 *   4. B liest (read_at) → A hört chat:<id>
 *   5. Ein fremdes Konto hört nichts: B horcht auf nutzer:<A> → kein SUBSCRIBED
 *   6. Nichts doppelt, Reihenfolge: B lädt danach den Verlauf, Kennungen
 *      eindeutig, nach created_at aufsteigend
 *
 * Verschlüsselt/unverschlüsselt macht für die Klingel keinen Unterschied (sie
 * trägt keinen Inhalt); Entschlüsseln nach dem Nachladen prüft _chatsync.js.
 * Räumt seinen Probechat selbst wieder ab.
 *
 * Start:  node test/_chatklingel_live.js   (npm run test:chatklingel-live)
 */
const fs = require('fs');
const path = require('path');
const ChatAbgleich = require('../../gemeinsam/chatabgleich');

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz !== '' ? '  — ' + zusatz : ''));
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/** Hört ein Thema und zählt Klingeln; wartet auf SUBSCRIBED (höchstens 8 s). */
async function hoeren(client, thema) {
  const h = { n: 0, verbunden: false, zustaende: [] };
  h.aus = ChatAbgleich.klingelHoeren(
    client,
    thema,
    () => h.n++,
    (v) => {
      h.verbunden = v;
      h.zustaende.push(v);
    }
  );
  for (let i = 0; i < 80 && !h.verbunden; i++) await warte(100);
  // Das Nachsehen nach dem Verbinden ist keine Klingel der Datenbank.
  await warte(ChatAbgleich.KLINGEL_BUENDELN_MS + 100);
  h.n = 0;
  return h;
}

/** Wartet, bis h.n über `vorher` steigt; gibt die Dauer in ms zurück oder null. */
async function bisKlingel(h, vorher, grenzeMs = 2000) {
  const start = Date.now();
  while (Date.now() - start < grenzeMs) {
    if (h.n > vorher) return Date.now() - start;
    await warte(25);
  }
  return null;
}

(async () => {
  const { createClient } = require('@supabase/supabase-js');
  const { nurTestkonto } = require('./_nur_testkonten');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const UMG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    : '';
  const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
  const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
  const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!URL || !KEY) {
    console.log('ABBRUCH  Supabase-Zugang fehlt (app/.env.local).');
    process.exit(2);
  }
  const anmelden = async (email, passwort) => {
    const client = createClient(URL, KEY);
    const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
    if (error) throw new Error(`${email}: ${error.message}`);
    return { client, id: data.user.id };
  };
  const A = await anmelden('test@all-media.app', TESTKONTO_PASS);
  const B = await anmelden(
    nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
    process.env.AM_TEST_PASS || PRUEFKONTO_PASS
  );

  const { data: chat, error } = await A.client
    .from('chats')
    .insert({ name: 'Prüflauf Kasten AF 1', is_group: false, bereich: 'community', created_by: A.id })
    .select('id')
    .single();
  if (error) throw error;
  const hoerer = [];
  const aufraeumen = async () => {
    hoerer.forEach((h) => h.aus());
    await A.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', A.id);
    await B.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', B.id);
    await B.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', B.id);
    await A.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', A.id);
    await A.client.from('chats').delete().eq('id', chat.id);
  };

  try {
    await A.client.from('chat_members').insert({ chat_id: chat.id, user_id: A.id });
    const { error: em } = await A.client.from('chat_members').insert({ chat_id: chat.id, user_id: B.id });
    if (em) throw em;

    const bChat = await hoeren(B.client, ChatAbgleich.klingelThema('chat', chat.id));
    const bListe = await hoeren(B.client, ChatAbgleich.klingelThema('nutzer', B.id));
    const aChat = await hoeren(A.client, ChatAbgleich.klingelThema('chat', chat.id));
    hoerer.push(bChat, bListe, aChat);
    pruefe('B verbunden mit chat:<id>', bChat.verbunden);
    pruefe('B verbunden mit nutzer:<B>', bListe.verbunden);
    pruefe('A verbunden mit chat:<id>', aChat.verbunden);

    console.log('\n1. A schreibt');
    let n = bChat.n;
    let l = bListe.n;
    const { data: m1, error: e1 } = await A.client
      .from('messages')
      .insert({ chat_id: chat.id, sender_id: A.id, text: 'af1-' + Date.now() })
      .select('id')
      .single();
    if (e1) throw e1;
    const d1 = await bisKlingel(bChat, n);
    pruefe('B hört den Chat in unter 2 s', d1 !== null, d1 === null ? 'keine Klingel' : d1 + ' ms');
    const d1l = await bisKlingel(bListe, l);
    pruefe('B hört seine Chatliste', d1l !== null, d1l === null ? 'keine Klingel' : d1l + ' ms');

    // Der Chat ist eine Anfrage (Schema 21): B antwortet, damit A weiter schreiben darf.
    await B.client.from('messages').insert({ chat_id: chat.id, sender_id: B.id, text: 'ok' });
    await warte(600);

    console.log('\n2. B reagiert');
    n = aChat.n;
    const { error: er } = await B.client.from('message_reactions').insert({ message_id: m1.id, user_id: B.id, emoji: '👍' });
    pruefe('Reaktion gespeichert', !er, er?.message);
    const d2 = await bisKlingel(aChat, n);
    pruefe('A hört die Reaktion', d2 !== null, d2 === null ? 'keine Klingel' : d2 + ' ms');

    console.log('\n3. A bearbeitet und nimmt zurück');
    n = bChat.n;
    await A.client.from('messages').update({ text: 'af1-bearbeitet', edited_at: new Date().toISOString() }).eq('id', m1.id);
    const d3 = await bisKlingel(bChat, n);
    pruefe('B hört das Bearbeiten', d3 !== null, d3 === null ? 'keine Klingel' : d3 + ' ms');
    n = bChat.n;
    await A.client.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', m1.id);
    const d3b = await bisKlingel(bChat, n);
    pruefe('B hört das Zurücknehmen', d3b !== null, d3b === null ? 'keine Klingel' : d3b + ' ms');

    console.log('\n4. B liest');
    n = aChat.n;
    const { error: eg } = await B.client.rpc('chat_gelesen', { p_chat: chat.id });
    pruefe('chat_gelesen läuft', !eg, eg?.message);
    const d4 = await bisKlingel(aChat, n);
    pruefe('A hört die Lesebestätigung', d4 !== null || !!eg, d4 === null ? 'keine Klingel (Lesebestätigung bei B aus?)' : d4 + ' ms');

    console.log('\n5. Fremde Liste');
    const fremd = await hoeren(B.client, ChatAbgleich.klingelThema('nutzer', A.id));
    hoerer.push(fremd);
    pruefe('B darf nutzer:<A> nicht hören', !fremd.verbunden, JSON.stringify(fremd.zustaende));

    console.log('\n6. Nichts doppelt, Reihenfolge');
    const { data: zeilen } = await B.client
      .from('messages')
      .select('id, created_at')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: false })
      .limit(500);
    const auf = ChatAbgleich.chronologisch(zeilen || []);
    pruefe('Kennungen eindeutig', new Set(auf.map((z) => z.id)).size === auf.length, auf.length + ' Zeilen');
    pruefe('aufsteigend nach Zeit', auf.every((z, i) => i === 0 || auf[i - 1].created_at <= z.created_at));
  } finally {
    await aufraeumen();
  }
  console.log(`\n${anzahl - fehler}/${anzahl} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.log('ABBRUCH ', e.message);
  process.exit(1);
});
