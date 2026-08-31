// Macht von jedem Bildschirm ein Bild, damit man die Oberflaeche wirklich
// ansehen kann statt sich auf gruene Pruefungen zu verlassen. Eine bestandene
// Pruefung sagt nur, dass ein Knopf da ist - nicht, dass die Seite gut aussieht.
//
//   node test/_ansehen.js            hell
//   node test/_ansehen.js dunkel     dunkel

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');
const K = require('./_kennungen');
const path = require('path');
const fs = require('fs');

const ADRESSE = process.env.AM_URL || 'http://localhost:3000';
const DUNKEL = process.argv.includes('dunkel');
const ZIEL = path.join(__dirname, '..', '..', 'bilder', DUNKEL ? 'dunkel' : 'hell');

// Bereich, Unterpunkt, Name des Bildes
const SEITEN = [
  ['messenger', 'chats', 'messenger-chats'],
  ['messenger', 'friendmap', 'messenger-karte'],
  ['messenger', 'camera', 'messenger-kamera'],
  ['messenger', 'profile', 'messenger-profil'],
  ['videos', 'home', 'videos-start'],
  ['videos', 'portrait', 'videos-hochformat'],
  ['videos', 'landscape', 'videos-querformat'],
  ['videos', 'search', 'videos-suche'],
  ['videos', 'profile', 'videos-profil'],
  ['communities', 'home', 'community-start'],
  ['communities', 'chats', 'community-chats'],
  ['communities', 'search', 'community-suche'],
  ['communities', 'profile', 'community-profil'],
  ['settings', null, 'einstellungen'],
];

/*
 * Detailseiten. Die vierzehn Bereiche oben sind nur die Einstiegsseiten - ein
 * offener Chat, eine Story oder das Erstellen-Menue kam in keinem Bild vor,
 * obwohl ein Nutzer dort die meiste Zeit verbringt. Dieselbe Liste gibt es
 * fuer die App in app/tools/app-bilder.js.
 *
 * Jeder Eintrag: Bereich, Unterpunkt, Name, danach die Klicks bis zum Ziel.
 */
/*
 * Statt fester Kennungen ("c1") steht hier eine Funktion, die den Waehler zur
 * Laufzeit sucht — an dem, was auf dem Bildschirm steht. Chats und Storys
 * bekommen ihre Kennung beim Anlegen in der Datenbank; "c1" gibt es nicht
 * mehr. Siehe test/_kennungen.js.
 */
const DETAILS = [
  ['messenger', 'chats', 'detail-chat', [(p) => K.waehlerChat(p, 'Anna Schmidt')]],
  ['messenger', 'chats', 'detail-chat-gruppe', [(p) => K.waehlerChat(p, 'Projekt Team')]],
  ['messenger', 'chats', 'detail-story', [(p) => K.waehlerStory(p, 'Anna')]],
  ['videos', 'profile', 'detail-erstellen', ['[data-oact="create"]']],
  ['videos', 'profile', 'detail-mitteilungen', ['[data-oact="bell"]']],
  ['videos', 'landscape', 'detail-clip', [async (p) =>
    `[data-clip="${await p.$eval('[data-clip]', (n) => n.getAttribute('data-clip'))}"]`]],
  // Die Uebersichtsseiten der Video-Suche. Sie kamen in keinem Bild vor,
  // obwohl Henrik dort gleich drei Punkte gemeldet hat (kein Zurueck-Pfeil,
  // fehlende Kategorien, und der Bug, der die App festsetzte).
  ['videos', 'search', 'detail-suche-sounds', ['[data-explorer="sounds"]']],
  ['videos', 'search', 'detail-suche-profile', ['[data-explorer="profile"]']],
];

(async () => {
  fs.mkdirSync(ZIEL, { recursive: true });

  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const seite = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    colorScheme: DUNKEL ? 'dark' : 'light',
  });

  const fehler = [];
  seite.on('console', (m) => {
    if (m.type() === 'error') fehler.push(m.text());
  });

  await seite.goto(ADRESSE);

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen

  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.

  const angemeldet = await anmelden(seite);
  if (!angemeldet.ok) {

    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    process.exit(1);

  }

  await seite.reload({ waitUntil: 'networkidle' });

  await seite.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await seite.waitForSelector('.navbtn');

  for (const [bereich, unterpunkt, name] of SEITEN) {
    await seite.click(`[data-area="${bereich}"]`);
    await seite.waitForTimeout(150);
    if (unterpunkt) {
      await seite.click(`[data-sub="${unterpunkt}"]`);
      await seite.waitForTimeout(250);
    }
    await seite.screenshot({ path: path.join(ZIEL, `${name}.png`) });
    console.log(`  ${name}.png`);
  }

  for (const [bereich, unterpunkt, name, schritte] of DETAILS) {
    await seite.click(`[data-area="${bereich}"]`);
    await seite.waitForTimeout(150);
    if (unterpunkt) {
      await seite.click(`[data-sub="${unterpunkt}"]`);
      await seite.waitForTimeout(250);
    }
    for (const schritt of schritte) {
      // Ein Schritt ist entweder ein fester Waehler oder eine Funktion, die
      // ihn zur Laufzeit aus dem Bildschirm holt.
      const waehler = typeof schritt === 'function' ? await schritt(seite) : schritt;
      await seite.click(waehler);
      await seite.waitForTimeout(350);
    }
    await seite.screenshot({ path: path.join(ZIEL, `${name}.png`) });
    console.log(`  ${name}.png`);
    /*
     * Neu laden statt zurueckklicken. Ein offenes Blatt legt eine Flaeche
     * ueber die ganze Seite; der naechste Klick landet dann darauf statt auf
     * dem Knopf. Escape half nicht - die Blaetter schliessen darueber nicht.
     */
    await seite.goto(ADRESSE);
    await seite.waitForSelector('.navbtn');
  }

  await browser.close();

  console.log(`\n  ${SEITEN.length + DETAILS.length} Bilder in bilder/${DUNKEL ? 'dunkel' : 'hell'}/`);
  if (fehler.length) {
    console.log(`\n  ${fehler.length} Konsolenfehler:`);
    [...new Set(fehler)].forEach((f) => console.log(`    ${f}`));
    process.exitCode = 1;
  } else {
    console.log('  Keine Konsolenfehler');
  }
})();
