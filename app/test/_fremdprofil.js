/**
 * Zeigt ein fremdes Profil, was diese Person wirklich hat?
 *
 * WARUM ES DAS GIBT
 *
 * Der erste Reiter im fremden Profil zeichnete in der App zwölf feste
 * Kacheln aus einer Konstanten — bei jedem Menschen dieselben zwölf, ob er
 * nun drei Beiträge hatte oder keinen. Direkt darüber stand die echte Zahl
 * aus `profile_zahlen`: die Anzeige widersprach sich selbst. Die Reiter
 * „Reposts" und „Markiert" standen in beiden Oberflächen fest auf leer,
 * obwohl es `reposts` und `post_tags` seit dem 03.09.2026 gibt.
 *
 * Geprüft wird aus der Sicht des *fremden* Kontos — mit einer Perspektive
 * ließe sich nicht unterscheiden, ob eine Liste echt ist oder nur so
 * aussieht. Beide Wege kommen dran: die App liest direkt aus Supabase, die
 * Website über `/api/reposts?user=` und `/api/markierungen?user=`. Sie
 * müssen dasselbe sagen.
 *
 * Start:  node test/_fremdprofil.js   (Server muss laufen)
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
const BASIS = process.env.AM_URL || 'http://localhost:3000';

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
  return { client, id: data.user.id, token: data.session.access_token };
}

/** Die Website fragen — mit dem Zugangstoken, sonst ist sie leer. */
async function web(konto, pfad) {
  const antwort = await fetch(BASIS + pfad, {
    headers: { Authorization: `Bearer ${konto.token}` },
  });
  if (!antwort.ok) throw new Error(`${pfad}: HTTP ${antwort.status}`);
  return antwort.json();
}

/*
 * Derselbe Weg, den `app/lib/aktionen.ts` geht. Absichtlich hier noch einmal
 * ausgeschrieben und nicht importiert: die Datei ist TypeScript und liefe
 * hier nicht — und eine zweite Formulierung derselben Abfrage deckt auf,
 * wenn die erste etwas anderes meint, als sie sagt.
 */
const beitraegeVon = async (konto, profilId) =>
  (
    await konto.client
      .from('posts')
      .select('id, kind, created_at')
      .eq('user_id', profilId)
      .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
  ).data || [];

/*
 * `.filter(z => z.posts)` ist kein Beiwerk: eine Repost-Zeile bleibt lesbar,
 * auch wenn der Beitrag dahinter es nicht ist — die Beiträge des
 * Testbestands tragen `demo = true` und gehören nur ihrem Besitzer. Ohne den
 * Filter zählte die App Kacheln mit, die sie gar nicht zeichnen kann, und die
 * Website (die den Beitrag wirklich holt) käme auf eine andere Zahl. Genau so
 * steht es auch in app/lib/aktionen.ts.
 */
const repostsVon = async (konto, profilId) =>
  ((
    await konto.client
      .from('reposts')
      .select('post_id, posts!post_id(id, kind)')
      .eq('user_id', profilId)
  ).data || []).filter((z) => z.posts);

const markiertVon = async (konto, profilId) =>
  ((
    await konto.client
      .from('post_tags')
      .select('post_id, posts!post_id(id, kind)')
      .eq('user_id', profilId)
  ).data || []).filter((z) => z.posts);

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  const eigner = await anmelden(EIGNER);
  const fremder = await anmelden(FREMDER);

  const aufraeumen = [];

  /** Eine Sichtbarkeitsstufe für das Testkonto setzen. */
  const stufe = async (bereich, w) => {
    await eigner.client
      .from('visibility_settings')
      .upsert({ user_id: eigner.id, bereich, stufe: w }, { onConflict: 'user_id,bereich' });
  };

  try {
    console.log('\nDer Reiter „Beiträge"');

    /*
     * Zwei echte Beiträge, eigens für diesen Lauf.
     *
     * Nicht die aus dem Testbestand: die tragen `demo = true`, und die Regel
     * `beitrag_sichtbar()` zeigt sie nur ihrem Besitzer. Das ist richtig so —
     * für diesen Lauf heißt es aber, dass er sich seinen Gegenstand selbst
     * anlegen muss. Sonst prüfte er ein leeres Raster gegen ein leeres
     * Raster und wäre grün, ohne etwas gesehen zu haben.
     */
    for (const [nr, beschreibung] of [[1, 'Prüflauf Raster eins'], [2, 'Prüflauf Raster zwei']]) {
      const { data, error } = await eigner.client
        .from('posts')
        .insert({ user_id: eigner.id, kind: nr === 1 ? 'post' : 'reel', description: beschreibung })
        .select('id')
        .maybeSingle();
      if (error) throw error;
      aufraeumen.push(() => eigner.client.from('posts').delete().eq('id', data.id));
    }

    const eigene = await beitraegeVon(fremder, eigner.id);
    pruefe('Das andere Konto sieht die Beiträge', eigene.length >= 2,
      `${eigene.length} Stück`);

    /*
     * Der eigentliche Punkt: das Raster gehört dieser Person.
     *
     * Gegen die Zahl über dem Namen lässt sich das nicht prüfen — sie kommt
     * aus `profile_zahlen` und enthält einen Sockel (`beitraege_basis`) aus
     * dem Testbestand. Geprüft wird stattdessen quer: die App liest direkt
     * aus Supabase, die Website baut ihr Raster in `/api/profile/:id` aus
     * dem Feed. Zwei verschiedene Wege — dieselbe Antwort, sonst stimmt
     * einer von beiden nicht.
     */
    const webProfil = await web(fremder, `/api/profile/${eigner.id}`);
    const webIds = (webProfil.grid || []).map((g) => g.id).sort();
    const appIds = eigene.map((b) => b.id).sort();
    pruefe(
      'App und Website zeigen dieselben Kacheln',
      webIds.length === appIds.length && webIds.every((id, i) => id === appIds[i]),
      `Website ${webIds.length}, App ${appIds.length}`
    );

    // Zwölf war die Zahl der fest eingebauten Kacheln. Hat diese Person
    // genau zwölf Beiträge, sagt die Prüfung nichts — dann ist der Hinweis
    // wichtiger als ein grünes Häkchen.
    if (eigene.length === 12) {
      console.log('  HINWEIS  Genau 12 Beiträge — die alte Konstante hatte auch 12.');
    }

    // „Später posten": ein Beitrag mit einem Zeitpunkt in der Zukunft darf
    // im fremden Raster nicht auftauchen.
    const { data: spaeter, error: spaeterFehler } = await eigner.client
      .from('posts')
      .insert({
        user_id: eigner.id,
        kind: 'post',
        description: 'Prüflauf fremdes Profil — später',
        publish_at: new Date(Date.now() + 3600_000).toISOString(),
      })
      .select('id')
      .maybeSingle();
    if (spaeter) aufraeumen.push(() => eigner.client.from('posts').delete().eq('id', spaeter.id));
    pruefe('Ein Beitrag für später lässt sich anlegen', Boolean(spaeter),
      spaeterFehler ? spaeterFehler.message : '');

    if (spaeter) {
      const nachher = await beitraegeVon(fremder, eigner.id);
      pruefe(
        'Er steht noch nicht im fremden Raster',
        !nachher.some((b) => b.id === spaeter.id),
        `${nachher.length} Kacheln`
      );
    }

    console.log('\nDer Reiter „Reposts"');

    const zumReposten = eigene[0];
    if (!zumReposten) {
      pruefe('Ein Beitrag zum Reposten', false, 'keiner sichtbar');
    } else {
      await eigner.client.from('reposts').upsert({ user_id: eigner.id, post_id: zumReposten.id });
      aufraeumen.push(() =>
        eigner.client.from('reposts').delete().eq('user_id', eigner.id).eq('post_id', zumReposten.id)
      );

      await stufe('repost', 'alle');
      const ausDb = await repostsVon(fremder, eigner.id);
      pruefe('Die App sieht den Repost des anderen Kontos', ausDb.length > 0,
        `${ausDb.length} Stück`);

      const ausWeb = await web(fremder, `/api/reposts?user=${eigner.id}`);
      pruefe('Die Website sagt dasselbe', ausWeb.length === ausDb.length,
        `Website ${ausWeb.length}, App ${ausDb.length}`);

      // Ohne `?user=` sind es die eigenen — nicht die des anderen.
      const eigeneWeb = await web(fremder, '/api/reposts');
      pruefe(
        'Ohne Angabe liefert die Website weiterhin die eigenen',
        !eigeneWeb.some((r) => r.eintrag.id === zumReposten.id),
        `${eigeneWeb.length} eigene`
      );

      await stufe('repost', 'niemand');
      const verborgenDb = await repostsVon(fremder, eigner.id);
      const verborgenWeb = await web(fremder, `/api/reposts?user=${eigner.id}`);
      pruefe('Bei „Niemand" ist der Reiter in der App leer', verborgenDb.length === 0,
        `${verborgenDb.length} sichtbar`);
      pruefe('Und auf der Website ebenso', verborgenWeb.length === 0,
        `${verborgenWeb.length} sichtbar`);

      await stufe('repost', 'alle');
    }

    console.log('\nDer Reiter „Markiert"');

    const { data: fremderBeitrag, error: fbFehler } = await fremder.client
      .from('posts')
      .insert({ user_id: fremder.id, kind: 'post', description: 'Prüflauf Markierung' })
      .select('id')
      .maybeSingle();
    if (fremderBeitrag) {
      aufraeumen.push(() => fremder.client.from('posts').delete().eq('id', fremderBeitrag.id));
    }
    pruefe('Ein Beitrag zum Markieren', Boolean(fremderBeitrag), fbFehler ? fbFehler.message : '');

    if (fremderBeitrag) {
      // Die Markierung gehört dem Markierten: sie steht und fällt mit
      // dessen Einstellung, nicht mit der des Verfassers.
      await stufe('markierung', 'alle');
      const { error: tagFehler } = await fremder.client
        .from('post_tags')
        .insert({ post_id: fremderBeitrag.id, user_id: eigner.id });
      pruefe('Das Testkonto lässt sich markieren', !tagFehler, tagFehler ? tagFehler.message : '');

      const ausDb = await markiertVon(fremder, eigner.id);
      pruefe(
        'Der Reiter „Markiert" im fremden Profil zeigt ihn',
        ausDb.some((z) => z.post_id === fremderBeitrag.id),
        `${ausDb.length} Stück`
      );

      const ausWeb = await web(fremder, `/api/markierungen?user=${eigner.id}`);
      pruefe('Die Website sagt dasselbe', ausWeb.length === ausDb.length,
        `Website ${ausWeb.length}, App ${ausDb.length}`);

      await eigner.client
        .from('post_tags')
        .delete()
        .eq('post_id', fremderBeitrag.id)
        .eq('user_id', eigner.id);

      /*
       * Und die Gegenprobe zur Regel: wer sich nicht markieren lässt, wird
       * auch nicht markiert. Ein abgelehntes INSERT unter RLS meldet keinen
       * Fehler — es schreibt nur nichts. Deshalb wird nachgesehen.
       */
      await stufe('markierung', 'niemand');
      await fremder.client
        .from('post_tags')
        .insert({ post_id: fremderBeitrag.id, user_id: eigner.id });
      const danach = await markiertVon(fremder, eigner.id);
      pruefe(
        'Bei „Niemand" kommt keine Markierung an',
        !danach.some((z) => z.post_id === fremderBeitrag.id),
        `${danach.length} Stück`
      );
      await stufe('markierung', 'alle');
    }
  } finally {
    for (const schritt of aufraeumen.reverse()) {
      try {
        await schritt();
      } catch (e) {
        console.log('  HINWEIS  Aufräumen: ' + (e?.message ?? e));
      }
    }
  }

  console.log(
    fehler === 0
      ? '\nDas fremde Profil zeigt, was da ist.'
      : `\n${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
