/**
 * Farbfilter — dieselbe Rechnung für App und Website (Kasten 21, 06.10.2026).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik: „Farbfilter in All Media integrieren (Einstellungsbereich unter
 * Einstellungen) — schaue selbst nach, welche Farbfilter es gibt und wofür
 * man sie braucht." Vorbild sind die Bedienungshilfen der Betriebssysteme:
 *
 *   iOS      Bedienungshilfen → Anzeige & Textgröße → Farbfilter:
 *            Graustufen, Rot/Grün-Filter (Protanopie), Grün/Rot-Filter
 *            (Deuteranopie), Blau/Gelb-Filter (Tritanopie), Farbton —
 *            jeweils mit Regler „Intensität" (beim Farbton auch „Farbton").
 *   Android  Bedienungshilfen → Farbkorrektur (Deuteranomalie, Protanomalie,
 *            Tritanomalie, Graustufen), Farbumkehr, „Extradunkel".
 *   Windows  Barrierefreiheit → Farbfilter: Graustufen, Umgekehrt,
 *            Rot-Grün (Grün schwach, Deuteranopie), Rot-Grün (Rot schwach,
 *            Protanopie), Blau-Gelb (Tritanopie).
 *   Dazu Night Shift (iOS) / Nachtlicht (Windows, Android): wärmere Farben
 *   am Abend.
 *
 * Farbumkehr und „Extradunkel" fehlen hier bewusst: dafür gibt es in All
 * Media das dunkle Design, und eine Umkehr macht Fotos und Videos zu
 * Negativen.
 *
 * WIE GERECHNET WIRD
 *
 * Jeder Filter ist eine Farbmatrix (4 × 5, wie SVG `feColorMatrix`), die
 * Intensität blendet linear zwischen Einheitsmatrix (0 %) und vollem
 * Filter (100 %). Gerechnet wird in sRGB-Werten 0…1 (die Website setzt
 * dafür `color-interpolation-filters="sRGB"`), weil auch die Mischmodi der
 * App dort rechnen.
 *
 *   - Graustufen: Helligkeit mit den Gewichten 0,3 / 0,59 / 0,11 — das ist
 *     die Lum()-Formel der W3C-Mischmodi, also genau das, was der
 *     Mischmodus `saturation` in der App ausrechnet.
 *   - Farbsehschwächen: Daltonisierung nach Fidaner et al. — erst
 *     simulieren, was die Person sieht (Matrizen von Machado, Oliveira und
 *     Fernandes 2009, Schweregrad 1,0), den Unterschied zum Original („was
 *     verloren geht") bilden und ihn in die Kanäle schieben, die noch
 *     gesehen werden:  K = I + E · (I − S).
 *   - Warmton: weniger Blau und etwas weniger Grün, wie Night Shift
 *     (Diagonalmatrix).
 *   - Farbtönung: der Mischmodus `color` — Farbton und Sättigung der
 *     gewählten Farbe, Helligkeit des Bildes. Die Website rechnet ihn mit
 *     `feBlend mode="color"` statt mit der Matrix (siehe webFilter), damit
 *     auch die Begrenzung (ClipColor) dieselbe ist wie in der App.
 *
 * WARUM DIE APP NICHT ÜBERALL DIESELBE MATRIX HAT
 *
 * React Native kennt keinen Farbmatrix-Filter über die ganze Oberfläche.
 * Der Style `filter` kann auf iOS nur `brightness` und `opacity` (die
 * übrigen hängen an einem Schalter, der in Expo Go aus ist —
 * RCTViewComponentView.mm, enableSwiftUIBasedFilters). Was beide Systeme
 * können, ist `mixBlendMode`: eine Fläche über der App, die sich mit allem
 * darunter mischt — auch mit Bildern und Videos. Damit lassen sich
 * Graustufen (`saturation`), Warmton (`multiply`) und Farbtönung (`color`)
 * EXAKT nachbauen — die Rechnung ist dieselbe wie die Matrix hier.
 *
 * Eine Daltonisierung braucht dagegen eine volle 3 × 3-Matrix, die Rot in
 * Grün und Blau umleitet; Mischmodi können Kanäle nur einzeln verändern oder
 * über die Helligkeit verbinden. Die App benutzt deshalb für die drei
 * Farbsehschwächen eine NÄHERUNG aus drei Schichten (multiply → saturation →
 * color-dodge), deren Werte so gewählt sind, dass verwechselbare Farbpaare
 * für die simulierte Sehschwäche möglichst weit auseinanderrücken, ohne das
 * Bild zu entstellen. Wie gut das gelingt, misst `app/test/_farbfilter_rechnung.js`
 * (Abstand der Verwechslungspaare, Abweichung vom Original). Die Oberfläche
 * sagt es in der App dazu (`appHinweis`).
 *
 * WARUM DIE UMD-HÜLLE
 *
 * Die Website lädt die Datei als eigenes <script> (setzt `window.Farbfilter`),
 * die App über Metro mit `require`, der Einheitstest unter Node. Eingetragen
 * in UMD_BAUSTEINE (app/test/_modulquelle.js).
 */

(function (global, factory) {
  if (typeof module === 'object' && module.exports) {
    // Node und Metro.
    module.exports = factory();
  } else {
    // Browser: als eigenes <script> eingebunden.
    global.Farbfilter = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Lum() der W3C-Mischmodi (Compositing and Blending Level 1). */
  const LUM = [0.3, 0.59, 0.11];

  /*
   * Simulation der Dichromasie, Machado et al. 2009, Schweregrad 1,0.
   * Zeile = Ausgabekanal R, G, B.
   */
  const SIMULATION = {
    protanopie: [
      [0.152286, 1.052583, -0.204868],
      [0.114503, 0.786281, 0.099216],
      [-0.003882, -0.048116, 1.051998],
    ],
    deuteranopie: [
      [0.367322, 0.860646, -0.227968],
      [0.280085, 0.672501, 0.047413],
      [-0.01182, 0.04294, 0.968881],
    ],
    tritanopie: [
      [1.255528, -0.076749, -0.178779],
      [-0.078411, 0.930809, 0.147602],
      [0.004733, 0.691367, 0.3039],
    ],
  };

  /*
   * Wohin der verlorene Anteil geschoben wird (Fidaner, Lin, Ozguven:
   * „Analysis of Color Blindness"). Bei Rot/Grün-Schwäche in Grün und Blau,
   * bei Blau/Gelb-Schwäche in Rot und Grün.
   */
  const VERSCHIEBUNG = {
    protanopie: [
      [0, 0, 0],
      [0.7, 1, 0],
      [0.7, 0, 1],
    ],
    deuteranopie: [
      [0, 0, 0],
      [0.7, 1, 0],
      [0.7, 0, 1],
    ],
    tritanopie: [
      [1, 0, 0.7],
      [0, 1, 0.7],
      [0, 0, 0],
    ],
  };

  /** Warmton bei 100 %: etwa 3400 K, wie Night Shift „wärmer". */
  const WARM = [1, 0.78, 0.55];

  /*
   * Die Näherung der App für die drei Farbsehschwächen (siehe oben).
   *
   *   m   multiply mit dieser Farbe (je Kanal ≤ 1)
   *   a   Deckkraft einer grauen Fläche im Modus `saturation`
   *   g   Verstärkung je Kanal (≥ 1), als color-dodge mit 1 − 1/g
   *
   * Ermittelt am 06.10.2026 durch eine Suche über diese drei Schichten —
   * Ziel: Verwechslungspaare unter der Simulation trennen, Abweichung vom
   * Original klein halten, m ≥ 0,25 und g ≤ 3 (sonst Treppen im 8-Bit-
   * Zwischenbild). Nachgemessen in app/test/_farbfilter_rechnung.js.
   */
  const NAEHERUNG = {
    protanopie: { m: [1, 0.25, 0.55], a: 0.62, g: [1.6, 2.94, 2.16] },
    deuteranopie: { m: [0.92, 1, 1], a: 0, g: [1, 1.67, 1] },
    tritanopie: { m: [1, 1, 0.98], a: 0, g: [1, 1.26, 1] },
  };

  /*
   * Die Filter in der Reihenfolge, in der sie im Bereich stehen. `kurz` ist
   * der eine Satz „wofür", der unter dem Namen steht — auf beiden Seiten
   * wörtlich gleich. `appHinweis` steht nur in der App, und zwar nur dort,
   * wo sie rechnerisch nicht dasselbe kann wie die Website.
   */
  const FILTER = [
    {
      id: 'graustufen',
      name: 'Graustufen',
      kurz: 'Nimmt alle Farben heraus. Hilft, die App ruhiger und bewusster zu nutzen, und bei fehlendem Farbsehen.',
      appExakt: true,
    },
    {
      id: 'protanopie',
      name: 'Rot/Grün-Filter (Protanopie)',
      kurz: 'Bei Rot-Schwäche: Rottöne werden so verschoben, dass sie sich von Grün abheben.',
      appExakt: false,
    },
    {
      id: 'deuteranopie',
      name: 'Grün/Rot-Filter (Deuteranopie)',
      kurz: 'Bei Grün-Schwäche, der häufigsten Farbsehschwäche (etwa 5 von 100 Männern).',
      appExakt: false,
    },
    {
      id: 'tritanopie',
      name: 'Blau/Gelb-Filter (Tritanopie)',
      kurz: 'Bei der seltenen Blau-Gelb-Schwäche: Blau und Grün werden besser unterscheidbar.',
      appExakt: false,
    },
    {
      id: 'warmton',
      name: 'Warmton',
      kurz: 'Weniger blaues Licht, wärmere Farben — angenehmer am Abend und für müde Augen.',
      appExakt: true,
    },
    {
      id: 'farbton',
      name: 'Farbtönung',
      kurz: 'Färbt alles in einem wählbaren Ton. Hilft manchen bei Lichtempfindlichkeit, Migräne oder Leseschwierigkeiten (Irlen-Syndrom).',
      appExakt: true,
    },
  ];

  const ARTEN = FILTER.map(function (f) {
    return f.id;
  });

  /** Was oben im Bereich steht — gleich in App und Website. */
  const EINLEITUNG =
    'Farbfilter verändern die Farben der ganzen App, auch von Fotos und Videos. ' +
    'Sie helfen bei Farbsehschwächen (etwa 8 von 100 Männern und 1 von 200 Frauen), ' +
    'bei Lichtempfindlichkeit und am Abend. Die Einstellung gilt auf allen deinen Geräten.';

  /** Nur in der App, unter den drei Farbsehschwäche-Filtern. */
  const APP_HINWEIS =
    'In der App eine Näherung — die genaue Korrektur bietet dein Telefon unter ' +
    'Einstellungen → Bedienungshilfen → Farbfilter (Android: Farbkorrektur).';

  const VERGLEICH_TEXT = 'Gedrückt halten: ohne Filter vergleichen';

  /*
   * Die Schlüssel in `user_settings` (Schema 16, ein Wert je Zeile, Text).
   * Kein neues Schema nötig.
   */
  const SCHLUESSEL = {
    an: 'farbfilter',
    art: 'farbfilterArt',
    staerke: 'farbfilterStaerke',
    farbton: 'farbfilterFarbton',
  };

  /** Auslieferungszustand — iOS beginnt ebenfalls mit Graustufen. */
  const STANDARD = { an: false, art: 'graustufen', staerke: 100, farbton: 30 };

  /** Was „Zurücksetzen" schreibt: [Schlüssel, Wert] in Textform. */
  const ZURUECKSETZEN = [
    [SCHLUESSEL.an, 'aus'],
    [SCHLUESSEL.art, STANDARD.art],
    [SCHLUESSEL.staerke, String(STANDARD.staerke)],
    [SCHLUESSEL.farbton, String(STANDARD.farbton)],
  ];

  /*
   * Die Farben der Vorschau, angelehnt an das Farbstifte-Bild von iOS. Die
   * Paare Rot/Grün und Blau/Gelb stehen nebeneinander, weil genau sie bei
   * den Sehschwächen verwechselt werden.
   */
  const VORSCHAU = [
    { name: 'Rot', farbe: '#E53935' },
    { name: 'Grün', farbe: '#43A047' },
    { name: 'Orange', farbe: '#FB8C00' },
    { name: 'Oliv', farbe: '#8D9A2E' },
    { name: 'Blau', farbe: '#1E88E5' },
    { name: 'Gelb', farbe: '#FDD835' },
    { name: 'Violett', farbe: '#8E24AA' },
    { name: 'Türkis', farbe: '#00ACC1' },
  ];

  // --------------------------------------------------------- Hilfen --

  function zahl(roh, standard, min, max) {
    const n = parseInt(String(roh == null ? '' : roh), 10);
    if (!isFinite(n)) return standard;
    return Math.min(max, Math.max(min, n));
  }

  function rund(x) {
    return Math.round(x * 10000) / 10000;
  }

  function einheit3() {
    return [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
  }

  function mal3(a, b) {
    const r = [];
    for (let i = 0; i < 3; i++) {
      r.push([]);
      for (let j = 0; j < 3; j++) {
        r[i].push(a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]);
      }
    }
    return r;
  }

  /** 3 × 3 (+ Versatz) → 4 × 5 wie feColorMatrix. */
  function voll(m3, versatz) {
    const v = versatz || [0, 0, 0];
    return [
      [m3[0][0], m3[0][1], m3[0][2], 0, v[0]],
      [m3[1][0], m3[1][1], m3[1][2], 0, v[1]],
      [m3[2][0], m3[2][1], m3[2][2], 0, v[2]],
      [0, 0, 0, 1, 0],
    ];
  }

  function einheit() {
    return voll(einheit3());
  }

  /** Farbton (0…359°) → reine Farbe, HSL mit S = 100 %, L = 50 %. */
  function tonFarbe(grad) {
    const h = ((((grad % 360) + 360) % 360) / 60);
    const x = 1 - Math.abs((h % 2) - 1);
    const t = [
      [1, x, 0],
      [x, 1, 0],
      [0, 1, x],
      [0, x, 1],
      [x, 0, 1],
      [1, 0, x],
    ][Math.floor(h) % 6];
    return t;
  }

  /*
   * Die Farbe, mit der getönt wird: der gewählte Farbton, aber nur halb so
   * kräftig wie die reine Farbe. Zwei Gründe: Eine voll gesättigte Tönung
   * macht bei 100 % aus jedem Foto ein einfarbiges Bild (auch iOS bleibt
   * darunter). Und der Mischmodus `color` begrenzt zu kräftige Ergebnisse
   * mit ClipColor (Farbton bleibt), eine Matrix kappt je Kanal — bei halber
   * Sättigung kommt das im mittleren Helligkeitsbereich nicht vor, App und
   * Website zeigen dort dasselbe.
   */
  const TOENUNG_SAETTIGUNG = 0.5;

  function toenung(grad) {
    return tonFarbe(grad).map(function (v) {
      return 0.5 + TOENUNG_SAETTIGUNG * (v - 0.5);
    });
  }

  function lum(c) {
    return LUM[0] * c[0] + LUM[1] * c[1] + LUM[2] * c[2];
  }

  function hex2(x) {
    const v = Math.round(Math.min(1, Math.max(0, x)) * 255);
    return (v < 16 ? '0' : '') + v.toString(16);
  }

  function alsHex(c) {
    return '#' + hex2(c[0]) + hex2(c[1]) + hex2(c[2]);
  }

  function ausHex(h) {
    const s = String(h).replace('#', '');
    return [0, 2, 4].map(function (i) {
      return parseInt(s.slice(i, i + 2), 16) / 255;
    });
  }

  function rgba(c, a) {
    return (
      'rgba(' +
      Math.round(c[0] * 255) + ',' +
      Math.round(c[1] * 255) + ',' +
      Math.round(c[2] * 255) + ',' +
      rund(a) + ')'
    );
  }

  // --------------------------------------------------- Einstellungen --

  /**
   * Aus den Werten von `user_settings` (Text) den gültigen Zustand machen.
   * Unbekannte oder kaputte Werte fallen auf den Auslieferungszustand.
   */
  function lesen(werte) {
    const w = werte || {};
    const art = w[SCHLUESSEL.art];
    return {
      an: w[SCHLUESSEL.an] === 'an',
      art: ARTEN.indexOf(art) >= 0 ? art : STANDARD.art,
      staerke: zahl(w[SCHLUESSEL.staerke], STANDARD.staerke, 0, 100),
      farbton: zahl(w[SCHLUESSEL.farbton], STANDARD.farbton, 0, 359),
    };
  }

  /** Wirkt überhaupt etwas? Bei 0 % Intensität nicht. */
  function aktiv(k) {
    return Boolean(k && k.an && k.staerke > 0 && ARTEN.indexOf(k.art) >= 0);
  }

  function filterVon(id) {
    for (let i = 0; i < FILTER.length; i++) if (FILTER[i].id === id) return FILTER[i];
    return null;
  }

  /** Was in der Liste rechts neben „Farbfilter" steht. */
  function statusText(k) {
    if (!k || !k.an) return 'Aus';
    const f = filterVon(k.art);
    const name = f ? f.name.replace(/ \(.*\)$/, '') : k.art;
    return name + ' · ' + k.staerke + ' %';
  }

  // ------------------------------------------------------- Matrizen --

  /** Der volle Filter (100 %) als 4 × 5-Matrix. */
  function vollerFilter(art, farbton) {
    if (art === 'graustufen') {
      return voll([LUM.slice(), LUM.slice(), LUM.slice()]);
    }
    if (SIMULATION[art]) {
      const s = SIMULATION[art];
      const e = VERSCHIEBUNG[art];
      const i = einheit3();
      const fehler = i.map(function (z, r) {
        return z.map(function (v, c) {
          return v - s[r][c];
        });
      });
      const schub = mal3(e, fehler);
      return voll(
        i.map(function (z, r) {
          return z.map(function (v, c) {
            return v + schub[r][c];
          });
        })
      );
    }
    if (art === 'warmton') {
      return voll([
        [WARM[0], 0, 0],
        [0, WARM[1], 0],
        [0, 0, WARM[2]],
      ]);
    }
    if (art === 'farbton') {
      // Mischmodus `color`: SetLum(Cs, Lum(Cb)) = Cs + (Lum(Cb) − Lum(Cs)).
      const cs = toenung(farbton == null ? STANDARD.farbton : farbton);
      const ls = lum(cs);
      return voll([LUM.slice(), LUM.slice(), LUM.slice()], [cs[0] - ls, cs[1] - ls, cs[2] - ls]);
    }
    return einheit();
  }

  /**
   * Die Matrix für Filter, Intensität (0…100) und Farbton —
   * linear zwischen Einheitsmatrix und vollem Filter.
   */
  function matrix(art, staerke, farbton) {
    const t = Math.min(100, Math.max(0, Number(staerke) || 0)) / 100;
    const f = vollerFilter(art, farbton);
    const e = einheit();
    return f.map(function (z, r) {
      return z.map(function (v, c) {
        return rund((1 - t) * e[r][c] + t * v);
      });
    });
  }

  /** Für SVG `<feColorMatrix type="matrix" values="…">`. */
  function svgWerte(m) {
    return m
      .map(function (z) {
        return z.join(' ');
      })
      .join(' ');
  }

  /**
   * Was die Website in ihren SVG-Filter schreibt.
   *
   *   { matrix: '…20 Zahlen…' }                 → <feColorMatrix>
   *   { modus: 'color', farbe, deckkraft }       → <feFlood> + <feBlend>
   *
   * Die Farbtönung geht auf der Website über `feBlend mode="color"` — das ist
   * derselbe Mischmodus (mit ClipColor) wie `mixBlendMode: 'color'` in der
   * App, also auch bei sehr dunklen und sehr hellen Farben dasselbe Bild.
   * `null` heißt: kein Filter.
   */
  function webFilter(k) {
    if (!aktiv(k)) return null;
    if (k.art === 'farbton') {
      return { modus: 'color', farbe: alsHex(toenung(k.farbton)), deckkraft: rund(k.staerke / 100) };
    }
    return { matrix: svgWerte(matrix(k.art, k.staerke, k.farbton)) };
  }

  /** Eine Farbe (0…1) durch die Matrix — mit Begrenzung wie im Browser. */
  function anwenden(m, c) {
    const r = [];
    for (let i = 0; i < 3; i++) {
      const v = m[i][0] * c[0] + m[i][1] * c[1] + m[i][2] * c[2] + m[i][4];
      r.push(Math.min(1, Math.max(0, v)));
    }
    return r;
  }

  // ------------------------------------------------ Schichten (App) --

  /**
   * Die Flächen, die die App über ihre Oberfläche legt — von unten nach oben.
   * Jede: `{ modus, farbe }` mit `modus` als RN-`mixBlendMode` und `farbe`
   * als `backgroundColor`. Leere Liste heißt: kein Filter.
   */
  function schichten(art, staerke, farbton) {
    const t = Math.min(100, Math.max(0, Number(staerke) || 0)) / 100;
    if (t <= 0) return [];

    if (art === 'graustufen') {
      return [{ modus: 'saturation', farbe: rgba([0.5, 0.5, 0.5], t) }];
    }
    if (art === 'warmton') {
      // multiply mit Deckkraft t ist dasselbe wie multiply mit 1 − t·(1 − c).
      const c = WARM.map(function (w) {
        return 1 - t * (1 - w);
      });
      return [{ modus: 'multiply', farbe: rgba(c, 1) }];
    }
    if (art === 'farbton') {
      return [{ modus: 'color', farbe: rgba(toenung(farbton == null ? STANDARD.farbton : farbton), t) }];
    }
    const n = NAEHERUNG[art];
    if (!n) return [];
    const raus = [];
    const m = n.m.map(function (v) {
      return 1 - t * (1 - v);
    });
    const g = n.g.map(function (v) {
      return 1 + t * (v - 1);
    });
    const a = n.a * t;
    if (m.some(function (v) { return v < 0.999; })) raus.push({ modus: 'multiply', farbe: rgba(m, 1) });
    if (a > 0.001) raus.push({ modus: 'saturation', farbe: rgba([0.5, 0.5, 0.5], a) });
    if (g.some(function (v) { return v > 1.001; })) {
      raus.push({
        modus: 'color-dodge',
        farbe: rgba(
          g.map(function (v) {
            return 1 - 1 / v;
          }),
          1
        ),
      });
    }
    return raus;
  }

  /*
   * Die Mischmodi nach W3C, auf einem deckenden Hintergrund. Gebraucht vom
   * Einheitstest (rechnet die App-Schichten nach) und von niemandem sonst.
   */
  function satzFarbe(c, l) {
    const d = l - lum(c);
    let r = [c[0] + d, c[1] + d, c[2] + d];
    const L = lum(r);
    const n = Math.min(r[0], r[1], r[2]);
    const x = Math.max(r[0], r[1], r[2]);
    if (n < 0) r = r.map(function (v) { return L + ((v - L) * L) / (L - n); });
    if (x > 1) r = r.map(function (v) { return L + ((v - L) * (1 - L)) / (x - L); });
    return r;
  }

  function mischen(modus, cb, cs) {
    if (modus === 'multiply') return cb.map(function (v, i) { return v * cs[i]; });
    if (modus === 'color-dodge') {
      return cb.map(function (v, i) {
        if (v === 0) return 0;
        if (cs[i] >= 1) return 1;
        return Math.min(1, v / (1 - cs[i]));
      });
    }
    if (modus === 'saturation') {
      // Sättigung der grauen Quelle ist 0 → Ergebnis grau mit Lum(cb).
      const l = lum(cb);
      return [l, l, l];
    }
    if (modus === 'color') return satzFarbe(cs, lum(cb));
    return cs;
  }

  function leseRgba(s) {
    const t = String(s).match(/rgba\(([^)]+)\)/);
    const z = t ? t[1].split(',').map(Number) : [0, 0, 0, 1];
    return { c: [z[0] / 255, z[1] / 255, z[2] / 255], a: z[3] };
  }

  /** Eine Farbe durch die Schichten der App rechnen (8-Bit-Zwischenstufen nicht nachgebildet). */
  function schichtenAnwenden(liste, c) {
    let cb = c.slice();
    for (let i = 0; i < liste.length; i++) {
      const q = leseRgba(liste[i].farbe);
      const b = mischen(liste[i].modus, cb, q.c);
      cb = cb.map(function (v, k) {
        return Math.min(1, Math.max(0, (1 - q.a) * v + q.a * b[k]));
      });
    }
    return cb;
  }

  /** Was eine Person mit dieser Sehschwäche ungefähr sieht (für Tests). */
  function simulieren(art, c) {
    const s = SIMULATION[art];
    if (!s) return c.slice();
    return s.map(function (z) {
      return Math.min(1, Math.max(0, z[0] * c[0] + z[1] * c[1] + z[2] * c[2]));
    });
  }

  /** Eine Hex-Farbe durch den Filter — für die „Nachher"-Werte. */
  function farbeFiltern(hex, k) {
    if (!aktiv(k)) return hex;
    return alsHex(anwenden(matrix(k.art, k.staerke, k.farbton), ausHex(hex)));
  }

  /** Farbton als CSS-Farbe, für den Regler. */
  function tonHex(grad) {
    return alsHex(tonFarbe(grad));
  }

  return {
    LUM: LUM,
    SIMULATION: SIMULATION,
    VERSCHIEBUNG: VERSCHIEBUNG,
    NAEHERUNG: NAEHERUNG,
    WARM: WARM,
    FILTER: FILTER,
    ARTEN: ARTEN,
    EINLEITUNG: EINLEITUNG,
    APP_HINWEIS: APP_HINWEIS,
    VERGLEICH_TEXT: VERGLEICH_TEXT,
    SCHLUESSEL: SCHLUESSEL,
    STANDARD: STANDARD,
    ZURUECKSETZEN: ZURUECKSETZEN,
    VORSCHAU: VORSCHAU,
    lesen: lesen,
    aktiv: aktiv,
    filterVon: filterVon,
    statusText: statusText,
    vollerFilter: vollerFilter,
    matrix: matrix,
    svgWerte: svgWerte,
    webFilter: webFilter,
    anwenden: anwenden,
    schichten: schichten,
    schichtenAnwenden: schichtenAnwenden,
    simulieren: simulieren,
    farbeFiltern: farbeFiltern,
    tonHex: tonHex,
    tonFarbe: tonFarbe,
    toenung: toenung,
    alsHex: alsHex,
  };
});
