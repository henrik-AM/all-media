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
 * Ersatzbild — nur unsigniert, nur Ordner `beispiel`, nur Bilddateien.
 * `beispiel` darf ohnehin jeder sehen; eine Rechteprüfung wird nicht umgangen.
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

/** Unsignierte Adresse eines festen Beispielbilds (Schema 43/45)? */
function festesBeispiel(adresse) {
  const url = new URL(adresse);
  return !url.search && !url.hash &&
    /^\/storage\/v1\/object\/public\/media\/beispiel\/[A-Za-z0-9_-]+\.(?:jpe?g|png|webp)$/i.test(url.pathname);
}

async function medienEgressSchuetzen(ziel) {
  if (ziel.__medienEgressSchutz) return ziel;
  ziel.__medienEgressSchutz = true;
  await ziel.route((url) => cloudMedium(url.href), async (route) => {
    const adresse = route.request?.().url();
    if (adresse && festesBeispiel(adresse)) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: ERSATZBILD });
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

module.exports = { cloudMedium, festesBeispiel, medienEgressSchuetzen };
