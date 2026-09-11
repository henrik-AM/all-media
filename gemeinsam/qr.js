/**
 * All Media — der QR-Code, mit dem man sich als Kontakt austauscht.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 07.09.2026: „Kontakt hinzufügen nur über Telefonnummer/QR-Code,
 * nicht Username." Der Benutzername ist damit als Weg zu einem Kontakt raus —
 * übrig bleiben zwei Wege, und der zweite braucht eine Schreibweise, auf die
 * sich App und Website einigen. Genau die steht hier.
 *
 * WAS IM CODE STEHT
 *
 * Die eigene Telefonnummer, nichts weiter:
 *
 *     allmedia:+49 151 2345678
 *
 * WARUM DIE NUMMER UND NICHT DIE KENNUNG
 *
 * Weil damit beide Wege derselbe sind. Ein gelesener Code endet in genau der
 * Suche, die auch das Eingabefeld auslöst (`finde_per_nummer` in der
 * Datenbank) — es gibt keinen zweiten Weg zu einem fremden Profil, der
 * anders geprüft wird als der erste. Eine Kennung im Code hätte einen
 * gebraucht: „gib mir das Profil zu dieser id", und den gäbe es dann für
 * jede id, nicht nur für die im Code.
 *
 * Die Nummer verrät der Code nur dem, dem man ihn hinhält. Wer ihn zeigt,
 * zeigt seine Nummer — das ist dasselbe, was „Kontakt per Nummer" ohnehin
 * bedeutet.
 *
 * WARUM ES EINE .js-DATEI IST
 *
 * Wie `telefon.js` und `spalten.js`: Node, Metro und der Browser lesen
 * dieselbe Datei ohne Übersetzungsschritt. Die Typen liefert qr.d.ts.
 *
 * Das Bild selbst entsteht NICHT hier — im Browser zeichnet es der Server
 * (`/api/qr.svg`), in der App die Komponente `QrCode`. Beide benutzen dafür
 * dasselbe Paket `qrcode`; hier steht nur, was hineingeschrieben wird.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.QrKontakt = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PRAEFIX = 'allmedia:';

  /** Was in den eigenen QR-Code geschrieben wird. */
  function link(nummer) {
    var roh = typeof nummer === 'string' ? nummer.trim() : '';
    return roh ? PRAEFIX + roh : '';
  }

  /**
   * Die Nummer aus einem gelesenen Code.
   *
   * Nimmt auch eine nackte Nummer an: manche Leute haben einen QR-Code aus
   * einer anderen App, in dem schlicht ihre Nummer steht. Den abzulehnen,
   * weil das Präfix fehlt, wäre Strenge ohne Gewinn — geprüft wird die Nummer
   * ohnehin danach.
   *
   * Alles andere gibt null: ein Link auf eine Webseite ist kein Kontakt.
   */
  function nummerAus(text) {
    var roh = typeof text === 'string' ? text.trim() : '';
    if (!roh) return null;

    if (roh.toLowerCase().indexOf(PRAEFIX) === 0) {
      var rest = roh.slice(PRAEFIX.length).trim();
      return rest || null;
    }

    // Nackte Nummer: dieselbe Form, die auch das Eingabefeld annimmt.
    if (/^[+\d][\d\s/()-]{4,}$/.test(roh)) return roh;

    return null;
  }

  return { PRAEFIX: PRAEFIX, link: link, nummerAus: nummerAus };
});
