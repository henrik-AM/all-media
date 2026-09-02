/**
 * Warten, bis ein Chat wirklich dasteht.
 *
 * WARUM ES DAS GIBT
 *
 * Die Prüfläufe warteten bisher auf `#messages` — den Kasten, in dem die
 * Nachrichten liegen — und danach 400 Millisekunden auf die Uhr. Der Kasten
 * ist aber sofort da; die Blasen kommen aus der Datenbank hinterher.
 *
 * Am 01.09.2026 hat das Laden der Nachrichten Arbeit dazubekommen: Bezüge
 * (Antwort, Zitat, Weiterleitung), Reaktionen und die Namen dazu werden
 * mitgeholt, gebündelt in wenigen Abfragen statt einer je Nachricht. Damit
 * liegt der Chat nach ungefähr 800 Millisekunden vollständig da — hinter den
 * 400, auf die gewartet wurde. Die Folge waren Prüfungen, die einzeln grün
 * und im Gesamtlauf rot waren, mit Meldungen wie
 *
 *     Cannot read properties of undefined (reading 'boundingBox')
 *
 * also: „die zweite Nachrichtenblase gibt es nicht" — sie war nur noch nicht
 * gezeichnet.
 *
 * Auf die Blasen zu warten statt auf die Uhr macht die Prüfung von der
 * Geschwindigkeit des Rechners unabhängig. Ein Chat ohne Nachrichten (frisch
 * angelegt, oder geleert) ist kein Fehler: dann läuft die Frist ab und der
 * Lauf geht weiter.
 */

/**
 * Wartet, bis der Chat offen ist und seine Nachrichten gezeichnet sind.
 *
 * @param {import('playwright-core').Page} page
 * @param {number} [frist] Höchstens so lange warten.
 */
async function chatOffen(page, frist = 10000) {
  await page.waitForSelector('#messages', { timeout: frist }).catch(() => {});
  await page.waitForSelector('[data-msgid]', { timeout: frist }).catch(() => {});
  // Ein kurzer Nachschlag: das Nachzeichnen nach dem Eintreffen der Daten
  // läuft im nächsten Bilddurchlauf, nicht im selben.
  await page.waitForTimeout(200);
}

module.exports = { chatOffen };
