/**
 * Anmeldung für die Prüfläufe.
 *
 * WARUM ES DAS GIBT
 *
 * Bis zum 31.08.2026 begann jeder Prüflauf mit POST /api/reset: der Server
 * stellte seine Beispieldaten im Arbeitsspeicher wieder her, und die Seite
 * zeigte Anna, Bob und Clara — ohne dass sich jemand angemeldet hätte.
 *
 * Seit die Inhalte in der Datenbank stehen, geht das nicht mehr. Die Regeln
 * der Datenbank (Row Level Security) lassen anonyme Zugriffe nicht zu; ohne
 * Anmeldung ist die Seite leer, und zwar zu Recht. Jeder Prüflauf meldet sich
 * deshalb zuerst an.
 *
 * EIN KONTO, NICHT EINS PRO LAUF
 *
 * Supabase lässt mit seinem eingebauten Mailversand nur wenige
 * Registrierungen pro Stunde zu. Ein Prüflauf, der sich jedes Mal neu
 * registriert, steht deshalb nach dem zweiten Durchgang. Also gibt es ein
 * festes Prüfkonto, das vor jedem Lauf auf den Startzustand zurückgesetzt
 * wird — über die Datenbankfunktion zuruecksetzen(), die ausschließlich
 * Zeilen dieses einen Kontos anfasst.
 *
 * ZUGANG
 *
 * Über Umgebungsvariablen überschreibbar:
 *   AM_TEST_MAIL, AM_TEST_PASS
 */

const MAIL = process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de';
const PASS = process.env.AM_TEST_PASS || 'PruefLauf2026!';
const NAME = process.env.AM_TEST_NAME || 'prueflauf';

/**
 * Meldet die Seite an und setzt das Prüfkonto auf den Startzustand zurück.
 *
 * Gibt zurück, ob es geklappt hat. Bei false sollte der Prüflauf mit einer
 * klaren Meldung abbrechen statt lauter Folgefehler zu melden — ein Lauf
 * gegen eine leere Seite prüft nichts und meldet trotzdem zwanzig Fehler.
 */
/*
 * ===================================================================
 * Jede Seite bekommt dasselbe Geruest — egal, welcher Lauf sie oeffnet
 * ===================================================================
 *
 * Zwei Dinge muss jede Seite koennen, und keines davon bringt Playwright
 * von sich aus mit:
 *
 * 1. `page.evaluate` braucht eine Zeitgrenze (siehe unten).
 * 2. Nach einem `goto` oder `reload` muss gewartet werden, bis die Seite
 *    ihre Daten hat — nicht nur ihr Geruest.
 *
 * Zu 2.: Bis zum 09.09.2026 stand ueberall `waitUntil: 'networkidle'`. Das
 * hat zufaellig beides erledigt, war aber unzuverlaessig, seit die Seite
 * beim Start den Geraeteschluessel anmeldet — das Netz kommt dann nicht mehr
 * verlaesslich zur Ruhe, und der Lauf lief in einen Timeout. Der Wechsel auf
 * `load` behebt das, nimmt aber das Warten auf die Daten mit weg: die
 * Chatliste war danach leer, weil niemand mehr auf sie gewartet hat.
 *
 * Also beides getrennt und ausdruecklich, statt es einem Nebeneffekt zu
 * ueberlassen.
 *
 * Der Einbau haengt sich an `chromium.launch`, damit ihn kein Lauf vergessen
 * kann. `playwright-core` ist ein Singleton — es ist gleichgueltig, ob ein
 * Lauf diese Datei vor oder nach playwright einbindet.
 */
const { chromium } = require('playwright-core');

/** Warten, bis die Oberflaeche steht und Daten da sind. Nie werfen. */
async function inhaltAbwarten(page) {
  await page.waitForSelector('[data-area]', { timeout: 15000 }).catch(() => {});
  await page
    .waitForFunction(
      () => {
        // `state` ist die Ablage der Website. Sobald irgendetwas Geladenes
        // darin steht, hat der erste Schwung Anfragen geantwortet.
        const s = window.state;
        if (!s) return false;
        return Boolean(
          s.chats?.length || s.posts?.length || s.users?.me || s.communities?.length
        );
      },
      null,
      { timeout: 15000 }
    )
    .catch(() => {});
}

function geruestet(page) {
  if (page.__geruestet) return page;
  page.__geruestet = true;
  mitZeitgrenze(page);

  for (const name of ['goto', 'reload']) {
    const echt = page[name].bind(page);
    page[name] = async (...args) => {
      const antwort = await echt(...args);
      await inhaltAbwarten(page);
      return antwort;
    };
  }
  return page;
}

if (!chromium.__geruestet) {
  chromium.__geruestet = true;
  const echtStarten = chromium.launch.bind(chromium);
  chromium.launch = async (...args) => {
    const browser = await echtStarten(...args);

    const echtSeite = browser.newPage.bind(browser);
    browser.newPage = async (...a) => geruestet(await echtSeite(...a));

    const echtKontext = browser.newContext.bind(browser);
    browser.newContext = async (...a) => {
      const kontext = await echtKontext(...a);
      const echtKontextSeite = kontext.newPage.bind(kontext);
      kontext.newPage = async (...b) => geruestet(await echtKontextSeite(...b));
      return kontext;
    };

    return browser;
  };
}

/*
 * Eine Zeitgrenze um `page.evaluate` legen.
 *
 * Playwright setzt fuer `evaluate` — anders als fuer `click` oder
 * `waitForSelector` — keine Zeitgrenze. Bleibt der Code in der Seite haengen,
 * etwa weil ein Supabase-Aufruf nicht zurueckkommt, wartet der Prueflauf
 * unbegrenzt. Am 09.09.2026 standen `kanal` und `aktionen` so je eine
 * Viertelstunde still, obwohl inhaltlich alles durchgelaufen war.
 *
 * Ein Abbruch mit klarer Meldung ist immer besser als ein Lauf, der schweigt.
 */
/*
 * Schliesst den Browser und beendet den Lauf — notfalls ohne ihn.
 *
 * `browser.close()` hat selbst keine Zeitgrenze. Kommt es nicht zurueck, wird
 * das `process.exit()` dahinter nie erreicht: der Lauf hat seine Zahlen schon
 * vollstaendig gedruckt und steht danach still, bis der Gesamtlauf ihn nach
 * einer Viertelstunde abschiesst. Am 17.09.2026 traf das `insel` (17/17),
 * `suche` und `profil` (22/22) in einem einzigen Durchgang — dreimal
 * fuenfzehn Minuten fuer Ergebnisse, die laengst dastanden, und dreimal die
 * Markierung ZEIT auf einem inhaltlich fehlerfreien Lauf.
 *
 * Fuenf Sekunden reichen zum sauberen Schliessen. Danach ist ein
 * zurueckgelassener chrome-headless-shell das kleinere Uebel.
 */
async function schliesse(browser) {
  await Promise.race([
    browser.close().catch(() => {}),
    new Promise((fertig) => {
      const uhr = setTimeout(fertig, 5000);
      if (uhr.unref) uhr.unref();
    }),
  ]);
}

async function beenden(browser, code) {
  await schliesse(browser);
  process.exit(code);
}

function mitZeitgrenze(page, ms = 60000) {
  if (page.__zeitgrenze) return page;
  page.__zeitgrenze = true;
  const echt = page.evaluate.bind(page);
  page.evaluate = (...args) =>
    Promise.race([
      echt(...args),
      new Promise((_, ablehnen) => {
        const uhr = setTimeout(
          () => ablehnen(new Error(`page.evaluate kam nach ${ms} ms nicht zurueck`)),
          ms
        );
        if (uhr.unref) uhr.unref();
      }),
    ]);
  return page;
}

async function anmelden(page) {
  // Warten, bis die Anmeldung im Browser bereitsteht.
  await page.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
  await page.evaluate(() => window.Anmeldung.bereit?.catch(() => null));

  const ergebnis = await page.evaluate(
    async ({ mail, pass, name }) => {
      if (window.Anmeldung.angemeldet()) return { ok: true, schon: true };

      let an = await window.Anmeldung.anmelden(mail, pass);
      if (an.ok) return { ok: true };

      // Gibt es das Konto noch nicht, einmal anlegen.
      const neu = await window.Anmeldung.registrieren({
        benutzername: name,
        passwort: pass,
        email: mail,
      });

      /*
       * Scheitert das Anlegen daran, dass es das Konto schon gibt, dann war
       * der erste Fehler der wahre Grund — etwa "E-Mail nicht bestätigt".
       * Den zweiten zu melden würde in die Irre führen.
       */
      if (!neu.ok) {
        const schonDa = /vergeben|bereits|already/i.test(neu.fehler || '');
        return { ok: false, fehler: schonDa ? an.fehler : neu.fehler };
      }

      an = await window.Anmeldung.anmelden(mail, pass);
      return an.ok ? { ok: true } : { ok: false, fehler: an.fehler };
    },
    { mail: MAIL, pass: PASS, name: NAME }
  );

  if (!ergebnis.ok) return ergebnis;

  // Startzustand herstellen: eigene Beiträge, Kommentare und Testgruppen weg,
  // Chats und Kontakte frisch aus den Vorlagen.
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }).then((r) => r.json()));
  return { ok: true };
}

/**
 * Anmelden, zurücksetzen und die Seite neu laden — der übliche Anfang eines
 * Prüflaufs. Danach steht die Oberfläche mit echten Daten da.
 */
async function vorbereiten(page, basis = 'http://localhost:3000') {
  mitZeitgrenze(page);
  await page.goto(basis, { waitUntil: 'load' });
  const an = await anmelden(page);
  if (!an.ok) {
    console.error(`\nFEHLER  Anmeldung des Prüfkontos fehlgeschlagen: ${an.fehler}`);
    console.error('        Ohne Anmeldung ist die Seite leer — der Prüflauf würde nichts prüfen.');
    console.error(`        Konto: ${MAIL}  (über AM_TEST_MAIL / AM_TEST_PASS änderbar)\n`);
    return false;
  }
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await page.waitForTimeout(600);
  return true;
}

/**
 * Nur zurücksetzen — für Prüfläufe, die zwischendurch aufräumen.
 *
 * Die Antwort wird gelesen und geprüft, und das ist der ganze Punkt. Bis zum
 * 02.09.2026 riefen dreiunddreißig Stellen `fetch('/api/reset')` auf, ohne
 * hinzusehen. Ein Zurücksetzen, das `{ ok: false }` meldete — etwa weil es
 * auf ein Beispielprofil traf —, sah dann genauso aus wie ein gelungenes.
 * Der Lauf begann auf einem Bestand, den er für frisch hielt, und fiel
 * irgendwo weiter hinten mit einer Meldung um, die mit der Ursache nichts
 * mehr zu tun hatte.
 *
 * Darum hier laut statt still: wer nicht aufräumen konnte, soll es an der
 * Stelle erfahren, an der es passiert ist.
 *
 * NEU LADEN — 07.09.2026
 *
 * Muss der Bestand einen Chat wirklich neu anlegen (statt ihn nur
 * vorzufinden), bekommt er eine **neue Kennung**. Die Seite hat ihre
 * Chatliste aber beim Start geholt und holt sie nicht wieder; sie zeigt
 * weiter die alten Kennungen. Ein Klick darauf ging dann an den Server und
 * kam mit „Diesen Chat gibt es nicht" zurueck — im Bild sah alles normal
 * aus, der Chat stand ja da.
 *
 * Das faellt fast nie auf, weil der Bestand meist unversehrt ist und die
 * Kennungen gleich bleiben. Genau deshalb ist es gefaehrlich: es schlaegt
 * erst zu, wenn vorher etwas anderes schiefgegangen ist.
 *
 * Darum laedt das Zuruecksetzen die Seite neu. `domcontentloaded` statt
 * `networkidle` mit Absicht — auf „networkidle" zu warten hat am selben Tag
 * vier Laeufe gekippt, seit der Geraeteschluessel beim Start angemeldet wird.
 * Wer mitten in einer Pruefung aufraeumt und den Bildschirm behalten will,
 * ruft `zuruecksetzen(page, { neuLaden: false })`.
 */
async function zuruecksetzen(page, { neuLaden = true } = {}) {
  const antwort = await page.evaluate(() =>
    fetch('/api/reset', { method: 'POST' })
      .then((r) => r.json())
      .catch((f) => ({ ok: false, grund: String(f) }))
  );
  if (!antwort || antwort.ok === false) {
    throw new Error(
      'Der Testbestand liess sich nicht zuruecksetzen: ' +
        (antwort?.grund || antwort?.error || JSON.stringify(antwort))
    );
  }
  if (neuLaden) {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 });
    // Auf die fertige Oberflaeche warten, nicht nur auf das Geruest: sonst
    // klickt der naechste Schritt in eine leere Seite.
    await page.waitForSelector('[data-area]', { timeout: 20000 }).catch(() => {});
  }
  return antwort;
}

module.exports = {
  anmelden,
  vorbereiten,
  zuruecksetzen,
  mitZeitgrenze,
  inhaltAbwarten,
  schliesse,
  beenden,
  MAIL,
  PASS,
  NAME,
};
