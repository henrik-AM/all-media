/**
 * Wie ein eigener Kommentar in der Liste steht — einmal für App und Website.
 *
 * WARUM GEMEINSAM
 *
 * Die Liste „Meine Kommentare" gibt es seit dem 21.09.2026 auf beiden Seiten.
 * Zwei Fassungen derselben Zeile laufen erfahrungsgemäß auseinander, sobald
 * eine davon angefasst wird — genau das ist bei der Telefonregel und bei der
 * Passwortprüfung passiert, bevor sie hierher gezogen wurden.
 *
 * Beides gehört in die Zeile: ohne den Kommentartext weiß man nicht, was man
 * geschrieben hat, ohne den Beitrag nicht, wo.
 *
 * WARUM DIE UMD-HUELLE
 *
 * Die Prüfläufe _aktionen, _handbuch und _kanal legen den übersetzten
 * App-Code als blob:-Modul in den Browser (test/_modulquelle.js). Dort gibt es
 * kein `require` — ein schlichtes `module.exports` lässt den Lauf mitten
 * drin mit „require is not defined" kippen, nach ein paar bestandenen
 * Prüfungen. Genau das ist am 07.09.2026 mit `telefon.js` passiert und am
 * 21.09.2026 hier wieder. Deshalb dieselbe Hülle wie dort, und der Eintrag in
 * UMD_BAUSTEINE.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Kommentar = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Der Ersatz, wenn ein Beitrag weder Titel noch Beschreibung hat. */
  const ART = { post: 'Foto', reel: 'Video (Hochformat)', clip: 'Video' };

  /** Wo der Kommentar steht — Titel, sonst Beschreibung, sonst die Art. */
  function beitragsName(beitrag) {
    const text = ((beitrag && (beitrag.title || beitrag.description)) || '').trim();
    return text || ART[beitrag && beitrag.kind] || 'Beitrag';
  }

  /** Die fertige Zeile: `„Kommentar" · Beitrag`. */
  function zeile(kommentar) {
    return `„${(kommentar.text || '').trim()}" · ${kommentar.beitrag}`;
  }

  return { ART: ART, beitragsName: beitragsName, zeile: zeile };
});
