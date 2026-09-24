// Bildnachweis Website zu Kasten 3 (Feedback 21.09.2026, „Community-Chat vor
// Messenger"). Zwei Browser, zwei Testkonten — nie ein echtes Konto:
//
//   F  all.media.prueflauf@web.de  (@prueflauf)
//   E  test@all-media.app          (@test)
//
// Ablauf: F teilt ein Video an E -> landet unter Communitys -> beide schreiben
// -> F fragt nach dem Messenger -> E lehnt ab -> E fragt selbst -> F nimmt an
// -> Messenger. Zum Schluss Plus -> Kontakt hinzufügen per Nummer.
//
// Kein /api/reset: das würde fremde Prüfläufe stören. Vorher und nachher
// räumt der Aufrufer mit k3_aufraeumen.sql die Zeilen zwischen beiden Konten weg.
//
// Start:  node test/_kasten3_bilder.js   (Server auf 3000, Gesamtlauf NICHT aktiv)

const path = require('path');
const { chromium } = require('playwright-core');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
const BILDER = path.join(__dirname, '..', '..', 'bilder', 'kasten3');
const F = { mail: 'all.media.prueflauf@web.de', pass: 'PruefLauf2026!' };
const E = { mail: 'test@all-media.app', pass: 'AllMedia2026!' };
// Feste Kennung von @test: im Teilen-Blatt stehen auch echte Konten, ein
// Treffer über den Namen könnte daneben greifen.
const E_ID = '3baafacd-bbdb-40fb-8ef4-a4e365ae00c4';

const ergebnisse = [];
const pruefe = (name, ok, zusatz = '') => {
  ergebnisse.push(Boolean(ok));
  console.log(`  ${ok ? 'OK  ' : 'FEHL'} ${name}${zusatz ? '  — ' + zusatz : ''}`);
};

async function seite(browser, zugang, fehler) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', (e) => fehler.push('JS-Fehler: ' + e.message));
  await page.goto(ZIEL, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
  await page.evaluate(() => window.Anmeldung.bereit?.catch(() => null));
  const an = await page.evaluate(({ mail, pass }) => window.Anmeldung.anmelden(mail, pass), zugang);
  if (!an.ok) throw new Error('Anmeldung ' + zugang.mail + ': ' + an.fehler);
  await neu(page);
  return page;
}

async function neu(page) {
  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await page.waitForSelector('[data-area]', { timeout: 20000 });
  await page.waitForTimeout(1200);
}

const bild = (page, name) => page.screenshot({ path: path.join(BILDER, name + '.png') });

async function communityChats(page) {
  await page.click('[data-area="communities"]');
  await page.click('#topbar [data-sub="chats"]');
  await page.waitForTimeout(500);
}

async function chatOeffnen(page, name) {
  await communityChats(page);
  await page.click(`[data-chat]:has-text("${name}")`);
  await page.waitForSelector('#msgInput');
  await page.waitForTimeout(500);
}

// Gewartet wird, bis die Nachricht in der Datenbank steht — nicht auf die
// Uhr. Verschlüsselt dauert das Senden mal eine, mal drei Sekunden, und wer
// vorher neu lädt, sieht den alten Stand (so am 24.09.2026 passiert).
async function schreiben(page, text) {
  const vorher = await nachrichtenZahl(page);
  await page.fill('#msgInput', text);
  await page.click('#sendBtn');
  for (let i = 0; i < 30 && (await nachrichtenZahl(page)) <= vorher; i++) await page.waitForTimeout(500);
}

const nachrichtenZahl = (page) =>
  page.evaluate(async () => {
    const client = await window.Anmeldung.aufbauen();
    const { count } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('sender_id', window.Anmeldung.nutzer().id);
    return count || 0;
  });

const leiste = (page) => page.locator('.anfrage__text').allInnerTexts().then((t) => t.join(' '));

// Nach einem Knopf lädt die Seite alles neu (bootstrap) — das dauert
// unterschiedlich lange. Gewartet wird auf den Text, der dann dastehen muss.
const leisteZeigt = (page, muster) =>
  page
    .waitForFunction(
      (quelle) => [...document.querySelectorAll('.anfrage__text')].some((n) => new RegExp(quelle).test(n.textContent)),
      muster.source,
      { timeout: 15000 }
    )
    .catch(() => {});

(async () => {
  const browser = await chromium.launch();
  const fehler = [];
  try {
    const f = await seite(browser, F, fehler);
    const e = await seite(browser, E, fehler);

    console.log('\n3.1 Teilen aus Videos landet unter Communitys');
    await f.click('[data-area="videos"]');
    await f.waitForTimeout(800);
    await f.click('[data-paction="share"], [data-vaction="share"]');
    await f.waitForSelector('[data-teilen]');
    await f.waitForTimeout(900);
    const kachel = f.locator(`[data-teilen="${E_ID}"]`);
    pruefe('Genau eine Kachel für @test', (await kachel.count()) === 1);
    const bereich = await kachel.getAttribute('data-bereich').catch(() => null);
    pruefe('Im Teilen-Blatt trägt @test das Community-Abzeichen', bereich === 'community', String(bereich));
    await bild(f, '01-web-teilen-blatt');
    await kachel.click();
    // Auf die Bestätigung warten, nicht auf eine feste Zeit: am 24.09.2026
    // brauchte der Server nach einem Neustart knapp 4 s, das Neuladen danach
    // kam zu früh und die Liste war noch leer.
    const beginn = Date.now();
    const geteilt = await f
      .waitForSelector(`[data-teilen="${E_ID}"].is-gesendet`, { timeout: 15000 })
      .then(() => true, () => false);
    pruefe('Teilen bestätigt', geteilt, `${Date.now() - beginn} ms`);
    await bild(f, '02-web-geteilt');
    await f.click('[data-sheet-close]').catch(() => {});

    await neu(f);
    await communityChats(f);
    const inComm = await f.locator('[data-chat]', { hasText: /Test Nutzer/ }).count();
    pruefe('Der Chat steht unter Communitys → Chats', inComm >= 1);
    await bild(f, '03-web-communitys-chats');
    await f.click('[data-area="messenger"]');
    await f.waitForTimeout(600);
    const inMess = await f.locator('[data-chat]', { hasText: /Test Nutzer/ }).count();
    pruefe('Im Messenger steht er nicht', inMess === 0, String(inMess));
    await bild(f, '04-web-messenger-ohne');

    console.log('\n3.3 Kein automatischer Eintrag beim anderen');
    await neu(e);
    await e.click('[data-area="messenger"]');
    await e.waitForTimeout(600);
    const beiE = await e.locator('[data-chat]', { hasText: /Prüfname/i }).count();
    pruefe('Beim Empfänger taucht F nicht im Messenger auf', beiE === 0, String(beiE));
    await bild(e, '05-web-empfaenger-messenger-ohne');

    console.log('\n3.2 Anfrage nach etwas Austausch');
    await chatOeffnen(e, 'Prüfname');
    await schreiben(e, 'Danke fürs Video!');
    await neu(f);
    await chatOeffnen(f, 'Test Nutzer');
    let text = await leiste(f);
    pruefe('Nach dem Austausch bietet die Leiste die Anfrage an', /Messenger wechselt/.test(text));
    await bild(f, '06-web-anfrage-angeboten');
    await f.click('[data-messenger="fragen"]');
    await leisteZeigt(f, /Anfrage an .* läuft/);
    text = await leiste(f);
    pruefe('Danach: Anfrage läuft', /Anfrage an .* läuft/.test(text), text.slice(0, 80));
    await bild(f, '07-web-anfrage-gesendet');

    await neu(e);
    await chatOeffnen(e, 'Prüfname');
    text = await leiste(e);
    pruefe('Beim Empfänger: Annehmen/Ablehnen', /möchte mit dir in den Messenger/.test(text));
    await bild(e, '08-web-anfrage-eingegangen');
    await e.click('[data-messenger="nein"]');
    await e.waitForSelector('[data-messenger="nein"]', { state: 'detached', timeout: 15000 }).catch(() => {});
    await neu(e);
    await e.click('[data-area="messenger"]');
    await e.waitForTimeout(600);
    pruefe('Abgelehnt: kein Messenger-Eintrag', (await e.locator('[data-chat]', { hasText: /Prüfname/i }).count()) === 0);
    await communityChats(e);
    pruefe('Abgelehnt: der Community-Chat bleibt', (await e.locator('[data-chat]', { hasText: /Prüfname/i }).count()) >= 1);
    await bild(e, '09-web-abgelehnt-bleibt-community');

    await neu(f);
    await chatOeffnen(f, 'Test Nutzer');
    text = await leiste(f);
    pruefe('Der Fragende sieht die Absage', /bleibt lieber hier unter Communitys/.test(text));
    await schreiben(f, 'Alles gut, dann hier.');
    // Die Blase kommt erst mit der Antwort des Servers, und der entschlüsselt
    // vorher den ganzen Verlauf neu — in der Datenbank steht sie früher.
    const blase = await f
      .waitForSelector('text=Alles gut, dann hier.', { timeout: 15000 })
      .then(() => true, () => false);
    pruefe('… und schreibt weiter', blase);
    await bild(f, '10-web-absage-weiterschreiben');

    await neu(e);
    await chatOeffnen(e, 'Prüfname');
    await e.click('[data-messenger="fragen"]');
    await leisteZeigt(e, /Anfrage an .* läuft/);
    await neu(f);
    await chatOeffnen(f, 'Test Nutzer');
    await f.click('[data-messenger="ja"]');
    await leisteZeigt(f, /im Messenger verbunden/);
    text = await leiste(f);
    pruefe('Angenommen: Leiste führt in den Messenger', /im Messenger verbunden/.test(text), text.slice(0, 80));
    await bild(f, '11-web-angenommen');
    await f.click('[data-messenger="oeffnen"]');
    await f.waitForTimeout(1500);
    await bild(f, '12-web-messenger-chat');
    await neu(f);
    await f.click('[data-area="messenger"]');
    await f.waitForTimeout(600);
    pruefe('Jetzt steht der Chat im Messenger', (await f.locator('[data-chat]', { hasText: /Test Nutzer/ }).count()) >= 1);
    await bild(f, '13-web-messenger-liste');

    console.log('\n3.4 Plus → Telefonnummer → Kontakt');
    // Die angenommene Anfrage hat @prueflauf schon zum Kontakt gemacht. Damit
    // das Bild echtes Hinzufügen zeigt, nimmt @test den eigenen Eintrag weg.
    const weg = await e.evaluate(async () => {
      const client = await window.Anmeldung.aufbauen();
      const ich = window.Anmeldung.nutzer().id;
      const { data } = await client.from('contacts').delete().eq('user_id', ich).neq('contact_id', ich)
        .in('contact_id', (await client.from('profiles').select('id').eq('handle', '@prueflauf')).data.map((p) => p.id))
        .select('contact_id');
      return (data || []).length;
    });
    pruefe('Vorher: @prueflauf aus den Kontakten von @test genommen', weg === 1, String(weg));
    await neu(e);
    await e.click('[data-area="messenger"]');
    await e.click('#newChat');
    await e.waitForTimeout(400);
    await bild(e, '14-web-plus-blatt');
    await e.click('[data-new="contact"]');
    // Erst eine Nummer ohne Konto. In der App lag diese Meldung bis zum
    // 24.09.2026 unsichtbar hinter dem Blatt, auf der Website halbdurchsichtig
    // über dem Knopf. Jetzt steht sie im Blatt — gezählt wird, ob sie dort
    // obenauf liegt, nicht nur, ob sie im DOM steht.
    await e.fill('#contactHandle', '+49 151 9900999');
    await e.click('#contactAdd');
    const obenauf = await e.waitForSelector('#contactFehler:not([hidden])', { timeout: 8000 })
      .then(() => e.evaluate(() => {
        const t = document.querySelector('#contactFehler');
        const r = t.getBoundingClientRect();
        const oben = document.elementFromPoint(r.left + 20, r.top + r.height / 2);
        return { text: t.innerText, sichtbar: !!oben && t.contains(oben) };
      }), () => ({ text: '', sichtbar: false }));
    pruefe('Unbekannte Nummer: Hinweis sichtbar im Blatt',
      obenauf.sichtbar && /kein Konto/.test(obenauf.text), JSON.stringify(obenauf));
    await bild(e, '15a-web-unbekannte-nummer');
    await e.fill('#contactHandle', '+49 151 9900110');
    pruefe('Neue Eingabe räumt den Hinweis weg', await e.locator('#contactFehler').isHidden());
    await bild(e, '15-web-nummer-eingeben');
    await e.click('#contactAdd');
    await e.waitForTimeout(2000);
    await bild(e, '16-web-kontakt-angelegt');
    const toastText = await e.locator('.toast').allInnerTexts().then((t) => t.join(' ')).catch(() => '');
    pruefe('Nummer führt zum Kontakt (Rückmeldung)', toastText && !/nicht|Fehler|kommen über|bereits/i.test(toastText), toastText);
    const drin = await e.evaluate(async () => {
      const client = await window.Anmeldung.aufbauen();
      const { data } = await client.from('contacts').select('herkunft, profiles!contacts_contact_id_fkey(handle)').eq('user_id', window.Anmeldung.nutzer().id);
      return (data || []).filter((k) => k.profiles?.handle === '@prueflauf').map((k) => k.herkunft);
    });
    pruefe('Der Kontakt steht in der Datenbank, Herkunft Nummer', drin.length === 1 && drin[0] === 'nummer', JSON.stringify(drin));
  } catch (err) {
    pruefe('Ablauf ohne Abbruch', false, err.message);
  } finally {
    for (const f of fehler) console.log('  ' + f);
    const schlecht = ergebnisse.filter((x) => !x).length;
    console.log(`\n${ergebnisse.length - schlecht} von ${ergebnisse.length} Prüfung(en) bestanden.`);
    await browser.close();
    process.exit(schlecht || fehler.length ? 1 : 0);
  }
})();
