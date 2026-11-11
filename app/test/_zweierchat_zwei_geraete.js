#!/usr/bin/env node
/**
 * Schema 126 live mit zwei Konten: „zwei Geräte gleichzeitig“.
 *
 * @test und @prueflauf melden sich je zweimal an (vier Clients = vier Geräte)
 * und rufen GLEICHZEITIG den echten Anlege-Weg auf:
 *   - zwei Clients über chatMit aus web/server/sync-handlers.js (Website-Server)
 *   - zwei Clients direkt über rpc('zweierchat_anlegen') (wie die App)
 * Erwartet: alle bekommen dieselbe Chat-ID, in der Datenbank steht danach
 * genau EIN Community-Zweierchat für das Paar, mit genau zwei Mitgliedern.
 *
 * Bestand vorher wird gemerkt; nur der hier neu angelegte Chat wird danach
 * wieder abgebaut (Mitteilungen, Nachrichten, Mitglieder, Chat).
 * Braucht die Belegung testbestand und SUPABASE_TOKEN.
 */
require('./_ki_belegung').pruefeBelegung('testbestand');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { frage } = require('./_aufraeumen');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');

const UMGEBUNG = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const wert = (n) => (UMGEBUNG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
const URL = wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const TEST = { email: 'test@all-media.app', passwort: TESTKONTO_PASS };
const PRUEF = { email: 'all.media.prueflauf@web.de', passwort: PRUEFKONTO_PASS };
const BEREICH = 'community';

let ok = 0;
let fehl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  wahr ? ok++ : fehl++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function anmelden(z) {
  const client = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: z.email, password: z.passwort });
  if (error) throw new Error(z.email + ': ' + error.message);
  return { client, id: data.user.id };
}

const paarChats = (a, b) => frage(`
  select c.id from public.chats c
   where not c.is_group and coalesce(c.bereich,'messenger') = '${BEREICH}'
     and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = '${a}')
     and exists (select 1 from public.chat_members m where m.chat_id = c.id and m.user_id = '${b}')`);

(async () => {
  const [t1, t2, p1, p2] = await Promise.all([anmelden(TEST), anmelden(TEST), anmelden(PRUEF), anmelden(PRUEF)]);
  const vorher = (await paarChats(t1.id, p1.id)).map((z) => z.id);
  console.log(`Vorher: ${vorher.length} Community-Zweierchat(s) zwischen @test und @prueflauf`);

  const { handleChatMit } = require(path.join(__dirname, '..', '..', 'web', 'server', 'sync-handlers.js'));
  const ergebnisse = await Promise.allSettled([
    handleChatMit(t1.client, t1.id, p1.id, BEREICH).then((r) => (r?.ok ? r.chatId : Promise.reject(new Error(JSON.stringify(r))))),
    handleChatMit(p1.client, p1.id, t1.id, BEREICH).then((r) => (r?.ok ? r.chatId : Promise.reject(new Error(JSON.stringify(r))))),
    t2.client.rpc('zweierchat_anlegen', { p_ziel: p1.id, p_bereich: BEREICH, p_name: 'Prüflauf' }).then((r) => (r.error ? Promise.reject(r.error) : r.data)),
    p2.client.rpc('zweierchat_anlegen', { p_ziel: t1.id, p_bereich: BEREICH, p_name: 'Prüflauf' }).then((r) => (r.error ? Promise.reject(r.error) : r.data)),
  ]);
  const ids = ergebnisse.map((e) => (e.status === 'fulfilled' ? e.value : 'FEHLER ' + (e.reason?.message || e.reason)));
  pruefe('Alle vier Geräte kommen durch', ergebnisse.every((e) => e.status === 'fulfilled'), ids.join(', '));
  pruefe('Alle vier bekommen dieselbe Chat-ID', new Set(ids).size === 1, [...new Set(ids)].join(', '));

  const nachher = (await paarChats(t1.id, p1.id)).map((z) => z.id);
  const neu = nachher.filter((id) => !vorher.includes(id));
  pruefe('Danach genau ein Chat für das Paar (vorher ' + vorher.length + ')', nachher.length === Math.max(1, vorher.length), nachher.length + ' Chat(s)');
  pruefe('Höchstens einer neu angelegt', neu.length <= 1, neu.length + ' neu');
  if (nachher[0]) {
    const [m] = await frage(`select count(*)::int n from public.chat_members where chat_id = '${ids[0]}'`);
    pruefe('Genau zwei Mitglieder', m.n === 2, String(m.n));
  }

  // Abbau: nur was dieser Lauf angelegt hat.
  for (const id of neu) {
    await frage(`
      delete from public.notifications where target_type = 'chat' and target_id = '${id}';
      delete from public.messages where chat_id = '${id}';
      delete from public.chat_members where chat_id = '${id}';
      delete from public.chats where id = '${id}';`);
  }
  const rest = (await paarChats(t1.id, p1.id)).map((z) => z.id);
  pruefe('Abgebaut: Bestand wie vorher', rest.length === vorher.length && rest.every((id) => vorher.includes(id)), rest.length + ' Chat(s)');

  console.log(`\n${ok}/${ok + fehl} Prüfungen bestanden`);
  process.exit(fehl ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e.message);
  process.exit(1);
});
