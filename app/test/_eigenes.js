// Prueft, was am 27.08.2026 beim Durchsehen der Bilder auffiel - lauter
// Stellen, an denen die Oberflaeche etwas ueber den eigenen Nutzer behauptet,
// das nicht stimmt. Keiner dieser Punkte stand in Henriks Rueckmeldung; alle
// waren in einer gruenen Suite unsichtbar.
//
//   1  Die Like-Zeile geht bei null Likes nicht auf
//      ("Gefaellt und 0 weiteren Personen")
//   2  Am eigenen Beitrag stehen "Folgen" und die Glocke
//   3  Ein Beitrag ohne Ort schreibt "Ohne Ort" statt gar nichts
//   4  Der eigene Name heisst in der App "Henrik", auf der Website "Du"
//   5  Messenger- und Community-Profil zeigen fest eingetragenen Text statt
//      der Kontodaten - "Profil bearbeiten" blieb dort ohne Wirkung
//
// Start:  node test/_eigenes.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');

const ZIEL = process.env.AM_URL || process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    /*
     * Eine der Pruefungen verlangt ausdruecklich, dass der Server das
     * Verlassen der eigenen Community mit 409 ablehnt. Der Browser meldet
     * jede abgelehnte Anfrage in der Konsole - dieser eine Eintrag ist also
     * das erwartete Ergebnis und kein Fehler.
     */
    if (m.text().includes('409')) return;
    browserFehler.push('Konsole: ' + m.text());
  });

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

  const gehe = async (bereich, unter) => {
    await page.click(`[data-area="${bereich}"]`);
    await page.waitForTimeout(300);
    if (unter) {
      await page.click(`[data-sub="${unter}"]`);
      await page.waitForTimeout(600);
    }
  };

  /** Legt einen eigenen Beitrag an und gibt seine Kennung zurueck. */
  const eigenenBeitragAnlegen = async (ort) =>
    page.evaluate(async (o) => {
      const r = await fetch('/api/eigene/beitrag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ beschreibung: 'Ein frischer Beitrag', ort: o }),
      });
      return (await r.json()).beitrag?.id;
    }, ort || '');

  /* ------------------------------------------------ Der eigene Beitrag */
  console.log('\nDer eigene Beitrag im Feed');

  await eigenenBeitragAnlegen('');
  await page.reload({ waitUntil: 'networkidle' });
  await gehe('videos', 'home');
  await page.waitForSelector('.post');

  const eigener = '.post:has([data-profile="me"])';

  await pruefe('Ein Beitrag ohne Likes zeigt keine Like-Zeile', async () => {
    const text = await page.$eval(eigener, (e) => e.innerText);
    if (/Gefällt\s+und/.test(text) || /\b0 weiteren\b/.test(text)) {
      throw new Error('die Zeile steht noch da: ' + text.split('\n').find((z) => z.includes('Gefällt')));
    }
  });

  await pruefe('Am eigenen Beitrag steht kein "Folgen"', async () => {
    const knopf = await page.$(`${eigener} .post__follow`);
    if (knopf) throw new Error('der Folgen-Knopf ist da');
  });

  await pruefe('Am eigenen Beitrag steht keine Glocke', async () => {
    const glocke = await page.$(`${eigener} .post__bell`);
    if (glocke) throw new Error('die Glocke ist da');
  });

  await pruefe('Ein Beitrag ohne Ort schreibt nicht "Ohne Ort"', async () => {
    const text = await page.$eval(eigener, (e) => e.innerText);
    if (text.includes('Ohne Ort')) throw new Error('"Ohne Ort" steht im Beitrag');
  });

  await pruefe('Ein Beitrag ohne Ort beginnt nicht mit einem Mittelpunkt', async () => {
    const sub = await page.$eval(`${eigener} .post__sub`, (e) => e.innerText.trim());
    if (sub.startsWith('·')) throw new Error('die Zeile beginnt mit: ' + sub);
  });

  await pruefe('Bei einem fremden Beitrag steht "Folgen" weiterhin', async () => {
    const knoepfe = await page.$$('.post__follow');
    if (!knoepfe.length) throw new Error('kein einziger Folgen-Knopf im Feed');
  });

  await pruefe('Die Like-Zeile eines fremden Beitrags nennt einen Namen', async () => {
    const zeile = await page.$$eval('.post__likes', (l) => l.map((e) => e.innerText.trim()));
    const kaputt = zeile.find((z) => /Gefällt\s+und/.test(z) || z.includes('0 weiteren'));
    if (kaputt) throw new Error('kaputte Zeile: ' + kaputt);
    if (!zeile.length) throw new Error('gar keine Like-Zeile im Feed');
  });

  /* -------------------------------------------------- Der eigene Name */
  console.log('\nDer eigene Name');

  /*
   * Hier stand frueher fest "Henrik". Das war der Name des einen Kontos, mit
   * dem damals geprueft wurde - der Lauf schlug fehl, sobald ein anderes
   * Konto angemeldet war. Geprueft gehoert der Punkt selbst: der eigene Name
   * ist ein echter Kontoname und nicht der Platzhalter "Du".
   */
  await pruefe('Das Konto traegt seinen Namen, nicht "Du"', async () => {
    const name = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).users.me.name);
    if (!name || !name.trim()) throw new Error('der Server nennt gar keinen Namen');
    if (['Du', 'Ich', 'Me'].includes(name.trim())) throw new Error('der Server sagt: ' + name);
  });

  /*
   * Die drei Profile gehoeren zu einem Konto. Vorher stand in zweien davon
   * Name und Info fest im Markup - wer sein Profil bearbeitete, sah die
   * Aenderung nur im Videos-Profil.
   */
  const NEUER_NAME = 'Henrik Prüfname';
  const NEUE_INFO = 'Diese Info kommt aus dem Konto.';

  await pruefe('Name und Info lassen sich aendern', async () => {
    const antwort = await page.evaluate(
      async ([n, b]) => {
        const r = await fetch('/api/eigene/profil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: n, bio: b, link: 'all-media.app', color: '' }),
        });
        return r.json();
      },
      [NEUER_NAME, NEUE_INFO]
    );
    if (!antwort.ok) throw new Error('der Server sagt: ' + (antwort.error || 'nichts'));
  });

  await page.reload({ waitUntil: 'networkidle' });

  for (const [bereich, unter, wo] of [
    ['videos', 'profile', 'Videos-Profil'],
    ['messenger', 'profile', 'Messenger-Profil'],
    ['communities', 'profile', 'Community-Profil'],
  ]) {
    await pruefe(`${wo} zeigt den Namen aus dem Konto`, async () => {
      await gehe(bereich, unter);
      await page.waitForTimeout(500);
      const text = await page.$eval('#main', (e) => e.innerText);
      if (!text.includes(NEUER_NAME)) {
        throw new Error('der geaenderte Name steht nicht auf der Seite');
      }
    });

    await pruefe(`${wo} zeigt die Info aus dem Konto`, async () => {
      const text = await page.$eval('#main', (e) => e.innerText);
      if (!text.includes(NEUE_INFO)) {
        throw new Error('die geaenderte Info steht nicht auf der Seite');
      }
    });
  }

  /* ------------------------------------------ Die eigene Community */
  console.log('\nDie eigene Community — Punkt 62');

  await pruefe('An der eigenen Community steht kein Beitritts-Knopf', async () => {
    await gehe('communities', 'home');
    await page.waitForTimeout(600);
    const knoepfe = await page.evaluate(async () => {
      const eigene = (await (await fetch('/api/bootstrap')).json()).communities.filter((c) => c.eigen);
      return eigene.map((c) => ({
        name: c.name,
        knopf: !!document.querySelector(`[data-join="${c.id}"]`),
      }));
    });
    if (!knoepfe.length) throw new Error('es gibt gar keine eigene Community zum Pruefen');
    const mitKnopf = knoepfe.find((k) => k.knopf);
    if (mitKnopf) throw new Error(`"${mitKnopf.name}" hat noch einen Knopf`);
  });

  await pruefe('Der Server verweigert das Verlassen der eigenen Community', async () => {
    const ergebnis = await page.evaluate(async () => {
      const eigene = (await (await fetch('/api/bootstrap')).json()).communities.find((c) => c.eigen);
      const vorher = eigene.members;
      const r = await fetch(`/api/communities/${eigene.id}/join`, { method: 'POST' });
      const nachher = (await (await fetch('/api/bootstrap')).json()).communities.find((c) => c.id === eigene.id);
      return { status: r.status, vorher, nachherMitglieder: nachher.members, nachherDrin: nachher.joined };
    });
    if (ergebnis.status < 400) throw new Error('der Server hat es angenommen (' + ergebnis.status + ')');
    if (!ergebnis.nachherDrin) throw new Error('man ist trotzdem draussen');
    if (ergebnis.nachherMitglieder !== ergebnis.vorher) {
      throw new Error(`die Mitgliederzahl hat sich geaendert: ${ergebnis.vorher} → ${ergebnis.nachherMitglieder}`);
    }
  });

  await pruefe('Einer fremden Community kann man weiter beitreten', async () => {
    const ok = await page.evaluate(async () => {
      const fremd = (await (await fetch('/api/bootstrap')).json()).communities.find((c) => !c.eigen && !c.joined);
      if (!fremd) return 'keine fremde Community frei';
      const r = await fetch(`/api/communities/${fremd.id}/join`, { method: 'POST' });
      return r.ok ? true : 'der Server sagt ' + r.status;
    });
    if (ok !== true) throw new Error(String(ok));
  });

  await pruefe('Das Bearbeiten-Formular ist nicht leer', async () => {
    await gehe('videos', 'profile');
    await page.click('#profilBearbeiten');
    await page.waitForSelector('#pbBio');
    const bio = await page.$eval('#pbBio', (e) => e.value.trim());
    const link = await page.$eval('#pbLink', (e) => e.value.trim());
    if (!bio) throw new Error('das Feld "Info" ist leer');
    if (!link) throw new Error('das Feld "Link" ist leer');
  });

  const erfuellt = ergebnisse.filter(Boolean).length;
  console.log(`\n  ${erfuellt} von ${ergebnisse.length} Punkten erfuellt`);
  console.log(browserFehler.length ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ') : '\n  Keine Konsolenfehler');

  await browser.close();
  process.exit(erfuellt === ergebnisse.length && !browserFehler.length ? 0 : 1);
})();
