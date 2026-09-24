// Die Gegenseite für den App-Bildnachweis zu Kasten 3.
//
// Im Prüfsimulator ist @test angemeldet. Damit dort eine Anfrage eingehen
// oder abgelehnt werden kann, braucht es eine zweite Person — das ist hier
// @prueflauf, über dieselben Datenbankfunktionen wie App und Website.
//
// Start:  node test/_kasten3_gegenseite.js schreiben "Text"
//         node test/_kasten3_gegenseite.js fragen | ablehnen | annehmen

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const wert = (n) => (env.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1];
const client = createClient(wert('EXPO_PUBLIC_SUPABASE_URL'), wert('EXPO_PUBLIC_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false },
});

(async () => {
  const [was, text] = process.argv.slice(2);
  const { data: an, error: anFehler } = await client.auth.signInWithPassword({
    email: 'all.media.prueflauf@web.de',
    password: 'PruefLauf2026!',
  });
  if (anFehler) throw anFehler;
  const ich = an.user.id;

  const { data: eigner } = await client.from('profiles').select('id').eq('handle', '@test').single();
  const { data: meine } = await client.from('chat_members').select('chat_id').eq('user_id', ich);
  const { data: gemeinsam } = await client
    .from('chat_members')
    .select('chat_id')
    .eq('user_id', eigner.id)
    .in('chat_id', (meine || []).map((m) => m.chat_id));
  const { data: chats } = await client
    .from('chats')
    .select('id')
    .in('id', (gemeinsam || []).map((m) => m.chat_id))
    .eq('is_group', false)
    .eq('bereich', 'community');
  const chat = (chats || [])[0];
  if (!chat) throw new Error('Kein Community-Chat mit @test');

  let ergebnis;
  if (was === 'schreiben') {
    ergebnis = await client.from('messages').insert({ chat_id: chat.id, sender_id: ich, text });
  } else if (was === 'fragen') {
    ergebnis = await client.rpc('messenger_anfragen', { p_chat: chat.id });
  } else if (was === 'ablehnen' || was === 'annehmen') {
    ergebnis = await client.rpc('messenger_anfrage_beantworten', { p_chat: chat.id, p_annehmen: was === 'annehmen' });
  } else {
    throw new Error('Unbekannt: ' + was);
  }
  if (ergebnis.error) throw ergebnis.error;
  console.log(was, 'ok', chat.id, JSON.stringify(ergebnis.data ?? null));
})().catch((e) => {
  console.error('FEHLER', e.message);
  process.exit(1);
});
