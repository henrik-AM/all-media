#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kästen 1 und 3 — Agent „Profil".
 *
 *   1.1  „Profil wechseln" im Communitys-Profil bleibt unter Communitys.
 *   1.2  „Profil bearbeiten" ändert das Profilbild; das Bild steht danach
 *        im Profil (auch nach Neuladen) und das zweite Konto sieht es.
 *   1.3  Hinweis „Weitere Bearbeitungen unter Einstellungen" im Blatt,
 *        führt in den Abschnitt Konto; der Pfeil führt ins Profil zurück.
 *   1.4  Derselbe Hinweis aus dem Video-Profil.
 *   1.5  Derselbe Hinweis aus dem Messenger-Profil.
 *   3.3  Die Seite hinter „Erstellt →"/„Beigetreten →" zeigt KEIN
 *        „Profil wechseln".
 *   3.4  Kachel „Erstellte Communitys" öffnet die eigene Seite.
 *   3.5  Kachel „Beigetretene Communitys" öffnet die eigene Seite.
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Quelltext beider Seiten (ohne Server): die App-Verdrahtung, die sich
 *      im Browser nicht prüfen lässt — Rueckkehr.merken('communities'),
 *      keine SwitchBar auf der Listen-Seite, onStat → setAnsicht, Hinweis
 *      im gemeinsamen Blatt mit Sprung 'konto'. Gleicher Text auf beiden
 *      Seiten.
 *   B  Website (Playwright gegen Port 3000, Prüfkonto @prueflauf):
 *      3.3–3.5 und 1.3–1.5 durch Klicks, 1.1 bis zur Kontoliste.
 *   C  Profilbild (1.2), Wirkung mit zwei Konten: @prueflauf lädt über
 *      /api/hochladen + /api/eigene/profilbild ein Bild hoch, die Seite zeigt
 *      es nach Neuladen im Communitys-Profil, @test liest dieselbe
 *      avatar_url über Supabase. Am Ende wird der vorige Wert
 *      zurückgeschrieben und gegengeprüft.
 *
 * WAS ER NICHT ZEIGT: die App. Dafür im Simulator „All-Media Test":
 *   Communitys → Profil → „Erstellte Communitys" (Kachel) → eigene Seite
 *   ohne „Profil wechseln"; „Zurück zum Profil"; „Profil wechseln" →
 *   Kontoliste → Konto wechseln → man steht im Communitys-Profil;
 *   „Profil bearbeiten" → „Weitere Bearbeitungen unter Einstellungen".
 *
 * UNGETESTET geschrieben am 10.10.2026 (Supabase gesperrt, 402).
 *
 * Start:  node test/k28-profil.js   (npm run test:k28-profil)
 *         OHNE_BROWSER=1 überspringt B und C.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { nurTestkonto } = require('./_nur_testkonten');
const { vorbereiten, beenden, schliesse } = require('./_konto');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BASIS = process.env.BASIS || 'http://localhost:3000';
const HINWEIS = 'Weitere Bearbeitungen unter Einstellungen';

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};
const pruefeAsync = async (name, fn) => {
  try {
    await fn();
    pruefe(name, true);
  } catch (e) {
    pruefe(name, false, e.message || String(e));
  }
};

/* ------------------------------------------------------------- A Quelltext */
function teilA() {
  const APP = lies('app/App.tsx');
  const COMM = lies('app/screens/communities/CommunityProfileScreen.tsx');
  const BILD = lies('app/components/ProfilbildWahl.tsx');
  const FORM = lies('app/components/FormularSheet.tsx');
  const KOPF = lies('app/components/OwnProfileHead.tsx');
  const WEB = lies('web/public/app.js');

  console.log('\nA  Quelltext');
  const commBlock = APP.slice(APP.indexOf('<CommunityProfileScreen'), APP.indexOf('/>', APP.indexOf('<CommunityProfileScreen')));
  pruefe('1.1 App: Communitys-Profil merkt communities/profile für den Kontowechsel',
    /Rueckkehr\.merken\(user\?\.id, 'communities', 'profile'\)/.test(commBlock) && /setSheet\('konto'\)/.test(commBlock));
  pruefe('1.1 App: keine Leiste im Communitys-Profil führt mehr in den Messenger',
    !/SwitchBar onPress=\{\(\) => onSwitchArea\('messenger'\)\}/.test(COMM));
  pruefe('1.2 App: Antippen des eigenen Bilds öffnet das Profilbild-Blatt',
    /onProfilbild=\{\(\) => setProfilbildWahl\(true\)\}/.test(commBlock) && /onAvatarPress=\{onProfilbild/.test(COMM));
  pruefe('1.2 App: „Profil bearbeiten" trägt den Profilbild-Kopf', /kopf: <ProfilbildKopf/.test(APP));

  const ansicht = COMM.slice(COMM.indexOf('if (ansicht)'), COMM.indexOf('{list(liste)}'));
  pruefe('3.3 App: Listen-Seite ohne SwitchBar', ansicht.length > 0 && !/<SwitchBar/.test(ansicht));
  pruefe('3.4/3.5 App: Kacheln öffnen die Listen-Seite',
    /onStat=\{\(label\) => setAnsicht\(label\.startsWith\('Erstellte'\) \? 'erstellt' : 'beigetreten'\)\}/.test(COMM));
  pruefe('3.4/3.5 App: Kacheln sind beschriftet (für mac:tippen)', /accessibilityLabel=\{`\$\{stat\.label\}/.test(KOPF));

  pruefe('1.3 App: Hinweis-Baustein mit Text und Beschriftung',
    BILD.includes(`>${HINWEIS}<`) && BILD.includes(`accessibilityLabel="${HINWEIS}"`));
  pruefe('1.3 App: FormularSheet zeichnet „unten" unter den Feldern', /\{unten\}/.test(FORM));
  const bearbeiten = APP.slice(APP.indexOf('const profilBearbeiten'), APP.indexOf('const eintragOeffnen'));
  // Nachtrag 10.10.2026: der Hinweis führt auf die Seite „Profil bearbeiten“
  // (dorthin auch Einstellungen → Konto), nicht mehr in den Abschnitt Konto.
  pruefe('1.3 App: Hinweis öffnet die Seite „Profil bearbeiten“',
    /setOverlay\(\{ kind: 'profilBearbeiten' \}\)/.test(bearbeiten) &&
    /unten: <WeitereEinstellungenHinweis/.test(bearbeiten));
  pruefe('1.4/1.5 App: alle drei Profile nutzen dasselbe Blatt',
    (APP.match(/onBearbeiten=\{profilBearbeiten\}/g) || []).length === 3);

  pruefe('1.3 Website: Hinweis im Blatt mit demselben Text', WEB.includes(`id="pbEinstellungen" type="button">${HINWEIS}<`));
  pruefe('1.3 Website: Hinweis öffnet die Seite „Profil bearbeiten“', /#pbEinstellungen[\s\S]{0,200}openProfilSeite\(\)/.test(WEB));
  pruefe('3.4/3.5 Website: Kacheln tragen data-commview',
    /data-stat="created" data-commview="erstellt"/.test(WEB) && /data-stat="joined" data-commview="beigetreten"/.test(WEB));
  const liste = WEB.slice(WEB.indexOf('function renderCommunityListe'), WEB.indexOf('bindJoinButtons(renderCommunityListe)'));
  pruefe('3.3 Website: Listen-Seite ohne switchBar', liste.length > 0 && !/switchBar\(/.test(liste));
}

/* ------------------------------------------------------------ B/C Website */
async function teilBC() {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(10000);
  const jsFehler = [];
  page.on('pageerror', (e) => jsFehler.push(e.message));

  if (!(await vorbereiten(page, BASIS))) await beenden(browser, 1);
  await page.waitForSelector('[data-area]', { timeout: 20000 });

  const aufraeumen = () =>
    page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
  const zumProfil = async (bereich) => {
    await aufraeumen();
    await page.click(`[data-area="${bereich}"]`);
    await page.click('[data-sub="profile"]');
    await page.waitForSelector('#profilBearbeiten', { timeout: 15000 });
  };
  const sichtbar = (sel) => page.$eval(sel, (e) => !!(e.offsetWidth || e.offsetHeight)).catch(() => false);

  console.log('\nB  Website');
  for (const [stat, titel] of [['created', 'Erstellte Communitys'], ['joined', 'Beigetretene Communitys']]) {
    await pruefeAsync(`3.4/3.5 Kachel „${titel}" öffnet die eigene Seite, ohne „Profil wechseln" (3.3)`, async () => {
      await zumProfil('communities');
      await page.click(`.prof__stat[data-stat="${stat}"]`);
      await page.waitForSelector('#commListeBack');
      const ueberschrift = await page.$eval('.pagehead__title', (e) => e.textContent.trim());
      if (ueberschrift !== titel) throw new Error('Überschrift: ' + ueberschrift);
      if (await page.$('.switchbar')) throw new Error('„Profil wechseln" steht auf der Listen-Seite');
      await page.click('#commListeBack');
      await page.waitForSelector('.switchbar');
    });
  }
  await pruefeAsync('3.3 Auch hinter der Überschrift mit Pfeil kein „Profil wechseln" (falls es Einträge gibt)', async () => {
    await zumProfil('communities');
    const kopf = await page.$('[data-commview]:not(.prof__stat)');
    if (!kopf) return; // ohne erstellte/beigetretene Community gibt es keine Überschrift
    await kopf.click();
    await page.waitForSelector('#commListeBack');
    if (await page.$('.switchbar')) throw new Error('„Profil wechseln" steht auf der Listen-Seite');
  });

  await pruefeAsync('1.1 „Profil wechseln" öffnet die Kontoliste und bleibt unter Communitys', async () => {
    await zumProfil('communities');
    await page.click('#switchProfile');
    await page.waitForSelector('[data-konto]');
    const bereich = await page.evaluate(() => document.querySelector('[data-area].is-active')?.dataset.area || null);
    if (bereich && bereich !== 'communities') throw new Error('Bereich gewechselt nach ' + bereich);
  });

  for (const bereich of ['communities', 'videos', 'messenger']) {
    await pruefeAsync(`1.3–1.5 Hinweis im Bearbeiten-Blatt (${bereich}) → Seite „Profil bearbeiten“ → Pfeil zurück ins Profil`, async () => {
      await zumProfil(bereich);
      await page.click('#profilBearbeiten');
      await page.waitForSelector('#pbEinstellungen');
      const text = await page.$eval('#pbEinstellungen', (e) => e.textContent.trim());
      if (text !== HINWEIS) throw new Error('Text: ' + text);
      await page.click('#pbEinstellungen');
      // Nachtrag 10.10.2026: Ziel ist die Seite „Profil bearbeiten“.
      await page.waitForSelector('[data-testid="profilseite"]');
      if (await page.$('#pbEinstellungen')) throw new Error('Blatt blieb offen');
      await page.click('#psZurueck');
      await page.waitForSelector('#profilBearbeiten');
      const jetzt = await page.evaluate(() => document.querySelector('[data-area].is-active')?.dataset.area || null);
      if (jetzt && jetzt !== bereich) throw new Error('Zurück landet in ' + jetzt);
    });
  }

  /* -------------------------------------------------- C Profilbild, 2 Konten */
  console.log('\nC  Profilbild mit zwei Konten');
  // Die eigene Kennung des Prüfkontos — die Seite führt sich selbst als 'me'.
  let meineId = null;
  let vorher = null;
  let anderer = null;
  try {
    if (URL && KEY) {
      const selbst = createClient(URL, KEY);
      const an = await selbst.auth.signInWithPassword({
        email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
        password: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
      });
      if (an.error) throw an.error;
      meineId = an.data.user.id;
      anderer = createClient(URL, KEY);
      const { error } = await anderer.auth.signInWithPassword({ email: 'test@all-media.app', password: TESTKONTO_PASS });
      if (error) throw error;
      if (meineId) {
        const { data } = await anderer.from('profiles').select('avatar_url').eq('id', meineId).maybeSingle();
        vorher = data?.avatar_url ?? null;
      }
    }
  } catch (e) {
    pruefe('Zweites Konto (@test) meldet sich an', false, e.message);
    anderer = null;
  }

  const bild = 'data:image/png;base64,' + fs.readFileSync(path.join(__dirname, '_testbild.png')).toString('base64');
  let neueUrl = null;
  await pruefeAsync('1.2 Bild hochladen und als Profilbild setzen (dieselben Wege wie das Blatt)', async () => {
    const hoch = await page.evaluate((aufnahme) =>
      fetch('/api/hochladen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ordner: 'avatars', aufnahme }) }).then((r) => r.json()), bild);
    if (!hoch.ok) throw new Error('hochladen: ' + (hoch.error || JSON.stringify(hoch)));
    const set = await page.evaluate((url) =>
      fetch('/api/eigene/profilbild', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).then((r) => r.json()), hoch.url);
    if (!set.ok) throw new Error('profilbild: ' + (set.error || JSON.stringify(set)));
    neueUrl = hoch.url;
  });
  await pruefeAsync('1.2 Nach Neuladen steht das Bild im Communitys-Profil', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-area]', { timeout: 20000 });
    await zumProfil('communities');
    if (!(await sichtbar('.oprof__top .avatar img'))) throw new Error('kein <img> im Profilbild');
  });
  await pruefeAsync('1.2 Das zweite Konto (@test) liest dieselbe avatar_url', async () => {
    if (!anderer || !meineId) throw new Error('zweites Konto oder eigene Kennung fehlt');
    const { data, error } = await anderer.from('profiles').select('avatar_url').eq('id', meineId).maybeSingle();
    if (error) throw error;
    if (!data?.avatar_url || data.avatar_url !== neueUrl) throw new Error(`gelesen: ${data?.avatar_url} erwartet: ${neueUrl}`);
  });

  // Zurück auf den vorigen Stand — und gegenprüfen.
  if (neueUrl) {
    await page.evaluate((url) =>
      fetch('/api/eigene/profilbild', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }).then((r) => r.json()), vorher);
    if (anderer && meineId) {
      const { data } = await anderer.from('profiles').select('avatar_url').eq('id', meineId).maybeSingle();
      pruefe('Aufräumen: voriges Profilbild wiederhergestellt', (data?.avatar_url ?? null) === vorher, `steht: ${data?.avatar_url}`);
    }
  }

  pruefe('Keine JS-Fehler im Browser', jsFehler.length === 0, jsFehler.slice(0, 3).join(' | '));
  await schliesse(browser);
}

(async () => {
  teilA();
  if (!process.env.OHNE_BROWSER) {
    try {
      await teilBC();
    } catch (e) {
      pruefe('Browserteil lief durch', false, e.message);
    }
  }
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden.`);
  process.exit(fehler ? 1 : 0);
})();
