/**
 * Der Anrufeintrag im Chat — einmal fuer App und Website.
 *
 * Henrik am 28.09.2026: „Wenn ich eine Person oder eine Gruppe oder eine
 * Community, egal was, anrufe (egal ob Video oder Sprachanruf), soll das im
 * Chat wie eine Nachricht angezeigt werden, dass ich einen Anruf gestartet
 * habe. Andersherum bei eingehenden Anrufen genauso." (Kasten 5.2/5.3)
 *
 * WARUM HIER
 *
 * Der Satz stand bis heute zweimal da (ChatDetailScreen.tsx und
 * paintMessages in web/public/app.js) und kannte nur den Zweierchat. Jetzt
 * gibt es vier Faelle (zu zweit / Gruppe, eigen / fremd) und einen neuen
 * Zustand — zweimal von Hand gepflegt laufen die beiden Seiten auseinander.
 *
 * EHRLICH BLEIBEN
 *
 * Solange es keine Uebertragung gibt (Kasten 5.1), kann niemand einen Anruf
 * annehmen. Ein Anruf wird deshalb beim Start als `gestartet` vermerkt
 * (Schema 89), mit Dauer 0. Die Anzeige erfindet daraus kein
 * „angenommen, 3 Min.":
 *
 *   eigener Anruf          „Ausgehender Videoanruf · gestartet"
 *   fremder, zu zweit      „Eingehender Videoanruf · verpasst"
 *                          (angenommen werden konnte er nicht — das ist,
 *                          aus Sicht der angerufenen Person, verpasst)
 *   Gruppe/Community       „Du hast einen Videoanruf gestartet"
 *                          „Max hat einen Videoanruf gestartet"
 *
 * Die alten Zustaende aus Schema 35 bleiben lesbar: `beendet` mit Dauer
 * (das ist der angenommene Anruf, sobald es eine Uebertragung gibt),
 * `verpasst`, `abgelehnt`.
 *
 * UMD-Huelle wie in naehe.js; Eintrag in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) steht.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Anruf = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Die Zustaende, die die Datenbank kennt (Schema 35 + 89). */
  var ZUSTAENDE = ['gestartet', 'beendet', 'verpasst', 'abgelehnt'];

  function zweistellig(n) {
    return String(n).padStart(2, '0');
  }

  /** Sekunden als mm:ss, ab einer Stunde als h:mm:ss. */
  function dauerText(sekunden) {
    var s = Math.max(0, Math.round(Number(sekunden) || 0));
    var st = Math.floor(s / 3600);
    var min = Math.floor((s % 3600) / 60);
    var sek = s % 60;
    return st > 0
      ? st + ':' + zweistellig(min) + ':' + zweistellig(sek)
      : zweistellig(min) + ':' + zweistellig(sek);
  }

  function artName(art) {
    return art === 'video' ? 'Videoanruf' : 'Sprachanruf';
  }

  /**
   * Der Zusatz hinter dem Namen: „gestartet", „verpasst", „abgelehnt" oder
   * die Dauer eines angenommenen Anrufs.
   */
  function zusatz(anruf, eigen) {
    var status = anruf && anruf.status;
    if (status === 'beendet') return dauerText(anruf.dauer);
    if (status === 'abgelehnt') return 'abgelehnt';
    if (status === 'verpasst') return 'verpasst';
    // gestartet: wer anruft, hat gestartet; wer angerufen wurde, hat ihn
    // verpasst — annehmen ging nicht.
    return eigen ? 'gestartet' : 'verpasst';
  }

  /**
   * Der Text der Zeile, ohne Uhrzeit (die haengt die Oberflaeche an).
   *
   *   anruf   { art: 'audio'|'video', status, dauer }
   *   opts    { eigen: boolean, gruppe: boolean, name?: string }
   *           gruppe = Gruppenchat oder Unterthema einer Community;
   *           name   = Vorname/Name des Anrufers (nur bei gruppe && !eigen)
   */
  function text(anruf, opts) {
    var o = opts || {};
    var art = artName(anruf && anruf.art);
    if (o.gruppe) {
      var status = anruf && anruf.status;
      var wer = o.eigen ? 'Du hast' : (o.name || 'Jemand') + ' hat';
      // Ein angenommener Gruppenanruf (beendet) nennt die Dauer, alle
      // anderen sagen, dass er gestartet wurde.
      if (status === 'beendet') return (o.eigen ? 'Du' : o.name || 'Jemand') + ' · ' + art + ' · ' + dauerText(anruf.dauer);
      return wer + ' einen ' + art + ' gestartet';
    }
    return (o.eigen ? 'Ausgehender ' : 'Eingehender ') + art + ' · ' + zusatz(anruf, o.eigen);
  }

  /** Rot zeigen? Nur, was die angerufene Person nicht erreicht hat. */
  function verpasst(anruf, opts) {
    var o = opts || {};
    var status = anruf && anruf.status;
    if (status === 'abgelehnt' || status === 'verpasst') return true;
    if (status === 'gestartet') return !o.eigen && !o.gruppe;
    return false;
  }

  /** Vorschau in der Chatliste: „Videoanruf" / „Sprachanruf". */
  function vorschau(anruf) {
    return artName(anruf && (anruf.art || anruf.anruf_art));
  }

  return {
    ZUSTAENDE: ZUSTAENDE,
    dauerText: dauerText,
    artName: artName,
    text: text,
    verpasst: verpasst,
    vorschau: vorschau,
  };
});
