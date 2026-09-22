/**
 * Rankt der Feed — und rankt er nach dem, wonach er ranken soll?
 *
 * WARUM ES DAS GIBT
 *
 * Ein Ranking ist die Art von Funktion, die immer irgendetwas zurueckgibt.
 * Sie kann jede einzelne Zahl falsch rechnen und trotzdem eine plausible
 * Liste liefern — niemand sieht einem Feed an, dass die Verweildauer mit
 * dem falschen Vorzeichen eingeht. „Es kommt eine Reihenfolge heraus" ist
 * deshalb keine Pruefung.
 *
 * Geprueft wird stattdessen die WIRKUNG jedes einzelnen Bausteins: etwas
 * am Bestand aendern, neu ranken, nachsehen, ob sich genau der erwartete
 * Wert bewegt hat und die Punktzahl in die erwartete Richtung.
 *
 * WAS GEPRUEFT WIRD
 *
 *   1. Die Funktion bewertet nur, was ihr gereicht wird. Sie sucht sich
 *      keine Beitraege selbst — das ist die Sicherheitszusage von Schema
 *      51, die verhindert, dass sie an der Sichtbarkeitspruefung vorbei
 *      Kennungen herausgibt.
 *   2. Verweildauer bewegt das Ranking. Das staerkste Signal muss auch das
 *      staerkste sein.
 *   3. Wer etwas schon gesehen hat, sieht es weiter unten (Ermuedung).
 *   4. Das Interessenbild bildet ab, womit jemand umgegangen ist.
 *   5. `gemeinsam/rang.js` faechert die Verfasser auf — App und Website
 *      benutzen dieselbe Datei, geprueft wird sie hier.
 *   6. Anonyme duerfen weder ranken noch das Interessenbild lesen.
 *
 * DER BESTAND WIRD HINTERHER AUFGERAEUMT
 *
 * Der Lauf schreibt Sichtungen, um ihre Wirkung zu messen. Die muessen
 * wieder weg, sonst misst der naechste Lauf gegen die Spuren von diesem —
 * und das Interessenbild des Testkontos waere nach zehn Laeufen von den
 * Laeufen gepraegt statt vom Testbestand.
 *
 * Start:  node test/_rang.js
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Rang = require('../../gemeinsam/rang');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const TESTKONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };

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

/** Rang holen und als Map von Kennung auf die ganze Zeile zurueckgeben. */
async function rangKarte(konto, ids, herkunft = 'feed') {
  const { data, error } = await konto.client.rpc('feed_rang', {
    beitraege: ids,
    herkunft,
  });
  if (error) throw new Error('feed_rang: ' + error.message);
  const karte = new Map();
  for (const z of data || []) karte.set(z.post_id, z);
  return karte;
}

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  const ich = await anmelden(TESTKONTO);

  // Fremde Beitraege: die eigenen wuerden beim Zuruecksetzen mitgehen, und
  // ein eigener Beitrag bekommt per Definition keine Naehe.
  const { data: beitraege } = await ich.client
    .from('posts')
    .select('id, user_id, tags, created_at')
    .neq('user_id', ich.id)
    .order('created_at', { ascending: false })
    .limit(30);

  if (!beitraege || beitraege.length < 3) {
    console.error(
      `FEHLER  Nur ${beitraege ? beitraege.length : 0} fremde Beitraege im Bestand — ` +
        'zu wenig, um eine Reihenfolge zu messen. Erst `npm run test:datenbank`.'
    );
    process.exit(1);
  }

  const ids = beitraege.map((b) => b.id);
  const aufraeumen = [];

  try {
    // ------------------------------------------------------------------
    console.log('\nDie Funktion antwortet');

    const erste = await rangKarte(ich, ids);
    pruefe('Jeder uebergebene Beitrag bekommt eine Zeile', erste.size === ids.length,
      `${erste.size} von ${ids.length}`);

    const zeile = erste.get(ids[0]);
    pruefe('Mit einer Punktzahl', typeof zeile?.punkte === 'number' && !Number.isNaN(zeile.punkte),
      String(zeile?.punkte));
    pruefe('Und mit den Bausteinen einzeln',
      ['frische', 'verweilwert', 'resonanz', 'naehe', 'interesse', 'ermuedung']
        .every((s) => typeof zeile?.[s] === 'number'));
    pruefe('Punkte sind nicht alle gleich',
      new Set([...erste.values()].map((z) => z.punkte)).size > 1,
      `${new Set([...erste.values()].map((z) => z.punkte)).size} verschiedene Werte`);

    // ------------------------------------------------------------------
    console.log('\nBewertet wird nur, was gereicht wird');

    const zwei = ids.slice(0, 2);
    const knapp = await rangKarte(ich, zwei);
    pruefe('Zwei Kennungen hinein, zwei Zeilen heraus', knapp.size === 2, `${knapp.size}`);
    pruefe('Kein dritter Beitrag mogelt sich dazu',
      [...knapp.keys()].every((id) => zwei.includes(id)));

    const { data: leerLauf } = await ich.client.rpc('feed_rang', { beitraege: [], herkunft: 'feed' });
    pruefe('Nichts hinein, nichts heraus', (leerLauf || []).length === 0,
      `${(leerLauf || []).length} Zeilen`);

    // ------------------------------------------------------------------
    console.log('\nVerweildauer bewegt das Ranking');

    // Ein Beitrag, bei dem lange stehengeblieben wurde. Bewusst der, der
    // vorher NICHT vorne stand — sonst waere nicht zu unterscheiden, ob
    // sich etwas bewegt hat oder ob er ohnehin oben lag.
    const nachPunkten = [...erste.values()].sort((a, b) => b.punkte - a.punkte);
    const hinterer = nachPunkten[nachPunkten.length - 1].post_id;
    const vorherWert = erste.get(hinterer);

    // Aufraeumen, was ein frueherer Lauf heute schon geschrieben hat.
    await ich.client.from('post_impressions').delete().eq('user_id', ich.id).in('post_id', ids);
    aufraeumen.push(...ids);

    // Vier Minuten in einer Sichtung — weit ueber den acht Sekunden, an
    // denen der Verweilwert gemessen wird, und unter dem Deckel von fuenf.
    await ich.client.rpc('impression_vermerken', {
      beitrag: hinterer,
      dauer: 240000,
      herkunft: 'feed',
    });

    const danach = await rangKarte(ich, ids);
    const nachherWert = danach.get(hinterer);

    pruefe('Der Verweilwert steigt',
      nachherWert.verweilwert > vorherWert.verweilwert,
      `${vorherWert.verweilwert} → ${nachherWert.verweilwert}`);
    pruefe('Und er ist gedeckelt, nicht ins Unendliche gewachsen',
      nachherWert.verweilwert <= 1.5, String(nachherWert.verweilwert));

    // ------------------------------------------------------------------
    console.log('\nSchon Gesehenes rutscht nach unten');

    // Dieselbe Sichtung noch dreimal. Die Verweildauer bleibt gleich hoch
    // (es ist ein Durchschnitt), aber die Ermuedung greift.
    for (let i = 0; i < 3; i++) {
      await ich.client.rpc('impression_vermerken', {
        beitrag: hinterer,
        dauer: 240000,
        herkunft: 'feed',
      });
    }

    const muede = await rangKarte(ich, ids);
    const muedeWert = muede.get(hinterer);

    pruefe('Die Ermuedung faellt unter 1', muedeWert.ermuedung < 1,
      String(muedeWert.ermuedung));
    pruefe('Und drueckt die Punktzahl', muedeWert.punkte < nachherWert.punkte,
      `${nachherWert.punkte} → ${muedeWert.punkte}`);

    // Im Profil gilt sie nicht: dort will man genau diese Beitraege sehen.
    const imProfil = await rangKarte(ich, ids, 'profil');
    pruefe('Im Profil greift die Ermuedung nicht',
      imProfil.get(hinterer).ermuedung === 1, String(imProfil.get(hinterer).ermuedung));

    // ------------------------------------------------------------------
    console.log('\nDas Interessenbild');

    const { data: bild, error: bildFehler } = await ich.client.rpc('interessenbild', {
      wer: ich.id,
    });
    pruefe('Es laesst sich lesen', !bildFehler, bildFehler?.message || '');
    pruefe('Und ist nach Gewicht sortiert',
      (bild || []).every((z, i, a) => i === 0 || Number(a[i - 1].gewicht) >= Number(z.gewicht)));

    // Die Schlagworte des lange angesehenen Beitrags muessen darin stehen —
    // vier Minuten liegen weit ueber der Schwelle von acht Sekunden.
    const marken = new Set((bild || []).map((z) => z.marke));
    const erwartet = (beitraege.find((b) => b.id === hinterer)?.tags || [])
      .map((t) => String(t).toLowerCase())
      .filter(Boolean);
    if (erwartet.length === 0) {
      console.log('  ----  Der Beitrag hat keine Schlagworte, nichts zu erwarten');
    } else {
      pruefe('Lange Angesehenes faerbt das Interessenbild',
        erwartet.some((t) => marken.has(t)), erwartet.join(', '));
    }

    // ------------------------------------------------------------------
    console.log('\nDie gemeinsame Reihenfolge (gemeinsam/rang.js)');

    const karte = Rang.punktekarte([...muede.values()]);
    pruefe('Die Punktekarte hat je Beitrag einen Eintrag', karte.size === ids.length);

    const sortiert = Rang.sortieren(beitraege, karte);
    pruefe('Sortiert ist absteigend nach Punkten',
      sortiert.every((b, i, a) => i === 0 || karte.get(a[i - 1].id) >= karte.get(b.id)));
    pruefe('Und es geht kein Beitrag verloren', sortiert.length === beitraege.length);

    const geordnet = Rang.ordnen(beitraege, karte);
    let block = 0;
    for (let i = 1; i < geordnet.length; i++) {
      if (geordnet[i].user_id === geordnet[i - 1].user_id) block++;
    }
    // Ganz ohne Nachbarn geht nur, wenn genug Verfasser da sind — bei einem
    // Bestand aus zwei Personen ist ein Block unvermeidlich. Geprueft wird
    // deshalb gegen die unsortierte Ausgangslage, nicht gegen null.
    let blockVorher = 0;
    for (let i = 1; i < beitraege.length; i++) {
      if (beitraege[i].user_id === beitraege[i - 1].user_id) blockVorher++;
    }
    const verfasser = new Set(beitraege.map((b) => b.user_id)).size;
    pruefe('Auffaechern legt nicht mehr Gleiche nebeneinander als vorher',
      block <= blockVorher,
      `${blockVorher} vorher, ${block} nachher, ${verfasser} Verfasser`);

    pruefe('Ohne Punkte bleibt die Reihenfolge, wie sie war',
      Rang.ordnen(beitraege, new Map()).map((b) => b.id).join() === ids.join());

    /*
     * Und dasselbe noch einmal an einem Fall, dessen Ergebnis feststeht.
     *
     * Die Pruefung darueber vergleicht gegen den Bestand — und der kann so
     * aussehen, dass sie auch dann besteht, wenn das Auffaechern gar nichts
     * tut („1 vorher, 1 nachher" ist eben auch wahr, wenn nichts passiert).
     * Hier ist die Ausgangslage gebaut: drei Beitraege einer Person, die
     * ohne Auffaechern lueckenlos oben stuenden.
     */
    const gebaut = [
      { id: 'a1', user_id: 'A' }, { id: 'a2', user_id: 'A' }, { id: 'a3', user_id: 'A' },
      { id: 'b1', user_id: 'B' }, { id: 'c1', user_id: 'C' },
      { id: 'd1', user_id: 'D' }, { id: 'e1', user_id: 'E' },
    ];
    const gebautePunkte = new Map([
      ['a1', 9], ['a2', 8], ['a3', 7], ['b1', 6], ['c1', 5], ['d1', 4], ['e1', 3],
    ]);
    const gemischt = Rang.ordnen(gebaut, gebautePunkte);
    const folge = gemischt.map((b) => b.user_id).join('');

    pruefe('Drei Beitraege einer Person stehen nicht mehr am Stueck',
      !folge.includes('AA'), folge);
    pruefe('Der beste steht trotzdem vorn', gemischt[0].id === 'a1', gemischt[0].id);
    pruefe('Alle sieben sind noch da', gemischt.length === 7 &&
      new Set(gemischt.map((b) => b.id)).size === 7);
    pruefe('Ohne Auffaechern stuenden sie am Stueck',
      Rang.sortieren(gebaut, gebautePunkte).map((b) => b.user_id).join().startsWith('A,A,A'));

    /*
     * Und getrennt nach Art.
     *
     * Ein Foto, ein Reel und ein Clip sind derselbe Tabelleneintrag, aber
     * drei Bildschirme. Am 21.09.2026 stand auf der Website ein Foto mit
     * 9,19 Punkten vor einem mit 10,45 — weil ein Clip desselben
     * Verfassers dazwischen aufgefaechert worden war und das Foto damit
     * verschoben hatte. Innerhalb einer Art muss die Punktreihenfolge
     * halten, ausser das Auffaechern dieser Art greift ein.
     */
    const arten = [
      { id: 'p1', user_id: 'A', kind: 'post' },
      { id: 'r1', user_id: 'A', kind: 'reel' },
      { id: 'p2', user_id: 'B', kind: 'post' },
      { id: 'r2', user_id: 'A', kind: 'reel' },
      { id: 'p3', user_id: 'C', kind: 'post' },
    ];
    const artPunkte = new Map([['p1', 9], ['r1', 8], ['p2', 7], ['r2', 6], ['p3', 5]]);
    const jeArt = Rang.ordnenJeArt(arten, artPunkte, (b) => b.kind);
    const nurPosts = jeArt.filter((b) => b.kind === 'post').map((b) => b.id);

    pruefe('Je Art geordnet: die Fotos stehen nach Punkten',
      nurPosts.join() === 'p1,p2,p3', nurPosts.join());
    pruefe('Ein Reel dazwischen verschiebt die Fotos nicht mehr',
      nurPosts[0] === 'p1');
    pruefe('Und es geht auch hier nichts verloren',
      jeArt.length === arten.length && new Set(jeArt.map((b) => b.id)).size === arten.length);

    /*
     * Der Erprobungsplatz.
     *
     * Ein Beitrag ohne jedes Signal steht nach Punkten immer ganz hinten —
     * und kommt ohne reservierten Platz nie nach vorn. Geprueft wird an
     * einem Fall, in dem der Neuling die kleinste Punktzahl von allen hat:
     * er muss trotzdem auf Platz 4 stehen (jeder vierte Platz, von null
     * gezaehlt), und ohne Neulingsliste eben nicht.
     */
    const zwoelf = Array.from({ length: 12 }, (_, i) => ({
      id: 'z' + i,
      user_id: 'U' + i,   // Jeder ein eigener Verfasser: das Auffaechern
      kind: 'post',       // soll hier nichts verschieben.
    }));
    const zwoelfPunkte = new Map(zwoelf.map((b, i) => [b.id, 100 - i]));
    const neuling = 'z11';  // Der mit der kleinsten Punktzahl.

    const ohne = Rang.ordnen(zwoelf, zwoelfPunkte).map((b) => b.id);
    const mit = Rang.ordnen(zwoelf, zwoelfPunkte, { neulinge: new Set([neuling]) })
      .map((b) => b.id);

    pruefe('Ohne Erprobung steht der Neuling ganz hinten',
      ohne[ohne.length - 1] === neuling, ohne.join(' '));
    pruefe('Mit Erprobung steht er auf Platz 4', mit[4] === neuling, mit.join(' '));
    pruefe('Der Beste steht trotzdem weiter vorn', mit[0] === 'z0');
    pruefe('Und es geht keiner verloren',
      mit.length === 12 && new Set(mit).size === 12);

    const zeilenMitNeuling = [
      { post_id: 'a', punkte: 1, neuling: true },
      { post_id: 'b', punkte: 2, neuling: false },
    ];
    pruefe('Die Neulingsliste kommt aus den Rangzeilen',
      Rang.neulingsliste(zeilenMitNeuling).has('a') &&
        !Rang.neulingsliste(zeilenMitNeuling).has('b'));

    // ------------------------------------------------------------------
    console.log('\nAnonyme duerfen nicht ranken');

    const anonym = createClient(URL, KEY);
    const { error: anonRang } = await anonym.rpc('feed_rang', { beitraege: ids, herkunft: 'feed' });
    pruefe('feed_rang() ist fuer Anonyme zu', Boolean(anonRang), anonRang?.message || 'kein Fehler!');
    const { error: anonBild } = await anonym.rpc('interessenbild', { wer: ich.id });
    pruefe('interessenbild() ebenso', Boolean(anonBild), anonBild?.message || 'kein Fehler!');
  } finally {
    // Die eigenen Spuren wieder weg — siehe Kopf der Datei.
    if (aufraeumen.length > 0) {
      await ich.client
        .from('post_impressions')
        .delete()
        .eq('user_id', ich.id)
        .in('post_id', aufraeumen);
    }
  }

  console.log(fehler === 0 ? '\nAlles in Ordnung.\n' : `\n${fehler} Fehler.\n`);
  process.exit(fehler === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ABBRUCH  ' + e.message);
  process.exit(1);
});
