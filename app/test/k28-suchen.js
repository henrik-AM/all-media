// Prueft Kasten 2 und 3.1/3.2 aus Henriks Rueckmeldung vom 28.09.2026
// (Communitys - Suchen):
//
//   2.1  Die fette Ueberschrift heisst "Communitys", nicht "Kanäle"
//   2.2  Wo eine Community gemeint ist, steht nicht "Kanal" (Erstellen-Blatt)
//   3.1  "Profile →" oeffnet eine EIGENE Seite: Zurueck-Pfeil, eigene
//        Suchleiste, nur Profile
//   3.2  "Communitys →" ebenso, nur Communitys
//
// Gepruefte Wirkung, nicht nur das Vorhandensein:
//   - auf der Unterseite gibt es keine Filter-Pillen und keine zweite Liste
//   - die Suche der Unterseite liefert DIESELBEN Treffer wie die Hauptsuche
//     mit demselben Begriff (dieselbe Quelle, dieselbe Regel)
//   - auch eine noch nicht beigetretene Community wird gefunden
//   - Zurueck fuehrt in die Hauptsuche, ein Bereichswechsel raeumt die
//     Unterseite ab
//   - die App-Seite ist im Quelltext gleich beschriftet (Simulator-Abnahme
//     macht der Hauptagent: "Alle Communitys anzeigen", "Zurück zur Suche")
//
// Start:  node test/k28-suchen.js   (Server muss laufen)
// Stand:  geschrieben am 10.10.2026 waehrend der Supabase-Sperre - UNGETESTET.

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });
  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
    await beenden(browser, 1);
  }
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#topbar button');

  const ergebnisse = [];
  const pruefe = async (name, fn) => {
    try {
      await fn();
      ergebnisse.push(true);
      console.log('  OK   ' + name);
    } catch (e) {
      ergebnisse.push(false);
      console.log('  FEHL ' + name + ' — ' + (e.message || 'kein Treffer'));
    }
  };

  const gehe = async (bereich, unter) => {
    await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));
    await page.click(`[data-area="${bereich}"]`);
    await page.waitForTimeout(300);
    if (unter) {
      await page.click(`[data-sub="${unter}"]`);
      await page.waitForTimeout(600);
    }
  };

  // Hauptsuche mit Begriff und Filter; liefert die Kennungen der Treffer.
  const hauptTreffer = async (begriff, filter) => {
    await gehe('communities', 'search');
    await page.click(`[data-csfilter="${filter}"]`);
    await page.fill('#commSearch', begriff);
    await page.waitForTimeout(300);
    const sel = filter === 'channels' ? '#main [data-community]' : '#main [data-befriend]';
    const attr = filter === 'channels' ? 'data-community' : 'data-befriend';
    const ids = await page.$$eval(sel, (n, a) => n.map((x) => x.getAttribute(a)), attr);
    // Zustand fuer die naechsten Schritte wieder leeren.
    await page.fill('#commSearch', '');
    await page.click('[data-csfilter="all"]');
    await page.waitForTimeout(200);
    return [...new Set(ids)].sort();
  };

  const oeffneUnterseite = async (art) => {
    await gehe('communities', 'search');
    await page.fill('#commSearch', '');
    await page.waitForTimeout(200);
    const kopf = await page.$(`[data-csmehr="${art}"]`);
    if (!kopf) throw new Error(`kein Kopf data-csmehr="${art}"`);
    await kopf.click();
    await page.waitForSelector(`[data-commsuchseite="${art}"]`, { timeout: 3000 }).catch(() => {
      throw new Error('der Pfeil öffnet keine eigene Seite');
    });
  };

  const unterseiteTreffer = async (art, begriff) => {
    await page.fill('#commSuchSeiteInput', begriff);
    await page.waitForTimeout(300);
    const sel = art === 'channels' ? '#main [data-community]' : '#main [data-befriend]';
    const attr = art === 'channels' ? 'data-community' : 'data-befriend';
    const ids = await page.$$eval(sel, (n, a) => n.map((x) => x.getAttribute(a)), attr);
    return [...new Set(ids)].sort();
  };

  // Bestand vom Server: Communitys (auch nicht beigetretene) und Nutzer.
  const bestand = await page.evaluate(async () => (await fetch('/api/bootstrap')).json());
  const communitys = bestand.communities || [];
  const nutzer = Object.values(bestand.users || {}).filter((u) => u.id !== 'me');
  // Ein Suchbegriff, der nicht alles trifft: drei Buchstaben aus dem Namen.
  const begriffAus = (name) => String(name || '').trim().slice(0, 3).toLowerCase();

  /* ------------------------------------------------ Kasten 2.1 */
  console.log('\nKasten 2.1 — Überschrift');

  await pruefe('Die fette Überschrift heißt „Communitys →", nirgends „Kanäle"', async () => {
    await gehe('communities', 'search');
    const koepfe = await page.$$eval('.exp__head', (n) => n.map((x) => x.textContent.trim()));
    if (koepfe.some((t) => /Kanäle|Kanal/.test(t))) throw new Error('alter Text: ' + koepfe.join(' | '));
    if (!koepfe.includes('Communitys →')) throw new Error('kein Kopf „Communitys →": ' + koepfe.join(' | '));
    const text = await page.$eval('#main', (m) => m.textContent);
    if (/Kanäle/.test(text)) throw new Error('„Kanäle" steht noch auf der Seite');
  });

  /* ------------------------------------------------ Kasten 3.2 */
  console.log('\nKasten 3.2 — Communitys-Seite');

  await pruefe('„Communitys →" öffnet eine eigene Seite mit Zurück und Suchleiste', async () => {
    await oeffneUnterseite('channels');
    if (!(await page.$('#commSuchSeiteBack'))) throw new Error('kein Zurück-Pfeil');
    if (!(await page.$('#commSuchSeiteInput'))) throw new Error('keine eigene Suchleiste');
    const titel = await page.$eval('.pagehead__title', (n) => n.textContent.trim());
    if (titel !== 'Communitys') throw new Error('Titel ist „' + titel + '"');
  });

  await pruefe('Die Communitys-Seite zeigt nur Communitys (keine Pillen, keine Profile)', async () => {
    if (await page.$('[data-csfilter]')) throw new Error('die Filter-Pillen stehen noch da');
    if (await page.$('#main [data-befriend]')) throw new Error('es stehen Profile darin');
    if (await page.$('.exp__head')) throw new Error('es steht noch eine Abschnitts-Überschrift da');
    const n = await page.$$eval('#main [data-community]', (x) => x.length);
    if (n !== communitys.length) throw new Error(`${n} Zeilen, der Server kennt ${communitys.length} Communitys`);
  });

  await pruefe('Suche der Communitys-Seite = Hauptsuche (gleiche Treffer)', async () => {
    if (!communitys.length) throw new Error('kein Bestand — Testbestand fehlt');
    const begriff = begriffAus(communitys[communitys.length - 1].name);
    await oeffneUnterseite('channels');
    const unten = await unterseiteTreffer('channels', begriff);
    const oben = await hauptTreffer(begriff, 'channels');
    if (!unten.length) throw new Error(`„${begriff}" findet auf der Unterseite nichts`);
    if (JSON.stringify(unten) !== JSON.stringify(oben)) {
      throw new Error(`Unterseite ${unten.join(',')} ≠ Hauptsuche ${oben.join(',')}`);
    }
  });

  await pruefe('Auch eine nicht beigetretene Community wird gefunden', async () => {
    const fremd = communitys.find((c) => !c.joined);
    if (!fremd) throw new Error('im Bestand ist jede Community beigetreten — nichts zu prüfen');
    await oeffneUnterseite('channels');
    const ids = await unterseiteTreffer('channels', fremd.name);
    if (!ids.includes(fremd.id)) throw new Error(`„${fremd.name}" fehlt`);
  });

  await pruefe('Zurück führt in die Hauptsuche', async () => {
    await page.click('#commSuchSeiteBack');
    await page.waitForTimeout(300);
    if (await page.$('[data-commsuchseite]')) throw new Error('die Unterseite steht noch');
    if (!(await page.$('[data-csfilter="all"]'))) throw new Error('die Hauptsuche ist nicht zurück');
  });

  /* ------------------------------------------------ Kasten 3.1 */
  console.log('\nKasten 3.1 — Profile-Seite');

  await pruefe('„Profile →" öffnet eine eigene Seite nur mit Profilen', async () => {
    await oeffneUnterseite('people');
    const titel = await page.$eval('.pagehead__title', (n) => n.textContent.trim());
    if (titel !== 'Profile') throw new Error('Titel ist „' + titel + '"');
    if (await page.$('#main [data-community]')) throw new Error('es stehen Communitys darin');
    if (await page.$('[data-csfilter]')) throw new Error('die Filter-Pillen stehen noch da');
    const n = await page.$$eval('#main [data-befriend]', (x) => x.length);
    if (n !== nutzer.length) throw new Error(`${n} Profile, der Server kennt ${nutzer.length}`);
  });

  await pruefe('Suche der Profile-Seite = Hauptsuche (gleiche Treffer)', async () => {
    if (!nutzer.length) throw new Error('kein Bestand');
    const begriff = begriffAus(nutzer[nutzer.length - 1].name);
    await oeffneUnterseite('people');
    const unten = await unterseiteTreffer('people', begriff);
    const oben = await hauptTreffer(begriff, 'people');
    if (!unten.length) throw new Error(`„${begriff}" findet auf der Unterseite nichts`);
    if (JSON.stringify(unten) !== JSON.stringify(oben)) {
      throw new Error(`Unterseite ${unten.join(',')} ≠ Hauptsuche ${oben.join(',')}`);
    }
  });

  await pruefe('Ein Begriff ohne Treffer zeigt den Leertext, keine Liste', async () => {
    await oeffneUnterseite('people');
    await page.fill('#commSuchSeiteInput', 'zzqxv-gibt-es-nicht');
    await page.waitForTimeout(300);
    if (await page.$('#main [data-befriend]')) throw new Error('es stehen trotzdem Profile da');
    const leer = await page.$eval('.empty__title', (n) => n.textContent.trim()).catch(() => '');
    if (leer !== 'Nichts gefunden') throw new Error('Leertext: „' + leer + '"');
  });

  await pruefe('Ein Bereichswechsel räumt die Unterseite ab', async () => {
    await oeffneUnterseite('people');
    await gehe('messenger');
    await gehe('communities', 'search');
    if (await page.$('[data-commsuchseite]')) throw new Error('beim Zurückkommen steht wieder die Unterseite');
  });

  /* ------------------------------------------------ Kasten 2.2 */
  console.log('\nKasten 2.2 — „Community" statt „Kanal"');

  await pruefe('Das Erstellen-Blatt unter Communitys heißt „Neue Community erstellen"', async () => {
    await gehe('communities', 'profile');
    await page.click('[data-oact="create"]');
    await page.waitForSelector('[data-erstellen="kanal"]', { timeout: 3000 });
    const text = await page.$eval('[data-erstellen="kanal"]', (n) => n.textContent.trim());
    if (!text.includes('Neue Community erstellen')) throw new Error('Punkt heißt „' + text + '"');
    await page.click('[data-erstellen="kanal"]');
    await page.waitForSelector('#f_name');
    const label = await page.$eval('label[for="f_name"]', (n) => n.textContent.trim());
    if (/Kanal/.test(label)) throw new Error('Feld heißt „' + label + '"');
    await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));
  });

  /* ------------------------------------------------ App-Quelltext */
  console.log('\nApp — gleiche Beschriftung (Quelltext; Bild prüft der Simulator)');

  await pruefe('App: Pfeil öffnet eigene Seite, Texte wie auf der Website', async () => {
    const quelle = fs.readFileSync(
      path.join(__dirname, '..', 'screens', 'communities', 'CommunitySearchScreen.tsx'),
      'utf8'
    );
    if (/Kanäle →/.test(quelle)) throw new Error('„Kanäle →" steht noch in der App');
    for (const muss of ['Communitys →', 'Alle Communitys anzeigen', 'Alle Profile anzeigen', 'Zurück zur Suche', 'Suche nach Profilen...', 'Suche nach Communitys...']) {
      if (!quelle.includes(muss)) throw new Error('fehlt: ' + muss);
    }
    if (/setFilter\('(channels|people)'\)\s*}\s*>\s*\n\s*<Text style=\{styles\.sectionHead\}/.test(quelle)) {
      throw new Error('der Kopf setzt noch nur den Filter');
    }
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await beenden(browser, erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
