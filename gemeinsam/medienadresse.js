/**
 * Medienadressen prüfen — eine Regel für App, Website-Server und Datenbank.
 *
 * Codex-Review 05.11.2026 (Kasten live-medienadresse, Schema 118):
 * Profilbild und Titelbild prüften nur das PFADENDE
 * (`…/storage/v1/object/public/media/avatars/x.png`). Eine Adresse wie
 * `https://boese.example/storage/v1/object/public/media/avatars/x.png` ging
 * durch, und das Unterschreiben erkannte Medien ebenfalls nur an diesem
 * Pfadteil. Scheiterte das Unterschreiben, wurde die Rohadresse ausgeliefert —
 * jeder Betrachter lud dann ein Bild von einem fremden Server
 * (Tracking-Pixel).
 *
 * Regel jetzt:
 *   * gespeichert(wert, ordner) — was in eine Medienspalte darf: genau
 *     `<eigene Projektadresse>/storage/v1/object/public/media/<ordner>/<datei>`,
 *     Datei nur aus [A-Za-z0-9._-], kein `?`, kein `#`. Dieselbe Form wie
 *     `public.medien_adresse_gueltig()` in der Datenbank (Schema 23/95), dazu
 *     die erlaubten Ordner der jeweiligen Spalte.
 *   * art(wert) — beim Ausliefern: 'keine' (gar keine Medienadresse),
 *     'eigen' (unser Projekt) oder 'fremd' (Medienpfad auf fremdem Host).
 *     Fremde werden nicht ausgeliefert.
 *   * pfad(wert) — Pfad im Eimer aus einer EIGENEN Adresse (ohne `?…`/`#…`,
 *     dekodiert) oder null. Für fremde Adressen immer null.
 *
 * Die eigene Projektadresse ist dieselbe wie in `medien_adresse()`; App
 * (EXPO_PUBLIC_SUPABASE_URL) und Server (SUPABASE_URL) dürfen sie über
 * `basis` überschreiben.
 */
(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.MedienAdresse = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STANDARD_BASIS = 'https://ijztosbjfybdgotpdixw.supabase.co';
  var OEFFENTLICH = '/storage/v1/object/public/media/';

  /** Basis ohne Schrägstrich am Ende, Schema und Host klein — oder die Standardadresse. */
  function basisVon(basis) {
    var b = typeof basis === 'string' ? basis.trim() : '';
    var t = /^(https?:\/\/[^\/?#@\s]+)\/*$/i.exec(b);
    return (t ? t[1] : STANDARD_BASIS).toLowerCase();
  }

  /** Ist der Wert als Ganzes eine Adresse mit dem Medienpfad (egal welcher Host)? */
  function istMedienform(wert) {
    return typeof wert === 'string' && /^https?:\/\/\S+$/i.test(wert) && wert.indexOf(OEFFENTLICH) !== -1;
  }

  /** Ursprung (Schema + Host[:Port]) und Rest einer Adresse. */
  function zerlege(wert) {
    var t = /^(https?:\/\/[^\/?#]*)(.*)$/i.exec(wert);
    return t ? { ursprung: t[1].toLowerCase(), rest: t[2] } : null;
  }

  /** 'keine' | 'eigen' | 'fremd'. */
  function art(wert, basis) {
    if (!istMedienform(wert)) return 'keine';
    var z = zerlege(wert);
    if (z && z.ursprung === basisVon(basis) && z.rest.indexOf(OEFFENTLICH) === 0) return 'eigen';
    return 'fremd';
  }

  /** Pfad im Eimer aus einer eigenen Adresse, oder null. */
  function pfad(wert, basis) {
    if (art(wert, basis) !== 'eigen') return null;
    var rest = zerlege(wert).rest.slice(OEFFENTLICH.length).split(/[?#]/)[0];
    try {
      return decodeURIComponent(rest) || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Darf dieser Wert in eine Medienspalte? `ordner` ist ein Ordner oder eine
   * Liste (z. B. ['stories', 'posts']); ohne Angabe jeder Ordner aus a–z.
   */
  function gespeichert(wert, ordner, basis) {
    if (typeof wert !== 'string') return false;
    var liste = ordner == null ? null : [].concat(ordner);
    var t = /^(https:\/\/[^\/?#]+)\/storage\/v1\/object\/public\/media\/([a-z]+)\/([A-Za-z0-9._-]+)$/.exec(wert);
    if (!t) return false;
    if (t[1].toLowerCase() !== basisVon(basis) || t[1] !== t[1].toLowerCase()) return false;
    if (liste && liste.indexOf(t[2]) === -1) return false;
    return true;
  }

  return {
    STANDARD_BASIS: STANDARD_BASIS,
    OEFFENTLICH: OEFFENTLICH,
    basisVon: basisVon,
    istMedienform: istMedienform,
    art: art,
    pfad: pfad,
    gespeichert: gespeichert,
  };
});
