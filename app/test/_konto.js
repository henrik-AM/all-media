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
  await page.goto(basis, { waitUntil: 'networkidle' });
  const an = await anmelden(page);
  if (!an.ok) {
    console.error(`\nFEHLER  Anmeldung des Prüfkontos fehlgeschlagen: ${an.fehler}`);
    console.error('        Ohne Anmeldung ist die Seite leer — der Prüflauf würde nichts prüfen.');
    console.error(`        Konto: ${MAIL}  (über AM_TEST_MAIL / AM_TEST_PASS änderbar)\n`);
    return false;
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await page.waitForTimeout(600);
  return true;
}

/** Nur zurücksetzen — für Prüfläufe, die zwischendurch aufräumen. */
async function zuruecksetzen(page) {
  return page.evaluate(() => fetch('/api/reset', { method: 'POST' }).then((r) => r.json()));
}

module.exports = { anmelden, vorbereiten, zuruecksetzen, MAIL, PASS, NAME };
