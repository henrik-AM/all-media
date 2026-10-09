/**
 * Rechnet der Farbfilter richtig — und rechnen App und Website gleich?
 *
 * WARUM ES DAS GIBT
 *
 * Ein Farbfilter ist die Art Funktion, die immer irgendein Bild liefert. Ob
 * die Matrix für Deuteranopie wirklich Rot von Grün trennt oder nur alles
 * etwas grünlich macht, sieht man keinem Bildschirmfoto an. Geprüft wird
 * deshalb die WIRKUNG:
 *
 *   1. 0 % Intensität ist die Einheitsmatrix, 100 % der volle Filter,
 *      dazwischen linear.
 *   2. Graustufen machen jede Farbe grau; Weiß bleibt Weiß.
 *   3. Daltonisierung: Farbpaare, die eine Person mit der Sehschwäche
 *      verwechselt (simuliert nach Machado 2009), rücken auseinander.
 *   4. App = Website, wo die App exakt rechnen kann (Graustufen, Warmton,
 *      Farbtönung): die Mischmodus-Schichten ergeben dieselben Farben wie
 *      die Matrix.
 *   5. Die Näherung der App für die drei Sehschwächen trennt die
 *      Verwechslungspaare spürbar — mit Zahl, wie viel im Vergleich zur
 *      exakten Matrix der Website.
 *   6. Einstellungen lesen: kaputte Werte fallen auf den Auslieferungszustand.
 *
 * Reines Node, kein Netz, keine Datenbank.
 *
 * Start:  node test/_farbfilter_rechnung.js
 */

const F = require('../../gemeinsam/farbfilter');

let gut = 0;
let schlecht = 0;
function pruefe(name, ok, info) {
  if (ok) {
    gut++;
    console.log('  OK    ' + name + (info ? '  (' + info + ')' : ''));
  } else {
    schlecht++;
    console.log('  FEHL   ' + name + (info ? '  (' + info + ')' : ''));
  }
}

const nah = (a, b, eps) => Math.abs(a - b) <= eps;
const abstand = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

// Ein Raster durch den Farbwürfel, 6 Stufen je Kanal.
const RASTER = [];
for (let r = 0; r <= 5; r++) for (let g = 0; g <= 5; g++) for (let b = 0; b <= 5; b++) RASTER.push([r / 5, g / 5, b / 5]);

console.log('\n1. Intensität');
for (const art of F.ARTEN) {
  const null_ = F.matrix(art, 0, 200);
  const einheit = null_.every((z, r) => z.every((v, c) => v === (r === c ? 1 : 0)));
  pruefe(art + ': 0 % ist die Einheitsmatrix', einheit);
  const halb = F.matrix(art, 50, 200);
  const ganz = F.matrix(art, 100, 200);
  const linear = halb.every((z, r) => z.every((v, c) => nah(v, (null_[r][c] + ganz[r][c]) / 2, 0.0002)));
  pruefe(art + ': 50 % liegt genau zwischen 0 % und 100 %', linear);
  pruefe(art + ': 20 Werte für feColorMatrix', F.svgWerte(ganz).split(' ').length === 20);
}

console.log('\n2. Graustufen');
{
  const m = F.matrix('graustufen', 100);
  const grau = RASTER.every((c) => {
    const x = F.anwenden(m, c);
    return nah(x[0], x[1], 1e-9) && nah(x[1], x[2], 1e-9);
  });
  pruefe('jede Farbe wird grau', grau);
  const weiss = F.anwenden(m, [1, 1, 1]);
  pruefe('Weiß bleibt Weiß', weiss.every((v) => nah(v, 1, 1e-4)));
  pruefe('Rot wird dunkler als Grün (Helligkeitsgewichte)', F.anwenden(m, [1, 0, 0])[0] < F.anwenden(m, [0, 1, 0])[0]);
}

console.log('\n3. Daltonisierung (Website, exakt)');
const ergebnisse = {};
for (const art of ['protanopie', 'deuteranopie', 'tritanopie']) {
  // Paare, die im Original deutlich verschieden sind, für die simulierte
  // Sehschwäche aber fast gleich aussehen.
  const paare = [];
  for (const a of RASTER)
    for (const b of RASTER)
      if (abstand(a, b) > 0.3 && abstand(F.simulieren(art, a), F.simulieren(art, b)) < 0.12) paare.push([a, b]);

  const trennung = (f) =>
    paare.reduce((s, [a, b]) => s + abstand(F.simulieren(art, f(a)), F.simulieren(art, f(b))), 0) / paare.length;
  const abweichung = (f) => RASTER.reduce((s, c) => s + abstand(f(c), c) ** 2, 0) / RASTER.length;

  const m = F.matrix(art, 100);
  const ohne = trennung((c) => c);
  const exakt = trennung((c) => F.anwenden(m, c));
  const app = F.schichten(art, 100);
  const naeh = trennung((c) => F.schichtenAnwenden(app, c));
  ergebnisse[art] = { paare: paare.length, ohne, exakt, naeh, abwExakt: abweichung((c) => F.anwenden(m, c)), abwApp: abweichung((c) => F.schichtenAnwenden(app, c)) };

  pruefe(art + ': es gibt Verwechslungspaare', paare.length > 20, paare.length + ' Paare');
  pruefe(
    art + ': Matrix trennt sie mindestens doppelt so weit',
    exakt >= 2 * ohne,
    'ohne ' + ohne.toFixed(3) + ' → mit ' + exakt.toFixed(3)
  );
  pruefe(art + ': Weiß bleibt Weiß', F.anwenden(m, [1, 1, 1]).every((v) => nah(v, 1, 0.01)));
}

console.log('\n4. App = Website (exakte Filter)');
for (const [art, ton] of [['graustufen', 0], ['warmton', 0], ['farbton', 30], ['farbton', 200]]) {
  for (const staerke of [35, 100]) {
    const m = F.matrix(art, staerke, ton);
    const s = F.schichten(art, staerke, ton);
    let max = 0;
    // Farbtönung: der Mischmodus `color` begrenzt mit ClipColor (Farbton
    // bleibt), die Matrix kappt je Kanal. Bei sehr dunklen und sehr hellen
    // Farben weichen beide deshalb ab — geprüft wird der mittlere Bereich.
    const proben = art === 'farbton' ? RASTER.filter((c) => { const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; return l > 0.3 && l < 0.6; }) : RASTER;
    for (const c of proben) max = Math.max(max, abstand(F.anwenden(m, c), F.schichtenAnwenden(s, c)));
    // 2/255 Spielraum für die Rundung der Schichtfarben auf ganze 8-Bit-Werte.
    let gesamt = 0;
    for (const c of RASTER) gesamt = Math.max(gesamt, abstand(F.anwenden(m, c), F.schichtenAnwenden(s, c)));
    pruefe(
      art + (art === 'farbton' ? ' ' + ton + '°' : '') + ' ' + staerke + ' %: Schichten = Matrix',
      max <= 0.012,
      'größte Abweichung ' + max.toFixed(4) + (art === 'farbton' ? ', über den ganzen Würfel ' + gesamt.toFixed(3) : '')
    );
  }
}

console.log('\n5. Näherung der App für die Sehschwächen');
for (const art of ['protanopie', 'deuteranopie', 'tritanopie']) {
  const e = ergebnisse[art];
  const anteil = (e.naeh - e.ohne) / (e.exakt - e.ohne);
  console.log(
    '        ' + art + ': Trennung ohne ' + e.ohne.toFixed(3) + ', Website ' + e.exakt.toFixed(3) +
      ', App ' + e.naeh.toFixed(3) + ' (' + Math.round(anteil * 100) + ' % der Website-Wirkung);' +
      ' Abweichung vom Original Website ' + e.abwExakt.toFixed(3) + ', App ' + e.abwApp.toFixed(3)
  );
  pruefe(art + ': App trennt Verwechslungspaare besser als ohne Filter', e.naeh > e.ohne * 1.3);
  pruefe(art + ': App entstellt das Bild nicht stärker als 1,5 × die Website', e.abwApp <= e.abwExakt * 1.5 + 0.01);
}
pruefe('Protanopie: App erreicht mindestens 70 % der Website-Wirkung',
  (ergebnisse.protanopie.naeh - ergebnisse.protanopie.ohne) / (ergebnisse.protanopie.exakt - ergebnisse.protanopie.ohne) >= 0.7);
pruefe('Deuteranopie: App erreicht mindestens 40 % der Website-Wirkung',
  (ergebnisse.deuteranopie.naeh - ergebnisse.deuteranopie.ohne) / (ergebnisse.deuteranopie.exakt - ergebnisse.deuteranopie.ohne) >= 0.4);
pruefe('Die drei Sehschwäche-Filter sind als Näherung markiert (appExakt: false)',
  ['protanopie', 'deuteranopie', 'tritanopie'].every((a) => F.filterVon(a).appExakt === false));
pruefe('Schichten: höchstens drei Flächen je Filter',
  F.ARTEN.every((a) => F.schichten(a, 100, 30).length <= 3));
pruefe('Schichten: bei 0 % keine Fläche', F.ARTEN.every((a) => F.schichten(a, 0, 30).length === 0));

console.log('\n6. Einstellungen lesen');
{
  pruefe('leer → Auslieferungszustand', JSON.stringify(F.lesen({})) === JSON.stringify(F.STANDARD));
  const k = F.lesen({ farbfilter: 'an', farbfilterArt: 'deuteranopie', farbfilterStaerke: '80', farbfilterFarbton: '200' });
  pruefe('gültige Werte werden übernommen', k.an && k.art === 'deuteranopie' && k.staerke === 80 && k.farbton === 200);
  const kaputt = F.lesen({ farbfilter: 'ja', farbfilterArt: 'lila', farbfilterStaerke: '250', farbfilterFarbton: 'x' });
  pruefe('kaputte Werte fallen zurück / werden begrenzt', !kaputt.an && kaputt.art === 'graustufen' && kaputt.staerke === 100 && kaputt.farbton === 30);
  pruefe('aus → nicht aktiv', !F.aktiv(F.lesen({ farbfilter: 'aus' })));
  pruefe('an mit 0 % → nicht aktiv', !F.aktiv(F.lesen({ farbfilter: 'an', farbfilterStaerke: '0' })));
  pruefe('Statustext', F.statusText(k) === 'Grün/Rot-Filter · 80 %' && F.statusText(F.STANDARD) === 'Aus', F.statusText(k));
  pruefe('Zurücksetzen schreibt alle vier Schlüssel', F.ZURUECKSETZEN.length === 4 && F.lesen(Object.fromEntries(F.ZURUECKSETZEN)).an === false);
  pruefe('Schlüssel passen in user_settings (1–60 Zeichen)', Object.values(F.SCHLUESSEL).every((s) => s.length >= 1 && s.length <= 60));
  pruefe('jeder Filter hat Name und Wofür-Satz', F.FILTER.every((f) => f.name && f.kurz && f.kurz.length > 20));
}

console.log('\n' + gut + ' bestanden, ' + schlecht + ' fehlgeschlagen');
process.exit(schlecht ? 1 : 0);
