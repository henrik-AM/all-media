// Macht von jedem Bildschirm ein Bild, damit man die Oberflaeche wirklich
// ansehen kann statt sich auf gruene Pruefungen zu verlassen. Eine bestandene
// Pruefung sagt nur, dass ein Knopf da ist - nicht, dass die Seite gut aussieht.
//
//   node test/_ansehen.js            hell
//   node test/_ansehen.js dunkel     dunkel

const { chromium } = require('playwright-core');
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

  await browser.close();

  console.log(`\n  ${SEITEN.length} Bilder in bilder/${DUNKEL ? 'dunkel' : 'hell'}/`);
  if (fehler.length) {
    console.log(`\n  ${fehler.length} Konsolenfehler:`);
    [...new Set(fehler)].forEach((f) => console.log(`    ${f}`));
    process.exitCode = 1;
  } else {
    console.log('  Keine Konsolenfehler');
  }
})();
