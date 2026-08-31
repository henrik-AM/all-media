// Smoke-Test fuer die Web-Version.
//
// Voraussetzung: der Web-Server laeuft (node web-app.js) und playwright-core
// ist installiert:
//   npm i -D playwright-core && npx playwright install chromium
//
// Start:  node test/smoke.js
//
// Der Test prueft zuerst die Grundstruktur aus dem Figma-Prototypen (unten vier
// Bereiche, oben die Unterpunkte des jeweiligen Bereichs) und klickt danach
// jeden Unterpunkt durch. Am Ende werden alle Konsolenfehler ausgegeben.
// Exit-Code 1, wenn etwas fehlschlaegt.
//
// Der Test setzt den Server vor und nach dem Lauf auf den Startzustand zurueck
// (POST /api/reset), damit er wiederholbar ist und keine Testgruppen oder
// Testkommentare in der App zurueckbleiben.

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');

let failed = 0;
const assert = (label, cond) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
};

// Die Struktur ist im Prototyp festgelegt und darf nicht abweichen.
const STRUCTURE = {
  messenger: ['friendmap', 'chats', 'camera', 'profile'],
  videos: ['home', 'portrait', 'landscape', 'search', 'profile'],
  communities: ['home', 'chats', 'search', 'profile'],
  settings: [],
};

(async () => {
  const b = await chromium.launch({ channel: 'chromium-headless-shell' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen
  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.
  const angemeldet = await anmelden(p);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
    process.exit(1);
  }
  await p.reload({ waitUntil: 'networkidle' });
  await p.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await p.waitForTimeout(400);

  // --- Grundstruktur ---
  const areas = await p.$$eval('.navbtn', els => els.map(e => e.dataset.area));
  assert('Unten genau vier Bereiche', areas.length === 4);
  assert('Bereiche in Prototyp-Reihenfolge',
    areas.join(',') === 'messenger,videos,communities,settings');

  for (const [area, subs] of Object.entries(STRUCTURE)) {
    await p.click(`[data-area="${area}"]`);
    await p.waitForTimeout(400);
    const top = await p.$$eval('.topbar__btn', els => els.map(e => e.dataset.sub));
    assert(`Oben ${subs.length} Unterpunkte in ${area}`, top.join(',') === subs.join(','));
  }

  // --- jeder Unterpunkt oeffnet sich ---
  for (const [area, subs] of Object.entries(STRUCTURE)) {
    await p.click(`[data-area="${area}"]`);
    await p.waitForTimeout(300);
    for (const s of subs) {
      await p.click(`[data-sub="${s}"]`);
      await p.waitForTimeout(400);
      const active = await p.$eval(`[data-sub="${s}"]`, e => e.classList.contains('is-active'));
      const filled = await p.$eval('#main', e => e.textContent.trim().length > 0 || e.querySelector('.feed,.camera') !== null);
      assert(`${area}/${s} oeffnet`, active && filled);
    }
  }

  // --- Chat-Suche ---
  await p.click('[data-area="messenger"]');
  await p.click('[data-sub="chats"]');
  await p.waitForTimeout(350);
  await p.fill('#chatSearch', 'projekt');
  await p.waitForTimeout(300);
  assert('Chat-Suche filtert (projekt -> 1)', (await p.$$eval('[data-chat]', e => e.length)) === 1);
  await p.fill('#chatSearch', 'zzz');
  await p.waitForTimeout(300);
  assert('Leerzustand bei 0 Treffern', !!(await p.$('.empty')));
  await p.fill('#chatSearch', '');
  await p.waitForTimeout(300);

  // --- Filter ---
  await p.click('[data-filter="groups"]');
  await p.waitForTimeout(300);
  assert('Gruppen-Filter (2 Gruppen)', (await p.$$eval('[data-chat]', e => e.length)) === 2);
  await p.click('[data-filter="contacts"]');
  await p.waitForTimeout(300);
  assert('Kontakt-Filter (6 Einzelchats)', (await p.$$eval('[data-chat]', e => e.length)) === 6);
  await p.click('[data-filter="all"]');
  await p.waitForTimeout(300);

  // --- Chat oeffnen, senden, zurueck ---
  await p.click('[data-chat="c2"]');
  await p.waitForTimeout(400);
  assert('Chat-Bereich nicht abgeschnitten', await p.$eval('#messages', e => e.clientHeight > 300));
  const before = await p.$$eval('.msg', e => e.length);
  await p.fill('#msgInput', 'Regressionstest');
  await p.click('#sendBtn');
  await p.waitForTimeout(2200);
  assert('Nachricht senden + Antwort', (await p.$$eval('.msg', e => e.length)) >= before + 2);
  await p.click('#chatBack');
  await p.waitForTimeout(400);
  assert('Zurueck aus Chat', !!(await p.$('#chatSearch')));

  // --- Story-Viewer: Henriks vier Punkte ---
  await p.click('[data-story="s1"]');
  await p.waitForTimeout(400);
  assert('Story-Viewer oeffnet', !!(await p.$('.viewer')));
  await p.click('#storyLike');
  await p.waitForTimeout(400);
  assert('Herz wird rot', await p.$eval('#storyLike', e => e.classList.contains('is-liked')));
  await p.click('#storyNext');
  await p.waitForTimeout(400);
  assert('Rechts blaettert weiter', (await p.$eval('.viewer__name', e => e.textContent.trim())) === 'Bob Müller');
  await p.click('#storyPrev');
  await p.waitForTimeout(400);
  assert('Links blaettert zurueck', (await p.$eval('.viewer__name', e => e.textContent.trim())) === 'Anna Schmidt');
  assert('Like bleibt bestehen', await p.$eval('#storyLike', e => e.classList.contains('is-liked')));

  await p.click('#storyReply');
  await p.fill('#storyReply', 'Story-Antwort');
  const w1 = await p.$eval('#storyFill', e => e.style.width);
  await p.waitForTimeout(2200);
  const w2 = await p.$eval('#storyFill', e => e.style.width);
  assert('Zeit steht waehrend des Tippens', w1 === w2);

  // Enter schickt bewusst nicht mehr ab - Henrik wollte einen sichtbaren
  // Senden-Pfeil. Der Test prueft beides: dass Enter nichts tut und dass
  // der Pfeil abschickt.
  await p.press('#storyReply', 'Enter');
  await p.waitForTimeout(400);
  assert('Enter schickt die Story-Antwort nicht ab', !!(await p.$('#storyReply')));

  assert('Senden-Pfeil ist nutzbar, sobald etwas dasteht',
    !(await p.$eval('#storySenden', e => e.disabled)));
  await p.click('#storySenden');
  await p.waitForTimeout(900);
  assert('Antwort oeffnet den Chat', (await p.$eval('.chathead__name', e => e.textContent.trim())) === 'Anna Schmidt');
  assert('Antwort steht im Chat',
    (await p.$$eval('.msg', els => els[els.length - 1].textContent)).includes('Story-Antwort'));
  await p.click('#chatBack');
  await p.waitForTimeout(400);

  // --- Kamera ueber die eigene Story ---
  await p.click('[data-story="s0"]');
  await p.waitForTimeout(400);
  assert('Kamera ueber eigene Story', !!(await p.$('.camera')));
  await p.click('#camClose');
  await p.waitForTimeout(400);

  // --- Plus-Menue: Gruppe, Kontakt, Kontaktliste ---
  const chatsBefore = await p.$$eval('[data-chat]', e => e.length);
  await p.click('#newChat');
  await p.waitForTimeout(400);
  assert('Neu-Menue mit drei Eintraegen', (await p.$$eval('[data-new]', e => e.length)) === 3);
  await p.click('[data-new="group"]');
  await p.waitForTimeout(400);
  // Schritt 1: erst die Personen auswaehlen (Name kommt erst danach).
  await p.click('[data-member="u1"]');
  await p.waitForTimeout(250);
  await p.click('[data-member="u2"]');
  await p.waitForTimeout(250);
  assert('Auswahl wird gezaehlt', (await p.$eval('.sheet__title', e => e.textContent)).includes('2'));
  await p.click('#groupNext');
  await p.waitForTimeout(400);
  // Schritt 2: Name und Info.
  assert('Schritt 2 fragt den Namen', !!(await p.$('#groupName')));
  await p.fill('#groupName', 'Smoke-Test-Gruppe');
  await p.click('#groupCreate');
  await p.waitForTimeout(800);
  assert('Gruppe oeffnet sich als Chat', (await p.$eval('.chathead__name', e => e.textContent.trim())) === 'Smoke-Test-Gruppe');
  assert('Mitgliederzahl stimmt', (await p.$eval('.chathead__status', e => e.textContent.trim())) === '3 Mitglieder');
  await p.click('#chatBack');
  await p.waitForTimeout(500);
  assert('Gruppe steht in der Chatliste', (await p.$$eval('[data-chat]', e => e.length)) === chatsBefore + 1);

  await p.click('#newChat');
  await p.waitForTimeout(400);
  await p.click('[data-new="contacts"]');
  await p.waitForTimeout(500);
  assert('Kontaktliste oeffnet (6 Kontakte)', (await p.$$eval('[data-contact]', e => e.length)) === 6);
  await p.fill('#contactSearch', 'elif');
  await p.waitForTimeout(300);
  assert('Kontakt-Suche filtert (elif -> 1)', (await p.$$eval('[data-contact]', e => e.length)) === 1);
  await p.click('#contactsBack');
  await p.waitForTimeout(400);

  await p.click('#newChat');
  await p.waitForTimeout(400);
  await p.click('[data-new="contact"]');
  await p.waitForTimeout(400);
  await p.fill('#contactHandle', '@niemand');
  await p.click('#contactAdd');
  await p.waitForTimeout(500);
  assert('Unbekannter Kontakt wird abgelehnt', (await p.$eval('#toast', e => e.textContent)).includes('Niemand'));
  await p.fill('#contactHandle', '@anna');
  await p.click('#contactAdd');
  await p.waitForTimeout(500);
  assert('Doppelter Kontakt wird abgelehnt', (await p.$eval('#toast', e => e.textContent)).includes('bereits'));
  await p.mouse.click(200, 40);
  await p.waitForTimeout(400);

  // --- Videos: Querformat und Explorer ---
  await p.click('[data-area="videos"]');
  await p.click('[data-sub="landscape"]');
  await p.waitForTimeout(400);
  // Neun statt der frueheren sechs: die Filterleiste braucht von jeder Art
  // (Standard, 360°, Live) mehrere Videos, sonst laesst sich nicht erkennen,
  // ob sie wirklich filtert. Siehe test/_insel.js.
  assert('Querformat zeigt 9 Videos', (await p.$$eval('[data-clip]', e => e.length)) === 9);
  await p.fill('#clipSearch', 'pasta');
  await p.waitForTimeout(300);
  assert('Querformat-Suche ohne Treffer', !!(await p.$('.empty')));
  await p.fill('#clipSearch', 'design');
  await p.waitForTimeout(300);
  assert('Querformat-Suche filtert (design -> 1)', (await p.$$eval('[data-clip]', e => e.length)) === 1);

  await p.click('[data-sub="search"]');
  await p.waitForTimeout(400);
  assert('Explorer zeigt sieben Abschnitte', (await p.$$eval('.exp', e => e.length)) === 7);
  await p.fill('#videoSearch', 'anna');
  await p.waitForTimeout(350);
  assert('Explorer filtert', (await p.$$eval('.exp', e => e.length)) < 7);
  await p.fill('#videoSearch', '');
  await p.waitForTimeout(300);

  // --- Kommentare (Bild-Feed) ---
  await p.click('[data-sub="home"]');
  await p.waitForTimeout(400);
  await p.click('[data-paction="comment"][data-pid="p1"]');
  await p.waitForTimeout(500);
  assert('Kommentare oeffnen (p1 -> 3)', (await p.$$eval('.comment', e => e.length)) === 3);
  await p.fill('#commentInput', 'Testkommentar');
  await p.click('#commentSend');
  await p.waitForTimeout(600);
  assert('Kommentar senden', (await p.$$eval('.comment', e => e.length)) === 4);
  await p.click('[data-clike="cm1"]');
  await p.waitForTimeout(400);
  assert('Kommentar liken', await p.$eval('[data-clike="cm1"]', e => e.classList.contains('is-on')));
  await p.mouse.click(200, 40);
  await p.waitForTimeout(400);

  // --- Profil aus Beitrag ---
  await p.click('.post__name[data-profile="u3"]');
  await p.waitForTimeout(600);
  assert('Profil aus Beitrag oeffnet',
    (await p.$eval('.prof__name', e => e.textContent.trim())) === 'Clara Weber' &&
    (await p.$$eval('.griditem', e => e.length)) === 12);
  await p.click('#profFollow');
  await p.waitForTimeout(500);
  assert('Folgen schaltet um', (await p.$eval('#profFollow', e => e.textContent.trim())) === 'Folgen');
  await p.click('#profBack');
  await p.waitForTimeout(500);

  // --- Communitys: Chats, Suche, Profil ---
  await p.click('[data-area="communities"]');
  await p.click('[data-sub="chats"]');
  await p.waitForTimeout(400);
  // Henrik wollte hier persoenliche Chats sehen, keine Communitys - die
  // stehen schon unter Home. Es sind Leute ohne Telefonnummer, also solche,
  // die man aus einer Community kennt und nicht aus dem Telefonbuch.
  assert('Community-Chats zeigen persoenliche Chats', (await p.$$eval('[data-chat]', e => e.length)) === 4);
  assert('Community-Chats zeigen keine Communitys', (await p.$$eval('[data-commchat]', e => e.length)) === 0);
  assert('Filter Alle/Chats/Gruppen vorhanden', (await p.$$eval('[data-ccfilter]', e => e.length)) === 3);
  assert('Plus-Knopf zum Hinzufuegen', !!(await p.$('#commNewChat')));
  await p.click('[data-ccfilter="groups"]');
  await p.waitForTimeout(300);
  assert('Filter Gruppen zeigt nur die Gruppe', (await p.$$eval('[data-chat]', e => e.length)) === 1);
  await p.click('[data-ccfilter="all"]');
  await p.waitForTimeout(300);
  await p.click('[data-sub="search"]');
  await p.waitForTimeout(400);
  await p.click('[data-csfilter="people"]');
  await p.waitForTimeout(350);
  // Neun Personen: sechs Kontakte plus drei, die noch keine sind (damit sich
  // "Kontakt hinzufuegen" ueberhaupt ausprobieren laesst).
  assert('Filter Kontakte zeigt nur Profile', (await p.$$eval('[data-befriend]', e => e.length)) === 9);
  await p.click('[data-csfilter="channels"]');
  await p.waitForTimeout(350);
  assert('Filter Communitys zeigt nur Kanaele', (await p.$$eval('[data-community]', e => e.length)) === 6);
  await p.click('[data-sub="profile"]');
  await p.waitForTimeout(400);
  assert('Community-Profil zeigt beide Abschnitte', (await p.$$eval('.exp__head', e => e.length)) === 2);
  assert('Profil wechseln steht über dem Profil', !!(await p.$('.switchbar')));

  // --- Einstellungen mit Dark-Mode ---
  await p.click('[data-area="settings"]');
  await p.waitForTimeout(400);
  assert('Einstellungen ohne obere Leiste', await p.$eval('#topbar', e => e.hidden));
  assert('Einstellungen ohne Seitentitel', !(await p.$('.pagehead__title')));
  // Die vier Abschnitte aus dem Prototyp muessen da sein. Weitere sind seit
  // Henriks Rueckmeldung ausdruecklich erwuenscht, deshalb keine feste Anzahl.
  const abschnitte = await p.$$eval('[data-jump]', e => e.map(x => x.dataset.jump));
  assert('Prototyp-Abschnitte vorhanden',
    ['allgemein', 'messenger', 'videos', 'communitys'].every(a => abschnitte.includes(a)));
  assert('Zusaetzliche Abschnitte ergaenzt', abschnitte.length > 4);
  await p.click('[data-toggle="theme"]');
  await p.waitForTimeout(300);
  assert('Dark-Mode-Schalter', (await p.$eval('html', e => e.getAttribute('data-theme'))) === 'dark');
  await p.click('[data-toggle="theme"]');
  await p.waitForTimeout(300);

  await p.request.post('http://localhost:3000/api/reset');

  console.log('');
  console.log(errs.length ? 'FEHLER:\n' + errs.join('\n') : 'Keine Konsolenfehler');
  await b.close();

  process.exit(failed > 0 || errs.length > 0 ? 1 : 0);
})();
