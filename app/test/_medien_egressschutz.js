/**
 * Frische Prüfbrowser dürfen Cloud-Medien nicht bei jedem Lauf erneut laden.
 * Kein automatisches Nachfüllen, kein Freischalter: bis ein gemeinsames,
 * messbares Cloud-Budget existiert, bleiben diese Downloads gesperrt.
 * Lokale Medien über localhost/Loopback sind weiterhin erlaubt.
 * Keine Antworten aus einem Cache: Rechteprüfungen dürfen nie durch eine
 * früher gültige Unterschrift oder ein anderes Konto umgangen werden.
 * Schützt Browser-Medien, NICHT Node, Server, Simulator oder die Organisationsquote.
 *
 * Ausnahme feste Beispielmedien (06.11.2026): Die Starter-Storys (Schema 45)
 * zeigen auf `…/object/public/media/beispiel/story-*.jpg`. Seit dem Umzug
 * (Schema 116) liegen sie nur noch bei Bunny; ein lokaler Prüfserver ohne
 * BUNNY_* kann sie nicht unterschreiben und reicht die rohe, tote Adresse
 * durch. Jeder Lauf mit Startseite endete so mit Exit 2 (_aktionen, _kanal),
 * obwohl alle Prüfungen grün waren. Diese Adressen bekommen ein lokales
 * Ersatz — nur unsigniert, nur Ordner `beispiel`, nur Bild- und MP4-Dateien.
 * `beispiel` darf ohnehin jeder sehen; eine Rechteprüfung wird nicht umgangen.
 *
 * Videos (07.11.2026): bis dahin bekam jedes Beispielvideo das 4-s-Testvideo
 * (320×240) — ohne Range-Antwort. Damit fielen player und querformat:
 * Kapitel jenseits von 4 s wurden zu Recht ausgeblendet, die Länge stand auf
 * 0:04 statt 1:00, Spulen blieb bei 0,0 s (Chromium spult nur mit 206), und
 * das Vollbild maß ein 4:3-Bild. Jetzt bekommt jedes Video ein Ersatzbild
 * GLEICHER Länge und Form wie das Original (app/tools/testmedien.js:
 * reel-* 60 s hochkant, clip-01 52 s quer, übrige clip-* 60 s quer), ein
 * einfarbiges H.264 von ~7 KB aus app/test/ersatzmedien/, mit Range-Antworten.
 *
 * Eigene Uploads DIESES Laufs (07.11.2026): Story, Beitrag und Community-Bild
 * lädt der Lauf selbst hoch und bekommt sie unterschrieben zurück; die
 * Oberfläche zeigt sie danach an. Das war bei feedback/erstellen/kamera der
 * einzige verbliebene Grund für Exit 2 (alle Prüfungen grün). Ersatz gibt es
 * nur für Dateien im Namensschema der Uploadwege
 * (`<ordner>/<uuid>-<millisekunden>-<zufall>.<endung>`, web/server/medien.js
 * und app/lib/supabaseStorage.ts) mit Zeitstempel ab Start dieses Prozesses
 * — also nichts aus dem Bestand und nichts von früheren Läufen. Es wird
 * nichts aus der Cloud geladen; die Unterschrift hat der Server schon
 * ausgestellt, eine Rechteprüfung wird nicht übersprungen. Jeder Ersatz steht
 * im Log (`ersetzt (eigener Upload): …`).
 */
const net = require('node:net');
let gesperrt = false;
process.on('exit', () => { if (gesperrt) process.exitCode = 2; });

function cloudMedium(adresse) {
  const url = new URL(adresse);
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  const lokal = host === 'localhost' || host === '::1' ||
    (net.isIP(host) === 4 && host.startsWith('127.'));
  return !lokal && /^\/storage\/v1\/(?:object|render\/image)(?:\/|$)/.test(url.pathname);
}

// Kleinstes gültiges PNG (1×1, grau) als lokales Ersatzbild.
const ERSATZBILD = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGO4BwAAzgDNGzVPuAAAAABJRU5ErkJggg==',
  'base64');

// Ersatzvideos gleicher Länge und Form wie die Originale; erst bei Bedarf gelesen.
const ERSATZ_ORDNER = require('node:path').join(__dirname, 'ersatzmedien');
const ersatzvideos = new Map();
function ersatzvideoName(datei) {
  if (/^reel-/i.test(datei)) return 'hoch-60.mp4';
  if (/^clip-01\./i.test(datei)) return 'quer-52.mp4';
  return 'quer-60.mp4';
}

/** Unsignierte Adresse eines festen Beispielmediums (Schema 43/45)? 'bild', 'video' oder null. */
function festesBeispiel(adresse) {
  const url = new URL(adresse);
  if (url.search || url.hash) return null;
  const treffer = /^\/storage\/v1\/object\/public\/media\/beispiel\/[A-Za-z0-9_-]+\.(jpe?g|png|webp|mp4)$/i.exec(url.pathname);
  if (!treffer) return null;
  return treffer[1].toLowerCase() === 'mp4' ? 'video' : 'bild';
}

const LAUFSTART = Date.now() - 60 * 1000; // eine Minute Spiel für Uhrabweichung zum Server

/** Vom laufenden Prüflauf selbst hochgeladene Datei? 'bild', 'video' oder null. */
function eigenerUploadDiesesLaufs(adresse, ab = LAUFSTART) {
  const url = new URL(adresse);
  const treffer = /^\/storage\/v1\/object\/(?:sign|public)\/media\/(?:messages|stories|avatars|posts|insights)\/[0-9a-f-]{36}-(\d{13})-[a-z0-9]{4,12}\.(jpe?g|png|webp|mp4|mov|webm)$/i.exec(url.pathname);
  if (!treffer || Number(treffer[1]) < ab) return null;
  return /^(mp4|mov|webm)$/i.test(treffer[2]) ? 'video' : 'bild';
}

/**
 * Antwort für ein Beispielmedium. Videos mit Range-Unterstützung: ohne
 * 206/Content-Range lässt Chromium nicht spulen (currentTime bleibt 0).
 */
function ersatzFuer(art, adresse, bereich) {
  if (art === 'bild') return { status: 200, contentType: 'image/png', body: ERSATZBILD };
  const name = ersatzvideoName(new URL(adresse).pathname.split('/').pop());
  if (!ersatzvideos.has(name)) {
    ersatzvideos.set(name, require('node:fs').readFileSync(require('node:path').join(ERSATZ_ORDNER, name)));
  }
  const ganz = ersatzvideos.get(name);
  const t = /^bytes=(\d*)-(\d*)$/.exec(String(bereich || '').trim());
  if (!t || (t[1] === '' && t[2] === '')) {
    return { status: 200, contentType: 'video/mp4', headers: { 'Accept-Ranges': 'bytes' }, body: ganz };
  }
  let von = t[1] === '' ? Math.max(0, ganz.length - Number(t[2])) : Number(t[1]);
  let bis = t[1] === '' || t[2] === '' ? ganz.length - 1 : Math.min(Number(t[2]), ganz.length - 1);
  if (von >= ganz.length || von > bis) {
    return { status: 416, headers: { 'Content-Range': `bytes */${ganz.length}` }, body: '' };
  }
  return {
    status: 206,
    contentType: 'video/mp4',
    headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${von}-${bis}/${ganz.length}` },
    body: ganz.subarray(von, bis + 1),
  };
}

async function medienEgressSchuetzen(ziel) {
  if (ziel.__medienEgressSchutz) return ziel;
  ziel.__medienEgressSchutz = true;
  await ziel.route((url) => cloudMedium(url.href), async (route) => {
    const anfrage = route.request?.();
    const adresse = anfrage?.url();
    const art = adresse && festesBeispiel(adresse);
    if (art) return route.fulfill(ersatzFuer(art, adresse, anfrage.headers?.()?.range));
    const eigen = adresse && eigenerUploadDiesesLaufs(adresse);
    if (eigen) {
      console.log('  ersetzt (eigener Upload): ' + new URL(adresse).pathname);
      return route.fulfill(ersatzFuer(eigen, adresse, anfrage.headers?.()?.range));
    }
    // Auch ein funktionaler Test darf mit fehlenden Medien nicht grün enden.
    process.exitCode = 2;
    if (!gesperrt) console.error('ABBRUCH: Cloud-Medium im Prüflauf gesperrt; lokale Testmedien verwenden.');
    // Pfad ohne Unterschrift/Abfrage nennen, damit die Quelle auffindbar ist.
    if (adresse) console.error('  gesperrt: ' + new URL(adresse).pathname);
    gesperrt = true;
    await route.abort('blockedbyclient');
  });
  return ziel;
}

module.exports = { cloudMedium, festesBeispiel, eigenerUploadDiesesLaufs, ersatzFuer, ersatzvideoName, medienEgressSchuetzen };
