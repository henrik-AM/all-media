// Zweiter Teil von Henriks Rueckmeldung vom 25.08. - die Punkte, die in
// _henrik.js noch nicht vorkommen. Zusammen decken beide Reihen die ganze
// Liste ab.
//
//   node test/_henrik2.js

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');

const ADRESSE = process.env.AM_URL || 'http://localhost:3000';

let bestanden = 0;
const offen = [];

function ok(name, bedingung, zusatz = '') {
  if (bedingung) {
    bestanden++;
    console.log(`  OK    ${name}${zusatz ? `  — ${zusatz}` : ''}`);
  } else {
    offen.push(name);
    console.log(`  OFFEN ${name}${zusatz ? `  — ${zusatz}` : ''}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const konsole = [];
  seite.on('console', (m) => m.type() === 'error' && konsole.push(m.text()));

  await seite.goto(ADRESSE);

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen

  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.

  const angemeldet = await anmelden(seite);
  if (!angemeldet.ok) {

    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    process.exit(1);

  }

  await seite.reload({ waitUntil: 'networkidle' });

  await seite.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await seite.waitForSelector('.navbtn');

  const geheZu = async (bereich, unterpunkt) => {
    await seite.click(`[data-area="${bereich}"]`);
    await seite.waitForTimeout(150);
    if (unterpunkt) {
      await seite.click(`[data-sub="${unterpunkt}"]`);
      await seite.waitForTimeout(300);
    }
  };
  const text = () => seite.locator('.main').textContent();

  /* ------------------------------------------------------- Friend-Map */
  console.log('\nMessenger — Friend-Map');
  await geheZu('messenger', 'friendmap');

  // "Das Raster auf der Karte entfernen."
  ok('Kein Raster mehr auf der Karte', (await seite.locator('.map__grid').count()) === 0);

  // "Plus/Minus rechts oben entfernen und durch einen diagonalen Pfeil
  //  ersetzen. Dieser oeffnet eine vergroesserte Vollbild-Kartenansicht."
  ok('Vollbild-Pfeil statt Plus/Minus', (await seite.locator('[data-mapfull]').count()) > 0);

  // "In normaler und grosser Ansicht einen Button fuer verschiedene
  //  Kartenansichten ergaenzen, z. B. Satellit/geografisch."
  ok('Umschalter fuer die Kartenansicht', (await seite.locator('[data-mapstil]').count()) > 0);

  // "Bei 'Nur ausgewaehlte' Standortfreigabe im grauen Einstellungsbereich
  //  einen Link 'Ausgewaehlte bearbeiten' o. Ae. anzeigen."
  const kartenText = await text();
  ok('Standortfreigabe einstellbar', /Standort/.test(kartenText));

  /* ------------------------------------------------------ Kurzformat */
  console.log('\nVideos — Kurzformat');
  await geheZu('videos', 'portrait');

  // "Standort und Musik eines Beitrags muessen anklickbar sein."
  ok('Standort im Kurzformat anklickbar', (await seite.locator('[data-slideort]').count()) > 0);
  ok('Musik im Kurzformat anklickbar', (await seite.locator('[data-slidesound]').count()) > 0);

  /* ----------------------------------------------------------- Home */
  console.log('\nVideos — Home');
  await geheZu('videos', 'home');
  ok('Standort im Beitrag anklickbar', (await seite.locator('[data-postort]').count()) > 0);
  ok('Musik im Beitrag anklickbar', (await seite.locator('[data-postsound]').count()) > 0);

  /* ------------------------------------------------- Community-Chats */
  console.log('\nCommunitys — Chats');
  await geheZu('communities', 'chats');
  const commChatText = await text();

  // "Unter der Suchleiste die Filter 'Alle', 'Chats', 'Gruppen' ergaenzen."
  for (const f of ['Alle', 'Chats', 'Gruppen']) {
    ok(`Filter "${f}" in den Community-Chats`, commChatText.includes(f));
  }

  // "Rechts neben der Suchleiste einen blauen Plus-Button zum Hinzufuegen
  //  neuer Personen einbauen."
  ok('Plus-Knopf neben der Suche', (await seite.locator('.iconbtn-primary').count()) > 0);

  /* ------------------------------------------------ Community oeffnen */
  console.log('\nCommunitys — Aufbau beim Oeffnen');
  await geheZu('communities', 'home');
  const ersteCommunity = seite.locator('[data-community]').first();
  if (await ersteCommunity.count()) {
    await ersteCommunity.click();
    // Die Kanaele kommen aus der Datenbank. 400 ms waren dafuer eine Wette:
    // in der Kette stand hier noch die Uebersicht ("MeineEntdecken"), und
    // alle vier Punkte dieses Abschnitts fielen um.
    await seite.waitForSelector('[data-channel]', { timeout: 10000 }).catch(() => {});
    const inhalt = await seite.locator('.main, .overlay').first().textContent();

    // "Beim Oeffnen einer Community muss die Seite wie im Figma-Prototyp auf
    //  'CH+ Kanal' aufgebaut sein. Erst nach Auswahl eines Themas gelangt man
    //  in den eigentlichen Chat."
    ok('Kanalliste statt direkt Chat', /Kanal|Kanäle|#/.test(inhalt), inhalt.trim().slice(0, 40));

    /*
     * "Bei Nachrichten im Community-Chat links klein das Profilbild des
     *  Absenders anzeigen. Anklicken fuehrt zum Profil."
     *
     * Seit dem Umbau sind es drei Ebenen: Kanal -> Thema -> Chat.
     *
     * Gesucht wird ein Kanal, der auch Themen hat — nicht mehr blind der
     * zweite. Am 01.09.2026 standen fuenf leere "Pruefthema …" ganz oben in
     * der Liste; der zweite Kanal war eines davon, die Themenliste blieb leer
     * und der Lauf brach mitten im Abschnitt ab. Ein Kanal ohne Themen ist
     * kein Fehler — ein frisch angelegter hat noch keine.
     */
    const kanaele = seite.locator('[data-channel]');
    const anzahl = await kanaele.count();
    let themenGefunden = false;

    for (let i = 0; i < anzahl; i++) {
      await kanaele.nth(i).click();
      await seite.waitForSelector('[data-thema]', { timeout: 4000 }).catch(() => {});
      if ((await seite.locator('[data-thema]').count()) > 0) {
        themenGefunden = true;
        break;
      }
      // Zurueck zur Kanalliste und den naechsten versuchen.
      await seite.goBack().catch(() => {});
      await seite.waitForSelector('[data-channel]', { timeout: 4000 }).catch(() => {});
    }

    ok('Themen statt direkt Chat', themenGefunden, anzahl ? `${anzahl} Kanäle` : 'kein Kanal gefunden');

    if (themenGefunden) {
      await seite.locator('[data-thema]').first().click();
      await seite.waitForSelector('.msgzeile__avatar', { timeout: 10000 }).catch(() => {});
      ok('Profilbild am Absender im Kanal-Chat',
        (await seite.locator('.msgzeile__avatar').count()) > 0);
      ok('Profilbild fuehrt zum Profil',
        (await seite.locator('.msgzeile__avatar[data-profile]').count()) > 0);
    } else {
      ok('Profilbild am Absender im Kanal-Chat', false, 'kein Kanal mit Themen');
      ok('Profilbild fuehrt zum Profil', false, 'kein Kanal mit Themen');
    }
  } else {
    ok('Kanalliste statt direkt Chat', false, 'keine Community gefunden');
  }

  /* ----------------------------------------------- Chats verwalten */
  console.log('\nGenerell — Chats verwalten');
  await geheZu('messenger', 'chats');

  // "Messenger- und Community-Chats sollen sich wie bei WhatsApp verwalten
  //  lassen: nach links swipen oder lange gedrueckt halten - Optionen wie
  //  Archivieren, Loeschen und weitere Chat-Einstellungen anzeigen."
  const zeile = seite.locator('[data-chat]').first();
  await zeile.click({ button: 'right' }).catch(() => {});
  await seite.waitForTimeout(300);
  let menue = await seite.locator('.sheet').count();
  if (!menue) {
    // Langes Druecken nachstellen: Maus halten statt klicken.
    const box = await zeile.boundingBox();
    if (box) {
      await seite.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await seite.mouse.down();
      await seite.waitForTimeout(700);
      await seite.mouse.up();
      await seite.waitForTimeout(400);
      menue = await seite.locator('.sheet').count();
    }
  }
  const menueText = menue ? await seite.locator('.sheet').textContent() : '';
  ok('Langes Druecken oeffnet Chat-Optionen', menue > 0);
  ok('Archivieren angeboten', /[Aa]rchiv/.test(menueText));
  ok('Loeschen angeboten', /[Ll]öschen|[Ll]oeschen/.test(menueText));

  await browser.close();

  const gesamt = bestanden + offen.length;
  console.log(`\n  ${bestanden} von ${gesamt} Punkten erfuellt`);
  if (offen.length) {
    console.log('\n  Noch offen:');
    offen.forEach((f) => console.log(`    - ${f}`));
  }
  console.log(konsole.length ? `\n  Konsolenfehler: ${konsole.length}` : '\n  Keine Konsolenfehler');

  // Ohne diese Zeile endete der Lauf immer mit 0. In der Kette (test:alles)
  // lief es damit weiter, obwohl hier vier Punkte offen waren - der Fehler
  // stand im Protokoll und blieb trotzdem folgenlos.
  process.exit(offen.length === 0 && konsole.length === 0 ? 0 : 1);
})();
