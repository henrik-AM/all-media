#!/usr/bin/env node
const KONTENPOOL = require('./_kontenpool').konten(); // Schema 138: Konten des Prüfplatzes
// Echte, kleine Bunny-Datei unter einem eigenen Testpfad. Moderationsrolle
// vorübergehend nur für das zweite, sonst unbeteiligte Prüfkonto.
const assert = require('node:assert/strict');
const { pruefAnmelden } = require('./_anmelden');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { frage } = require('./_aufraeumen');
const { TESTKONTO, PRUEFKONTO } = require('./_testpaar');

process.loadEnvFile(path.join(__dirname, '../.env.local'));
const basis = new URL(process.env.ZIEL || 'http://localhost:3300');
assert.ok(['http://localhost:3300', 'https://all-media-website.onrender.com'].includes(basis.origin));
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const meldung = randomUUID();
const ziel = randomUUID();
const datei = fs.readFileSync(path.join(__dirname, '_testbild.png'));
const weg = '/api/moderation/meldungen/' + meldung + '/medium';
let bestanden = 0;

function ok(name, bedingung) {
  assert.ok(bedingung, name);
  console.log('OK ' + name);
  bestanden++;
}

async function anmelden(email, password, id) {
  const c = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await pruefAnmelden(c, { email, password });
  assert.ok(!error && data.user?.id === id, 'Testkonto bestätigt');
  return { c, token: data.session.access_token };
}

async function api(pfad, konto, optionen = {}) {
  const res = await fetch(new URL(pfad, basis), {
    ...optionen, headers: { ...(konto ? { Authorization: 'Bearer ' + konto.token } : {}), ...optionen.headers },
    signal: AbortSignal.timeout(20000),
  });
  return { status: res.status, cache: res.headers.get('cache-control'), body: await res.json() };
}

async function sql(query) {
  const r = await frage(query);
  assert.ok(Array.isArray(r), 'Prüfdatenbank antwortet');
  return r;
}

(async () => {
  const a = await anmelden(KONTENPOOL.partner, TESTKONTO_PASS, TESTKONTO);
  const b = await anmelden(KONTENPOOL.pruef, PRUEFKONTO_PASS, PRUEFKONTO);
  const rolle = await sql(`select count(*)::int as anzahl from public.moderatoren where user_id = '${PRUEFKONTO}'`);
  assert.equal(rolle[0].anzahl, 0, 'Prüfkonto ohne bestehende Moderationsrolle');
  const alterszeile = await sql(`select 1 from public.konto_alter where user_id = '${PRUEFKONTO}'`);
  assert.equal(alterszeile.length, 0, 'Prüfkonto ohne bestehende Alterszeile');

  let pfad, rolleVersucht = false, belegt = false;
  try {
    const hoch = await api('/api/hochladen/datei?ordner=messages', a, {
      method: 'POST', headers: { 'Content-Type': 'image/png' }, body: datei,
    });
    pfad = hoch.body.pfad;
    assert.ok(pfad?.startsWith('messages/' + TESTKONTO + '-') &&
      /^messages\/[a-z0-9.-]+\.png$/.test(pfad), 'Eigener Medienpfad');
    const adresse = url.replace(/\/$/, '') + '/storage/v1/object/public/media/' + pfad;
    ok('Eigener Upload ist ein registriertes Bunny-Medium', hoch.status === 200 && hoch.body.ok &&
      hoch.body.url === adresse && /^https:\/\/[^/]+\.b-cdn\.net\//.test(hoch.body.anzeige || ''));
    const { data: normal, error } = await b.c.rpc('medien_leseliste', { p_pfade: [pfad] });
    ok('Unbeteiligtes Prüfkonto hat kein gewöhnliches Leserecht', !error && normal?.length === 0);

    console.log('Eigener Prüfpfad: ' + pfad);
    belegt = true;
    await sql(`select set_config('allmedia.melden', 'an', true);
      insert into public.reports
        (id, reported_by, target_type, target_id, reason, kategorie, ziel_profil, beleg)
      values ('${meldung}', '${TESTKONTO}', 'message', '${ziel}',
        'Synthetische Paket-8-Prüfmeldung', 'regelverstoss', '${TESTKONTO}',
        jsonb_build_object('medien', '${adresse}'));
      select 1;`);
    const bericht = await sql(`select beleg->>'medien' = '${adresse}' as richtig
      from public.reports where id = '${meldung}'`);
    assert.equal(bericht[0]?.richtig, true, 'Eigene Prüfmeldung enthält den privaten Pfad');
    const gesperrt = await api(weg, b);
    ok('Unbeteiligtes Prüfkonto erhält beim Abruf keine Belegadresse', !gesperrt.body.url && gesperrt.body.grund === 'nicht_erlaubt');

    rolleVersucht = true;
    await sql(`insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
      values ('${PRUEFKONTO}', '1990-01-01', 'DE', 16, 'frei');
      insert into public.moderatoren (user_id) values ('${PRUEFKONTO}');`);
    let erlaubt;
    try {
      const lesbar = await b.c.rpc('medien_leseliste', { p_pfade: [pfad] });
      ok('Allgemeines Leserecht bleibt auch mit Moderationsrolle gesperrt', !lesbar.error && lesbar.data?.length === 0);
      assert.equal((await b.c.rpc('ist_moderator')).data, true, 'Prüfkonto ist vorübergehend zuständige Moderation');
      erlaubt = await api(weg, b);
      if (!erlaubt.body.url) console.log('Abrufstatus ' + erlaubt.status + ', Grund ' + (erlaubt.body.grund || 'unbekannt'));
    } finally {
      await sql(`delete from public.moderatoren where user_id = '${PRUEFKONTO}';
        delete from public.konto_alter where user_id = '${PRUEFKONTO}' and geburtsdatum = '1990-01-01';`);
      rolleVersucht = false;
    }
    ok('Moderation erhält hinter der Meldung eine Bunny-Adresse ohne Antwortcache',
      erlaubt.status === 200 && erlaubt.cache === 'no-store' && erlaubt.body.typ === 'bild' &&
      typeof erlaubt.body.url === 'string' && erlaubt.body.sekunden === 300);
    const signiert = new URL(erlaubt.body.url);
    const verbleibend = Number(signiert.searchParams.get('expires')) - Math.floor(Date.now() / 1000);
    ok('Link gilt höchstens 300 Sekunden für genau den Prüfpfad',
      signiert.origin === new URL(hoch.body.anzeige).origin && signiert.pathname === '/' + pfad &&
      verbleibend > 0 && verbleibend <= 300);
    const res = await fetch(signiert, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    const bytes = Buffer.from(await res.arrayBuffer());
    ok('Bunny liefert die Originalbytes', res.ok && bytes.equals(datei));
    const wiederZu = await api(weg, b);
    ok('Entzug der Rolle sperrt einen erneuten Abruf', !wiederZu.body.url && wiederZu.body.grund === 'nicht_erlaubt');
    const protokoll = await sql(`select count(*)::int as anzahl from public.moderation_protokoll
      where meldung_id = '${meldung}' and wer = '${PRUEFKONTO}' and was = 'medium_angesehen'`);
    ok('Genau ein protokollierter Moderationsabruf', protokoll[0].anzahl === 1);
  } finally {
    try {
      if (rolleVersucht || belegt) {
      await sql(`delete from public.moderatoren where user_id = '${PRUEFKONTO}';
        delete from public.konto_alter where user_id = '${PRUEFKONTO}' and geburtsdatum = '1990-01-01';
        delete from public.moderation_protokoll where meldung_id = '${meldung}';
        delete from public.reports where id = '${meldung}' and reported_by = '${TESTKONTO}';`);
      const rest = await sql(`select (select count(*) from public.moderatoren where user_id = '${PRUEFKONTO}')
         + (select count(*) from public.konto_alter where user_id = '${PRUEFKONTO}')
         + (select count(*) from public.reports where id = '${meldung}')
         + (select count(*) from public.moderation_protokoll where meldung_id = '${meldung}') as anzahl`);
      ok('Eigene Rolle, Prüfmeldung und Protokollzeile entfernt', Number(rest[0]?.anzahl) === 0);
      }
    } finally {
    if (pfad && /^messages\/[a-z0-9.-]+\.png$/.test(pfad) && pfad.startsWith('messages/' + TESTKONTO + '-')) {
      const weg = await api('/api/medien/loeschen', a, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pfad }),
      });
      const r = await sql(`select count(*)::int as anzahl from public.medien_objekte where pfad = '${pfad}'`);
      ok('Eigene Bunny-Datei und Registrierung entfernt', weg.body.ok === true && r[0].anzahl === 0);
    }
    }
  }
  console.log(`${bestanden}/11 bestanden`);
})().catch((e) => { console.error('FEHL ' + e.message); process.exitCode = 1; });
