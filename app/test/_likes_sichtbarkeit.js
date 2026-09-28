/**
 * Likes-Sichtbarkeit mit zwei Konten: wirkt die Einstellung wirklich?
 *
 * WARUM ES DAS GIBT
 *
 * Feedback 21.09.2026, Kasten 9: „Likes-Sichtbarkeit prüfen: Die Einstellung
 * existiert — funktioniert sie wirklich?“ Sie funktionierte nicht. Die
 * Oberflächen blendeten den Namen zwar aus, aber die Tabelle post_likes war
 * für jedes angemeldete Konto lesbar (`using (true)` seit SUPABASE_SCHEMA.sql).
 * Schema 65 schließt sie über like_sichtbar(). Dieser Lauf prüft das aus der
 * zweiten Perspektive, sonst bleibt es wieder bei „gespeichert, aber nicht
 * wirksam“.
 *
 * WAS GEPRÜFT WIRD — in BEIDE Richtungen (Testkonto liked, Prüfkonto schaut,
 * und umgekehrt), jeweils an einem Beitrag, der KEINEM der beiden gehört.
 * Der Besitzer sieht seit Schema 65 jedes Like auf seinem Beitrag (wie bei
 * Instagram); ein eigener Beitrag würde hier also nichts beweisen.
 *
 *   9.4  Ohne Folgen: kein Name unter dem Beitrag, auch bei „Alle“.
 *   9.1/9.2  Mit Folgen, alle vier Stufen samt Ausnahmeliste:
 *        - die Zeile in post_likes ist für den Betrachter lesbar oder nicht
 *          (das ist die eigentliche Sperre, nicht die Anzeige),
 *        - liker_namen() nennt den Namen oder nicht (9.3),
 *        - like_zahlen() bleibt bei jeder Stufe gleich.
 *
 * Meldet sich nur per Passwort an, ruft KEIN /api/reset. Alles, was der Lauf
 * setzt (Likes, Folgen, Einstellungen, Ausnahmen), stellt er am Ende auf den
 * Stand von vorher zurück und sieht nach, ob das Löschen wirklich gegriffen
 * hat — ein abgelehntes DELETE meldet unter RLS keinen Fehler.
 *
 * Voraussetzung: SUPABASE_SCHEMA_65_likes_sichtbarkeit.sql ist eingespielt.
 *
 * Start:  node test/_likes_sichtbarkeit.js   (npm run test:likes)
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

const TESTKONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!', rufname: 'Testkonto' };
const PRUEFKONTO = {
  email: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  passwort: process.env.AM_TEST_PASS || 'PruefLauf2026!',
  rufname: 'Prüfkonto',
};

let fehler = 0;
let pruefungen = 0;
const pruefe = (name, wahr, zusatz = '') => {
  pruefungen++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function anmelden(zugang) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: zugang.email,
    password: zugang.passwort,
  });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id, rufname: zugang.rufname };
}

// Jeder Aufruf mit Zeitgrenze — ein haengender Lauf sieht sonst aus wie ein
// langsamer (feedback_pruefläufe_haengen).
const mitFrist = (versprechen, was, ms = 20000) =>
  Promise.race([
    versprechen,
    new Promise((_, nein) => setTimeout(() => nein(new Error(`Zeitgrenze: ${was}`)), ms)),
  ]);

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  const a = await mitFrist(anmelden(TESTKONTO), 'Anmeldung Testkonto');
  const b = await mitFrist(anmelden(PRUEFKONTO), 'Anmeldung Pruefkonto');

  // --- Beitrag eines Dritten, den beide lesen koennen ----------------------
  const { data: kandidaten, error: kErr } = await mitFrist(
    a.client
      .from('posts')
      .select('id, user_id')
      .neq('user_id', a.id)
      .neq('user_id', b.id)
      .order('created_at', { ascending: false })
      .limit(30),
    'Beitraege lesen'
  );
  if (kErr) throw kErr;

  let beitrag = null;
  for (const k of kandidaten || []) {
    const { data } = await b.client.from('posts').select('id').eq('id', k.id).maybeSingle();
    if (data) { beitrag = k; break; }
  }
  if (!beitrag) {
    console.error('FEHLER  Kein Beitrag eines Dritten, den beide Konten lesen koennen. Ohne ihn prueft der Lauf nichts.');
    process.exit(1);
  }
  console.log(`Beitrag ${beitrag.id} (gehoert ${beitrag.user_id}, keinem der beiden Konten)`);

  // --- Stand vorher merken --------------------------------------------------
  const vorher = {};
  for (const k of [a, b]) {
    const { data: like } = await k.client
      .from('post_likes').select('post_id').eq('post_id', beitrag.id).eq('user_id', k.id);
    const { data: einst } = await k.client
      .from('visibility_settings').select('stufe').eq('user_id', k.id).eq('bereich', 'likes').maybeSingle();
    const { data: ausn } = await k.client
      .from('visibility_exceptions').select('target_id').eq('user_id', k.id).eq('bereich', 'likes');
    vorher[k.id] = {
      like: (like || []).length > 0,
      stufe: einst?.stufe ?? null,
      ausnahmen: (ausn || []).map((x) => x.target_id),
    };
  }
  const folgtVorher = async (von, zu) => {
    const { data } = await von.client
      .from('follows').select('followee_id').eq('follower_id', von.id).eq('followee_id', zu.id);
    return (data || []).length > 0;
  };
  const folgen = { ab: await folgtVorher(a, b), ba: await folgtVorher(b, a) };

  // --- Werkzeuge -------------------------------------------------------------
  const stufe = async (k, wert) => {
    const { error } = await k.client
      .from('visibility_settings')
      .upsert({ user_id: k.id, bereich: 'likes', stufe: wert }, { onConflict: 'user_id,bereich' });
    if (error) throw error;
  };
  const ausnahmenLeeren = async (k) => {
    await k.client.from('visibility_exceptions').delete().eq('user_id', k.id).eq('bereich', 'likes');
  };
  const ausnahme = async (k, zielId) => {
    const { error } = await k.client
      .from('visibility_exceptions')
      .upsert({ user_id: k.id, bereich: 'likes', target_id: zielId });
    if (error) throw error;
  };
  const setzeFolgen = async (von, zu, an) => {
    if (an) {
      const { error } = await von.client
        .from('follows').upsert({ follower_id: von.id, followee_id: zu.id });
      if (error) throw error;
    } else {
      await von.client.from('follows').delete().eq('follower_id', von.id).eq('followee_id', zu.id);
    }
  };
  // Das Like frisch setzen, damit es das juengste ist — liker_namen nennt
  // die juengste passende Person.
  const likeFrisch = async (k) => {
    await k.client.from('post_likes').delete().eq('post_id', beitrag.id).eq('user_id', k.id);
    const { error } = await k.client
      .from('post_likes').insert({ post_id: beitrag.id, user_id: k.id });
    if (error) throw error;
  };

  /** Sieht `wer` die Zeile von `liker` direkt in der Tabelle? */
  const zeileSichtbar = async (wer, liker) => {
    const { data, error } = await wer.client
      .from('post_likes').select('user_id').eq('post_id', beitrag.id).eq('user_id', liker.id);
    if (error) throw error;
    return (data || []).length > 0;
  };
  /** Name unter dem Beitrag, wie ihn `wer` bekommt. */
  const name = async (wer) => {
    const { data, error } = await wer.client
      .rpc('liker_namen', { beitraege: [beitrag.id], wer: wer.id });
    if (error) throw error;
    return (data || [])[0]?.name ?? null;
  };
  /** Zahl der Likes, wie `wer` sie bekommt. */
  const zahl = async (wer) => {
    const { data, error } = await wer.client.rpc('like_zahlen', { beitraege: [beitrag.id] });
    if (error) throw error;
    return Number((data || [])[0]?.anzahl ?? -1);
  };
  const profilName = async (wer, k) => {
    const { data } = await wer.client.from('profiles').select('name').eq('id', k.id).maybeSingle();
    return data?.name ?? null;
  };

  try {
    for (const [liker, betrachter] of [[a, b], [b, a]]) {
      console.log(`\n${liker.rufname} liked, ${betrachter.rufname} schaut`);

      const likerName = await profilName(betrachter, liker);
      pruefe('Der Name des Likenden ist lesbar', Boolean(likerName), likerName || 'kein Name');

      await ausnahmenLeeren(liker);
      await likeFrisch(liker);

      // 9.4 — ohne Folgen kein Name, auch bei „Alle“.
      await setzeFolgen(betrachter, liker, false);
      await stufe(liker, 'alle');
      const nOhne = await name(betrachter);
      pruefe('Ohne Folgen steht der Name nicht unter dem Beitrag (9.4)',
        nOhne !== likerName, nOhne || 'kein Name');
      pruefe('Bei „Alle“ ist das Like in der Tabelle trotzdem lesbar',
        await zeileSichtbar(betrachter, liker));

      await setzeFolgen(betrachter, liker, true);
      const basis = await zahl(betrachter);
      pruefe('like_zahlen liefert eine Zahl', basis > 0, String(basis));

      /*
       * Jede Stufe: [Stufe, betrachter in der Ausnahmeliste?, erwartet sichtbar]
       */
      const faelle = [
        ['alle', false, true],
        ['niemand', false, false],
        ['niemand_bis_auf', false, false],
        ['niemand_bis_auf', true, true],
        ['alle_bis_auf', true, false],
        ['alle_bis_auf', false, true],
      ];
      for (const [st, gelistet, erwartet] of faelle) {
        await ausnahmenLeeren(liker);
        if (gelistet) await ausnahme(liker, betrachter.id);
        await stufe(liker, st);
        const etikett = `„${st}“${gelistet ? ' mit Betrachter auf der Liste' : ''}`;

        const zeile = await zeileSichtbar(betrachter, liker);
        pruefe(`${etikett}: Zeile in post_likes ${erwartet ? 'lesbar' : 'gesperrt'} (9.2)`,
          zeile === erwartet, zeile ? 'lesbar' : 'gesperrt');

        const n = await name(betrachter);
        pruefe(`${etikett}: Name ${erwartet ? 'steht da' : 'fehlt'} (9.3)`,
          erwartet ? n === likerName : n !== likerName, n || 'kein Name');

        const z = await zahl(betrachter);
        pruefe(`${etikett}: Zahl bleibt ${basis}`, z === basis, String(z));
      }

      // Das eigene Like sieht der Likende immer, auch bei „Niemand“.
      await ausnahmenLeeren(liker);
      await stufe(liker, 'niemand');
      pruefe('Der Likende sieht sein eigenes Like bei „Niemand“',
        await zeileSichtbar(liker, liker));
    }
  } finally {
    console.log('\nAufraeumen');
    for (const k of [a, b]) {
      const v = vorher[k.id];
      await ausnahmenLeeren(k);
      for (const z of v.ausnahmen) await ausnahme(k, z).catch(() => {});
      if (v.stufe) await stufe(k, v.stufe).catch(() => {});
      else await k.client.from('visibility_settings').delete().eq('user_id', k.id).eq('bereich', 'likes');

      await k.client.from('post_likes').delete().eq('post_id', beitrag.id).eq('user_id', k.id);
      if (v.like) await k.client.from('post_likes').insert({ post_id: beitrag.id, user_id: k.id });
    }
    await setzeFolgen(a, b, folgen.ab).catch(() => {});
    await setzeFolgen(b, a, folgen.ba).catch(() => {});

    // Gegenpruefen statt der Erfolgsmeldung glauben.
    for (const k of [a, b]) {
      const v = vorher[k.id];
      const { data: s } = await k.client
        .from('visibility_settings').select('stufe').eq('user_id', k.id).eq('bereich', 'likes').maybeSingle();
      const { data: l } = await k.client
        .from('post_likes').select('post_id').eq('post_id', beitrag.id).eq('user_id', k.id);
      const { data: e } = await k.client
        .from('visibility_exceptions').select('target_id').eq('user_id', k.id).eq('bereich', 'likes');
      pruefe(`${k.rufname}: Einstellung wie vorher`, (s?.stufe ?? null) === v.stufe, String(s?.stufe ?? 'keine'));
      pruefe(`${k.rufname}: Like wie vorher`, (l || []).length > 0 === v.like);
      pruefe(`${k.rufname}: Ausnahmeliste wie vorher`, (e || []).length === v.ausnahmen.length);
    }
    pruefe('Folgen Testkonto → Pruefkonto wie vorher', (await folgtVorher(a, b)) === folgen.ab);
    pruefe('Folgen Pruefkonto → Testkonto wie vorher', (await folgtVorher(b, a)) === folgen.ba);
  }

  console.log(`\n${pruefungen - fehler}/${pruefungen} Pruefungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER ', e.message || e);
  process.exit(1);
});
