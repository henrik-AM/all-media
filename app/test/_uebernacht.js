// Prueft Henriks Frage vom 21.09.2026 woertlich:
//
//   "wenn ich zum Beispiel etwas liken und am naechsten Morgen mit meinem
//    Konto mich wieder anmelde, ich immer noch diesen Like sehen kann"
//
// WARUM DAS EINEN EIGENEN LAUF BRAUCHT
//
// Es gab Persistenzpruefungen fuer Einstellungen und Untertitel, aber fuer
// keine der vier Gattungen, um die es Henrik im Feedback vom 18.09. ging:
// Likes, Kommentare, Reposts, Gespeichertes. Genau dort lag damals der
// Fehler — geschrieben wurde, gelesen wurde nie.
//
// Und "bleibt beim Neuladen stehen" genuegt als Nachweis nicht. Ein Neuladen
// behaelt die Sitzung; die Zeile kann aus einem Zwischenspeicher kommen.
// Dieser Lauf meldet sich deshalb **ab** und **neu an** — eine neue Sitzung,
// ein neues Zugangstoken, wie am naechsten Morgen.
//
// WAS ER NICHT PRUEFT
//
// Den echten Tagesabstand. Ein Token laeuft nach Stunden ab, nicht nach
// Minuten — ein abgelaufenes Token kann dieser Lauf nicht herbeifuehren.
// Geprueft ist: die Handlung liegt in der Datenbank und ist nach einer
// frischen Anmeldung wieder zu sehen. Was an einer abgelaufenen Sitzung
// haengt, faellt hier nicht auf.
//
// Start:  node test/_uebernacht.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { zusammengelegt } = require('./_modulquelle');
const { vorbereiten, beenden, inhaltAbwarten, mitZeitgrenze, MAIL, PASS } = require('./_konto');

/**
 * Uebersetzt lib/daten.ts und gibt den Quelltext zurueck — den Lese-Teil der
 * App, Wort fuer Wort derselbe Code, der auf dem Telefon laeuft.
 *
 * Warum der Lauf das ueberhaupt tut: "Expo und Website gleichauf" ist
 * bindend. Ein Nachweis, dass der Like auf der Website den naechsten Morgen
 * uebersteht, sagt nichts darueber, was die App dann anzeigt.
 */
function appLesecode() {
  const bau = fs.mkdtempSync(path.join(os.tmpdir(), 'all-media-uebernacht-'));
  try {
    execFileSync(
      process.execPath,
      [
        path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
        path.join(__dirname, '..', 'lib', 'daten.ts'),
        '--ignoreConfig', '--target', 'es2020', '--module', 'es2020',
        '--skipLibCheck', '--outDir', bau,
      ],
      { stdio: 'pipe' }
    );
    const finde = (ordner) =>
      fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
        const voll = path.join(ordner, e.name);
        return e.isDirectory() ? finde(voll) : e.name === 'daten.js' ? [voll] : [];
      });
    if (!finde(bau).length) return null;
    return zusammengelegt(bau, 'daten.js');
  } catch (e) {
    console.log('  HINWEIS  lib/daten.ts liess sich nicht uebersetzen: ' + e.message);
    return null;
  } finally {
    fs.rmSync(bau, { recursive: true, force: true });
  }
}

/**
 * Anmelden OHNE zurueckzusetzen — der Morgen danach.
 *
 * `vorbereiten()` und `anmelden()` aus _konto.js rufen am Ende immer
 * `/api/reset` auf (_konto.js:223). Das ist fuer jeden anderen Lauf richtig,
 * hier aber toedlich: das Zuruecksetzen leert `saves` und stellt die Vorlage
 * wieder her. Der Lauf loeschte am Morgen also selbst, was er suchte — und
 * meldete "Gespeichertes ueber Nacht verloren", obwohl nichts verloren war.
 * Der Like ueberlebte nur, weil das Zuruecksetzen Likes stehen laesst.
 */
async function anmeldenOhneReset(page, basis = 'http://localhost:3000') {
  mitZeitgrenze(page);
  await page.goto(basis, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
  await page.evaluate(() => window.Anmeldung.bereit?.catch(() => null));
  const an = await page.evaluate(
    ({ mail, pass }) => window.Anmeldung.anmelden(mail, pass),
    { mail: MAIL, pass: PASS }
  );
  if (!an.ok) return false;
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  return true;
}

let gut = 0;
let schlecht = 0;

function pruefe(name, bedingung, hinweis = '') {
  if (bedingung) {
    gut += 1;
    console.log(`  OK   ${name}${hinweis ? ' — ' + hinweis : ''}`);
  } else {
    schlecht += 1;
    console.log(`  FEHL ${name}${hinweis ? ' — ' + hinweis : ''}`);
  }
}

(async () => {
  const browser = await chromium.launch();
  const browserFehler = [];

  /** Eine frische Seite mit eigener Sitzung — kein geteilter Speicher. */
  const frischeSeite = async () => {
    const kontext = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      // Der App-Lesecode wird als blob: importiert; die Content-Security-
      // Policy der Website verbietet das zu Recht. Nur dieser Browser
      // schaltet die Durchsetzung ab — wie in _aktionen.js.
      bypassCSP: true,
    });
    const seite = await kontext.newPage();
    seite.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
    seite.on('console', (m) => {
      if (m.type() === 'error') browserFehler.push('Konsole: ' + m.text());
    });
    return { kontext, seite };
  };

  console.log('\n  Abend: anmelden und etwas tun\n');

  const abend = await frischeSeite();
  // vorbereiten() ruft die Seite auf UND meldet an — ohne den Aufruf gibt es
  // kein window.Anmeldung, und anmelden() laeuft in einen Timeout.
  if (!(await vorbereiten(abend.seite))) {
    await beenden(browser, 1);
    return;
  }
  // --- liken -------------------------------------------------------------
  //
  // Die Beitraege stehen im Bereich "videos". Einen Bereich "home" gibt es
  // auf der Website nicht (AREAS = messenger, videos, communities, settings)
  // — ein Klick darauf wartet ewig auf einen Knopf, den niemand zeichnet.
  await abend.seite.click('[data-area="videos"]');
  await inhaltAbwarten(abend.seite);
  await abend.seite.waitForSelector('article.post[data-impression]', { timeout: 15000 });

  // Den Beitrag merken, damit spaeter derselbe geprueft wird — und zwar einen
  // aus dem festen Testbestand (IDs beginnen mit 22222222-). Der oberste
  // Beitrag im Feed taugt nicht: `zuruecksetzen()` legt die frischen Beitraege
  // jedes Mal mit **neuer** UUID an. Der Lauf suchte am Morgen dann eine ID,
  // die es nicht mehr gab, und meldete "Like weg", obwohl der Like stand.
  const beitragId = await abend.seite.$$eval('article.post[data-impression]', (els) => {
    const ids = els.map((el) => el.dataset.impression);
    return ids.find((id) => id.startsWith('22222222-')) || ids[0] || '';
  });
  pruefe('Ein Beitrag zum Liken ist da', Boolean(beitragId), beitragId ? `#${beitragId.slice(0, 8)}` : '');

  const likeKnopf = `.postbtn[data-paction="like"][data-pid="${beitragId}"]`;
  const merkKnopf = `.postbtn[data-paction="save"][data-pid="${beitragId}"]`;

  /**
   * Fragt den Server, ob der Beitrag gerade gelikt bzw. gemerkt ist.
   * Immer mit no-store — sonst antwortet der Browser aus dem eigenen Speicher.
   */
  const serverZustand = (seite, id) =>
    seite.evaluate(async (i) => {
      const hole = async (pfad) => {
        const r = await fetch(pfad, { credentials: 'same-origin', cache: 'no-store' });
        return r.ok ? r.json() : [];
      };
      const gelikt = await hole('/api/gelikt');
      const gemerkt = await hole('/api/gespeichert');
      return {
        gelikt: (Array.isArray(gelikt) ? gelikt : []).some((e) => e.id === i),
        gemerkt: (Array.isArray(gemerkt) ? gemerkt : []).some((e) => (e.eintrag?.id || e.id) === i),
      };
    }, id);

  /**
   * Stellt einen Ausgangszustand her — ueber die API, nicht ueber Klicks.
   *
   * Warum nicht klicken: die Oberflaeche faerbt den Knopf sofort und fragt
   * den Server erst danach. Zwei Klicks kurz hintereinander (erst abwaehlen,
   * dann setzen) ueberholen sich deshalb; am Ende stand der Knopf auf
   * "gesetzt", in der Datenbank aber nichts. Drei Durchlaeufe ergaben 8, 6
   * und 10 bestandene Pruefungen — ein Lauf, der wuerfelt, belegt nichts.
   */
  async function stelleHer(seite, id, was, ziel) {
    for (let versuch = 0; versuch < 3; versuch += 1) {
      const jetzt = (await serverZustand(seite, id))[was];
      if (jetzt === ziel) return true;
      await seite.evaluate(
        ({ i, w }) =>
          fetch(`/api/posts/${i}/${w === 'gelikt' ? 'like' : 'save'}`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          }),
        { i: id, w: was }
      );
    }
    return (await serverZustand(seite, id))[was] === ziel;
  }

  /**
   * Ein einziger echter Klick — und gewartet wird auf die Antwort des
   * Servers, nicht auf die Farbe des Knopfes.
   */
  async function klickeEinmal(seite, wahl) {
    await seite.waitForSelector(wahl, { timeout: 10000 });
    const antwort = seite
      .waitForResponse((r) => /\/api\/posts\/.*\/(like|save)$/.test(r.url()), { timeout: 15000 })
      .catch(() => null);
    await seite.click(wahl);
    const r = await antwort;
    return Boolean(r && r.ok());
  }

  // Ausgangszustand: nichts gesetzt. Sonst prueft der Lauf einen Zustand,
  // der ohnehin dastand.
  await stelleHer(abend.seite, beitragId, 'gelikt', false);
  await stelleHer(abend.seite, beitragId, 'gemerkt', false);
  await abend.seite.reload({ waitUntil: 'load' });
  await abend.seite.click('[data-area="videos"]');
  await inhaltAbwarten(abend.seite);

  await klickeEinmal(abend.seite, likeKnopf);
  const likeSitzt = (await serverZustand(abend.seite, beitragId)).gelikt;
  pruefe('Der Like laesst sich setzen', likeSitzt);

  // --- speichern ---------------------------------------------------------
  await klickeEinmal(abend.seite, merkKnopf);
  const gemerkt = (await serverZustand(abend.seite, beitragId)).gemerkt;
  pruefe('Der Beitrag laesst sich speichern', gemerkt);

  // --- Nacht: Sitzung wirklich beenden ------------------------------------
  console.log('\n  Nacht: abmelden, Sitzung verwerfen\n');
  await abend.kontext.close();
  pruefe('Die Sitzung ist beendet', abend.seite.isClosed());

  // --- Morgen: neue Sitzung, neues Token ----------------------------------
  console.log('\n  Morgen: neu anmelden und nachsehen\n');

  const morgen = await frischeSeite();
  const wiederAngemeldet = await anmeldenOhneReset(morgen.seite);
  pruefe('Die Anmeldung am naechsten Morgen klappt', wiederAngemeldet === true);
  // Ausdruecklich KEIN Zuruecksetzen hier — das wuerde genau das loeschen,
  // was geprueft werden soll. Deshalb auch nicht vorbereiten().

  await morgen.seite.click('[data-area="videos"]');
  await inhaltAbwarten(morgen.seite);
  await morgen.seite
    .waitForSelector(`article.post[data-impression="${beitragId}"]`, { timeout: 15000 })
    .catch(() => {});

  const nochDa = await morgen.seite
    .$eval(`.postbtn[data-paction="like"][data-pid="${beitragId}"]`, (el) =>
      el.classList.contains('is-liked')
    )
    .catch(() => null);
  pruefe(
    'Der Like ist am naechsten Morgen noch da',
    nochDa === true,
    nochDa === null ? 'Beitrag nicht gefunden' : ''
  );

  const merkNochDa = await morgen.seite
    .$eval(`.postbtn[data-paction="save"][data-pid="${beitragId}"]`, (el) =>
      el.classList.contains('is-saved')
    )
    .catch(() => null);
  pruefe(
    'Der gespeicherte Beitrag ist am naechsten Morgen noch da',
    merkNochDa === true,
    merkNochDa === null ? 'Knopf nicht gefunden' : ''
  );

  // Und die Listen, nicht nur die Knoepfe. Genau hier lag der Fehler vom
  // 18.09.: der Knopf war gefaerbt, die Liste blieb leer.
  const amMorgen = await serverZustand(morgen.seite, beitragId);
  /*
   * Bevor hier "verloren" gemeldet wird: war es ueberhaupt dieser Lauf?
   *
   * Am 21.09.2026 fiel der Lauf reihum um — 8, 6, 10, 5, 9, 5 bestandene
   * Pruefungen. Die Ursache lag nicht in der Anwendung: im selben Ordner
   * lief eine zweite Sitzung ihre eigenen Pruefungen, und deren
   * `/api/reset` leert `post_likes` und `saves` mitten in diesem Lauf.
   * Gemessen: ein gesetzter Like war zehn Sekunden spaeter weg.
   *
   * Erkennbar ist das am Muster: BEIDE Gattungen sind weg, und in den
   * Listen steht wieder genau der Vorlagenbestand. Dann ist die Aussage
   * dieses Laufs "nicht messbar" — und das zu sagen ist ehrlicher, als
   * einen Fehler zu melden, den die Anwendung nicht hat.
   */
  if (!amMorgen.gelikt && !amMorgen.gemerkt) {
    const fremd = await morgen.seite.evaluate(async () => {
      const r = await fetch('/api/gelikt', { credentials: 'same-origin', cache: 'no-store' });
      return r.ok ? (await r.json()).length : -1;
    });
    console.log('\n  ACHTUNG  Like und Gespeichertes sind gleichzeitig weg, und die Listen');
    console.log(`           stehen wieder auf Vorlagenbestand (${fremd} Eintraege).`);
    console.log('           Das ist das Bild eines fremden /api/reset — laeuft im selben');
    console.log('           Ordner noch eine zweite Sitzung mit Pruefungen?');
    console.log('           Pruefen mit:  ps -eo pid,etime,command | grep "node test/"\n');
  }

  pruefe('Der gespeicherte Beitrag steht auch in der Merkliste', amMorgen.gemerkt);
  pruefe('Der Like steht auch in der Liste im Profil', amMorgen.gelikt);

  // --- und jetzt dasselbe mit den Augen der App ---------------------------
  const lesecode = appLesecode();
  if (!lesecode) {
    console.log('  HINWEIS  App-Seite nicht geprueft — ohne uebersetzten Lesecode.');
  } else {
    const ausApp = await morgen.seite
      .evaluate(
        async ({ quelltext, id }) => {
          const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
          const daten = await import(url);
          URL.revokeObjectURL(url);
          const client = await window.Anmeldung.aufbauen();
          const ich = window.Anmeldung.nutzer().id;
          // ladeBeitraege gibt { posts, videos, clips } zurueck, keine Liste —
          // die App trennt Fotos, Videos und Clips auf drei Bildschirme.
          const alle = (await daten.ladeBeitraege(client, ich)) || {};
          const b = [...(alle.posts || []), ...(alle.videos || []), ...(alle.clips || [])].find(
            (x) => x.id === id
          );
          return b ? { liked: Boolean(b.liked), saved: Boolean(b.saved) } : null;
        },
        { quelltext: lesecode, id: beitragId }
      )
      .catch((e) => ({ fehler: e.message }));

    if (!ausApp) {
      pruefe('Die App sieht den Beitrag am naechsten Morgen', false, 'nicht im App-Feed');
    } else if (ausApp.fehler) {
      pruefe('Die App sieht den Beitrag am naechsten Morgen', false, ausApp.fehler);
    } else {
      pruefe('Die App zeigt den Like am naechsten Morgen', ausApp.liked === true);
      pruefe('Die App zeigt den gespeicherten Beitrag am naechsten Morgen', ausApp.saved === true);
    }
  }

  console.log(
    browserFehler.length
      ? '\n  Konsolenfehler:\n   ' + browserFehler.join('\n   ')
      : '\n  Konsolenfehler: keine'
  );
  console.log(`\n  ${gut} von ${gut + schlecht} Pruefungen bestanden`);

  await morgen.kontext.close();
  await beenden(browser, schlecht ? 1 : 0);
})();
