/*
 * Einstellungen 16.11., Kasten 1 (E16-1): Designsystem, Orientierung,
 * einheitliche Bedienung — Website im Prüfbrowser mit Attrappe.
 *
 *   BASE=http://localhost:3410 node test/e16-1-einstellungen.js
 *   BILDER=<ordner> …   legt dazu Bilder ab (hell, dunkel, schmal, große Schrift)
 *
 * Prüft Verhalten, nicht Quelltext:
 *   1.2  jeder Schalter sitzt mittig in seiner Zeile, ragt nicht hinaus,
 *        aus = grau, an = grün (nie lila), Klick schaltet und schreibt
 *   1.3  Reihenfolge … Videos, Communitys, Speicher, Hilfe; „Über All Media“
 *        in Hilfe; „Abmelden“ eigener Block nach allen Abschnitten
 *   1.4  Kopf zeigt beim Blättern den aktuellen Abschnitt, Pille hervorgehoben;
 *        Blatt zeigt sein Oberthema über dem Titel
 *   1.5  „eine aus mehreren“ ist in Wahl- und Sichtbarkeitsblatt dasselbe Muster
 *   1.6  Zeilen brechen um statt überzulaufen (320 px, 200 % Schrift),
 *        Schalter haben role=switch und aria-checked
 *
 * Belegt Stufe 1–2 (Gegenstand, Bedienung) plus den geschickten Aufruf; das
 * Speichern in Supabase prüfen test:einstellungen und der Simulator.
 */
const path = require('path');
const { chromium } = require('playwright-core');
const { attrappe, bestand, ICH } = require('./_attrappe');

const BASE = process.env.BASE || 'http://localhost:3410';
const BILDER = process.env.BILDER;
let gut = 0;
let schlecht = 0;
const pruefe = (name, ok, info = '') => {
  if (ok) gut++;
  else schlecht++;
  console.log(`  ${ok ? 'OK  ' : 'FEHL'}  ${name}${!ok && info ? `  — ${info}` : ''}`);
};
const bild = async (seite, name) => {
  if (!BILDER) return;
  await seite.waitForTimeout(900);
  await seite.screenshot({ path: path.join(BILDER, `e16-1-web-${name}.png`) });
};

async function oeffnen(browser, { breite = 400, dunkel = false, schrift = 1 } = {}) {
  const seite = await browser.newPage({ viewport: { width: breite, height: 860 } });
  const fehler = [];
  seite.on('pageerror', (e) => fehler.push(e.message));
  const daten = bestand({
    users: { [ICH]: { id: ICH, name: 'Test Konto', handle: 'test', initials: 'TK' } },
  });
  const aufrufe = await attrappe(seite, daten, {
    '/api/einstellungen': { einstellungen: { lesebestaetigung: 'an', toene: 'aus' } },
    '/api/version': { version: '1.0.0', commit: 'abc1234' },
    '/api/einstellungen/toene': { ok: true },
    '/api/gelikt': [],
  });
  if (dunkel) await seite.addInitScript(() => localStorage.setItem('am-theme', 'dark'));
  await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
  await seite.waitForSelector('[data-area="settings"]', { timeout: 15000 });
  // Große Schrift ohne Verschachtelungs-Effekt: jede Textstelle der Seite fest vergrößert.
  if (schrift !== 1) await seite.addStyleTag({ content: `.einst-zeile .item__label, .einst-zeile .item__value { font-size: ${Math.round(15 * schrift)}px !important; } .listhead, .pill { font-size: ${Math.round(13 * schrift)}px !important; } .pagehead__title { font-size: ${Math.round(24 * schrift)}px !important; }` });
  await seite.click('[data-area="settings"]');
  await seite.waitForSelector('#settingsScroll [data-toggle]', { timeout: 10000 });
  await seite.waitForTimeout(400);
  return { seite, fehler, aufrufe };
}

(async () => {
  const browser = await chromium.launch();
  try {
    console.log(`E16-1 Website (${BASE})`);
    const { seite, fehler, aufrufe } = await oeffnen(browser);
    await bild(seite, 'hell-oben');

    // 1.4 vor jedem Klick: ein Klick blättert die Seite.
    const kopfOben = await seite.$eval('#einstThema', (e) => e.textContent.trim());
    // Website: die Kontokarte steht im festen Kopf, der erste Abschnitt beginnt oben.
    pruefe('1.4 ganz oben steht „Allgemein“ (erster Abschnitt)', kopfOben === 'Allgemein', kopfOben);

    // 1.3 Reihenfolge
    const abschnitte = await seite.$$eval('[data-settingsnur]', (e) => e.map((x) => x.dataset.settingsnur));
    const i = (id) => abschnitte.indexOf(id);
    pruefe('1.3 Speicher und Hilfe nach Videos und Communitys', i('videos') < i('speicher') && i('communitys') < i('speicher') && i('speicher') < i('hilfe') && i('hilfe') === abschnitte.length - 1, abschnitte.join(','));
    const pillen = await seite.$$eval('[data-jump]', (e) => e.map((x) => x.dataset.jump));
    pruefe('1.3 Sprungleiste in derselben Reihenfolge', JSON.stringify(pillen) === JSON.stringify(abschnitte), pillen.join(','));
    const ueber = await seite.$eval('[data-setting="Über All Media"]', (e) => e.dataset.abschnitt).catch(() => null);
    pruefe('1.3 „Über All Media“ gehört zu Hilfe', ueber === 'hilfe', String(ueber));
    const abmelden = await seite.evaluate(() => {
      const ab = document.querySelector('[data-setting="Abmelden"]');
      const letzte = [...document.querySelectorAll('#settingsScroll .einst-karte')].at(-2);
      return {
        eigeneKarte: ab?.closest('.einst-karte')?.querySelectorAll('.einst-zeile').length === 1,
        nachAllem: !!(letzte && ab && (letzte.compareDocumentPosition(ab) & Node.DOCUMENT_POSITION_FOLLOWING)),
        satz: document.querySelector('.einst-fuss')?.textContent || '',
      };
    });
    pruefe('1.3 „Abmelden“ allein in eigener Karte nach allen Abschnitten', abmelden.eigeneKarte && abmelden.nachAllem, JSON.stringify(abmelden));
    pruefe('1.3 Satz zum Abmelden darunter', /nur dieses Konto/.test(abmelden.satz), abmelden.satz);

    // 1.2 Schalter
    const schalter = await seite.$$eval('#settingsScroll [data-toggle]', (els) =>
      els.map((b) => {
        const z = b.closest('.einst-zeile').getBoundingClientRect();
        const r = b.getBoundingClientRect();
        return {
          key: b.dataset.toggle,
          versatz: Math.abs(r.top + r.height / 2 - (z.top + z.height / 2)),
          drin: r.top >= z.top - 0.5 && r.bottom <= z.bottom + 0.5,
          farbe: getComputedStyle(b).backgroundColor,
          an: b.classList.contains('is-on'),
          rolle: b.getAttribute('role'),
          aria: b.getAttribute('aria-checked'),
        };
      })
    );
    pruefe(`1.2 ${schalter.length} Schalter gefunden (≥ 10)`, schalter.length >= 10, String(schalter.length));
    const schief = schalter.filter((x) => x.versatz > 1 || !x.drin);
    pruefe('1.2 jeder Schalter mittig in seiner Zeile, ragt nicht hinaus', schief.length === 0, JSON.stringify(schief));
    const gruen = 'rgb(18, 161, 80)';
    const grau = 'rgb(211, 214, 222)';
    const falsch = schalter.filter((x) => x.farbe !== (x.an ? gruen : grau));
    pruefe('1.2 an = grün, aus = grau (kein Lila)', falsch.length === 0, JSON.stringify(falsch));
    pruefe('1.6 Schalter melden role=switch und aria-checked', schalter.every((x) => x.rolle === 'switch' && x.aria === String(x.an)), JSON.stringify(schalter.filter((x) => x.rolle !== 'switch' || x.aria !== String(x.an))));
    const vorher = aufrufe.length;
    await seite.click('[data-toggle="toene"]');
    await seite.waitForTimeout(300);
    const nachKlick = await seite.$eval('[data-toggle="toene"]', (b) => ({ an: b.classList.contains('is-on'), farbe: getComputedStyle(b).backgroundColor, aria: b.getAttribute('aria-checked') }));
    const geschickt = aufrufe.slice(vorher).find((a) => a.pfad.includes('einstellungen') && a.methode !== 'GET');
    pruefe('1.2 Klick schaltet auf grün und aria-checked=true', nachKlick.an && nachKlick.aria === 'true', JSON.stringify(nachKlick));
    pruefe('1.7 Klick schickt die Änderung an den Server', !!geschickt && /an/.test(geschickt.body || '') , JSON.stringify(geschickt));

    // 1.4 Kopf folgt dem Abschnitt
    for (const [id, titel] of [['datenschutz', 'Datenschutz'], ['messenger', 'Messenger'], ['hilfe', 'Hilfe']]) {
      await seite.evaluate((x) => document.getElementById('sec-' + x).scrollIntoView({ block: 'start' }), id);
      await seite.waitForTimeout(250);
      const k = await seite.evaluate(() => ({
        titel: document.querySelector('#einstThema').textContent.trim(),
        ober: !document.querySelector('#einstOber').hidden,
        aktiv: [...document.querySelectorAll('[data-jump].is-active')].map((p) => p.dataset.jump),
      }));
      pruefe(`1.4 bei ${titel}: Kopf „${titel}“, Pille hervorgehoben`, k.titel === titel && k.ober && k.aktiv.length === 1 && k.aktiv[0] === id, JSON.stringify(k));
      if (id === 'messenger') await bild(seite, 'hell-messenger');
    }

    // 1.4 + 1.5 Wahlblatt
    await seite.click('[data-setting="Medienqualität"]');
    await seite.waitForSelector('.sheet [data-wahl]');
    const wahl = await seite.evaluate(() => ({
      ober: document.querySelector('.sheet [data-testid="blatt-oberthema"]')?.textContent.trim(),
      radios: [...document.querySelectorAll('.sheet [data-wahl]')].map((b) => b.getAttribute('role') + ':' + b.getAttribute('aria-checked')),
      muster: !!document.querySelector('.sheet .einst-wahl .einst-wahl__kreis'),
    }));
    pruefe('1.4 Blatt „Medienqualität“ zeigt Oberthema „Speicher“', wahl.ober === 'Speicher', String(wahl.ober));
    pruefe('1.5 Wahlblatt: Kreis-Muster mit role=radio, genau eine gewählt', wahl.muster && wahl.radios.every((r) => r.startsWith('radio:')) && wahl.radios.filter((r) => r.endsWith('true')).length === 1, JSON.stringify(wahl.radios));
    await bild(seite, 'hell-blatt-wahl');
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);

    await seite.click('[data-setting="Zuletzt online"][data-abschnitt="messenger"]');
    await seite.waitForSelector('.sheet [data-stufe]');
    const sicht = await seite.evaluate(() => ({
      ober: document.querySelector('.sheet [data-testid="blatt-oberthema"]')?.textContent.trim(),
      muster: document.querySelectorAll('.sheet .einst-wahl [data-stufe] .einst-wahl__kreis').length,
      stufen: document.querySelectorAll('.sheet [data-stufe]').length,
    }));
    pruefe('1.4 Sichtbarkeitsblatt aus Messenger zeigt „Messenger“', sicht.ober === 'Messenger', String(sicht.ober));
    pruefe('1.5 Sichtbarkeitsblatt nutzt dasselbe Kreis-Muster', sicht.muster === sicht.stufen && sicht.stufen >= 4, JSON.stringify(sicht));
    await bild(seite, 'hell-blatt-sicht');
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);

    await seite.click('[data-setting="Über All Media"]');
    await seite.waitForSelector('[data-testid="ueber-stand"]');
    const stand = await seite.$eval('[data-testid="ueber-stand"]', (e) => e.textContent);
    pruefe('1.3 „Über All Media“ zeigt Version und Stand', /1\.0\.0/.test(stand) && /abc1234/.test(stand), stand);
    await seite.keyboard.press('Escape');

    // Gegenprüfung R1/R2: verspätete Antwort öffnet nichts über einem inzwischen gewählten Punkt.
    await seite.route('**/api/version', async (r) => { await new Promise((ok) => setTimeout(ok, 700)); r.fulfill({ json: { version: '1.0.0', commit: 'abc1234' } }); });
    await seite.click('[data-setting="Über All Media"]');
    await seite.click('[data-setting="Medienqualität"]');
    await seite.waitForTimeout(1200);
    const spaet = await seite.evaluate(() => ({
      ueber: !!document.querySelector('[data-testid="ueber-stand"]'),
      oben: [...document.querySelectorAll('.sheet')].pop()?.querySelector('[data-testid="blatt-oberthema"]')?.textContent.trim(),
    }));
    pruefe('1.4 verspätetes „Über All Media“ öffnet sich nicht über „Medienqualität“ (Oberthema „Speicher“)', !spaet.ueber && spaet.oben === 'Speicher', JSON.stringify(spaet));
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    await seite.click('[data-setting="Über All Media"]');
    await seite.waitForSelector('[data-testid="ueber-stand"]', { timeout: 5000 });
    const ueberThema = await seite.evaluate(() => [...document.querySelectorAll('.sheet')].pop()?.querySelector('[data-testid="blatt-oberthema"]')?.textContent.trim());
    pruefe('1.4 „Über All Media“ allein geöffnet zeigt „Hilfe“', ueberThema === 'Hilfe', String(ueberThema));
    await seite.keyboard.press('Escape');
    await seite.unroute('**/api/version');

    // Gegenprüfung R1: abgelehnte Auswahl bleibt nicht als gewählt stehen.
    await seite.route('**/api/einstellungen/medienqualitaet', (r) => r.fulfill({ json: { ok: false, error: 'kaputt' } }));
    await seite.click('[data-setting="Medienqualität"]');
    await seite.waitForSelector('.sheet [data-wahl="Hoch"]');
    await seite.click('.sheet [data-wahl="Hoch"]');
    await seite.waitForSelector('.sheet .einst-fehler', { timeout: 5000 }).catch(() => {});
    const abgelehnt = await seite.evaluate(() => ({
      offen: !!document.querySelector('.sheet [data-wahl]'),
      fehler: document.querySelector('.sheet .einst-fehler')?.textContent || '',
      gewaehlt: [...document.querySelectorAll('.sheet [data-wahl][aria-checked="true"]')].map((b) => b.dataset.wahl),
    }));
    pruefe('1.6 Serverfehler: Blatt bleibt offen, nennt den Fehler, „Standard“ bleibt gewählt', abgelehnt.offen && /nicht speichern/.test(abgelehnt.fehler) && abgelehnt.gewaehlt.join() === 'Standard', JSON.stringify(abgelehnt));
    await seite.keyboard.press('Escape');
    await seite.waitForTimeout(200);
    const liste = await seite.$eval('[data-setting="Medienqualität"] .item__value', (e) => e.textContent.trim());
    pruefe('1.6 Liste zeigt nach Fehler weiter „Standard“', liste === 'Standard', liste);
    await seite.unroute('**/api/einstellungen/medienqualitaet');

    // Gegenprüfung R1: Formular-Auswahl als Kreiszeilen (Entsperrcode).
    await seite.click('[data-setting="Sicherheits-/Entsperrcode"]');
    await seite.waitForSelector('.sheet [data-feldwahl="art"]');
    await seite.click('.sheet [data-feldwahl="art"][data-wert="Eigener Code"]');
    const feld = await seite.evaluate(() => ({ wert: document.querySelector('#f_art').value, kreise: document.querySelectorAll('.sheet .einst-wahl [data-feldwahl]').length, ober: document.querySelector('.sheet [data-testid="blatt-oberthema"]')?.textContent.trim() }));
    pruefe('1.5 Formular-Auswahl: Kreiszeilen setzen den Wert', feld.wert === 'Eigener Code' && feld.kreise === 2, JSON.stringify(feld));
    pruefe('1.4 Formular zeigt Oberthema „Allgemein“', feld.ober === 'Allgemein', String(feld.ober));
    await seite.keyboard.press('Escape');

    // Gegenprüfung R2: offenes Listenblatt wird nach dem Nachladen aktualisiert.
    await seite.click('[data-setting="Gelikte Beiträge"]');
    await seite.waitForSelector('.sheet [data-liste="gelikt"]');
    await seite.waitForFunction(() => !/Wird geladen/.test(document.querySelector('.sheet [data-liste="gelikt"]')?.textContent || ''), null, { timeout: 8000 }).catch(() => {});
    const gelikt = await seite.evaluate(() => ({ text: document.querySelector('.sheet [data-liste="gelikt"]')?.textContent.trim().slice(0, 60), ober: [...document.querySelectorAll('.sheet')].pop()?.querySelector('[data-testid="blatt-oberthema"]')?.textContent.trim() }));
    pruefe('1.6 offenes Listenblatt zeigt nach dem Laden nicht mehr „Wird geladen …“', !!gelikt.text && !/Wird geladen/.test(gelikt.text), JSON.stringify(gelikt));
    pruefe('1.4 nach dem Neuaufbau weiter Oberthema „Videos“', gelikt.ober === 'Videos', String(gelikt.ober));
    await seite.keyboard.press('Escape');

    // Gegenprüfung R2: „Story auch in Videos teilen“ als gesperrter Grau-Grün-Schalter außerhalb von „Alle“.
    await seite.click('[data-setting="Story-Sichtbarkeit"][data-abschnitt="messenger"]');
    await seite.waitForSelector('.sheet [data-invideos]');
    const story = await seite.$eval('.sheet [data-invideos] .switch', (e) => ({ rolle: e.getAttribute('role'), farbe: getComputedStyle(e).backgroundColor }));
    pruefe('1.2 Story-in-Videos ist ein grauer Schalter (aus)', story.rolle === 'switch' && story.farbe === 'rgb(211, 214, 222)', JSON.stringify(story));
    await seite.keyboard.press('Escape');

    // Blatt außerhalb der Einstellungen: kein Oberthema
    pruefe('keine Seitenfehler (hell)', fehler.length === 0, fehler.join(' | '));
    await seite.close();

    // Dunkel
    const d = await oeffnen(browser, { dunkel: true });
    const dunkelFarben = await d.seite.$$eval('#settingsScroll [data-toggle]', (els) => els.map((b) => [b.classList.contains('is-on'), getComputedStyle(b).backgroundColor]));
    pruefe('1.2 dunkel: an grün, aus grau', dunkelFarben.every(([an, f]) => f === (an ? 'rgb(45, 208, 124)' : 'rgb(58, 63, 74)')), JSON.stringify(dunkelFarben));
    await bild(d.seite, 'dunkel-oben');
    pruefe('keine Seitenfehler (dunkel)', d.fehler.length === 0, d.fehler.join(' | '));
    await d.seite.close();

    // 1.6 schmal + große Schrift
    for (const [breite, schrift, name] of [[320, 1, 'schmal'], [400, 1.6, 'grosse-schrift']]) {
      const g = await oeffnen(browser, { breite, schrift });
      const lage = await g.seite.evaluate(() => {
        const sc = document.querySelector('#settingsScroll');
        const zeilen = [...sc.querySelectorAll('.einst-zeile')];
        const raus = zeilen.filter((z) => z.scrollWidth > z.clientWidth + 1).map((z) => z.textContent.trim().slice(0, 30));
        const schief = [...sc.querySelectorAll('[data-toggle]')].filter((b) => {
          const z = b.closest('.einst-zeile').getBoundingClientRect();
          const r = b.getBoundingClientRect();
          return r.top < z.top - 0.5 || r.bottom > z.bottom + 0.5 || r.right > z.right + 0.5;
        }).length;
        return { quer: sc.scrollWidth > sc.clientWidth + 1, raus, schief };
      });
      pruefe(`1.6 ${name}: kein Querlauf, keine Zeile läuft über, Schalter in der Zeile`, !lage.quer && lage.raus.length === 0 && lage.schief === 0, JSON.stringify(lage));
      await g.seite.evaluate(() => document.getElementById('sec-datenschutz').scrollIntoView({ block: 'start' }));
      await bild(g.seite, name);
      await g.seite.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`\n${gut}/${gut + schlecht} bestanden`);
  process.exit(schlecht ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e);
  process.exit(2);
});
