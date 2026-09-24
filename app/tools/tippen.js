// Tippt im Pruefgeraet auf ein Element - ueber seine Beschriftung, nie blind.
//
// Henrik am 24.09.2026: "Im Simulator ist ja die App vorhanden, die dann
// spaeter auch gelauncht wird." Tippen ging bis dahin nicht: AppleScript
// braucht die Bedienungshilfen-Freigabe (-1719). AXe (brew, cameroncooke/axe)
// spricht direkt mit dem Simulator und braucht keine Freigabe.
//
// Warum nicht einfach Koordinaten: Am selben Tag hat ein blinder Tipp auf
// eine geschaetzte Stelle ein Video von @test an Henriks echtes Konto
// geteilt. Deshalb:
//  - nur das Pruefgeraet "All-Media Test", nie Henriks Simulator
//  - das Ziel wird in der Oberflaeche gesucht (Teiltext der Beschriftung,
//    Symbolzeichen davor wie ", Videos" stoeren nicht)
//  - genau ein Treffer, sonst wird nicht getippt und die Treffer gelistet
//  - Senden, Teilen, Loeschen, Folgen, Anrufen nur mit --bewusst
//
// Start:
//   npm run mac:tippen -- "Videos"            tippt auf die Mitte des Treffers
//   npm run mac:tippen -- "Videos" --nr 2     zweiter von mehreren Treffern
//   npm run mac:tippen -- --liste [Teiltext]  zeigt, was antippbar ist
//   npm run mac:tippen -- --runter            wischt eine halbe Seite nach unten
//   npm run mac:tippen -- --hoch              ... und zurueck

const { execFileSync } = require('child_process');
const { pruefgeraet } = require('./pruefgeraet');

const HEIKEL = /senden|teilen|l(ö|oe)schen|folgen|anruf|melden|blockieren|bezahl|spende/i;

function baum(udid) {
  const roh = execFileSync('axe', ['describe-ui', '--udid', udid], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const flach = [];
  const laufen = (knoten) => {
    for (const k of knoten) {
      const text = [k.AXLabel, k.title, k.AXValue].filter(Boolean).join(' | ');
      // Auch Knoten ohne Beschriftung: sie sind kein Ziel, koennen aber eines
      // verdecken (die untere Leiste hat unter ihren Knoepfen einen leeren Rand).
      if (k.frame && k.frame.width > 0 && k.frame.height > 0) flach.push({ text, typ: k.type, f: k.frame });
      if (k.children) laufen(k.children);
    }
  };
  laufen(JSON.parse(roh));
  return flach;
}

function zeile(e, i) {
  const { x, y, width: b, height: h } = e.f;
  return `  ${String(i + 1).padStart(2)}. [${e.typ}] ${JSON.stringify(e.text)}  (${Math.round(x)},${Math.round(y)} ${Math.round(b)}x${Math.round(h)})`;
}

function main() {
  const args = process.argv.slice(2);
  const liste = args.includes('--liste');
  const bewusst = args.includes('--bewusst');
  const nrPos = args.indexOf('--nr');
  const nr = nrPos >= 0 ? Number(args[nrPos + 1]) : null;
  const suche = args.find((a, i) => !a.startsWith('--') && (nrPos < 0 || i !== nrPos + 1));

  const udid = pruefgeraet();

  // Wischen ist harmlos - es loest keinen Knopf aus - und braucht deshalb
  // kein Ziel. Mitte des Bildschirms, eine halbe Seite weit.
  if (args.includes('--runter') || args.includes('--hoch')) {
    const [von, bis] = args.includes('--runter') ? [620, 260] : [260, 620];
    execFileSync('axe', ['swipe', '--start-x', '200', '--start-y', String(von), '--end-x', '200', '--end-y', String(bis), '--duration', '0.4', '--udid', udid], { stdio: 'ignore' });
    console.log(args.includes('--runter') ? 'Nach unten gewischt.' : 'Nach oben gewischt.');
    return;
  }

  const alle = baum(udid);
  // Der Anwendungsknoten beschriftet den ganzen Bildschirm - nie ein Ziel.
  // Er gibt aber die Bildschirmgroesse vor: nur was mit der Mitte darauf
  // liegt, ist antippbar (Listen melden auch Zeilen weit unterhalb).
  const app = alle.find((e) => e.typ === 'Application')?.f ?? { x: 0, y: 0, width: 1e4, height: 1e4 };
  const sichtbar = (f) => {
    const mx = f.x + f.width / 2, my = f.y + f.height / 2;
    return mx >= app.x && mx <= app.x + app.width && my >= app.y && my <= app.y + app.height;
  };
  // Verschachtelte Knoten melden dieselbe Beschriftung am selben Ort doppelt.
  const gesehen = new Set();
  const kandidaten = alle.filter((e) => {
    const schluessel = `${e.text}@${Math.round(e.f.x)},${Math.round(e.f.y)},${Math.round(e.f.width)},${Math.round(e.f.height)}`;
    if (!e.text || e.typ === 'Application' || !sichtbar(e.f) || gesehen.has(schluessel)) return false;
    gesehen.add(schluessel);
    return true;
  });
  const treffer = suche ? kandidaten.filter((e) => e.text.toLowerCase().includes(suche.toLowerCase())) : kandidaten;

  if (liste || !suche) {
    console.log(treffer.map(zeile).join('\n') || '  (nichts gefunden)');
    return;
  }
  if (treffer.length === 0) {
    console.error(`Kein Element mit "${suche}". Nicht getippt.`);
    process.exit(1);
  }
  if (treffer.length > 1 && nr == null) {
    console.error(`${treffer.length} Elemente mit "${suche}" - nicht getippt. Mit --nr waehlen:\n${treffer.map(zeile).join('\n')}`);
    process.exit(1);
  }
  const ziel = treffer[(nr ?? 1) - 1];
  if (!ziel) {
    console.error(`Treffer ${nr} gibt es nicht (${treffer.length} Treffer). Nicht getippt.`);
    process.exit(1);
  }
  if (HEIKEL.test(ziel.text) && !bewusst) {
    console.error(`"${ziel.text}" kann an andere Konten gehen. Nur mit --bewusst. Nicht getippt.`);
    process.exit(1);
  }
  const x = Math.round(ziel.f.x + ziel.f.width / 2);
  const y = Math.round(ziel.f.y + ziel.f.height / 2);

  // Liegt etwas darueber? Eine Liste meldet auch Zeilen, die unter der
  // unteren Leiste verschwinden - dann traefe der Tipp die Leiste (24.09.2026:
  // "Beitraege →" bei y=865, die Leiste beginnt bei 778). Was im Baum spaeter
  // kommt, die Mitte bedeckt und nicht im Ziel selbst liegt, liegt darueber.
  // Bildlaufleisten zaehlen nicht, sie fangen keine Tipps. Ebenso Ebenen ueber
  // den ganzen Bildschirm (z. B. die Huelle des schwebenden Zahnrads): sie
  // reichen Tipps durch, sonst waere nichts darunter bedienbar.
  const ganz = (g) => g.width >= app.width && g.height >= app.height;
  const f = ziel.f;
  const innen = (g) => g.x >= f.x && g.y >= f.y && g.x + g.width <= f.x + f.width && g.y + g.height <= f.y + f.height;
  const drueber = alle
    .slice(alle.indexOf(ziel) + 1)
    .find((e) => e.typ !== 'Slider' && !ganz(e.f) && !innen(e.f) && x >= e.f.x && x <= e.f.x + e.f.width && y >= e.f.y && y <= e.f.y + e.f.height);
  if (drueber) {
    console.error(`"${ziel.text}" ist verdeckt von "${drueber.text}" [${drueber.typ} ${JSON.stringify(drueber.f)}]. Erst wischen (--runter / --hoch). Nicht getippt.`);
    process.exit(1);
  }
  // Kein `axe tap`: dessen Tipp dauert 0 ms, und im Kurzformat kam so kein
  // einziger an (auch nicht in der Leiste oben). Ein Finger liegt etwa eine
  // Zehntelsekunde auf - mit dieser Haltezeit reagiert jeder Knopf.
  execFileSync('axe', ['touch', '-x', String(x), '-y', String(y), '--down', '--up', '--delay', '0.12', '--udid', udid], { stdio: 'ignore' });
  console.log(`Getippt: ${zeile(ziel, (nr ?? 1) - 1).trim()}`);
}

main();
