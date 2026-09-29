/**
 * Welche Liedzeile gerade gesungen wird — einmal für App und Website.
 *
 * Henrik am 21.09.2026 (Suchen → Songs): „Lyrics zeigen den gesamten Text;
 * gewünscht ist nur die gerade gesungene Zeile/Passage."
 *
 * Bis zum 28.09.2026 teilten App und Website die Zeilen gleichmäßig über die
 * Hörprobe auf, jede Seite mit ihrer eigenen Rechnung. Das war geraten: bei
 * einem Lied mit Vorspiel stand die erste Zeile schon da, bevor jemand sang,
 * und die letzte kam zu früh. Seit Schema 63 kann jeder Sound seine
 * Einsätze mitbringen (`sounds.lyrics_zeiten`, Sekunden ab Beginn der
 * Hörprobe, eine Zahl je nicht-leerer Zeile). Stimmen die nicht — falsche
 * Anzahl, nicht aufsteigend —, fällt die Rechnung auf die gleichmäßige
 * Verteilung zurück und sagt das auch (`getaktet: false`).
 *
 * Leere Einträge im Liedtext sind Strophenabstände und werden nie „gesungen".
 *
 * Die UMD-Hülle aus demselben Grund wie in kommentar.js: die Prüfläufe
 * laden App-Code als blob:-Modul, dort gibt es kein `require`. Eintrag in
 * UMD_BAUSTEINE (app/test/_modulquelle.js) steht.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Liedtext = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Die Zeilen, die gesungen werden — ohne Strophenabstände. */
  function zeilen(lyrics) {
    return (Array.isArray(lyrics) ? lyrics : []).filter(function (z) {
      return typeof z === 'string' && z.trim();
    });
  }

  /** Taugen die Einsätze? Eine Zahl je Zeile, nicht negativ, aufsteigend. */
  function zeitenGueltig(lyrics, zeiten) {
    var n = zeilen(lyrics).length;
    if (!n || !Array.isArray(zeiten) || zeiten.length !== n) return false;
    for (var i = 0; i < n; i++) {
      var t = zeiten[i];
      if (typeof t !== 'number' || !isFinite(t) || t < 0) return false;
      if (i > 0 && t < zeiten[i - 1]) return false;
    }
    return true;
  }

  /**
   * Ab welcher Sekunde jede Zeile gilt. Mit gültigen Einsätzen genau die,
   * sonst gleichmäßig über `gesamt` verteilt.
   */
  function einsaetze(lyrics, zeiten, gesamt) {
    var n = zeilen(lyrics).length;
    if (zeitenGueltig(lyrics, zeiten)) return zeiten.slice();
    var laenge = gesamt > 0 ? gesamt : 0;
    var liste = [];
    for (var i = 0; i < n; i++) liste.push(n ? (laenge * i) / n : 0);
    return liste;
  }

  /**
   * Die Nummer der Zeile, die bei `bei` Sekunden gesungen wird (0-basiert,
   * gezählt ohne Strophenabstände). -1 heißt: es wird gerade nicht gesungen —
   * kein Liedtext, oder das Vorspiel vor dem ersten Einsatz.
   */
  function zeileBei(lyrics, zeiten, bei, gesamt) {
    var start = einsaetze(lyrics, zeiten, gesamt);
    var nr = -1;
    for (var i = 0; i < start.length; i++) {
      if (bei + 1e-6 >= start[i]) nr = i;
      else break;
    }
    return nr;
  }

  /**
   * Alles, was die Anzeige braucht: die Zeile jetzt (oder ''), ihre Nummer,
   * und ob die Einsätze aus der Datenbank kommen.
   */
  function stand(lyrics, zeiten, bei, gesamt) {
    var liste = zeilen(lyrics);
    var nr = zeileBei(lyrics, zeiten, bei, gesamt);
    return {
      nr: nr,
      jetzt: nr >= 0 ? liste[nr] : '',
      anzahl: liste.length,
      getaktet: zeitenGueltig(lyrics, zeiten),
    };
  }

  /**
   * Der ganze Text für die Seite „Lyrics ansehen" (Prototyp-Frame
   * „VSSo + Sound + Lyrics"): jeder Eintrag mit seiner Zeilennummer, die
   * Strophenabstände mit -1.
   */
  function eintraege(lyrics) {
    var nr = 0;
    return (Array.isArray(lyrics) ? lyrics : []).map(function (z) {
      var text = typeof z === 'string' ? z : '';
      if (!text.trim()) return { text: '', nr: -1 };
      return { text: text, nr: nr++ };
    });
  }

  return {
    zeilen: zeilen,
    zeitenGueltig: zeitenGueltig,
    einsaetze: einsaetze,
    zeileBei: zeileBei,
    stand: stand,
    eintraege: eintraege,
  };
});
