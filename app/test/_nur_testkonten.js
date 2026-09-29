/**
 * Nur Claudes eigene Testkonten (Kasten 13.4, 29.09.2026).
 *
 * Henrik am 21.09.2026: „Echte Konten werden nicht angefasst … Auf Konten
 * echter Personen darf Claude nichts hochladen — kein Video, kein Beitrag."
 * Und am 28.09.2026: nur @test und @prueflauf, auch keine Testkonten, die
 * Henrik oder andere angelegt haben.
 *
 * Fast jeder Prüflauf und zwei Werkzeuge nehmen das Konto aus einer
 * Umgebungsvariable (AM_TEST_MAIL, TEST_EMAIL). Bis heute ohne jede Prüfung:
 * `AM_TEST_MAIL=henrik@… npm run test:alles` hätte unter Henriks Konto
 * Beiträge, Storys, Nachrichten und Spenden angelegt, `tools/testmedien.js`
 * vierzehn Videos hochgeladen — und die Aufräum-SQL in _aufraeumen.js
 * hätte über `$KONTO` in seinem Bestand gelöscht.
 *
 * Diese Liste ist dieselbe wie in `public.ist_testkonto()` (Schema 62).
 * Ein neues Testkonto kommt in BEIDE.
 */

const TESTKONTEN = ['test@all-media.app', 'all.media.prueflauf@web.de'];

/** Gibt die Adresse zurück — oder bricht den Lauf ab, wenn sie keinem Testkonto gehört. */
function nurTestkonto(mail) {
  const m = String(mail || '').trim().toLowerCase();
  if (!TESTKONTEN.includes(m)) {
    console.error(
      `\nABBRUCH  „${mail}" ist keines der beiden Testkonten (${TESTKONTEN.join(', ')}).\n` +
        '         Prüfläufe und Werkzeuge schreiben nur dort. Echte Konten fasst nur Henrik an.\n'
    );
    process.exit(2);
  }
  return mail;
}

/**
 * Welche dieser Beiträge gehören einem Demoprofil (Anna, Bob …)?
 *
 * Prüfläufe, die liken, reposten oder folgen, dürfen das nur bei
 * Demoprofilen: der Feed ist gerankt, oben kann ein öffentlicher Beitrag
 * eines echten Kontos stehen — dessen Besitzer bekäme sonst eine Mitteilung
 * vom Prüfkonto. Läuft im angemeldeten Browser (window.Anmeldung).
 * Gibt die Kennungen in der gegebenen Reihenfolge zurück, nur die von Demos.
 */
async function nurDemoBeitraege(page, ids) {
  if (!ids || !ids.length) return [];
  return page.evaluate(async (liste) => {
    const client = await window.Anmeldung.aufbauen();
    const { data } = await client.from('posts').select('id, profiles!user_id(demo)').in('id', liste.slice(0, 100));
    const demo = new Set((data || []).filter((b) => b.profiles && b.profiles.demo).map((b) => b.id));
    return liste.filter((id) => demo.has(id));
  }, ids);
}

module.exports = { TESTKONTEN, nurTestkonto, nurDemoBeitraege };
