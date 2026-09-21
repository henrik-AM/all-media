/**
 * Lesebestätigung — wirkt der Schalter, oder steht er nur da?
 *
 * WARUM ES DAS GIBT
 *
 * „Lesebestätigung" stand am 17.09.2026 in beiden Einstellungslisten, wurde
 * gespeichert — und war dreifach wirkungslos:
 *
 *   1. `read_at` wurde nie gesetzt: `nachrichtGelesen()` in der App hatte
 *      keinen Aufrufer, `handleMarkMessageAsRead` auf der Website keine Route.
 *   2. Beide hätten ohnehin nichts bewirkt: die Regel „Eigene Nachricht
 *      aendern" (Schema 23) lässt nur den ABSENDER an `read_at`. Gelesen wird
 *      aber vom EMPFÄNGER — das UPDATE hätte null Zeilen getroffen und brav
 *      Erfolg gemeldet, dieselbe stille Falle wie beim verbotenen DELETE.
 *   3. App und Website zeigten trotzdem immer den doppelten Haken.
 *
 * Seit Schema 40 entscheidet `chat_gelesen()` in der Datenbank. Dieser Lauf
 * prüft sie an der Wurzel — ohne Oberfläche, mit zwei Konten, denn ein
 * Schalter, der das Verhalten gegenüber ANDEREN steuert, ist mit einem Konto
 * gar nicht prüfbar.
 *
 * NACHGEZÄHLT WIRD IMMER
 *
 * Der Rückgabewert der Funktion allein beweist nichts — er wird jedes Mal
 * gegen `messages.read_at` gegengelesen.
 *
 * Start: node test/_lesebestaetigung.js
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

// Der ABSENDER schreibt, der LESER öffnet den Chat und stellt den Schalter.
const ABSENDER = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const LESER = {
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

  const absender = await anmelden(ABSENDER);
  const leser = await anmelden(LESER);

  const wegRaeumen = [];

  /*
   * Der Schalter des Lesers — mit gemerktem Ausgangswert. Bliebe er auf
   * „aus" stehen, sähe jeder spätere Lauf eine Lesebestätigung, die nie
   * kommt, und niemand brächte das mit diesem Lauf in Verbindung.
   */
  const { data: vorher } = await leser.client
    .from('user_settings')
    .select('wert')
    .eq('user_id', leser.id)
    .eq('schluessel', 'lesebestaetigung')
    .maybeSingle();

  wegRaeumen.push(async () => {
    if (vorher) {
      await leser.client
        .from('user_settings')
        .upsert(
          { user_id: leser.id, schluessel: 'lesebestaetigung', wert: vorher.wert },
          { onConflict: 'user_id,schluessel' }
        );
    } else {
      // Keine Zeile war der Ausgangszustand: dann gilt der Auslieferungswert.
      await leser.client
        .from('user_settings')
        .delete()
        .eq('user_id', leser.id)
        .eq('schluessel', 'lesebestaetigung');
    }
  });

  const schalter = async (w) => {
    const { error } = await leser.client
      .from('user_settings')
      .upsert(
        { user_id: leser.id, schluessel: 'lesebestaetigung', wert: w },
        { onConflict: 'user_id,schluessel' }
      );
    if (error) throw error;
  };

  /*
   * Für jeden Durchgang ein frischer Chat mit einer frischen Nachricht. Ein
   * zweites Mal im selben Chat wäre wertlos: `read_at` wird nie
   * überschrieben, die zweite Prüfung wäre grün, ohne etwas zu prüfen.
   */
  const chatMitNachricht = async (name) => {
    const { data: chat, error } = await absender.client
      .from('chats')
      .insert({ name, is_group: false, bereich: 'messenger', created_by: absender.id })
      .select('id')
      .single();
    if (error) throw error;

    wegRaeumen.push(async () => {
      await absender.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', absender.id);
      await leser.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', leser.id);
      await absender.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', absender.id);
      await absender.client.from('chats').delete().eq('id', chat.id);
    });

    await absender.client.from('chat_members').insert({ chat_id: chat.id, user_id: absender.id });
    const { error: mitglied } = await absender.client
      .from('chat_members')
      .insert({ chat_id: chat.id, user_id: leser.id });
    if (mitglied) throw mitglied;

    const { data: nachricht, error: schreibfehler } = await absender.client
      .from('messages')
      .insert({ chat_id: chat.id, sender_id: absender.id, text: 'Gelesen?' })
      .select('id, read_at')
      .single();
    if (schreibfehler) throw schreibfehler;

    return { chatId: chat.id, nachrichtId: nachricht.id };
  };

  // Gegengelesen wird beim ABSENDER: er sieht seine eigene Nachricht, und nur
  // ihn geht der Haken etwas an.
  const gelesenAm = async (nachrichtId) => {
    const { data, error } = await absender.client
      .from('messages')
      .select('read_at')
      .eq('id', nachrichtId)
      .single();
    if (error) throw error;
    return data.read_at;
  };

  try {
    console.log('\nSchalter an — die Bestätigung kommt');

    await schalter('an');
    const a = await chatMitNachricht('Prüflauf Lesebestätigung an');
    pruefe('Vorher steht kein Zeitpunkt', (await gelesenAm(a.nachrichtId)) === null);

    const { data: anzahlAn, error: fehlerAn } = await leser.client.rpc('chat_gelesen', {
      p_chat: a.chatId,
    });
    pruefe('Der Aufruf geht durch', !fehlerAn, fehlerAn ? fehlerAn.message : '');
    pruefe('Er meldet genau eine Bestätigung', anzahlAn === 1, `gemeldet: ${anzahlAn}`);
    pruefe('Nachgezählt: der Zeitpunkt steht wirklich da', (await gelesenAm(a.nachrichtId)) !== null);

    console.log('\nSchalter aus — es passiert nichts');

    await schalter('aus');
    const b = await chatMitNachricht('Prüflauf Lesebestätigung aus');

    const { data: anzahlAus, error: fehlerAus } = await leser.client.rpc('chat_gelesen', {
      p_chat: b.chatId,
    });
    pruefe('Der Aufruf scheitert nicht', !fehlerAus, fehlerAus ? fehlerAus.message : '');
    pruefe('Er meldet null Bestätigungen', anzahlAus === 0, `gemeldet: ${anzahlAus}`);
    pruefe('Nachgezählt: es steht kein Zeitpunkt da', (await gelesenAm(b.nachrichtId)) === null);

    console.log('\nWer nicht im Chat ist, bestätigt auch nichts');

    /*
     * Der eigentliche Grund für `security definer` ist die Gefahr, die damit
     * einhergeht: die Funktion umgeht die Zeilenregeln. Prüft sie die
     * Mitgliedschaft nicht selbst, könnte jeder Angemeldete fremde Chats
     * durchmarkieren — und damit erfahren, welche Chat-Kennungen es gibt.
     */
    await schalter('an');
    const { data: fremd, error: fehlerFremd } = await absender.client
      .from('chats')
      .insert({ name: 'Prüflauf fremder Chat', is_group: false, bereich: 'messenger', created_by: absender.id })
      .select('id')
      .single();
    if (fehlerFremd) throw fehlerFremd;
    wegRaeumen.push(async () => {
      await absender.client.from('messages').delete().eq('chat_id', fremd.id).eq('sender_id', absender.id);
      await absender.client.from('chat_members').delete().eq('chat_id', fremd.id).eq('user_id', absender.id);
      await absender.client.from('chats').delete().eq('id', fremd.id);
    });
    await absender.client.from('chat_members').insert({ chat_id: fremd.id, user_id: absender.id });
    const { data: fremdeNachricht } = await absender.client
      .from('messages')
      .insert({ chat_id: fremd.id, sender_id: absender.id, text: 'Nicht für dich.' })
      .select('id')
      .single();

    const { data: anzahlFremd } = await leser.client.rpc('chat_gelesen', { p_chat: fremd.id });
    pruefe('Der Aufruf meldet null — und verrät nichts', anzahlFremd === 0, `gemeldet: ${anzahlFremd}`);
    pruefe('Nachgezählt: die fremde Nachricht bleibt ungelesen',
      (await gelesenAm(fremdeNachricht.id)) === null);

    console.log('\nDie eigene Nachricht bestätigt man sich nicht selbst');

    const c = await chatMitNachricht('Prüflauf eigene Nachricht');
    const { data: eigene } = await leser.client
      .from('messages')
      .insert({ chat_id: c.chatId, sender_id: leser.id, text: 'Von mir.' })
      .select('id')
      .single();

    const { data: anzahlC } = await leser.client.rpc('chat_gelesen', { p_chat: c.chatId });
    pruefe('Nur die fremde Nachricht zählt', anzahlC === 1, `gemeldet: ${anzahlC}`);

    const { data: eigeneDanach } = await leser.client
      .from('messages')
      .select('read_at')
      .eq('id', eigene.id)
      .single();
    pruefe('Die eigene bleibt ohne Zeitpunkt', eigeneDanach.read_at === null);

    console.log('\nEin gesetzter Zeitpunkt wird nicht überschrieben');

    const zuerst = await gelesenAm(c.nachrichtId);
    const { data: nochmal } = await leser.client.rpc('chat_gelesen', { p_chat: c.chatId });
    pruefe('Der zweite Aufruf meldet null', nochmal === 0, `gemeldet: ${nochmal}`);
    pruefe('Der erste Zeitpunkt steht unverändert da', (await gelesenAm(c.nachrichtId)) === zuerst);
  } finally {
    for (const schritt of wegRaeumen.reverse()) {
      try {
        await schritt();
      } catch (e) {
        console.log('  HINWEIS  Aufräumen: ' + (e?.message ?? e));
      }
    }

    // Gegenprobe zum Aufräumen selbst.
    const { data: danach } = await leser.client
      .from('user_settings')
      .select('wert')
      .eq('user_id', leser.id)
      .eq('schluessel', 'lesebestaetigung')
      .maybeSingle();
    if ((danach?.wert ?? null) !== (vorher?.wert ?? null)) {
      console.log(`  HINWEIS  Schalter steht auf „${danach?.wert ?? '(keine Zeile)'}" statt „${vorher?.wert ?? '(keine Zeile)'}".`);
      fehler++;
    }
  }

  console.log(
    fehler === 0
      ? '\nDer Haken heißt jetzt, was er zeigt.'
      : `\n${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
