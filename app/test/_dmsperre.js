/**
 * „Nachrichten senden deaktivieren" — hält die Sperre, was sie verspricht?
 *
 * WARUM ES DAS GIBT
 *
 * Der Sichtbarkeitsbereich `dm` aus dem Handbuch. Seit Schema 19 weist die
 * Datenbank die Nachricht ab — der Chat entstand aber trotzdem: der Knopf
 * „Nachricht" legte die Chatzeile an, trug beide Mitglieder ein, und erst der
 * Text fiel durch die Regel. In der Liste der angeschriebenen Person stand
 * danach ein leerer Eintrag von einem Fremden, dem sie das Schreiben
 * ausdrücklich verboten hatte.
 *
 * Schema 22 setzt die Sperre deshalb eine Ebene tiefer an, beim Eintragen als
 * Mitglied. Geprüft wird mit zwei Konten und ohne Oberfläche: die App
 * schreibt direkt nach Supabase und käme an jeder Prüfung im Servercode
 * vorbei.
 *
 * NACHGEZÄHLT WIRD IMMER
 *
 * Ein abgelehntes INSERT unter RLS meldet nicht in jedem Fall einen Fehler —
 * es schreibt nur nichts. Nach jedem abgewiesenen Versuch wird deshalb
 * nachgesehen, ob wirklich nichts dasteht.
 *
 * Start:  node test/_dmsperre.js
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

// Der EIGNER schreibt an, der EMPFAENGER stellt die Sperre.
const EIGNER = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const EMPFAENGER = {
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
  const empfaenger = await anmelden(EMPFAENGER);

  const wegRaeumen = [];

  /*
   * Die Stufe setzen — und den vorherigen Stand merken.
   *
   * Ohne das Zurücksetzen bliebe das Prüfkonto auf „niemand" stehen, und
   * jeder spätere Lauf, der irgendwo einen Chat anlegt, liefe in diese
   * Sperre. Der Fehler sähe dann nach einem Codefehler aus.
   */
  const { data: vorher } = await empfaenger.client
    .from('visibility_settings')
    .select('stufe')
    .eq('user_id', empfaenger.id)
    .eq('bereich', 'dm')
    .maybeSingle();

  wegRaeumen.push(async () => {
    await empfaenger.client
      .from('visibility_settings')
      .upsert(
        { user_id: empfaenger.id, bereich: 'dm', stufe: vorher?.stufe ?? 'alle' },
        { onConflict: 'user_id,bereich' }
      );
    await empfaenger.client
      .from('visibility_exceptions')
      .delete()
      .eq('user_id', empfaenger.id)
      .eq('bereich', 'dm')
      .eq('target_id', eigner.id);
  });

  const stufeSetzen = async (stufe) => {
    const { error } = await empfaenger.client
      .from('visibility_settings')
      .upsert({ user_id: empfaenger.id, bereich: 'dm', stufe }, { onConflict: 'user_id,bereich' });
    if (error) throw error;
  };

  const darfIch = async () => {
    const { data, error } = await eigner.client.rpc('darf_angeschrieben_werden', {
      inhaber: empfaenger.id,
      wer: eigner.id,
    });
    if (error) throw error;
    return data === true;
  };

  /*
   * Ein frischer Chat für jeden Durchgang, angelegt vom Absender. Nicht der
   * vorhandene zwischen den beiden Konten: der trüge den Anfragezustand
   * früherer Läufe mit sich, und die Prüfung wäre beim zweiten Mal grün,
   * ohne etwas geprüft zu haben.
   *
   * Abgeräumt wird in der Reihenfolge aus `_chatanfrage.js` und mit beiden
   * Konten — aus `chat_members` darf jeder nur die eigene Zeile nehmen.
   */
  const chatAnlegen = async (gruppe = false) => {
    const { data: chat, error } = await eigner.client
      .from('chats')
      .insert({
        name: gruppe ? 'Prüflauf DM-Gruppe' : 'Prüflauf DM-Sperre',
        is_group: gruppe,
        bereich: 'messenger',
        created_by: eigner.id,
      })
      .select('id')
      .single();
    if (error) throw error;

    wegRaeumen.push(async () => {
      await eigner.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', eigner.id);
      await empfaenger.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', empfaenger.id);
      await empfaenger.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', empfaenger.id);
      await eigner.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', eigner.id);
      await eigner.client.from('chats').delete().eq('id', chat.id);

      const { count } = await eigner.client
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('id', chat.id);
      if (count) console.log(`  HINWEIS  Chat ${chat.id} blieb stehen.`);
    });

    await eigner.client.from('chat_members').insert({ chat_id: chat.id, user_id: eigner.id });
    return chat.id;
  };

  const dazuHolen = async (chatId) => {
    const { error } = await eigner.client
      .from('chat_members')
      .insert({ chat_id: chatId, user_id: empfaenger.id });
    return error;
  };

  const mitgliederZaehlen = async (chatId) => {
    const { count } = await eigner.client
      .from('chat_members')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .eq('user_id', empfaenger.id);
    return count;
  };

  const schreiben = async (konto, chatId, text) => {
    const { error } = await konto.client
      .from('messages')
      .insert({ chat_id: chatId, sender_id: konto.id, text });
    return error;
  };

  try {
    console.log('\nOhne Sperre geht alles wie bisher');

    await stufeSetzen('alle');
    pruefe('Die Auskunft sagt Ja', await darfIch());

    const offen = await chatAnlegen();
    pruefe('Die angeschriebene Person lässt sich eintragen', !(await dazuHolen(offen)));
    pruefe('Nachgezählt: sie steht wirklich drin', (await mitgliederZaehlen(offen)) === 1);

    console.log('\n„Niemand" — und zwar schon vor dem Chat');

    await stufeSetzen('niemand');
    pruefe('Die Auskunft sagt Nein', !(await darfIch()));

    const gesperrt = await chatAnlegen();
    const abgewiesen = await dazuHolen(gesperrt);
    pruefe('Sie lässt sich nicht mehr eintragen', Boolean(abgewiesen),
      abgewiesen ? abgewiesen.code : 'ging durch');

    /*
     * Der eigentliche Punkt dieses Prüflaufs. Vor Schema 22 blieb hier ein
     * Chat stehen, in dem nur der Absender saß — sichtbar in seiner Liste,
     * bereit für den nächsten Versuch.
     */
    pruefe('Nachgezählt: kein Mitgliedseintrag entstanden',
      (await mitgliederZaehlen(gesperrt)) === 0);

    console.log('\nEin Chat, der schon stand, nimmt nichts mehr an');

    /*
     * Der Fall, den die Mitgliedersperre allein nicht abdeckt: die
     * Einstellung kann nachträglich gesetzt werden. Dann bleibt der Chat in
     * beiden Listen stehen — schreiben lässt sich dort trotzdem nicht mehr
     * (`darf_schreiben()` aus Schema 19).
     */
    const nachtraeglich = await schreiben(eigner, offen, 'Hallo?');
    pruefe('Die Nachricht wird abgewiesen', Boolean(nachtraeglich),
      nachtraeglich ? nachtraeglich.code : 'ging durch');

    const { count: nachrichten } = await eigner.client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', offen)
      .eq('sender_id', eigner.id);
    pruefe('Nachgezählt: keine Nachricht steht da', nachrichten === 0,
      `${nachrichten} Nachrichten`);

    console.log('\nGruppen bleiben ausgenommen');

    /*
     * Wer einer Gruppe beitritt, hat dem Mitlesen zugestimmt. Sonst könnte
     * ein einzelnes Mitglied verhindern, dass überhaupt jemand dazukommt —
     * dasselbe Argument wie in `darf_schreiben()`.
     */
    const gruppe = await chatAnlegen(true);
    pruefe('In eine Gruppe darf sie trotz „Niemand"', !(await dazuHolen(gruppe)));
    pruefe('Nachgezählt: sie steht drin', (await mitgliederZaehlen(gruppe)) === 1);

    console.log('\n„Niemand bis auf" lässt genau diesen einen durch');

    await stufeSetzen('niemand_bis_auf');
    pruefe('Ohne Eintrag in der Liste: Nein', !(await darfIch()));

    const { error: ausnahme } = await empfaenger.client
      .from('visibility_exceptions')
      .upsert(
        { user_id: empfaenger.id, bereich: 'dm', target_id: eigner.id },
        { onConflict: 'user_id,bereich,target_id' }
      );
    if (ausnahme) throw ausnahme;

    pruefe('Mit Eintrag: Ja', await darfIch());

    const erlaubt = await chatAnlegen();
    pruefe('Und der Chat kommt zustande', !(await dazuHolen(erlaubt)));
    pruefe('Auch die Nachricht geht durch', !(await schreiben(eigner, erlaubt, 'Hallo!')));

    console.log('\nDie eigene Zeile bleibt unberührt');

    /*
     * `sichtbar_fuer()` gibt für `eigner = betrachter` immer true zurück.
     * Ohne das könnte sich niemand mehr selbst in einen Chat eintragen, den
     * er gerade anlegt — die Sperre nähme dem Menschen den Messenger weg,
     * den sie schützen soll.
     */
    await stufeSetzen('niemand');
    const { data: selbst, error: selbstFehler } = await empfaenger.client.rpc(
      'darf_angeschrieben_werden',
      { inhaber: empfaenger.id, wer: empfaenger.id }
    );
    pruefe('Man darf sich selbst schreiben', !selbstFehler && selbst === true);

    const { data: eigenerChat, error: eigenerFehler } = await empfaenger.client
      .from('chats')
      .insert({ name: 'Prüflauf DM eigen', is_group: false, bereich: 'messenger', created_by: empfaenger.id })
      .select('id')
      .single();
    if (eigenerFehler) throw eigenerFehler;
    wegRaeumen.push(async () => {
      await empfaenger.client.from('chat_members').delete().eq('chat_id', eigenerChat.id).eq('user_id', empfaenger.id);
      await empfaenger.client.from('chats').delete().eq('id', eigenerChat.id);
    });

    const { error: selbstEintrag } = await empfaenger.client
      .from('chat_members')
      .insert({ chat_id: eigenerChat.id, user_id: empfaenger.id });
    pruefe('Und sich selbst in einen Chat eintragen', !selbstEintrag,
      selbstEintrag ? selbstEintrag.message : '');
  } finally {
    for (const schritt of wegRaeumen.reverse()) {
      try {
        await schritt();
      } catch (e) {
        console.log('  HINWEIS  Aufräumen: ' + (e?.message ?? e));
      }
    }

    // Gegenprobe zum Aufräumen selbst: steht die Stufe wirklich wieder da,
    // wo sie war? Bliebe sie auf „niemand", liefen alle folgenden Prüfläufe
    // in eine Sperre, die niemand mehr mit diesem Lauf in Verbindung bringt.
    const { data: danach } = await empfaenger.client
      .from('visibility_settings')
      .select('stufe')
      .eq('user_id', empfaenger.id)
      .eq('bereich', 'dm')
      .maybeSingle();
    if ((danach?.stufe ?? 'alle') !== (vorher?.stufe ?? 'alle')) {
      console.log(`  HINWEIS  Stufe steht auf „${danach?.stufe}" statt „${vorher?.stufe ?? 'alle'}".`);
      fehler++;
    }
  }

  console.log(
    fehler === 0
      ? '\nWer keine Nachrichten will, bekommt auch keinen leeren Chat.'
      : `\n${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
