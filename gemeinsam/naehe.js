/**
 * Orte in der Naehe — einmal fuer App und Website.
 *
 * Henrik am 21.09.2026 (Kasten 7.1): "Karte am Standort antippbar -> springt
 * in Kartenansicht wie bei der Friend-Map." Die Friend-Map zeigt unter der
 * Karte eine Liste "IN DER NAEHE". Die Kartenansicht eines Ortes bekommt
 * dieselbe Liste, nach Entfernung geordnet — und damit App und Website
 * dieselbe Reihenfolge und dieselben Kilometer zeigen, rechnen beide hier.
 *
 * UMD-Huelle wie in liedtext.js; Eintrag in UMD_BAUSTEINE
 * (app/test/_modulquelle.js) steht.
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    global.Naehe = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** "53.5413° N, 9.9891° O" in Zahlen. Sued und West werden negativ. */
  function koordinatenLesen(text) {
    var teile = String(text == null ? '' : text).match(
      /(-?\d+(?:\.\d+)?)\s*°?\s*([NS])?\s*,\s*(-?\d+(?:\.\d+)?)\s*°?\s*([OEW])?/i
    );
    if (!teile) return null;
    var lat = Number(teile[1]) * (/s/i.test(teile[2] || '') ? -1 : 1);
    var lng = Number(teile[3]) * (/w/i.test(teile[4] || '') ? -1 : 1);
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat: lat, lng: lng };
  }

  /** Luftlinie in Kilometern (Haversine, Erdradius 6371 km). */
  function entfernungKm(a, b) {
    if (!a || !b) return NaN;
    var rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad;
    var dLng = (b.lng - a.lng) * rad;
    var h =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** "hier", "850 m", "4,2 km", "37 km", "1.234 km". */
  function kmText(km) {
    if (typeof km !== 'number' || !isFinite(km)) return '';
    if (km < 0.05) return 'hier';
    if (km < 1) return Math.round(km * 100) * 10 + ' m';
    if (km < 10) return (Math.round(km * 10) / 10).toFixed(1).replace('.', ',') + ' km';
    return String(Math.round(km)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' km';
  }

  /**
   * Die Orte mit lesbaren Koordinaten, der Ort `hierId` zuerst, dann nach
   * Entfernung. Jeder Eintrag: { ort, lat, lng, km, text }.
   */
  function sortiert(hier, orte, hierId) {
    var liste = [];
    (Array.isArray(orte) ? orte : []).forEach(function (o) {
      var k = koordinatenLesen(o && o.koordinaten);
      if (!k) return;
      var km = hier ? entfernungKm(hier, k) : NaN;
      liste.push({ ort: o, lat: k.lat, lng: k.lng, km: km, text: kmText(km) });
    });
    liste.sort(function (a, b) {
      if (a.ort.id === hierId) return -1;
      if (b.ort.id === hierId) return 1;
      var x = isFinite(a.km) ? a.km : Infinity;
      var y = isFinite(b.km) ? b.km : Infinity;
      if (x !== y) return x - y;
      return String(a.ort.name || '').localeCompare(String(b.ort.name || ''), 'de');
    });
    return liste;
  }

  return {
    koordinatenLesen: koordinatenLesen,
    entfernungKm: entfernungKm,
    kmText: kmText,
    sortiert: sortiert,
  };
});
