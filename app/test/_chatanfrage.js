/**
 * Die Chat-Anfrage — hält sie, was das Handbuch verspricht?
 *
 * WARUM ES DAS GIBT
 *
 * Aus dem Handbuch: „Neue Profile zum Chatten suchen/einladen (einmalige
 * Nachricht, danach muss das angeschriebene Profil die Chateinladung
 * annehmen)."
 *
 * Was es bis zum 03.09.2026 dazu gab, war ein Knopf „Annahme simulieren" im
 * Chat des ABSENDERS. Er schrieb `contacts.status = 'friend'` in die eigene
 * Zeile — der Absender nahm seine eigene Anfrage an und durfte danach
 * schreiben, so viel er wollte. Die angeschriebene Person kam nicht vor.
 *
 * Geprüft wird deshalb mit zwei Konten und ohne Oberfläche: die Regeln müssen
 * in der Datenbank stehen, weil die App direkt nach Supabase schreibt und an
 * jeder Prüfung im Servercode vorbeikäme.
 *
 * Start:  node test/_chatanfrage.js
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
const pruefe = (name, wahr, zusatz = '') => {
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

  /*
   * Ein frischer Chat für jeden Durchgang.
   *
   * Nicht der vorhandene zwischen den beiden Konten: der Anfragezustand ist
   * eine Einbahnstraße (angenommen bleibt angenommen), und ein Prüflauf, der
   * einen bestehenden Chat umwidmet, wäre beim zweiten Mal grün, ohne etwas
   * geprüft zu haben.
   */
  /*
   * Fremde schreiben sich seit Schema 57 unter Communitys an — im Messenger
   * nimmt die Datenbank das zweite Mitglied nur unter Kontakten auf.
   */
  const chatAnlegen = async (bereich = 'community') => {
    const { data: chat, error } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Anfrage', is_group: false, bereich, created_by: eigner.id })
      .select('id')
      .single();
    if (error) throw error;

    /*
     * Abräumen in genau dieser Reihenfolge — und mit beiden Konten.
     *
     * Ein Chat lässt sich nur löschen, wenn niemand mehr darin ist („Leeren
     * Chat abraeumen"), und aus `chat_members` darf jeder nur die eigene
     * Zeile nehmen. Der erste Anlauf am 03.09.2026 hat schlicht
     * `delete from chats` versucht: RLS ließ null Zeilen zu und meldete
     * keinen Fehler. Nach ein paar Läufen standen elf Chats „Prüflauf
     * Anfrage" im Bestand — und das Zurücksetzen brach daran ab.
     */
    wegRaeumen.push(async () => {
      await eigner.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', eigner.id);
      await fremder.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', fremder.id);
      await fremder.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', fremder.id);
      await eigner.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', eigner.id);
      await eigner.client.from('chats').delete().eq('id', chat.id);

      // Gegenprobe: ein verbotenes DELETE meldet unter RLS keinen Fehler.
      const { count } = await eigner.client
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('id', chat.id);
      if (count) console.log(`  HINWEIS  Chat ${chat.id} blieb stehen.`);
    });

    // Der Auslöser hängt am zweiten Mitglied — die Reihenfolge zählt.
    await eigner.client.from('chat_members').insert({ chat_id: chat.id, user_id: eigner.id });
    await eigner.client.from('chat_members').insert({ chat_id: chat.id, user_id: fremder.id });
    return chat.id;
  };

  const zustandVon = async (konto, chatId) => {
    const { data } = await konto.client
      .from('chats')
      .select('anfrage_zustand, anfrage_von')
      .eq('id', chatId)
      .maybeSingle();
    return data || {};
  };

  const schreiben = async (konto, chatId, text) => {
    const { error } = await konto.client
      .from('messages')
      .insert({ chat_id: chatId, sender_id: konto.id, text });
    return error;
  };

  try {
    console.log('\nEine Anfrage entsteht von selbst');

    const chat1 = await chatAnlegen();
    const z1 = await zustandVon(eigner, chat1);
    pruefe('Ein neuer Zweierchat wird zur Anfrage', z1.anfrage_zustand === 'wartet',
      String(z1.anfrage_zustand));
    pruefe('Sie kommt von dem, der angelegt hat', z1.anfrage_von === eigner.id);

    console.log('\nEs bleibt bei einer Nachricht');

    pruefe('Die erste Nachricht geht durch', !(await schreiben(eigner, chat1, 'Hallo!')));

    const zweite = await schreiben(eigner, chat1, 'Und noch eine');
    pruefe('Die zweite wird abgelehnt', Boolean(zweite), zweite ? zweite.code : 'kein Fehler');

    /*
     * Ein abgelehntes INSERT unter RLS meldet zwar hier einen Fehler, aber
     * verlassen wir uns nicht darauf: nachzählen. Siehe die Erfahrung mit
     * dem verbotenen DELETE, das stillschweigend „Erfolg" meldete.
     */
    const { count } = await eigner.client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chat1)
      .eq('sender_id', eigner.id);
    pruefe('Es steht wirklich nur eine da', count === 1, `${count} Nachrichten`);

    console.log('\nÜber die eigene Anfrage entscheidet man nicht selbst');

    const { error: selbst } = await eigner.client
      .from('chats')
      .update({ anfrage_zustand: 'angenommen' })
      .eq('id', chat1);
    pruefe('Der Absender kann sie nicht selbst annehmen', Boolean(selbst),
      selbst ? selbst.message : 'ging durch');

    const nachSelbst = await zustandVon(eigner, chat1);
    pruefe('Und sie steht danach immer noch auf „wartet"',
      nachSelbst.anfrage_zustand === 'wartet', String(nachSelbst.anfrage_zustand));

    console.log('\nDie angeschriebene Person entscheidet');

    const { error: annehmen } = await fremder.client
      .from('chats')
      .update({ anfrage_zustand: 'angenommen' })
      .eq('id', chat1);
    pruefe('Sie kann annehmen', !annehmen, annehmen ? annehmen.message : '');

    pruefe('Danach darf der Absender weiterschreiben',
      !(await schreiben(eigner, chat1, 'Danke!')));

    console.log('\nAblehnen heißt abgelehnt');

    const chat2 = await chatAnlegen();
    await schreiben(eigner, chat2, 'Darf ich?');
    const { error: ablehnen } = await fremder.client
      .from('chats')
      .update({ anfrage_zustand: 'abgelehnt' })
      .eq('id', chat2);
    pruefe('Die angeschriebene Person kann ablehnen', !ablehnen,
      ablehnen ? ablehnen.message : '');

    const nachAblehnung = await schreiben(eigner, chat2, 'Bitte doch');
    pruefe('Danach kommt nichts mehr durch', Boolean(nachAblehnung));

    const { count: c2 } = await eigner.client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chat2)
      .eq('sender_id', eigner.id);
    pruefe('Nachgezählt: eine Nachricht', c2 === 1, `${c2} Nachrichten`);

    console.log('\nEine Antwort ist eine Annahme');

    const chat3 = await chatAnlegen();
    await schreiben(eigner, chat3, 'Hallo?');
    pruefe('Die angeschriebene Person darf antworten',
      !(await schreiben(fremder, chat3, 'Hallo zurück')));

    const z3 = await zustandVon(eigner, chat3);
    pruefe('Damit gilt die Anfrage als angenommen', z3.anfrage_zustand === 'angenommen',
      String(z3.anfrage_zustand));
    pruefe('Und der Absender darf weiterschreiben',
      !(await schreiben(eigner, chat3, 'Schön!')));

    console.log('\nWer schon Kontakt ist, wird nicht gefragt');

    /*
     * Der Fall braucht einen Kontakt, und zwar in der Zeile der
     * ANGESCHRIEBENEN Person: sie führt den Absender. Stand er nicht ohnehin
     * schon da, wird er angelegt und hinterher wieder abgeräumt — sonst wäre
     * die Prüfung davon abhängig, was ein früherer Lauf hinterlassen hat.
     */
    const { data: schonKontakt } = await fremder.client
      .from('contacts')
      .select('status')
      .eq('user_id', fremder.id)
      .eq('contact_id', eigner.id)
      .maybeSingle();

    if (schonKontakt?.status !== 'friend') {
      // Kontakt nur über die Nummer (Schema 57) — wie ein Mensch es tut.
      const { data: treffer, error: nFehler } = await fremder.client
        .rpc('finde_per_nummer', { nummer: '+49 151 9990001' });
      if (nFehler) throw nFehler;
      if (treffer?.id !== eigner.id) throw new Error('Nummer des Testkontos führt nicht zum Testkonto');
      const { error: kFehler } = await fremder.client
        .from('contacts')
        .upsert(
          { user_id: fremder.id, contact_id: eigner.id, status: 'friend' },
          { onConflict: 'user_id,contact_id' }
        );
      if (kFehler) throw kFehler;
      wegRaeumen.push(async () => {
        if (schonKontakt) {
          await fremder.client
            .from('contacts')
            .update({ status: schonKontakt.status })
            .eq('user_id', fremder.id)
            .eq('contact_id', eigner.id);
        } else {
          await fremder.client
            .from('contacts')
            .delete()
            .eq('user_id', fremder.id)
            .eq('contact_id', eigner.id);
        }
      });
    }

    const chat4 = await chatAnlegen('messenger');
    const z4 = await zustandVon(eigner, chat4);
    pruefe('Ein Chat mit einem Kontakt ist keine Anfrage',
      z4.anfrage_zustand === 'offen', String(z4.anfrage_zustand));
    pruefe('Und da darf man gleich zweimal schreiben',
      !(await schreiben(eigner, chat4, 'Erste')) && !(await schreiben(eigner, chat4, 'Zweite')));
  } finally {
    for (const schritt of wegRaeumen.reverse()) {
      try {
        await schritt();
      } catch (e) {
        console.log('  HINWEIS  Aufräumen: ' + (e?.message ?? e));
      }
    }
  }

  console.log(
    fehler === 0
      ? '\nDie Chat-Anfrage ist eine Bitte, keine Zusage an sich selbst.'
      : `\n${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
