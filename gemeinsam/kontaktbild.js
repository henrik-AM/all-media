/**
 * Eigenes Kontaktbild und Anzeigename im Messenger — eine Regel für App und
 * Website (Feedback 28.09., Nachtrag 11.10.2026, Kasten 7.8).
 *
 * Henrik: „Standardmäßig das Profilbild, jeder Nutzer soll aber auch
 * individuell für jeden seiner Kontakte das Profilbild ändern können, wie bei
 * der Apple Telefon/Nachrichten-App (nur beim Messenger)."
 *
 * WAS HIER STEHT
 *
 *   anzeigeFuer()  DIE eine Auflösung „welches Bild, welcher Name für Kontakt X
 *                  im Messenger": Bild = mein eigenes Kontaktbild, sonst sein
 *                  Profilbild; Name = mein Spitzname (contacts.spitzname,
 *                  Schema 33), sonst sein Profilname. Außerhalb des Messengers
 *                  (Videos, Communitys) immer Profilbild und Profilname.
 *                  Die Freundeskarte soll später genau diese Funktion für ihre
 *                  Nadeln aufrufen (Hauptagent, 11.10.).
 *   ausZeilen()    Zeilen aus `kontakt_bilder` (Schema 94) → Kennung → Adresse.
 *   adresseGueltig Dieselbe Prüfung wie der Check `kontakt_bilder_eimer`.
 *   Texte          Beschriftungen und Meldungen, gleich auf beiden Seiten.
 *
 * Wo es wirkt: App — components/Avatar.tsx über den Kontext
 * `KontaktBildBereich` (App.tsx setzt ihn nur in Messenger-Ansichten);
 * Website — personenAvatar/avatarOf/avatarForUser mit `messenger`.
 *
 * UMD-Hülle wie die anderen Bausteine; eingetragen in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) und web/public/index.html (`window.Kontaktbild`).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Kontaktbild = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var FOTO_BEARBEITEN = 'Foto bearbeiten';
  var AUS_MEDIATHEK = 'Foto aus Mediathek';
  var AUFNEHMEN = 'Foto aufnehmen';
  var ENTFERNEN = 'Eigenes Foto entfernen';
  var HINWEIS = 'Nur du siehst dieses Foto — im Messenger statt des Profilbilds.';
  var GESPEICHERT = 'Kontaktfoto gespeichert — nur du siehst es';
  var ENTFERNT = 'Eigenes Foto entfernt — wieder das Profilbild';
  var FEHLT_SCHEMA = 'Eigene Kontaktfotos gehen erst, wenn das Datenbank-Update eingespielt ist';
  var NICHT_GESPEICHERT = 'Das Kontaktfoto ließ sich nicht speichern';

  var EIMER_MUSTER = /\/storage\/v1\/object\/public\/media\/avatars\/[A-Za-z0-9._-]+$/;

  /** Nur Adressen aus dem eigenen Eimer, Ordner avatars (wie Schema 94). */
  function adresseGueltig(url) {
    return typeof url === 'string' && EIMER_MUSTER.test(url);
  }

  /** Zeilen `{ kontakt_id, media_url }` → `{ [kontakt_id]: media_url }`. */
  function ausZeilen(zeilen) {
    var karte = {};
    (zeilen || []).forEach(function (z) {
      if (z && z.kontakt_id && z.media_url) karte[String(z.kontakt_id)] = z.media_url;
    });
    return karte;
  }

  /**
   * Was zeige ich für Person `id`?
   *
   *   quelle.profil       { name, avatar } — das, was die Person selbst gesetzt hat
   *   quelle.kontaktBilder { [id]: Adresse } — meine eigenen Kontaktbilder
   *   quelle.spitznamen    { [id]: Name }    — meine Namen für Kontakte
   *   quelle.messenger     true nur in Messenger-Ansichten
   *
   * Ergebnis: { name, bild, eigenesBild, eigenerName }. `bild` kann
   * undefined sein (dann Initialen).
   */
  function anzeigeFuer(id, quelle) {
    var q = quelle || {};
    var profil = q.profil || {};
    var messenger = q.messenger === true && !!id && id !== 'me';
    var eigenes = messenger && q.kontaktBilder ? q.kontaktBilder[id] : undefined;
    var spitz = messenger && q.spitznamen ? String(q.spitznamen[id] || '').trim() : '';
    return {
      name: spitz || profil.name || '',
      bild: eigenes || profil.avatar || undefined,
      eigenesBild: !!eigenes,
      eigenerName: !!spitz,
    };
  }

  return {
    FOTO_BEARBEITEN: FOTO_BEARBEITEN,
    AUS_MEDIATHEK: AUS_MEDIATHEK,
    AUFNEHMEN: AUFNEHMEN,
    ENTFERNEN: ENTFERNEN,
    HINWEIS: HINWEIS,
    GESPEICHERT: GESPEICHERT,
    ENTFERNT: ENTFERNT,
    FEHLT_SCHEMA: FEHLT_SCHEMA,
    NICHT_GESPEICHERT: NICHT_GESPEICHERT,
    adresseGueltig: adresseGueltig,
    ausZeilen: ausZeilen,
    anzeigeFuer: anzeigeFuer,
  };
});
