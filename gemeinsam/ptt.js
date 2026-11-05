/**
 * Push to Talk im Unterthema — einmal fuer App und Website (Kasten 8.5/8.6).
 *
 * Henrik am 28.09.2026: „Der Verlauf, wer wann was zum Push to Talk
 * beigetragen hat, soll nicht einfach so im Chat stehen, sondern im Chat
 * eines Unterthemas soll eine Nachricht „Push to Talk" mit Datum und Uhrzeit
 * stehen, und da kann man draufdruecken und den ganzen Verlauf sehen."
 *
 * Die Zeile legt die Datenbank an (Schema 90, ptt_sitzung_zuordnen) — eine
 * je Sitzung. Hier steht nur, wie sie und der Verlauf dahinter aussehen,
 * damit App und Website dasselbe sagen.
 *
 * SITZUNG (muss zu Schema 90 passen): Wortmeldungen im selben Unterthema,
 * zwischen denen jeweils hoechstens SITZUNG_PAUSE_MIN Minuten liegen.
 *
 * UMD-Huelle wie in naehe.js; Eintrag in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) steht.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Ptt = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SITZUNG_PAUSE_MIN = 10;
  var TITEL = 'Push to Talk';
  var TAGE = ['So.', 'Mo.', 'Di.', 'Mi.', 'Do.', 'Fr.', 'Sa.'];

  function zwei(n) {
    return String(n).padStart(2, '0');
  }

  /** „Sa., 10.10.2026 · 14:03" — Datum UND Uhrzeit, wie Henrik es will. */
  function datumZeit(zeitpunkt) {
    if (!zeitpunkt) return '';
    var d = new Date(zeitpunkt);
    if (isNaN(d.getTime())) return '';
    return (
      TAGE[d.getDay()] + ', ' + zwei(d.getDate()) + '.' + zwei(d.getMonth() + 1) + '.' + d.getFullYear() +
      ' · ' + zwei(d.getHours()) + ':' + zwei(d.getMinutes())
    );
  }

  /** Nur die Uhrzeit — fuer die Zeilen im Verlauf. */
  function uhrzeit(zeitpunkt) {
    if (!zeitpunkt) return '';
    var d = new Date(zeitpunkt);
    if (isNaN(d.getTime())) return '';
    return zwei(d.getHours()) + ':' + zwei(d.getMinutes()) + ':' + zwei(d.getSeconds());
  }

  /** Die Zeile im Chat: „Push to Talk · Sa., 10.10.2026 · 14:03". */
  function zeile(zeitpunkt) {
    var wann = datumZeit(zeitpunkt);
    return wann ? TITEL + ' · ' + wann : TITEL;
  }

  /** „3 s", „1:05 min" */
  function dauer(sekunden) {
    var s = Math.max(0, Math.round(Number(sekunden) || 0));
    if (s < 60) return s + ' s';
    return Math.floor(s / 60) + ':' + zwei(s % 60) + ' min';
  }

  /** Leertext, wenn hinter einer Sitzung (noch) nichts lesbar ist. */
  var LEER = 'Keine Wortmeldungen sichtbar';

  return {
    SITZUNG_PAUSE_MIN: SITZUNG_PAUSE_MIN,
    TITEL: TITEL,
    LEER: LEER,
    datumZeit: datumZeit,
    uhrzeit: uhrzeit,
    zeile: zeile,
    dauer: dauer,
  };
});
