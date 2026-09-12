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

  /*
   * Den Startbestand herstellen, bevor er gemessen wird.
   *
   * Am 07.09.2026 fiel dieser Lauf im Gesamtlauf mit „Merkliste nicht leer"
   * und „Repost vorhanden" durch und war einzeln gestartet trotzdem gruen.
   * Das ist das Muster aus der Regel „einzeln gruen, gesamt rot": nicht der
   * Code ist schuld, sondern der Bestand. Ein Lauf davor raeumt auf, was
   * dieser hier voraussetzt.
   *
   * Alle anderen Pruefläufe stellen den Bestand zu Beginn ueber den Browser
   * her (`zuruecksetzen(page)`). Dieser hier hat keinen Browser, also ruft er
   * dieselbe Funktion direkt. Ohne das misst er nicht den Startbestand,
   * sondern die Reihenfolge der Laeufe davor.
   */
  await fetch(`${URL}/rest/v1/rpc/zuruecksetzen`, {
    method: 'POST',
    headers: { ...kopf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ziel: ichId }),
  }).catch(() => {});

  // ------------------------------------------------------------ Tabellen --
  /*
   * Sicherheitspruefung 04.09.2026 (Fund 1): `select=*` ist kein Nachweis
   * mehr, dass es eine Tabelle nicht gibt.
   *
   * Seit die Telefonnummer spaltenweise gesperrt ist, antwortet `profiles`
   * auf `select=*` mit 42501 — "permission denied for column phone". Die
   * Tabelle gibt es also sehr wohl; nur darf man nicht alles davon lesen.
   * Vorher las sich das hier als "Tabelle fehlt".
   */
  const fehlend = [];
  for (const tabelle of tabellenAusCode()) {
    const antwort = await hole(`${tabelle}?select=*&limit=1`);
    if (Array.isArray(antwort)) continue;
    // 42501 = das Recht fehlt. Ein fehlendes Recht setzt eine Tabelle voraus.
    if (antwort && antwort.code === '42501') continue;
    fehlend.push(tabelle);
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
  /*
   * Sicherheitspruefung 04.09.2026 (Fund 4 und Fund 6).
   *
   * ZWEI DINGE HABEN SICH GEAENDERT, und beide standen hier vorher falsch:
   *
   * 1. Der Eimer nimmt nur noch Bild-, Video- und Tonformate an. Die alte
   *    Pruefung lud eine .txt hoch und gilt seither als fehlgeschlagen — zu
   *    Recht. Sie laedt jetzt ein winziges PNG, also das, was die App auch
   *    hochlaedt.
   *
   * 2. Der Eimer ist nicht mehr oeffentlich. Die alte Pruefung hiess
   *    "Datei ist oeffentlich lesbar" und war gruen, solange die Luecke
   *    offenstand. Sie ist umgedreht: oeffentlich darf NICHT gehen,
   *    unterschrieben MUSS gehen.
   */
  // Das kleinstmoegliche gueltige PNG (1x1, transparent).
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );
  const pfad = `test/pruefung-${Date.now()}.png`;
  const hoch = await fetch(`${URL}/storage/v1/object/media/${pfad}`, {
    method: 'POST',
    headers: { ...kopf, 'Content-Type': 'image/png' },
    body: pngBytes,
  });
  const hochText = await hoch.text();
  pruefe('Ablage "media": Hochladen geht', hoch.ok, hoch.ok ? '' : `${hoch.status} ${hochText}`);

  // Fund 6: was kein Medium ist, darf gar nicht erst hinein.
  const verboten = await fetch(`${URL}/storage/v1/object/media/test/boese-${Date.now()}.html`, {
    method: 'POST',
    headers: { ...kopf, 'Content-Type': 'text/html' },
    body: '<script>alert(1)</script>',
  });
  pruefe('Ablage "media": HTML wird abgewiesen', !verboten.ok,
    verboten.ok ? 'HTML liess sich hochladen — gespeichertes XSS moeglich' : '');

  if (hoch.ok) {
    const offen = await fetch(`${URL}/storage/v1/object/public/media/${pfad}`);
    pruefe('Ablage "media": NICHT oeffentlich lesbar', !offen.ok,
      offen.ok ? 'Die Datei ist ohne Anmeldung abrufbar' : '');

    const unterschrift = await fetch(`${URL}/storage/v1/object/sign/media/${pfad}`, {
      method: 'POST',
      headers: { ...kopf, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 3600 }),
    });
    const u = await unterschrift.json().catch(() => ({}));
    let gelesen = false;
    if (u.signedURL) gelesen = (await fetch(`${URL}/storage/v1${u.signedURL}`)).ok;
    pruefe('Ablage "media": unterschriebene Adresse liest die Datei', gelesen,
      gelesen ? '' : `${unterschrift.status} ${JSON.stringify(u).slice(0, 120)}`);

    await fetch(`${URL}/storage/v1/object/media/${pfad}`, { method: 'DELETE', headers: kopf });
  }

  // --------------------------------------------------------- Website ------
  if (WEBSITE) {
    const adresse = WEBSITE.replace(/\/$/, '');
    const r = await fetch(`${adresse}/api/bootstrap`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const daten = await r.json().catch(() => ({}));
    pruefe(`Website ${WEBSITE} liefert Inhalte`, r.status === 200 && daten.angemeldet === true,
      r.status !== 200 ? `${r.status}: ${daten.error || ''}` : '');

    /*
     * Welcher Stand laeuft dort? Am 11.09.2026 lagen zwei Arbeitstage als nie
     * committete Arbeitskopie im Ordner — die Website sah dabei genauso aus
     * wie eine, die aktuell ist. Diese Pruefung vergleicht den Stempel der
     * Website mit dem Commit im Ordner und macht den Unterschied sichtbar.
     *
     * Ein Unterschied ist kein Fehler im Code: er bedeutet, dass der Deploy
     * hinterherhinkt oder gar nicht committet wurde. Genau das soll er sagen.
     */
    const vAntwort = await fetch(`${adresse}/api/version`);
    const v = await vAntwort.json().catch(() => ({}));
    pruefe(`Website ${WEBSITE} nennt ihren Stand`,
      vAntwort.status === 200 && typeof v.commit === 'string' && v.commit.length > 0,
      vAntwort.status !== 200 ? `${vAntwort.status} — Endpunkt /api/version fehlt` : '');

    let hier = '';
    try {
      hier = require('child_process')
        .execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: WURZEL, encoding: 'utf8' })
        .trim();
    } catch { /* kein git — dann wird nicht verglichen */ }
    if (hier && v.commit && v.commit !== 'unbekannt') {
      pruefe(`Website laeuft auf dem Stand des Ordners (${hier})`, v.commit === hier,
        v.commit === hier ? '' : `dort ${v.commit}, hier ${hier} — Deploy hinkt hinterher`);
    }
  }

  console.log('');
  console.log(fehler === 0
    ? 'Datenbank und Code passen zusammen.'
    : `${fehler} Pruefung(en) fehlgeschlagen — SUPABASE_EINSPIELEN.sql im SQL-Editor ausfuehren.`);
  process.exit(fehler === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
