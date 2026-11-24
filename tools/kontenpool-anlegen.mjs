// Legt die Pool-Konten für parallele Prüfläufe an (Schema 138, 24.11.2026).
//
// Platz 1 ist das bisherige Paar (all.media.prueflauf@web.de + test@all-media.app).
// Plätze 2–4 bekommen je ein Prüfkonto prueflaufN@all-media.app und ein
// Partnerkonto testN@all-media.app. Registrierung ist bis zum Launch gesperrt,
// darum über die Admin-API (Service-Role-Schlüssel aus web/.env.local).
//
// Start (im Repo-Hauptordner):
//   SUPABASE_TOKEN=sbp_… node tools/kontenpool-anlegen.mjs
//
// Braucht AM_POOL_PASS in app/.env.local (ein Passwort für alle Pool-Konten).
// Läuft mehrfach ohne Schaden: vorhandene Konten werden übersprungen.
// Danach je Konto: Einwilligungen wie bei Platz 1 (quelle 'nachtrag'),
// Telefonnummer, Startbestand über zuruecksetzen() beim ersten Prüflauf.

import fs from 'node:fs';
import path from 'node:path';

const HIER = path.dirname(new URL(import.meta.url).pathname);
const wert = (datei, name) => {
  const p = path.join(HIER, '..', datei);
  const t = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
  return ((t.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '').trim();
};

const URL_ = process.env.SUPABASE_URL || wert('app/.env.local', 'EXPO_PUBLIC_SUPABASE_URL');
const DIENST = process.env.SUPABASE_SERVICE_ROLE_KEY || wert('web/.env.local', 'SUPABASE_SERVICE_ROLE_KEY');
const PASS = process.env.AM_POOL_PASS || wert('app/.env.local', 'AM_POOL_PASS');
const TOKEN = process.env.SUPABASE_TOKEN || '';
const PROJEKT = (URL_.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

for (const [n, w] of [['EXPO_PUBLIC_SUPABASE_URL', PROJEKT], ['SUPABASE_SERVICE_ROLE_KEY', DIENST],
  ['AM_POOL_PASS', PASS], ['SUPABASE_TOKEN', TOKEN]]) {
  if (!w) { console.error(`ABBRUCH  ${n} fehlt.`); process.exit(2); }
}

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(30000),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`SQL HTTP ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

const KONTEN = [];
for (const platz of [2, 3, 4]) {
  KONTEN.push({ mail: `prueflauf${platz}@all-media.app`, handle: `prueflauf${platz}`, name: `Prüflauf ${platz}`, nummer: `+49 1550 00002${platz}1` });
  KONTEN.push({ mail: `test${platz}@all-media.app`, handle: `test${platz}`, name: `Test Nutzer ${platz}`, nummer: `+49 1550 00002${platz}2` });
}

const vorhanden = new Map((await sql(
  `select id, email from auth.users where email in (${KONTEN.map((k) => `'${k.mail}'`).join(',')})`
)).map((z) => [z.email, z.id]));

let fehler = 0;
for (const k of KONTEN) {
  let id = vorhanden.get(k.mail);
  if (!id) {
    const r = await fetch(`${URL_}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { apikey: DIENST, Authorization: `Bearer ${DIENST}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: k.mail, password: PASS, email_confirm: true,
        user_metadata: { name: k.name, handle: k.handle, phone: k.nummer },
      }),
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id) { console.error(`FEHLER  ${k.mail}: HTTP ${r.status} ${j.msg || j.message || ''}`); fehler++; continue; }
    id = j.id;
    console.log(`angelegt  ${k.mail}`);
  } else {
    console.log(`vorhanden ${k.mail}`);
  }

  // Einwilligungen wie Platz 1 (sonst hält die Website am Zustimmungsschritt).
  await sql(`
    insert into public.einwilligungen (user_id, dokument, version, pruefsumme, art, durch, quelle, am)
    select '${id}', e.dokument, e.version, e.pruefsumme, e.art, '${id}', 'nachtrag', now()
      from public.einwilligungen e
     where e.user_id = '62616c1d-82e2-4ee4-aab9-950e40e438a4'
       and not exists (select 1 from public.einwilligungen x where x.user_id = '${id}' and x.dokument = e.dokument)`);
}

// Altersstand wie Platz 1: ohne Geburtsdatum legt der Auslöser
// alter_bei_anmeldung() 'ohne_datum' an, und nur_freigegebene (Schema 52)
// sperrt das Konto dann für jede Tabelle. Platz 1 hat gar keine Zeile.
await sql(`
  delete from public.konto_alter k using auth.users u
   where u.id = k.user_id and k.status = 'ohne_datum'
     and u.email in (${KONTEN.map((k) => `'${k.mail}'`).join(',')})`);

// Gegenprobe: Profil, Testkonto, Einwilligungen, freigegeben.
const stand = await sql(`
  select u.email, p.handle, public.ist_testkonto(u.id) testkonto,
         public.konto_stand(u.id) = 'frei' frei,
         (select count(*) from public.einwilligungen e where e.user_id = u.id) einw
    from auth.users u left join public.profiles p on p.id = u.id
   where u.email in (${KONTEN.map((k) => `'${k.mail}'`).join(',')}) order by u.email`);
console.table(stand);
const schlecht = stand.filter((z) => !z.handle || !z.testkonto || !z.frei || Number(z.einw) < 3);
if (stand.length !== KONTEN.length || schlecht.length || fehler) {
  console.error(`ABBRUCH  ${KONTEN.length - stand.length + schlecht.length + fehler} Konto/Konten unvollständig.`);
  process.exit(1);
}
console.log(`OK  ${stand.length} Pool-Konten vollständig.`);
