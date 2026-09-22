/**
 * All Media — der Benutzername, wie App und Website ihn beide prüfen.
 *
 * WARUM ES DAS GIBT
 *
 * Bis zum 22.09.2026 vergaben die beiden Oberflächen den Namen verschieden:
 * die Website ließ ihn wählen und fragte `handle_frei`, die App leitete ihn
 * still aus der E-Mail-Adresse ab und prüfte nichts. Wer sich in der App
 * registrierte, hieß danach anders, als er es auf der Website gewählt hätte.
 * Jetzt wählen beide, und beide zeigen schon beim Tippen, ob der Name frei ist.
 *
 * WAS HIER GEPRÜFT WIRD
 *
 * Nur die Form — ob der Name frei ist, weiß allein die Datenbank
 * (`handle_frei`, Schema 4/39). Die Form vorab zu prüfen spart Anfragen:
 * `handle_frei` zählt je Anschluss höchstens dreißig in der Stunde mit.
 *
 * WER DIESELBE REGEL KENNT
 *
 * `public.handle_gueltig` und `public.handle_normal` aus SUPABASE_SCHEMA_4.sql.
 * Wer hier etwas ändert, ändert es dort mit.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Benutzername = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var MUSTER = /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/;

  var REGEL_TEXT = 'Drei bis vierundzwanzig Zeichen: Buchstaben, Ziffern, Punkt und Unterstrich';

  /** Wie `handle_normal`: außen beschnitten, ohne führendes @, klein. */
  function normal(eingabe) {
    var roh = typeof eingabe === 'string' ? eingabe.trim() : '';
    return roh.replace(/^@+/, '').trim().toLowerCase();
  }

  /** Gibt null zurück, wenn die Form passt, sonst den Grund auf Deutsch. */
  function pruefe(eingabe) {
    var n = normal(eingabe);
    if (!n) return 'Bitte einen Benutzernamen eingeben';
    // Zwei Punkte hintereinander lehnt `handle_gueltig` ebenfalls ab.
    if (!MUSTER.test(n) || n.indexOf('..') !== -1) return REGEL_TEXT;
    return null;
  }

  return {
    REGEL_TEXT: REGEL_TEXT,
    normal: normal,
    pruefe: pruefe,
  };
});
