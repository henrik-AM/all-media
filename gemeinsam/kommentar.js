/**
 * Wie ein eigener Kommentar in der Liste steht — einmal für App und Website.
 *
 * WARUM GEMEINSAM
 *
 * Die Liste „Meine Kommentare" gibt es seit dem 21.09.2026 auf beiden Seiten.
 * Zwei Fassungen derselben Zeile laufen erfahrungsgemäß auseinander, sobald
 * eine davon angefasst wird — genau das ist bei der Telefonregel und bei der
 * Passwortprüfung passiert, bevor sie hierher gezogen wurden.
 *
 * Beides gehört in die Zeile: ohne den Kommentartext weiß man nicht, was man
 * geschrieben hat, ohne den Beitrag nicht, wo.
 *
 * WARUM DIE UMD-HUELLE
 *
 * Die Prüfläufe _aktionen, _handbuch und _kanal legen den übersetzten
 * App-Code als blob:-Modul in den Browser (test/_modulquelle.js). Dort gibt es
 * kein `require` — ein schlichtes `module.exports` lässt den Lauf mitten
 * drin mit „require is not defined" kippen, nach ein paar bestandenen
 * Prüfungen. Genau das ist am 07.09.2026 mit `telefon.js` passiert und am
 * 21.09.2026 hier wieder. Deshalb dieselbe Hülle wie dort, und der Eintrag in
 * UMD_BAUSTEINE.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Kommentar = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Der Ersatz, wenn ein Beitrag weder Titel noch Beschreibung hat. */
  const ART = { post: 'Foto', reel: 'Video (Hochformat)', clip: 'Video' };

  /** Wo der Kommentar steht — Titel, sonst Beschreibung, sonst die Art. */
  function beitragsName(beitrag) {
    const text = ((beitrag && (beitrag.title || beitrag.description)) || '').trim();
    return text || ART[beitrag && beitrag.kind] || 'Beitrag';
  }

  /** Die fertige Zeile: `„Kommentar" · Beitrag`. */
  function zeile(kommentar) {
    return `„${(kommentar.text || '').trim()}" · ${kommentar.beitrag}`;
  }

  /* ------------------------------------------------------------------ */
  /* Antworten auf Kommentare (Feedback 28.09., Nachtrag 4.3b, 11.10.)   */
  /* ------------------------------------------------------------------ */
  /*
   * Henrik: „Damit meinte ich Community Chats in jeglicher Art und Weise +
   * Kommentare etc. bei Videos." Wie bei Instagram/TikTok: unter jedem
   * Kommentar „Antworten", nach rechts ziehen geht auch, „@name" steht schon
   * im Feld, die Antworten hängen eingerückt darunter und klappen mit
   * „N Antworten ansehen" auf.
   *
   * EINE EBENE
   *
   * `reply_to` zeigt immer auf den Kommentar OBEN (die Wurzel), nie auf eine
   * Antwort — die Datenbank erzwingt das (Schema 92). Wer auf eine Antwort
   * antwortet, hängt am selben Kommentar; an wen er sich richtet, steht in
   * `antwort_an` (dieser Kommentar bekommt die Mitteilung).
   */

  /** Die Wurzel, an die eine Antwort auf `k` gehängt wird. */
  function wurzelVon(k) {
    if (!k) return null;
    return k.antwortAuf || k.id || null;
  }

  /** Was beim Senden mitgeht: Wurzel und der angesprochene Kommentar. */
  function antwortZiel(k) {
    if (!k || !k.id) return null;
    return { antwortAuf: wurzelVon(k), antwortAn: k.id };
  }

  /**
   * Die Vorbelegung des Eingabefelds: „@name ". Beim eigenen Kommentar und
   * ohne bekannten Benutzernamen bleibt das Feld leer — ein „@" ohne Namen
   * wäre eine Markierung ins Leere.
   */
  function vorbelegung(handle, eigen) {
    var h = String(handle || '').trim().replace(/^@+/, '');
    if (eigen || !h) return '';
    return '@' + h + ' ';
  }

  /**
   * Kommentare in Fäden ordnen: oben die Wurzeln in ihrer Reihenfolge, je
   * mit ihren Antworten (älteste zuerst, wie bei Instagram). Steht die
   * Wurzel einer Antwort nicht in der Liste (nicht geladen, gelöscht, für
   * mich nicht lesbar), steht die Antwort selbst oben — lieber ohne Faden
   * als gar nicht.
   */
  function faeden(liste) {
    var alle = Array.isArray(liste) ? liste : [];
    var wurzeln = [];
    var nach = {};
    var i;
    for (i = 0; i < alle.length; i++) {
      var k = alle[i];
      if (k && !k.antwortAuf) nach[k.id] = true;
    }
    var antworten = {};
    for (i = 0; i < alle.length; i++) {
      var a = alle[i];
      if (!a) continue;
      if (a.antwortAuf && nach[a.antwortAuf]) {
        (antworten[a.antwortAuf] = antworten[a.antwortAuf] || []).push(a);
      } else {
        wurzeln.push(a);
      }
    }
    return wurzeln.map(function (w) {
      return { kommentar: w, antworten: antworten[w.id] || [] };
    });
  }

  /** Der Klappknopf unter einem Kommentar mit Antworten. */
  function klappText(anzahl, offen) {
    var n = Number(anzahl) || 0;
    if (n <= 0) return '';
    if (offen) return 'Antworten ausblenden';
    return n === 1 ? '1 Antwort ansehen' : n + ' Antworten ansehen';
  }

  /** Die Leiste über dem Eingabefeld, solange geantwortet wird. */
  function leistenText(name) {
    return name ? 'Antwort an ' + name : 'Antwort';
  }

  /** Der Platzhalter im Eingabefeld beim Antworten. */
  var PLATZHALTER_ANTWORT = 'Antwort hinzufügen';

  /**
   * Steht da, wenn die Datenbank Antworten noch nicht kennt (Schema 92 nicht
   * eingespielt): der Kommentar ging trotzdem raus, nur ohne Faden.
   */
  var OHNE_FADEN =
    'Gesendet — als eigener Kommentar, bis Antworten auf Kommentare freigeschaltet ist';

  /** Der Satz in der Glocke (App: ProfilContext, Website: server/app.js). */
  function mitteilungAntwort(name) {
    return (name || 'Jemand') + ' hat auf deinen Kommentar geantwortet.';
  }

  /**
   * Fehlt eine der Spalten noch (Schema 92)? Lesen: 42703, Schreiben:
   * PGRST204. Dieselbe Prüfung wie Chatblase.fehltSpalte, hier ohne
   * Abhängigkeit zwischen den Bausteinen.
   */
  function fehltSpalte(fehler) {
    if (!fehler) return false;
    var code = String(fehler.code || '');
    var text = String(fehler.message || '');
    if (code !== '42703' && code !== 'PGRST204') return false;
    return text.indexOf('reply_to') !== -1 || text.indexOf('antwort_an') !== -1;
  }

  return {
    ART: ART,
    beitragsName: beitragsName,
    zeile: zeile,
    wurzelVon: wurzelVon,
    antwortZiel: antwortZiel,
    vorbelegung: vorbelegung,
    faeden: faeden,
    klappText: klappText,
    leistenText: leistenText,
    PLATZHALTER_ANTWORT: PLATZHALTER_ANTWORT,
    OHNE_FADEN: OHNE_FADEN,
    mitteilungAntwort: mitteilungAntwort,
    fehltSpalte: fehltSpalte,
  };
});
