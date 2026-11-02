#!/usr/bin/env node
/**
 * gemeinsam/einwilligung.js ohne Supabase (Kasten RS 7 / RS 5).
 * Ein nachgebauter Client antwortet wie Schema 106 — oder wie eine Datenbank
 * ohne Schema 106. Start: node test/_einwilligung_einheit.js
 */
const E = require('../../gemeinsam/einwilligung');

let fehler = 0;
let anzahl = 0;
const pruefe = (name, wahr, zusatz = '') => {
  anzahl++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const client = (antworten) => {
  const aufrufe = [];
  return {
    aufrufe,
    rpc: async (name, args) => {
      aufrufe.push([name, args]);
      const a = antworten[name];
      return typeof a === 'function' ? a(args) : a || { data: null, error: { code: 'PGRST202', message: `Could not find the function public.${name}` } };
    },
  };
};

(async () => {
  console.log('\n1. Offen');
  const liste = [
    { dokument: 'nutzungsbedingungen', version: 2, art: 'zustimmung', bisher: 1 },
    { dokument: 'datenschutz', version: 1, art: 'kenntnis', bisher: null },
  ];
  let r = await E.offen(client({ zustimmung_offen: { data: liste, error: null } }));
  pruefe('liefert die Liste', r.ok && r.liste.length === 2);
  r = await E.offen(client({}));
  pruefe('ohne Schema 106: nichts offen, keine Sperre', r.ok && r.liste.length === 0 && r.fehlt === true);
  r = await E.offen(client({ zustimmung_offen: { data: null, error: { code: '42883', message: 'function public.konto_stand(uuid) does not exist' } } }));
  pruefe('fehlt eine andere Funktion: Fehler, nicht „Schema fehlt“', !r.ok && !r.fehlt, JSON.stringify(r));
  r = await E.offen(client({ zustimmung_offen: { data: null, error: { message: 'Failed to fetch' } } }));
  pruefe('Netzfehler: ehrlich', !r.ok && r.text === E.GRUENDE.netz);
  r = await E.offen(null);
  pruefe('ohne Client: nichts offen', r.ok && r.liste.length === 0);

  console.log('\n2. Blatt');
  const z = E.zeilen(liste);
  pruefe('Titel aus den Rechtstexten', z[0].titel === 'Nutzungsbedingungen' && z[1].titel === 'Datenschutzerklärung', z.map((x) => x.titel).join(' / '));
  pruefe('Datenschutz nur zur Kenntnis', z[1].kenntnis === true && z[0].kenntnis === false);
  pruefe('geänderte Fassung als neu markiert', z[0].neu === true && z[1].neu === false);
  pruefe('Text „geändert“ bei neuer Fassung', /geändert/.test(E.blattText(liste)));
  pruefe('Text „bitte stimme zu“ beim ersten Mal', /Bitte stimme/.test(E.blattText([liste[1]])));
  pruefe('Ausweg „Konto löschen“ wird genannt', /Konto löschen/.test(E.blattText(liste)) && /Konto löschen/.test(E.blattText([])));

  console.log('\n3. Zustimmen');
  // Die App kennt Fassung 1; der Server nennt für die Nutzungsbedingungen
  // Fassung 2 (Codex-Fund F6): Zustimmen darf nichts schicken.
  const R = require('../../gemeinsam/rechtstexte');
  const aktuell = liste.map((x) => ({ ...x, version: R.fassung(x.dokument).version }));
  let c = client({ zustimmen: { data: { ok: true }, error: null } });
  r = await E.zustimmen(c, liste);
  pruefe('F6: Server nennt neuere Fassung als der Text der App → „bitte aktualisieren“, kein Aufruf',
    !r.ok && r.grund === 'veraltet' && c.aufrufe.length === 0 && /aktualisiere/.test(r.text), r.text);
  c = client({ zustimmen: { data: { ok: true }, error: null } });
  r = await E.zustimmen(c, aktuell);
  pruefe('jede Fassung einzeln, mit Version des gezeigten Texts', r.ok && c.aufrufe.length === 2 &&
    c.aufrufe[0][1].p_dokument === 'nutzungsbedingungen' && c.aufrufe[0][1].p_version === R.fassung('nutzungsbedingungen').version, JSON.stringify(c.aufrufe));
  pruefe('F6: mit Prüfsumme des gezeigten Texts', c.aufrufe.every(([, a]) => Object.keys(a).join() === 'p_dokument,p_version,p_pruefsumme' &&
    a.p_pruefsumme === R.PRUEFSUMMEN[a.p_dokument]));
  c = client({ zustimmen: { data: { ok: false, grund: 'veraltet', version: 1 }, error: null } });
  r = await E.zustimmen(c, aktuell);
  pruefe('F6: Server lehnt Prüfsumme ab → „bitte aktualisieren“', !r.ok && r.grund === 'veraltet' && c.aufrufe.length === 1, r.text);
  c = client({ zustimmen: { data: { ok: false, grund: 'fassung', version: 3 }, error: null } });
  r = await E.zustimmen(c, aktuell);
  pruefe('neue Fassung inzwischen: verständlicher Grund, bricht ab', !r.ok && r.grund === 'fassung' && c.aufrufe.length === 1, r.text);
  r = await E.zustimmen(client({}), aktuell);
  pruefe('ohne Schema 106: „noch nicht“, kein Erfolg', !r.ok && r.grund === 'noch_nicht');

  console.log('\n4. Familienbereich');
  const kind = { id: 'k1', name: 'Mia', stand: 'frei', grenze_am: '2030-03-01', widerrufbar: true };
  r = await E.kinder(client({ meine_kinder: { data: [kind], error: null } }));
  pruefe('Kinder werden geliefert', r.ok && r.liste.length === 1);
  r = await E.kinder(client({}));
  pruefe('ohne Schema 106: „noch nicht verfügbar“', !r.ok && r.fehlt && r.text === E.GRUENDE.noch_nicht);
  pruefe('Standtexte', E.standText(kind) === 'Freigegeben' && E.standText({ stand: 'wartet' }) === 'Wartet auf deine Zustimmung');
  const h = E.widerrufHinweis(kind);
  pruefe('Hinweis nennt Ruhen, Ende und dass nichts gelöscht wird', /ruht/.test(h) && /01\.03\.2030/.test(h) && /bleiben erhalten/.test(h), h);
  pruefe('Hinweis ohne Geburtsdatum ohne Datum', !/am \./.test(E.widerrufHinweis({ name: 'Ben' })));
  c = client({ elterneinwilligung_widerrufen: { data: { ok: true }, error: null } });
  r = await E.widerrufen(c, 'k1');
  pruefe('Widerruf mit Kind-Kennung', r.ok && c.aufrufe[0][1].p_kind === 'k1' && r.text === E.WIDERRUF_FERTIG);
  r = await E.widerrufen(client({ elterneinwilligung_widerrufen: { data: { ok: false, grund: 'ohne_eltern' }, error: null } }), 'k1');
  pruefe('über der Grenze: Grund auf Deutsch', !r.ok && r.text === E.GRUENDE.ohne_eltern);
  r = await E.widerrufen(client({}), 'k1');
  pruefe('ohne Schema 106: kein vorgetäuschter Erfolg', !r.ok && r.grund === 'noch_nicht');

  console.log('\n5. Gleich mit der Datenbank');
  const fs = require('fs');
  const sql = fs.readFileSync(require('path').join(__dirname, '..', '..', 'SUPABASE_SCHEMA_106_einwilligung_fassung.sql'), 'utf8');
  const gruende = [...sql.matchAll(/'grund',\s*'([a-z_]+)'/g)].map((m) => m[1]);
  pruefe('jeder Grund aus Schema 106 hat einen Text', gruende.length > 0 && gruende.every((g) => E.GRUENDE[g]), [...new Set(gruende)].join(', '));
  const funktionen = ['zustimmung_offen', 'zustimmen', 'meine_kinder', 'elterneinwilligung_widerrufen'];
  pruefe('alle aufgerufenen Funktionen stehen im Schema', funktionen.every((f) => new RegExp(`function public\\.${f}\\(`).test(sql)));

  console.log(`\n${anzahl - fehler}/${anzahl} bestanden.`);
  process.exit(fehler ? 1 : 0);
})();
