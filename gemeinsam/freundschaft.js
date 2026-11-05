/**
 * Befreunden unter Communitys — eine Regel für App und Website
 * (Feedback 28.09.2026, Kasten 15.4, Schema 98).
 *
 * Henrik: „Ich denke mal, dass der Button befreunden und angefragt und so
 * nicht synchronisiert ist, denn ich hab gerade eine Person eine
 * Freundschaftsanfrage gesendet, mit der ich schon geschrieben habe."
 * Am 29.08.: „Öffentlich = ‚Befreunden', Privat = ‚Freundschaftsanfrage
 * senden'." Am 21.10.2026 entschieden: eigene Freundschaft nur unter
 * Communitys, ohne Nummer und ohne Messenger; öffentlich sofort, privat als
 * Anfrage, die die andere Person annimmt.
 *
 * Der Stand kommt aus der Tabelle `freundschaften`, nicht mehr aus den
 * Messenger-Kontakten. Ob eine neue Freundschaft sofort gilt, entscheidet
 * der Auslöser freundschaft_vorgaben (profiles.privat) — hier steht nur,
 * was die Oberfläche daraus macht.
 *
 * UMD-Hülle wie beitritt.js; eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) und web/public/index.html (`window.Freundschaft`).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Freundschaft = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FEHLT_SCHEMA = 'Befreunden geht erst, wenn das Datenbank-Update eingespielt ist.';

  /**
   * Aus den Zeilen { von, an, angenommen } die Zustände je Person:
   *
   *   befreundet   angenommen, egal wer gefragt hat
   *   angefragt    ich habe gefragt, die andere Person hat noch nicht angenommen
   *   eingegangen  die andere Person hat mich gefragt
   *
   * Wer fehlt, ist 'keine'. `ichId` ist meine echte Kennung; Schlüssel ist
   * immer die Kennung des Gegenübers.
   */
  function ausZeilen(zeilen, ichId) {
    var stand = {};
    (zeilen || []).forEach(function (z) {
      if (!z) return;
      var ichFrage = z.von === ichId;
      var anderer = ichFrage ? z.an : z.von;
      if (!anderer || anderer === ichId) return;
      stand[anderer] = z.angenommen ? 'befreundet' : ichFrage ? 'angefragt' : 'eingegangen';
    });
    return stand;
  }

  function zustand(stand, id) {
    return (stand && stand[id]) || 'keine';
  }

  /** Beschriftung des Knopfs. `privat`: das Profil des Gegenübers. */
  function knopfText(z, privat) {
    switch (z) {
      case 'befreundet':
        return 'Befreundet';
      case 'angefragt':
        return 'Angefragt';
      case 'eingegangen':
        return 'Annehmen';
      default:
        return privat ? 'Freundschaftsanfrage senden' : '+ Befreunden';
    }
  }

  /** Leise (umrandet) statt gefüllt: es läuft schon etwas oder steht schon. */
  function leise(z) {
    return z === 'befreundet' || z === 'angefragt';
  }

  /** In der Suche tippbar: anfragen, zurückziehen, annehmen. Beenden geht dort nicht. */
  function tippbar(z) {
    return z !== 'befreundet';
  }

  /**
   * Was das Antippen tut: 'anfragen' (INSERT), 'zurueckziehen' (DELETE),
   * 'annehmen' (freundschaft_annehmen) oder nichts.
   */
  function schritt(z) {
    if (z === 'keine') return 'anfragen';
    if (z === 'angefragt') return 'zurueckziehen';
    if (z === 'eingegangen') return 'annehmen';
    return null;
  }

  /** Die Meldung danach — aus dem Zustand, den die Datenbank zurückgab. */
  function meldung(vorher, nachher, name) {
    var n = name || 'der Person';
    if (nachher === 'befreundet') return 'Du und ' + n + ' seid jetzt befreundet';
    if (nachher === 'angefragt') return 'Freundschaftsanfrage an ' + n + ' gesendet';
    if (nachher === 'eingegangen') return n + ' hat dir schon eine Anfrage geschickt – du kannst sie annehmen';
    if (vorher === 'angefragt') return 'Freundschaftsanfrage an ' + n + ' zurückgezogen';
    return 'Diese Anfrage gibt es nicht mehr';
  }

  /** Fehlt Tabelle oder Funktion aus Schema 98? Dann nachsichtig weiter. */
  function fehltSchema(fehler) {
    if (!fehler) return false;
    var code = String(fehler.code || '');
    var text = String(fehler.message || '');
    if (code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || code === '42883') {
      return /freundschaft/.test(text) || !text;
    }
    return /freundschaften|freundschaft_annehmen/.test(text) && /does not exist|not find|schema cache/i.test(text);
  }

  return {
    FEHLT_SCHEMA: FEHLT_SCHEMA,
    ausZeilen: ausZeilen,
    zustand: zustand,
    knopfText: knopfText,
    leise: leise,
    tippbar: tippbar,
    schritt: schritt,
    meldung: meldung,
    fehltSchema: fehltSchema,
  };
});
