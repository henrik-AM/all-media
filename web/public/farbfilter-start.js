/*
 * Farbfilter auf der ganzen Seite (Kasten 21, 06.10.2026).
 *
 * Läuft als erstes Skript im <body>, noch bevor der übrige Inhalt steht
 * (index.html). Liest den letzten bekannten Stand aus dem Rückfall-Speicher
 * der Einstellungen (localStorage 'am-einstellungen', geschrieben von
 * einstellungenHolen()/einstellungSetzen() in app.js) und legt den Filter
 * sofort an — ohne das blitzte die Seite bei jedem Laden einmal ungefiltert
 * auf, bis /api/einstellungen geantwortet hat.
 *
 * WARUM AUF <html>
 *
 * Ein CSS-Filter macht sein Element zum Bezugsrahmen für `position: fixed`
 * (Filter Effects Level 1, „filter" → containing block). Auf `.app` oder
 * `body` säßen der Toast und alle festen Ebenen danach nicht mehr am
 * Bildschirm, sondern an diesem Element. Ausgenommen ist nur das
 * Wurzelelement — deshalb hier. Alles darunter läuft mit durch: Blätter,
 * Overlays, Toast, Bilder und Videos.
 *
 * WARUM SVG UND NICHT grayscale()/sepia()
 *
 * Die CSS-Kurzformen rechnen mit anderen Gewichten als die App (grayscale()
 * mit 0,2126/0,7152/0,0722, die Mischmodi der App mit 0,3/0,59/0,11), und
 * für die Farbsehschwächen gibt es gar keine. Mit `feColorMatrix` rechnet
 * die Seite genau die Matrix aus gemeinsam/farbfilter.js; die Farbtönung
 * geht über `feBlend mode="color"`, denselben Mischmodus wie in der App.
 *
 * Gegenstück in der App: app/components/Farbfilter.tsx.
 */
(function () {
  'use strict';

  var F = window.Farbfilter;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var SPEICHER = 'am-einstellungen';
  var zaehler = 0;
  var zuletzt = null;
  var vergleich = false;

  function svg() {
    var s = document.getElementById('am-farbfilter-svg');
    if (s) return s;
    // Rückfall, falls index.html ihn einmal nicht mitbringt.
    s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('id', 'am-farbfilter-svg');
    s.setAttribute('width', '0');
    s.setAttribute('height', '0');
    s.setAttribute('aria-hidden', 'true');
    s.style.position = 'absolute';
    (document.body || document.documentElement).appendChild(s);
    return s;
  }

  function el(name, attrs) {
    var e = document.createElementNS(SVG_NS, name);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) e.setAttribute(k, attrs[k]);
    return e;
  }

  /*
   * Den Filter neu bauen und auf <html> legen.
   *
   * Jedes Mal mit neuer Kennung statt die Werte im vorhandenen <filter> zu
   * ändern: Chrome und Safari bauen den Filter einer Seite nicht immer neu
   * auf, wenn sich nur ein Attribut darin ändert — dann stünde der neue Wert
   * im Dokument und der alte auf dem Bildschirm.
   */
  function setzen(beschreibung) {
    var wurzel = document.documentElement;
    var halter = svg();
    while (halter.firstChild) halter.removeChild(halter.firstChild);

    if (!beschreibung || vergleich) {
      wurzel.style.removeProperty('filter');
      wurzel.removeAttribute('data-farbfilter');
      return;
    }

    zaehler += 1;
    var id = 'am-farbfilter-' + zaehler;
    var filter = el('filter', {
      id: id,
      'color-interpolation-filters': 'sRGB',
      x: '0',
      y: '0',
      width: '100%',
      height: '100%',
    });

    if (beschreibung.matrix) {
      filter.appendChild(el('feColorMatrix', { type: 'matrix', values: beschreibung.matrix }));
    } else {
      // Fläche in der Tönung, im Modus `color` über die Seite gemischt und
      // auf deren Umriss beschnitten — wie die Fläche über der App.
      filter.appendChild(
        el('feFlood', {
          'flood-color': beschreibung.farbe,
          'flood-opacity': String(beschreibung.deckkraft),
          result: 'ton',
        })
      );
      filter.appendChild(el('feBlend', { in: 'ton', in2: 'SourceGraphic', mode: beschreibung.modus, result: 'gemischt' }));
      filter.appendChild(el('feComposite', { in: 'gemischt', in2: 'SourceAlpha', operator: 'in' }));
    }

    halter.appendChild(filter);
    wurzel.style.setProperty('filter', 'url(#' + id + ')');
    wurzel.setAttribute('data-farbfilter', beschreibung.matrix ? 'matrix' : 'ton');
  }

  /** Aus den Einstellungen (Schlüssel → Text) den Filter setzen. */
  function anwenden(werte) {
    if (!F) return null;
    var k = F.lesen(werte || {});
    zuletzt = k;
    setzen(F.webFilter(k));
    return k;
  }

  /**
   * Vorher/Nachher: solange `an`, ist der Filter aus. Für den Knopf
   * „Gedrückt halten: ohne Filter vergleichen" im Bereich.
   */
  function vergleichen(an) {
    vergleich = Boolean(an);
    setzen(zuletzt && F ? F.webFilter(zuletzt) : null);
  }

  window.FarbfilterWeb = {
    anwenden: anwenden,
    vergleichen: vergleichen,
    zustand: function () {
      return zuletzt;
    },
  };

  // Der Sofortwert beim Laden.
  try {
    anwenden(JSON.parse(localStorage.getItem(SPEICHER) || '{}'));
  } catch (e) {
    /* Speicher gesperrt oder kaputt — dann eben erst nach dem Laden. */
  }
})();
