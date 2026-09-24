// Prueft jede Ueberschrift mit Pfeil auf der Website (Kasten 2 zum Feedback vom 21.09.).
//
// Henrik, wiederholt: "Ueberall, wo eine Ueberschrift mit Pfeil steht, muss
// sie auf die volle Uebersicht fuehren." Und: "Dort, wo sie inzwischen klickt
// (Suchen), kommt stattdessen 'hier gibt es nichts', obwohl die Vorschau
// darueber schon Beitraege zeigt."
//
// Deshalb keine Liste bekannter Ueberschriften, sondern ein Rundgang: auf
// jedem Bildschirm wird alles gesammelt, dessen Text auf "→" endet. Jede
// davon muss ein Knopf sein, beim Antippen die Seite wechseln und darf dort
// keinen Leertext zeigen, wenn unter ihr schon etwas stand.
//
// Start: node test/_pfeile.js (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

// Bildschirme, auf denen Ueberschriften mit Pfeil stehen koennen. Gesteuert
// ueber den Zustand statt ueber Klickwege - der Rundgang soll die Pfeile
// pruefen, nicht die Navigation.
const BILDSCHIRME = [
  { name: 'Videos — Suche', hin: () => { state.area = 'videos'; state.sub.videos = 'search'; state.explorerView = null; } },
  { name: 'Communitys — Profil', hin: () => { state.area = 'communities'; state.sub.communities = 'profile'; state.commProfilView = null; } },
  { name: 'Communitys — Suche', hin: () => { state.area = 'communities'; state.sub.communities = 'search'; state.commSearchFilter = null; } },
  { name: 'Einstellungen', hin: () => { state.area = 'settings'; state.settingsNur = null; } },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });
  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    await beenden(browser, 1);
  }
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#topbar button');

  const ergebnisse = [];
  const pruefe = (name, ok, info = '') => {
    ergebnisse.push(!!ok);
    console.log(`  ${ok ? 'OK  ' : 'FEHL'} ${name}${info ? ' — ' + info : ''}`);
  };

  // Neu laden statt nur umschalten: Unterseiten wie die hinter "Sounds →"
  // halten eigenen Zustand, und render() allein verlaesst sie nicht.
  const oeffnen = async (b) => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('#topbar button');
    await page.waitForTimeout(600);
    await page.evaluate(`(${b.hin.toString()})(); render();`);
    await page.waitForTimeout(1200);
  };

  // Alle sichtbaren Elemente, deren eigener Text auf "→" endet.
  const pfeile = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('#main *')]
        .filter((el) => {
          const eigen = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
          return eigen.endsWith('→') && el.getClientRects().length > 0;
        })
        .map((el, i) => {
          el.dataset.pfeilNr = i;
          // Stand unter der Ueberschrift schon etwas? Dann darf die Seite dahinter nicht leer sein.
          const naechstes = el.nextElementSibling;
          return {
            nr: i,
            text: el.textContent.trim().replace(/\s+/g, ' '),
            knopf: !!el.closest('button, a, [role="button"]'),
            vorschau: !!naechstes && naechstes.children.length > 0,
          };
        })
    );

  let gesamt = 0;
  for (const b of BILDSCHIRME) {
    console.log('\n' + b.name);
    await oeffnen(b);
    const liste = await pfeile();
    if (!liste.length) {
      console.log('  (keine Überschrift mit Pfeil — Testkonto hat hier nichts)');
      continue;
    }
    for (const p of liste) {
      gesamt++;
      await oeffnen(b);
      const vorher = await page.$eval('#main', (m) => m.innerHTML.length + ':' + m.textContent.slice(0, 200));
      const el = await page.$(`[data-pfeil-nr="${p.nr}"]`) || (await pfeile(), await page.$(`[data-pfeil-nr="${p.nr}"]`));
      pruefe(`„${p.text}" ist ein Knopf`, p.knopf);
      if (!el || !p.knopf) continue;
      await el.click();
      await page.waitForTimeout(1200);
      const nachher = await page.evaluate(() => ({
        stand: document.querySelector('#main').innerHTML.length + ':' + document.querySelector('#main').textContent.slice(0, 200),
        leer: [...document.querySelectorAll('#main .empty, .overlay .empty')].filter((e) => e.getClientRects().length).map((e) => e.textContent.trim().slice(0, 60)),
        zurueck: !!document.querySelector('#main .pagehead .iconbtn, [data-explorer-back], #commListeBack, #settingsNurBack, #commSuchBack'),
      }));
      pruefe(`„${p.text}" führt auf eine andere Seite`, nachher.stand !== vorher);
      if (p.vorschau) pruefe(`„${p.text}": dahinter kein Leertext, die Vorschau hatte Einträge`, nachher.leer.length === 0, nachher.leer.join(' | '));
    }
  }

  pruefe('Mindestens zehn Überschriften mit Pfeil gefunden', gesamt >= 10, `${gesamt}`);
  pruefe('Keine Fehler in der Konsole', browserFehler.length === 0, browserFehler.slice(0, 3).join(' | '));

  const ok = ergebnisse.filter(Boolean).length;
  console.log(`\n${ok}/${ergebnisse.length} Prüfungen bestanden`);
  await beenden(browser, ok === ergebnisse.length ? 0 : 1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
