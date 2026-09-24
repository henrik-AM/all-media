/**
 * Community-Chat vor Messenger — hält die Datenbank, was Henrik viermal
 * verlangt hat? (Feedback 21.09.2026, Kasten 3, Schema 57)
 *
 * WARUM ES DAS GIBT
 *
 * „Lernt man jemanden unter Videos kennen, wird zuerst unter Communitys →
 * Chats geschrieben. Erst nach etwas Austausch kann eine Anfrage gehen, ob
 * man in den Messenger wechselt. Nimmt die Person an, erscheint sie im
 * Messenger — sonst bleibt alles unter Communitys." Und: kein neuer Nutzer
 * taucht von selbst in fremden Messenger-Listen auf.
 *
 * Am 20.09.2026 hat ein Konto ein Video an sieben Leute geteilt und stand
 * danach in sieben fremden Messenger-Listen. Die Oberfläche fiel außerhalb
 * der Communitys auf 'messenger' zurück, und die Datenbank hatte nichts
 * dagegen. Geprüft wird deshalb mit zwei Konten und ohne Oberfläche: die
 * App schreibt direkt nach Supabase, jede Regel im Bildschirm wäre umgehbar.
 *
 * Start:  node test/_messengeranfrage.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const EIGNER = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const FREMDER = {
  email: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  passwort: process.env.AM_TEST_PASS || 'PruefLauf2026!',
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function anmelden(zugang) {
  const client = createClient(URL, KEY);
  const { data, error } = await client.auth.signInWithPassword({
    email: zugang.email,
    password: zugang.passwort,
  });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  const eigner = await anmelden(EIGNER);
  const fremder = await anmelden(FREMDER);
  const wegRaeumen = [];

  // Kontakte zwischen den beiden, in beide Richtungen.
  const kontakte = async () => {
    const [{ data: a }, { data: b }] = await Promise.all([
      eigner.client.from('contacts').select('status, herkunft').eq('user_id', eigner.id).eq('contact_id', fremder.id),
      fremder.client.from('contacts').select('status, herkunft').eq('user_id', fremder.id).eq('contact_id', eigner.id),
    ]);
    return { vonEigner: (a || [])[0] || null, vonFremder: (b || [])[0] || null };
  };

  // Die gemeinsamen Zweierchats in einem Bereich, aus Sicht des Eigners.
  const gemeinsameChats = async (bereich) => {
    const { data: meine } = await eigner.client
      .from('chat_members')
      .select('chat_id, chats(is_group, bereich)')
      .eq('user_id', eigner.id);
    const ids = (meine || [])
      .filter((m) => m.chats && !m.chats.is_group && m.chats.bereich === bereich)
      .map((m) => m.chat_id);
    if (!ids.length) return [];
    const { data: andere } = await eigner.client
      .from('chat_members')
      .select('chat_id')
      .in('chat_id', ids)
      .eq('user_id', fremder.id);
    return (andere || []).map((z) => z.chat_id);
  };

  const chatAbraeumen = (chatId) =>
    wegRaeumen.push(async () => {
      await eigner.client.from('messages').delete().eq('chat_id', chatId).eq('sender_id', eigner.id);
      await fremder.client.from('messages').delete().eq('chat_id', chatId).eq('sender_id', fremder.id);
      await fremder.client.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', fremder.id);
      await eigner.client.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', eigner.id);
      await eigner.client.from('chats').delete().eq('id', chatId);
      await fremder.client.from('chats').delete().eq('id', chatId);
    });

  const schreiben = async (wer, chatId, text) => {
    const { error } = await wer.client.from('messages').insert({ chat_id: chatId, sender_id: wer.id, text });
    return !error;
  };

  const zustand = async (chatId) => {
    const { data } = await eigner.client
      .from('chats')
      .select('messenger_anfrage, messenger_anfrage_von')
      .eq('id', chatId)
      .single();
    return data || {};
  };

  try {
    const vorher = await kontakte();
    const vorherMessenger = await gemeinsameChats('messenger');
    if (vorher.vonEigner || vorher.vonFremder || vorherMessenger.length) {
      throw new Error(
        'Die beiden Testkonten sind schon verbunden — ein früherer Lauf hat nicht aufgeräumt. ' +
          'Kontakte und Messenger-Chats zwischen @test und @prueflauf von Hand entfernen.'
      );
    }

    console.log('\nKein Weg in den Messenger ohne Zustimmung');

    const { error: ohneNummer } = await eigner.client
      .from('contacts')
      .insert({ user_id: eigner.id, contact_id: fremder.id, status: 'friend' });
    pruefe('Kontakt ohne Nummer wird abgewiesen', Boolean(ohneNummer), ohneNummer?.message);
    pruefe('Nachgezählt: kein Kontakt steht da', !(await kontakte()).vonEigner);

    const { data: mChat, error: mFehler } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Messenger ohne Kontakt', is_group: false, bereich: 'messenger', created_by: eigner.id })
      .select('id')
      .single();
    if (mFehler) throw mFehler;
    chatAbraeumen(mChat.id);
    await eigner.client.from('chat_members').insert({ chat_id: mChat.id, user_id: eigner.id });
    const { error: fremdRein } = await eigner.client
      .from('chat_members')
      .insert({ chat_id: mChat.id, user_id: fremder.id });
    pruefe('Einen Fremden in einen Messenger-Chat eintragen geht nicht', Boolean(fremdRein), fremdRein?.message);
    const { data: fremdSieht } = await fremder.client.from('chat_members').select('chat_id').eq('chat_id', mChat.id);
    pruefe('Nachgezählt: der Fremde sieht diesen Chat nicht', (fremdSieht || []).length === 0);

    const { data: dritter } = await eigner.client.rpc('messenger_erlaubt', { ich: fremder.id, ziel: eigner.id });
    pruefe('messenger_erlaubt verrät nichts über fremde Paare', dritter === false, String(dritter));

    console.log('\nErst unter Communitys, dann die Frage');

    const { data: kChat, error: kFehler } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Community zuerst', is_group: false, bereich: 'community', created_by: eigner.id })
      .select('id')
      .single();
    if (kFehler) throw kFehler;
    chatAbraeumen(kChat.id);
    await eigner.client.from('chat_members').insert({ chat_id: kChat.id, user_id: eigner.id });
    const { error: kRein } = await eigner.client
      .from('chat_members')
      .insert({ chat_id: kChat.id, user_id: fremder.id });
    pruefe('Unter Communitys lässt sich ein Fremder anschreiben', !kRein, kRein?.message);

    const { error: zuFrueh } = await eigner.client.rpc('messenger_anfragen', { p_chat: kChat.id });
    pruefe('Vor dem Austausch lässt sich nicht fragen', Boolean(zuFrueh), zuFrueh?.message);

    pruefe('Der Eigner schreibt', await schreiben(eigner, kChat.id, 'Hallo aus dem Prüflauf'));
    pruefe('Der Fremde antwortet', await schreiben(fremder, kChat.id, 'Hallo zurück'));

    const { error: selbstGesetzt } = await eigner.client
      .from('chats')
      .update({ messenger_anfrage: 'angenommen', messenger_anfrage_von: fremder.id })
      .eq('id', kChat.id);
    pruefe(
      'Den Zustand von Hand auf „angenommen" setzen geht nicht',
      Boolean(selbstGesetzt) && (await zustand(kChat.id)).messenger_anfrage === 'keine',
      selbstGesetzt?.message
    );

    const { data: gefragt, error: fragFehler } = await eigner.client.rpc('messenger_anfragen', { p_chat: kChat.id });
    pruefe('Nach dem Austausch geht die Anfrage raus', !fragFehler && gefragt?.zustand === 'wartet', fragFehler?.message);
    const z1 = await zustand(kChat.id);
    pruefe('Sie steht am Chat, vom Eigner', z1.messenger_anfrage === 'wartet' && z1.messenger_anfrage_von === eigner.id);

    const { data: glocke } = await fremder.client
      .from('notifications')
      .select('id, art, target_type, target_id')
      .eq('art', 'messenger_anfrage')
      .eq('target_id', kChat.id);
    pruefe('Der Fremde bekommt eine Mitteilung, die in den Chat führt',
      (glocke || []).length === 1 && glocke[0].target_type === 'chat');
    wegRaeumen.push(async () => {
      await fremder.client.from('notifications').delete().eq('target_id', kChat.id);
      await eigner.client.from('notifications').delete().eq('target_id', kChat.id);
    });

    const { error: doppelt } = await eigner.client.rpc('messenger_anfragen', { p_chat: kChat.id });
    pruefe('Ein zweites Mal fragen, solange sie läuft, geht nicht', Boolean(doppelt), doppelt?.message);

    const { error: eigeneAntwort } = await eigner.client.rpc('messenger_anfrage_beantworten', {
      p_chat: kChat.id,
      p_annehmen: true,
    });
    pruefe('Die eigene Anfrage annehmen geht nicht', Boolean(eigeneAntwort), eigeneAntwort?.message);

    console.log('\nAblehnen lässt alles unter Communitys');

    const { error: abFehler } = await fremder.client.rpc('messenger_anfrage_beantworten', {
      p_chat: kChat.id,
      p_annehmen: false,
    });
    pruefe('Der Fremde lehnt ab', !abFehler, abFehler?.message);
    pruefe('Zustand: abgelehnt', (await zustand(kChat.id)).messenger_anfrage === 'abgelehnt');
    const nachAblehnung = await kontakte();
    pruefe('Kein Kontakt in keiner Richtung', !nachAblehnung.vonEigner && !nachAblehnung.vonFremder);
    pruefe('Kein Messenger-Chat zwischen den beiden', (await gemeinsameChats('messenger')).length === 0);
    pruefe('Der Community-Chat bleibt', (await gemeinsameChats('community')).includes(kChat.id));
    pruefe('Und dort geht das Schreiben weiter', await schreiben(eigner, kChat.id, 'Schade, dann hier'));

    const { error: nochmal } = await eigner.client.rpc('messenger_anfragen', { p_chat: kChat.id });
    pruefe('Wer abgelehnt wurde, fragt nicht noch einmal', Boolean(nochmal), nochmal?.message);

    console.log('\nAnnehmen führt in den Messenger');

    const { error: umgekehrt } = await fremder.client.rpc('messenger_anfragen', { p_chat: kChat.id });
    pruefe('Später darf die andere Seite selbst fragen', !umgekehrt, umgekehrt?.message);

    const { data: an, error: anFehler } = await eigner.client.rpc('messenger_anfrage_beantworten', {
      p_chat: kChat.id,
      p_annehmen: true,
    });
    pruefe('Der Eigner nimmt an', !anFehler && an?.zustand === 'angenommen', anFehler?.message);
    if (an?.messengerChat) chatAbraeumen(an.messengerChat);
    wegRaeumen.push(async () => {
      await eigner.client.from('contacts').delete().eq('user_id', eigner.id).eq('contact_id', fremder.id);
      await fremder.client.from('contacts').delete().eq('user_id', fremder.id).eq('contact_id', eigner.id);
      if (an?.messengerChat) {
        await fremder.client.from('notifications').delete().eq('target_id', an.messengerChat);
      }
    });

    const nachAnnahme = await kontakte();
    pruefe('Beide führen sich jetzt als Kontakt',
      nachAnnahme.vonEigner?.status === 'friend' && nachAnnahme.vonFremder?.status === 'friend');
    pruefe('Herkunft: die Anfrage, nicht die Nummer',
      nachAnnahme.vonEigner?.herkunft === 'anfrage' && nachAnnahme.vonFremder?.herkunft === 'anfrage');

    const messenger = await gemeinsameChats('messenger');
    pruefe('Es gibt genau einen Messenger-Chat', messenger.length === 1 && messenger[0] === an?.messengerChat);
    pruefe('Der Fremde sieht ihn in seiner Liste',
      ((await fremder.client.from('chat_members').select('chat_id').eq('chat_id', an?.messengerChat).eq('user_id', fremder.id)).data || []).length === 1);
    pruefe('Der Eigner schreibt im Messenger', await schreiben(eigner, an?.messengerChat, 'Jetzt hier'));
    pruefe('Und gleich noch einmal — angenommen ist angenommen', await schreiben(eigner, an?.messengerChat, 'Und noch mal'));

    const { data: ok } = await fremder.client
      .from('notifications')
      .select('art')
      .eq('art', 'messenger_ok')
      .eq('target_id', an?.messengerChat);
    pruefe('Der Fragende erfährt, dass angenommen wurde', (ok || []).length === 1);

    console.log('\nDie Nummer bleibt, wo sie war');

    const [{ data: nrEigner }, { data: nrFremder }] = await Promise.all([
      eigner.client.rpc('meine_kontaktnummern'),
      fremder.client.rpc('meine_kontaktnummern'),
    ]);
    pruefe('Der Eigner sieht die Nummer des Fremden nicht', !(nrEigner || {})[fremder.id]);
    pruefe('Der Fremde sieht die Nummer des Eigners nicht', !(nrFremder || {})[eigner.id]);

    await fremder.client
      .from('contacts')
      .update({ herkunft: 'nummer' })
      .eq('user_id', fremder.id)
      .eq('contact_id', eigner.id);
    pruefe('Die Herkunft lässt sich nicht umschreiben', (await kontakte()).vonFremder?.herkunft === 'anfrage');
    const { data: nrDanach } = await fremder.client.rpc('meine_kontaktnummern');
    pruefe('Nachgezählt: die Nummer bleibt verborgen', !(nrDanach || {})[eigner.id]);
  } finally {
    for (const schritt of wegRaeumen.reverse()) {
      try {
        await schritt();
      } catch (e) {
        console.log('  HINWEIS  Aufräumen: ' + (e?.message ?? e));
      }
    }
  }

  // Gegenprobe: ein verbotenes DELETE meldet unter RLS keinen Fehler.
  const nachher = await kontakte();
  pruefe('Aufgeräumt: kein Kontakt bleibt zurück', !nachher.vonEigner && !nachher.vonFremder);
  pruefe('Aufgeräumt: kein Messenger-Chat bleibt zurück', (await gemeinsameChats('messenger')).length === 0);

  console.log(
    fehler === 0
      ? `\n${geprueft} von ${geprueft} Pruefungen bestanden. In den Messenger kommt nur, wer zugestimmt hat.`
      : `\n${fehler} von ${geprueft} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
