// Prueft die echte Datenbank — nicht den Code, sondern das, was in Supabase
// wirklich steht.
//
// Warum es diesen Test gibt: Am 31.08.2026 meldete die Website beim Anmelden
// "Server antwortet mit 500". Der Code war in Ordnung, die Schemadateien
// waren in Ordnung, node test/_schema.js sagte PASS — nur eingespielt war
// davon nichts. Die Tabellen "follows", "places", "sounds" und ein Dutzend
// weitere gab es in der Datenbank schlicht nicht.
//
// _schema.js vergleicht Code gegen SQL-Dateien. Dieser Test hier vergleicht
// Code gegen die laufende Datenbank. Erst beide zusammen sagen etwas aus.
//
// Start:  node test/_datenbank.js
//         node test/_datenbank.js https://all-media-website.onrender.com
//
// Ohne Adresse wird nur die Datenbank geprueft, mit Adresse zusaetzlich der
// /api/bootstrap der Website.

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');

// Zugang: dieselben Werte wie in app/.env.local. Der publishable key ist fuer
// den Client gedacht und steckt ohnehin im App-Bundle.
const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Das Testkonto aus SUPABASE_SCHEMA_7_testkonto.sql.
const KONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };

const WEBSITE = process.argv[2] || '';

let fehler = 0;
const pruefe = (name, bedingung, zusatz = '') => {
  if (!bedingung) fehler++;
  console.log((bedingung ? 'PASS  ' : 'FAIL  ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/** Welche Tabellen der Code anspricht — aus den Quelldateien gelesen. */
function tabellenAusCode() {
  const quellen = [
    'web/server/supabase-api.js',
    'web/server/sync-handlers.js',
    'app/lib/daten.ts',
  ];
  const namen = new Set();
  for (const datei of quellen) {
    const text = fs.readFileSync(path.join(WURZEL, datei), 'utf8');
    for (const t of text.matchAll(/\.from\('([a-z_]+)'\)/g)) namen.add(t[1]);
  }
  // "media" ist ein Storage-Eimer, keine Tabelle — der wird unten einzeln
  // geprueft.
  namen.delete('media');
  return [...namen].sort();
}

async function main() {
  if (!URL || !KEY) {
    console.log('FAIL  Zugangsdaten fehlen — app/.env.local pruefen');
    process.exit(1);
  }

  // ------------------------------------------------------------ Anmelden --
  const anmeldung = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: KONTO.email, password: KONTO.passwort }),
  }).then((r) => r.json());

  pruefe(`Testkonto ${KONTO.email} kann sich anmelden`, Boolean(anmeldung.access_token),
    anmeldung.error_description || anmeldung.msg || '');
  if (!anmeldung.access_token) {
    console.log('\nOhne Anmeldung ist nichts weiter pruefbar. Konto anlegen oder Passwort pruefen.');
    process.exit(1);
  }

  const token = anmeldung.access_token;
  const ichId = anmeldung.user.id;
  const kopf = { apikey: KEY, Authorization: `Bearer ${token}` };
  const hole = (pfad) => fetch(`${URL}/rest/v1/${pfad}`, { headers: kopf }).then((r) => r.json());

  // ------------------------------------------------------------ Tabellen --
  const fehlend = [];
  for (const tabelle of tabellenAusCode()) {
    const antwort = await hole(`${tabelle}?select=*&limit=1`);
    if (!Array.isArray(antwort)) fehlend.push(tabelle);
  }
  pruefe('Alle Tabellen aus dem Code gibt es in der Datenbank', fehlend.length === 0,
    fehlend.length ? 'fehlen: ' + fehlend.join(', ') : '');

  // ----------------------------------------------------- Beispielinhalte --
  const zaehle = async (pfad) => {
    const r = await fetch(`${URL}/rest/v1/${pfad}`, {
      headers: { ...kopf, Prefer: 'count=exact', Range: '0-0' },
    });
    return Number((r.headers.get('content-range') || '0/0').split('/')[1]) || 0;
  };

  pruefe('Beispielprofile vorhanden (Anna, Bob, ...)', (await zaehle('profiles?demo=is.true&select=id')) >= 9);
  pruefe('Beispielbeitraege vorhanden',                (await zaehle('posts?demo=is.true&select=id')) >= 18);
  pruefe('Sounds vorhanden',                           (await zaehle('sounds?select=id')) >= 5);
  pruefe('Standorte vorhanden',                        (await zaehle('places?select=id')) >= 5);
  pruefe('Hashtags vorhanden',                         (await zaehle('hashtags?select=tag')) >= 8);
  pruefe('Oeffentliche Communitys vorhanden',          (await zaehle('communities?visibility=eq.public&select=id')) >= 1);

  // ------------------------------------- Eigene Inhalte des Testkontos ---
  const eigen = `user_id=eq.${ichId}`;
  pruefe('Eigener Foto-Beitrag',        (await zaehle(`posts?${eigen}&kind=eq.post&select=id`)) >= 1);
  pruefe('Eigenes Video im Hochformat', (await zaehle(`posts?${eigen}&kind=eq.reel&select=id`)) >= 1);
  pruefe('Eigenes Video im Querformat', (await zaehle(`posts?${eigen}&kind=eq.clip&format=eq.standard&select=id`)) >= 1);
  pruefe('Eigenes 360-Video',           (await zaehle(`posts?${eigen}&kind=eq.clip&format=eq.360&select=id`)) >= 1);
  pruefe('Eigener Livebeitrag',         (await zaehle(`posts?${eigen}&kind=eq.clip&format=eq.live&select=id`)) >= 1);
  pruefe('Eigene Story',                (await zaehle(`stories?${eigen}&select=id`)) >= 1);
  pruefe('Merkliste nicht leer',        (await zaehle(`saves?${eigen}&select=post_id`)) >= 1);
  pruefe('Repost vorhanden',            (await zaehle(`reposts?${eigen}&select=post_id`)) >= 1);
  pruefe('Kontakte vorhanden',          (await zaehle(`contacts?${eigen}&select=contact_id`)) >= 3);
  pruefe('Chats vorhanden',             (await zaehle(`chat_members?${eigen}&select=chat_id`)) >= 3);
  pruefe('Mitteilungen vorhanden',      (await zaehle(`notifications?${eigen}&select=id`)) >= 1);
  pruefe('Punkt auf der Freundeskarte', (await zaehle(`friend_pins?${eigen}&select=user_id`)) >= 1);

  const profil = await hole(`profiles?id=eq.${ichId}&select=name,handle,bio,highlights,playlists,spende`);
  const p = Array.isArray(profil) ? profil[0] : null;
  pruefe('Profil des Testkontos ausgefuellt',
    Boolean(p && p.bio && (p.highlights || []).length && (p.playlists || []).length),
    p ? `${p.name} ${p.handle}` : 'kein Profil');

  // --------------------------------------------------------- Storage ------
  //
  // Nicht nachfragen, ob es den Eimer gibt — das darf nur der geheime
  // Schluessel, ein normales Konto bekommt dort immer "Bucket not found".
  // Stattdessen genau das tun, was die App tut: hochladen, wieder lesen,
  // aufraeumen. Nur das beantwortet die Frage wirklich.
  const pfad = `test/pruefung-${Date.now()}.txt`;
  const hoch = await fetch(`${URL}/storage/v1/object/media/${pfad}`, {
    method: 'POST',
    headers: { ...kopf, 'Content-Type': 'text/plain' },
    body: 'Pruefung',
  });
  const hochText = await hoch.text();
  pruefe('Ablage "media": Hochladen geht', hoch.ok, hoch.ok ? '' : `${hoch.status} ${hochText}`);

  if (hoch.ok) {
    const zurueck = await fetch(`${URL}/storage/v1/object/public/media/${pfad}`);
    pruefe('Ablage "media": Datei ist oeffentlich lesbar', zurueck.ok, zurueck.ok ? '' : String(zurueck.status));
    await fetch(`${URL}/storage/v1/object/media/${pfad}`, { method: 'DELETE', headers: kopf });
  }

  // --------------------------------------------------------- Website ------
  if (WEBSITE) {
    const r = await fetch(`${WEBSITE.replace(/\/$/, '')}/api/bootstrap`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const daten = await r.json().catch(() => ({}));
    pruefe(`Website ${WEBSITE} liefert Inhalte`, r.status === 200 && daten.angemeldet === true,
      r.status !== 200 ? `${r.status}: ${daten.error || ''}` : '');
  }

  console.log('');
  console.log(fehler === 0
    ? 'Datenbank und Code passen zusammen.'
    : `${fehler} Pruefung(en) fehlgeschlagen — SUPABASE_EINSPIELEN.sql im SQL-Editor ausfuehren.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
