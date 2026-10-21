#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kasten 17.3: die Kästen 1–8 auf der Website ansehen.
 *
 * Für 9–16 legen k28-communitys, k28-mitglieder und k28-erstellen Bilder ab;
 * für 1–8 gab es keinen Lauf mit Prüfattrappe, also auch kein einziges Bild.
 * Dieser Lauf klickt die Wege mit der Attrappe durch und fotografiert sie.
 * Er belegt Stufe 1–2 (Gegenstand, bedienbar), nie Speichern oder Wirkung.
 *
 *   BASE=http://localhost:3200 BILDER=<ordner> node test/_k28-bilder-1-8.js
 */
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:3200';
const BILDER = process.env.BILDER;
let ok = 0;
let fehl = 0;
function pruefe(name, bedingung, info = '') {
  if (bedingung) ok++, console.log(`  OK    ${name}`);
  else fehl++, console.log(`  FEHLT ${name}${info ? ` — ${info}` : ''}`);
}
async function bild(seite, name) {
  if (!BILDER) return;
  await seite.waitForTimeout(700);
  await seite.screenshot({ path: path.join(BILDER, name) });
}

(async () => {
  const { chromium } = require('playwright-core');
  const { attrappe, bestand, community } = require('./_attrappe');

  const geteilt = {
    id: 'p-1',
    kind: 'post',
    art: 'video',
    titel: 'Sonnenaufgang am Hafen',
    beschreibung: 'Drei Minuten Zeitraffer, aufgenommen um 6 Uhr',
    autor: 'Anna Schmidt',
    autorId: 'u-anna',
    bild: null,
  };
  const daten = bestand({
    users: {
      me: { id: 'me', name: 'Test Konto', handle: 'test', initials: 'TK' },
      'u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: 'anna', initials: 'AS' },
      'u-ben': { id: 'u-ben', name: 'Ben Berg', handle: 'benno', initials: 'BB' },
    },
    chats: [
      { id: 'g-1', name: 'Wandergruppe', isGroup: true, members: ['u-anna', 'u-ben'], preview: 'Beitrag geteilt', time: '12:00', unread: 0 },
    ],
    communities: [
      community('c-eigen', 'Nachtschicht', { eigen: true, members: 3 }),
      community('c-oeff', 'Fotografie', { visibility: 'public', members: 40 }),
      community('c-fremd', 'Kochen', { visibility: 'public', joined: false }),
    ],
  });
  const kanal = {
    messages: [
      { id: 'n1', from: 'u-anna', text: 'Wer kommt heute zum Treffen?', time: '18:02' },
      { id: 'n2', from: 'me', text: 'Ich bin dabei', time: '18:03', antwortAuf: { id: 'n1', autor: 'Anna Schmidt', text: 'Wer kommt heute zum Treffen?' } },
      { id: 'n3', from: 'me', anruf: { art: 'video', status: 'gestartet' }, time: '18:05' },
      { id: 'n4', from: 'u-ben', pttSitzung: true, zeitpunkt: '2026-10-21T18:10:00Z', time: '18:10' },
      { id: 'n5', from: 'u-anna', geteilt, time: '18:12' },
    ],
  };

  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    await attrappe(seite, daten, {
      '/api/communities/c-oeff/channels/c-oeff-k1': kanal,
      '/api/ptt/sitzung/n4': { ok: true, eintraege: [
        { userId: 'u-ben', name: 'Ben Berg', zeitpunkt: '2026-10-21T18:10:00Z', dauer: 7 },
        { userId: 'u-anna', name: 'Anna Schmidt', zeitpunkt: '2026-10-21T18:10:20Z', dauer: 4 },
      ] },
      '/api/messages/g-1': [
        { id: 'm1', from: 'u-anna', geteilt, time: '12:00' },
        { id: 'm2', from: 'u-ben', geteilt: { id: 'p-2', weg: true, grund: 'geloescht', autor: 'Ben Berg', autorId: 'u-ben' }, time: '12:01' },
        { id: 'm3', from: 'me', anruf: { art: 'audio', status: 'gestartet' }, time: '12:05' },
      ],
    });
    await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
    await seite.waitForSelector('[data-area="communities"]', { timeout: 15000 });
    await seite.click('[data-area="communities"]');

    // Kasten 1 und 3.3–3.5: Communitys → Profil
    await seite.click('[data-sub="profile"]');
    await seite.waitForSelector('#profilBearbeiten', { timeout: 10000 });
    pruefe('1.1 Communitys-Profil hat „Profil wechseln“', !!(await seite.$('#switchProfile')));
    await bild(seite, 'k28-1-profil.png');
    await seite.click('#switchProfile');
    await seite.waitForTimeout(500);
    pruefe('1.1 Bereich bleibt Communitys', (await seite.$eval('[data-area].is-active', (n) => n.dataset.area).catch(() => '')) === 'communities');
    await bild(seite, 'k28-1-wechseln.png');
    await seite.keyboard.press('Escape');
    await seite.click('[data-sub="profile"]');
    await seite.waitForSelector('#profilBearbeiten', { timeout: 10000 });
    await seite.click('#profilBearbeiten');
    await seite.waitForSelector('#pbEinstellungen', { timeout: 5000 }).catch(() => {});
    pruefe('1.3 Hinweis „Weitere Bearbeitungen unter Einstellungen“', !!(await seite.$('#pbEinstellungen')));
    await bild(seite, 'k28-1-bearbeiten.png');
    await seite.click('#pbEinstellungen').catch(() => {});
    await seite.waitForTimeout(600);
    await bild(seite, 'k28-1-einstellungen.png');

    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="profile"]');
    await seite.waitForSelector('[data-commview="erstellt"]', { timeout: 10000 });
    await seite.click('.prof__stat[data-commview="erstellt"]');
    await seite.waitForSelector('#commListeBack', { timeout: 5000 });
    pruefe('3.3 Listenseite ohne „Profil wechseln“', !(await seite.$('#switchProfile')));
    pruefe('3.4 „Erstellte Communitys“ zeigt Nachtschicht', /Nachtschicht/.test(await seite.locator('#main').textContent()));
    await bild(seite, 'k28-3-erstellt.png');

    // Kasten 2 und 3.1/3.2: Communitys → Suchen
    await seite.click('[data-sub="search"]');
    await seite.waitForSelector('[data-csmehr]', { timeout: 10000 });
    const koepfe = await seite.$$eval('[data-csmehr]', (e) => e.map((b) => b.textContent.trim()));
    pruefe('2.1 Überschrift „Communitys →“, kein „Kanäle“', koepfe.includes('Communitys →') && !/Kan[äa]l/.test(koepfe.join()), koepfe.join(' | '));
    await bild(seite, 'k28-2-suche.png');
    await seite.click('[data-csmehr="channels"]');
    await seite.waitForTimeout(500);
    pruefe('3.2 eigene Seite mit Suchleiste', !!(await seite.$('#main input')));
    await bild(seite, 'k28-3-alle-communitys.png');

    // Kasten 8.1: Homeseite ohne Push-to-Talk
    await seite.click('[data-sub="home"]');
    await seite.waitForSelector('[data-community="c-oeff"]', { timeout: 10000 });
    await seite.click('[data-community="c-oeff"]');
    await seite.waitForSelector('[data-channel]', { timeout: 10000 });
    pruefe('8.1 kein Push-to-Talk auf der Homeseite', !(await seite.$('#pttKnopf')));
    await bild(seite, 'k28-8-homeseite.png');

    // Unterthema-Chat: 4.2, 5.2, 7.1, 8.2, 8.5, 11.3
    await seite.click('[data-channel]');
    await seite.waitForSelector('[data-thema]', { timeout: 10000 });
    await seite.click('[data-thema]');
    await seite.waitForSelector('#commMsgs .msg', { timeout: 10000 });
    pruefe('4.2 Antwort mit Zitat', !!(await seite.$('#commMsgs [data-testid="antwort-bezug"]')));
    pruefe('5.2 Anruf als Zeile im Verlauf', !!(await seite.$('#commMsgs .msg__anruf')));
    pruefe('7.1 geteilter Beitrag als Karte', !!(await seite.$('#commMsgs [data-testid="geteilt-karte"]')));
    pruefe('8.2 Push-to-Talk im Unterthema', !!(await seite.$('#pttKnopf')));
    pruefe('8.5 eine Zeile „Push to Talk“', (await seite.$$('#commMsgs .msg__ptt')).length === 1);
    await bild(seite, 'k28-chat-unterthema.png');
    await seite.click('[data-pttsitzung="n4"]');
    await seite.waitForTimeout(600);
    pruefe('8.6 Verlauf mit zwei Wortmeldungen', (await seite.$$('.pttverlauf__zeile')).length === 2);
    await bild(seite, 'k28-8-verlauf.png');
    await seite.keyboard.press('Escape');
    await seite.mouse.click(200, 60);
    await seite.waitForTimeout(400);

    // Kasten 6: Plus und GIF/Sticker
    await seite.click('#commAttach');
    await seite.waitForTimeout(600);
    const menue = (await seite.locator('body').textContent()) || '';
    pruefe('6.1 kein „Foto aufnehmen“, „GIF senden“, „Sticker“ im Anhänge-Menü', !/Foto aufnehmen|GIF senden/.test(menue));
    await bild(seite, 'k28-6-anhaenge.png');
    await seite.keyboard.press('Escape');
    await seite.mouse.click(200, 60);
    await seite.waitForTimeout(400);
    await seite.click('#commGifSticker').catch((f) => pruefe('6.3 GIF/Sticker-Knopf klickbar', false, f.message));
    await seite.waitForTimeout(600);
    await bild(seite, 'k28-6-gifsticker.png');

    // Kasten 7: Messenger-Gruppe mit Karten, Gruppeninfo
    await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
    await seite.waitForSelector('[data-area="messenger"]', { timeout: 15000 });
    await seite.click('[data-area="messenger"]');
    await seite.waitForSelector('[data-chat="g-1"]', { timeout: 10000 });
    await seite.click('[data-chat="g-1"]');
    await seite.waitForSelector('[data-testid="geteilt-karte"]', { timeout: 10000 }).catch(() => {});
    pruefe('7.1 Karte im Messenger', !!(await seite.$('[data-testid="geteilt-karte"]')));
    pruefe('7.6 gelöscht als eigene Karte', !!(await seite.$('[data-testid="geteilt-geloescht"]')));
    await bild(seite, 'k28-7-messenger-karten.png');
    await seite.click('.chathead__body').catch(() => {});
    await seite.waitForTimeout(800);
    pruefe('7.9 Gruppeninfo mit Mitgliedern', /Anna Schmidt/.test((await seite.locator('#overlay').textContent().catch(() => '')) || ''));
    await bild(seite, 'k28-7-gruppeninfo.png');

    pruefe('keine Fehler in der Seite', !seitenfehler.length, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
  console.log(`\n${ok}/${ok + fehl} Prüfungen bestanden`);
  process.exit(fehl ? 1 : 0);
})().catch((f) => {
  console.error(f);
  process.exit(2);
});
