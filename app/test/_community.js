// Prueft die Community-Punkte aus Henriks Rueckmeldung vom 26.08.2026:
//
//   Punkt 51  Die Kanalseite folgt dem Prototyp-Frame "CH + Kanal"
//   Punkt 55  Die Liste heisst nach dem, was drinsteht
//   Punkt 62  Die eigene Community laesst sich nicht verlassen
//   Punkt 63  Der Gruppenname fuehrt zu den Einstellungen
//
// Der Frame gibt vor: Zurueck-Pfeil, grosses Kopfbild, Name mit
// Mitgliederzahl, Knopf, "...", Biografie, Link, "neues Unterthema
// erstellen", darunter die Unterthemen.
//
// Start:  node test/_community.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');
const K = require('./_kennungen');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'networkidle' });

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
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
  await page.reload({ waitUntil: 'networkidle' });
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

  /*
   * Eine Community am Namen oeffnen statt an "k1".
   *
   * Communitys bekommen ihre Kennung beim Anlegen in der Datenbank, und die
   * privaten legt jedes Konto fuer sich an — eine feste Kennung kann es also
   * gar nicht geben. Siehe test/_kennungen.js.
   */
  const oeffne = async (name) => {
    await page.click('[data-area="communities"]');
    await page.waitForTimeout(500);
    await page.click(`[data-community="${await K.kennungNachText(page, 'data-community', name)}"]`);
    await page.waitForTimeout(700);
  };

  console.log('\nCommunitys — die Seite nach dem Prototyp');

  await oeffne('React Native DE');

  const TEILE = [
    ['.kanal__bild', 'das grosse Kopfbild'],
    ['.kanal__zurueck', 'der Zurueck-Pfeil auf dem Bild'],
    ['.kanal__name', 'der Name'],
    ['.kanal__mitglieder', 'die Mitgliederzahl'],
    ['.kanal__mehr', 'das „..."'],
    ['.kanal__bio', 'die Biografie'],
    ['.kanal__link', 'der Link'],
    ['#neuesUnterthema', '„neues Unterthema erstellen"'],
    ['.kanal__thema', 'die Unterthemen'],
  ];

  for (const [wahl, was] of TEILE) {
    await pruefe(`Es gibt ${was}`, async () => {
      if (!(await page.$(wahl))) throw new Error('fehlt');
    });
  }

  await pruefe('Das Kopfbild ist gross, nicht ein Symbol in einer Zeile', async () => {
    const h = await page.$eval('.kanal__bild', (n) => n.getBoundingClientRect().height);
    if (h < 180) throw new Error('nur ' + Math.round(h) + 'px hoch');
  });

  await pruefe('Der Name ist nicht abgeschnitten', async () => {
    const { sichtbar, echt } = await page.$eval('.kanal__name', (n) => ({
      sichtbar: n.clientWidth,
      echt: n.scrollWidth,
    }));
    if (echt > sichtbar + 1) throw new Error('„Design Systeme" passt nicht in die Zeile');
  });

  await pruefe('Der Link ist ein echter Link', async () => {
    const href = await page.$eval('.kanal__link a', (n) => n.getAttribute('href'));
    if (!href || !href.startsWith('http')) throw new Error('href ist „' + href + '"');
  });

  await pruefe('Die Unterthemen tragen die Raute vor dem Namen', async () => {
    const namen = await page.$$eval('.kanal__thema-name', (n) => n.map((x) => x.textContent.trim()));
    const ohne = namen.filter((t) => !t.startsWith('#'));
    if (ohne.length) throw new Error('ohne Raute: ' + ohne.join(', '));
  });

  await pruefe('Ein Unterthema laesst sich oeffnen', async () => {
    await page.click('.kanal__thema');
    await page.waitForTimeout(600);
    if (await page.$('.kanal__bild')) throw new Error('die Seite hat sich nicht geaendert');
  });

  console.log('\nCommunitys — Name, Einstellungen, eigene Community');

  await pruefe('Der Gruppenname fuehrt zu den Einstellungen', async () => {
    await oeffne('React Native DE');
    await page.click('#communityKopf');
    await page.waitForTimeout(500);
    if (!(await page.$('.sheet'))) throw new Error('es geht nichts auf');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  await pruefe('Das „..." fuehrt zu denselben Einstellungen', async () => {
    await oeffne('React Native DE');
    await page.click('#communityMehr');
    await page.waitForTimeout(500);
    if (!(await page.$('.sheet'))) throw new Error('es geht nichts auf');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  await pruefe('Eine fremde Community laesst sich verlassen', async () => {
    await oeffne('React Native DE');
    const knopf = await page.$('[data-join]');
    if (!knopf) throw new Error('kein Knopf');
    const text = await knopf.textContent();
    if (text.trim() !== 'Verlassen') throw new Error('der Knopf sagt „' + text.trim() + '"');
  });

  await pruefe('Die eigene Community laesst sich NICHT verlassen', async () => {
    // "Laufgruppe Köln" legt jedes Konto beim Anlegen selbst an (private
    // Vorlage aus SUPABASE_SCHEMA_6_inhalte.sql) — sie gehört einem also
    // wirklich. "Fotografie" ist dagegen öffentlich und gehört Clara.
    await oeffne('Laufgruppe Köln');
    if (await page.$('[data-join]')) throw new Error('der Verlassen-Knopf steht trotzdem da');
    const hinweis = await page.$('.kanal__eigen');
    if (!hinweis) throw new Error('kein Hinweis, dass es die eigene Community ist');
  });

  /*
   * Das Unterthema wird in der EIGENEN Community angelegt.
   *
   * Vorher lief das in "React Native DE" — die gehört Bob. zuruecksetzen()
   * fasst nur an, was dem eigenen Konto gehört, der Kanal blieb also stehen,
   * und der zweite Prüflauf scheiterte an "gibt es schon". "Laufgruppe Köln"
   * legt jedes Konto selbst an und bekommt sie beim Zurücksetzen frisch.
   */
  await pruefe('Ein neues Unterthema laesst sich anlegen', async () => {
    await oeffne('Laufgruppe Köln');
    const vorher = await page.$$eval('.kanal__thema', (n) => n.length);
    await page.click('#neuesUnterthema');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Ankündigungen');
    await page.click('#formOk');

    /*
     * Auf das neue Unterthema warten, nicht auf die Uhr. Es wird in der
     * Datenbank angelegt und die Liste danach neu geholt; die 800 ms, die
     * hier standen, waren geraten und reichten unter Last nicht — gemeldet
     * wurde dann "2 vorher, 2 nachher", obwohl alles richtig lief.
     */
    await page
      .waitForFunction(
        (soll) => document.querySelectorAll('.kanal__thema').length >= soll,
        vorher + 1,
        { timeout: 15000 }
      )
      .catch(() => {});
    const nachher = await page.$$eval('.kanal__thema', (n) => n.length);
    if (nachher !== vorher + 1) throw new Error(`${vorher} vorher, ${nachher} nachher`);
    const namen = await page.$$eval('.kanal__thema-name', (n) => n.map((x) => x.textContent));
    if (!namen.some((t) => t.includes('Ankündigungen'))) throw new Error('steht nicht in der Liste');
  });

  await pruefe('Ein zweites Unterthema mit demselben Namen wird abgelehnt', async () => {
    await page.click('#neuesUnterthema');
    await page.waitForSelector('#f_name');
    await page.fill('#f_name', 'Ankündigungen');
    await page.click('#formOk');
    await page.waitForTimeout(600);
    const toast = await page.$eval('#toast', (n) => (n.hidden ? '' : n.textContent));
    if (!toast.includes('gibt es schon')) throw new Error('kein Hinweis, Toast sagt „' + toast + '"');
    await page.click('[data-sheet-close]').catch(() => {});
  });

  /* ------------------------------------------- Community-Chats */
  console.log('\nCommunitys — Chats');

  const zuDenChats = async () => {
    // Erst wegräumen, was offen steht: ein Blatt oder ein offener Chat legt
    // sonst seine Fläche über die untere Leiste, und der nächste Klick
    // wartet acht Sekunden auf einen Knopf, den er nie erreicht.
    await page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await page.click('[data-area="communities"]');
    await page.waitForTimeout(300);
    await page.click('[data-sub="chats"]');
    await page.waitForSelector('#commChatSearch', { timeout: 10000 });
  };

  await pruefe('Ein einzelner Chat laesst sich oeffnen', async () => {
    await zuDenChats();
    const zeilen = await page.$$('[data-chat]');
    if (!zeilen.length) throw new Error('die Liste ist leer');
    await zeilen[0].click();
    // Der Verlauf kommt aus der Datenbank — erst danach steht der Chat.
    await page.waitForSelector('#chatBack', { timeout: 10000 }).catch(() => {});
    if (!(await page.$('#chatBack'))) throw new Error('der Chat geht nicht auf');
    await page.click('#chatBack');
    await page.waitForTimeout(400);
  });

  await pruefe('Auch ein Gruppenchat laesst sich oeffnen', async () => {
    await zuDenChats();
    await page.click('[data-ccfilter="groups"]');
    await page.waitForTimeout(300);
    const zeilen = await page.$$('[data-chat]');
    if (!zeilen.length) throw new Error('keine Gruppe in der Liste');
    await zeilen[0].click();
    await page.waitForSelector('#chatBack', { timeout: 10000 }).catch(() => {});
    if (!(await page.$('#chatBack'))) throw new Error('der Gruppenchat geht nicht auf');
    await page.click('#chatBack');
    await page.waitForTimeout(400);
  });

  await pruefe('Das Plus bleibt auf der Chats-Seite', async () => {
    await zuDenChats();
    await page.click('#commNewChat');
    await page.waitForTimeout(500);
    if (!(await page.$('[data-cneu]'))) throw new Error('es geht kein Menue auf');
    const aktiv = await page.$eval('#topbar .is-active', (n) => n.dataset.sub);
    if (aktiv !== 'chats') throw new Error('gesprungen nach „' + aktiv + '"');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  await pruefe('„Neue Gruppe" aus dem Menue oeffnet direkt', async () => {
    await zuDenChats();
    await page.click('#commNewChat');
    await page.waitForTimeout(400);
    await page.click('[data-cneu="gruppe"]');
    await page.waitForTimeout(600);
    const titel = await page.$eval('.sheet__title', (n) => n.textContent);
    if (!titel.includes('Personen')) throw new Error('Blatt heisst „' + titel + '"');
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
