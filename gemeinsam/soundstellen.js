/**
 * Wellenform und meist verwendete Stellen eines Sounds — einmal für App und
 * Website.
 *
 * Kasten 7.5 (Feedback 21.09.2026), Prototyp-Frame „VSSo + Sound": unter dem
 * Songbild eine Wellenform aus 75 Balken, blau umrandete Kästen um die meist
 * verwendeten Stellen, darunter die Legende „▢ : meist verwendete
 * Song-/Soundstelle".
 *
 * Henrik am 29.09.2026: Die Markierung muss nicht sofort da sein — es gibt
 * noch keine echten Nutzer. Sie muss erscheinen, sobald die ersten Leute
 * den Sound benutzen. Deshalb kommt sie nur aus echten Beiträgen
 * (sound_stellen() in Schema 67, demo-Beiträge zählen nicht); ohne Nutzung
 * gibt es keinen Kasten und keine Legende.
 *
 * Die Wellenform kommt aus der Tondatei (sounds.wellenform,
 * web/tools/wellenform.py). Fehlt sie, stehen gleich hohe Balken da statt
 * einer erfundenen Form.
 *
 * UMD-Hülle wie in liedtext.js; Eintrag in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) steht.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.SoundStellen = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Wie im Prototyp. */
  var BALKEN = 75;
  /** Breite eines Abschnitts in sound_stellen() (Schema 67). */
  var ABSCHNITT = 5;
  /** Höchstens so viele Kästen; im Prototyp sind es zwei. */
  var KAESTEN = 2;

  /**
   * Höhe jedes Balkens, 0..1. Hat die Datenbank eine andere Anzahl Werte,
   * wird auf BALKEN umgerechnet; ohne Werte alle gleich (0.5).
   */
  function balken(wellenform, anzahl) {
    var n = anzahl || BALKEN;
    var werte = Array.isArray(wellenform)
      ? wellenform.map(Number).filter(function (w) { return isFinite(w); })
      : [];
    var aus = [];
    for (var i = 0; i < n; i++) {
      if (!werte.length) {
        aus.push(0.5);
        continue;
      }
      var w = werte[Math.min(werte.length - 1, Math.floor((i * werte.length) / n))];
      aus.push(Math.max(0.08, Math.min(1, w)));
    }
    return aus;
  }

  /** Wie oft der Sound in echten Beiträgen genutzt wird. */
  function nutzungen(stellen) {
    return (Array.isArray(stellen) ? stellen : []).reduce(function (s, x) {
      return s + (Number(x && x.anzahl) || 0);
    }, 0);
  }

  /**
   * Die meist verwendeten Stellen als Balkenbereiche, von links nach rechts:
   * [{ von, bis, ab, anzahl }] mit von/bis als Balkennummern (bis
   * ausschließlich). Nebeneinanderliegende Abschnitte werden ein Kasten.
   * Leer, solange niemand den Sound benutzt.
   */
  function markierungen(stellen, gesamt, anzahl) {
    var n = anzahl || BALKEN;
    var laenge = gesamt > 0 ? gesamt : 30;
    var beste = (Array.isArray(stellen) ? stellen : [])
      .map(function (x) { return { ab: Number(x.ab) || 0, anzahl: Number(x.anzahl) || 0 }; })
      .filter(function (x) { return x.anzahl > 0 && x.ab < laenge; })
      .sort(function (a, b) { return b.anzahl - a.anzahl || a.ab - b.ab; })
      .slice(0, KAESTEN)
      .sort(function (a, b) { return a.ab - b.ab; });
    var aus = [];
    beste.forEach(function (x) {
      var von = Math.floor((x.ab / laenge) * n);
      var bis = Math.min(n, Math.ceil((Math.min(laenge, x.ab + ABSCHNITT) / laenge) * n));
      var vorher = aus[aus.length - 1];
      if (vorher && von <= vorher.bis) {
        vorher.bis = Math.max(vorher.bis, bis);
        vorher.anzahl += x.anzahl;
        return;
      }
      aus.push({ von: von, bis: Math.max(von + 1, bis), ab: x.ab, anzahl: x.anzahl });
    });
    return aus;
  }

  /** Die Wahl „Ausschnitt ab" beim Erstellen: 0, 5, 10 … bis vor das Ende. */
  function ausschnitte(gesamt) {
    var laenge = gesamt > 0 ? gesamt : 30;
    var aus = [];
    for (var t = 0; t < laenge; t += ABSCHNITT) aus.push(t);
    return aus;
  }

  /**
   * „Ausschnitt ab" aus dem Formular („0:05" oder 5) in Sekunden, nie
   * negativ. Ohne Sound (Originalton) immer 0.
   */
  function abAus(wert, musik) {
    if (!musik || musik === 'Originalton') return 0;
    var text = String(wert == null ? '' : wert).trim();
    var teile = text.split(':');
    var sek = teile.length === 2 ? Number(teile[0]) * 60 + Number(teile[1]) : Number(text);
    return isFinite(sek) && sek > 0 ? sek : 0;
  }

  /** 65 → „1:05". */
  function zeit(sek) {
    var t = Math.max(0, Math.floor(Number(sek) || 0));
    return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  }

  return {
    BALKEN: BALKEN,
    ABSCHNITT: ABSCHNITT,
    balken: balken,
    nutzungen: nutzungen,
    markierungen: markierungen,
    ausschnitte: ausschnitte,
    abAus: abAus,
    zeit: zeit,
  };
});
