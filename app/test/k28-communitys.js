#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kästen 11.1–11.2 und 13 (bearbeitet 15.10.2026).
 *
 *   11.1  Im Unterthema-Chat steht oben nur „# Unterthema“ — ohne
 *         Community-Name und ohne Mitgliederzahl.
 *   11.2  Die Überschrift antippen führt auf die Homeseite der Community.
 *   13.1  Communitys-Home: drei Knöpfe Alle | Öffentlich | Privat unter der
 *         Suchleiste (Prototyp „Communitys - Home“).
 *   13.2  Die Filter wirken: Öffentlich zeigt nur öffentliche, Privat nur
 *         private beigetretene Communitys; Alle beide. Nicht beigetretene
 *         stehen nie auf Home (die stehen unter Suchen, Kasten 3.2).
 *   14.1  Das Plus unter Communitys → Chats öffnet eine eigene Seite „Neuer
 *         Chat“ mit Suche nach Community-Profilen (Name, Benutzername).
 *   14.2  Ein Profil antippen öffnet den Community-Chat: vorhandenen direkt,
 *         sonst legt der Server ihn mit bereich 'community' an.
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Netz: die App im Quelltext (ChatDetailScreen kanalName und
 *      onOpenCommunity, App.tsx verdrahtet; CommunitiesScreen FilterPillen
 *      mit genau diesen drei Schlüsseln und der Filterregel).
 *   B  Website im Prüfbrowser mit der Attrappe (test/_attrappe.js), also
 *      OHNE Supabase: Filter durchklicken und Listen vergleichen, Unterthema
 *      öffnen, Kopf lesen, Kopf anklicken.
 *
 * WAS ER NICHT ZEIGT: die App-Oberfläche (Simulator „All-Media Test“) und
 * echte Daten. Beides nach der Freigabe nachholen.
 *
 * Start:  BASE=http://localhost:3200 node test/k28-communitys.js
 *         (npm run test:k28-communitys; Vorgabe BASE=http://localhost:3000)
 *         OHNE_BROWSER=1 nur Teil A.  WURZEL=… prüft einen anderen Stand
 *         (nur Teil A, für die Gegenprobe).
 */

const fs = require('fs');
const path = require('path');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..', '..');
const BASE = process.env.BASE || 'http://localhost:3000';
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log('\nA  App im Quelltext');
  const chat = lies('app/screens/messenger/ChatDetailScreen.tsx');
  const shell = lies('app/App.tsx');
  const home = lies('app/screens/communities/CommunitiesScreen.tsx');

  pruefe('11.1 Kopf nimmt im Unterthema den Namen des Unterthemas', /kanalName \? `# \$\{kanalName\}` : chat\.name/.test(chat));
  pruefe('11.1 Mitgliederzahl nur außerhalb eines Unterthemas', /\{!kanalName && \(/.test(chat));
  pruefe('11.2 Kopf im Unterthema ruft onOpenCommunity', /if \(kanalCommunity\) \{[\s\S]{0,120}onOpenCommunity\?\.\(kanalCommunity\.id\)/.test(chat));
  pruefe('11.2 App.tsx öffnet die Community-Homeseite', /onOpenCommunity=\{\(communityId\) => setOverlay\(\{ kind: 'community', communityId \}\)\}/.test(shell));
  pruefe('13.1 Home hat FilterPillen', /<FilterPillen pillen=\{FILTERS\}/.test(home));
  pruefe(
    '13.1 genau Alle | Öffentlich | Privat',
    /key: 'alle', label: 'Alle'[\s\S]*key: 'oeffentlich', label: 'Öffentlich'[\s\S]*key: 'privat', label: 'Privat'/.test(home)
  );
  const neu = lies('app/screens/communities/CommunityNeuerChatScreen.tsx');
  pruefe('14.1 Plus öffnet die Seite „Neuer Chat“', /onNewChat=\{\(\) => setOverlay\(\{ kind: 'neuerCommunityChat' \}\)\}/.test(shell));
  pruefe('14.1 Seite mit Suchleiste „Community-Profil suchen…“', /placeholder="Community-Profil suchen\.\.\."/.test(neu));
  pruefe('14.1 gesucht nach Name und Benutzername, nicht nach Nummer', /u\.name\.toLowerCase\(\)\.includes\(q\) \|\| u\.handle\.toLowerCase\(\)\.includes\(q\)/.test(neu) && !/phone/.test(neu));
  pruefe('14.2 Antippen öffnet den Community-Chat', /onChat=\{\(userId\) => void openChatWith\(userId, 'community'\)\}/.test(shell));
  pruefe(
    '13.2 Filterregel über beigetretenen Communitys',
    /c\.joined &&[\s\S]{0,60}\(filter === 'alle' \|\| \(filter === 'privat'\) === \(c\.visibility === 'private'\)\)/.test(home)
  );
}

/* --------------------------------------------------- B Website mit Attrappe */
async function teilB() {
  console.log(`\nB  Website mit Attrappe (${BASE})`);
  const { chromium } = require('playwright-core');
  const { attrappe, bestand, community, ICH } = require('./_attrappe');

  const daten = bestand({
    users: {
      [ICH]: { id: ICH, name: 'Test Konto', handle: 'test', initials: 'TK' },
      'u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: 'anna', initials: 'AS' },
      'u-ben': { id: 'u-ben', name: 'Ben Berg', handle: 'benno', initials: 'BB' },
    },
    communityChats: [{ id: 'cc-ben', name: 'Ben Berg', userId: 'u-ben', isGroup: false, preview: 'Hallo', time: '12:00', unread: 0 }],
    communities: [
      community('c-oeff', 'Fotografie', { visibility: 'public', members: 40 }),
      community('c-priv', 'Geheimclub', { visibility: 'private', members: 7 }),
      community('c-fremd', 'Kochen', { visibility: 'public', joined: false }),
    ],
  });

  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    const aufrufe = await attrappe(seite, daten, {
      '/api/communities/c-oeff/channels/c-oeff-k1': { messages: [] },
      '/api/kontakte/u-anna/chat': { ok: true, chatId: 'cc-anna', bereich: 'community' },
    });
    await seite.goto(BASE, { waitUntil: 'domcontentloaded' });
    await seite.waitForSelector('[data-area="communities"]', { timeout: 15000 });
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="home"]').catch(() => {});
    await seite.waitForSelector('[data-cfilter]', { timeout: 10000 });

    const pillen = await seite.$$eval('[data-cfilter]', (e) => e.map((p) => p.textContent.trim()));
    pruefe('13.1 Knöpfe Alle | Öffentlich | Privat', JSON.stringify(pillen) === '["Alle","Öffentlich","Privat"]', JSON.stringify(pillen));

    const liste = () => seite.$$eval('[data-community]', (e) => e.map((r) => r.dataset.community).sort().join(','));
    pruefe('13.2 Alle: beide beigetretenen, nicht „Kochen“', (await liste()) === 'c-oeff,c-priv', await liste());
    await seite.click('[data-cfilter="oeffentlich"]');
    pruefe('13.2 Öffentlich: nur Fotografie', (await liste()) === 'c-oeff', await liste());
    pruefe('13.2 Öffentlich ist markiert', await seite.$eval('[data-cfilter="oeffentlich"]', (p) => p.classList.contains('is-active')));
    await seite.click('[data-cfilter="privat"]');
    pruefe('13.2 Privat: nur Geheimclub', (await liste()) === 'c-priv', await liste());
    await seite.click('[data-cfilter="alle"]');
    pruefe('13.2 zurück auf Alle: wieder beide', (await liste()) === 'c-oeff,c-priv', await liste());
    if (process.env.BILDER) await seite.waitForTimeout(900), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-13-home.png') });

    // 11.1/11.2: Fotografie → Allgemein → Thema → Chat
    await seite.click('[data-community="c-oeff"]');
    await seite.waitForSelector('[data-channel]', { timeout: 10000 });
    await seite.click('[data-channel]');
    await seite.waitForSelector('[data-thema]', { timeout: 10000 });
    await seite.click('[data-thema]');
    await seite.waitForSelector('#commMsgs', { timeout: 10000 });
    const kopf = (await seite.textContent('#kanalKopf')).replace(/\s+/g, ' ').trim();
    pruefe('11.1 Kopf zeigt genau „# Allgemein“', kopf === '# Allgemein', kopf);
    pruefe('11.1 kein Community-Name im Kopf', !kopf.includes('Fotografie'), kopf);
    pruefe('11.1 keine Mitgliederzahl im Kopf', !/Mitglied/.test(kopf), kopf);
    if (process.env.BILDER) await seite.waitForTimeout(900), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-11-kopf.png') });
    await seite.click('#kanalKopf');
    await seite.waitForSelector('[data-channel]', { timeout: 5000 }).catch(() => {});
    const danach = await seite.locator('#main').textContent();
    pruefe(
      '11.2 Kopf führt auf die Homeseite der Community',
      (await seite.locator('[data-channel]').count()) > 0 && danach.includes('Fotografie') && !(await seite.$('#commMsgs')),
      danach.trim().slice(0, 80)
    );

    // 14.1/14.2: Plus unter Communitys → Chats
    await seite.click('[data-sub="chats"]');
    await seite.waitForSelector('#commNewChat', { timeout: 10000 });
    await seite.click('#commNewChat');
    await seite.waitForSelector('[data-commneuerchat]', { timeout: 5000 }).catch(() => {});
    pruefe('14.1 Plus öffnet die Seite „Neuer Chat“', !!(await seite.$('[data-commneuerchat]')) && (await seite.textContent('.pagehead__title')).trim() === 'Neuer Chat');
    pruefe('14.1 kein Blatt mit „Kontakt hinzufügen“', !(await seite.$('[data-cneu]')));
    pruefe('14.1 Bereich bleibt Chats', (await seite.$eval('#topbar .is-active', (n) => n.dataset.sub)) === 'chats');
    const personen = () => seite.$$eval('[data-neuerchat]', (e) => e.map((b) => b.dataset.neuerchat).sort().join(','));
    pruefe('14.1 ohne Eingabe alle Profile außer mir', (await personen()) === 'u-anna,u-ben', await personen()); // ohne 'me'
    await seite.fill('#commNeuerChatInput', 'ann');
    await seite.waitForTimeout(150);
    pruefe('14.1 Suche „ann“ findet nur Anna', (await personen()) === 'u-anna', await personen());
    await seite.fill('#commNeuerChatInput', 'benno');
    await seite.waitForTimeout(150);
    pruefe('14.1 Suche über den Benutzernamen', (await personen()) === 'u-ben', await personen());
    if (process.env.BILDER) await seite.waitForTimeout(900), await seite.screenshot({ path: path.join(process.env.BILDER, 'k28-14-neuer-chat.png') });
    // Ben hat schon einen Community-Chat → direkt öffnen, ohne Server
    const vorher = aufrufe.length;
    await seite.click('[data-neuerchat="u-ben"]');
    await seite.waitForSelector('#chatBack', { timeout: 5000 }).catch(() => {});
    pruefe('14.2 vorhandener Chat geht direkt auf', !!(await seite.$('#chatBack')));
    pruefe('14.2 dafür kein neuer Chat beim Server', !aufrufe.slice(vorher).some((a) => a.pfad.endsWith('/chat') && a.methode === 'POST'));
    // Anna hat keinen → Server legt einen Community-Chat an
    await seite.click('#chatBack');
    await seite.click('[data-sub="chats"]');
    await seite.click('#commNewChat');
    await seite.waitForSelector('[data-neuerchat="u-anna"]', { timeout: 5000 });
    await seite.click('[data-neuerchat="u-anna"]');
    await seite.waitForTimeout(800);
    const anlage = aufrufe.find((a) => a.pfad === '/api/kontakte/u-anna/chat' && a.methode === 'POST');
    pruefe('14.2 neuer Chat mit bereich „community“', !!anlage && JSON.parse(anlage.body || '{}').bereich === 'community', JSON.stringify(anlage));
    pruefe('keine Fehler in der Seite', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_BROWSER && !process.env.WURZEL) await teilB();
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
