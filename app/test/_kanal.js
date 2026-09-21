/**
 * Kommt im Unterthema einer Community wirklich etwas an?
 *
 * WARUM ES DAS GIBT
 *
 * Der Handbuch-Abgleich vom 01.09.2026 führte als letzten offenen Punkt
 * „Sticker innerhalb von Community-Kanälen" — im Privatchat gab es sie, im
 * Kanal nicht. Beim Nachsehen am 04.09.2026 war es größer als ein fehlender
 * Sticker, und zwar auf beiden Seiten:
 *
 *   1. `community_channel_messages` hatte vier Spalten: id, channel_id,
 *      sender_id, text. Für einen Anhang war dort kein Platz.
 *
 *   2. Die App schickte jeden Anhang über `nachrichtSenden()` nach
 *      `messages`. Dessen `chat_id` zeigt auf `chats`; eine Kanal-Kennung
 *      steht dort nicht, und die Regel „Nachricht senden" verlangt eine
 *      Mitgliedschaft in genau diesem Chat. Die Datenbank wies jede Zeile
 *      mit 42501 ab — auf dem Bildschirm stand „Der Anhang ging nicht raus".
 *
 *   3. Die Website schickte im Kanal sogar den blossen TEXT an
 *      `/api/messages/<Kanal-Id>` — denselben Weg, dieselbe Ablehnung. Die
 *      richtige Route gab es die ganze Zeit, sie wurde nur nie gerufen. Weil
 *      die Seite danach neu lud und der Kanal wieder so aussah wie vorher,
 *      sah es nach einem Anzeigefehler aus.
 *
 * Kein Prüflauf konnte das sehen: `_community.js` prüft die Kanalseite, aber
 * schreibt nie hinein.
 *
 * GEPRÜFT WIRD AUF BEIDEN SEITEN
 *
 * Erst die Website durch die Oberfläche, dann die App über ihren echten Code
 * (lib/aktionen.ts und lib/daten.ts, übersetzt und im Browser ausgeführt —
 * wie in test/_aktionen.js). Zum Schluss die Gegenprobe: was die App
 * schreibt, muss die Website sehen.
 *
 * Start:  node test/_kanal.js   (Server muss laufen)
 */

const { chromium } = require('playwright-core');
const { zusammengelegt } = require('./_modulquelle');
const { anmelden, MAIL, zuruecksetzen, mitZeitgrenze, beenden } = require('./_konto');

const BASIS = process.env.AM_URL || 'http://localhost:3000';

let fehler = 0;
let gesamt = 0;
const pruefe = (name, wahr, zusatz = '') => {
  gesamt++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/** lib/aktionen.ts bzw. lib/daten.ts übersetzen und im Browser bereitstellen. */
function uebersetzen(name) {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');

  const ordner = fs.mkdtempSync(path.join(os.tmpdir(), 'all-media-kanal-'));
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
      path.join(__dirname, '..', 'lib', `${name}.ts`),
      '--ignoreConfig', '--target', 'es2020', '--module', 'es2020',
      '--skipLibCheck', '--outDir', ordner,
    ],
    { stdio: 'pipe' }
  );
  // Mit medien.js verschmelzen — ein blob-Modul hat keine Herkunft, an der
  // ein relativer Import hängen könnte. Siehe test/_modulquelle.js.
  const quelltext = zusammengelegt(ordner, `${name}.js`);
  fs.rmSync(ordner, { recursive: true, force: true });
  return quelltext;
}

(async () => {
  const browser = await chromium.launch();
  // bypassCSP: dieser Lauf lädt App-Code über eine blob:-Adresse in die
  // Seite; die Regel der echten Seite verbietet das zu Recht. Begründung
  // ausführlich in test/_aktionen.js.
  const seite = await browser.newPage({ viewport: { width: 400, height: 860 }, bypassCSP: true });
  // Dieser Lauf ruft App-Code in der Seite auf. Bleibt der haengen, waere es
  // ohne Zeitgrenze ein Stillstand ohne Meldung — siehe _konto.js.
  mitZeitgrenze(seite);

  const browserFehler = [];
  seite.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  /*
   * Eine Konsolenmeldung wird hier ERWARTET und darum nicht gezaehlt.
   *
   * Die letzte Pruefung unten schreibt absichtlich auf dem alten Weg nach
   * `messages` und rechnet mit einer Ablehnung — die Datenbank antwortet
   * darauf mit 403, und der Browser schreibt das ins Protokoll. Diese eine
   * Zeile ist der Nachweis, dass die Sperre haelt, kein Fehler.
   *
   * Erwartet wird ausdruecklich nur die Ablehnung an `messages`; jede andere
   * fehlgeschlagene Anfrage zaehlt weiterhin.
   */
  const erwartet = (m) => {
    // Die Adresse steht nicht im Text der Meldung, sondern in ihrer Herkunft.
    const wo = m.location?.().url || '';
    return /rest\/v1\/messages/.test(wo) && /403/.test(m.text());
  };
  seite.on(
    'console',
    (m) => m.type() === 'error' && !erwartet(m) && browserFehler.push('Konsole: ' + m.text())
  );

  await seite.goto(BASIS, { waitUntil: 'load' });
  const an = await anmelden(seite);
  if (!an.ok) {
    console.error(`FEHLER  Prüfkonto ${MAIL} konnte sich nicht anmelden: ${an.fehler}`);
    await beenden(browser, 1);
  }
  await zuruecksetzen(seite);
  await seite.reload({ waitUntil: 'load' });
  await seite.waitForSelector('#topbar button');

  /*
   * Eine Community mit Unterthema suchen — über die Daten, nicht über feste
   * Kennungen: Communitys bekommen ihre Kennung beim Anlegen.
   */
  const kanalDaten = await seite.evaluate(async () => {
    const boot = await (await fetch('/api/bootstrap')).json();
    for (const c of boot.communities || []) {
      const k = (c.channels || [])[0];
      if (k) return { communityId: c.id, communityName: c.name, kanalId: k.id, kanalName: k.name };
    }
    return null;
  });

  if (!kanalDaten) {
    console.error('FEHLER  Keine Community mit Unterthema — der Lauf würde nichts prüfen.');
    await beenden(browser, 1);
  }

  /** Was in diesem Unterthema wirklich steht — gefragt wird die Datenbank. */
  const ausDatenbank = () =>
    seite.evaluate(
      async ({ communityId, kanalId }) => {
        const r = await fetch(`/api/communities/${communityId}/channels/${kanalId}`);
        const d = await r.json();
        return d.messages || [];
      },
      kanalDaten
    );

  console.log('\nDie Website schreibt ins Unterthema');

  const vorher = await ausDatenbank();
  const text = `Prüflauf ${Date.now()}`;

  await pruefe(
    'Ein Text im Unterthema kommt in der Datenbank an',
    await (async () => {
      const antwort = await seite.evaluate(
        async ({ communityId, kanalId, text }) => {
          const r = await fetch(`/api/communities/${communityId}/channels/${kanalId}/nachricht`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
          });
          return r.json();
        },
        { ...kanalDaten, text }
      );
      if (antwort?.ok === false) return false;
      const nachher = await ausDatenbank();
      return nachher.length === vorher.length + 1 && nachher.some((m) => m.text === text);
    })(),
    'bis 04.09.2026 ging das an die Chat-Route und wurde mit 42501 abgewiesen'
  );

  await pruefe(
    'Ein Sticker steht als Sticker da, nicht als Text',
    await (async () => {
      const antwort = await seite.evaluate(
        async ({ communityId, kanalId }) => {
          const r = await fetch(`/api/communities/${communityId}/channels/${kanalId}/anhang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art: 'sticker', zeichen: '🎉' }),
          });
          return r.json();
        },
        kanalDaten
      );
      if (!antwort?.ok) return false;
      const nachher = await ausDatenbank();
      const meiner = nachher.find((m) => m.id === antwort.message.id);
      return Boolean(meiner) && meiner.media === 'sticker' && meiner.text === '🎉';
    })()
  );

  await pruefe(
    'Eine Datei bringt Name und Größe mit',
    await (async () => {
      const antwort = await seite.evaluate(
        async ({ communityId, kanalId }) => {
          const r = await fetch(`/api/communities/${communityId}/channels/${kanalId}/anhang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art: 'datei', name: 'Protokoll.pdf', groesse: 20480 }),
          });
          return r.json();
        },
        kanalDaten
      );
      if (!antwort?.ok) return false;
      const meiner = (await ausDatenbank()).find((m) => m.id === antwort.message.id);
      return meiner?.datei?.name === 'Protokoll.pdf' && meiner.datei.groesse === 20480;
    })()
  );

  await pruefe(
    'Ein angehängter Standort kommt als Bezug an, nicht als Satz',
    await (async () => {
      const antwort = await seite.evaluate(
        async ({ communityId, kanalId }) => {
          const boot = await (await fetch('/api/bootstrap')).json();
          const ort = (boot.places || [])[0];
          if (!ort) return { ok: false, error: 'kein Standort im Bestand' };
          const r = await fetch(`/api/communities/${communityId}/channels/${kanalId}/anhang`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ art: 'standort', id: ort.id }),
          });
          return r.json();
        },
        kanalDaten
      );
      if (!antwort?.ok) return false;
      const meiner = (await ausDatenbank()).find((m) => m.id === antwort.message.id);
      return Boolean(meiner?.standort?.name);
    })()
  );

  console.log('\nDie Oberfläche zeigt, was dasteht');

  await pruefe(
    'Im Unterthema steht ein Plus für den Anhang',
    await (async () => {
      /*
       * Vier Ebenen, nicht drei: Communitys → Community (Liste der Kanaele)
       * → Kanal (Liste der Unterthemen) → das Unterthema selbst. Erst dort
       * steht die Nachrichtenzeile.
       */
      await seite.click('[data-area="communities"]');
      await seite.waitForTimeout(500);
      await seite.click(`[data-community="${kanalDaten.communityId}"]`);
      await seite.waitForTimeout(700);
      await seite.click('.kanal__thema');
      await seite.waitForTimeout(700);
      await seite.click('[data-thema]');
      await seite.waitForSelector('#commForm', { timeout: 8000 });
      return Boolean(await seite.$('#commAttach'));
    })()
  );

  await pruefe(
    'Der Sticker steht ohne Blase da',
    Boolean(await seite.$('#commMsgs .msg--sticker'))
  );

  await pruefe(
    'Das Plus öffnet das Anhang-Blatt ohne „Standort anfragen"',
    await (async () => {
      await seite.click('#commAttach');
      await seite.waitForTimeout(500);
      const punkte = await seite.$$eval('[data-anhang]', (n) => n.map((x) => x.dataset.anhang));
      await seite.click('[data-sheet-close]').catch(() => {});
      await seite.waitForTimeout(300);
      return punkte.includes('sticker') && !punkte.includes('standortAnfragen');
    })(),
    'im Kanal gibt es kein Gegenüber, das man fragen könnte'
  );

  console.log('\nWas die App schreibt, sieht die Website');

  const quelleAktionen = uebersetzen('aktionen');
  const quelleDaten = uebersetzen('daten');

  const app = (quelltext, schluessel, name, ...args) =>
    seite.evaluate(
      async ({ quelltext, schluessel, name, args }) => {
        if (!window[schluessel]) {
          const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
          window[schluessel] = await import(url);
          URL.revokeObjectURL(url);
        }
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        return window[schluessel][name](client, ich, ...args);
      },
      { quelltext, schluessel, name, args }
    );

  const appSticker = await pruefeApp();
  async function pruefeApp() {
    try {
      return await app(quelleAktionen, '__aktionen', 'kanalNachricht', kanalDaten.kanalId, '🔥', {
        typ: 'sticker',
      });
    } catch (e) {
      return { fehler: e.message };
    }
  }

  await pruefe(
    'Ein Sticker aus der App wird angenommen',
    Boolean(appSticker && appSticker.id),
    appSticker?.fehler || ''
  );

  await pruefe(
    'Die App liest ihn als Sticker zurück',
    await (async () => {
      const gelesen = await app(quelleDaten, '__daten', 'ladeKanalNachrichten', kanalDaten.kanalId);
      const meiner = (gelesen || []).find((m) => m.id === appSticker?.id);
      return meiner?.media === 'sticker' && meiner.text === '🔥';
    })()
  );

  await pruefe(
    'Und die Website sieht denselben Sticker',
    await (async () => {
      const meiner = (await ausDatenbank()).find((m) => m.id === appSticker?.id);
      return meiner?.media === 'sticker' && meiner.text === '🔥';
    })()
  );

  await pruefe(
    'Ein Anhang aus der App landet nicht mehr in `messages`',
    await (async () => {
      // Die Gegenprobe zum Fund: der alte Weg muss weiterhin abgewiesen
      // werden. Ginge er wieder, stünde der Anhang in der falschen Tabelle
      // und wäre im Kanal unsichtbar.
      const antwort = await seite.evaluate(async (kanalId) => {
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        const { data, error } = await client
          .from('messages')
          .insert({ chat_id: kanalId, sender_id: ich, text: 'darf nicht durchkommen' })
          .select('id')
          .maybeSingle();
        if (data?.id) await client.from('messages').delete().eq('id', data.id);
        return { geschrieben: Boolean(data?.id), code: error?.code || '' };
      }, kanalDaten.kanalId);
      return antwort.geschrieben === false;
    })()
  );

  // Aufräumen: was dieser Lauf geschrieben hat, gehört nicht in den Bestand.
  // zuruecksetzen() räumt Kanalnachrichten seit Schema 25 mit weg — hier wird
  // nachgesehen, ob das auch stimmt.
  await zuruecksetzen(seite);
  const rest = await ausDatenbank();
  pruefe(
    'Zurücksetzen räumt die eigenen Kanalnachrichten weg',
    rest.every((m) => m.from !== 'me'),
    `${rest.filter((m) => m.from === 'me').length} eigene Zeilen geblieben`
  );

  // Nicht "kein Fehler", sondern wie viele Prüfungen wirklich gelaufen sind —
  // siehe die Regel "grüne Tests beweisen nichts".
  console.log(`\n${gesamt - fehler} von ${gesamt} Pruefungen bestanden`);
  console.log('Konsolenfehler: ' + (browserFehler.length ? browserFehler.join(' | ') : 'keine'));

  await beenden(browser, fehler || browserFehler.length ? 1 : 0);
})();
