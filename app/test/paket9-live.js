#!/usr/bin/env node
/**
 * Paket 9 (20.11.2026): Live-Abnahme mit ZWEI echten Testkonten gegen den
 * lokalen Website-Server (Port 3000, Code dieses Zweigs) und die echte
 * Supabase-/Bunny-Ablage. Prüft die Wirkung, nicht nur das Speichern:
 *
 *   AF5  Video bis 20:00 hochladen und veröffentlichen, 20:01 abgewiesen,
 *        Dauer kommt aus den Bytes (Clientwert wird überschrieben)
 *   AF3  „Gefällt mir nicht" privat, schließt Like aus, senkt den Rang
 *   AF7  Sichtung eines anderen Kontos erscheint in den eigenen Analysen
 *   AF4  Karussell aus 2 Bildern + 1 Video, zweites Konto bekommt alle drei
 *        signiert (HTTP 200), fremde Medien abgewiesen
 *   AF6  Enge Freunde → Instant → Mitteilung → einmal öffnen → weg
 *
 * Konten: A = Prüfkonto (@prueflauf), B = Testkonto (@test). Nur diese zwei.
 * Räumt alles Angelegte wieder weg (Beiträge, Medien, Liste, Kontakte).
 * Braucht: Belegung testbestand, SUPABASE_TOKEN (Testpaar), Server auf 3000.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { testpaarSichern, testpaarLoesen, TESTKONTO, PRUEFKONTO } = require('./_testpaar');
const { frage } = require('./_aufraeumen');

const UMGEBUNG = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const wert = (n) => (UMGEBUNG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
const URL_ = wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BASIS = process.env.PAKET9_BASIS || 'http://localhost:3000';
const MEDIEN = process.env.PAKET9_MEDIEN || path.join(__dirname, 'ergebnisse-paket9', 'medien');

let ok = 0, fehl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  wahr ? ok++ : fehl++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function konto(email, passwort) {
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
  if (error) throw new Error(email + ': ' + error.message);
  const token = data.session.access_token;
  const api = async (pfad, { methode = 'POST', json, roh, typ } = {}) => {
    const r = await fetch(BASIS + pfad, {
      method: json || roh ? 'POST' : methode,
      headers: { Authorization: 'Bearer ' + token, ...(json ? { 'Content-Type': 'application/json' } : {}), ...(typ ? { 'Content-Type': typ } : {}) },
      body: json ? JSON.stringify(json) : roh,
      signal: AbortSignal.timeout(180000),
    });
    const text = await r.text();
    let daten; try { daten = JSON.parse(text); } catch { daten = { roh: text.slice(0, 200) }; }
    return { status: r.status, ...daten };
  };
  return { client, id: data.user.id, api };
}

const datei = (n) => fs.readFileSync(path.join(MEDIEN, n));
const pfadAus = (url) => String(url || '').split('/storage/v1/object/public/media/')[1];

(async () => {
  const A = await konto('all.media.prueflauf@web.de', PRUEFKONTO_PASS);
  const B = await konto('test@all-media.app', TESTKONTO_PASS);
  pruefe('Konten sind das Testpaar', A.id === PRUEFKONTO && B.id === TESTKONTO);
  const beitraege = [], dateien = [];

  try {
    // ------------------------------------------------------------ AF5 --
    console.log('\nAF5 Reels bis 20 Minuten');
    const hoch = async (k, name, typ, ordner = 'posts') => {
      const r = await k.api('/api/hochladen/datei?ordner=' + ordner, { roh: datei(name), typ });
      if (r.ok && r.pfad) dateien.push([k, r.pfad]);
      return r;
    };
    const zuLang = await hoch(A, 'lang1201.mp4', 'video/mp4');
    pruefe('20:01 wird abgewiesen, verständliche Meldung', !zuLang.ok && /20 Minuten/.test(zuLang.error || ''), zuLang.error);
    const lang = await hoch(A, 'lang1200.mp4', 'video/mp4');
    pruefe('20:00 wird angenommen, Server misst 1200 s', lang.ok && lang.sekunden === 1200, JSON.stringify({ ok: lang.ok, s: lang.sekunden, e: lang.error }));
    const reel = await A.api('/api/eigene/video', { json: { beschreibung: 'Paket 9 Langes Reel', mediaUrl: lang.url, sekunden: 1200, format: 'hoch' } });
    const reelId = reel.beitrag?.id || reel.video?.id || reel.id;
    if (reelId) beitraege.push(reelId);
    const { data: r1 } = await A.client.from('posts').select('id,kind,duration').eq('id', reelId).maybeSingle();
    pruefe('Langes Reel veröffentlicht, Dauer 20:00 aus dem Beleg', r1?.kind === 'reel' && r1?.duration === '20:00', JSON.stringify(r1 || reel).slice(0, 160));

    const kurz = await hoch(A, 'kurz.mp4', 'video/mp4');
    pruefe('Kurzes Video angenommen (5 s)', kurz.ok && kurz.sekunden === 5);
    const falsch = await A.api('/api/eigene/video', { json: { beschreibung: 'Paket 9 Kurz mit falscher Dauer', mediaUrl: kurz.url, sekunden: 1100, format: 'hoch' } });
    const kurzId = falsch.beitrag?.id || falsch.video?.id || falsch.id;
    if (kurzId) beitraege.push(kurzId);
    const { data: r2 } = await A.client.from('posts').select('duration').eq('id', kurzId).maybeSingle();
    pruefe('Clientdauer 18:20 wird durch Bytes-Dauer 0:05 ersetzt', r2?.duration === '0:05', JSON.stringify(r2));
    const direkt = await A.client.from('posts').insert({ user_id: A.id, kind: 'reel', media_url: URL_ + '/storage/v1/object/public/media/' + zuLang.pfad }).select('id');
    pruefe('Direkter REST-Weg ohne Beleg abgewiesen', !!direkt.error, direkt.error?.message);

    // ------------------------------------------------------------ AF3 --
    console.log('\nAF3 Gefällt mir nicht');
    const rang = async (k, id) => (await k.client.rpc('feed_rang', { beitraege: [id], herkunft: 'reels' })).data?.[0]?.punkte;
    const vorher = await rang(B, reelId);
    const dis = await B.api(`/api/videos/${reelId}/dislike`, { json: {} });
    pruefe('Website-Route nimmt „Gefällt mir nicht" an', dis.status === 200 && dis.ok !== false, JSON.stringify(dis).slice(0, 120));
    const eigen = await B.client.from('post_dislikes').select('post_id').eq('post_id', reelId);
    const fremd = await A.client.from('post_dislikes').select('post_id').eq('post_id', reelId);
    pruefe('B sieht die eigene Negativreaktion', eigen.data?.length === 1);
    pruefe('Verfasser A sieht nicht, wer „Gefällt mir nicht" gedrückt hat', (fremd.data || []).length === 0);
    const nachher = await rang(B, reelId);
    pruefe('Rang für B messbar gesenkt (Faktor 0,02)', vorher > 0 && nachher <= vorher * 0.03, `${vorher} → ${nachher}`);
    const rangA = await rang(A, reelId);
    pruefe('Rang für andere unverändert (nur eigene Signale)', rangA > nachher, `A: ${rangA}`);
    await B.api(`/api/videos/${reelId}/like`, { json: {} });
    const nachLike = await B.client.from('post_dislikes').select('post_id').eq('post_id', reelId);
    const like = await B.client.from('post_likes').select('post_id').eq('post_id', reelId).eq('user_id', B.id);
    pruefe('Like schließt „Gefällt mir nicht" aus', (nachLike.data || []).length === 0 && like.data?.length === 1);
    await B.api(`/api/videos/${reelId}/dislike`, { json: {} });
    const nachDis = await B.client.from('post_likes').select('post_id').eq('post_id', reelId).eq('user_id', B.id);
    pruefe('„Gefällt mir nicht" schließt Like aus', (nachDis.data || []).length === 0);
    const zurueck = await B.client.rpc('beitrag_reaktion', { p_post: reelId, p_art: 'dislike' });
    pruefe('Erneutes Tippen nimmt zurück', zurueck.data === false);
    const direktDis = await B.client.from('post_dislikes').insert({ post_id: reelId, user_id: B.id });
    pruefe('Direktes Schreiben gesperrt', !!direktDis.error);

    // ------------------------------------------------------------ AF7 --
    console.log('\nAF7 Konto-Analysen');
    const vorA = await A.api('/api/kontoanalysen', { methode: 'GET' });
    const z7 = (d) => d?.zeitraeume?.[0] || {};
    await B.client.rpc('impression_vermerken', { beitrag: reelId, dauer: 2500, herkunft: 'reels' });
    await B.client.rpc('impression_vermerken', { beitrag: reelId, dauer: 400, herkunft: 'reels' });
    const nachA = await A.api('/api/kontoanalysen', { methode: 'GET' });
    const pp = (z7(nachA).beitraege || []).find((b) => b.id === reelId);
    pruefe('Analysen liefern 7 und 30 Tage', nachA.zeitraeume?.length === 2 && nachA.zeitraeume[1].tage === 30);
    pruefe('Sichtung von B zählt (≥ 1000 ms), 400 ms nicht', pp && Number(pp.aufrufe) === 1 && Number(pp.reichweite) === 1, JSON.stringify(pp));
    pruefe('Sichtzeit wächst um 2500 ms', Number(z7(nachA).sichtzeitMs) - Number(z7(vorA).sichtzeitMs) === 2500, `${z7(vorA).sichtzeitMs} → ${z7(nachA).sichtzeitMs}`);
    pruefe('Nicht-Follower-Aufteilung gezählt', Number(z7(nachA).nichtFollowerAufrufe) + Number(z7(nachA).followerAufrufe) === Number(z7(nachA).aufrufe));
    const fremdAnalyse = await B.api('/api/kontoanalysen', { methode: 'GET' });
    pruefe('B sieht A\'s Beitrag nicht in den eigenen Analysen', !(z7(fremdAnalyse).beitraege || []).some((b) => b.id === reelId));
    const roh = await A.client.from('konto_sichtungen').select('*').limit(1);
    pruefe('Rohdaten der Zuschauer nicht lesbar', !!roh.error);

    // ------------------------------------------------------------ AF4 --
    console.log('\nAF4 Karussell');
    const b1 = await hoch(A, 'bild1.jpg', 'image/jpeg');
    const b2 = await hoch(A, 'bild2.jpg', 'image/jpeg');
    const v1 = await hoch(A, 'kurz.mp4', 'video/mp4');
    const medien = [{ url: b1.url, typ: 'image' }, { url: v1.url, typ: 'video' }, { url: b2.url, typ: 'image' }];
    const kar = await A.api('/api/eigene/beitrag', { json: { beschreibung: 'Paket 9 Karussell', medien } });
    const karId = kar.beitrag?.id;
    if (karId) beitraege.push(karId);
    const { data: kRow } = await A.client.from('posts').select('medien,media_url').eq('id', karId).maybeSingle();
    pruefe('Karussell mit 3 Medien gespeichert, Reihenfolge erhalten', kRow?.medien?.length === 3 && kRow.medien[1].typ === 'video' && kRow.media_url === b1.url, JSON.stringify(kar).slice(0, 160));
    const sicht = await B.api('/api/beitraege/' + karId, { methode: 'GET' });
    const liste = sicht.beitrag?.medien || [];
    pruefe('Zweites Konto bekommt alle 3 Medien', liste.length === 3, JSON.stringify(sicht).slice(0, 200));
    let geladen = 0;
    for (const m of liste) { try { const r = await fetch(m.url, { method: 'GET', signal: AbortSignal.timeout(30000) }); if (r.status === 200) geladen++; } catch {} }
    pruefe('Alle 3 signierten Adressen laden (HTTP 200)', geladen === 3, `${geladen}/3`);
    const fremdK = await B.api('/api/eigene/beitrag', { json: { beschreibung: 'Fremd', medien: [{ url: b1.url, typ: 'image' }] } });
    if (fremdK.beitrag?.id) beitraege.push(fremdK.beitrag.id);
    pruefe('Fremde Medien im Karussell abgewiesen', fremdK.ok === false || fremdK.status >= 400, fremdK.error);
    const weg2 = await A.api('/api/medien/loeschen', { json: { pfad: b2.pfad } });
    pruefe('Drittes Medium ist vor Löschen geschützt (verwendet)', weg2.ok === false, weg2.error);

    // ------------------------------------------------------------ AF6 --
    console.log('\nAF6 Instants');
    await testpaarSichern();
    await A.client.from('enge_freunde').delete().eq('user_id', A.id);
    const liste1 = await A.client.from('enge_freunde').insert({ user_id: A.id, freund_id: B.id });
    pruefe('A setzt B auf Enge Freunde', !liste1.error, liste1.error?.message);
    const listeB = await B.client.from('enge_freunde').select('*').eq('user_id', A.id);
    pruefe('Liste ist privat (B sieht A\'s Liste nicht)', (listeB.data || []).length === 0);
    const ib = await hoch(A, 'instant.jpg', 'image/jpeg', 'instants');
    pruefe('Instant-Foto landet privat im Supabase-Eimer', ib.ok && /^instants\//.test(ib.pfad || ''), ib.error || ib.pfad);
    const gesendet = await A.api('/api/instants', { json: { pfad: ib.pfad, text: 'Paket 9' } });
    pruefe('Instant gesendet', gesendet.ok && !!gesendet.id, gesendet.error);
    const stand = await B.api('/api/instants/stand', { methode: 'GET' });
    pruefe('B: ein ungeöffnetes Instant', Number(stand.ungeoeffnet) >= 1, JSON.stringify(stand));
    const { data: mit } = await B.client.from('notifications').select('id').eq('target_type', 'instant').eq('target_id', gesendet.id);
    pruefe('B bekommt eine Mitteilung', (mit || []).length === 1);
    const bild = await fetch(BASIS + `/api/instants/${gesendet.id}/bild`, { headers: { Authorization: 'Bearer ' + (await B.client.auth.getSession()).data.session.access_token } });
    pruefe('B kann das Bild einmal laden', bild.status === 200 || bild.status === 302, 'HTTP ' + bild.status);
    const roh6 = await B.client.storage.from('media').createSignedUrl(ib.pfad, 3600);
    pruefe('Direkte Storage-Signatur für B gesperrt', !!roh6.error || !roh6.data?.signedUrl);
    const auf = await B.api(`/api/instants/${gesendet.id}/gesehen`, { json: {} });
    pruefe('Öffnen verbraucht das Instant', auf.ok === true, JSON.stringify(auf));
    const auf2 = await B.api(`/api/instants/${gesendet.id}/gesehen`, { json: {} });
    pruefe('Zweites Öffnen nicht möglich', auf2.ok !== true);
    const { data: mit2 } = await B.client.from('notifications').select('id').eq('target_type', 'instant').eq('target_id', gesendet.id);
    pruefe('Mitteilung nach dem Öffnen entfernt', (mit2 || []).length === 0);
    await A.api(`/api/instants/${gesendet.id}/zurueckziehen`, { json: {} });
  } finally {
    // ------------------------------------------------------- Aufräumen --
    for (const id of beitraege) {
      const k = (await A.client.from('posts').select('id').eq('id', id).maybeSingle()).data ? A : B;
      await k.client.from('posts').delete().eq('id', id);
    }
    await A.client.from('enge_freunde').delete().eq('user_id', A.id);
    for (const [k, p] of dateien) if (!p.startsWith('instants/')) await k.api('/api/medien/loeschen', { json: { pfad: p } });
    await testpaarLoesen().catch(() => {});
    const rest = await frage(`select (select count(*) from public.posts where description like 'Paket 9%' and user_id in ('${PRUEFKONTO}','${TESTKONTO}')) as posts,
      (select count(*) from public.instants where absender='${PRUEFKONTO}' and expires_at>now()) as instants,
      (select count(*) from public.notifications where target_type='instant' and user_id='${TESTKONTO}') as mitteilungen`);
    console.log('\nRest nach Aufräumen:', JSON.stringify(rest));
    pruefe('Nichts liegen geblieben', Array.isArray(rest) && Number(rest[0].posts) === 0 && Number(rest[0].instants) === 0 && Number(rest[0].mitteilungen) === 0);
  }
  console.log(`\n${ok} von ${ok + fehl} Prüfungen bestanden`);
  process.exitCode = fehl ? 1 : 0;
})().catch((e) => { console.error('ABBRUCH', e.message); process.exitCode = 1; });
