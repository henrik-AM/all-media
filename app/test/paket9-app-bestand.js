#!/usr/bin/env node
const KONTENPOOL = require('./_kontenpool').konten(); // Schema 138: Konten des Prüfplatzes
/**
 * Paket 9: Bestand für die App-Bilder im Prüfsimulator (Konto @test).
 *   node test/paket9-app-bestand.js anlegen   Karussell + 20-min-Reel (@test),
 *                                             Instant von @prueflauf an @test
 *   node test/paket9-app-bestand.js weg       alles wieder entfernen
 * Nur die zwei eigenen Testkonten. Uploads über den lokalen Server (3000).
 */
const fs = require('fs');
const { pruefAnmelden } = require('./_anmelden');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { testpaarSichern, testpaarLoesen, TESTKONTO } = require('./_testpaar');

const UMG = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
const BASIS = 'http://localhost:3000';
const MEDIEN = path.join(__dirname, 'ergebnisse-paket9', 'medien');

async function konto(email, pass) {
  const c = createClient(wert('EXPO_PUBLIC_SUPABASE_URL'), wert('EXPO_PUBLIC_SUPABASE_ANON_KEY'), { auth: { persistSession: false } });
  const { data, error } = await pruefAnmelden(c, { email, password: pass });
  if (error) throw error;
  const t = data.session.access_token;
  const api = async (p, { json, roh, typ } = {}) => (await fetch(BASIS + p, { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': json ? 'application/json' : typ }, body: json ? JSON.stringify(json) : roh })).json();
  return { c, id: data.user.id, api };
}

(async () => {
  const T = await konto(KONTENPOOL.partner, TESTKONTO_PASS);
  const P = await konto(KONTENPOOL.pruef, PRUEFKONTO_PASS);
  if (process.argv[2] === 'weg') {
    for (const k of [T, P]) {
      const { data } = await k.c.from('posts').select('id,media_url,medien').eq('user_id', k.id).or('description.like.Paket 9%,description.like.Packet 9%');
      for (const b of data || []) await k.c.from('posts').delete().eq('id', b.id);
      for (const b of data || []) for (const u of [b.media_url, ...(b.medien || []).map((m) => m.url)]) {
        const p = String(u || '').split('/storage/v1/object/public/media/')[1];
        if (p) await k.api('/api/medien/loeschen', { json: { pfad: p } });
      }
    }
    const { data: ins } = await P.c.from('instants').select('id').eq('absender', P.id);
    for (const i of ins || []) await P.api(`/api/instants/${i.id}/zurueckziehen`, { json: {} });
    await P.c.from('enge_freunde').delete().eq('user_id', P.id);
    await testpaarLoesen();
    console.log('weg');
    return;
  }
  const hoch = (k, n, typ, ordner = 'posts') => k.api('/api/hochladen/datei?ordner=' + ordner, { roh: fs.readFileSync(path.join(MEDIEN, n)), typ });
  const b1 = await hoch(T, 'bild1.jpg', 'image/jpeg'), v1 = await hoch(T, 'kurz.mp4', 'video/mp4'), b2 = await hoch(T, 'bild2.jpg', 'image/jpeg');
  const kar = await T.api('/api/eigene/beitrag', { json: { beschreibung: 'Paket 9 Karussell in der App', medien: [{ url: b1.url, typ: 'image' }, { url: v1.url, typ: 'video' }, { url: b2.url, typ: 'image' }] } });
  console.log('Karussell', kar.beitrag?.id || kar.error);
  const lang = await hoch(T, 'lang1200.mp4', 'video/mp4');
  const reel = await T.api('/api/eigene/video', { json: { beschreibung: 'Paket 9 Reel 20 Minuten', mediaUrl: lang.url, sekunden: 1200, format: 'hoch' } });
  console.log('Reel', (reel.beitrag || reel.video)?.id || reel.error);
  await testpaarSichern();
  await P.c.from('enge_freunde').delete().eq('user_id', P.id);
  await P.c.from('enge_freunde').insert({ user_id: P.id, freund_id: TESTKONTO });
  const ib = await hoch(P, 'instant.jpg', 'image/jpeg', 'instants');
  const ins = await P.api('/api/instants', { json: { pfad: ib.pfad, text: 'Paket 9 Instant' } });
  console.log('Instant', ins.id || ins.error);
})().catch((e) => { console.error(e.message); process.exitCode = 1; });
