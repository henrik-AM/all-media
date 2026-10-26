/**
 * Frische Prüfbrowser dürfen Cloud-Medien nicht bei jedem Lauf erneut laden.
 * Kein automatisches Nachfüllen, kein Freischalter: bis ein gemeinsames,
 * messbares Cloud-Budget existiert, bleiben diese Downloads gesperrt.
 * Lokale Medien über localhost/Loopback sind weiterhin erlaubt.
 * Keine Antworten aus einem Cache: Rechteprüfungen dürfen nie durch eine
 * früher gültige Unterschrift oder ein anderes Konto umgangen werden.
 * Schützt Browser-Medien, NICHT Node, Server, Simulator oder die Organisationsquote.
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

async function medienEgressSchuetzen(ziel) {
  if (ziel.__medienEgressSchutz) return ziel;
  ziel.__medienEgressSchutz = true;
  await ziel.route((url) => cloudMedium(url.href), async (route) => {
    // Auch ein funktionaler Test darf mit fehlenden Medien nicht grün enden.
    process.exitCode = 2;
    if (!gesperrt) console.error('ABBRUCH: Cloud-Medium im Prüflauf gesperrt; lokale Testmedien verwenden.');
    gesperrt = true;
    await route.abort('blockedbyclient');
  });
  return ziel;
}

module.exports = { cloudMedium, medienEgressSchuetzen };
