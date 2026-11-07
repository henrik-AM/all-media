#!/usr/bin/env node
/**
 * Paket 4 (08.11.2026): Schema 95 und 96 als Dateien nach main, dazu der
 * Code für den frei wählbaren Entsperrcode (Henrik, 17.10.2026).
 *
 *   A  ohne Netz: Baustein gemeinsam/bildschirmzeit.js gegen die Regel aus
 *      Schema 96 (4–64 Zeichen, ≤ 72 Byte, keine Steuerzeichen), Schema-
 *      Dateien vorhanden, App und Website im Quelltext.
 *   B  Website mit Prüfattrappe (_attrappe.js): Einstellungen → Entsperrcode
 *      (verdeckt, Fehlertexte, Buchstaben/Sonderzeichen angenommen) und das
 *      Sperrblatt der Bildschirmzeit (Eingabe ohne Ziffernzwang, maxlength).
 *      Belegt nur Stufe 1–2 (Gegenstand, bedienbar) — gespeichert und
 *      wirksam erst mit Supabase (test:einstellungen, test:bildschirmzeit).
 *
 * Start:  BASE=http://localhost:3200 node test/p4-entsperrcode.js
 *         BILDER=<ordner>   legt Bilder ab
 *         OHNE_BROWSER=1    nur Teil A
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://localhost:3200';
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK    ' : '  FEHL  ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log('\nA  Schema 95/96, Baustein, Quelltext');
  const s95 = lies('SUPABASE_SCHEMA_95_sicherheit.sql');
  const s96 = lies('SUPABASE_SCHEMA_96_entsperrcode_frei.sql');
  const reihenfolge = lies('SUPABASE_REIHENFOLGE.md');
  pruefe('Schema 95 liegt in main (740 Zeilen wie 53a1bab)', s95.split('\n').length - 1 === 740, String(s95.split('\n').length - 1));
  pruefe('Schema 96 liegt in main (158 Zeilen wie 622f00b)', s96.split('\n').length - 1 === 158, String(s96.split('\n').length - 1));
  pruefe('Reihenfolge: 95/96 als live und „nicht erneut einspielen“ vermerkt',
    /Schemas 95 und 96 als Dateien nachgezogen/.test(reihenfolge) && /\*\*Nicht erneut einspielen\*\*/.test(reihenfolge));
  pruefe('96: Datenbank prüft 4 Zeichen, 64 Zeichen, 72 Byte, Steuerzeichen',
    /char_length\(p_neu\) < 4/.test(s96) && /char_length\(p_neu\) > 64 or octet_length\(p_neu\) > 72/.test(s96) && /p_neu ~ '\[\[:cntrl:\]\]'/.test(s96));
  pruefe('96: Tagesbremse beim Entsperren', /interval '24 hours'|interval '1 day'/.test(s96), 'keine 24-h-Grenze gefunden');

  const B = require(path.join(WURZEL, 'gemeinsam', 'bildschirmzeit.js'));
  const f = B.entsperrcodePruefen;
  pruefe('Baustein lädt, Grenzen 4/64/72', typeof f === 'function' && B.ENTSPERRCODE_MIN === 4 && B.ENTSPERRCODE_MAX === 64 && B.ENTSPERRCODE_MAX_BYTE === 72);
  pruefe('3 Zeichen abgelehnt, 4 angenommen', /mindestens 4 Zeichen/.test(f('abc') || '') && f('ab!9') === null);
  pruefe('Buchstaben, Sonderzeichen, Leerzeichen innen erlaubt', f('Pa ß!') === null && f('😀😀😀😀') === null);
  pruefe('Außen-Leerzeichen zählen nicht (wie btrim)', /mindestens/.test(f('  abc  ') || '') && f('  1234  ') === null);
  pruefe('64 Zeichen ja, 65 nein', f('a'.repeat(64)) === null && /höchstens 64/.test(f('a'.repeat(65)) || ''));
  pruefe('Byte-Grenze wie octet_length: 36 Umlaute ja, 37 nein', f('ä'.repeat(36)) === null && /zu lang/.test(f('ä'.repeat(37)) || ''));
  pruefe('Emoji zählt als ein Zeichen (wie char_length), 18 ja, 19 nein (Byte)', f('😀'.repeat(18)) === null && /zu lang/.test(f('😀'.repeat(19)) || ''));
  pruefe('Steuerzeichen abgelehnt', /unzulässig/.test(f('ab\ncd') || '') && /unzulässig/.test(f('ab\u0007cd') || ''));
  pruefe('UMD: bildschirmzeit in UMD_BAUSTEINE', /\['bildschirmzeit', 'Bildschirmzeit'\]/.test(lies('app/test/_modulquelle.js')));

  const sperre = lies('app/components/BildschirmzeitSperre.tsx');
  const settings = lies('app/screens/profile/SettingsScreen.tsx');
  const formular = lies('app/components/FormularSheet.tsx');
  pruefe('App: Sperre prüft mit dem Baustein, kein Ziffernzwang mehr',
    /Bildschirmzeit\.entsperrcodePruefen\(code\)/.test(sperre) && !/\\d\{4,8\}/.test(sperre) && /slice\(0, Bildschirmzeit\.ENTSPERRCODE_MAX\)/.test(sperre));
  pruefe('App: Einstellungen nutzen Regel und verdeckte Felder',
    /Bildschirmzeit\.entsperrcodePruefen\(w\.code\)/.test(settings) && (settings.match(/typ: 'geheim'/g) || []).length === 3);
  pruefe('App: FormularSheet kennt typ „geheim“ (secureTextEntry)', /secureTextEntry=\{f\.typ === 'geheim'\}/.test(formular));
  const web = lies('web/public/app.js');
  pruefe('Website: Sperre und Einstellungen prüfen mit dem Baustein',
    /BZ\.entsperrcodePruefen\(code\)/.test(web) && /BZ\.entsperrcodePruefen\(w\.code\)/.test(web) && !/\^\\d\{4,8\}\$/.test(web));
  pruefe('Website: kein „4 bis 8 Ziffern“ mehr', !/4 bis 8 Ziffern/.test(web) && !/4 bis 8 Ziffern/.test(settings));
}

/* ------------------------------------------------ B Website mit Attrappe */
async function teilB() {
  console.log(`\nB  Website mit Attrappe (${BASE})`);
  const { chromium } = require('playwright-core');
  const { attrappe, bestand } = require('./_attrappe');
  const daten = bestand({});
  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
    seite.setDefaultTimeout(10000);
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    const aufrufe = await attrappe(seite, daten, {
      '/api/entsperrcode': { ok: true },
      '/api/bildschirmzeit/entsperren': { ok: true },
    });

    await seite.goto(BASE, { waitUntil: 'load' });
    await seite.waitForSelector('[data-area="settings"]', { timeout: 15000 });
    await seite.click('[data-area="settings"]');
    await seite.waitForTimeout(600);
    await seite.click('[data-setting="Sicherheits-/Entsperrcode"]');
    await seite.waitForSelector('#f_code');
    await seite.selectOption('#f_art', 'Eigener Code');
    const typen = await seite.$$eval('#f_code, #f_wdh, #f_bisher', (els) => els.map((e) => e.type));
    pruefe('Einstellungen: drei Felder verdeckt (password)', typen.length === 3 && typen.every((t) => t === 'password'), typen.join(','));
    const label = await seite.evaluate(() => document.querySelector('#f_code')?.closest('.sheet__field')?.textContent || '');
    pruefe('Einstellungen: Beschriftung nennt die neue Regel', /Mindestens 4 Zeichen/.test(label), label.trim().slice(0, 120));

    const blattFehler = () => seite.evaluate(() => {
      const f = document.querySelector('#formFehler');
      if (f && !f.hidden && f.textContent.trim()) return f.textContent;
      const t = document.querySelector('#toast');
      return t && !t.hidden ? t.textContent : '';
    });
    await seite.fill('#f_code', 'ab!');
    await seite.fill('#f_wdh', 'ab!');
    await seite.click('#formOk');
    await seite.waitForTimeout(400);
    pruefe('Einstellungen: 3 Zeichen → „mindestens 4 Zeichen“ im Blatt', /mindestens 4 Zeichen/.test(await blattFehler()), await blattFehler());
    await seite.fill('#f_code', 'ä'.repeat(40));
    await seite.fill('#f_wdh', 'ä'.repeat(40));
    await seite.click('#formOk');
    await seite.waitForTimeout(400);
    pruefe('Einstellungen: 40 Umlaute → „zu lang“ schon vor Supabase', /zu lang/.test(await blattFehler()), await blattFehler());
    const vorher = aufrufe.filter((a) => a.pfad === '/api/entsperrcode').length;
    pruefe('Einstellungen: abgelehnte Eingaben schicken nichts', vorher === 0, String(vorher));
    await seite.fill('#f_code', 'Pa ß!9');
    await seite.fill('#f_wdh', 'Pa ß!9');
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, 'p4-einstellungen-code.png') });
    await seite.click('#formOk');
    await seite.waitForTimeout(800);
    const gesendet = aufrufe.filter((a) => a.pfad === '/api/entsperrcode');
    const body = gesendet.length ? JSON.parse(gesendet[0].body || '{}') : {};
    pruefe('Einstellungen: Code mit Buchstaben/Leerzeichen/Sonderzeichen geht unverändert raus', body.neu === 'Pa ß!9', JSON.stringify(body));

    // Sperrblatt der Bildschirmzeit: direkt aus app.js aufbauen (die Attrappe
    // kennt keine abgelaufene Zeit), mit eigenem Code als Code-Art.
    await seite.evaluate(() => {
      document.querySelectorAll('[data-sheet-close]').forEach((b) => b.click());
      bz.stand = { ...(bz.stand || {}), code_art: 'eigen' };
      const div = document.createElement('div');
      div.id = 'p4sperre';
      div.style.cssText = 'position:fixed;inset:0;z-index:99999;background:var(--bg,#fff);overflow:auto';
      div.innerHTML = bzSperreHtml('videos', { grund: 'limit', ziel: 'videos', mehrMoeglich: false }, true);
      document.body.appendChild(div);
      bzSperreBinden(div, 'videos', { grund: 'limit', ziel: 'videos' }, () => {});
    });
    await seite.click('#p4sperre [data-bz-code-auf]');
    const feld = await seite.$eval('#bzCode', (e) => ({ typ: e.type, max: e.maxLength, modus: e.getAttribute('inputmode') }));
    pruefe('Sperre: Feld verdeckt, maxlength 64, kein Ziffernblock', feld.typ === 'password' && feld.max === 64 && !feld.modus, JSON.stringify(feld));
    await seite.fill('#bzCode', 'abc');
    await seite.click('#p4sperre [data-bz-freigeben]');
    await seite.waitForTimeout(400);
    const meldung = await seite.$eval('#p4sperre [data-bz-meldung]', (e) => e.textContent).catch(() => '');
    pruefe('Sperre: 3 Zeichen → Meldung „mindestens 4 Zeichen“', /mindestens 4 Zeichen/.test(meldung), meldung);
    await seite.fill('#bzCode', '  Pa ß!9  ');
    if (process.env.BILDER) await seite.screenshot({ path: path.join(process.env.BILDER, 'p4-sperre-code.png') });
    await seite.click('#p4sperre [data-bz-freigeben]');
    await seite.waitForTimeout(800);
    const ent = aufrufe.filter((a) => a.pfad === '/api/bildschirmzeit/entsperren');
    const eb = ent.length ? JSON.parse(ent[0].body || '{}') : {};
    pruefe('Sperre: Code außen getrimmt, innen unverändert, an /api/bildschirmzeit/entsperren', eb.code === 'Pa ß!9' && eb.ziel === 'videos', JSON.stringify(eb));
    pruefe('Keine Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_BROWSER) {
    try {
      await teilB();
    } catch (e) {
      fehler++;
      console.log('  FEHL  Teil B abgebrochen  — ' + (e.message || e).toString().split('\n')[0]);
    }
  }
  console.log(`\n${geprueft - fehler}/${geprueft} OK`);
  process.exit(fehler ? 1 : 0);
})();
