/**
 * Prüflauf „Feed steuern" (Kasten 24) — wirkt die Lenkung auf BEIDEN Seiten?
 *
 * WARUM ES DAS GIBT
 *
 * Eine Einstellung hat vier Stufen: Gegenstand, bedienbar, gespeichert,
 * wirksam. Erst die letzte zählt. „Gespeichert" ist leicht nachzuweisen —
 * eine Zeile in feed_lenkung. „Wirksam" heißt: der Feed steht danach anders,
 * und zwar in der App und auf der Website gleich.
 *
 * WAS GEPRÜFT WIRD
 *
 *   1. Ein Eintrag „mehr #x" (geschrieben über die Website-Route) hebt einen
 *      Beitrag mit #x im Feed — auf der Website (/api/bootstrap) und in der
 *      App (app/lib/daten.ts, übersetzt und im Browser ausgeführt).
 *   2. Ein Eintrag „weniger @profil" (geschrieben über app/lib/lenkung.ts)
 *      schiebt den Beitrag dieser Person nach unten — auf beiden Seiten.
 *   3. Beide Seiten zeigen exakt die Reihenfolge, die gemeinsam/rang.js +
 *      gemeinsam/lenkung.js aus den Punkten von feed_rang() vorhersagen.
 *   4. Liste, Umstellen, Entfernen; ungültige Eingaben weist die Datenbank ab.
 *   5. „Kein Interesse" erscheint in der Liste und lässt sich zurücknehmen.
 *   6. „Feed zurücksetzen" leert Einträge und „Kein Interesse" und setzt
 *      den Neustart; das Interessenbild ist danach leer.
 *   7. Fremde sehen nichts: ein zweites Testkonto liest keine fremden
 *      Einträge und kein fremdes Interessenbild; Anonyme gar nichts.
 *
 * Voraussetzung: Schema 82 (feed_lenkung) ist eingespielt, der Webserver
 * läuft auf Port 3000 mit dem neuen Servercode.
 *
 * Start:  node test/_lenken.js   (npm run test:lenken)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const { zusammengelegt } = require('./_modulquelle');
const { anmelden, MAIL, PASS, beenden } = require('./_konto');
const { TESTKONTO_PASS } = require('./_testpasswoerter');
const Rang = require('../../gemeinsam/rang');
const Lenkung = require('../../gemeinsam/lenkung');
const { BEITRAG_SPALTEN } = require('../../gemeinsam/spalten');

const BASIS = process.env.AM_URL || 'http://localhost:3000';

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL_ = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

let fehler = 0;
let geprueft = 0;
const pruefe = (n, b, z = '') => {
  geprueft++;
  if (!b) fehler++;
  console.log((b ? 'PASS  ' : 'FAIL  ') + n + (z ? '  — ' + z : ''));
};

const ARTEN = [
  ['posts', 'post'],
  ['videos', 'reel'],
  ['clips', 'clip'],
];

/** Dieselben Kandidaten wie web/server/supabase-api.js (limit 200). */
async function kandidaten(client) {
  const { data, error } = await client
    .from('posts')
    .select(BEITRAG_SPALTEN)
    .or(`publish_at.is.null,publish_at.lte.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw new Error('posts: ' + error.message);
  return data || [];
}

/** Die Reihenfolge, die beide Seiten zeigen MÜSSEN — aus derselben Rechnung. */
async function vorhersage(client, zeilen, eintraege) {
  const ids = zeilen.map((b) => b.id);
  const { data: rang, error } = await client.rpc('feed_rang', { beitraege: ids, herkunft: 'feed' });
  if (error) throw new Error('feed_rang: ' + error.message);
  const geordnet = Rang.ordnenJeArt(zeilen, Rang.punktekarte(rang), (b) => b.kind, {
    neulinge: Rang.neulingsliste(rang),
    lenkung: Lenkung.faktoren(zeilen, eintraege),
  });
  const je = {};
  for (const [feld, kind] of ARTEN) je[feld] = geordnet.filter((b) => b.kind === kind).map((b) => b.id);
  return je;
}

(async () => {
  if (!URL_ || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen (app/.env.local).');
    process.exit(1);
  }

  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  // bypassCSP: der App-Code kommt als blob:-Modul (Begründung in _gleichstand.js).
  const seite = await browser.newPage({ viewport: { width: 400, height: 860 }, bypassCSP: true });
  await seite.goto(BASIS, { waitUntil: 'load' });
  const an = await anmelden(seite);
  if (!an.ok) {
    console.error(`FEHLER  Prüfkonto ${MAIL} konnte sich nicht anmelden: ${an.fehler}`);
    await beenden(browser, 1);
  }

  // Dasselbe Konto noch einmal in Node — für die Vorhersage und die Gegenproben.
  const ich = createClient(URL_, KEY);
  const { data: anm, error: anmFehler } = await ich.auth.signInWithPassword({ email: MAIL, password: PASS });
  if (anmFehler) {
    console.error('FEHLER  Node-Anmeldung: ' + anmFehler.message);
    await beenden(browser, 1);
  }
  const ichId = anm.user.id;

  // Schema da? Sonst misst der Lauf nichts und meldet trotzdem zwanzig Fehler.
  const { error: schemaFehler } = await ich.from('feed_lenkung').select('id').limit(1);
  if (schemaFehler) {
    console.error('FEHLER  feed_lenkung fehlt — erst SUPABASE_SCHEMA_82_feed_lenkung.sql einspielen: ' + schemaFehler.message);
    await beenden(browser, 1);
  }

  // --- App-Code übersetzen: daten.ts (Rang) und lenkung.ts (Schreiben) ------
  const bauOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'all-media-lenken-'));
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
      path.join(__dirname, '..', 'lib', 'daten.ts'),
      path.join(__dirname, '..', 'lib', 'lenkung.ts'),
      '--ignoreConfig', '--target', 'es2020', '--module', 'es2020',
      '--skipLibCheck', '--outDir', bauOrdner,
    ],
    { stdio: 'pipe' }
  );
  const datenQuelle = zusammengelegt(bauOrdner, 'daten.js');
  const lenkungQuelle = zusammengelegt(bauOrdner, 'lenkung.js');
  fs.rmSync(bauOrdner, { recursive: true, force: true });

  /** Eine Funktion aus dem übersetzten App-Code im Browser ausführen. */
  const appRufen = (quelle, name, argumente) =>
    seite.evaluate(
      async ({ quelle, name, argumente }) => {
        try {
          const url = URL.createObjectURL(new Blob([quelle], { type: 'text/javascript' }));
          const modul = await import(url);
          URL.revokeObjectURL(url);
          const client = await window.Anmeldung.aufbauen();
          const ich = window.Anmeldung.nutzer().id;
          const args = argumente.map((a) => (a === '$client' ? client : a === '$ich' ? ich : a));
          return { wert: await modul[name](...args) };
        } catch (f) {
          return { fehler: (f && f.message) || String(f) };
        }
      },
      { quelle, name, argumente }
    );

  /** Beide Feeds holen: Website-Server und App-Code. */
  const beideFeeds = async () => {
    const web = await seite.evaluate(() => fetch('/api/bootstrap').then((r) => r.json()));
    const app = await appRufen(datenQuelle, 'ladeAlles', ['$client', '$ich']);
    if (app.fehler) throw new Error('App ladeAlles: ' + app.fehler);
    const folge = (quelle) => {
      const je = {};
      for (const [feld] of ARTEN) je[feld] = (quelle[feld] || []).map((b) => b.id);
      return je;
    };
    return { web: folge(web), app: folge(app.wert) };
  };

  const webApi = (pfad, koerper) =>
    seite.evaluate(
      async ({ pfad, koerper }) => {
        const r = await fetch(pfad, koerper === undefined
          ? {}
          : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(koerper) });
        return r.json().catch(() => ({ ok: false, error: 'kein JSON, Status ' + r.status }));
      },
      { pfad, koerper }
    );

  try {
    // Sauberer Start: was ein früherer Lauf liegen ließ, ist jetzt weg.
    await ich.rpc('feed_zuruecksetzen');

    // ------------------------------------------------------------------
    console.log('\nAusgangslage');
    const zeilen = await kandidaten(ich);
    const ohne = await vorhersage(ich, zeilen, []);
    const vorher = await beideFeeds();

    /*
     * Eine Art mit mindestens drei fremden Beiträgen von mindestens zwei
     * Verfassern suchen. Darin:
     *   Y  der oberste fremde Beitrag; seine Person P bekommt „weniger".
     *   X  ein Beitrag weiter unten, nicht von P, mit einem Hashtag t, das
     *      Y nicht trägt — und für den die Rechnung einen Aufstieg vorhersagt.
     * Gewählt wird aus der Vorhersage, nicht geraten: so ist sicher, dass ein
     * Fehlschlag an der Umsetzung liegt und nicht am Bestand.
     */
    const nachId = new Map(zeilen.map((b) => [b.id, b]));
    let fall = null;
    for (const [feld] of ARTEN) {
      const folge = ohne[feld].filter((id) => nachId.get(id).user_id !== ichId);
      if (folge.length < 3) continue;
      const y = nachId.get(folge[0]);
      const P = y.user_id;
      const yTags = new Set((y.tags || []).map((t) => String(t).toLowerCase()));
      for (let i = folge.length - 1; i > 0 && !fall; i--) {
        const x = nachId.get(folge[i]);
        if (x.user_id === P) continue;
        const t = (x.tags || []).map((s) => Lenkung.normalisieren('hashtag', s)).find((s) => s && !yTags.has(s));
        if (!t) continue;
        const eintraege = [
          { art: 'hashtag', wert: t, richtung: 'mehr' },
          { art: 'profil', wert: P, richtung: 'weniger' },
        ];
        const mit = await vorhersage(ich, zeilen, eintraege);
        if (mit[feld].indexOf(x.id) < ohne[feld].indexOf(x.id) &&
            mit[feld].indexOf(y.id) > ohne[feld].indexOf(y.id)) {
          fall = { feld, x, y, P, t, eintraege };
        }
      }
      if (fall) break;
    }

    if (!fall) {
      console.error('FEHLER  Im Bestand gibt es keinen Fall, an dem sich die Lenkung messen ließe ' +
        '(drei fremde Beiträge einer Art, zwei Verfasser, ein unterscheidendes Hashtag). Erst npm run test:datenbank.');
      await beenden(browser, 1);
    }
    const { feld, x, y, P, t } = fall;
    console.log(`  ----  Art ${feld}: X=${x.id.slice(0, 8)} (${t}), Y=${y.id.slice(0, 8)} (Profil ${P.slice(0, 8)})`);

    pruefe('Vorher: App und Website in derselben Reihenfolge',
      vorher.web[feld].join() === vorher.app[feld].join());
    pruefe('Vorher: so, wie die Rechnung es sagt', vorher.web[feld].join() === ohne[feld].join());

    // ------------------------------------------------------------------
    console.log('\nEinträge setzen — einmal über die Website, einmal über den App-Code');

    const w1 = await webApi('/api/lenkung', { art: 'hashtag', wert: t.toUpperCase(), anzeige: t, richtung: 'mehr' });
    pruefe('Website: „mehr ' + t + '" gespeichert', w1.ok === true, w1.error || '');
    pruefe('Website: Groß/klein wird vereinheitlicht',
      (w1.eintraege || []).some((e) => e.art === 'hashtag' && e.wert === t && e.richtung === 'mehr'));

    const profilAnzeige = '@profil-' + P.slice(0, 6);
    const a1 = await appRufen(lenkungQuelle, 'lenkungSetzen', [
      '$client', '$ich', { art: 'profil', wert: P, anzeige: profilAnzeige, richtung: 'weniger' },
    ]);
    pruefe('App: „weniger @profil" gespeichert', !a1.fehler && a1.wert && a1.wert.richtung === 'weniger', a1.fehler || '');

    const { data: zeilenDb } = await ich.from('feed_lenkung').select('art, wert, richtung').eq('user_id', ichId);
    pruefe('In der Datenbank stehen genau die zwei Einträge', (zeilenDb || []).length === 2,
      JSON.stringify(zeilenDb));

    // ------------------------------------------------------------------
    console.log('\nWirkung im Feed');
    const erwartet = await vorhersage(ich, zeilen, fall.eintraege);
    const nachher = await beideFeeds();

    for (const [seiteName, folge] of [['Website', nachher.web[feld]], ['App', nachher.app[feld]]]) {
      const xv = vorher.web[feld].indexOf(x.id);
      const xn = folge.indexOf(x.id);
      const yv = vorher.web[feld].indexOf(y.id);
      const yn = folge.indexOf(y.id);
      pruefe(`${seiteName}: Beitrag mit ${t} steigt`, xn >= 0 && xn < xv, `Platz ${xv + 1} → ${xn + 1}`);
      pruefe(`${seiteName}: Beitrag von @profil fällt`, yn > yv, `Platz ${yv + 1} → ${yn + 1}`);
      pruefe(`${seiteName}: Reihenfolge wie vorhergesagt`, folge.join() === erwartet[feld].join(),
        folge.join() === erwartet[feld].join() ? `${folge.length} Einträge` :
          `ab Platz ${folge.findIndex((id, i) => erwartet[feld][i] !== id) + 1}`);
    }
    pruefe('App und Website gleich — in allen drei Arten',
      ARTEN.every(([f]) => nachher.web[f].join() === nachher.app[f].join()));

    // ------------------------------------------------------------------
    console.log('\nListe, Umstellen, Entfernen');
    const liste = await webApi('/api/lenkung');
    pruefe('Website-Liste zeigt beide Einträge', (liste.eintraege || []).length === 2);
    const appStand = await appRufen(lenkungQuelle, 'lenkungStand', ['$client', '$ich']);
    pruefe('App-Liste zeigt dieselben Einträge',
      !appStand.fehler && JSON.stringify((appStand.wert.eintraege || []).map((e) => e.id).sort()) ===
        JSON.stringify((liste.eintraege || []).map((e) => e.id).sort()), appStand.fehler || '');
    pruefe('„mehr" steht vor „weniger"', (liste.eintraege || [])[0]?.richtung === 'mehr');

    const umstellen = await webApi('/api/lenkung', { art: 'hashtag', wert: t, anzeige: t, richtung: 'weniger' });
    const umgestellt = (umstellen.eintraege || []).filter((e) => e.art === 'hashtag' && e.wert === t);
    pruefe('Umstellen ersetzt, statt zu verdoppeln', umgestellt.length === 1 && umgestellt[0].richtung === 'weniger');

    const nachUmstellen = await beideFeeds();
    const xUnten = nachUmstellen.web[feld].indexOf(x.id);
    pruefe('Mit „weniger ' + t + '" steht X tiefer als mit „mehr"', xUnten > nachher.web[feld].indexOf(x.id),
      `Platz ${nachher.web[feld].indexOf(x.id) + 1} → ${xUnten + 1}`);
    pruefe('… auf beiden Seiten gleich', nachUmstellen.web[feld].join() === nachUmstellen.app[feld].join());

    const profilEintrag = (umstellen.eintraege || []).find((e) => e.art === 'profil');
    const weg = await appRufen(lenkungQuelle, 'lenkungEntfernen', ['$client', '$ich', profilEintrag && profilEintrag.id]);
    pruefe('App: Eintrag entfernt', !weg.fehler && weg.wert === true, weg.fehler || '');
    const fremdWeg = await webApi('/api/lenkung/00000000-0000-4000-8000-000000000000/entfernen', {});
    pruefe('Entfernen eines nicht vorhandenen Eintrags meldet Fehler statt Erfolg', fremdWeg.ok === false);

    const ungueltig = await webApi('/api/lenkung', { art: 'profil', wert: 'kein-uuid', richtung: 'mehr' });
    pruefe('Ungültiges Profil wird abgewiesen', ungueltig.ok === false);
    const { error: direktFehler } = await ich.from('feed_lenkung')
      .insert({ user_id: ichId, art: 'hashtag', wert: 'OhneRaute', richtung: 'mehr' });
    pruefe('Die Datenbank selbst weist einen Wert in falscher Form ab', Boolean(direktFehler),
      direktFehler ? direktFehler.message : 'kein Fehler!');

    // ------------------------------------------------------------------
    console.log('\nKein Interesse');
    const z = nachher.web[feld].find((id) => id !== x.id && id !== y.id);
    const ki = await webApi(`/api/beitraege/${z}/kein-interesse`, {});
    pruefe('„Kein Interesse" gesetzt', ki.ok === true, ki.error || '');
    const mitKi = await webApi('/api/lenkung');
    pruefe('… und steht in der Liste von „Feed steuern"',
      (mitKi.keinInteresse || []).some((k) => k.postId === z));
    const zurueck = await appRufen(lenkungQuelle, 'keinInteresseZuruecknehmen', ['$client', '$ich', z]);
    pruefe('App: zurückgenommen', !zurueck.fehler && zurueck.wert === true, zurueck.fehler || '');
    const ohneKi = await webApi('/api/lenkung');
    pruefe('… und ist aus der Liste verschwunden', !(ohneKi.keinInteresse || []).some((k) => k.postId === z));
    const webNachKi = await seite.evaluate(() => fetch('/api/bootstrap').then((r) => r.json()));
    pruefe('… und nicht mehr in der Kein-Interesse-Liste des Feeds', !(webNachKi.keinInteresse || []).includes(z));

    // ------------------------------------------------------------------
    console.log('\nFeed zurücksetzen');
    await webApi('/api/lenkung', { art: 'ort', wert: 'Hamburg', anzeige: 'Hamburg', richtung: 'mehr' });
    await webApi(`/api/beitraege/${z}/kein-interesse`, {});
    const reset = await appRufen(lenkungQuelle, 'feedZuruecksetzen', ['$client']);
    pruefe('App: zurückgesetzt', !reset.fehler && reset.wert && reset.wert.ok === true, reset.fehler || '');
    pruefe('… meldet, was gelöscht wurde', reset.wert && reset.wert.eintraege >= 2 && reset.wert.kein_interesse >= 1,
      JSON.stringify(reset.wert));
    const leer = await webApi('/api/lenkung');
    pruefe('Keine Einträge mehr', (leer.eintraege || []).length === 0);
    pruefe('Kein „Kein Interesse" mehr', (leer.keinInteresse || []).length === 0);
    const { data: neustart } = await ich.from('feed_neustart').select('zeitpunkt').eq('user_id', ichId).maybeSingle();
    pruefe('Neustart-Zeitpunkt gesetzt', neustart && Date.now() - new Date(neustart.zeitpunkt).getTime() < 120000,
      neustart ? neustart.zeitpunkt : 'fehlt');
    const { data: bild, error: bildFehler } = await ich.rpc('interessenbild', { wer: ichId });
    pruefe('Das Interessenbild ist danach leer (gelernte Signale vergessen)', !bildFehler && (bild || []).length === 0,
      bildFehler ? bildFehler.message : `${(bild || []).length} Marken`);
    const nachReset = await beideFeeds();
    pruefe('Nach dem Zurücksetzen: App und Website gleich',
      ARTEN.every(([f]) => nachReset.web[f].join() === nachReset.app[f].join()));

    // ------------------------------------------------------------------
    console.log('\nFremde sehen nichts');
    await webApi('/api/lenkung', { art: 'hashtag', wert: t, anzeige: t, richtung: 'mehr' });
    const anderer = createClient(URL_, KEY);
    const { data: anderesKonto, error: andererFehler } = await anderer.auth.signInWithPassword({
      email: 'test@all-media.app',
      password: TESTKONTO_PASS,
    });
    if (andererFehler) {
      pruefe('Zweites Testkonto meldet sich an', false, andererFehler.message);
    } else {
      const { data: fremd } = await anderer.from('feed_lenkung').select('id').eq('user_id', ichId);
      pruefe('Ein anderes Konto liest keine fremden Einträge', (fremd || []).length === 0, `${(fremd || []).length} Zeilen`);
      const { data: fremdNeustart } = await anderer.from('feed_neustart').select('user_id').eq('user_id', ichId);
      pruefe('… und keinen fremden Neustart', (fremdNeustart || []).length === 0);
      const { data: fremdBild } = await anderer.rpc('interessenbild', { wer: ichId });
      pruefe('… und kein fremdes Interessenbild', (fremdBild || []).length === 0, `${(fremdBild || []).length} Marken`);
      const { error: fremdSchreiben } = await anderer.from('feed_lenkung')
        .insert({ user_id: ichId, art: 'hashtag', wert: '#fremd', richtung: 'mehr' });
      pruefe('… und schreibt nicht in fremde Einträge', Boolean(fremdSchreiben));
      pruefe('Zweites Konto ist ein anderes', anderesKonto.user.id !== ichId);
    }
    const anonym = createClient(URL_, KEY);
    const { error: anonLesen } = await anonym.from('feed_lenkung').select('id').limit(1);
    const { data: anonDaten } = await anonym.from('feed_lenkung').select('id').limit(1);
    pruefe('Anonyme lesen nichts', Boolean(anonLesen) || (anonDaten || []).length === 0);
    const { error: anonReset } = await anonym.rpc('feed_zuruecksetzen');
    pruefe('Anonyme dürfen nicht zurücksetzen', Boolean(anonReset));
  } finally {
    // Spuren weg: Einträge, Kein Interesse, Neustart des Prüfkontos.
    await ich.rpc('feed_zuruecksetzen');
    await ich.from('feed_neustart').delete().eq('user_id', ichId);
  }

  console.log(fehler === 0 ? `\n${geprueft} von ${geprueft} Prüfungen bestanden.\n` : `\n${fehler} von ${geprueft} Prüfungen fehlgeschlagen.\n`);
  await beenden(browser, fehler === 0 ? 0 : 1);
})().catch((e) => {
  console.error('ABBRUCH  ' + e.message);
  process.exit(1);
});
