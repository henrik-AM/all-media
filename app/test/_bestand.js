// Bestandsaufnahme: Was kann man in jedem der vier Bereiche wirklich tun?
//
// Klickt in jedem Bereich die sichtbaren Aktionen durch und schaut, ob etwas
// passiert (Ansicht wechselt, Zustand aendert sich) oder nur ein
// "folgt"-Hinweis erscheint.
//
// Start:  node test/_bestand.js

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen } = require('./_konto');

const BEREICHE = {
  messenger: ['friendmap', 'chats', 'camera', 'profile'],
  videos: ['home', 'portrait', 'landscape', 'search', 'profile'],
  communities: ['home', 'chats', 'search', 'profile'],
  settings: [],
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

  await page.goto(process.env.ZIEL || 'http://localhost:3000/', { waitUntil: 'networkidle' });

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen

  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {

    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    process.exit(1);

  }

  await page.reload({ waitUntil: 'networkidle' });

  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const bilanz = {};

  for (const [bereich, unterpunkte] of Object.entries(BEREICHE)) {
    await page.click(`[data-area="${bereich}"]`);
    await page.waitForTimeout(500);

    let echt = 0;
    let platzhalter = 0;
    const offen = [];

    const punkte = unterpunkte.length ? unterpunkte : [null];

    for (const sub of punkte) {
      if (sub) {
        await page.click(`[data-sub="${sub}"]`).catch(() => {});
        await page.waitForTimeout(500);
      }

      // Alle anklickbaren Elemente der Seite sammeln
      const knoepfe = await page.$$('main button:visible');

      for (let i = 0; i < Math.min(knoepfe.length, 14); i++) {
        const frisch = await page.$$('main button:visible');
        const k = frisch[i];
        if (!k) continue;

        const beschriftung = (await k.getAttribute('aria-label')) || (await k.textContent()) || '';
        const vorher = await page.evaluate(() => document.querySelector('main').innerHTML.length);

        // Meldung leeren
        await page.evaluate(() => {
          const t = document.querySelector('#toast');
          if (t) { t.textContent = ''; t.hidden = true; }
        });

        await k.click({ timeout: 1500 }).catch(() => {});
        await page.waitForTimeout(450);

        const meldung = await page.$eval('#toast', (e) => e.textContent).catch(() => '');
        const nachher = await page.evaluate(() => document.querySelector('main').innerHTML.length);
        const overlayOffen = await page.evaluate(() => {
          const o = document.querySelector('#overlay');
          return !!o && !o.hidden;
        });
        const blattOffen = !!(await page.$('.sheet-backdrop'));

        // Wortgrenzen, sonst zaehlt "nicht mehr gefolgt" als Platzhalter -
        // da steckt "folgt" nur zufaellig drin.
        if (/\bfolgt\b|\bfolgen\b|Phase 3/i.test(meldung)) {
          platzhalter++;
          offen.push(`${beschriftung.trim().slice(0, 28)} → "${meldung.trim().slice(0, 40)}"`);
        } else if (overlayOffen || blattOffen || nachher !== vorher || meldung.trim()) {
          echt++;
        }

        // Wieder aufräumen
        await page.evaluate(() => {
          document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
          const o = document.querySelector('#overlay');
          if (o) { o.hidden = true; o.innerHTML = ''; }
        });
        await page.waitForTimeout(150);
      }
    }

    bilanz[bereich] = { echt, platzhalter, offen };
  }

  console.log('\nWas in jedem Bereich passiert, wenn man draufdrückt\n');
  for (const [bereich, b] of Object.entries(bilanz)) {
    const gesamt = b.echt + b.platzhalter;
    const anteil = gesamt ? Math.round((b.echt / gesamt) * 100) : 100;
    console.log(`${bereich.padEnd(13)} ${String(b.echt).padStart(3)} wirken · ${String(b.platzhalter).padStart(2)} nur Hinweis  (${anteil}% wirksam)`);
    for (const o of b.offen.slice(0, 4)) console.log(`              offen: ${o}`);
  }

  await zuruecksetzen(page);
  await browser.close();
})();
