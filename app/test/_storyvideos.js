/**
 * „Story auch in Videos teilen" — wirkt der Schalter, oder steht er nur da?
 *
 * WARUM ES DAS GIBT
 *
 * Das Handbuch hängt den Zusatz an die Story-Sichtbarkeit:
 *
 *     Story Sichtbarkeit (allgemein nur für Kontakte) (Niemand,
 *     Niemand bis auf…, Jeder bis auf…, Jeder -> Story auch in
 *     Videos teilen)
 *
 * Bis zum 07.09.2026 gab es weder den Schalter noch die Trennung, auf die er
 * sich bezieht: App und Website luden eine einzige Storyliste und zeigten sie
 * im Messenger und im Videos-Bereich zweimal. Ein Schalter darüber wäre eine
 * Einstellung ohne Wirkung gewesen.
 *
 * Geprüft wird deshalb beides, und zwar aus zwei Perspektiven — ein Konto
 * stellt ein, das andere sieht nach. Aus einer Perspektive allein ließe sich
 * keine dieser Regeln widerlegen.
 *
 * Kein Browser: die Bereichstrennung ist eine Anzeigeregel und steht im Code
 * von App und Website. Was hier gegen die Datenbank läuft, ist der Schalter
 * selbst und der Trigger, der ihn an die Stufe „Alle" bindet — und der muss
 * in der Datenbank stehen, weil die App direkt nach Supabase schreibt und an
 * jeder Prüfung im Servercode vorbeikäme.
 *
 * Start:  node test/_storyvideos.js
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

/**
 * Die Bereichsregel aus app/lib/daten.ts und web/server/supabase-api.js —
 * hier noch einmal, damit der Lauf sie prüfen kann, ohne die App zu starten.
 *
 * Bewusst eine Nachbildung und kein Aufruf: `ladeStorys()` ist TypeScript und
 * hängt an einem angemeldeten Client. Was hier steht, ist die Regel in ihrer
 * kürzesten Form — weicht der Code davon ab, fällt es beim Lesen auf.
 */
function bereichsListen(storys, { kontaktIds, gefolgtIds, ichId }) {
  const fremde = storys.filter((s) => s.user_id !== ichId);
  return {
    messenger: fremde.filter((s) => kontaktIds.has(s.user_id)),
    videos: fremde.filter((s) => gefolgtIds.has(s.user_id) && s.story_in_videos),
  };
}

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  const eigner = await anmelden(EIGNER);
  const fremder = await anmelden(FREMDER);

  const schalter = async (konto, an) => {
    const { error } = await konto.client
      .from('profiles')
      .update({ story_in_videos: an })
      .eq('id', konto.id);
    if (error) throw error;
  };

  const stufe = async (konto, wert) => {
    const { error } = await konto.client
      .from('visibility_settings')
      .upsert({ user_id: konto.id, bereich: 'story', stufe: wert }, { onConflict: 'user_id,bereich' });
    if (error) throw error;
  };

  const gelesen = async (konto, zielId) => {
    const { data, error } = await konto.client
      .from('profiles')
      .select('story_in_videos')
      .eq('id', zielId)
      .maybeSingle();
    if (error) throw error;
    return data;
  };

  let storyId = null;

  const aufraeumen = async () => {
    if (storyId) {
      await eigner.client.from('stories').delete().eq('id', storyId);
      /*
       * Nachzählen. Ein DELETE, das die Regel nicht erlaubt, trifft null
       * Zeilen und meldet trotzdem keinen Fehler — genau daran hat sich am
       * 06.09.2026 im Bestand vierundzwanzigmal ein Prüfchat angesammelt.
       */
      const { data: rest } = await eigner.client.from('stories').select('id').eq('id', storyId);
      pruefe('Die Prüfstory ist hinterher weg', (rest || []).length === 0,
        `${(rest || []).length} geblieben`);
    }
    await eigner.client.from('visibility_settings').delete().eq('user_id', eigner.id).eq('bereich', 'story');
    await schalter(eigner, false);
  };

  try {
    // ------------------------------------------------- der Schalter selbst --

    await stufe(eigner, 'alle');
    await schalter(eigner, true);

    const eigenSicht = await gelesen(eigner, eigner.id);
    pruefe('Der Schalter lässt sich setzen und steht danach da',
      eigenSicht?.story_in_videos === true, JSON.stringify(eigenSicht));

    const fremdSicht = await gelesen(fremder, eigner.id);
    pruefe('Ein fremdes Konto kann ihn lesen — sonst könnte es nicht filtern',
      fremdSicht?.story_in_videos === true, JSON.stringify(fremdSicht));

    // ----------------------------------- die Bindung an die Stufe „Alle" --

    await stufe(eigner, 'niemand_bis_auf');
    const nachWechsel = await gelesen(eigner, eigner.id);
    pruefe('Verlässt die Story-Sichtbarkeit „Alle", fällt der Zusatz mit',
      nachWechsel?.story_in_videos === false, JSON.stringify(nachWechsel));

    await stufe(eigner, 'alle');
    const nachRueckkehr = await gelesen(eigner, eigner.id);
    pruefe('Zurück auf „Alle" schaltet ihn nicht von selbst wieder an',
      nachRueckkehr?.story_in_videos === false, JSON.stringify(nachRueckkehr));

    // ---------------------------------------- fremde Konten dürfen nicht --

    const { error: fremdSchreib } = await fremder.client
      .from('profiles')
      .update({ story_in_videos: true })
      .eq('id', eigner.id);
    const nachFremdversuch = await gelesen(eigner, eigner.id);
    pruefe('Ein fremdes Konto kann ihn nicht für mich anschalten',
      nachFremdversuch?.story_in_videos === false,
      fremdSchreib ? fremdSchreib.message : 'ohne Fehlermeldung durchgelaufen');

    // ------------------------------------------ die Trennung der Bereiche --

    await schalter(eigner, true);

    const { data: story, error: fStory } = await eigner.client
      .from('stories')
      .insert({ user_id: eigner.id, caption: 'Prüflauf Story in Videos' })
      .select('id')
      .maybeSingle();
    if (fStory) throw fStory;
    storyId = story.id;

    const { data: sichtbar, error: fSicht } = await fremder.client
      .from('stories')
      .select('id, user_id, profiles!stories_user_id_fkey(story_in_videos)')
      .eq('id', storyId);
    if (fSicht) throw fSicht;
    pruefe('Das andere Konto sieht die Story überhaupt', (sichtbar || []).length === 1,
      `${(sichtbar || []).length} gefunden`);

    const roh = (sichtbar || []).map((s) => ({
      id: s.id,
      user_id: s.user_id,
      story_in_videos: Boolean(s.profiles && s.profiles.story_in_videos),
    }));

    const alsKontakt = bereichsListen(roh, {
      ichId: fremder.id,
      kontaktIds: new Set([eigner.id]),
      gefolgtIds: new Set(),
    });
    pruefe('Als Kontakt steht sie im Messenger', alsKontakt.messenger.length === 1);
    pruefe('Ohne zu folgen steht sie nicht in Videos', alsKontakt.videos.length === 0);

    const alsFolgend = bereichsListen(roh, {
      ichId: fremder.id,
      kontaktIds: new Set(),
      gefolgtIds: new Set([eigner.id]),
    });
    pruefe('Wer folgt, sieht sie in Videos', alsFolgend.videos.length === 1);
    pruefe('Ohne Kontakt zu sein steht sie nicht im Messenger',
      alsFolgend.messenger.length === 0);

    // Und derselbe Fall mit ausgeschaltetem Zusatz.
    await schalter(eigner, false);
    const { data: sichtbarAus } = await fremder.client
      .from('stories')
      .select('id, user_id, profiles!stories_user_id_fkey(story_in_videos)')
      .eq('id', storyId);

    const rohAus = (sichtbarAus || []).map((s) => ({
      id: s.id,
      user_id: s.user_id,
      story_in_videos: Boolean(s.profiles && s.profiles.story_in_videos),
    }));
    const ausgeschaltet = bereichsListen(rohAus, {
      ichId: fremder.id,
      kontaktIds: new Set([eigner.id]),
      gefolgtIds: new Set([eigner.id]),
    });
    pruefe('Ohne den Zusatz bleibt sie aus dem Videos-Bereich heraus',
      ausgeschaltet.videos.length === 0);
    pruefe('Im Messenger steht sie trotzdem — dort hängt sie nicht daran',
      ausgeschaltet.messenger.length === 1);
  } finally {
    await aufraeumen();
  }

  console.log(
    fehler === 0
      ? '\n„Story auch in Videos teilen" wirkt wirklich.'
      : `\n${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
