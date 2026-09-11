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
  const stufeFuer = async (konto, bereich, wert) => {
    const { error } = await konto.client
      .from('visibility_settings')
      .upsert({ user_id: konto.id, bereich, stufe: wert }, { onConflict: 'user_id,bereich' });
    if (error) throw error;
  };

  const stufe = (bereich, wert) => stufeFuer(eigner, bereich, wert);

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
  const BEREICHE = [
    'story', 'standort', 'dm', 'kommentare',
    'repost', 'likes', 'download', 'ptt', 'onlinestatus', 'markierung',
  ];

  const aufraeumen = async () => {
    // Beide Konten: seit dem 03.09.2026 stellt auch das Pruefkonto etwas ein
    // (Markierung und Likes gehoeren der markierten bzw. likenden Person).
    for (const konto of [eigner, fremder]) {
      await konto.client
        .from('visibility_settings')
        .delete()
        .eq('user_id', konto.id)
        .in('bereich', BEREICHE);
      await konto.client
        .from('visibility_exceptions')
        .delete()
        .eq('user_id', konto.id)
        .in('bereich', BEREICHE);
    }
  };

  /*
   * Der Lauf legt sich seinen Bestand selbst an.
   *
   * Der erste Entwurf las die vorhandenen Storys des Testkontos — und die
   * waren abgelaufen, weil eine Story nach 24 Stunden weg ist. Der Lauf
   * meldete deshalb „keine Story im Bestand" und prüfte nichts. Ein Test,
   * der sich an fremde Daten hängt, prüft irgendwann gar nichts mehr.
   */
  const eigenes = { storyId: null, chatId: null, communityId: null };

  const bestandAnlegen = async () => {
    const { data: story, error: f1 } = await eigner.client
      .from('stories')
      .insert({ user_id: eigner.id, caption: 'Prüflauf Sichtbarkeit' })
      .select('id')
      .maybeSingle();
    if (f1) throw f1;
    eigenes.storyId = story.id;

    // Ein Zweierchat zwischen beiden Konten. Mit Namen: ein namenloser Chat
    // ist im Bestand von nichts zu unterscheiden und war deshalb am
    // 06.09.2026 nicht als Rest dieses Laufs zu erkennen.
    const { data: chat, error: f2 } = await eigner.client
      .from('chats')
      .insert({ name: 'Prüflauf Sichtbarkeit', is_group: false, created_by: eigner.id })
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

  /*
   * NACHGEZAEHLT WIRD IMMER — auch beim Aufraeumen.
   *
   * Am 04.09.2026 standen fuenfzehn Communitys "Prüflauf PTT" im Bestand,
   * angelegt von diesem Lauf ueber zwei Tage hinweg. Die Zeile unten hat sie
   * jedes Mal geloescht und jedes Mal nichts getroffen: auf `communities`
   * gab es keine DELETE-Regel, und ein von Row Level Security abgelehntes
   * DELETE meldet keinen Fehler — es trifft nur keine Zeile.
   *
   * Die Regel steht seit SUPABASE_SCHEMA_26_community_loeschen.sql. Damit
   * ein solcher Rest nicht wieder unbemerkt liegen bleibt, wird hier
   * nachgesehen statt gehofft.
   */
  const bestandAbraeumen = async () => {
    if (eigenes.storyId) await eigner.client.from('stories').delete().eq('id', eigenes.storyId);

    /*
     * Der Chat geht erst, wenn sonst niemand mehr drin ist.
     *
     * Die Regel "Leeren Chat abraeumen" (SUPABASE_SCHEMA_9_loeschen.sql)
     * laesst das Loeschen nur zu, solange ausser einem selbst kein Mitglied
     * mehr eingetragen ist. Hier standen beide Konten im Chat — das DELETE
     * traf keine Zeile und meldete keinen Fehler. So blieb bei jedem Lauf
     * genau ein namenloser Chat stehen; am 06.09.2026 waren es
     * vierundzwanzig, und in der Chatliste der App standen vierundzwanzig
     * Zeilen mit nichts als einem Kreis und einer Uhrzeit.
     *
     * Reihenfolge wie in `_dmsperre.js`: aus `chat_members` nimmt jedes
     * Konto seine eigene Zeile, dann erst faellt der Chat.
     */
    if (eigenes.chatId) {
      await fremder.client
        .from('chat_members')
        .delete()
        .eq('chat_id', eigenes.chatId)
        .eq('user_id', fremder.id);
      await eigner.client
        .from('chat_members')
        .delete()
        .eq('chat_id', eigenes.chatId)
        .eq('user_id', eigner.id);
      await eigner.client.from('chats').delete().eq('id', eigenes.chatId);

      const { count } = await eigner.client
        .from('chats')
        .select('*', { count: 'exact', head: true })
        .eq('id', eigenes.chatId);
      pruefe('Der Pruefchat ist danach wirklich weg', !count, `${count} Zeile(n) geblieben`);
    }
    // Ebenso die Community: Mitglieder und PTT-Nachrichten haengen daran.
    if (eigenes.communityId) {
      await eigner.client.from('communities').delete().eq('id', eigenes.communityId);
      const { data: rest } = await eigner.client
        .from('communities')
        .select('id')
        .eq('id', eigenes.communityId);
      pruefe('Die Pruefcommunity ist danach wirklich weg', (rest || []).length === 0,
        `${(rest || []).length} Zeile(n) geblieben`);
    }
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
    /* =====================================================================
     * Die sechs Bereiche, die bis zum 03.09.2026 gespeichert, aber ohne
     * Wirkung waren. Schema 20 holt sie nach.
     * ===================================================================== */

    // Ein eigener Beitrag traegt die Faelle Repost, Likes und Markierung.
    const { data: eigenerBeitrag } = await eigner.client
      .from('posts')
      .select('id')
      .eq('user_id', eigner.id)
      .limit(1)
      .maybeSingle();

    console.log('\nRepost-Sichtbarkeit');

    if (!eigenerBeitrag) {
      pruefe('Ein eigener Beitrag zum Pruefen', false, 'das Testkonto hat keinen');
    } else {
      await eigner.client
        .from('reposts')
        .upsert({ user_id: eigner.id, post_id: eigenerBeitrag.id });

      await stufe('repost', 'alle');
      const { data: rAn } = await fremder.client
        .from('reposts')
        .select('post_id')
        .eq('user_id', eigner.id);
      pruefe('Bei „Alle" sieht das andere Konto die Reposts', (rAn || []).length > 0,
        `${(rAn || []).length} sichtbar`);

      await stufe('repost', 'niemand');
      const { data: rAus } = await fremder.client
        .from('reposts')
        .select('post_id')
        .eq('user_id', eigner.id);
      pruefe('Bei „Niemand" sieht es keine mehr', (rAus || []).length === 0,
        `${(rAus || []).length} sichtbar`);

      const { data: rSelbst } = await eigner.client
        .from('reposts')
        .select('post_id')
        .eq('user_id', eigner.id);
      pruefe('Die eigenen Reposts bleiben einem selbst sichtbar',
        (rSelbst || []).length > 0, `${(rSelbst || []).length} sichtbar`);

      await eigner.client
        .from('reposts')
        .delete()
        .eq('user_id', eigner.id)
        .eq('post_id', eigenerBeitrag.id);
    }

    console.log('\nZuletzt online');

    const { error: eHier } = await eigner.client.rpc('hier_bin_ich');
    pruefe('„Ich bin da" laesst sich vermerken', !eHier, eHier ? eHier.message : '');

    await stufe('onlinestatus', 'alle');
    const { data: pAn } = await fremder.client
      .from('presence')
      .select('last_seen')
      .eq('user_id', eigner.id);
    pruefe('Bei „Alle" sieht das andere Konto den Zeitpunkt', (pAn || []).length > 0,
      `${(pAn || []).length} Zeile(n)`);

    await stufe('onlinestatus', 'niemand');
    const { data: pAus } = await fremder.client
      .from('presence')
      .select('last_seen')
      .eq('user_id', eigner.id);
    pruefe('Bei „Niemand" ist er weg — nicht „verborgen", sondern gar nicht da',
      (pAus || []).length === 0, `${(pAus || []).length} Zeile(n)`);

    const { data: pSelbst } = await eigner.client
      .from('presence')
      .select('last_seen')
      .eq('user_id', eigner.id);
    pruefe('Man selbst sieht seinen eigenen Zeitpunkt weiterhin',
      (pSelbst || []).length > 0, `${(pSelbst || []).length} Zeile(n)`);

    console.log('\nWer darf mich markieren');

    if (eigenerBeitrag) {
      // Die Einstellung gehoert der markierten Person, nicht dem Verfasser:
      // hier stellt also das Pruefkonto ein und der Eigner versucht es.
      await stufeFuer(fremder, 'markierung', 'alle');
      const { data: t1, error: g1 } = await eigner.client
        .from('post_tags')
        .insert({ post_id: eigenerBeitrag.id, user_id: fremder.id })
        .select('post_id')
        .maybeSingle();
      pruefe('Bei „Alle" laesst sich die Person markieren', !g1 && Boolean(t1),
        g1 ? g1.message : '');
      if (t1) {
        await eigner.client
          .from('post_tags')
          .delete()
          .eq('post_id', eigenerBeitrag.id)
          .eq('user_id', fremder.id);
      }

      await stufeFuer(fremder, 'markierung', 'niemand');
      const { error: g2 } = await eigner.client
        .from('post_tags')
        .insert({ post_id: eigenerBeitrag.id, user_id: fremder.id })
        .select('post_id')
        .maybeSingle();
      pruefe('Bei „Niemand" wird die Markierung abgelehnt', Boolean(g2),
        g2 ? g2.code : 'ging trotzdem durch');

      // Markieren darf nur der Verfasser des Beitrags.
      const { error: g3 } = await fremder.client
        .from('post_tags')
        .insert({ post_id: eigenerBeitrag.id, user_id: eigner.id })
        .select('post_id')
        .maybeSingle();
      pruefe('In einem fremden Beitrag darf niemand markieren', Boolean(g3),
        g3 ? g3.code : 'ging trotzdem durch');

      // Und die markierte Person kommt allein wieder heraus.
      await stufeFuer(fremder, 'markierung', 'alle');
      await eigner.client
        .from('post_tags')
        .insert({ post_id: eigenerBeitrag.id, user_id: fremder.id });
      const { error: g4 } = await fremder.client
        .from('post_tags')
        .delete()
        .eq('post_id', eigenerBeitrag.id)
        .eq('user_id', fremder.id);
      const { data: rest } = await fremder.client
        .from('post_tags')
        .select('post_id')
        .eq('post_id', eigenerBeitrag.id)
        .eq('user_id', fremder.id);
      // Ein abgelehntes DELETE meldet unter RLS keinen Fehler, sondern
      // loescht null Zeilen. Deshalb wird nachgesehen, nicht nur der
      // Fehlercode gelesen.
      pruefe('Wer markiert wurde, kann sich selbst wieder austragen',
        !g4 && (rest || []).length === 0, `${(rest || []).length} uebrig`);
    }

    console.log('\nLikes-Sichtbarkeit');

    if (eigenerBeitrag) {
      await fremder.client
        .from('post_likes')
        .upsert({ post_id: eigenerBeitrag.id, user_id: fremder.id });

      const zaehler = async () => {
        const { data } = await eigner.client
          .from('posts')
          .select('id, post_likes(count)')
          .eq('id', eigenerBeitrag.id)
          .maybeSingle();
        return data?.post_likes?.[0]?.count ?? 0;
      };

      await stufeFuer(fremder, 'likes', 'alle');
      const zAn = await zaehler();
      const { data: nAn } = await eigner.client
        .rpc('liker_namen', { beitraege: [eigenerBeitrag.id], wer: eigner.id });
      pruefe('Bei „Alle" steht ein Name unter dem Beitrag',
        Boolean((nAn || [])[0]?.name), (nAn || [])[0]?.name || 'kein Name');

      await stufeFuer(fremder, 'likes', 'niemand');
      const { data: nAus } = await eigner.client
        .rpc('liker_namen', { beitraege: [eigenerBeitrag.id], wer: eigner.id });
      pruefe('Bei „Niemand" verschwindet der Name',
        !((nAus || [])[0]?.name), (nAus || [])[0]?.name || '');

      // Der wichtigste Punkt: die Zahl bleibt. Sie ist eine Tatsache ueber
      // den Beitrag, nicht eine Auskunft ueber den Menschen — haette sie
      // sich mit verborgen, haette derselbe Beitrag je nach Betrachter
      // verschiedene Like-Zahlen.
      const zAus = await zaehler();
      pruefe('Die Like-Zahl bleibt davon unberuehrt', zAn === zAus && zAn > 0,
        `${zAn} → ${zAus}`);

      await fremder.client
        .from('post_likes')
        .delete()
        .eq('post_id', eigenerBeitrag.id)
        .eq('user_id', fremder.id);
    }

    console.log('\nDownload');

    await stufe('download', 'alle');
    const { data: dAn } = await fremder.client
      .rpc('darf_herunterladen', { inhaber: eigner.id, wer: fremder.id });
    pruefe('Bei „Alle" ist der Download erlaubt', dAn === true, String(dAn));

    await stufe('download', 'niemand');
    const { data: dAus } = await fremder.client
      .rpc('darf_herunterladen', { inhaber: eigner.id, wer: fremder.id });
    pruefe('Bei „Niemand" nicht mehr', dAus === false, String(dAus));

    console.log('\nPush-to-Talk');

    // Anders als ueberall sonst gehoert die Einstellung hier dem Empfaenger:
    // eine PTT-Nachricht geht an eine ganze Community und hat keinen
    // einzelnen Adressaten.
    const { data: gemeinschaft, error: cErr } = await eigner.client
      .from('communities')
      .insert({ name: 'Prüflauf PTT', created_by: eigner.id, visibility: 'private' })
      .select('id')
      .maybeSingle();

    if (cErr || !gemeinschaft) {
      pruefe('Eine Community zum Pruefen', false, cErr ? cErr.message : 'keine angelegt');
    } else {
      eigenes.communityId = gemeinschaft.id;
      await eigner.client
        .from('community_members')
        .insert({ community_id: gemeinschaft.id, user_id: eigner.id });
      await fremder.client
        .from('community_members')
        .insert({ community_id: gemeinschaft.id, user_id: fremder.id });

      const { error: sErr } = await eigner.client.from('ptt_messages').insert({
        community_id: gemeinschaft.id,
        sender_id: eigner.id,
        audio_url: 'https://example.invalid/pruef.m4a',
        dauer: 2,
      });
      pruefe('Eine PTT-Nachricht laesst sich senden', !sErr, sErr ? sErr.message : '');

      await stufeFuer(fremder, 'ptt', 'alle');
      const { data: ptAn } = await fremder.client
        .from('ptt_messages')
        .select('id')
        .eq('community_id', gemeinschaft.id);
      pruefe('Bei „Alle" hoert das andere Konto sie', (ptAn || []).length > 0,
        `${(ptAn || []).length} sichtbar`);

      await stufeFuer(fremder, 'ptt', 'niemand');
      const { data: ptAus } = await fremder.client
        .from('ptt_messages')
        .select('id')
        .eq('community_id', gemeinschaft.id);
      pruefe('Bei „Niemand" erreicht sie ihn nicht mehr', (ptAus || []).length === 0,
        `${(ptAus || []).length} sichtbar`);

      const { data: ptSelbst } = await eigner.client
        .from('ptt_messages')
        .select('id')
        .eq('community_id', gemeinschaft.id);
      pruefe('Die eigene Nachricht bleibt einem selbst sichtbar',
        (ptSelbst || []).length > 0, `${(ptSelbst || []).length} sichtbar`);
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
