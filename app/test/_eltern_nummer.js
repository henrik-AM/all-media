/**
 * Den Elternteil über die Telefonnummer finden — auf der Website (Schema 58).
 *
 * WARUM ES DAS GIBT
 *
 * Henrik am 26.09.2026: Das Eltern-Konto wird nie über den @-Namen gesucht —
 * das ist der Weg der Videospalte, zu Fremden. Eltern und Kinder haben die
 * Nummer des anderen, also immer über die Telefonnummer.
 *
 * test/_minderjaehrig.js prüft die Datenbank. Hier geht es um die drei Stellen,
 * an denen ein Mensch die Nummer eintippt oder sieht:
 *
 *   1. Registrieren, unter der Altersgrenze: das Feld fragt nach der Nummer,
 *      ein @-Name, eine fremde und die eigene Nummer werden abgewiesen.
 *      Mit einer gültigen Nummer ginge die Registrierung los — deshalb hört
 *      die Prüfung vorher auf.
 *   2. Die Warteseite des Kindes: dort fragt es mit der Nummer an.
 *   3. Das Zustimmungsblatt beim Elternteil: es zeigt die Nummer des Kindes.
 *   4. Die Einstellung „Alter und Erziehungsberechtigte/r" (/api/alter).
 *
 * Das Kind entsteht per SQL wie in _minderjaehrig.js und wird am Ende
 * gelöscht. Elternteil ist das Prüfkonto, nicht @test — @test gehört dem
 * Simulator.
 *
 * Start:  SUPABASE_TOKEN=… node test/_eltern_nummer.js
 *         BILDER=1 legt Belegbilder in bilder/eltern-nummer/ ab.
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { frage } = require('./_aufraeumen');
const { schliesse } = require('./_konto');
const Telefon = require('../../gemeinsam/telefon');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
const BILDER = process.env.BILDER ? path.join(__dirname, '..', '..', 'bilder', 'eltern-nummer') : null;

const PRUEFER = {
  email: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  passwort: process.env.AM_TEST_PASS || 'PruefLauf2026!',
};

const KENNUNG = Date.now().toString(36);
const KIND_MAIL = `pruef.kind.web.${KENNUNG}@example.com`;
const PASSWORT = 'KindPruef2026!';

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const sql = (text) => `'${String(text).replace(/'/g, "''")}'`;
const nummer = (i) => `+49 1${String(Date.now()).slice(-8)}${i}`;

function geborenVor(jahre) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - jahre);
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
}

async function bild(page, name) {
  if (!BILDER) return;
  fs.mkdirSync(BILDER, { recursive: true });
  await page.screenshot({ path: path.join(BILDER, name + '.png') });
}

async function seiteAngemeldet(browser, mail, passwort) {
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  await page.goto(ZIEL, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
  await page.evaluate(() => window.Anmeldung.bereit?.catch(() => null));
  const an = await page.evaluate(([m, p]) => window.Anmeldung.anmelden(m, p), [mail, passwort]);
  if (!an.ok) throw new Error(`${mail}: ${an.fehler}`);
  await page.reload({ waitUntil: 'load' });
  return page;
}

/** Text im Kontoblatt, nach dem letzten Klick auf den Hauptknopf. */
async function kontoKlick(page) {
  const vorher = await page.locator('.sheet').last().innerText();
  await page.click('#kontoOk');
  // Erst wenn der Knopf nicht mehr „… wird erstellt…" zeigt, steht die Antwort da.
  await page
    .waitForFunction(
      (v) => {
        const knopf = document.querySelector('#kontoOk');
        const text = document.querySelectorAll('.sheet');
        const jetzt = text[text.length - 1]?.innerText;
        return knopf && !knopf.disabled && !/…$/.test(knopf.textContent.trim()) && jetzt !== v;
      },
      vorher,
      { timeout: 15000 }
    )
    .catch(() => {});
  await page.waitForTimeout(300);
  return page.locator('.sheet').last().innerText();
}

(async () => {
  if (!process.env.SUPABASE_TOKEN) {
    console.error('FEHLER  SUPABASE_TOKEN fehlt — das Kinderkonto entsteht per SQL.');
    process.exit(1);
  }

  const [pruefer] = await frage(`select id, handle, phone from public.profiles where id =
    (select id from auth.users where email = ${sql(PRUEFER.email)})`);
  const elternNational = '0' + Telefon.vergleichsform(pruefer.phone).replace(/^49/, '');

  const browser = await chromium.launch();
  try {
    console.log('\n1. Registrieren unter der Altersgrenze');

    const neu = await browser.newPage({ viewport: { width: 430, height: 900 } });
    await neu.goto(ZIEL, { waitUntil: 'load' });
    await neu.waitForFunction(() => typeof openKontoWechsel === 'function' && Boolean(window.Anmeldung));
    await neu.evaluate(() => openKontoWechsel());
    await neu.click('[data-konto-neu="neu"]');
    await neu.fill('#kontoBenutzer', 'pruefneu' + KENNUNG);
    await neu.fill('#kontoPass', PASSWORT);
    await kontoKlick(neu);
    const eigeneNummer = nummer(1);
    await neu.fill('#kontoMail', `pruef.kind.neu.${KENNUNG}@example.com`);
    await neu.fill('#kontoTelefon', eigeneNummer);
    await neu.fill('#kontoGeburt', geborenVor(12));
    await neu.locator('#kontoGeburt').dispatchEvent('change');

    const feld = neu.locator('#kontoElternFeld');
    pruefe('unter 16 erscheint das Feld für den Elternteil', await feld.isVisible());
    pruefe(
      '… und fragt nach der Telefonnummer',
      /Telefonnummer deines Elternteils/.test(await feld.innerText()) &&
        (await neu.getAttribute('#kontoEltern', 'type')) === 'tel'
    );

    await neu.fill('#kontoEltern', pruefer.handle);
    let text = await kontoKlick(neu);
    pruefe('ein @-Name wird abgewiesen', /nicht den Benutzernamen/.test(text), text.split('\n').find((z) => /Benutzernamen/.test(z)));
    await bild(neu, '01-registrieren-name-abgewiesen');

    await neu.fill('#kontoEltern', '0151 ' + String(Date.now()).slice(-7));
    text = await kontoKlick(neu);
    pruefe('eine Nummer ohne Konto wird genannt', /Zu dieser Nummer gibt es bei All Media kein Konto/.test(text));

    await neu.fill('#kontoEltern', eigeneNummer);
    text = await kontoKlick(neu);
    pruefe('die eigene Nummer wird abgewiesen', /deine eigene Nummer/.test(text));
    await neu.close();

    console.log('\n2. Die Warteseite des Kindes');

    const kindNummer = nummer(2);
    await frage(`
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, email_change, email_change_token_new, recovery_token)
      values
        ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         ${sql(KIND_MAIL)}, crypt(${sql(PASSWORT)}, gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         ${sql(JSON.stringify({ handle: 'pruefkindweb' + KENNUNG, name: 'Prüfkind Web', phone: kindNummer, geburtsdatum: geborenVor(12) }))}::jsonb,
         now(), now(), '', '', '', '')`);

    const kind = await seiteAngemeldet(browser, KIND_MAIL, PASSWORT);
    await kind.waitForSelector('#freigabe', { timeout: 15000 });
    const eingabe = kind.locator('#freigabeEingabe');
    pruefe(
      'die Warteseite fragt nach der Telefonnummer',
      (await eingabe.getAttribute('placeholder')) === 'Telefonnummer deines Elternteils' &&
        (await eingabe.getAttribute('type')) === 'tel' &&
        /Telefonnummer/.test(await kind.locator('#freigabe').innerText())
    );
    await bild(kind, '02-warteseite');

    await eingabe.fill(pruefer.handle);
    await kind.click('#freigabeOk');
    await kind.waitForFunction(() => document.querySelector('#freigabeMeldung')?.textContent.trim(), null, { timeout: 10000 }).catch(() => {});
    const meldung = await kind.locator('#freigabeMeldung').innerText().catch(() => '');
    pruefe('ein @-Name wird abgewiesen, mit Grund', /nicht den Benutzernamen/.test(meldung), meldung);

    await kind.locator('#freigabeEingabe').fill(elternNational);
    await kind.click('#freigabeOk');
    await kind.waitForFunction(() => !document.querySelector('#freigabeEingabe'), null, { timeout: 15000 }).catch(() => {});
    const warten = await kind.locator('#freigabe').innerText().catch(() => '');
    pruefe(
      `mit der Nummer „${elternNational.slice(0, 5)} …" wartet es auf ${pruefer.handle}`,
      /Warte auf Zustimmung/i.test(warten) && warten.includes(pruefer.handle),
      warten.split('\n').slice(0, 2).join(' / ')
    );
    await bild(kind, '03-warteseite-angefragt');

    console.log('\n3. Das Zustimmungsblatt beim Elternteil');

    const eltern = await seiteAngemeldet(browser, PRUEFER.email, PRUEFER.passwort);
    await eltern.waitForSelector('#elternJa', { timeout: 20000 }).catch(() => {});
    const blatt = await eltern.locator('.sheet').last().innerText().catch(() => '');
    pruefe('das Blatt erscheint', /Zustimmung als Elternteil/.test(blatt));
    pruefe('… mit der Nummer des Kindes', blatt.includes(`Telefonnummer des Kontos: ${kindNummer}`), blatt.split('\n').find((z) => /Telefonnummer/.test(z)));
    await bild(eltern, '04-zustimmungsblatt');

    await eltern.click('#elternJa');
    await eltern.waitForSelector('#elternJa', { state: 'detached', timeout: 10000 }).catch(() => {});
    const [{ status }] = await frage(`select public.konto_stand(id) as status from auth.users where email = ${sql(KIND_MAIL)}`);
    pruefe('nach dem Zustimmen ist das Kind frei', status === 'frei', status);

    console.log('\n4. Einstellungen, „Alter und Erziehungsberechtigte/r"');

    // Derselbe Weg wie das Formular in den Einstellungen. Bis zum 26.09.2026
    // suchte er über den Benutzernamen und fand dabei nie jemanden.
    const alter = (guardian) =>
      kind.evaluate((g) => api('/api/alter', { geburtsdatum: '2014-05-01', guardian: g }), guardian);
    const perName = await alter(pruefer.handle);
    pruefe('ein @-Name wird abgewiesen', !perName.ok && /nicht den Benutzernamen/.test(perName.error), perName.error);
    const perNummer = await alter(elternNational);
    pruefe('die Nummer findet den Elternteil', perNummer.ok && perNummer.guardian === pruefer.id, perNummer.error || '');
  } catch (e) {
    fehler++;
    console.log('  FEHL ' + e.message);
  } finally {
    await schliesse(browser);
    const weg = await frage(`delete from auth.users where email like ${sql(`pruef.kind.%.${KENNUNG}@example.com`)} returning id`);
    console.log(`\n  (${Array.isArray(weg) ? weg.length : 0} Prüfkonto wieder gelöscht)`);
  }

  console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
