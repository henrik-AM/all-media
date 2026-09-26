/**
 * Wer im Teilen-Blatt steht — einmal für App und Website.
 *
 * Henrik am 21.09.2026 (Feedback, Videos übergreifend): „Teilen-Dialog: oben
 * eine Suchleiste (Kontakte, Communitys, Gefolgte — und per exaktem Username
 * auch Fremde), unten ein Senden-Button zur Bestätigung der Auswahl. An
 * Fremde darf nur ein Video gehen, bis sie die Anfrage annehmen."
 *
 * Bis dahin stand im Blatt jedes Profil, das die Datenbank kannte, unter
 * „Weitere Vorschläge" — also auch jeder Fremde, ohne dass man seinen Namen
 * wusste. Und ein Tipp auf eine Kachel schickte sofort, ohne Bestätigung.
 *
 * Jetzt:
 *   * Ohne Suche stehen drei Gruppen da: Kontakte (Messenger), Personen aus
 *     den Community-Chats und Profile, denen man folgt. Jede Person nur
 *     einmal, in der ersten Gruppe, in der sie vorkommt.
 *   * Die Suche filtert diese Gruppen nach Name und Nutzername.
 *   * Fremde findet nur, wer den Nutzernamen genau kennt. Diesen Abgleich
 *     macht die Datenbank (`nutzername()` liefert, wonach gefragt wird).
 *   * Die Grenze „ein Beitrag bis zur Annahme" steht in der Datenbank
 *     (Schema 21, `anfrage_erlaubt`). Hier steht nur, was das Blatt dazu
 *     anzeigt, damit niemand auf eine Kachel tippt, die nichts mehr senden
 *     darf.
 *
 * Die UMD-Hülle aus demselben Grund wie in kommentar.js: die Prüfläufe
 * laden App-Code als blob:-Modul, dort gibt es kein `require`.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Teilen = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var GRUPPEN = { kontakte: 'Deine Kontakte', community: 'Communitys', gefolgt: 'Gefolgt' };

  /** Wie `Benutzername.normal`: ohne führendes @, klein, beschnitten. */
  function normal(text) {
    return String(text || '').trim().replace(/^@+/, '').trim().toLowerCase();
  }

  /** Passt die Person zur Suche? Name oder Nutzername, Teilwort genügt. */
  function passt(person, suche) {
    var s = normal(suche);
    if (!s) return true;
    if (!person) return false;
    return (
      String(person.name || '').toLowerCase().indexOf(s) !== -1 ||
      normal(person.handle).indexOf(s) !== -1
    );
  }

  /**
   * Die Gruppen des Blatts, in dieser Reihenfolge und ohne Doppelte.
   *
   *   ich        — die eigene Kennung, sie steht nie im Blatt
   *   kontakte   — Kennungen der Messenger-Kontakte
   *   community  — Kennungen der Gegenüber aus Community-Zweierchats
   *   gefolgt    — Kennungen der Profile, denen man folgt
   *   person(id) — { name, handle } oder null, wenn unbekannt
   *   suche      — was in der Suchleiste steht
   *
   * Leere Gruppen fallen weg. Rückgabe: [{ art, titel, ids }].
   */
  function gruppen(e) {
    var gesehen = {};
    if (e.ich) gesehen[e.ich] = true;
    gesehen.me = true;

    var aus = function (art, ids) {
      var liste = [];
      (ids || []).forEach(function (id) {
        if (!id || gesehen[id]) return;
        var p = e.person(id);
        if (!p) return;
        gesehen[id] = true;
        if (passt(p, e.suche)) liste.push(id);
      });
      return { art: art, titel: GRUPPEN[art], ids: liste };
    };

    return [aus('kontakte', e.kontakte), aus('community', e.community), aus('gefolgt', e.gefolgt)].filter(
      function (g) {
        return g.ids.length > 0;
      }
    );
  }

  /**
   * Der Nutzername, nach dem die Datenbank gefragt wird — so, wie er in
   * `profiles.handle` steht (mit @). Null, wenn die Eingabe kein
   * Nutzername sein kann; dann wird gar nicht erst gefragt.
   */
  function nutzername(suche) {
    var n = normal(suche);
    if (!/^[a-z0-9][a-z0-9._]{1,22}[a-z0-9]$/.test(n)) return null;
    return '@' + n;
  }

  /**
   * Warum an diese Person gerade nichts gehen kann — aus dem Zustand der
   * Chat-Anfrage (Chat.requestState). Null heißt: senden geht.
   *
   * 'pending'  — ich habe schon etwas geschickt, sie hat noch nicht
   *              angenommen. Genau eins ist erlaubt, das ist raus.
   * 'declined' — sie hat abgelehnt. Endgültig, wie in Schema 21.
   */
  function sperre(anfrage) {
    if (anfrage === 'pending') return 'Wartet auf Annahme';
    if (anfrage === 'declined') return 'Hat abgelehnt';
    return null;
  }

  /** Die Beschriftung des Senden-Knopfs. */
  function knopf(anzahl) {
    if (!anzahl) return 'Senden';
    return anzahl === 1 ? 'An 1 Person senden' : 'An ' + anzahl + ' Personen senden';
  }

  /**
   * Der Satz, den das Blatt zeigt, wenn die Datenbank eine Nachricht
   * abweist. Ohne Übersetzung stünde dort „new row violates row-level
   * security policy".
   */
  function grund(fehler, anfrage) {
    var text = String((fehler && fehler.message) || fehler || '');
    if (anfrage === 'pending' || /row-level security/i.test(text)) {
      return 'Bis zur Annahme geht nur ein Beitrag';
    }
    return text || 'Das Senden hat nicht geklappt';
  }

  return {
    GRUPPEN: GRUPPEN,
    passt: passt,
    gruppen: gruppen,
    nutzername: nutzername,
    sperre: sperre,
    knopf: knopf,
    grund: grund,
  };
});
