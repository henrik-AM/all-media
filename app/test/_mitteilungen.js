/**
 * Kommen Mitteilungen wirklich an? — Schema 44 und 49
 *
 * WARUM ES DAS GIBT
 *
 * Bis zum 18.09.2026 wurde `notifications` an sieben Stellen gelesen und an
 * null Stellen geschrieben; die Glocke zeigte ausschließlich Testbestand.
 * Schema 44 hat sechs Auslöser gebaut, Schema 49 drei weitere. Ob ein
 * Auslöser existiert, sagt `_schema.js`. Ob er feuert — und beim Richtigen
 * ankommt — sagt nur dieser Lauf hier.
 *
 * Geprüft wird mit zwei Konten und ohne Oberfläche, aus demselben Grund wie
 * bei der Chat-Anfrage: die Regeln stehen in der Datenbank, App und Website
 * schreiben beide direkt dorthin.
 *
 * Die Gegenprobe ist bei jeder einzelnen Prüfung dieselbe Frage: Wäre sie
 * auch grün, wenn gar nichts passiert wäre? Deshalb wird nie „es gibt eine
 * Mitteilung" gezählt, sondern immer der Zuwachs seit einem Zeitstempel, der
 * vor der Handlung genommen wurde.
 *
 * Start:  node test/_mitteilungen.js
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
   * Jeder liest nur seinen eigenen Posteingang — so will es die Regel
   * „Eigene Benachrichtigungen lesen". Deshalb bekommt jede Prüfung das
   * Konto mit, bei dem die Mitteilung ankommen SOLL, und fragt mit dessen
   * Zugang nach. Käme sie beim Falschen an, sähe niemand sie.
   */
  const neueSeit = async (konto, zeit, art) => {
    const { data, error } = await konto.client
      .from('notifications')
      .select('art, actor_id, target_type, target_id, created_at')
      .eq('art', art)
      .gt('created_at', zeit)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  };

  /* Die Datenbank setzt `created_at` mit ihrer Uhr, nicht mit meiner. Eine
   * Sekunde Abstand nach hinten nimmt der Prüfung die Abhängigkeit davon,
   * dass beide Uhren auf die Millisekunde gleich gehen. */
  const jetzt = () => new Date(Date.now() - 1000).toISOString();

  /* Auslöser laufen in derselben Transaktion wie das INSERT — die Mitteilung
   * steht also da, sobald das INSERT zurück ist. Ein Warten ist nicht nötig
   * und würde nur verdecken, wenn doch etwas asynchron wäre. */

  try {
    // -----------------------------------------------------------------------
    console.log('\nMarkierung in einem Beitrag');

    const { data: beitrag, error: bFehler } = await eigner.client
      .from('posts')
      .insert({ user_id: eigner.id, kind: 'post', description: 'Prüflauf Markierung' })
      .select('id')
      .single();
    if (bFehler) throw bFehler;
    wegRaeumen.push(async () => {
      await eigner.client.from('post_tags').delete().eq('post_id', beitrag.id);
      await eigner.client.from('posts').delete().eq('id', beitrag.id);
    });

    const vorMarkierung = jetzt();
    const { error: mFehler } = await eigner.client
      .from('post_tags')
      .insert({ post_id: beitrag.id, user_id: fremder.id });
    pruefe('Der Verfasser darf jemanden markieren', !mFehler, mFehler ? mFehler.message : '');

    const markierungen = await neueSeit(fremder, vorMarkierung, 'mention');
    const meine = markierungen.filter((m) => m.target_id === beitrag.id);
    pruefe('Der Markierte bekommt genau eine Mitteilung', meine.length === 1,
      `${meine.length} Stück`);
    pruefe('Sie kommt vom Markierenden', meine[0]?.actor_id === eigner.id);
    pruefe('Und sie zeigt auf den Beitrag, nicht auf den Markierenden',
      meine[0]?.target_type === 'post');

    const eigeneMarkierung = await neueSeit(eigner, vorMarkierung, 'mention');
    pruefe('Der Markierende selbst bekommt keine',
      !eigeneMarkierung.some((m) => m.target_id === beitrag.id));

    // -----------------------------------------------------------------------
    console.log('\nHerz an einem Kommentar');

    const { data: kommentar, error: kFehler } = await eigner.client
      .from('comments')
      .insert({ post_id: beitrag.id, user_id: eigner.id, text: 'Prüflauf Kommentar' })
      .select('id')
      .single();
    if (kFehler) throw kFehler;
    wegRaeumen.push(async () => {
      await fremder.client.from('comment_likes').delete().eq('comment_id', kommentar.id);
      await eigner.client.from('comment_likes').delete().eq('comment_id', kommentar.id);
      await eigner.client.from('comments').delete().eq('id', kommentar.id);
    });

    const vorHerz = jetzt();
    const { error: hFehler } = await fremder.client
      .from('comment_likes')
      .insert({ comment_id: kommentar.id, user_id: fremder.id });
    pruefe('Ein fremdes Herz an meinem Kommentar geht durch', !hFehler,
      hFehler ? hFehler.message : '');

    const herzen = (await neueSeit(eigner, vorHerz, 'like'))
      .filter((m) => m.target_id === kommentar.id);
    pruefe('Der Verfasser des Kommentars bekommt eine Mitteilung', herzen.length === 1,
      `${herzen.length} Stück`);
    /*
     * Das ist die eigentliche Aussage dieser Prüfung. Die Art ist dieselbe
     * wie beim Beitrag ('like'); nur am Ziel unterscheiden App und Website
     * „gefällt dein Kommentar" von „gefällt dein Beitrag". Stünde hier
     * 'post', wäre die Mitteilung da und der Satz falsch.
     */
    pruefe('Das Ziel ist der Kommentar, nicht der Beitrag',
      herzen[0]?.target_type === 'comment', String(herzen[0]?.target_type));

    const vorEigenem = jetzt();
    await eigner.client
      .from('comment_likes')
      .insert({ comment_id: kommentar.id, user_id: eigner.id });
    /*
     * Hier zusätzlich nach dem Absender gefiltert, und das ist kein Beiwerk:
     * `jetzt()` greift eine Sekunde nach hinten, damit die Prüfung nicht an
     * zwei verschieden gehenden Uhren hängt. Das fremde Herz von eben liegt
     * innerhalb dieser Sekunde — ohne den Absender fand die Prüfung am
     * 21.09.2026 dessen Mitteilung und meldete einen Fehler, den es nicht
     * gab.
     */
    const eigenes = (await neueSeit(eigner, vorEigenem, 'like'))
      .filter((m) => m.target_id === kommentar.id && m.actor_id === eigner.id);
    pruefe('Das eigene Herz am eigenen Kommentar meldet sich nicht',
      eigenes.length === 0, `${eigenes.length} Stück`);

    // -----------------------------------------------------------------------
    console.log('\nChat-Anfrage und ihre Annahme');

    const vorAnfrage = jetzt();
    const { data: chat, error: cFehler } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Mitteilung', is_group: false, bereich: 'community' /* Fremde: Schema 57 */, created_by: eigner.id })
      .select('id')
      .single();
    if (cFehler) throw cFehler;
    wegRaeumen.push(async () => {
      await fremder.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', fremder.id);
      await eigner.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', eigner.id);
      await eigner.client.from('chats').delete().eq('id', chat.id);
      const { count } = await eigner.client
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('id', chat.id);
      if (count) console.log(`  HINWEIS  Chat ${chat.id} blieb stehen.`);
    });

    await eigner.client.from('chat_members').insert({ chat_id: chat.id, user_id: eigner.id });
    await eigner.client.from('chat_members').insert({ chat_id: chat.id, user_id: fremder.id });

    const anfragen = (await neueSeit(fremder, vorAnfrage, 'anfrage'))
      .filter((m) => m.target_id === chat.id);
    pruefe('Der Angeschriebene erfährt von der Anfrage', anfragen.length === 1,
      `${anfragen.length} Stück`);
    pruefe('Sie kommt vom Anfragenden', anfragen[0]?.actor_id === eigner.id);

    const beimAnfragenden = (await neueSeit(eigner, vorAnfrage, 'anfrage'))
      .filter((m) => m.target_id === chat.id);
    pruefe('Der Anfragende bekommt keine Mitteilung über seine eigene Anfrage',
      beimAnfragenden.length === 0, `${beimAnfragenden.length} Stück`);

    const vorAnnahme = jetzt();
    const { error: aFehler } = await fremder.client
      .from('chats')
      .update({ anfrage_zustand: 'angenommen' })
      .eq('id', chat.id);
    pruefe('Der Angeschriebene kann annehmen', !aFehler, aFehler ? aFehler.message : '');

    const annahmen = (await neueSeit(eigner, vorAnnahme, 'anfrage_ok'))
      .filter((m) => m.target_id === chat.id);
    pruefe('Der Anfragende erfährt von der Annahme', annahmen.length === 1,
      `${annahmen.length} Stück`);
    pruefe('Sie kommt von dem, der angenommen hat', annahmen[0]?.actor_id === fremder.id);

    /*
     * Eine Ablehnung soll niemandem gemeldet werden. Geprüft wird das an
     * einem zweiten Chat — der erste ist schon angenommen, und der Zustand
     * ist eine Einbahnstraße.
     */
    const { data: chat2 } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Ablehnung', is_group: false, bereich: 'community' /* Fremde: Schema 57 */, created_by: eigner.id })
      .select('id')
      .single();
    wegRaeumen.push(async () => {
      await fremder.client.from('chat_members').delete().eq('chat_id', chat2.id).eq('user_id', fremder.id);
      await eigner.client.from('chat_members').delete().eq('chat_id', chat2.id).eq('user_id', eigner.id);
      await eigner.client.from('chats').delete().eq('id', chat2.id);
    });
    await eigner.client.from('chat_members').insert({ chat_id: chat2.id, user_id: eigner.id });
    await eigner.client.from('chat_members').insert({ chat_id: chat2.id, user_id: fremder.id });

    const vorAblehnung = jetzt();
    await fremder.client
      .from('chats')
      .update({ anfrage_zustand: 'abgelehnt' })
      .eq('id', chat2.id);

    const nachAblehnung = [
      ...(await neueSeit(eigner, vorAblehnung, 'anfrage')),
      ...(await neueSeit(eigner, vorAblehnung, 'anfrage_ok')),
    ].filter((m) => m.target_id === chat2.id);
    pruefe('Eine Ablehnung meldet sich bei niemandem', nachAblehnung.length === 0,
      `${nachAblehnung.length} Stück`);

    // -----------------------------------------------------------------------
    console.log('\nDer Satz dazu steht in beiden Oberflächen');

    const WURZEL = path.join(__dirname, '..', '..');
    const web = fs.readFileSync(path.join(WURZEL, 'web/server/app.js'), 'utf8');
    const appQuelle = fs.readFileSync(
      path.join(WURZEL, 'app/contexts/ProfilContext.tsx'), 'utf8');

    for (const satz of [
      'hat dich in einem Beitrag markiert',
      'möchte mit dir schreiben',
      'hat deine Anfrage angenommen',
    ]) {
      pruefe(`„${satz}" kennt die Website`, web.includes(satz));
      pruefe(`„${satz}" kennt die App`, appQuelle.includes(satz));
    }
    pruefe('Beide kennen den Gegenstand „Kommentar" für ein Herz',
      /comment: 'Kommentar'/.test(web) && /comment: 'Kommentar'/.test(appQuelle));

  } finally {
    for (const raeumen of wegRaeumen.reverse()) {
      try { await raeumen(); } catch (e) { console.log('  HINWEIS  Abräumen: ' + e.message); }
    }
    /*
     * Die Mitteilungen selbst bleiben stehen: sie hängen per cascade an
     * Beitrag, Kommentar und Chat und gehen mit ihnen. Der Chat wird nicht
     * per cascade gelöscht — dessen Mitteilungen zeigen danach ins Leere,
     * deshalb hier weg.
     */
  }

  console.log(`\n${fehler === 0 ? 'ALLES GRUEN' : fehler + ' FEHLER'}`);
  process.exit(fehler === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ABBRUCH  ' + e.message);
  process.exit(1);
});
