#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Nachtrag 11.10. zu Kasten 4.3 — Agent „Kommentare".
 *
 *   4.3a Community-Chats jeder Art: Ziehen zum Antworten überall (auch für
 *        Anhänge nach dem Ziehen)
 *   4.3b Kommentare unter Videos/Beiträgen: „Antworten" + Ziehen, „@name",
 *        eingerückte Antworten, „N Antworten ansehen", eine Ebene
 *   4.3c Live-Kommentare: Ziehen/Antworten mit Zitat
 *   4.3d Mitteilung „hat auf deinen Kommentar geantwortet" per Auslöser;
 *        Regeln (selber Beitrag, Blockieren), Schema 92
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Netz: gemeinsam/kommentar.js (Fäden, Wurzel, Vorbelegung,
 *      Klapptext, Live-Zitat, fehlende Spalte, Mitteilungssatz) und die
 *      Verdrahtung in App, Website, Server und Schema-Entwurf 92.
 *   B  Wirkung mit zwei Testkonten direkt an Supabase (braucht Schema 92):
 *      @test kommentiert einen Beitrag von @prueflauf, @prueflauf antwortet
 *      (reply_to + antwort_an), @test liest den Faden UND bekommt genau eine
 *      Mitteilung „comment/comment" (keine zusätzliche Erwähnung durch das
 *      vorbelegte @name). @test antwortet auf die Antwort → hängt an derselben
 *      Wurzel, @prueflauf bekommt die Antwort-Mitteilung, aber kein zweites
 *      „hat deinen Beitrag kommentiert". Abgewiesen werden: Antwort auf eine
 *      Antwort als Wurzel, Antwort über Beiträge hinweg, Ändern des Bezugs.
 *      Live: Antwort mit reply_to im selben Stream, über Streams abgewiesen.
 *      Aufräumen: Wurzel löschen → Antworten (cascade) und Mitteilung weg,
 *      gegengeprüft.
 *
 * WAS ER NICHT ZEIGT: die Oberflächen. Im Simulator/Browser ansehen (Bericht).
 *
 * GEGENPROBE: `GEGENPROBE=<commit> OHNE_NETZ=1 node test/k28-kommentare.js`
 * liest Quelltext und Baustein aus diesem Commit (git show). Auf dem Stand vor
 * dem Kasten (4f5d6eb) muss Teil A fehlschlagen.
 *
 * UNGETESTET geschrieben am 12.10.2026 (Supabase gesperrt, 402). Teil A lief
 * ohne Netz.
 *
 * Start:  node test/k28-kommentare.js   (npm run test:k28-kommentare)
 *         OHNE_NETZ=1 nur Teil A.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');
const { execFileSync } = require('child_process');

const WURZEL = path.join(__dirname, '..', '..');
const STAND = process.env.GEGENPROBE || '';

/** Datei lesen — aus dem Arbeitsstand oder, bei GEGENPROBE, aus dem Commit. */
const lies = (rel) => {
  if (!STAND) return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  try {
    return execFileSync('git', ['show', `${STAND}:${rel}`], { cwd: WURZEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
};

/** Den Baustein aus genau diesem Stand laden. */
const Kommentar = (() => {
  const quelle = lies('gemeinsam/kommentar.js');
  const m = new Module('kommentar-stand');
  m._compile(quelle, path.join(WURZEL, 'gemeinsam', 'kommentar.js'));
  return m.exports;
})();

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};
const sicher = (fn) => {
  try {
    return fn();
  } catch {
    return false;
  }
};
const pruefeAsync = async (name, fn) => {
  try {
    await fn();
    pruefe(name, true);
  } catch (e) {
    pruefe(name, false, e.message || String(e));
  }
};

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log(`\nA  Baustein und Verdrahtung (ohne Netz${STAND ? ', Stand ' + STAND : ''})`);
  const K = Kommentar;

  // Baustein
  const liste = [
    { id: 'a' },
    { id: 'b', antwortAuf: 'a' },
    { id: 'c' },
    { id: 'd', antwortAuf: 'weg' },
    { id: 'e', antwortAuf: 'a' },
  ];
  const f = sicher(() => K.faeden(liste)) || [];
  pruefe('4.3b Fäden: Wurzeln oben, Antworten darunter in Reihenfolge',
    f.length === 3 && f[0].kommentar.id === 'a' && f[0].antworten.map((x) => x.id).join() === 'b,e');
  pruefe('4.3b Fäden: Antwort ohne geladene Wurzel steht oben statt zu verschwinden',
    f.some((x) => x.kommentar.id === 'd'));
  pruefe('4.3b Eine Ebene: Antwort auf eine Antwort hängt an derselben Wurzel',
    sicher(() => K.antwortZiel({ id: 'b', antwortAuf: 'a' }).antwortAuf === 'a' && K.antwortZiel({ id: 'b', antwortAuf: 'a' }).antwortAn === 'b'));
  pruefe('4.3b Antwort auf Kommentar oben: Wurzel = er selbst',
    sicher(() => K.antwortZiel({ id: 'a' }).antwortAuf === 'a'));
  pruefe('4.3b „@name " vorbelegt, beim eigenen Kommentar nicht',
    sicher(() => K.vorbelegung('anna') === '@anna ' && K.vorbelegung('@anna') === '@anna ' && K.vorbelegung('anna', true) === '' && K.vorbelegung('') === ''));
  pruefe('4.3b Klapptext „N Antworten ansehen" / „Antworten ausblenden"',
    sicher(() => K.klappText(1, false) === '1 Antwort ansehen' && K.klappText(3, false) === '3 Antworten ansehen' && K.klappText(3, true) === 'Antworten ausblenden' && K.klappText(0, false) === ''));
  pruefe('4.3b Fehlende Spalte (vor Schema 92) wird erkannt, fremde Fehler nicht',
    sicher(() => K.fehltSpalte({ code: '42703', message: 'column comments.reply_to does not exist' }) &&
      K.fehltSpalte({ code: 'PGRST204', message: "Could not find the 'antwort_an' column" }) &&
      !K.fehltSpalte({ code: '42501', message: 'reply_to' }) && !K.fehltSpalte(null)));
  pruefe('4.3d Mitteilungssatz', sicher(() => K.mitteilungAntwort('Anna') === 'Anna hat auf deinen Kommentar geantwortet.'));
  const live = sicher(() => K.liveBezuege([{ id: 'x', name: 'Anna', text: 'Hi' }, { id: 'y', name: 'B', text: 'Yo', antwortAufId: 'x' }, { id: 'z', antwortAufId: 'fort' }])) || [];
  pruefe('4.3c Live-Zitat aus der geladenen Spalte, fehlendes Original ehrlich',
    live.length === 3 && sicher(() => K.liveZitat(live[1].antwortAuf) === 'Anna: Hi' && K.liveZitat(live[2].antwortAuf) === K.LIVE_BEZUG_WEG));

  // Verdrahtung App
  const sheet = lies('app/components/CommentSheet.tsx');
  pruefe('4.3b App: CommentSheet zieht (ZiehZumAntworten) und hat „Antworten" je Kommentar',
    /<ZiehZumAntworten[^>]*onAntworten=\{\(\) => antworten\(item\)\}/.test(sheet) && /kommentar-antworten-/.test(sheet) && />Antworten</.test(sheet));
  pruefe('4.3b App: Fäden, Klappknopf, Einrückung, Antwort-Leiste',
    /Kommentar\.faeden\(/.test(sheet) && /Kommentar\.klappText\(/.test(sheet) && /commentAntwort/.test(sheet) && /Kommentar\.leistenText\(/.test(sheet));
  pruefe('4.3b App: Senden mit Wurzel + angesprochenem Kommentar',
    /kommentarAnlegen\(supabase, ichId, targetId, text, ziel\)/.test(sheet) && /reply_to/.test(lies('app/lib/aktionen.ts')) && /antwort_an/.test(lies('app/lib/aktionen.ts')));
  const daten = lies('app/lib/daten.ts');
  pruefe('4.3b App: Kommentare laden nachsichtig (ohne Schema 92 nicht leer)',
    /reply_to, antwort_an, comment_likes\(count\)/.test(daten) && /Kommentar\.fehltSpalte\(error\)/.test(daten));
  pruefe('4.3b Alle drei Kommentarorte nutzen dasselbe Blatt (Bildbeitrag, Reel, Querformat)',
    ['app/screens/home/HomeFeedScreen.tsx', 'app/screens/video/VideoFeedScreen.tsx', 'app/screens/videos/ClipPlayerScreen.tsx']
      .every((d) => /<CommentSheet/.test(lies(d))));
  pruefe('4.3c App: Host und Zuschauer ziehen in der Live-Spalte',
    /LiveKommentarZeile/.test(lies('app/screens/videos/LivestreamScreen.tsx')) && /LiveKommentarZeile/.test(lies('app/screens/videos/ClipPlayerScreen.tsx')) &&
    /ZiehZumAntworten/.test(lies('app/components/LiveAntwort.tsx')));
  pruefe('4.3c App: Live-Antwort sendet reply_to, lädt nachsichtig',
    /streamKommentar\(postId, text, bezug\)/.test(lies('app/screens/videos/LivestreamScreen.tsx')) &&
    /reply_to, profiles!user_id/.test(daten));
  const chat = lies('app/screens/messenger/ChatDetailScreen.tsx');
  pruefe('4.3a App: alle Chats (Messenger, Community einzeln/Gruppe, Unterthema) in ChatDetailScreen mit ZiehZumAntworten',
    /<ZiehZumAntworten/.test(chat) && /oeffneUnterthema = \(community: Community, unterthema: Unterthema\) =>\s*\n\s*oeffneChat\(/.test(lies('app/App.tsx')));
  pruefe('4.3a App: Anhang nach dem Ziehen geht als Antwort raus',
    /anhangBezug/.test(chat) && /antwortAuf: anhangBezug\?\.art === 'antwort'/.test(chat));
  pruefe('4.3d App: Glocke sagt „hat auf deinen Kommentar geantwortet"',
    /m\.ziel\.art === 'comment'\) return Kommentar\.mitteilungAntwort/.test(lies('app/contexts/ProfilContext.tsx')));

  // Verdrahtung Website/Server
  const web = lies('web/public/app.js');
  pruefe('4.3b Website: Kommentarzeile ziehbar mit „Antworten"-Knopf, gebunden über antwortenBinden',
    /class="comment\$\{alsAntwort \? ' comment--antwort' : ''\}" data-msgid="\$\{esc\(c\.id\)\}" data-ziehbar/.test(web) &&
    /class="comment__antworten" data-antworten/.test(web) && /antwortenBinden\(\s*sheet\.querySelector\('\.sheet__body'\)/.test(web));
  pruefe('4.3b Website: Fäden, Klappknopf, Vorbelegung, Senden mit Bezug',
    /K\.faeden\(list\)/.test(web) && /data-cklapp/.test(web) && /K\.vorbelegung\(/.test(web) && /JSON\.stringify\(ziel \? \{ text, \.\.\.ziel \} : \{ text \}\)/.test(web));
  pruefe('4.3b Website: kommentar.js eingebunden', /<script src="\/gemeinsam\/kommentar\.js"><\/script>/.test(lies('web/public/index.html')));
  pruefe('4.3b Baustein in UMD_BAUSTEINE', /\['kommentar', 'Kommentar'\]/.test(lies('app/test/_modulquelle.js')));
  const api = lies('web/server/supabase-api.js');
  const sync = lies('web/server/sync-handlers.js');
  const server = lies('web/server/app.js');
  pruefe('4.3b Server: lädt nachsichtig, legt mit reply_to/antwort_an an, Route reicht Bezug durch',
    /reply_to, antwort_an, comment_likes\(count\)/.test(api) && /zeile\.antwort_an = /.test(sync) &&
    /handleCreateComment\(req\.db, req\.nutzerId, req\.params\.targetId, text, bezug\)/.test(server));
  pruefe('4.3c Website: Host und Zuschauer zeichnen ziehbare Live-Zeilen',
    (web.match(/liveZeileHtml\(k, /g) || []).length >= 2 && /antwortAuf \}\)/.test(web) && /req\.body\?\.antwortAuf \|\| null\s*\n\s*\)/.test(server));
  pruefe('4.3a Website: Anhang nach dem Ziehen geht als Antwort raus (Chat + Unterthema)',
    /const bezug = ziel\.bezug\?\.\(\) \|\| null;/.test(web) && /medien\.antwortAuf = req\.body\?\.antwortAuf/.test(server) &&
    /req\.params\.chId, text, medien, req\.body\?\.antwortAuf/.test(server));
  pruefe('4.3d Website: Glocke sagt „hat auf deinen Kommentar geantwortet"',
    /m\.ziel\?\.art === 'comment' \? Kommentar\.mitteilungAntwort\(name\)/.test(server));

  // Schema-Entwurf 92
  const sql = lies('SUPABASE_SCHEMA_92_kommentar_antworten.sql');
  pruefe('4.3d Schema 92: reply_to cascade, antwort_an set null, stream reply_to set null',
    /add column if not exists reply_to uuid\s*\n\s*references public\.comments \(id\) on delete cascade/.test(sql) &&
    /add column if not exists antwort_an uuid\s*\n\s*references public\.comments \(id\) on delete set null/.test(sql) &&
    /references public\.stream_comments \(id\) on delete set null/.test(sql));
  pruefe('4.3d Schema 92: Regeln einschränkend (restrictive), nicht verodert',
    /"Antwort nur im selben Beitrag" on public\.comments\s*\n\s*as restrictive/.test(sql) &&
    /"Live-Antwort nur im selben Stream" on public\.stream_comments\s*\n\s*as restrictive/.test(sql));
  pruefe('4.3d Schema 92: Blockieren, Freigabe, Testkonten, Sichtbarkeit im Auslöser',
    /from public\.blocks b/.test(sql) && /konto_stand\(v_an\) <> 'frei'/.test(sql) && /ist_testkonto\(new\.user_id\)/.test(sql) && /markierung_sichtbar\('comment'/.test(sql));
  pruefe('4.3d Schema 92: EXECUTE entzogen (keine Funktion an PUBLIC/anon)',
    (sql.match(/create or replace function public\.(\w+)/g) || []).every((z) => {
      const n = z.split('.')[1];
      return new RegExp(`revoke (all|execute) on function public\\.${n}\\(`).test(sql);
    }) && /create or replace function/.test(sql));
  pruefe('4.3d Schema 92: Mitteilungsarten-Liste nicht angefasst (Gewinner bleibt 90), art/target schon dort',
    // Erst prüfen, dass es die Datei gibt — sonst wäre „nicht angefasst" sofort wahr.
    /mitteilung_bei_kommentar_antwort/.test(sql) &&
    !/notifications_art_check|notifications_target_type_check/.test(sql.replace(/^--.*$/gm, '')) &&
    /'comment'/.test((lies('SUPABASE_SCHEMA_90_push_to_talk.sql').match(/notifications_art_check\s*\n\s*check \(art in \(([\s\S]*?)\)\);/) || [])[1] || '') &&
    /'comment'/.test((lies('SUPABASE_SCHEMA_90_push_to_talk.sql').match(/notifications_target_type_check\s*\n\s*check \(target_type in \(([\s\S]*?)\)\);/) || [])[1] || ''));
  pruefe('4.3d Schema 92: Doppelte Glocke vermieden (Erwähnung + „kommentiert")',
    /art = 'mention' and target_type = 'comment' and target_id = new\.id/.test(sql) &&
    /kommentar_angesprochen\(new\.id\) = v_besitzer/.test(sql));
}

/* ------------------------------------------------ B Wirkung mit zwei Konten */
async function teilB() {
  const { createClient } = require('@supabase/supabase-js');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const { nurTestkonto } = require('./_nur_testkonten');

  const UMG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    : '';
  const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
  const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
  const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!URL || !KEY) {
    pruefe('Supabase-Zugang aus app/.env.local', false, 'EXPO_PUBLIC_SUPABASE_URL/ANON_KEY fehlen');
    return;
  }

  console.log('\nB  Wirkung mit zwei Testkonten (Supabase, braucht Schema 92)');
  const pr = createClient(URL, KEY);
  const te = createClient(URL, KEY);
  const a1 = await pr.auth.signInWithPassword({
    email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
    password: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
  });
  const a2 = await te.auth.signInWithPassword({ email: nurTestkonto('test@all-media.app'), password: TESTKONTO_PASS });
  pruefe('Beide Testkonten melden sich an', !a1.error && !a2.error, (a1.error || a2.error)?.message);
  if (a1.error || a2.error) return;
  const prId = a1.data.user.id;
  const teId = a2.data.user.id;
  const { data: prProfil } = await pr.from('profiles').select('handle').eq('id', prId).maybeSingle();
  const { data: teProfil } = await te.from('profiles').select('handle').eq('id', teId).maybeSingle();

  // Zwei eigene Beiträge von @prueflauf (für „über Beiträge hinweg").
  const { data: posts } = await pr.from('posts').select('id').eq('user_id', prId)
    .order('created_at', { ascending: false }).limit(2);
  pruefe('@prueflauf hat zwei eigene Beiträge', (posts || []).length === 2, 'Testbestand ohne zwei Beiträge von @prueflauf');
  if ((posts || []).length < 2) return;
  const [beitrag, anderer] = posts.map((p) => p.id);

  let wurzel = null;
  let antwortPr = null;
  let antwortTe = null;
  const live = [];
  const seit = new Date(Date.now() - 2000).toISOString();

  try {
    await pruefeAsync('@test kommentiert den Beitrag (Wurzel)', async () => {
      const { data, error } = await te.from('comments').insert({ post_id: beitrag, user_id: teId, text: 'Prüflauf k28 Wurzel' }).select('id').single();
      if (error) throw error;
      wurzel = data.id;
    });
    if (!wurzel) return;

    await pruefeAsync('@prueflauf antwortet mit „@name" (reply_to + antwort_an)', async () => {
      const { data, error } = await pr.from('comments')
        .insert({ post_id: beitrag, user_id: prId, text: Kommentar.vorbelegung(teProfil?.handle) + 'Antwort Prüflauf', reply_to: wurzel, antwort_an: wurzel })
        .select('id').single();
      if (error) throw error;
      antwortPr = data.id;
    });

    await pruefeAsync('@test liest den Faden: Antwort hängt an seiner Wurzel', async () => {
      const { data, error } = await te.from('comments').select('id, reply_to, antwort_an').eq('post_id', beitrag);
      if (error) throw error;
      const a = (data || []).find((k) => k.id === antwortPr);
      if (!a || a.reply_to !== wurzel || a.antwort_an !== wurzel) throw new Error(JSON.stringify(a));
      const f = Kommentar.faeden((data || []).map((k) => ({ id: k.id, antwortAuf: k.reply_to })));
      if (!f.find((x) => x.kommentar.id === wurzel)?.antworten.some((x) => x.id === antwortPr)) throw new Error('nicht im Faden');
    });

    await pruefeAsync('4.3d @test bekommt genau EINE Mitteilung „hat auf deinen Kommentar geantwortet" (keine Erwähnung dazu)', async () => {
      const { data, error } = await te.from('notifications').select('art, target_type, target_id, actor_id')
        .eq('user_id', teId).eq('target_id', antwortPr).gte('created_at', seit);
      if (error) throw error;
      const antwort = (data || []).filter((n) => n.art === 'comment' && n.target_type === 'comment' && n.actor_id === prId);
      const erwaehnung = (data || []).filter((n) => n.art === 'mention');
      if (antwort.length !== 1 || erwaehnung.length !== 0) throw new Error(JSON.stringify(data));
    });

    await pruefeAsync('@test antwortet auf die Antwort → hängt an derselben Wurzel', async () => {
      const { data, error } = await te.from('comments')
        .insert({ post_id: beitrag, user_id: teId, text: Kommentar.vorbelegung(prProfil?.handle) + 'zurück', reply_to: wurzel, antwort_an: antwortPr })
        .select('id, reply_to').single();
      if (error) throw error;
      antwortTe = data.id;
      if (data.reply_to !== wurzel) throw new Error('falsche Wurzel');
    });

    await pruefeAsync('4.3d @prueflauf bekommt die Antwort-Mitteilung, aber kein zweites „hat deinen Beitrag kommentiert"', async () => {
      const { data: n1 } = await pr.from('notifications').select('art, target_type')
        .eq('user_id', prId).eq('actor_id', teId).eq('art', 'comment').eq('target_type', 'comment').eq('target_id', antwortTe);
      const { data: n2 } = await pr.from('notifications').select('id, created_at')
        .eq('user_id', prId).eq('actor_id', teId).eq('art', 'comment').eq('target_type', 'post').eq('target_id', beitrag)
        .gte('created_at', seit);
      // Eine „kommentiert"-Mitteilung gibt es für die Wurzel; für die Antwort keine zweite.
      if ((n1 || []).length !== 1) throw new Error('Antwort-Mitteilung fehlt: ' + JSON.stringify(n1));
      if ((n2 || []).length > 1) throw new Error('doppelte „kommentiert": ' + (n2 || []).length);
    });

    await pruefeAsync('Abgewiesen: Antwort mit einer Antwort als Wurzel (eine Ebene)', async () => {
      const { error } = await te.from('comments').insert({ post_id: beitrag, user_id: teId, text: 'x', reply_to: antwortPr });
      if (!error) throw new Error('angenommen');
    });
    await pruefeAsync('Abgewiesen: Antwort über Beiträge hinweg', async () => {
      const { error } = await te.from('comments').insert({ post_id: anderer, user_id: teId, text: 'x', reply_to: wurzel });
      if (!error) throw new Error('angenommen');
    });
    await pruefeAsync('Abgewiesen: Bezug nachträglich ändern', async () => {
      const { error } = await te.from('comments').update({ reply_to: null }).eq('id', antwortTe);
      if (!error) throw new Error('angenommen');
    });

    // Live (4.3c)
    await pruefeAsync('4.3c Live: Antwort mit Zitat im selben Stream', async () => {
      const o = await te.from('stream_comments').insert({ post_id: beitrag, user_id: teId, text: 'Live Prüflauf' }).select('id').single();
      if (o.error) throw o.error;
      live.push([te, o.data.id]);
      const a = await pr.from('stream_comments').insert({ post_id: beitrag, user_id: prId, text: 'Live Antwort', reply_to: o.data.id }).select('id').single();
      if (a.error) throw a.error;
      live.push([pr, a.data.id]);
      const { data } = await te.from('stream_comments').select('id, reply_to').eq('id', a.data.id).maybeSingle();
      if (data?.reply_to !== o.data.id) throw new Error('Bezug nicht lesbar');
      const x = await pr.from('stream_comments').insert({ post_id: anderer, user_id: prId, text: 'x', reply_to: o.data.id }).select('id');
      if (!x.error) {
        live.push([pr, x.data?.[0]?.id]);
        throw new Error('über Streams angenommen');
      }
    });
  } finally {
    if (wurzel) {
      await te.from('comments').delete().eq('id', wurzel);
      const { data } = await pr.from('comments').select('id').in('id', [wurzel, antwortPr, antwortTe].filter(Boolean));
      pruefe('Aufräumen: Wurzel gelöscht, Antworten per cascade mit (gegengeprüft)', (data || []).length === 0, JSON.stringify(data));
      if (antwortPr) {
        const { data: n } = await te.from('notifications').select('id').eq('user_id', teId).eq('target_id', antwortPr);
        pruefe('Aufräumen: Antwort-Mitteilung an @test mit weg', (n || []).length === 0);
      }
    }
    for (const [c, id] of live) if (id) await c.from('stream_comments').delete().eq('id', id);
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_NETZ && !STAND) await teilB();
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
