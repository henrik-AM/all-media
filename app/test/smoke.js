// Smoke-Test fuer die Web-Version.
//
// Voraussetzung: der Web-Server laeuft (node web-app.js) und playwright-core
// ist installiert:
//   npm i -D playwright-core && npx playwright install chromium
//
// Start:  node test/smoke.js
//
// Der Test klickt alle Bereiche durch und prueft Suche, Filter, Chat,
// Kommentare, Story-Viewer, Kamera und den Dark-Mode-Schalter. Am Ende werden
// alle Konsolenfehler ausgegeben. Exit-Code 1, wenn etwas fehlschlaegt.
//
// Der Mock-Server haelt seinen Zustand im Speicher und behaelt ihn zwischen
// Testlaeufen. Pruefungen sind deshalb relativ formuliert (Aenderung statt
// absoluter Zahl), wo der Test selbst Daten veraendert.

const { chromium } = require('playwright-core');

let failed = 0;
const assert = (label, cond) => {
  if (!cond) failed++;
  console.log((cond ? 'PASS  ' : 'FAIL  ') + label);
};

(async () => {
  const b = await chromium.launch({ channel: 'chromium-headless-shell' });
  const p = await b.newPage({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await p.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);

  // --- areas ---
  for (const area of ['home', 'video', 'messenger', 'communities', 'profile']) {
    await p.click(`[data-area="${area}"]`);
    await p.waitForTimeout(350);
    const active = await p.$eval(`[data-area="${area}"]`, e => e.classList.contains('is-active'));
    const hasContent = await p.$eval('#main', e => e.textContent.trim().length > 0 || e.querySelector('.feed') !== null);
    assert(`Bereich ${area} oeffnet`, active && hasContent);
  }

  // --- messenger tabs ---
  await p.click('[data-area="messenger"]');
  await p.waitForTimeout(300);
  for (const view of ['chats', 'stories', 'contacts', 'settings']) {
    await p.click(`[data-view="${view}"]`);
    await p.waitForTimeout(300);
    const active = await p.$eval(`[data-view="${view}"]`, e => e.classList.contains('is-active'));
    assert(`Tab ${view} aktiv`, active);
  }

  // --- chat search ---
  await p.click('[data-view="chats"]');
  await p.waitForTimeout(300);
  await p.fill('#chatSearch', 'projekt');
  await p.waitForTimeout(300);
  const r = await p.$$eval('[data-chat]', e => e.length);
  assert('Chat-Suche filtert (projekt -> 1)', r === 1);
  await p.fill('#chatSearch', 'zzz');
  await p.waitForTimeout(300);
  const empty = await p.$('.empty');
  assert('Leerzustand bei 0 Treffern', !!empty);
  await p.fill('#chatSearch', '');
  await p.waitForTimeout(300);

  // --- filter pills ---
  const allChats = await p.$$eval('[data-chat]', e => e.length);
  await p.click('[data-filter="groups"]');
  await p.waitForTimeout(300);
  const groups = await p.$$eval('[data-chat]', e => e.length);
  await p.click('[data-filter="contacts"]');
  await p.waitForTimeout(300);
  const singles = await p.$$eval('[data-chat]', e => e.length);
  assert('Filter teilen die Liste vollstaendig auf', groups > 0 && singles > 0 && groups + singles === allChats);
  await p.click('[data-filter="all"]');
  await p.waitForTimeout(300);

  // --- chat open + send + back ---
  await p.click('[data-chat="c2"]');
  await p.waitForTimeout(400);
  const box = await p.$eval('#messages', e => ({ h: e.clientHeight, visible: e.clientHeight > 300 }));
  assert('Chat-Bereich nicht abgeschnitten', box.visible);
  const before = await p.$$eval('.msg', e => e.length);
  await p.fill('#msgInput', 'Regressionstest');
  await p.click('#sendBtn');
  await p.waitForTimeout(2200);
  const after = await p.$$eval('.msg', e => e.length);
  assert('Nachricht senden + Antwort', after >= before + 2);
  await p.click('#chatBack');
  await p.waitForTimeout(400);
  assert('Zurueck aus Chat', !!(await p.$('#chatSearch')));

  // --- new group ---
  const chatsBefore = await p.$$eval('[data-chat]', e => e.length);
  await p.click('#newChat');
  await p.waitForTimeout(400);
  assert('Neu-Menue oeffnet', (await p.$$eval('[data-new]', e => e.length)) === 2);
  await p.click('[data-new="group"]');
  await p.waitForTimeout(400);
  await p.fill('#groupName', 'Smoke-Test-Gruppe');
  await p.click('[data-member="u1"]');
  await p.waitForTimeout(250);
  await p.click('[data-member="u2"]');
  await p.waitForTimeout(250);
  assert('Auswahl wird gezaehlt', (await p.$eval('.sheet__title', e => e.textContent)).includes('2 ausgewählt'));
  await p.click('#groupCreate');
  await p.waitForTimeout(800);
  assert('Gruppe oeffnet sich als Chat', (await p.$eval('.chathead__name', e => e.textContent.trim())) === 'Smoke-Test-Gruppe');
  assert('Mitgliederzahl stimmt', (await p.$eval('.chathead__status', e => e.textContent.trim())) === '3 Mitglieder');
  await p.click('#chatBack');
  await p.waitForTimeout(500);
  assert('Gruppe steht in der Chatliste', (await p.$$eval('[data-chat]', e => e.length)) === chatsBefore + 1);

  // --- add contact: Fehlerfaelle ---
  await p.click('#newChat');
  await p.waitForTimeout(400);
  await p.click('[data-new="contact"]');
  await p.waitForTimeout(400);
  await p.fill('#contactHandle', '@niemand');
  await p.click('#contactAdd');
  await p.waitForTimeout(500);
  assert('Unbekannter Kontakt wird abgelehnt',
    (await p.$eval('#toast', e => e.textContent)).includes('Niemand'));
  await p.fill('#contactHandle', '@anna');
  await p.click('#contactAdd');
  await p.waitForTimeout(500);
  assert('Doppelter Kontakt wird abgelehnt',
    (await p.$eval('#toast', e => e.textContent)).includes('bereits'));
  await p.mouse.click(200, 40);
  await p.waitForTimeout(400);

  // --- story viewer ---
  await p.click('[data-story="s1"]');
  await p.waitForTimeout(400);
  assert('Story-Viewer oeffnet', !!(await p.$('.viewer')));
  await p.click('#storyClose');
  await p.waitForTimeout(400);
  assert('Story-Viewer schliesst', !(await p.$('.viewer')));

  // --- camera via own story ---
  await p.click('[data-story="s0"]');
  await p.waitForTimeout(400);
  assert('Kamera ueber eigene Story', !!(await p.$('.camera')));
  await p.click('#camClose');
  await p.waitForTimeout(400);

  // --- contacts search ---
  await p.click('[data-view="contacts"]');
  await p.waitForTimeout(300);
  await p.fill('#contactSearch', 'elif');
  await p.waitForTimeout(300);
  const c = await p.$$eval('[data-contact]', e => e.length);
  assert('Kontakt-Suche filtert (elif -> 1)', c === 1);

  // --- comments (Bild-Feed) ---
  await p.click('[data-area="home"]');
  await p.waitForTimeout(400);
  await p.click('[data-paction="comment"][data-pid="p1"]');
  await p.waitForTimeout(500);
  const cmCount = await p.$$eval('.comment', e => e.length);
  assert('Kommentare oeffnen', cmCount >= 3);
  await p.fill('#commentInput', 'Testkommentar');
  await p.click('#commentSend');
  await p.waitForTimeout(600);
  const cmAfter = await p.$$eval('.comment', e => e.length);
  assert('Kommentar senden', cmAfter === cmCount + 1);
  const likeBefore = await p.$eval('[data-clike="cm1"]', e => e.classList.contains('is-on'));
  await p.click('[data-clike="cm1"]');
  await p.waitForTimeout(400);
  const likeAfter = await p.$eval('[data-clike="cm1"]', e => e.classList.contains('is-on'));
  assert('Kommentar liken schaltet um', likeBefore !== likeAfter);
  await p.mouse.click(200, 40);
  await p.waitForTimeout(400);
  assert('Kommentar-Sheet schliesst', !(await p.$('.sheet-backdrop')));

  // --- user profile ---
  await p.click('.post__who[data-profile="u3"]');
  await p.waitForTimeout(600);
  const profName = await p.$eval('.prof__name', e => e.textContent.trim()).catch(() => null);
  const profGrid = await p.$$eval('.griditem', e => e.length);
  assert('Profil aus Beitrag oeffnet', profName === 'Clara Weber' && profGrid === 12);
  const followBefore = await p.$eval('#profFollow', e => e.textContent.trim());
  await p.click('#profFollow');
  await p.waitForTimeout(500);
  const followAfter = await p.$eval('#profFollow', e => e.textContent.trim());
  assert('Folgen schaltet um', followBefore !== followAfter);
  await p.click('[data-ptab="repost"]');
  await p.waitForTimeout(400);
  assert('Repost-Tab zeigt Leerzustand', !!(await p.$('.empty')));
  await p.click('#profMessage');
  await p.waitForTimeout(600);
  assert('Nachricht oeffnet Chat', !!(await p.$('#msgInput')));
  await p.click('.chathead__body[data-profile="u3"]');
  await p.waitForTimeout(600);
  assert('Profil aus Chat-Kopf', !!(await p.$('.prof__name')));
  await p.click('#profBack');
  await p.waitForTimeout(500);

  // --- comments (Video-Feed) ---
  await p.click('[data-area="video"]');
  await p.waitForTimeout(400);
  await p.click('[data-vaction="comment"][data-vid="v3"]');
  await p.waitForTimeout(500);
  const vcm = await p.$$eval('.comment', e => e.length);
  assert('Video-Kommentare laden', vcm >= 2);
  await p.mouse.click(200, 40);
  await p.waitForTimeout(400);

  // --- theme toggle ---
  await p.click('[data-area="messenger"]');
  await p.waitForTimeout(300);
  await p.click('[data-view="settings"]');
  await p.waitForTimeout(300);
  await p.click('#themeSwitch');
  await p.waitForTimeout(300);
  const theme = await p.$eval('html', e => e.getAttribute('data-theme'));
  assert('Dark-Mode-Schalter', theme === 'dark');
  await p.click('#themeSwitch');
  await p.waitForTimeout(300);

  console.log('');
  console.log(errs.length ? 'FEHLER:\n' + errs.join('\n') : 'Keine Konsolenfehler');
  await b.close();

  process.exit(failed > 0 || errs.length > 0 ? 1 : 0);
})();
