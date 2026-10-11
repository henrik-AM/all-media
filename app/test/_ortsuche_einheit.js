/**
 * Einheitstest Ortssuche und Standort-Nachricht (Kasten 28/6.5) — ohne
 * Datenbank, ohne Netz. Nominatim wird durch ein falsches fetch ersetzt.
 *
 * Geprüft wird gemeinsam/ortsuche.js, das App (StandortWahl, Blase im
 * ChatDetailScreen) und Website (openStandortWahl, anhangInhalt) benutzen:
 *   1. Ort → Text → Ort ist verlustfrei; die erste Zeile ist die Vorschau.
 *   2. Gewöhnlicher Text wird NICHT zur Karte (kein Fehlalarm).
 *   3. Nominatim-Zeilen werden zu { name, adresse, lat, lng }.
 *   4. Suche: Adresse richtig, Kennung nur auf Wunsch, kurze Eingabe fragt nicht.
 *   5. Drossel: höchstens eine Anfrage pro Sekunde.
 *   6. Benennen fällt nie aus und lässt die Nadel, wo sie war.
 *
 * Start:  node test/_ortsuche_einheit.js   (oder npm run test:ortsuche-einheit)
 */

const O = require('../../gemeinsam/ortsuche');

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

(async () => {
  console.log('1. Ort als Text und zurück');
  const ort = { name: 'Brandenburger Tor', adresse: 'Pariser Platz, 10117 Berlin', lat: 52.516275, lng: 13.377704 };
  const text = O.alsText(ort);
  pruefe('drei Zeilen', text.split('\n').length === 3, JSON.stringify(text));
  pruefe('erste Zeile ist die Vorschau', text.split('\n')[0] === 'Standort: Brandenburger Tor');
  const zurueck = O.ausText(text);
  pruefe('Name zurück', zurueck && zurueck.name === ort.name);
  pruefe('Adresse zurück', zurueck && zurueck.adresse === ort.adresse);
  pruefe('Breite/Länge zurück', zurueck && Math.abs(zurueck.lat - ort.lat) < 1e-6 && Math.abs(zurueck.lng - ort.lng) < 1e-6);
  pruefe('Koordinatentext', zurueck && zurueck.koordinaten === '52.51628, 13.37770', zurueck && zurueck.koordinaten);
  const ohneAdresse = O.ausText(O.alsText({ name: 'X', adresse: '', lat: -33.9, lng: 151.2 }));
  pruefe('ohne Adresse: zwei Zeilen, Süd/Ost', ohneAdresse && ohneAdresse.adresse === '' && ohneAdresse.lat === -33.9);
  pruefe('Zeilenumbruch im Namen bricht das Format nicht',
    O.ausText(O.alsText({ name: 'A\nB', adresse: 'C\nD', lat: 1, lng: 2 }))?.name === 'A B');
  pruefe('ungültige Koordinaten → kein Text', O.alsText({ name: 'X', lat: 99, lng: 0 }) === '');

  console.log('2. Kein Fehlalarm');
  pruefe('normaler Text', O.ausText('Hallo, wie geht es?') === null);
  pruefe('alter Ortstext „Standort: Zugspitze" (place_id-Weg)', O.ausText('Standort: Zugspitze') === null);
  pruefe('geo ohne Kopfzeile', O.ausText('Treffpunkt\ngeo:1,2') === null);
  pruefe('vier Zeilen', O.ausText('Standort: A\nB\nC\ngeo:1,2') === null);
  pruefe('Breite > 90', O.ausText('Standort: A\ngeo:95,2') === null);
  pruefe('leer/null', O.ausText('') === null && O.ausText(null) === null);

  console.log('3. Nominatim-Zeile');
  const t = O.treffer({
    lat: '48.137154', lon: '11.576124', name: 'Marienplatz',
    display_name: 'Marienplatz, Altstadt, München, Bayern, 80331, Deutschland',
    address: { road: 'Marienplatz', postcode: '80331', city: 'München' },
  });
  pruefe('Name', t && t.name === 'Marienplatz');
  pruefe('Adresse', t && t.adresse === 'Marienplatz, 80331 München', t && t.adresse);
  pruefe('Zahlen', t && t.lat === 48.137154 && t.lng === 11.576124);
  pruefe('ohne Name → Straße', O.treffer({ lat: '1', lon: '2', address: { road: 'Weg', house_number: '3' } })?.name === 'Weg 3');
  pruefe('kaputte Zeile → null', O.treffer({ lat: 'x', lon: '2' }) === null && O.treffer(null) === null);

  console.log('4. Suche');
  O.drosselZuruecksetzen();
  const aufrufe = [];
  const holen = async (url, init) => {
    aufrufe.push({ url, init, zeit: Date.now() });
    return { ok: true, json: async () => [{ lat: '52.5', lon: '13.4', name: 'Berlin', address: { city: 'Berlin' } }, { lat: 'kaputt' }] };
  };
  const liste = await O.suchen('Berlin Mitte', holen, { mitKennung: true });
  pruefe('ein Treffer, kaputter verworfen', liste.length === 1 && liste[0].name === 'Berlin');
  pruefe('Adresse geht an Nominatim /search', aufrufe[0].url.startsWith('https://nominatim.openstreetmap.org/search?'));
  pruefe('Suchtext kodiert', aufrufe[0].url.includes('q=Berlin%20Mitte'));
  pruefe('Kennung gesetzt (App)', aufrufe[0].init.headers['User-Agent'] === O.KENNUNG);
  await O.suchen('Ort', holen, {});
  pruefe('ohne mitKennung kein User-Agent (Browser)', !aufrufe[1].init.headers['User-Agent']);
  const vorher = aufrufe.length;
  const kurz = await O.suchen('a', holen);
  pruefe('ein Zeichen fragt nicht', kurz.length === 0 && aufrufe.length === vorher);
  let warf = false;
  try { await O.suchen('Ort', async () => ({ ok: false, json: async () => [] })); } catch { warf = true; }
  pruefe('Dienst antwortet nicht → Fehler statt leerer Liste', warf);

  console.log('5. Drossel');
  O.drosselZuruecksetzen();
  const w1 = O.drossel(1000);
  const w2 = O.drossel(1000);
  const w3 = O.drossel(1500);
  pruefe('erste sofort', w1 === 0);
  pruefe('zweite wartet ABSTAND_MS', w2 === O.ABSTAND_MS, String(w2));
  pruefe('dritte wartet bis nach der zweiten', w3 === 1000 + 2 * O.ABSTAND_MS - 1500, String(w3));
  pruefe('Abstand ≥ 1 s', O.ABSTAND_MS >= 1000);
  // Die echten Zeitstempel aus Teil 4: zwei Suchen hintereinander lagen ≥ 1 s auseinander.
  pruefe('echte Abfragen ≥ 1 s auseinander', aufrufe[1].zeit - aufrufe[0].zeit >= 1000, String(aufrufe[1].zeit - aufrufe[0].zeit));

  console.log('6. Benennen');
  O.drosselZuruecksetzen();
  const b1 = await O.benennen(52.1, 13.1, async () => ({ ok: true, json: async () => ({ lat: '52.2', lon: '13.2', name: 'Haus' }) }));
  pruefe('Name aus Nominatim, Nadel bleibt', b1 && b1.name === 'Haus' && b1.lat === 52.1 && b1.lng === 13.1);
  O.drosselZuruecksetzen();
  const b2 = await O.benennen(52.1, 13.1, async () => { throw new Error('offline'); });
  pruefe('offline → „Markierter Ort"', b2 && b2.name === 'Markierter Ort' && b2.lat === 52.1);
  pruefe('ungültig → null', (await O.benennen(200, 0, holen)) === null);
  pruefe('Quellenangabe nennt OpenStreetMap', /OpenStreetMap/.test(O.QUELLE));
  pruefe('Kartenlink OSM', O.kartenLink(1, 2).startsWith('https://www.openstreetmap.org/?mlat=1.000000&mlon=2.000000'));

  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
