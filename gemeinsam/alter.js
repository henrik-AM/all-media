/**
 * All Media — Geburtsdatum und Altersgrenze, wie App und Website sie beide lesen.
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 22.09.2026: Beim Anlegen eines Kontos gehört das Geburtsdatum
 * dazu, weil jedes Land eine eigene Altersgrenze hat, die All Media einhalten
 * muss. Wer darunter liegt, darf trotzdem ein Konto haben — wenn ein
 * Elternteil mit eigenem All-Media-Konto es von dort aus bestätigt.
 *
 * WOHER DAS LAND KOMMT
 *
 * Aus der Telefonnummer, die ohnehin Pflicht ist (Schema 34). Ihre
 * Landesvorwahl sagt, welches Recht gilt; eine Nummer ohne Vorwahl gilt wie in
 * `telefon.js` als deutsche. Ein zusätzliches Auswahlfeld „Land" wäre eine
 * zweite Angabe, die der ersten widersprechen kann.
 *
 * WER DIESE TABELLE SONST NOCH KENNT
 *
 * `public.altersgrenzen` aus SUPABASE_SCHEMA_52_geburtsdatum.sql. Dort
 * entscheidet die Datenbank beim Anlegen, ob das Konto freigegeben ist oder
 * auf die Eltern wartet — die Oberfläche zeigt es hier nur vorher an.
 * `test/_minderjaehrig.js` vergleicht beide Tabellen Zeile für Zeile. Wer hier
 * etwas ändert, ändert es dort mit.
 *
 * DIE ZAHLEN SIND NICHT JURISTISCH GEPRÜFT
 *
 * Stand: Art. 8 DSGVO mit den nationalen Abweichungen, COPPA (USA), das
 * australische Mindestalter für soziale Netzwerke (16, ohne Ausnahme durch
 * die Eltern), Indiens DPDP-Gesetz (unter 18) und Brasiliens ECA Digital.
 * Vor dem Launch gehört die Tabelle einmal vor jemanden, der das beruflich
 * beurteilt. Unbekannte Länder bekommen die strengste EU-Grenze, 16.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory(require('./telefon'));
  } else {
    // Browser: nach telefon.js als eigenes <script> eingebunden.
    global.Alter = factory(global.Telefon);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Telefon) {
  'use strict';

  /*
   * [Land, Landesvorwahl, Mindestalter, Untergrenze, Name]
   *
   * Mindestalter: ab hier ohne Eltern.
   * Untergrenze:  darunter hilft auch die Bestätigung der Eltern nicht.
   *               null heißt: die Eltern können jedes Alter freigeben.
   */
  var GRENZEN = [
    ['DE', '49', 16, null, 'Deutschland'],
    ['AT', '43', 14, null, 'Österreich'],
    // Die Schweiz nennt im Datenschutzgesetz keine feste Zahl; 16 ist die
    // vorsichtige Wahl, bis das jemand anders beurteilt.
    ['CH', '41', 16, null, 'Schweiz'],
    ['LI', '423', 16, null, 'Liechtenstein'],
    ['BE', '32', 13, null, 'Belgien'],
    ['BG', '359', 14, null, 'Bulgarien'],
    ['HR', '385', 16, null, 'Kroatien'],
    ['CY', '357', 14, null, 'Zypern'],
    ['CZ', '420', 15, null, 'Tschechien'],
    ['DK', '45', 13, null, 'Dänemark'],
    ['EE', '372', 13, null, 'Estland'],
    ['FI', '358', 13, null, 'Finnland'],
    ['FR', '33', 15, null, 'Frankreich'],
    ['GR', '30', 15, null, 'Griechenland'],
    ['HU', '36', 16, null, 'Ungarn'],
    ['IE', '353', 16, null, 'Irland'],
    ['IT', '39', 14, null, 'Italien'],
    ['LV', '371', 13, null, 'Lettland'],
    ['LT', '370', 14, null, 'Litauen'],
    ['LU', '352', 16, null, 'Luxemburg'],
    ['MT', '356', 13, null, 'Malta'],
    ['NL', '31', 16, null, 'Niederlande'],
    ['PL', '48', 16, null, 'Polen'],
    ['PT', '351', 13, null, 'Portugal'],
    ['RO', '40', 16, null, 'Rumänien'],
    ['SK', '421', 16, null, 'Slowakei'],
    ['SI', '386', 15, null, 'Slowenien'],
    ['ES', '34', 14, null, 'Spanien'],
    ['SE', '46', 13, null, 'Schweden'],
    ['NO', '47', 13, null, 'Norwegen'],
    ['IS', '354', 13, null, 'Island'],
    ['GB', '44', 13, null, 'Vereinigtes Königreich'],
    // +1 teilen sich die USA und Kanada; beide 13.
    ['US', '1', 13, null, 'USA/Kanada'],
    ['AU', '61', 16, 16, 'Australien'],
    ['NZ', '64', 13, null, 'Neuseeland'],
    ['IN', '91', 18, null, 'Indien'],
    ['BR', '55', 16, null, 'Brasilien'],
    ['KR', '82', 14, null, 'Südkorea'],
    ['CN', '86', 14, null, 'China'],
  ];

  /** Für jede Nummer, deren Vorwahl oben fehlt. */
  var UNBEKANNT = ['XX', '', 16, null, 'anderes Land'];

  /** Wer für ein Kind bestätigt, muss selbst so alt sein. */
  var VOLLJAEHRIG = 18;

  /** Älter ist ein Tippfehler, keine Angabe. */
  var HOECHSTALTER = 120;

  var REGEL_TEXT = 'Zum Beispiel 24.12.2008';

  function zeile(z) {
    return { land: z[0], vorwahl: z[1], mindestalter: z[2], untergrenze: z[3], name: z[4] };
  }

  /**
   * Die Grenze zu einer Telefonnummer. Die längste passende Vorwahl gewinnt:
   * „+423…" ist Liechtenstein, nicht eine Nummer mit einer 4 vorne.
   */
  function grenzeFuer(telefon) {
    var z = Telefon.vergleichsform(telefon || '');
    var beste = null;
    for (var i = 0; i < GRENZEN.length; i++) {
      var v = GRENZEN[i][1];
      if (z.indexOf(v) === 0 && (!beste || v.length > beste[1].length)) beste = GRENZEN[i];
    }
    return zeile(beste || UNBEKANNT);
  }

  /**
   * „24.12.2008" oder „2008-12-24" → „2008-12-24".
   * Gibt '' zurück, wenn es kein Tag im Kalender ist (31.02. etwa).
   */
  function lesen(eingabe) {
    var roh = typeof eingabe === 'string' ? eingabe.trim() : '';
    var t, m, j;
    var de = roh.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    var iso = roh.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (de) {
      t = +de[1]; m = +de[2]; j = +de[3];
    } else if (iso) {
      j = +iso[1]; m = +iso[2]; t = +iso[3];
    } else {
      return '';
    }
    var d = new Date(Date.UTC(j, m - 1, t));
    if (d.getUTCFullYear() !== j || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== t) return '';
    return j + '-' + (m < 10 ? '0' : '') + m + '-' + (t < 10 ? '0' : '') + t;
  }

  /** Volle Jahre am Tag `heute` (Standard: jetzt). Wie `age()` in Postgres. */
  function alterAm(iso, heute) {
    var jetzt = heute || new Date();
    var teile = iso.split('-');
    var j = +teile[0], m = +teile[1], t = +teile[2];
    var jahre = jetzt.getFullYear() - j;
    var monat = jetzt.getMonth() + 1;
    if (monat < m || (monat === m && jetzt.getDate() < t)) jahre--;
    return jahre;
  }

  /** Gibt null zurück, wenn das Datum passt, sonst den Grund auf Deutsch. */
  function pruefe(eingabe) {
    var roh = typeof eingabe === 'string' ? eingabe.trim() : '';
    if (!roh) return 'Bitte dein Geburtsdatum eingeben';
    var iso = lesen(roh);
    if (!iso) return 'Das Geburtsdatum bitte als TT.MM.JJJJ eingeben';
    var jahre = alterAm(iso);
    if (jahre < 0) return 'Das Geburtsdatum liegt in der Zukunft';
    if (jahre > HOECHSTALTER) return 'Bitte das Geburtsdatum prüfen';
    return null;
  }

  /**
   * Was das Geburtsdatum für dieses Land heißt.
   *
   *   frei:        alt genug, das Konto ist sofort nutzbar
   *   eltern:      braucht die Bestätigung eines Elternteils
   *   verboten:    unter der Untergrenze, auch mit Eltern nicht
   */
  function einordnen(geburtsdatum, telefon, heute) {
    var iso = lesen(geburtsdatum);
    var grenze = grenzeFuer(telefon);
    var jahre = iso ? alterAm(iso, heute) : null;
    var stufe = 'frei';
    if (jahre !== null && jahre < grenze.mindestalter) stufe = 'eltern';
    if (jahre !== null && grenze.untergrenze !== null && jahre < grenze.untergrenze) stufe = 'verboten';
    return { iso: iso, alter: jahre, grenze: grenze, stufe: stufe };
  }

  /** Der Satz, den beide Oberflächen unter das Datum schreiben. */
  function hinweis(einordnung) {
    var g = einordnung.grenze;
    if (einordnung.stufe === 'verboten') {
      return 'In ' + g.name + ' ist All Media erst ab ' + g.untergrenze +
        ' Jahren erlaubt — auch mit Zustimmung der Eltern nicht früher.';
    }
    if (einordnung.stufe === 'eltern') {
      return 'In ' + g.name + ' brauchst du unter ' + g.mindestalter +
        ' Jahren die Zustimmung eines Elternteils. Dein Elternteil bestätigt dein Konto über das eigene All-Media-Konto.';
    }
    return '';
  }

  return {
    GRENZEN: GRENZEN,
    UNBEKANNT: UNBEKANNT,
    VOLLJAEHRIG: VOLLJAEHRIG,
    HOECHSTALTER: HOECHSTALTER,
    REGEL_TEXT: REGEL_TEXT,
    grenzeFuer: grenzeFuer,
    lesen: lesen,
    alterAm: alterAm,
    pruefe: pruefe,
    einordnen: einordnen,
    hinweis: hinweis,
  };
});
