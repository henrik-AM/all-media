#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kästen 5 und 8 — Agent „Anruf + PTT".
 *
 *   5.1  Anruf ist ehrlich eine Vorschau: keine simulierte Verbindung, keine
 *        hochgezählte Dauer, Hinweis „Vorschau" auf dem Bildschirm.
 *   5.2  Ausgehender Anruf steht beim Start im Chat — Person, Gruppe,
 *        Community-Chat, Unterthema.
 *   5.3  Eingehend genauso („Eingehender … · verpasst" / „Max hat … gestartet").
 *   5.4  Bei beiden Beteiligten gleich: eine Zeile in der Datenbank.
 *   8.1  Kein PTT-Knopf auf der Community-Startseite.
 *   8.2  PTT im Chat des #-Unterthemas.
 *   8.3  Erste Wortmeldung einer Sitzung → Mitteilung „Push to Talk
 *        beitreten?" an Mitglieder mit Schalter an, nie an den Sprecher.
 *   8.4  Schalter je Community — gespeichert (Spalte) UND wirksam (Mitteilung).
 *   8.5  EINE Zeile „Push to Talk" je Sitzung im Unterthema.
 *   8.6  Antippen zeigt den Verlauf (sitzung_id → alle Wortmeldungen).
 *   8.7  Zwei Konten: Mitteilung nur bei eingeschaltetem Schalter.
 *
 * TEILE
 *
 *   A  Quelltext + Schema-Entwürfe 89/90 + gemeinsame Bausteine (ohne Netz).
 *   B  WIRKUNG mit zwei Testkonten direkt gegen Supabase (setzt Schema 89
 *      und 90 voraus):
 *        - @prueflauf („B") legt eine eigene Prüfcommunity mit zwei
 *          Unterthemen an, @test („A") tritt bei.
 *        - Anruf: B vermerkt einen Anruf im Unterthema; A liest dieselbe
 *          Zeile (art, 'gestartet', Dauer 0, Absender B). Gibt es einen
 *          Zweierchat zwischen A und B, dasselbe dort.
 *        - PTT, Schalter AUS: A schaltet aus, B spricht in Unterthema 1 →
 *          genau eine Zeile „Push to Talk", A bekommt KEINE Mitteilung.
 *        - PTT, Schalter AN: A schaltet an (Gegenprobe: Spalte gelesen),
 *          B spricht zweimal in Unterthema 2 → eine Zeile, beide
 *          Wortmeldungen mit derselben sitzung_id, A bekommt GENAU EINE
 *          Mitteilung art 'ptt' mit Ziel Unterthema 2, B (Sprecher) keine.
 *        - A darf keine Sitzungszeile selbst schreiben (Regel aus 90).
 *        - Aufräumen: Prüfcommunity löschen (cascade), Gegenprobe.
 *
 * NUR Testkonten (@test / @prueflauf), eigene Prüfcommunity — echte
 * Mitglieder hören nichts (Merkregel „Fotografie hat echte Mitglieder").
 *
 * UNGETESTET geschrieben am 10./11.10.2026 (Supabase gesperrt, 402; Schemas
 * 89/90 nicht eingespielt). Teil A lief lokal.
 *
 * Start:  node test/k28-anruf-ptt.js   (npm run test:k28-anruf-ptt)
 *         OHNE_NETZ=1 nur Teil A.
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const ohneKommentar = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

/* ------------------------------------------------------------- A Quelltext */
function teilA() {
  const CALL = ohneKommentar(lies('app/screens/messenger/CallScreen.tsx'));
  const CHAT = lies('app/screens/messenger/ChatDetailScreen.tsx');
  const APP = lies('app/App.tsx');
  const AKT = lies('app/lib/aktionen.ts');
  const DET = lies('app/screens/communities/CommunityDetailScreen.tsx');
  const OPT = lies('app/components/CommunityOptionenSheet.tsx');
  const WEB = lies('web/public/app.js');
  const WEBO = ohneKommentar(WEB);
  const SRV = lies('web/server/sync-handlers.js');
  const SAPI = lies('web/server/supabase-api.js');
  const SAPP = lies('web/server/app.js');
  const PROF = lies('app/contexts/ProfilContext.tsx');
  const HTML = lies('web/public/index.html');
  const MOD = lies('app/test/_modulquelle.js');

  console.log('\nA1  Kasten 5.1 — ehrlich');
  pruefe('App: kein Zustand „verbunden", keine hochgezählte Dauer',
    !/'verbunden'/.test(CALL) && !/setDauer/.test(CALL));
  pruefe('App: kein „Annehmen" auf der Anruferseite', !/styles\.annehmen/.test(CALL));
  pruefe('App: Vorschau-Hinweis sichtbar', /Vorschau: Sprache und Bild werden noch nicht übertragen/.test(CALL));
  const call = WEBO.slice(WEBO.indexOf('function openCall('), WEBO.indexOf('function openCall(') + 6000);
  pruefe('Website: kein Selbst-Abnehmen (setTimeout(verbinden …)) und kein Annehmen-Knopf',
    !/setTimeout\(verbinden/.test(call) && !/data-anruf="annehmen"/.test(call));
  pruefe('Website: Vorschau-Hinweis sichtbar', /id="anrufVorschau">Vorschau: Sprache und Bild werden noch nicht übertragen/.test(call));

  console.log('\nA2  Kasten 5.2–5.4 — Eintrag beim Start, überall');
  pruefe('App: Eintrag beim Start (useEffect → anrufStarten)', /useEffect\(\(\) => \{[\s\S]{0,300}anrufStarten\(/.test(CALL));
  pruefe('App: anrufStarten schreibt gestartet/Dauer 0 in messages ODER community_channel_messages',
    /export async function anrufStarten[\s\S]*?anruf_status: 'gestartet'[\s\S]*?anruf_dauer: 0[\s\S]*?community_channel_messages[\s\S]*?from\('messages'\)/.test(AKT));
  pruefe('App: Anruf aus dem Chat kennt chatId bzw. kanalId', /const ort = kanal \? \{ kanalId: overlay\.chat\.id \} : \{ chatId: overlay\.chat\.id \}/.test(APP));
  pruefe('App: Anrufzeile nutzt gemeinsam/anruf.js', /Anruf\.text\(item\.anruf, anrufOpts\)/.test(CHAT));
  pruefe('Website: /api/anruf beim Start, mit chatId/kanalId', /fetch\('\/api\/anruf'/.test(call) && /kanalId: ort\.kanalId/.test(call));
  pruefe('Website: Anrufknöpfe im Unterthema', /data-kanalcall="video"/.test(WEB) && /\{ kanalId: kanal\.id \}/.test(WEB));
  pruefe('Website: Anrufzeile nutzt window.Anruf (Chat und Unterthema)',
    /window\.Anruf\.text\(m\.anruf, opts\)/.test(WEB) && /if \(m\.anruf\) return anrufZeile\(m, \{ eigen: m\.from === 'me', gruppe: true \}\)/.test(WEB));
  pruefe('Server: handleAnrufStarten + Route', /const handleAnrufStarten = handler/.test(SRV) && /app\.post\('\/api\/anruf'/.test(SAPP));
  pruefe('Kanal-Laden mit Anrufspalten und Rückfall 42703 (App + Server)',
    (() => { const d = lies('app/lib/daten.ts'); return /'anruf_art, anruf_status, anruf_dauer'/.test(d) && /'ptt_sitzung'/.test(d); })() && /42703/.test(SAPI));

  const Anruf = require(path.join(WURZEL, 'gemeinsam/anruf.js'));
  const g = { art: 'video', status: 'gestartet', dauer: 0 };
  pruefe('Satz: eigen zu zweit', Anruf.text(g, { eigen: true, gruppe: false }) === 'Ausgehender Videoanruf · gestartet');
  pruefe('Satz: fremd zu zweit = verpasst (nie „angenommen")', Anruf.text(g, { eigen: false, gruppe: false }) === 'Eingehender Videoanruf · verpasst');
  pruefe('Satz: Gruppe fremd', Anruf.text({ ...g, art: 'audio' }, { eigen: false, gruppe: true, name: 'Max' }) === 'Max hat einen Sprachanruf gestartet');
  pruefe('Kein Satz mit Dauer für „gestartet"', !/\d{2}:\d{2}/.test(Anruf.text(g, { eigen: true, gruppe: false })));
  pruefe('anruf.js und ptt.js in UMD_BAUSTEINE und index.html',
    /\['anruf', 'Anruf'\]/.test(MOD) && /\['ptt', 'Ptt'\]/.test(MOD) && /gemeinsam\/anruf\.js/.test(HTML) && /gemeinsam\/ptt\.js/.test(HTML));

  console.log('\nA3  Kasten 8 — Push to Talk');
  pruefe('8.1 App: kein PushToTalk auf der Community-Startseite', !/<PushToTalk/.test(ohneKommentar(DET)));
  const kanalSeite = WEBO.slice(WEBO.indexOf('async function renderCommunityChannels'), WEBO.indexOf('function neuesUnterthema'));
  pruefe('8.1 Website: kein #pttKnopf auf der Community-Startseite', kanalSeite.length > 0 && !/pttKnopf/.test(kanalSeite));
  pruefe('8.2 App: PushToTalk im Unterthema mit kanalId', /<PushToTalk[\s\S]{0,200}kanalId=\{chat\.id\}/.test(CHAT));
  const kchat = WEBO.slice(WEBO.indexOf('async function renderCommunityChat'), WEBO.indexOf('function geteiltKarte'));
  pruefe('8.2 Website: #pttKnopf im Unterthema, kanalId geht mit',
    /id="pttKnopf"/.test(kchat) && /pttEinhaengen\(community\.id, kanal\.id/.test(kchat) && /kanalId,\n/.test(WEB));
  pruefe('8.4 App: Schalter im Community-Blatt, speichert mit .select()',
    /accessibilityLabel="Push-to-Talk-Benachrichtigung"/.test(OPT) &&
      /update\(\{ ptt_benachrichtigung: an \}\)[\s\S]{0,200}\.select\('ptt_benachrichtigung'\)/.test(AKT));
  pruefe('8.4 Website: Schalter im Community-Blatt + Route',
    /data-commptt/.test(WEB) && /\/ptt-benachrichtigung`/.test(WEB) && /app\.post\('\/api\/communities\/:id\/ptt-benachrichtigung'/.test(SAPP));
  pruefe('8.3 Satz „Push to Talk beitreten?" in App und Server gleich',
    /spricht in „\$\{pttCommunity\}“ – Push to Talk beitreten\?/.test(PROF) && /spricht in „\$\{kanalCommunity\.get/.test(SAPP));
  pruefe('8.3 Glocke führt ins Unterthema (App + Website)',
    /ziel\.art === 'channel'/.test(APP) && /ziel\.art === 'channel'/.test(WEB));
  pruefe('8.5 App: Sitzungszeile antippbar → PttVerlaufSheet',
    /if \(item\.pttSitzung\)/.test(CHAT) && /<PttVerlaufSheet/.test(CHAT));
  pruefe('8.5/8.6 Website: Sitzungszeile → openPttVerlauf, Route', /if \(m\.pttSitzung\) return pttSitzungZeile\(m\)/.test(WEB) &&
    /openPttVerlauf\(b\.dataset\.pttsitzung/.test(WEB) && /app\.get\('\/api\/ptt\/sitzung\/:id'/.test(SAPP));
  const Ptt = require(path.join(WURZEL, 'gemeinsam/ptt.js'));
  pruefe('8.5 Zeile hat Datum UND Uhrzeit', /^Push to Talk · \w+\., \d{2}\.\d{2}\.\d{4} · \d{2}:\d{2}$/.test(Ptt.zeile('2026-10-10T12:03:00Z')));

  console.log('\nA4  Schema-Entwürfe');
  const s89 = lies('SUPABASE_SCHEMA_89_anrufe_ueberall.sql');
  const s90 = lies('SUPABASE_SCHEMA_90_push_to_talk.sql');
  pruefe('89: Zustand gestartet, Dauer 0 erzwungen', /'gestartet', 'beendet', 'verpasst', 'abgelehnt'/.test(s89) && /messages_anruf_gestartet_ohne_dauer/.test(s89));
  pruefe('89: Anrufspalten im Unterthema + nicht_leer', /community_channel_messages\s+add column if not exists anruf_art/.test(s89) && /or anruf_art is not null/.test(s89));
  pruefe('90: Schalter-Spalte, Vorgabe aus', /ptt_benachrichtigung boolean not null default false/.test(s90));
  pruefe('90: Sitzung ≤ 10 Minuten, Zeile nur bei neuer Sitzung, dort Mitteilung',
    new RegExp(`interval '${Ptt.SITZUNG_PAUSE_MIN} minutes'`).test(s90) &&
      /if v_sitzung is null then[\s\S]*?ptt_sitzung\)[\s\S]*?ptt_mitteilen\(/.test(s90));
  pruefe('90: Empfänger nur mit Schalter, nicht Sprecher, nicht stumm/blockiert, sichtbar_fuer, frei',
    /m\.ptt_benachrichtigung/.test(s90) && /m\.user_id <> p_sprecher/.test(s90) && /is_muted/.test(s90) &&
      /public\.blocks/.test(s90) && /sichtbar_fuer\(m\.user_id, 'ptt', p_sprecher\)/.test(s90) && /konto_stand\(m\.user_id\) = 'frei'/.test(s90));
  pruefe('90: Clients schreiben keine Sitzungszeile (restriktive Regel)', /as restrictive[\s\S]{0,80}with check \(not ptt_sitzung\)/.test(s90));
  const fn = [...s90.matchAll(/create or replace function public\.(\w+)\(/g)].map((m) => m[1]);
  const offen = fn.filter((f) => !new RegExp(`revoke execute on function public\\.${f}\\([^)]*\\)\\s+from public, anon, authenticated`).test(s90));
  pruefe(`90: alle ${fn.length} Funktionen ohne EXECUTE für public/anon/authenticated`, offen.length === 0, offen.join(', '));
}

/* --------------------------------------------------------- B Wirkung (Netz) */
async function teilB() {
  const { createClient } = require('@supabase/supabase-js');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const { nurTestkonto } = require('./_nur_testkonten');
  const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    : '';
  const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
  const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
  const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  const konto = async (mail, pass) => {
    const c = createClient(URL, KEY, { auth: { persistSession: false } });
    const { data, error } = await c.auth.signInWithPassword({ email: nurTestkonto(mail), password: pass });
    if (error) throw new Error(mail + ': ' + error.message);
    return { c, id: data.user.id };
  };

  console.log('\nB  Wirkung mit zwei Konten (setzt Schema 89 + 90 voraus)');
  const A = await konto('test@all-media.app', TESTKONTO_PASS);
  const B = await konto('all.media.prueflauf@web.de', PRUEFKONTO_PASS);
  const warte = (ms) => new Promise((r) => setTimeout(r, ms));

  // Prüfcommunity von B, öffentlich, zwei Unterthemen; A tritt bei.
  const name = 'Prüfcommunity PTT ' + Date.now();
  const { data: com, error: eCom } = await B.c.from('communities')
    .insert({ name, topic: 'Prüflauf', visibility: 'public', created_by: B.id }).select().single();
  pruefe('B legt Prüfcommunity an', !eCom && !!com, eCom?.message);
  if (!com) return;
  try {
    await B.c.from('community_members').insert({ community_id: com.id, user_id: B.id });
    const k = async (slug) => (await B.c.from('community_channels')
      .insert({ community_id: com.id, slug, name: slug, topics: [] }).select('id').single()).data;
    const k1 = await k('ptt-aus');
    const k2 = await k('ptt-an');
    pruefe('Zwei Unterthemen angelegt', !!k1 && !!k2);
    const { error: eJoin } = await A.c.from('community_members').insert({ community_id: com.id, user_id: A.id });
    pruefe('A tritt bei', !eJoin, eJoin?.message);

    // ---- 5.2–5.4 Anruf im Unterthema
    const { data: anruf, error: eAnruf } = await B.c.from('community_channel_messages')
      .insert({ channel_id: k1.id, sender_id: B.id, text: '', anruf_art: 'video', anruf_status: 'gestartet', anruf_dauer: 0 })
      .select('id').single();
    pruefe('5.2 B vermerkt Videoanruf im Unterthema', !eAnruf && !!anruf, eAnruf?.message);
    if (anruf) {
      const { data: gesehen } = await A.c.from('community_channel_messages')
        .select('sender_id, anruf_art, anruf_status, anruf_dauer').eq('id', anruf.id).maybeSingle();
      pruefe('5.3/5.4 A sieht dieselbe Zeile (B, video, gestartet, 0)',
        gesehen && gesehen.sender_id === B.id && gesehen.anruf_art === 'video' && gesehen.anruf_status === 'gestartet' && gesehen.anruf_dauer === 0,
        JSON.stringify(gesehen));
    }
    const { error: eFake } = await B.c.from('community_channel_messages')
      .insert({ channel_id: k1.id, sender_id: B.id, text: '', anruf_art: 'audio', anruf_status: 'gestartet', anruf_dauer: 180 });
    pruefe('5.1 „gestartet" mit Dauer wird abgewiesen', !!eFake);

    // Zweierchat A–B, falls vorhanden.
    const { data: meineB } = await B.c.from('chat_members').select('chat_id, chats(is_group)').eq('user_id', B.id);
    const kandidaten = (meineB || []).filter((m) => m.chats && !m.chats.is_group).map((m) => m.chat_id);
    const { data: gemeinsam } = kandidaten.length
      ? await A.c.from('chat_members').select('chat_id').eq('user_id', A.id).in('chat_id', kandidaten.slice(0, 100))
      : { data: [] };
    const zweier = (gemeinsam || [])[0]?.chat_id;
    if (zweier) {
      const { data: m, error: eM } = await B.c.from('messages')
        .insert({ chat_id: zweier, sender_id: B.id, text: '', anruf_art: 'audio', anruf_status: 'gestartet', anruf_dauer: 0 })
        .select('id').single();
      pruefe('5.2 B vermerkt Sprachanruf im Zweierchat', !eM && !!m, eM?.message);
      if (m) {
        const { data: ms } = await A.c.from('messages').select('sender_id, anruf_status').eq('id', m.id).maybeSingle();
        pruefe('5.4 A sieht ihn im selben Chat', ms && ms.sender_id === B.id && ms.anruf_status === 'gestartet');
        await B.c.from('messages').delete().eq('id', m.id);
      }
    } else {
      console.log('  --   kein Zweierchat A–B im Bestand, Messenger-Teil übersprungen');
    }

    const mitteilungenA = async (kanal) =>
      ((await A.c.from('notifications').select('id, art, actor_id, target_type, target_id')
        .eq('user_id', A.id).eq('art', 'ptt').eq('target_id', kanal)).data || []);
    const ptt = (kanal) => B.c.from('ptt_messages')
      .insert({ community_id: com.id, channel_id: kanal, sender_id: B.id, audio_url: 'https://example.invalid/ptt.m4a', dauer: 2 })
      .select('id, sitzung_id').single();

    // ---- 8.4 gespeichert
    const setze = async (an) => (await A.c.from('community_members').update({ ptt_benachrichtigung: an })
      .eq('community_id', com.id).eq('user_id', A.id).select('ptt_benachrichtigung')).data;
    const aus = await setze(false);
    pruefe('8.4 gespeichert: Schalter AUS steht in der Datenbank', aus && aus.length === 1 && aus[0].ptt_benachrichtigung === false);

    // ---- 8.7 Schalter AUS → keine Mitteilung
    const p1 = await ptt(k1.id);
    pruefe('8.2 B spricht in Unterthema 1', !p1.error && !!p1.data?.sitzung_id, p1.error?.message);
    await warte(800);
    pruefe('8.7 Schalter AUS: A bekommt KEINE Mitteilung', (await mitteilungenA(k1.id)).length === 0);

    // ---- 8.4 wirksam / 8.3 / 8.7 Schalter AN
    const an = await setze(true);
    pruefe('8.4 gespeichert: Schalter AN steht in der Datenbank', an && an.length === 1 && an[0].ptt_benachrichtigung === true);
    const p2 = await ptt(k2.id);
    const p3 = await ptt(k2.id);
    pruefe('8.2 B spricht zweimal in Unterthema 2', !p2.error && !p3.error);
    pruefe('Sitzung: beide Wortmeldungen in derselben Sitzung', p2.data?.sitzung_id && p2.data.sitzung_id === p3.data?.sitzung_id);
    await warte(800);
    const mA = await mitteilungenA(k2.id);
    pruefe('8.3/8.4 wirksam/8.7: A bekommt GENAU EINE Mitteilung „ptt" (erste Wortmeldung)', mA.length === 1, String(mA.length));
    pruefe('8.3 Absender B, Ziel Unterthema', mA[0] && mA[0].actor_id === B.id && mA[0].target_type === 'channel');
    const { data: mB } = await B.c.from('notifications').select('id').eq('user_id', B.id).eq('art', 'ptt').eq('target_id', k2.id);
    pruefe('8.3 nie an den Sprecher selbst', (mB || []).length === 0);

    // ---- 8.5 eine Zeile je Sitzung, 8.6 Verlauf
    const { data: zeilen } = await A.c.from('community_channel_messages')
      .select('id, ptt_sitzung, created_at').eq('channel_id', k2.id).eq('ptt_sitzung', true);
    pruefe('8.5 A sieht in Unterthema 2 GENAU EINE Zeile „Push to Talk"', (zeilen || []).length === 1, String((zeilen || []).length));
    if (zeilen && zeilen[0]) {
      pruefe('8.5 die Zeile ist die Sitzung', zeilen[0].id === p2.data?.sitzung_id);
      const { data: verlauf } = await A.c.from('ptt_messages').select('id, sender_id').eq('sitzung_id', zeilen[0].id);
      pruefe('8.6 A sieht dahinter beide Wortmeldungen (wer, wann, was)', (verlauf || []).length === 2 && verlauf.every((v) => v.sender_id === B.id));
    }
    const { error: eSelbst } = await A.c.from('community_channel_messages')
      .insert({ channel_id: k2.id, sender_id: A.id, text: '', ptt_sitzung: true });
    pruefe('Eine Sitzungszeile kann niemand selbst schreiben', !!eSelbst);

    // Mitteilung von A wieder weg (falls erlaubt) — sonst räumt zuruecksetzen() auf.
    await A.c.from('notifications').delete().eq('user_id', A.id).eq('art', 'ptt').eq('target_id', k2.id);
  } finally {
    await B.c.from('communities').delete().eq('id', com.id);
    const { data: rest } = await B.c.from('communities').select('id').eq('id', com.id);
    pruefe('Prüfcommunity ist wieder weg', (rest || []).length === 0);
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_NETZ) {
    try {
      await teilB();
    } catch (e) {
      pruefe('Teil B lief durch', false, e.message || String(e));
    }
  }
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden.`);
  process.exit(fehler === 0 ? 0 : 1);
})();
