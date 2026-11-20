#!/usr/bin/env node
/**
 * Paket 8 / Schema 128 — Zwei-Konten-Beleg gegen die LIVE-Storage-API.
 *
 * A = Prüfkonto (all.media.prueflauf@web.de), B = Testkonto (test@all-media.app).
 * A legt eine Datei als Kontaktfoto unter avatars/ ab (nur Supabase, kein
 * Bunny-Beleg — genau der Fall, den Schema 128 schließt). B darf sie weder
 * unterschreiben noch auflisten noch über medien_leseliste bekommen. A darf.
 * Gegenprobe normaler Weg: B sieht das Profilbild von A, falls A eines hat.
 * Am Ende löscht A die Datei wieder (Rest 0).
 *
 * Start: node test/_paket8_kontaktbild_live.js   (aus app/)
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pw = require('./_testpasswoerter');

const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter((z) => z.includes('=')).map((z) => [z.slice(0, z.indexOf('=')), z.slice(z.indexOf('=') + 1).trim()])
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

let anzahl = 0;
let fehler = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function konto(mail, pass) {
  const c = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await c.auth.signInWithPassword({ email: mail, password: pass });
  if (error) throw new Error(`Anmeldung ${mail}: ${error.message}`);
  return { c, id: data.user.id };
}

(async () => {
  const A = await konto('all.media.prueflauf@web.de', pw.PRUEFKONTO_PASS);
  const B = await konto('test@all-media.app', pw.TESTKONTO_PASS);
  const name = `${A.id}-p8kontakt-${Date.now()}.jpg`;
  const pfad = `avatars/${name}`;
  // Kleinstes gültiges JPEG.
  const jpeg = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64');

  const hoch = await A.c.storage.from('media').upload(pfad, jpeg, { contentType: 'image/jpeg', upsert: false });
  pruefe('A lädt Kontaktfoto nach avatars/ (Supabase)', !hoch.error, hoch.error?.message || pfad.replace(A.id, 'A'));
  try {
    const aSig = await A.c.storage.from('media').createSignedUrl(pfad, 60);
    pruefe('A unterschreibt eigenes Kontaktfoto', !!aSig.data?.signedUrl, aSig.error?.message || '');

    const bSig = await B.c.storage.from('media').createSignedUrl(pfad, 60);
    pruefe('B kann A\'s Kontaktfoto NICHT unterschreiben', !bSig.data?.signedUrl, bSig.error ? `abgewiesen: ${bSig.error.message}` : 'URL ausgestellt!');

    const bListe = await B.c.storage.from('media').list('avatars', { search: name, limit: 10 });
    const gefunden = (bListe.data || []).some((o) => o.name === name);
    pruefe('B findet A\'s Kontaktfoto NICHT beim Auflisten', !gefunden, `${(bListe.data || []).length} Treffer`);

    const bLese = await B.c.rpc('medien_leseliste', { p_pfade: [pfad] });
    pruefe('B bekommt es NICHT über medien_leseliste', !bLese.error && (bLese.data || []).length === 0, bLese.error?.message || `${(bLese.data || []).length} Zeilen`);

    // Normaler Weg: ein Profilbild, das jemand verwendet, bleibt für andere sichtbar.
    const { data: profile } = await B.c.from('profiles').select('id, avatar_url').not('avatar_url', 'is', null).neq('id', B.id).limit(20);
    const basis = `${URL_}/storage/v1/object/public/media/`;
    const fremd = (profile || []).map((p) => p.avatar_url).filter((u) => typeof u === 'string' && u.startsWith(basis)).map((u) => u.slice(basis.length));
    const lesbar = fremd.length ? await B.c.rpc('medien_leseliste', { p_pfade: fremd }) : { data: [] };
    pruefe('B sieht Profilbilder anderer weiter (normaler Weg)', fremd.length > 0 && (lesbar.data || []).length === fremd.length, `${(lesbar.data || []).length}/${fremd.length}`);
  } finally {
    const weg = await A.c.storage.from('media').remove([pfad]);
    const rest = await A.c.storage.from('media').list('avatars', { search: name });
    pruefe('Aufräumen: Datei gelöscht, Rest 0', !weg.error && (rest.data || []).length === 0, weg.error?.message || `${(rest.data || []).length}`);
  }
  console.log(`\n${anzahl - fehler}/${anzahl} bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e.message);
  process.exit(1);
});
