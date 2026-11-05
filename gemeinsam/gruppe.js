/**
 * Gruppeninfo im Messenger — eine Regel für App und Website
 * (Nachtrag 12.10.2026 (3), Kasten 28/7.9 und 7.10).
 *
 * Henrik: „Dann löse das Problem (z. B. erstell eine Mitgliederliste)."
 * Bis dahin zeigte die App beim Antippen des Gruppenkopfs nur den Hinweis
 * „Gruppeneinstellungen: X", die Website gar nichts.
 *
 * WAS HIER STEHT
 *
 *   mitglieder()   Die Mitgliederliste einer Gruppe: ich zuerst („Du"),
 *                  danach alphabetisch nach dem angezeigten Namen. Name und
 *                  Bild kommen aus Kontaktbild.anzeigeFuer — im Messenger
 *                  also mein Spitzname und mein eigenes Kontaktbild
 *                  (Kasten 7.10), in Communitys das Profil.
 *   ziel()         Wohin ein Tipp auf ein Mitglied führt: Kontaktprofil
 *                  (Messenger-Kontakt), öffentliches Profil (kein Kontakt
 *                  oder Community-Gruppe) oder nirgends (ich selbst).
 *   anzahlText()   „N Mitglieder" — dieselbe Zählung wie im Chatkopf
 *                  (die anderen plus ich).
 *   Texte          Beschriftungen und Meldungen, gleich auf beiden Seiten.
 *
 * Admins gibt es in All Media nicht (chats kennt nur created_by, ohne
 * Sonderrechte). Darum wird niemand als Admin markiert — nichts erfinden.
 *
 * UMD-Hülle wie die anderen Bausteine; eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) und web/public/index.html (`window.Gruppe`).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Gruppe = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TITEL = 'Gruppeninfo';
  var DU = 'Du';
  var MITGLIEDER = 'Mitglieder';
  var VERLASSEN = 'Gruppe verlassen';
  var VERLASSEN_FRAGE = 'Du bekommst danach keine Nachrichten mehr aus dieser Gruppe. Die anderen bleiben darin.';
  var VERLASSEN_OK = 'Du hast die Gruppe verlassen';
  var VERLASSEN_FEHLER = 'Die Gruppe ließ sich nicht verlassen';
  var UNBEKANNT = 'Unbekanntes Mitglied';

  /** „N Mitglieder" — die anderen plus ich, wie im Chatkopf. */
  function anzahlText(andere) {
    var n = (Array.isArray(andere) ? andere.length : 0) + 1;
    return n.toLocaleString('de-DE') + ' ' + (n === 1 ? 'Mitglied' : 'Mitglieder');
  }

  /**
   * Die Mitgliederliste.
   *
   *   eingabe.andere        Kennungen der anderen Mitglieder (ohne mich)
   *   eingabe.ich           { name, bild } — mein eigenes Profil
   *   eingabe.profil(id)    { name, avatar } — das Profil der Person
   *   eingabe.kontaktBilder { [id]: Adresse } — meine eigenen Kontaktbilder
   *   eingabe.spitznamen    { [id]: Name }    — meine Namen für Kontakte
   *   eingabe.messenger     true nur für Messenger-Gruppen
   *   eingabe.kontaktbild   der Baustein Kontaktbild (anzeigeFuer)
   *
   * Ergebnis: [{ id, name, bild, ich, eigenesBild, eigenerName }]; mein
   * Eintrag hat die Kennung 'me' und steht vorn.
   */
  function mitglieder(eingabe) {
    var e = eingabe || {};
    var K = e.kontaktbild;
    var profil = typeof e.profil === 'function' ? e.profil : function () { return null; };
    var gesehen = {};
    var liste = [];
    (e.andere || []).forEach(function (id) {
      if (!id || id === 'me' || gesehen[id]) return;
      gesehen[id] = true;
      var p = profil(id) || {};
      var anzeige = K && typeof K.anzeigeFuer === 'function'
        ? K.anzeigeFuer(id, {
            profil: { name: p.name, avatar: p.avatar },
            kontaktBilder: e.kontaktBilder,
            spitznamen: e.spitznamen,
            messenger: e.messenger === true,
          })
        : { name: p.name || '', bild: p.avatar || undefined, eigenesBild: false, eigenerName: false };
      liste.push({
        id: String(id),
        name: anzeige.name || UNBEKANNT,
        bild: anzeige.bild || undefined,
        ich: false,
        eigenesBild: !!anzeige.eigenesBild,
        eigenerName: !!anzeige.eigenerName,
      });
    });
    liste.sort(function (a, b) {
      return a.name.localeCompare(b.name, 'de', { sensitivity: 'base' });
    });
    var ich = e.ich || {};
    liste.unshift({
      id: 'me',
      name: ich.name || DU,
      bild: ich.bild || undefined,
      ich: true,
      eigenesBild: false,
      eigenerName: false,
    });
    return liste;
  }

  /**
   * Wohin führt ein Tipp auf ein Mitglied?
   *   'selbst'      ich — nichts öffnen
   *   'kontakt'     Kontaktprofil im Messenger (nur Messenger-Gruppe und Kontakt)
   *   'oeffentlich' öffentliches Profil (kein Kontakt, oder Community-Gruppe)
   */
  function ziel(id, wo) {
    var w = wo || {};
    if (!id || id === 'me' || id === w.ichId) return 'selbst';
    if (w.messenger === true && w.istKontakt === true) return 'kontakt';
    return 'oeffentlich';
  }

  return {
    TITEL: TITEL,
    DU: DU,
    MITGLIEDER: MITGLIEDER,
    VERLASSEN: VERLASSEN,
    VERLASSEN_FRAGE: VERLASSEN_FRAGE,
    VERLASSEN_OK: VERLASSEN_OK,
    VERLASSEN_FEHLER: VERLASSEN_FEHLER,
    UNBEKANNT: UNBEKANNT,
    anzahlText: anzahlText,
    mitglieder: mitglieder,
    ziel: ziel,
  };
});
