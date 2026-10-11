/**
 * Ortssuche und Standort-Nachricht — einmal fuer App und Website.
 *
 * Henrik, 28.09.2026 (Kasten 6.5): „Standort senden ergibt insofern keinen
 * Sinn, da ich keinen Standort aussuchen kann auf der Karte oder kein
 * Suchfenster, wo ich einen raussuchen kann." Bis dahin gab es nur die feste
 * Liste aus `places`.
 *
 * DIENST: Nominatim (OpenStreetMap). Kostenlos, ohne Schluessel, ohne
 * Konto. Die Nutzungsregeln (operations.osmfoundation.org/policies/nominatim)
 * verlangen:
 *   - hoechstens eine Anfrage pro Sekunde        → `drossel` unten
 *   - eine erkennbare Anwendung (User-Agent oder Referer)
 *                                                 → App setzt `KENNUNG`, der
 *                                                   Browser schickt den Referer
 *   - keine Suche bei jedem Tastendruck           → gesucht wird erst auf
 *                                                   „Suchen"/Enter
 *   - Quellenangabe                               → `QUELLE`
 *
 * WARUM DER ORT IM TEXT STEHT UND NICHT IN EIGENEN SPALTEN
 *
 * Ein frei gewaehlter Ort hat keine Zeile in `places` (und soll keine
 * bekommen — `places` sind die Standortseiten im Explorer). Eigene Spalten
 * fuer Breite/Laenge waeren ein neues Schema UND laegen im Zweierchat im
 * Klartext neben einer verschluesselten Nachricht. Im Text dagegen geht der
 * Ort mit durch die Verschluesselung. Das Format endet auf eine `geo:`-Zeile
 * (RFC 5870), damit die Blase ihn sicher erkennt:
 *
 *   Standort: Brandenburger Tor
 *   Pariser Platz, 10117 Berlin
 *   geo:52.516275,13.377704
 *
 * Die erste Zeile ist zugleich die Vorschau in der Chatliste.
 *
 * UMD-Huelle wie in naehe.js; Eintrag in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) steht.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.OrtSuche = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ADRESSE = 'https://nominatim.openstreetmap.org';
  var KENNUNG = 'AllMedia-App/1.0 (Chat-Standortsuche)';
  var QUELLE = '© OpenStreetMap-Mitwirkende · Suche: Nominatim';
  var ABSTAND_MS = 1100;

  /* ------------------------------------------------------------ Drossel */
  /*
   * Eine Warteschlange je Laufzeit (App bzw. Browserfenster): jede Anfrage
   * wartet, bis seit der vorigen mindestens ABSTAND_MS vergangen sind. Kein
   * Verwerfen — wer zweimal schnell sucht, bekommt beide Antworten, nur
   * nacheinander.
   */
  var naechsteFrei = 0;
  function drossel(jetzt) {
    var t = typeof jetzt === 'number' ? jetzt : Date.now();
    var start = Math.max(t, naechsteFrei);
    naechsteFrei = start + ABSTAND_MS;
    return start - t;
  }
  function drosselZuruecksetzen() {
    naechsteFrei = 0;
  }
  function warten(ms) {
    return new Promise(function (fertig) {
      setTimeout(fertig, ms);
    });
  }

  /* ---------------------------------------------------------- Adressen */
  function suchAdresse(text, sprache) {
    var q = String(text == null ? '' : text).trim().slice(0, 200);
    return (
      ADRESSE +
      '/search?format=jsonv2&addressdetails=1&limit=8&accept-language=' +
      encodeURIComponent(sprache || 'de') +
      '&q=' +
      encodeURIComponent(q)
    );
  }

  function rueckAdresse(lat, lng, sprache) {
    return (
      ADRESSE +
      '/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=' +
      encodeURIComponent(sprache || 'de') +
      '&lat=' +
      Number(lat).toFixed(6) +
      '&lon=' +
      Number(lng).toFixed(6)
    );
  }

  /* ---------------------------------------------------------- Ergebnis */
  function gueltig(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      isFinite(lat) &&
      isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180
    );
  }

  /** Eine Zeile aus Nominatim in { name, adresse, lat, lng }. */
  function treffer(roh) {
    if (!roh) return null;
    var lat = Number(roh.lat);
    var lng = Number(roh.lon);
    if (!gueltig(lat, lng)) return null;
    var a = roh.address || {};
    var voll = String(roh.display_name || '');
    var name =
      String(roh.name || '').trim() ||
      [a.road, a.house_number].filter(Boolean).join(' ') ||
      a.city || a.town || a.village ||
      voll.split(',')[0] ||
      'Markierter Ort';
    var strasse = [a.road, a.house_number].filter(Boolean).join(' ');
    var ort = [a.postcode, a.city || a.town || a.village || a.municipality].filter(Boolean).join(' ');
    var adresse = [strasse, ort].filter(Boolean).join(', ');
    if (!adresse) {
      adresse = voll
        .split(',')
        .slice(1, 4)
        .map(function (t) { return t.trim(); })
        .filter(Boolean)
        .join(', ');
    }
    if (adresse === name) adresse = '';
    return { name: name.slice(0, 120), adresse: adresse.slice(0, 200), lat: lat, lng: lng };
  }

  /**
   * Suchen. `holen` ist fetch (App/Browser) — hineingereicht, damit die
   * Einheitstests ohne Netz laufen. Gibt immer eine Liste zurueck; wirft
   * nur, wenn der Dienst nicht antwortet.
   */
  function suchen(text, holen, optionen) {
    var o = optionen || {};
    var q = String(text == null ? '' : text).trim();
    if (q.length < 2) return Promise.resolve([]);
    return warten(drossel()).then(function () {
      return holen(suchAdresse(q, o.sprache), { headers: kopf(o) });
    }).then(function (antwort) {
      if (!antwort || !antwort.ok) throw new Error('Ortssuche antwortet nicht');
      return antwort.json();
    }).then(function (liste) {
      return (Array.isArray(liste) ? liste : []).map(treffer).filter(Boolean);
    });
  }

  /** Name und Adresse zu einem Punkt auf der Karte. Faellt nie aus. */
  function benennen(lat, lng, holen, optionen) {
    var o = optionen || {};
    var ersatz = { name: 'Markierter Ort', adresse: '', lat: lat, lng: lng };
    if (!gueltig(lat, lng)) return Promise.resolve(null);
    return warten(drossel()).then(function () {
      return holen(rueckAdresse(lat, lng, o.sprache), { headers: kopf(o) });
    }).then(function (antwort) {
      return antwort && antwort.ok ? antwort.json() : null;
    }).then(function (roh) {
      var t = treffer(roh);
      // Die Nadel steht, wo der Nutzer sie hingesetzt hat — nicht da, wo
      // Nominatim das naechste Haus findet.
      return t ? { name: t.name, adresse: t.adresse, lat: lat, lng: lng } : ersatz;
    }).catch(function () {
      return ersatz;
    });
  }

  /*
   * Im Browser ist User-Agent ein verbotener Kopf (fetch ignoriert ihn
   * still); dort genuegt der Referer. Die App setzt ihn.
   */
  function kopf(o) {
    var k = { Accept: 'application/json' };
    if (o && o.mitKennung) k['User-Agent'] = KENNUNG;
    return k;
  }

  /* ---------------------------------------------- Ort als Nachricht */
  function koordinatenText(lat, lng) {
    return Number(lat).toFixed(5) + ', ' + Number(lng).toFixed(5);
  }

  function zeile(t) {
    return String(t == null ? '' : t).replace(/[\r\n]+/g, ' ').trim();
  }

  /** { name, adresse, lat, lng } → Nachrichtentext (siehe Kopf). */
  function alsText(ort) {
    if (!ort || !gueltig(Number(ort.lat), Number(ort.lng))) return '';
    var teile = ['Standort: ' + (zeile(ort.name) || 'Markierter Ort')];
    if (zeile(ort.adresse)) teile.push(zeile(ort.adresse));
    teile.push('geo:' + Number(ort.lat).toFixed(6) + ',' + Number(ort.lng).toFixed(6));
    return teile.join('\n');
  }

  /**
   * Nachrichtentext → Standort fuer die Blase, oder null.
   * Dieselbe Form wie `Message.standort`; x/y = 50, weil die kleine
   * Kartenskizze in der Blase keine echte Projektion kennt.
   */
  function ausText(text) {
    var zeilen = String(text == null ? '' : text).split(/\r?\n/);
    if (zeilen.length < 2 || zeilen.length > 3) return null;
    var kopfzeile = zeilen[0].match(/^Standort:\s*(.+)$/);
    var geo = zeilen[zeilen.length - 1].trim().match(/^geo:(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)$/i);
    if (!kopfzeile || !geo) return null;
    var lat = Number(geo[1]);
    var lng = Number(geo[2]);
    if (!gueltig(lat, lng)) return null;
    return {
      name: kopfzeile[1].trim(),
      adresse: zeilen.length === 3 ? zeilen[1].trim() : '',
      koordinaten: koordinatenText(lat, lng),
      lat: lat,
      lng: lng,
      x: 50,
      y: 50,
    };
  }

  /** Der Ort in einer Karten-App von aussen (OpenStreetMap, ohne Schluessel). */
  function kartenLink(lat, lng) {
    return (
      'https://www.openstreetmap.org/?mlat=' +
      Number(lat).toFixed(6) +
      '&mlon=' +
      Number(lng).toFixed(6) +
      '#map=17/' +
      Number(lat).toFixed(6) +
      '/' +
      Number(lng).toFixed(6)
    );
  }

  return {
    QUELLE: QUELLE,
    KENNUNG: KENNUNG,
    ABSTAND_MS: ABSTAND_MS,
    suchAdresse: suchAdresse,
    rueckAdresse: rueckAdresse,
    treffer: treffer,
    suchen: suchen,
    benennen: benennen,
    drossel: drossel,
    drosselZuruecksetzen: drosselZuruecksetzen,
    alsText: alsText,
    ausText: ausText,
    koordinatenText: koordinatenText,
    kartenLink: kartenLink,
  };
});
