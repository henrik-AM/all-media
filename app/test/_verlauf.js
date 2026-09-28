/**
 * „Mein Verlauf" — landet jede der fünf Aktionen dort, mit Zeitpunkt und
 * Ziel? Und bleibt Fremdes draußen? (Feedback 21.09.2026, Kasten 10)
 *
 * WAS GEPRÜFT WIRD
 *
 * Ohne Netz (immer, auch mit --offline):
 *   1. gemeinsam/verlauf.js führt die sechs Quellen richtig zusammen:
 *      neueste zuerst, Teilen an mehrere Personen wird EINE Zeile, Zeilen
 *      ohne lesbaren Beitrag fallen heraus, Zeit und Zeile stimmen.
 *   2. App und Website hängen an derselben Datei: SettingsScreen und
 *      web/public/app.js führen „Mein Verlauf", /api/verlauf ruft
 *      Verlauf.laden, index.html bindet verlauf.js ein, UMD_BAUSTEINE kennt
 *      sie.
 *   3. Schema 66 legt den Wächter auf alle fünf Tabellen und nimmt PUBLIC
 *      das Ausführungsrecht.
 *
 * Mit Netz (Testkonto test@all-media.app, kein /api/reset):
 *   4. Like, Kommentar, Repost und Speichern an einem Demo-Beitrag, den das
 *      Testkonto noch nicht angefasst hat → alle vier stehen danach im
 *      Verlauf, mit Zeitpunkt und der richtigen Beitragskennung.
 *   5. Teilen: die Abfragen auf shares und Kanalnachrichten laufen ohne
 *      Fehler. Eine shares-Zeile legt der Lauf NICHT an — die Tabelle hat
 *      keine Löschregel, sie bliebe für immer liegen (ein abgelehntes DELETE
 *      meldet Erfolg). Vorhandene Teilungen des Testkontos müssen im Verlauf
 *      stehen.
 *   6. Merkliste im fremden Namen (für @prueflauf, das andere eigene
 *      Testkonto) wird abgelehnt und legt keine Zeile an.
 *   7. Aufräumen mit Gegenprobe: jede angelegte Zeile ist wieder weg.
 *
 * Start:  node test/_verlauf.js            (alles)
 *         node test/_verlauf.js --offline  (nur 1–3)
 */

const fs = require('fs');
const path = require('path');
const Verlauf = require('../../gemeinsam/verlauf');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const OFFLINE = process.argv.includes('--offline');

const TESTKONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };
const PRUEFKONTO = { email: 'all.media.prueflauf@web.de', passwort: 'PruefLauf2026!' };

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

// ------------------------------------------------------------ 1. offline --
function ohneNetz() {
  console.log('\n1. gemeinsam/verlauf.js');
  const B = (id, kind, title) => ({ id, kind, title, description: null });
  const liste = Verlauf.zusammenfuehren({
    likes: [{ post_id: 'p1', created_at: '2026-09-28T10:00:00.000Z', posts: B('p1', 'post', 'Sonnenuntergang') }],
    kommentare: [{ id: 'k1', text: ' Schön! ', post_id: 'p2', created_at: '2026-09-28T11:00:00.000Z', posts: B('p2', 'reel', '') }],
    geteilt: [
      { id: 's1', post_id: 'p3', created_at: '2026-09-28T12:00:00.000Z', posts: B('p3', 'clip', 'Vlog'), profiles: { name: 'Anna', handle: 'anna' } },
      { id: 's2', post_id: 'p3', created_at: '2026-09-28T12:00:00.000Z', posts: B('p3', 'clip', 'Vlog'), profiles: { name: 'Ben', handle: 'ben' } },
    ],
    kanal: [{ id: 'c1', created_at: '2026-09-28T09:00:00.000Z', posts: B('p4', 'post', 'Brücke'), community_channels: { name: 'Allgemein', communities: { name: 'Fotografie' } } }],
    reposts: [{ post_id: 'p5', created_at: '2026-09-28T13:00:00.000Z', posts: B('p5', 'reel', 'Tanz') }],
    gespeichert: [
      { post_id: 'p6', created_at: '2026-09-28T14:00:00.000Z', posts: B('p6', 'post', 'Berge') },
      // Unlesbarer Beitrag: fällt heraus.
      { post_id: 'p7', created_at: '2026-09-28T15:00:00.000Z', posts: null },
    ],
  });

  pruefe('Sechs Zeilen (zwei Teilungen zu einer, unlesbarer Beitrag weg)', liste.length === 6, String(liste.length));
  pruefe('Neueste zuerst', liste[0] && liste[0].art === 'speichern' && liste[5].detail === 'in Fotografie',
    liste.map((e) => e.art).join(','));
  const alleArten = new Set(liste.map((e) => e.art));
  pruefe('Alle fünf Arten vorhanden', Verlauf.ARTEN.every((a) => alleArten.has(a)), [...alleArten].join(','));
  const teilen = liste.find((e) => e.art === 'teilen' && e.beitragId === 'p3');
  pruefe('Teilen an zwei Personen ist eine Zeile', teilen && Verlauf.zeile(teilen) === 'Geteilt an Anna, Ben · Vlog',
    teilen && Verlauf.zeile(teilen));
  const kom = liste.find((e) => e.art === 'kommentar');
  pruefe('Kommentarzeile mit Text und Ersatztitel', kom && Verlauf.zeile(kom) === 'Kommentiert „Schön!" · Video (Hochformat)',
    kom && Verlauf.zeile(kom));
  pruefe('Speichern-Zeile', Verlauf.zeile(liste[0]) === 'Gespeichert · Berge', Verlauf.zeile(liste[0]));
  pruefe('Ziel je Art', Verlauf.ziel({ kind: 'clip' }) === 'clip' && Verlauf.ziel({ kind: 'reel' }) === 'reel' &&
    Verlauf.ziel({ kind: 'post' }) === 'beitrag');
  const d = new Date(2026, 8, 28, 7, 5);
  pruefe('Zeit als TT.MM.JJJJ, hh:mm', Verlauf.zeit(d.toISOString()) === '28.09.2026, 07:05', Verlauf.zeit(d.toISOString()));
  pruefe('Kaputte Zeit gibt leeren Text', Verlauf.zeit('quatsch') === '');
  pruefe('Schlüssel eindeutig', new Set(liste.map((e) => e.schluessel)).size === liste.length);

  console.log('\n2. App und Website am selben Baustein');
  const settings = lies('app/screens/profile/SettingsScreen.tsx');
  const web = lies('web/public/app.js');
  const server = lies('web/server/app.js');
  const aktionen = lies('app/lib/aktionen.ts');
  pruefe('App: Einstellungen → Videos → „Mein Verlauf"', /label: 'Mein Verlauf'[^\n]*liste: 'verlauf'/.test(settings));
  pruefe('Website: Einstellungen → Videos → „Mein Verlauf"', /label: 'Mein Verlauf'[^\n]*liste: 'verlauf'/.test(web));
  pruefe('App lädt über gemeinsam/verlauf.js', /require\('\.\.\/\.\.\/gemeinsam\/verlauf'\)/.test(aktionen) && /Verlauf\.laden\(/.test(aktionen));
  pruefe('/api/verlauf lädt über gemeinsam/verlauf.js', /app\.get\('\/api\/verlauf'/.test(server) && /Verlauf\.laden\(req\.db, req\.nutzerId\)/.test(server));
  pruefe('index.html bindet verlauf.js ein', lies('web/public/index.html').includes('/gemeinsam/verlauf.js'));
  pruefe('UMD_BAUSTEINE kennt verlauf', /\['verlauf', 'Verlauf'\]/.test(lies('app/test/_modulquelle.js')));
  pruefe('App: Zeilen antippbar (onOpenKachel)', /onOpenKachel=\{/.test(lies('app/App.tsx')) && /onPress: beitragOeffnen/.test(settings));
  pruefe('Website: Zeilen anklickbar (data-ziel-id)', /data-ziel-id=/.test(web) && /beitragOeffnen\(b\.dataset\.zielKind/.test(web));
  pruefe('Website: openPost ist definiert', /\nfunction openPost\(/.test(web));

  console.log('\n3. Schema 66');
  const sql = lies('SUPABASE_SCHEMA_66_verlauf_nur_eigenes.sql');
  const ohneKommentarblock = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [tabelle, spalte] of [['saves', 'user_id'], ['post_likes', 'user_id'], ['reposts', 'user_id'], ['comments', 'user_id'], ['shares', 'shared_by']]) {
    pruefe(`Wächter auf ${tabelle}`, new RegExp(`on public\\.${tabelle}\\s+for each row execute function public\\.nur_eigene_aktion\\('${spalte}'\\)`).test(sql));
  }
  pruefe('EXECUTE von public entzogen', /revoke all on function public\.nur_eigene_aktion\(\) from public, anon, authenticated/.test(sql));
  pruefe('Aufräumen ist auskommentiert (kein DELETE außerhalb des Kommentarblocks)', !/\bdelete\s+from\b/i.test(ohneKommentarblock));
  pruefe('Aufräumen ist als Freigabe markiert', sql.includes('NUR NACH FREIGABE DURCH HENRIK'));
  pruefe('REIHENFOLGE erwähnt Schema 66', lies('SUPABASE_REIHENFOLGE.md').includes('SUPABASE_SCHEMA_66_verlauf_nur_eigenes.sql'));
}

// ------------------------------------------------------------- 2. online --
async function anmelden(zugang) {
  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

async function mitNetz() {
  console.log('\n4. Die fünf Aktionen im Verlauf (Testkonto)');
  const ich = await anmelden(TESTKONTO);
  const db = ich.client;

  // Ein Demo-Beitrag eines Demoprofils, den das Testkonto noch nicht angefasst hat.
  const { data: kandidaten, error: e1 } = await db
    .from('posts')
    .select('id, kind, profiles!user_id(demo)')
    .eq('demo', true)
    .order('created_at', { ascending: false })
    .limit(60);
  if (e1) throw e1;
  const belegt = new Set();
  for (const t of ['post_likes', 'saves', 'reposts', 'comments']) {
    const { data } = await db.from(t).select('post_id').eq('user_id', ich.id);
    for (const z of data || []) belegt.add(z.post_id);
  }
  const ziel = (kandidaten || []).find((b) => b.profiles && b.profiles.demo && !belegt.has(b.id));
  pruefe('Freier Demo-Beitrag gefunden', !!ziel);
  if (!ziel) return;

  const angelegt = { kommentar: null };
  try {
    const eins = async (tabelle, zeile) => {
      const { error } = await db.from(tabelle).insert(zeile);
      pruefe(`${tabelle} schreiben`, !error, error && error.message);
    };
    await eins('post_likes', { user_id: ich.id, post_id: ziel.id });
    await eins('saves', { user_id: ich.id, post_id: ziel.id });
    await eins('reposts', { user_id: ich.id, post_id: ziel.id });
    const { data: k, error: ek } = await db
      .from('comments')
      .insert({ user_id: ich.id, post_id: ziel.id, text: 'Prüflauf Verlauf' })
      .select('id')
      .single();
    pruefe('comments schreiben', !ek, ek && ek.message);
    angelegt.kommentar = k && k.id;

    const liste = await Verlauf.laden(db, ich.id);
    for (const art of ['like', 'kommentar', 'repost', 'speichern']) {
      const e = liste.find((x) => x.art === art && x.beitragId === ziel.id);
      pruefe(`Verlauf zeigt ${art}`, !!e && !!Verlauf.zeit(e.wann) && e.kind === ziel.kind,
        e ? `${Verlauf.zeile(e)} · ${Verlauf.zeit(e.wann)}` : 'fehlt');
    }

    console.log('\n5. Teilen');
    const { data: geteilt, error: es } = await db.from('shares').select('post_id').eq('shared_by', ich.id).limit(50);
    pruefe('shares lesbar', !es, es && es.message);
    const gelesen = new Set(liste.filter((e) => e.art === 'teilen').map((e) => e.beitragId));
    const offen = (geteilt || []).filter((z) => !gelesen.has(z.post_id));
    // Nur Teilungen mit lesbarem Beitrag gehören in den Verlauf.
    const { data: lesbar } = offen.length
      ? await db.from('posts').select('id').in('id', offen.map((z) => z.post_id))
      : { data: [] };
    pruefe('Jede eigene Teilung mit lesbarem Beitrag steht im Verlauf', (lesbar || []).length === 0,
      `${(geteilt || []).length} Teilungen, ${(lesbar || []).length} fehlen`);

    console.log('\n6. Fremde Merkliste');
    const fremd = await anmelden(PRUEFKONTO);
    const zaehle = async () =>
      (await fremd.client.from('saves').select('post_id').eq('user_id', fremd.id).eq('post_id', ziel.id)).data || [];
    // Hatte @prueflauf den Beitrag schon selbst gespeichert, wäre eine Zeile
    // hinterher kein Beweis für ein Leck — deshalb vorher und nachher zählen.
    const vorher = (await zaehle()).length;
    const { error: ef } = await db.from('saves').insert({ user_id: fremd.id, post_id: ziel.id });
    const nachher = (await zaehle()).length;
    pruefe('Speichern im fremden Namen abgelehnt', !!ef, ef ? ef.message : 'kein Fehler');
    pruefe('… und keine Zeile entstanden', nachher === vorher, `vorher ${vorher}, nachher ${nachher}`);
  } finally {
    console.log('\n7. Aufräumen');
    const weg = async (tabelle, filter) => {
      let q = db.from(tabelle).delete({ count: 'exact' });
      for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
      const { error, count } = await q;
      let r = db.from(tabelle).select('*', { count: 'exact', head: true });
      for (const [k, v] of Object.entries(filter)) r = r.eq(k, v);
      const { count: rest } = await r;
      pruefe(`${tabelle} aufgeräumt`, !error && rest === 0, error ? error.message : `gelöscht ${count}, übrig ${rest}`);
    };
    await weg('post_likes', { user_id: ich.id, post_id: ziel.id });
    await weg('saves', { user_id: ich.id, post_id: ziel.id });
    await weg('reposts', { user_id: ich.id, post_id: ziel.id });
    if (angelegt.kommentar) await weg('comments', { id: angelegt.kommentar });
  }
}

(async () => {
  ohneNetz();
  if (OFFLINE) {
    console.log('\n(--offline: Teil 4–7 übersprungen)');
  } else if (!URL || !KEY) {
    pruefe('Zugangsdaten für Supabase vorhanden (.env.local)', false);
  } else {
    await mitNetz();
  }
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden.`);
  process.exit(fehler === 0 ? 0 : 1);
})().catch((e) => {
  console.error('  FEHL ', e && e.message ? e.message : e);
  process.exit(1);
});
