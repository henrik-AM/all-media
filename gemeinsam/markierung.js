/**
 * All Media — @-Markierungen, wie App, Website und Datenbank sie lesen.
 *
 * WARUM ES DAS GIBT
 *
 * Kasten 25 (Henrik, 06.10.2026): „Andere Personen sollen mit @ markiert
 * werden können (All Media übergreifend)." Bis dahin gab es zwei Abschriften
 * derselben Erkennung — `erwaehnungen()` in app/lib/aktionen.ts und in
 * web/server/sync-handlers.js —, beide nur für die Videobeschreibung, und
 * beide mit einem eigenen Muster (`[A-Za-z0-9_.]{2,30}`), das Namen erkannte,
 * die es nach `handle_gueltig` gar nicht geben kann. Hier steht die Regel
 * einmal; die Datenbank hat dieselbe in `markierung_handles()`
 * (SUPABASE_SCHEMA_XX_markierungen.sql).
 *
 * DIE FORM EINES NAMENS
 *
 * Aus gemeinsam/benutzername.js bzw. `handle_gueltig` (Schema 4): drei bis
 * vierundzwanzig Zeichen, Buchstaben, Ziffern, Punkt und Unterstrich, vorn
 * und hinten kein Punkt oder Unterstrich, keine zwei Punkte hintereinander.
 * Im Fließtext darf er groß geschrieben stehen („@Anna"), gemeint ist
 * derselbe Name („anna").
 *
 * WANN EIN @ EINE MARKIERUNG IST
 *
 *   - vor dem @ steht nichts, ein Leerzeichen oder ein Satzzeichen —
 *     „anna@web.de" ist eine E-Mail-Adresse, keine Markierung;
 *   - hinter dem Namen geht es nicht mit Namenszeichen weiter — ein Punkt am
 *     Satzende gehört nicht dazu („Hallo @anna." meint anna).
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Wie bei kommentar.js: Die Prüfläufe legen den übersetzten App-Code als
 * blob:-Modul in den Browser, dort gibt es kein `require`. Eingetragen in
 * UMD_BAUSTEINE (app/test/_modulquelle.js); im Browser als window.Markierung.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Markierung = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Höchstens so viele verschiedene Personen je Text — wie in der Datenbank. */
  var HOECHSTENS = 20;

  /** Zeichen, aus denen ein Name besteht (ohne Rücksicht auf Groß/klein). */
  var NAMENSZEICHEN = /[A-Za-z0-9._]/;

  /**
   * Die Erkennung im Fließtext. Gruppe 1: was vor dem @ steht (leer oder ein
   * Nicht-Namenszeichen), Gruppe 2: der Name selbst.
   *
   * Dasselbe Muster steht in `markierung_handles()` in der Datenbank.
   */
  var MUSTER_QUELLE =
    '(^|[^A-Za-z0-9_.@])@([A-Za-z0-9](?:[A-Za-z0-9._]{1,22})[A-Za-z0-9])(?![A-Za-z0-9_]|\\.[A-Za-z0-9_])';

  /** Wie `handle_gueltig`: die Form eines (schon kleingeschriebenen) Namens. */
  function gueltig(name) {
    return typeof name === 'string' && /^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/.test(name) && name.indexOf('..') === -1;
  }

  /** Wie `handle_normal`: ohne führendes @, beschnitten, klein. */
  function normal(eingabe) {
    var roh = typeof eingabe === 'string' ? eingabe.trim() : '';
    return roh.replace(/^@+/, '').trim().toLowerCase();
  }

  /**
   * Alle Markierungen eines Textes, in der Reihenfolge ihres Auftretens.
   * Jede mit `handle` (klein, ohne @), `text` (wie geschrieben, mit @),
   * `start` und `ende` (Zeichenpositionen, ende exklusiv).
   */
  function finden(text) {
    var quelle = typeof text === 'string' ? text : '';
    var muster = new RegExp(MUSTER_QUELLE, 'g');
    var treffer = [];
    var m;
    while ((m = muster.exec(quelle)) !== null) {
      var name = m[2];
      var start = m.index + m[1].length;
      var handle = name.toLowerCase();
      if (gueltig(handle)) {
        treffer.push({ handle: handle, text: '@' + name, start: start, ende: start + 1 + name.length });
      }
      // Ein Treffer ohne Länge kommt nicht vor (das @ ist immer dabei), aber
      // das Muster beginnt mit einer optionalen Gruppe — sicher ist sicher.
      if (muster.lastIndex === m.index) muster.lastIndex++;
      // Das Zeichen vor einem @ ist Teil des Treffers. Steht direkt hinter
      // einem Namen das nächste @ („@anna,@ben"), muss die Suche am Komma
      // wieder ansetzen, nicht dahinter.
      else muster.lastIndex = start + 1 + name.length;
    }
    return treffer;
  }

  /** Die verschiedenen Namen eines Textes, klein und ohne @, höchstens HOECHSTENS. */
  function handles(text) {
    var gesehen = {};
    var liste = [];
    var alle = finden(text);
    for (var i = 0; i < alle.length && liste.length < HOECHSTENS; i++) {
      if (!gesehen[alle[i].handle]) {
        gesehen[alle[i].handle] = true;
        liste.push(alle[i].handle);
      }
    }
    return liste;
  }

  /**
   * Den Text in Stücke zerlegen: `{ art: 'text', text }` und
   * `{ art: 'markierung', text: '@Anna', handle: 'anna' }`.
   *
   * `bekannt` (optional) entscheidet, welche Namen eine Markierung werden:
   * eine Funktion handle → boolean oder ein Set/Objekt mit den Namen. Wer
   * nicht bekannt ist, bleibt gewöhnlicher Text — ein @-Wort zu einem Namen,
   * den es nicht gibt, soll nicht wie ein Link aussehen.
   */
  function stuecke(text, bekannt) {
    var quelle = typeof text === 'string' ? text : '';
    var istBekannt = function () { return true; };
    if (typeof bekannt === 'function') istBekannt = bekannt;
    else if (bekannt && typeof bekannt.has === 'function') istBekannt = function (h) { return bekannt.has(h); };
    else if (bekannt && typeof bekannt === 'object') istBekannt = function (h) { return Boolean(bekannt[h]); };

    var teile = [];
    var pos = 0;
    var alle = finden(quelle);
    for (var i = 0; i < alle.length; i++) {
      var t = alle[i];
      if (!istBekannt(t.handle)) continue;
      if (t.start > pos) teile.push({ art: 'text', text: quelle.slice(pos, t.start) });
      teile.push({ art: 'markierung', text: t.text, handle: t.handle });
      pos = t.ende;
    }
    if (pos < quelle.length) teile.push({ art: 'text', text: quelle.slice(pos) });
    // Zusammenhängende Textstücke zusammenlegen (entsteht, wenn ein
    // unbekannter Name übersprungen wurde — dann gibt es keine Lücke).
    var fertig = [];
    for (var j = 0; j < teile.length; j++) {
      var letzt = fertig[fertig.length - 1];
      if (letzt && letzt.art === 'text' && teile[j].art === 'text') letzt.text += teile[j].text;
      else fertig.push(teile[j]);
    }
    return fertig;
  }

  /**
   * Das @-Wort, in dem der Cursor gerade steht — für die Vorschlagsliste.
   *
   * Gibt `{ start, ende, suche }` zurück: `start` ist die Position des @,
   * `ende` das Ende des Wortes (auch hinter dem Cursor), `suche` das bisher
   * Getippte ohne @ (klein, darf leer sein: direkt nach dem @ kommt schon die
   * Liste). Steht der Cursor in keinem @-Wort, `null`.
   */
  function aktuellesWort(text, cursor) {
    var quelle = typeof text === 'string' ? text : '';
    var c = typeof cursor === 'number' && cursor >= 0 ? Math.min(cursor, quelle.length) : quelle.length;

    // Vom Cursor rückwärts bis zum @, solange es Namenszeichen sind.
    var i = c - 1;
    while (i >= 0 && NAMENSZEICHEN.test(quelle.charAt(i))) i--;
    if (i < 0 || quelle.charAt(i) !== '@') return null;
    var at = i;
    // Vor dem @ darf kein Namenszeichen und kein weiteres @ stehen.
    if (at > 0) {
      var davor = quelle.charAt(at - 1);
      if (NAMENSZEICHEN.test(davor) || davor === '@') return null;
    }
    // Vorwärts bis zum Wortende.
    var e = c;
    while (e < quelle.length && NAMENSZEICHEN.test(quelle.charAt(e))) e++;
    var suche = quelle.slice(at + 1, c).toLowerCase();
    if (suche.length > 24) return null;
    return { start: at, ende: e, suche: suche };
  }

  /**
   * Das @-Wort am Cursor durch einen gewählten Namen ersetzen.
   * Gibt `{ text, cursor }` zurück; dahinter steht ein Leerzeichen, damit man
   * gleich weiterschreiben kann (steht schon eins da, kein zweites).
   * Ohne @-Wort am Cursor wird der Name an der Cursorstelle eingefügt.
   */
  function einsetzen(text, cursor, handle) {
    var quelle = typeof text === 'string' ? text : '';
    var name = normal(handle);
    var wort = aktuellesWort(quelle, cursor);
    var c = typeof cursor === 'number' && cursor >= 0 ? Math.min(cursor, quelle.length) : quelle.length;
    var start = wort ? wort.start : c;
    var ende = wort ? wort.ende : c;
    var danach = quelle.slice(ende);
    var luecke = danach.charAt(0) === ' ' ? '' : ' ';
    var neu = quelle.slice(0, start) + '@' + name + luecke + danach;
    return { text: neu, cursor: start + 1 + name.length + 1 };
  }

  /**
   * Die Vorschlagsliste ordnen — App und Website gleich.
   *
   * Kommt aus `markierung_vorschlaege()` (Datenbank) schon gefiltert nach den
   * Regeln: wer mich nicht markieren lässt, wer blockiert ist, Minderjährige
   * ohne Kontakt fehlen dort. Hier nur noch Reihenfolge und Suche:
   *   1. Mitglieder des Chats / der Community (rang 'mitglied'),
   *   2. Gefolgte, Folgende, Kontakte ('nah'),
   *   3. der Rest aus der Suche ('suche').
   * Innerhalb einer Stufe zuerst, wessen Name mit dem Getippten beginnt.
   */
  var STUFE = { mitglied: 0, nah: 1, suche: 2 };

  function vorschlaegeOrdnen(liste, suche) {
    var s = normal(suche);
    var beginnt = function (p) {
      var h = normal(p.handle);
      var n = String(p.name || '').toLowerCase();
      return s && (h.indexOf(s) === 0 || n.indexOf(s) === 0) ? 0 : 1;
    };
    return (Array.isArray(liste) ? liste.slice() : [])
      .filter(function (p) {
        if (!p || !p.id || !p.handle) return false;
        if (!s) return true;
        return normal(p.handle).indexOf(s) !== -1 || String(p.name || '').toLowerCase().indexOf(s) !== -1;
      })
      .sort(function (a, b) {
        var sa = STUFE[a.rang] == null ? 3 : STUFE[a.rang];
        var sb = STUFE[b.rang] == null ? 3 : STUFE[b.rang];
        if (sa !== sb) return sa - sb;
        var ba = beginnt(a), bb = beginnt(b);
        if (ba !== bb) return ba - bb;
        return String(a.name || '').localeCompare(String(b.name || ''), 'de');
      });
  }

  /**
   * Für verschlüsselte Zweierchats (25.6): Wen aus den Mitgliedern meint der
   * Text? Der Server sieht den Text nicht; der Client schickt die Kennungen
   * mit. `mitglieder` ist eine Liste `{ id, handle }`, `ichId` fällt heraus.
   */
  function markierteMitglieder(text, mitglieder, ichId) {
    var namen = handles(text);
    if (!namen.length) return [];
    var ids = [];
    (Array.isArray(mitglieder) ? mitglieder : []).forEach(function (m) {
      if (!m || !m.id || m.id === ichId) return;
      if (namen.indexOf(normal(m.handle)) !== -1 && ids.indexOf(m.id) === -1) ids.push(m.id);
    });
    return ids;
  }

  return {
    HOECHSTENS: HOECHSTENS,
    MUSTER_QUELLE: MUSTER_QUELLE,
    gueltig: gueltig,
    normal: normal,
    finden: finden,
    handles: handles,
    stuecke: stuecke,
    aktuellesWort: aktuellesWort,
    einsetzen: einsetzen,
    vorschlaegeOrdnen: vorschlaegeOrdnen,
    markierteMitglieder: markierteMitglieder,
  };
});
