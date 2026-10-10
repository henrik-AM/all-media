#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kasten 1.3 — Nachtrag 10.10.2026, Agent „Profilseite“.
 *
 * Henrik: „deutlich mehr Freiraum“ beim Profil bearbeiten, nach Instagram.
 * Die eigene Seite „Profil bearbeiten“ (App: ProfilBearbeitenScreen,
 * Website: renderProfilSeite) mit
 *
 *   1.3a  großem Bild und „Bild bearbeiten“
 *   1.3b  Zeilen; je Feld eine Unterseite mit Abbrechen/Fertig
 *   1.3c  Name
 *   1.3d  Benutzername (handle_frei live, handle_aendern; „vergeben“ → Fehler auf der Seite)
 *   1.3e  Pronomen (≤ 30), klein neben dem Namen
 *   1.3f  Biografie mit Zähler (≤ 150)
 *   1.3g  bis zu 5 Links; im Profil der erste, „und N weitere“ → Liste
 *   1.3h  in allen drei Profilköpfen gleich
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Server: gemeinsam/profilfelder.js rechnet richtig (Link-Regel,
 *      Grenzen, „und N weitere“), App und Website hängen an denselben Texten,
 *      beide Einstiege führen auf die Seite, Schema 88 hat Spalten, Rechte,
 *      Trigger und Nachweis.
 *   B  Website (Playwright gegen Port 3000, Prüfkonto @prueflauf):
 *      Einstellungen → Konto → „Profil bearbeiten“ → Pronomen und zwei Links
 *      speichern → NEU LADEN → noch da, im Videos-Profil Pronomen neben dem
 *      Namen und „und 1 weiterer“ → Liste mit beiden Links.
 *      Benutzername eines anderen Kontos eintippen → „vergeben“, Fertig →
 *      Fehler steht auf der Seite, die Seite bleibt offen.
 *   C  Wirkung beim zweiten Konto: @test liest Pronomen und Links von
 *      @prueflauf über Supabase (Spaltenrechte aus Schema 88), und `link`
 *      ist der erste Link (Trigger). Danach wird der vorige Stand
 *      zurückgeschrieben und gegengeprüft.
 *
 * WAS ER NICHT ZEIGT: die App. Dafür im Simulator „All-Media Test“ (siehe
 * Bericht): Profil bearbeiten → Weitere Bearbeitungen unter Einstellungen →
 * „Pronomen bearbeiten“ → Fertig …
 *
 * VORAUSSETZUNG: SUPABASE_SCHEMA_88_profilseite.sql ist eingespielt. Ohne
 * Schema 88 schlagen B (Speichern) und C mit „Pronomen und mehrere Links gehen
 * erst, wenn das Datenbank-Update eingespielt ist“ fehl — das ist dann die
 * richtige Meldung, kein Codefehler.
 *
 * UNGETESTET geschrieben am 10.10.2026 (Supabase gesperrt, 402).
 *
 * Start:  node test/k28-profilseite.js   (npm run test:k28-profilseite)
 *         OHNE_BROWSER=1 überspringt B und C.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { nurTestkonto } = require('./_nur_testkonten');
const { vorbereiten, beenden, schliesse } = require('./_konto');
const PF = require('../../gemeinsam/profilfelder');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BASIS = process.env.BASIS || 'http://localhost:3000';

const PRONOMEN = 'sie/ihr';
const LINKS = [
  { url: 'https://all-media.app/pruef-a', titel: 'Prüfseite A' },
  { url: 'https://all-media.app/pruef-b', titel: '' },
];

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

/* ------------------------------------------------------- A ohne Server */
function teilA() {
  console.log('\nA  Baustein und Quelltext');
  pruefe('Adresse ohne Schema bekommt https://', PF.adresse('deine-seite.de').url === 'https://deine-seite.de');
  pruefe('javascript: wird abgelehnt', !!PF.adresse('javascript:alert(1)').fehler);
  pruefe('sechs Links werden abgelehnt', PF.linksPruefen(new Array(6).fill({ url: 'a.de' })).fehler === PF.TEXTE.linksVoll);
  pruefe('leere Zeile fällt still weg', PF.linksPruefen([{ url: '', titel: '' }, { url: 'a.de' }]).links.length === 1);
  pruefe('alter Einzellink wird zur Liste', PF.linksAus({ link: 'x.de' }).length === 1);
  pruefe('„und N weitere“', PF.weitereText(1) === '' && PF.weitereText(2) === 'und 1 weiterer' && PF.weitereText(5) === 'und 4 weitere');
  pruefe('Pronomen > 30 abgelehnt', !!PF.pronomenPruefen('x'.repeat(31)) && !PF.pronomenPruefen('x'.repeat(30)));
  pruefe('Biografie > 150 abgelehnt', !!PF.bioPruefen('x'.repeat(151)) && !PF.bioPruefen('x'.repeat(150)));

  const APP = lies('app/App.tsx');
  const SEITE = lies('app/screens/profile/ProfilBearbeitenScreen.tsx');
  const EINST = lies('app/screens/profile/SettingsScreen.tsx');
  const KOPF = lies('app/components/OwnProfileHead.tsx');
  const MSG = lies('app/screens/messenger/MessengerProfileScreen.tsx');
  const FREMD = lies('app/screens/profile/UserProfileScreen.tsx');
  const DATEN = lies('app/lib/daten.ts');
  const WEB = lies('web/public/app.js');
  const SERVER = lies('web/server/supabase-api.js');
  const SPALTEN = lies('gemeinsam/spalten.js');
  const SCHEMA = lies('SUPABASE_SCHEMA_88_profilseite.sql');

  pruefe('App: Hinweis und Konto-Eintrag öffnen die Seite',
    (APP.match(/setOverlay\(\{ kind: 'profilBearbeiten' \}\)/g) || []).length >= 2 && /aktion: 'profilseite'/.test(EINST));
  pruefe('Website: Hinweis und Konto-Eintrag öffnen die Seite',
    /#pbEinstellungen[\s\S]{0,200}openProfilSeite\(\)/.test(WEB) && /aktion === 'profilseite'\) return openProfilSeite\(\)/.test(WEB));
  pruefe('App: Seite nutzt die gemeinsamen Texte (kein eigener Wortlaut)', /Profilfelder\.TEXTE/.test(SEITE) && !/'Bild bearbeiten'/.test(SEITE));
  pruefe('Website: Seite nutzt die gemeinsamen Texte', /window\.Profilfelder/.test(WEB) && !/>Bild bearbeiten</.test(WEB));
  pruefe('App: Zeilen beschriftet für mac:tippen', /accessibilityLabel=\{`\$\{z\.label\} bearbeiten`\}/.test(SEITE) &&
    /accessibilityLabel=\{T\.fertig\}/.test(SEITE) && /accessibilityLabel=\{T\.bildBearbeiten\}/.test(SEITE));
  pruefe('App: Fehler stehen auf der Seite (testID profilseite-fehler)', /testID="profilseite-fehler"/.test(SEITE));
  pruefe('App: Benutzername über handle_frei live und handle_aendern', /useNamensStand/.test(SEITE) && /benutzernameAendern/.test(SEITE));
  pruefe('App: Pronomen und Links in allen Köpfen', /NameMitPronomen/.test(KOPF) && /ProfilLinks/.test(KOPF) &&
    /NameMitPronomen/.test(MSG) && /ProfilLinks/.test(MSG) && /NameMitPronomen/.test(FREMD) && /ProfilLinks/.test(FREMD));
  pruefe('Website: Pronomen und Links in allen Köpfen', (WEB.match(/nameMitPronomen\(/g) || []).length >= 5 &&
    (WEB.match(/profilLinksHtml\(/g) || []).length >= 5);
  pruefe('Neue Spalten NICHT in PROFIL_SPALTEN (sonst fällt das Laden ohne Schema 88 um)',
    !/pronomen|links/.test(SPALTEN.slice(SPALTEN.indexOf('const PROFIL_SPALTEN'), SPALTEN.indexOf('const BEITRAG_SPALTEN'))));
  pruefe('App und Server laden pronomen/links getrennt und nachsichtig',
    /select\('id, pronomen, links'\)/.test(DATEN) && /select\('id, pronomen, links'\)/.test(SERVER));
  pruefe('Schema 88: Spalten, Check, Trigger, Rechte, Nachweis',
    /add column if not exists pronomen/.test(SCHEMA) && /add column if not exists links/.test(SCHEMA) &&
    /profiles_links_gueltig/.test(SCHEMA) && /create trigger profil_links_abgleichen/.test(SCHEMA) &&
    /grant select \(pronomen, links\)/.test(SCHEMA) && /grant update \(pronomen, links\)/.test(SCHEMA) &&
    /revoke execute on function public\.profil_links_gueltig\(jsonb\) from public, anon/.test(SCHEMA));
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

  // Zweites Konto und eigene Kennung — für C und den „vergebenen“ Namen.
  let meineId = null;
  let anderer = null;
  let fremderHandle = null;
  let vorher = null;
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
      const zwei = await anderer.auth.signInWithPassword({ email: 'test@all-media.app', password: TESTKONTO_PASS });
      if (zwei.error) throw zwei.error;
      const { data: h } = await anderer.from('profiles').select('handle').eq('id', zwei.data.user.id).maybeSingle();
      fremderHandle = h?.handle || null;
      const { data: v } = await anderer.from('profiles').select('pronomen, links, link').eq('id', meineId).maybeSingle();
      vorher = v ? { pronomen: v.pronomen || '', links: v.links || [], link: v.link || '' } : null;
    }
  } catch (e) {
    pruefe('Zweites Konto (@test) meldet sich an und liest pronomen/links', false, e.message);
  }

  const zurSeite = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      // Der Weg über das Menü: Einstellungen, Abschnitt Konto.
      zuDenEinstellungen('konto'); // eslint-disable-line no-undef
    });
    await page.click('[data-setting="Profil bearbeiten"][data-abschnitt="konto"]');
    await page.waitForSelector('[data-testid="profilseite"]');
  };
  const feldOeffnen = async (feld) => {
    await page.click(`[data-psfeld="${feld}"]`);
    await page.waitForSelector(`[data-testid="profilseite-feld-${feld}"]`);
  };

  console.log('\nB  Website');
  await pruefeAsync('Einstellungen → Konto → „Profil bearbeiten“ öffnet die Seite mit Bild und fünf Zeilen', async () => {
    await zurSeite();
    const zeilen = await page.$$eval('[data-psfeld]', (n) => n.map((e) => e.dataset.psfeld).join(','));
    if (zeilen !== 'name,benutzername,pronomen,bio,links') throw new Error('Zeilen: ' + zeilen);
    if (!(await page.$('#psBild'))) throw new Error('kein „Bild bearbeiten“');
  });

  await pruefeAsync('Biografie: Zähler steht und zählt', async () => {
    await feldOeffnen('bio');
    await page.fill('#psEingabe', 'abc');
    const z = await page.$eval('#psZaehler', (e) => e.textContent.trim());
    if (z !== '3/150') throw new Error('Zähler: ' + z);
    await page.click('#psAbbrechen');
    await page.waitForSelector('[data-testid="profilseite"]');
  });

  await pruefeAsync('Pronomen speichern', async () => {
    await feldOeffnen('pronomen');
    await page.fill('#psEingabe', PRONOMEN);
    await page.click('#psFertig');
    await page.waitForSelector('[data-testid="profilseite"]');
    const w = await page.$eval('[data-psfeld="pronomen"] .profilseite__wert', (e) => e.textContent.trim());
    if (w !== PRONOMEN) throw new Error('Wert: ' + w);
  });

  await pruefeAsync('Zwei Links speichern (Adresse + Titel, zweiter ohne Titel)', async () => {
    await feldOeffnen('links');
    // Vorhandene Links erst löschen — der Lauf soll von einem bekannten Stand ausgehen.
    while (await page.$('[data-psloeschen]')) await page.click('[data-psloeschen="0"]');
    for (const [i, l] of LINKS.entries()) {
      await page.click('#psLinkNeu');
      await page.fill(`[data-psurl="${i}"]`, l.url);
      if (l.titel) await page.fill(`[data-pstitel="${i}"]`, l.titel);
    }
    await page.click('#psFertig');
    await page.waitForSelector('[data-testid="profilseite"]');
    const w = await page.$eval('[data-psfeld="links"] .profilseite__wert', (e) => e.textContent.trim());
    if (w !== '2 Links') throw new Error('Wert: ' + w);
  });

  await pruefeAsync('Ungültige Adresse → Fehler auf der Seite, Seite bleibt offen', async () => {
    await feldOeffnen('links');
    await page.click('#psLinkNeu');
    await page.fill('[data-psurl="2"]', 'javascript:alert(1)');
    await page.click('#psFertig');
    await page.waitForSelector('#psFehler:not([hidden])');
    if (!(await page.$('[data-testid="profilseite-feld-links"]'))) throw new Error('Unterseite zu');
    await page.click('#psAbbrechen');
  });

  await pruefeAsync('Neu laden: Pronomen und Links noch da, im Videos-Profil neben dem Namen und „und 1 weiterer“', async () => {
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-area]', { timeout: 20000 });
    await page.click('[data-area="videos"]');
    await page.click('[data-sub="profile"]');
    await page.waitForSelector('#profilBearbeiten', { timeout: 15000 });
    const p = await page.$eval('[data-testid="profil-pronomen"]', (e) => e.textContent.trim());
    if (p !== PRONOMEN) throw new Error('Pronomen: ' + p);
    const l = await page.$eval('[data-testid="profil-link"]', (e) => [e.textContent.trim(), e.getAttribute('href')]);
    if (l[0] !== LINKS[0].titel || l[1] !== LINKS[0].url) throw new Error('erster Link: ' + l.join(' '));
    const w = await page.$eval('[data-testid="profil-links-weitere"]', (e) => e.textContent.trim());
    if (w !== 'und 1 weiterer') throw new Error('weitere: ' + w);
    await page.click('[data-testid="profil-links-weitere"]');
    await page.waitForSelector('[data-testid="profil-links-liste"]');
    const anzahl = await page.$$eval('[data-testid="profil-links-liste"] a', (n) => n.length);
    if (anzahl !== 2) throw new Error('Liste hat ' + anzahl);
  });

  await pruefeAsync('Pronomen und Links auch im Messenger- und Communitys-Profil', async () => {
    for (const bereich of ['messenger', 'communities']) {
      await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));
      await page.click(`[data-area="${bereich}"]`);
      await page.click('[data-sub="profile"]');
      await page.waitForSelector('#profilBearbeiten', { timeout: 15000 });
      if (!(await page.$('[data-testid="profil-pronomen"]'))) throw new Error(bereich + ': kein Pronomen');
      if (!(await page.$('[data-testid="profil-links-weitere"]'))) throw new Error(bereich + ': kein „und 1 weiterer“');
    }
  });

  await pruefeAsync('Benutzername eines anderen Kontos → „vergeben“, Fertig → Fehler auf der Seite', async () => {
    if (!fremderHandle) throw new Error('kein fremder Benutzername bekannt');
    await zurSeite();
    await feldOeffnen('benutzername');
    await page.fill('#psEingabe', fremderHandle.replace(/^@/, ''));
    await page.waitForFunction(() => /vergeben/.test(document.querySelector('#psNamensstand')?.textContent || ''), null, { timeout: 5000 });
    await page.click('#psFertig');
    await page.waitForSelector('#psFehler:not([hidden])');
    const t = await page.$eval('#psFehler', (e) => e.textContent.trim());
    if (!/vergeben/.test(t)) throw new Error('Fehler: ' + t);
    if (!(await page.$('[data-testid="profilseite-feld-benutzername"]'))) throw new Error('Unterseite zu');
    await page.click('#psAbbrechen');
  });

  console.log('\nC  Zweites Konto');
  await pruefeAsync('@test liest Pronomen und beide Links von @prueflauf; link = erster Link', async () => {
    if (!anderer || !meineId) throw new Error('zweites Konto oder eigene Kennung fehlt');
    const { data, error } = await anderer.from('profiles').select('pronomen, links, link').eq('id', meineId).maybeSingle();
    if (error) throw error;
    if (data?.pronomen !== PRONOMEN) throw new Error('pronomen: ' + data?.pronomen);
    if (JSON.stringify(data?.links) !== JSON.stringify(LINKS)) throw new Error('links: ' + JSON.stringify(data?.links));
    if (data?.link !== LINKS[0].url) throw new Error('link: ' + data?.link);
  });

  // Zurück auf den vorigen Stand — und gegenprüfen.
  if (vorher) {
    // Hatte das Konto nur den alten Einzellink, wird genau der zurückgeschrieben.
    const koerper = vorher.links.length
      ? { pronomen: vorher.pronomen, links: vorher.links }
      : vorher.link
        ? { pronomen: vorher.pronomen, link: vorher.link } // Schema 88 baut daraus wieder den ersten Link
        : { pronomen: vorher.pronomen, links: [] };
    await page.evaluate((v) =>
      fetch('/api/eigene/profil', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(v) }).then((r) => r.json()), koerper);
    if (anderer && meineId) {
      const { data } = await anderer.from('profiles').select('pronomen, links, link').eq('id', meineId).maybeSingle();
      pruefe('Aufräumen: voriger Stand wiederhergestellt',
        (data?.pronomen || '') === vorher.pronomen && PF.ohneProtokoll(data?.link || '') === PF.ohneProtokoll(vorher.link),
        JSON.stringify(data));
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
