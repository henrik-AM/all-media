/**
 * Werden Sichtungen mitgeschrieben — und zwar nur die echten?
 *
 * WARUM ES DAS GIBT
 *
 * `post_impressions` ist die Voraussetzung des Feed-Rankings
 * (SUPABASE_SCHEMA_28_impressionen.sql). Sie ist die erste Tabelle, deren
 * Wert nicht davon abhaengt, ob heute etwas funktioniert, sondern davon, ob
 * sie ueber Wochen richtig gefuellt wurde. Ein stiller Fehler hier faellt
 * erst auf, wenn das Ranking gebaut wird — und dann sind die Daten weg.
 *
 * WAS GEPRUEFT WIRD
 *
 * Nicht nur "es kommt etwas an". Sondern auch, dass die drei Zusagen der
 * Tabelle halten:
 *
 *   1. Niemand kann Sichtungen unter fremdem Namen erfinden. Der Betrachter
 *      kommt aus `auth.uid()`, nicht aus einem Parameter (Fund 11).
 *   2. Es gibt keine zweite Tuer: ein direktes INSERT wird abgewiesen —
 *      sonst koennte sich jeder beliebige Dauern ausdenken.
 *   3. Zweimal dasselbe gesehen ergibt EINE Zeile mit addierter Dauer, nicht
 *      zwei. Sonst waere der Bestand nach einem Monat unbrauchbar.
 *
 * NACHGEZAEHLT WIRD IMMER
 *
 * Ein von RLS abgelehntes INSERT meldet keinen Fehler, es schreibt nur
 * nichts. Nach jedem abgewiesenen Versuch wird deshalb nachgesehen, ob
 * wirklich nichts dasteht.
 *
 * Start:  node test/_impressionen.js
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

const TESTKONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const ZWEITKONTO = {
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

/** Die eigene Zeile zu einem Beitrag, oder null. */
async function zeile(konto, beitragId, herkunft = 'feed') {
  const { data } = await konto.client
    .from('post_impressions')
    .select('dauer_ms, sichtungen, quelle, user_id')
    .eq('post_id', beitragId)
    .eq('user_id', konto.id)
    .eq('quelle', herkunft)
    .maybeSingle();
  return data ?? null;
}

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  const ich = await anmelden(TESTKONTO);
  const anderer = await anmelden(ZWEITKONTO);

  // Irgendein vorhandener Beitrag. Bewusst ein fremder: die eigenen wuerden
  // beim Zuruecksetzen ohnehin mitgehen, fremde nicht — und genau die sind
  // der Fall, um den es geht.
  const { data: beitraege } = await ich.client.from('posts').select('id').limit(1);
  const beitrag = beitraege?.[0]?.id;
  if (!beitrag) {
    console.error('FEHLER  Kein Beitrag im Bestand, an dem sich messen liesse.');
    process.exit(1);
  }

  // Aufraeumen, was ein frueherer Lauf heute schon geschrieben haben koennte:
  // sonst misst der Vergleich unten gegen einen Wert von vorhin.
  await ich.client.from('post_impressions').delete().eq('post_id', beitrag).eq('user_id', ich.id);
  await anderer.client
    .from('post_impressions')
    .delete()
    .eq('post_id', beitrag)
    .eq('user_id', anderer.id);

  try {
    console.log('\nMitschreiben');

    await ich.client.rpc('impression_vermerken', {
      beitrag,
      dauer: 4000,
      herkunft: 'feed',
    });
    const erste = await zeile(ich, beitrag);
    pruefe('Eine Sichtung landet in der Tabelle', erste !== null);
    pruefe('Mit der gemessenen Dauer', erste?.dauer_ms === 4000, `${erste?.dauer_ms} ms`);
    pruefe('Und als eine Sichtung gezaehlt', erste?.sichtungen === 1);

    await ich.client.rpc('impression_vermerken', { beitrag, dauer: 2500, herkunft: 'feed' });
    const zweite = await zeile(ich, beitrag);
    const { count: zeilen } = await ich.client
      .from('post_impressions')
      .select('id', { count: 'exact', head: true })
      .eq('post_id', beitrag)
      .eq('user_id', ich.id)
      .eq('quelle', 'feed');
    pruefe('Dieselbe Person, derselbe Tag: weiterhin eine Zeile', zeilen === 1, `${zeilen}`);
    pruefe('Die Dauer wird addiert', zweite?.dauer_ms === 6500, `${zweite?.dauer_ms} ms`);
    pruefe('Die Anzahl geht hoch', zweite?.sichtungen === 2);

    await ich.client.rpc('impression_vermerken', { beitrag, dauer: 1000, herkunft: 'reels' });
    const reels = await zeile(ich, beitrag, 'reels');
    pruefe('Eine andere Herkunft ist eine eigene Zeile', reels?.dauer_ms === 1000);

    console.log('\nWas nicht durchgehen darf');

    const { error: krumm } = await ich.client.rpc('impression_vermerken', {
      beitrag,
      dauer: 1000,
      herkunft: 'irgendwas',
    });
    pruefe('Eine erfundene Herkunft wird abgewiesen', Boolean(krumm), krumm?.message ?? 'kein Fehler');

    /*
     * Der Deckel. Wer die App mit offenem Feed in die Tasche steckt, haette
     * sonst eine Sichtung von vierzig Minuten — und dieser eine Beitrag
     * stuende im Ranking ueber allem, was Menschen wirklich angesehen haben.
     */
    const { data: zweiterBeitrag } = await ich.client
      .from('posts')
      .select('id')
      .neq('id', beitrag)
      .limit(1);
    const anderesStueck = zweiterBeitrag?.[0]?.id;
    if (anderesStueck) {
      await ich.client.from('post_impressions').delete()
        .eq('post_id', anderesStueck).eq('user_id', ich.id);
      await ich.client.rpc('impression_vermerken', {
        beitrag: anderesStueck,
        dauer: 99_000_000,
        herkunft: 'feed',
      });
      const gedeckelt = await zeile(ich, anderesStueck);
      pruefe('Eine absurd lange Sichtung wird gekappt', gedeckelt?.dauer_ms === 300000,
        `${gedeckelt?.dauer_ms} ms`);
      await ich.client.from('post_impressions').delete()
        .eq('post_id', anderesStueck).eq('user_id', ich.id);
    }

    /*
     * Die zweite Tuer. Ein direktes INSERT wuerde Dauer und Anzahl frei
     * setzbar machen — damit liesse sich das spaetere Ranking faerben.
     * Abgelehnt wird es unter RLS unter Umstaenden ohne Fehlermeldung,
     * deshalb wird danach nachgezaehlt.
     */
    const { error: direkt } = await ich.client.from('post_impressions').insert({
      post_id: beitrag,
      user_id: ich.id,
      dauer_ms: 999999,
      quelle: 'explorer',
    });
    const geschmuggelt = await zeile(ich, beitrag, 'explorer');
    pruefe('Ein direktes INSERT kommt nicht durch',
      geschmuggelt === null, direkt?.message ?? 'kein Fehler, aber auch keine Zeile');

    // Und dasselbe unter fremdem Namen — der Fall aus Fund 11.
    const { error: fremd } = await anderer.client.from('post_impressions').insert({
      post_id: beitrag,
      user_id: ich.id,
      dauer_ms: 500000,
      quelle: 'feed',
    });
    const nachFremd = await zeile(ich, beitrag);
    pruefe('Niemand schreibt Sichtungen unter fremdem Namen',
      nachFremd?.dauer_ms === 6500, fremd?.message ?? `${nachFremd?.dauer_ms} ms`);

    console.log('\nWer was sieht');

    await anderer.client.rpc('impression_vermerken', { beitrag, dauer: 3000, herkunft: 'feed' });
    const { data: fremdeSicht } = await anderer.client
      .from('post_impressions')
      .select('user_id')
      .eq('post_id', beitrag);
    pruefe('Jeder sieht nur seine eigenen Sichtungen',
      (fremdeSicht ?? []).every((z) => z.user_id === anderer.id),
      `${(fremdeSicht ?? []).length} Zeile(n)`);

    console.log('\nGebuendelt');

    await ich.client.from('post_impressions').delete()
      .eq('post_id', beitrag).eq('user_id', ich.id);
    const { data: gezaehlt, error: buendelFehler } = await ich.client.rpc(
      'impressionen_vermerken',
      { eintraege: [
        { beitrag, dauer: 1200, herkunft: 'feed' },
        { beitrag: '00000000-0000-0000-0000-000000000000', dauer: 1200, herkunft: 'feed' },
      ] }
    );
    pruefe('Ein Buendel wird angenommen', !buendelFehler, buendelFehler?.message ?? '');
    pruefe('Ein unbrauchbarer Eintrag reisst den Rest nicht mit',
      Number(gezaehlt) === 1, `${gezaehlt} von 2 vermerkt`);
    const nachBuendel = await zeile(ich, beitrag);
    pruefe('Der brauchbare Eintrag steht in der Tabelle', nachBuendel?.dauer_ms === 1200);

    console.log('\nOhne Anmeldung');

    const anonym = createClient(URL, KEY);
    const { error: ohne } = await anonym.rpc('impression_vermerken', {
      beitrag,
      dauer: 1000,
      herkunft: 'feed',
    });
    pruefe('Ohne Anmeldung geht gar nichts', Boolean(ohne), ohne?.message ?? 'kein Fehler');
  } finally {
    // Der Lauf raeumt hinter sich auf — beide Konten, alle Herkuenfte.
    const { error: weg } = await ich.client
      .from('post_impressions')
      .delete()
      .eq('user_id', ich.id)
      .eq('post_id', beitrag);
    await anderer.client
      .from('post_impressions')
      .delete()
      .eq('user_id', anderer.id)
      .eq('post_id', beitrag);

    // Gegenprobe zum Aufraeumen selbst: ein von RLS abgelehntes DELETE
    // meldet keinen Fehler, es loescht nur nichts.
    const rest = await zeile(ich, beitrag);
    const restReels = await zeile(ich, beitrag, 'reels');
    const sauber = rest === null && restReels === null;
    pruefe('Der Lauf laesst nichts zurueck', sauber,
      sauber ? '' : weg?.message ?? 'es stehen noch Zeilen da');
  }

  console.log(
    fehler === 0
      ? '\nSichtungen werden mitgeschrieben — und nur die echten.'
      : `\n${fehler} Prüfung(en) fehlgeschlagen.`
  );
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
