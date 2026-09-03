/**
 * Wirkt die Sichtbarkeit — oder ist sie nur gespeichert?
 *
 * WARUM ES DAS GIBT
 *
 * Seit dem 01.09.2026 gibt es zehn Sichtbarkeitsbereiche in vier Stufen mit
 * Ausnahmelisten. Sie ließen sich einstellen, wurden gespeichert und in
 * beiden Oberflächen richtig angezeigt. Nur passierte nichts: die Funktion
 * `sichtbar_fuer()`, die sie auswertet, wurde an keiner einzigen Stelle
 * aufgerufen. „Story-Sichtbarkeit → Niemand" hieß, dass jeder die Story sah.
 *
 * Gemerkt hat das niemand, weil kein Prüflauf je aus einer *zweiten*
 * Perspektive nachgesehen hat. Genau das macht dieser hier: er meldet zwei
 * Konten an — das Testkonto stellt etwas ein, das Prüfkonto sieht nach.
 *
 * Kein Browser, keine Website. Geprüft werden die Regeln der Datenbank
 * selbst, denn dort müssen sie stehen: die App schreibt direkt nach Supabase
 * und käme an jeder Prüfung im Servercode vorbei.
 *
 * Start:  node test/_sichtbarkeit.js
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

  /** Eine Stufe setzen und warten, bis sie steht. */
  const stufe = async (bereich, wert) => {
    const { error } = await eigner.client
      .from('visibility_settings')
      .upsert({ user_id: eigner.id, bereich, stufe: wert }, { onConflict: 'user_id,bereich' });
    if (error) throw error;
  };

  const ausnahme = async (bereich, zielId, setzen) => {
    if (setzen) {
      const { error } = await eigner.client
        .from('visibility_exceptions')
        .upsert({ user_id: eigner.id, bereich, target_id: zielId });
      if (error) throw error;
    } else {
      await eigner.client
        .from('visibility_exceptions')
        .delete()
        .eq('user_id', eigner.id)
        .eq('bereich', bereich)
        .eq('target_id', zielId);
    }
  };

  /*
   * Alles, was dieser Lauf setzt, wird am Ende wieder abgeraeumt. Ein
   * Umschalter, den niemand zurueckdreht, kippt den naechsten Lauf — und
   * hier wuerde er sogar das Testkonto unbrauchbar machen, weil dann
   * niemand mehr seine Storys saehe.
   */
  const aufraeumen = async () => {
    await eigner.client
      .from('visibility_settings')
      .delete()
      .eq('user_id', eigner.id)
      .in('bereich', ['story', 'standort', 'dm', 'kommentare']);
    await eigner.client
      .from('visibility_exceptions')
      .delete()
      .eq('user_id', eigner.id)
      .in('bereich', ['story', 'standort', 'dm', 'kommentare']);
  };

  /*
   * Der Lauf legt sich seinen Bestand selbst an.
   *
   * Der erste Entwurf las die vorhandenen Storys des Testkontos — und die
   * waren abgelaufen, weil eine Story nach 24 Stunden weg ist. Der Lauf
   * meldete deshalb „keine Story im Bestand" und prüfte nichts. Ein Test,
   * der sich an fremde Daten hängt, prüft irgendwann gar nichts mehr.
   */
  const eigenes = { storyId: null, chatId: null };

  const bestandAnlegen = async () => {
    const { data: story, error: f1 } = await eigner.client
      .from('stories')
      .insert({ user_id: eigner.id, caption: 'Prüflauf Sichtbarkeit' })
      .select('id')
      .maybeSingle();
    if (f1) throw f1;
    eigenes.storyId = story.id;

    // Ein Zweierchat zwischen beiden Konten.
    const { data: chat, error: f2 } = await eigner.client
      .from('chats')
      .insert({ is_group: false, created_by: eigner.id })
      .select('id')
      .maybeSingle();
    if (f2) throw f2;
    eigenes.chatId = chat.id;

    const { error: f3 } = await eigner.client
      .from('chat_members')
      .insert([
        { chat_id: chat.id, user_id: eigner.id },
        { chat_id: chat.id, user_id: fremder.id },
      ]);
    if (f3) throw f3;
  };

  const bestandAbraeumen = async () => {
    if (eigenes.storyId) await eigner.client.from('stories').delete().eq('id', eigenes.storyId);
    // Der Chat nimmt Mitglieder und Nachrichten ueber `on delete cascade` mit.
    if (eigenes.chatId) await eigner.client.from('chats').delete().eq('id', eigenes.chatId);
  };

  try {
    await bestandAnlegen();

    console.log('\nStory-Sichtbarkeit');

    await stufe('story', 'alle');
    const { data: offen } = await fremder.client
      .from('stories')
      .select('id')
      .eq('user_id', eigner.id);
    const hatStorys = (offen || []).length > 0;
    pruefe('Bei „Alle" sieht das andere Konto die Storys', hatStorys,
      `${(offen || []).length} Stück`);

    await stufe('story', 'niemand');
    const { data: zu } = await fremder.client
      .from('stories')
      .select('id')
      .eq('user_id', eigner.id);
    pruefe('Bei „Niemand" sieht es keine mehr', (zu || []).length === 0,
      `${(zu || []).length} sichtbar`);

    // Der Eigner sieht seine eigene Story weiterhin. Sonst hielte er die
    // Einstellung fuer einen Fehler.
    const { data: selbst } = await eigner.client
      .from('stories')
      .select('id')
      .eq('user_id', eigner.id);
    pruefe('Der Eigner sieht seine eigene Story trotzdem', (selbst || []).length > 0,
      `${(selbst || []).length} sichtbar`);

    await stufe('story', 'niemand_bis_auf');
    await ausnahme('story', fremder.id, true);
    const { data: ausnahmeSicht } = await fremder.client
      .from('stories')
      .select('id')
      .eq('user_id', eigner.id);
    pruefe('„Niemand bis auf …" laesst die eingetragene Person durch',
      (ausnahmeSicht || []).length > 0,
      `${(ausnahmeSicht || []).length} sichtbar`);

    await stufe('story', 'alle_bis_auf');
    const { data: ausgesperrt } = await fremder.client
      .from('stories')
      .select('id')
      .eq('user_id', eigner.id);
    pruefe('„Alle bis auf …" sperrt sie wieder aus', (ausgesperrt || []).length === 0,
      `${(ausgesperrt || []).length} sichtbar`);

    await ausnahme('story', fremder.id, false);

    console.log('\nStandort auf der Karte');

    await stufe('standort', 'alle');
    const { data: pinAn } = await fremder.client
      .from('friend_pins')
      .select('user_id')
      .eq('user_id', eigner.id);
    const hatPin = (pinAn || []).length > 0;

    await stufe('standort', 'niemand');
    const { data: pinAus } = await fremder.client
      .from('friend_pins')
      .select('user_id')
      .eq('user_id', eigner.id);
    pruefe('Bei „Niemand" ist die eigene Nadel fuer andere weg',
      (pinAus || []).length === 0,
      hatPin ? `${(pinAus || []).length} sichtbar` : 'kein Pin im Bestand');

    const { data: pinSelbst } = await eigner.client
      .from('friend_pins')
      .select('user_id')
      .eq('user_id', eigner.id);
    pruefe('Man selbst sieht seine Nadel weiterhin',
      !hatPin || (pinSelbst || []).length > 0,
      hatPin ? '' : 'kein Pin im Bestand');

    console.log('\nWer darf kommentieren');

    const { data: beitrag } = await eigner.client
      .from('posts')
      .select('id')
      .eq('user_id', eigner.id)
      .limit(1)
      .maybeSingle();

    if (!beitrag) {
      pruefe('Ein eigener Beitrag zum Pruefen', false, 'das Testkonto hat keinen');
    } else {
      await stufe('kommentare', 'alle');
      const { data: k1, error: f1 } = await fremder.client
        .from('comments')
        .insert({ post_id: beitrag.id, user_id: fremder.id, text: 'Prüflauf' })
        .select('id')
        .maybeSingle();
      pruefe('Bei „Alle" kommt ein fremder Kommentar durch', !f1 && Boolean(k1),
        f1 ? f1.message : '');
      if (k1) await fremder.client.from('comments').delete().eq('id', k1.id);

      await stufe('kommentare', 'niemand');
      const { error: f2 } = await fremder.client
        .from('comments')
        .insert({ post_id: beitrag.id, user_id: fremder.id, text: 'Prüflauf 2' })
        .select('id')
        .maybeSingle();
      pruefe('Bei „Niemand" wird er abgelehnt', Boolean(f2),
        f2 ? f2.code : 'ging trotzdem durch');

      // Der Eigner selbst darf immer.
      const { data: k3, error: f3 } = await eigner.client
        .from('comments')
        .insert({ post_id: beitrag.id, user_id: eigner.id, text: 'Prüflauf eigen' })
        .select('id')
        .maybeSingle();
      pruefe('Unter dem eigenen Beitrag darf man selbst kommentieren', !f3 && Boolean(k3),
        f3 ? f3.message : '');
      if (k3) await eigner.client.from('comments').delete().eq('id', k3.id);
    }

    console.log('\nWer darf mir schreiben');

    const zweier = eigenes.chatId;

    if (!zweier) {
      console.log('  --   Kein gemeinsamer Zweierchat — dieser Teil sagt nichts aus.');
    } else {
      await stufe('dm', 'alle');
      const { data: m1, error: e1 } = await fremder.client
        .from('messages')
        .insert({ chat_id: zweier, sender_id: fremder.id, text: 'Prüflauf' })
        .select('id')
        .maybeSingle();
      pruefe('Bei „Alle" kommt die Nachricht an', !e1 && Boolean(m1), e1 ? e1.message : '');
      if (m1) await fremder.client.from('messages').delete().eq('id', m1.id);

      await stufe('dm', 'niemand');
      const { error: e2 } = await fremder.client
        .from('messages')
        .insert({ chat_id: zweier, sender_id: fremder.id, text: 'Prüflauf 2' })
        .select('id')
        .maybeSingle();
      pruefe('Bei „Niemand" wird sie abgelehnt', Boolean(e2),
        e2 ? e2.code : 'ging trotzdem durch');

      const { data: m3, error: e3 } = await eigner.client
        .from('messages')
        .insert({ chat_id: zweier, sender_id: eigner.id, text: 'Prüflauf eigen' })
        .select('id')
        .maybeSingle();
      pruefe('Selbst schreiben geht weiterhin', !e3 && Boolean(m3), e3 ? e3.message : '');
      if (m3) await eigner.client.from('messages').delete().eq('id', m3.id);
    }
  } finally {
    await aufraeumen();
    await bestandAbraeumen();
  }

  console.log(
    fehler === 0
      ? '\nDie Sichtbarkeit wirkt wirklich.'
      : `\n${fehler} Sichtbarkeitsregel(n) greifen nicht.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
