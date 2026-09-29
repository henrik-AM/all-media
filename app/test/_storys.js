/**
 * Storys: Ziel, mehrere hintereinander, Bearbeitung, Markieren — Kasten 11.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 21.09.2026 (Kasten 11):
 *   „Nur eine Story möglich — eine zweite lässt sich nicht hochladen."
 *   „Story-Ziel: … *nur Videos* oder *Messenger und Videos*. Im Messenger umgekehrt."
 *   „Story-Bearbeitung fehlt komplett: kein Text, keine Filter, keine Schrift,
 *    kein Markieren von Personen."
 *   „Fremde Stories fehlen: Nur die eigene ist sichtbar, keine der Test-Nutzer."
 *
 * Alles davon ist eine Regel in der Datenbank (SUPABASE_SCHEMA_XX_storys.sql)
 * oder in gemeinsam/story.js — und beides lässt sich nur aus zwei Perspektiven
 * widerlegen: ein Konto postet, das andere sieht nach. Kein Browser; was die
 * Oberflächen daraus machen, steht in gemeinsam/story.js und wird hier mit
 * denselben Zeilen aufgerufen, die App und Website bekommen.
 *
 * Nur die beiden Testkonten. Alles, was der Lauf anlegt oder umstellt, stellt
 * er am Ende zurück — und zählt nach, ob es wirklich weg ist (ein verbotenes
 * DELETE meldet keinen Fehler).
 *
 * Braucht das Schema XX_storys. Fehlt es, bricht der Lauf mit genau diesem
 * Satz ab, statt dreißig Folgefehler zu zeigen.
 *
 * Start:  node test/_storys.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const StoryRegeln = require('../../gemeinsam/story');

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
  const storys = [];

  // ------------------------------------------------ ist das Schema da? --
  const { error: fSchema } = await eigner.client.from('stories').select('in_messenger, overlays').limit(1);
  if (fSchema) {
    console.error('FEHLER  Schema XX_storys fehlt (stories.in_messenger/overlays): ' + fSchema.message);
    process.exit(1);
  }

  const lesbar = async (konto, id) => {
    const { data, error } = await konto.client.from('stories').select('id').eq('id', id);
    if (error) throw error;
    return (data || []).length === 1;
  };

  const anlegen = async (felder) => {
    const { data, error } = await eigner.client
      .from('stories')
      .insert({ user_id: eigner.id, caption: 'Prüflauf Kasten 11', ...felder })
      .select('id')
      .single();
    if (error) throw error;
    storys.push(data.id);
    return data.id;
  };

  const jetzt = () => new Date(Date.now() - 1000).toISOString();

  try {
    // Ausgangslage: kein Kontakt zwischen beiden, Story-Sichtbarkeit „alle".
    const { data: kontaktVorher } = await fremder.client
      .from('contacts').select('status').eq('user_id', fremder.id).eq('contact_id', eigner.id).maybeSingle();
    const { data: kontaktVorher2 } = await eigner.client
      .from('contacts').select('status').eq('user_id', eigner.id).eq('contact_id', fremder.id).maybeSingle();
    if (kontaktVorher) {
      await fremder.client.from('contacts').delete().eq('user_id', fremder.id).eq('contact_id', eigner.id);
      wegRaeumen.push(() => fremder.client.from('contacts').upsert(
        { user_id: fremder.id, contact_id: eigner.id, status: kontaktVorher.status },
        { onConflict: 'user_id,contact_id' }));
    }
    if (kontaktVorher2) {
      await eigner.client.from('contacts').delete().eq('user_id', eigner.id).eq('contact_id', fremder.id);
      wegRaeumen.push(() => eigner.client.from('contacts').upsert(
        { user_id: eigner.id, contact_id: fremder.id, status: kontaktVorher2.status },
        { onConflict: 'user_id,contact_id' }));
    }
    const { data: stufeVorher } = await eigner.client
      .from('visibility_settings').select('stufe').eq('user_id', eigner.id).eq('bereich', 'story').maybeSingle();
    await eigner.client.from('visibility_settings')
      .upsert({ user_id: eigner.id, bereich: 'story', stufe: 'alle' }, { onConflict: 'user_id,bereich' });
    wegRaeumen.push(() => stufeVorher
      ? eigner.client.from('visibility_settings').update({ stufe: stufeVorher.stufe }).eq('user_id', eigner.id).eq('bereich', 'story')
      : eigner.client.from('visibility_settings').delete().eq('user_id', eigner.id).eq('bereich', 'story'));

    // ------------------------------------------------------ 11.5 Ziel --
    console.log('\n11.5  Ziel der Story');
    const { error: fOhneZiel } = await eigner.client
      .from('stories')
      .insert({ user_id: eigner.id, caption: 'Prüflauf ohne Ziel', in_messenger: false, in_videos: false });
    pruefe('Eine Story ohne jedes Ziel lehnt die Datenbank ab', Boolean(fOhneZiel),
      fOhneZiel ? fOhneZiel.message : 'wurde angelegt');

    const nurMessenger = await anlegen({ in_messenger: true, in_videos: false });
    const nurVideos = await anlegen({ in_messenger: false, in_videos: true });

    pruefe('„Nur Messenger": ohne Kontakt nicht lesbar', !(await lesbar(fremder, nurMessenger)));
    pruefe('„Nur Videos": auch ohne Kontakt lesbar', await lesbar(fremder, nurVideos));

    const { data: z1 } = await eigner.client.from('stories').select('in_messenger, in_videos').eq('id', nurVideos).single();
    pruefe('„Nur Videos" steht so in der Zeile (in_messenger false)', z1 && z1.in_messenger === false && z1.in_videos === true,
      JSON.stringify(z1));

    // Zielwahl-Regel, die beide Oberflächen zeigen
    const vonVideos = StoryRegeln.zielWahl('videos', true).map((z) => z.label);
    const vonMessenger = StoryRegeln.zielWahl('messenger', true).map((z) => z.label);
    pruefe('Aus Videos: „Nur Videos" und „Messenger und Videos"',
      vonVideos.join('|') === 'Nur Videos|Messenger und Videos', vonVideos.join(', '));
    pruefe('Aus dem Messenger: „Nur Messenger" und „Messenger und Videos"',
      vonMessenger.join('|') === 'Nur Messenger|Messenger und Videos', vonMessenger.join(', '));

    // Kontakt herstellen (über die Nummer des Testkontos, wie _chatanfrage.js)
    const { data: treffer, error: nFehler } = await fremder.client
      .rpc('finde_per_nummer', { nummer: '+49 151 9990001' });
    if (nFehler) throw nFehler;
    const gefunden = Array.isArray(treffer) ? treffer[0] : treffer;
    if (gefunden?.id !== eigner.id) throw new Error('Nummer des Testkontos führt nicht zum Testkonto');
    await fremder.client.from('contacts')
      .upsert({ user_id: fremder.id, contact_id: eigner.id, status: 'friend' }, { onConflict: 'user_id,contact_id' });
    wegRaeumen.unshift(() => fremder.client.from('contacts').delete().eq('user_id', fremder.id).eq('contact_id', eigner.id));
    pruefe('„Nur Messenger": als Kontakt lesbar', await lesbar(fremder, nurMessenger));

    // ------------------------------------------ 11.4 mehrere Storys --
    console.log('\n11.4  Mehrere Storys hintereinander');
    const { data: roh } = await fremder.client
      .from('stories')
      .select('id, user_id, media_url, media_type, caption, created_at, in_videos, in_messenger, overlays')
      .eq('user_id', eigner.id)
      .gt('expires_at', new Date().toISOString());
    const listen = StoryRegeln.listenBilden({
      roh: roh || [],
      ichId: fremder.id,
      kontakte: new Set([eigner.id]),
      gefolgte: new Set(),
    });
    const vonEigner = StoryRegeln.vonPerson(listen.messenger, eigner.id).filter((s) => storys.includes(s.id));
    pruefe('Beide Prüfstorys stehen im Messenger des Kontakts — die zweite verdrängt die erste nicht',
      vonEigner.length === 1 && listen.videosAlle.some((s) => s.id === nurVideos),
      `${vonEigner.length} im Messenger, Videos: ${listen.videosAlle.filter((s) => storys.includes(s.id)).length}`);
    const zweite = await anlegen({ in_messenger: true, in_videos: false });
    const { data: roh2 } = await fremder.client
      .from('stories').select('id, user_id, created_at, in_videos, in_messenger, overlays').eq('user_id', eigner.id)
      .gt('expires_at', new Date().toISOString());
    const liste2 = StoryRegeln.listenBilden({ roh: roh2 || [], ichId: fremder.id, kontakte: new Set([eigner.id]) }).messenger;
    const reihe = StoryRegeln.vonPerson(liste2, eigner.id).map((s) => s.id).filter((id) => storys.includes(id));
    pruefe('Zwei Messenger-Storys derselben Person: beide da, älteste zuerst',
      reihe.length === 2 && reihe[0] === nurMessenger && reihe[1] === zweite, reihe.join(', '));
    const ring = StoryRegeln.ringFuer(liste2, eigner.id);
    pruefe('Ein Ring für die Person, er zählt alle Storys', ring.status === 'neu' && ring.anzahl >= 2,
      JSON.stringify(ring));

    // ------------------------------------------------ 11.6 Bearbeitung --
    console.log('\n11.6  Bearbeitung als Daten');
    const overlays = StoryRegeln.overlaysPruefen({
      filter: 'warm',
      texte: [{ text: 'Prüftext', schrift: 'hand', farbe: '#FFCC00', hintergrund: true, groesse: 32, x: 0.3, y: 0.2 }],
      markiert: [],
    });
    const mitText = await anlegen({ in_messenger: false, in_videos: true, overlays });
    const { data: zurueck } = await fremder.client.from('stories').select('overlays').eq('id', mitText).single();
    const gelesen = StoryRegeln.overlaysPruefen(zurueck && zurueck.overlays);
    pruefe('Text, Schrift, Farbe und Filter kommen beim anderen Konto unverändert an',
      gelesen.filter === 'warm' && gelesen.texte.length === 1 && gelesen.texte[0].schrift === 'hand'
        && gelesen.texte[0].farbe.toUpperCase() === '#FFCC00' && gelesen.texte[0].hintergrund === true,
      JSON.stringify(gelesen));
    const unsinn = StoryRegeln.overlaysPruefen({ filter: 'gibtsnicht', texte: [{ text: 'x', groesse: 900, x: 7 }] });
    pruefe('Unsinnige Werte werden auf die Grenzen gezogen',
      unsinn.filter === 'keiner' && unsinn.texte[0].groesse <= 64 && unsinn.texte[0].x <= 0.95, JSON.stringify(unsinn));

    // ------------------------------------------------ 11.6 Markieren --
    console.log('\n11.6  Personen markieren');
    const { data: markVorher } = await fremder.client
      .from('visibility_settings').select('stufe').eq('user_id', fremder.id).eq('bereich', 'markierung').maybeSingle();
    wegRaeumen.push(() => markVorher
      ? fremder.client.from('visibility_settings').update({ stufe: markVorher.stufe }).eq('user_id', fremder.id).eq('bereich', 'markierung')
      : fremder.client.from('visibility_settings').delete().eq('user_id', fremder.id).eq('bereich', 'markierung'));

    // a) Wer niemanden markieren lässt, steht nicht in der Liste und lässt sich nicht markieren.
    await fremder.client.from('visibility_settings')
      .upsert({ user_id: fremder.id, bereich: 'markierung', stufe: 'niemand' }, { onConflict: 'user_id,bereich' });
    const { data: listeNiemand, error: fListe } = await eigner.client.rpc('story_markierbar', { suche: 'prueflauf' });
    if (fListe) throw fListe;
    pruefe('„Niemand darf mich markieren": nicht in der Auswahlliste',
      !(listeNiemand || []).some((p) => p.id === fremder.id), `${(listeNiemand || []).length} Treffer`);
    const { error: fVerboten } = await eigner.client.from('story_tags').insert({ story_id: nurMessenger, user_id: fremder.id });
    const { data: tagVerboten } = await eigner.client.from('story_tags').select('user_id').eq('story_id', nurMessenger);
    pruefe('… und die Datenbank lehnt die Markierung ab', Boolean(fVerboten) && !(tagVerboten || []).length,
      fVerboten ? fVerboten.message : 'Markierung gesetzt');

    // b) Mit Erlaubnis: in der Liste, markierbar, Mitteilung kommt an.
    await fremder.client.from('visibility_settings')
      .upsert({ user_id: fremder.id, bereich: 'markierung', stufe: 'alle' }, { onConflict: 'user_id,bereich' });
    const { data: listeAlle } = await eigner.client.rpc('story_markierbar', { suche: 'prueflauf' });
    pruefe('„Alle dürfen mich markieren": in der Auswahlliste', (listeAlle || []).some((p) => p.id === fremder.id),
      `${(listeAlle || []).length} Treffer`);
    const { data: listeSelbst } = await eigner.client.rpc('story_markierbar', { suche: null });
    pruefe('Sich selbst bietet die Liste nicht an', !(listeSelbst || []).some((p) => p.id === eigner.id));

    // Kontakt wieder weg: markiert sieht die Messenger-Story trotzdem.
    await fremder.client.from('contacts').delete().eq('user_id', fremder.id).eq('contact_id', eigner.id);
    const seit = jetzt();
    const { error: fTag } = await eigner.client.from('story_tags').insert({ story_id: zweite, user_id: fremder.id });
    pruefe('Markierung lässt sich setzen', !fTag, fTag ? fTag.message : '');
    const { error: fFremdTag } = await fremder.client.from('story_tags').insert({ story_id: mitText, user_id: fremder.id });
    pruefe('In einer fremden Story kann man niemanden markieren', Boolean(fFremdTag),
      fFremdTag ? fFremdTag.message : 'ging durch');
    pruefe('Die markierte Person liest die Story auch ohne Kontakt', await lesbar(fremder, zweite));
    pruefe('Die andere Messenger-Story bleibt für sie unsichtbar', !(await lesbar(fremder, nurMessenger)));

    const { data: post } = await fremder.client
      .from('notifications')
      .select('art, actor_id, target_type, target_id')
      .eq('art', 'mention')
      .eq('target_type', 'story')
      .gt('created_at', seit);
    const angekommen = (post || []).find((n) => n.target_id === zweite && n.actor_id === eigner.id);
    pruefe('Die markierte Person bekommt die Mitteilung (mention → story)', Boolean(angekommen),
      JSON.stringify(post));

    const { data: tagsFremd } = await fremder.client.from('story_tags').select('story_id').eq('story_id', zweite);
    pruefe('Die markierte Person sieht ihre eigene Markierung', (tagsFremd || []).length === 1);
    await fremder.client.from('notifications').delete().eq('target_id', zweite);
  } finally {
    // --------------------------------------------------- aufräumen --
    for (const id of storys) await eigner.client.from('stories').delete().eq('id', id);
    const { data: rest } = await eigner.client.from('stories').select('id').in('id', storys.length ? storys : ['00000000-0000-0000-0000-000000000000']);
    pruefe('Alle Prüfstorys sind hinterher weg', (rest || []).length === 0, `${(rest || []).length} geblieben`);
    for (const schritt of wegRaeumen) {
      try { await schritt(); } catch (e) { console.warn('  Aufräumen: ' + (e?.message ?? e)); }
    }
  }

  console.log(
    fehler === 0
      ? `\nStorys: ${geprueft} Prüfungen bestanden.`
      : `\n${fehler} von ${geprueft} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
