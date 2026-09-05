/**
 * Übersetzten App-Code zu EINER Datei ohne Importe zusammenlegen.
 *
 * WARUM ES DAS GIBT
 *
 * Drei Prüfläufe (_aktionen, _handbuch, _gleichstand) führen echten App-Code
 * im Browser aus: `aktionen.ts` bzw. `daten.ts` werden mit tsc übersetzt und
 * als `blob:`-Modul in die Seite geladen. Das ging nur, solange diese Dateien
 * ausschließlich Typen importierten — Typen verschwinden beim Übersetzen, und
 * übrig blieb eine Datei ohne jeden Import. Genau so stand es auch als
 * Annahme in _gleichstand.js.
 *
 * Mit der Sicherheitsprüfung vom 04.09.2026 stimmt das nicht mehr: beide
 * Dateien importieren jetzt `signiereMedien` aus `./medien` — einen echten
 * Wert, keinen Typ. Ein `blob:`-Modul hat keine Herkunft, an der ein
 * relativer Pfad hängen könnte, und der Browser meldet
 * „Failed to resolve module specifier './medien'".
 *
 * Hier wird deshalb aus zwei übersetzten Dateien eine gemacht: die Exporte
 * des Hilfsmoduls werden zu gewöhnlichen Deklarationen, die Importzeile im
 * Hauptteil fällt weg. Kein Bündler nötig, und die Annahme „eine Datei ohne
 * Importe" gilt wieder.
 */

const fs = require('fs');
const path = require('path');

/** Eine bestimmte übersetzte Datei im Bauordner finden. */
function finde(ordner, name) {
  for (const eintrag of fs.readdirSync(ordner, { withFileTypes: true })) {
    const voll = path.join(ordner, eintrag.name);
    if (eintrag.isDirectory()) {
      const treffer = finde(voll, name);
      if (treffer) return treffer;
    } else if (eintrag.name === name) {
      return voll;
    }
  }
  return null;
}

/**
 * Den Quelltext einer übersetzten Datei holen, mit `medien.js` verschmolzen.
 *
 * @param {string} bauOrdner  Ausgabeordner von tsc
 * @param {string} name       etwa 'aktionen.js' oder 'daten.js'
 * @returns {string|null}
 */
function zusammengelegt(bauOrdner, name) {
  const haupt = finde(bauOrdner, name);
  if (!haupt) return null;

  let quelltext = fs.readFileSync(haupt, 'utf8');

  const medien = finde(bauOrdner, 'medien.js');
  if (!medien) return quelltext; // Nichts zu verschmelzen.

  // Aus `export function x` wird `function x` — im Blob gibt es nur ein Modul.
  const hilfsteil = fs.readFileSync(medien, 'utf8').replace(/^export\s+/gm, '');

  // Die Importzeile fliegt raus, egal ob mit oder ohne Strichpunkt.
  quelltext = quelltext.replace(
    /^\s*import\s*\{[^}]*\}\s*from\s*['"]\.\/medien(?:\.js)?['"];?\s*$/gm,
    ''
  );

  return `${hilfsteil}\n${quelltext}`;
}

module.exports = { zusammengelegt, finde };
