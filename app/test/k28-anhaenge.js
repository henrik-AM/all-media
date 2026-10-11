#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kasten 6 — Agent „Anhänge".
 *
 *   6.1  „Foto aufnehmen", „GIF senden", „Sticker" nicht mehr im Anhang-Blatt;
 *        die Kamera bleibt erreichbar (Eingabefeld, auch im Unterthema).
 *   6.2  Anhang-Blatt als Raster runder, farbiger Symbole (WhatsApp-Vorbild).
 *   6.3  Knopf „GIFs und Sticker" rechts im Eingabefeld, Blatt GIF | Sticker.
 *   6.5  Standort senden: Suche + Karte statt fester Vorschläge.
 *   6.6  Dasselbe Blatt in Messenger, Gruppe, Community-Chat und Unterthema.
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Quelltext beider Seiten (ohne Server): dieselben Punkte, dieselben
 *      Kurztexte und Farben, dieselbe „Standort anfragen"-Regel, Baustein
 *      ortsuche.js eingebunden (UMD_BAUSTEINE, index.html), keine feste
 *      Ortsliste mehr.
 *   B  Website (Playwright gegen Port 3000, Prüfkonto @prueflauf), im
 *      Zweierchat mit @test und im Unterthema einer eigenen Prüfcommunity:
 *      Blatt-Inhalt, GIF/Sticker-Blatt, Sticker senden, Standort über die
 *      Suche senden. Nominatim wird im Browser abgefangen (page.route) —
 *      der Lauf schickt keine einzige Anfrage an den echten Dienst.
 *   C  Wirkung mit zwei Konten: @test liest über Supabase den gesendeten
 *      Standort im Zweierchat — als Klartext mit geo:-Zeile, oder (wenn der
 *      Chat verschlüsselt ist) als Chiffre MIT Kuvert für ein Gerät von
 *      @test. Im Unterthema liest das Prüfkonto die Zeile zurück und
 *      gemeinsam/ortsuche.js macht daraus den Ort.
 *
 * WAS ER NICHT ZEIGT: die App. Dafür im Simulator „All-Media Test":
 *   Chat öffnen → „Anhang" → Raster (Galerie, Dokument, Standort,
 *   Live-Standort, [Standort anfragen], Kontakt) → „Standort" → „Ort oder
 *   Adresse suchen" → „Suchen" → Treffer → „Diesen Ort senden" → Karte in
 *   der Blase → antippen → „In OpenStreetMap öffnen". „GIFs und Sticker" →
 *   „Sticker" / „GIF". „Kamera" im Eingabefeld → eigene Kamera.
 *
 * UNGETESTET geschrieben am 11.10.2026 (Supabase gesperrt, 402).
 *
 * Start:  node test/k28-anhaenge.js   (npm run test:k28-anhaenge)
 *         OHNE_BROWSER=1 überspringt B und C.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { nurTestkonto } = require('./_nur_testkonten');
const { vorbereiten, beenden, schliesse } = require('./_konto');
const OrtSuche = require('../../gemeinsam/ortsuche');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const BASIS = process.env.BASIS || 'http://localhost:3000';

const FREMDER = { email: 'test@all-media.app', passwort: TESTKONTO_PASS };
const PRUEFER = {
  email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
  passwort: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
};

// Der eine Treffer, den die abgefangene Ortssuche liefert.
const ORT = { lat: '48.137154', lon: '11.576124', name: 'Prüfplatz', address: { road: 'Prüfweg', house_number: '7', postcode: '80331', city: 'München' } };

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};
const pruefeAsync = async (name, fn) => {
  try {
    await fn();
    pruefe(name, true);
  } catch (e) {
    pruefe(name, false, e.message || String(e));
  }
};

/* ------------------------------------------------------------- A Quelltext */
function teilA() {
  console.log('A  Quelltext');
  const blatt = lies('app/components/AnhangSheet.tsx');
  const chat = lies('app/screens/messenger/ChatDetailScreen.tsx');
  const gs = lies('app/components/GifStickerSheet.tsx');
  const web = lies('web/public/app.js');
  const html = lies('web/public/index.html');
  const modul = lies('app/test/_modulquelle.js');

  const punkteApp = [...blatt.slice(blatt.indexOf('const PUNKTE')).matchAll(/key: '(\w+)'/g)].map((m) => m[1]);
  const webPunkteTeil = web.slice(web.indexOf('function openAnhang('), web.indexOf('openSheet(', web.indexOf('function openAnhang(')));
  const punkteWeb = [...webPunkteTeil.matchAll(/\{ key: '(\w+)', label/g)].map((m) => m[1]);
  // Erst die Umgebung: ohne gefundene Punkte wäre jedes „ohne X" sofort wahr.
  pruefe('Punktlisten gefunden (App ≥ 5, Website ≥ 4)', punkteApp.length >= 5 && punkteWeb.length >= 4, punkteApp.length + '/' + punkteWeb.length);
  for (const weg of ['kamera', 'gif', 'sticker']) {
    pruefe(`6.1 App-Blatt ohne „${weg}"`, !punkteApp.includes(weg), punkteApp.join(','));
    pruefe(`6.1 Website-Blatt ohne „${weg}"`, !punkteWeb.includes(weg), punkteWeb.join(','));
  }
  pruefe('6.1 Kamera im App-Eingabefeld öffnet die eigene Kamera', /accessibilityLabel="Kamera"/.test(chat) && /wennFrei\(\(\) => setKameraAuf\(true\)\)/.test(chat));
  pruefe('6.1 Kamera im Website-Unterthema', web.includes('id="commKamera"') && web.includes("anhangSenden(kanalZiel, 'kamera')"));

  const farbenApp = blatt.match(/const FARBEN[^}]+\}/)?.[0] || '';
  const farbenWeb = web.match(/const ANHANG_FARBEN = \{[^}]+\}/)?.[0] || '';
  const paare = (t) => [...t.matchAll(/(\w+): '(#[0-9A-Fa-f]{6})'/g)].map((m) => m[1] + '=' + m[2].toUpperCase()).sort().join(',');
  pruefe('6.2 gleiche Farben App/Website', paare(farbenApp) && paare(farbenApp) === paare(farbenWeb), paare(farbenApp) + ' | ' + paare(farbenWeb));
  const kurz = (t, name) => [...(t.match(new RegExp(name + '[^}]+\\}'))?.[0] || '').matchAll(/(\w+): '([^']+)'/g)].map((m) => m[1] + '=' + m[2]).sort().join(',');
  pruefe('6.2 gleiche Kurztexte App/Website', kurz(blatt, 'const KURZ') === kurz(web, 'const ANHANG_KURZ'));
  pruefe('6.2 Raster statt Liste (App)', blatt.includes('styles.raster') && blatt.includes('styles.kreis'));
  pruefe('6.2 Raster statt Liste (Website)', web.includes('class="anhangraster"'));

  pruefe('6.3 Knopf „GIFs und Sticker" im App-Eingabefeld', chat.includes('accessibilityLabel="GIFs und Sticker"') && chat.includes('<GifStickerSheet'));
  pruefe('6.3 Knopf im Website-Chat und -Unterthema', web.includes('id="gifStickerBtn"') && web.includes('id="commGifSticker"'));
  pruefe('6.3 Reiter GIF | Sticker auf beiden Seiten', /'gif', 'sticker'/.test(gs) && web.includes('data-reiter="gif"') && web.includes('data-reiter="sticker"'));

  pruefe('6.5 keine feste Ortsliste mehr (App)', !/alleOrte\.map/.test(blatt) && blatt.includes('<StandortWahl'));
  pruefe('6.5 keine feste Ortsliste mehr (Website)', !/state\.places\s*\.map\(\s*\(p\) => `<button class="item" data-ort=/.test(web) && web.includes("if (art === 'standort') return openStandortWahl(ziel);"));
  pruefe('6.5 Baustein ortsuche in UMD_BAUSTEINE und index.html', modul.includes("['ortsuche', 'OrtSuche']") && html.includes('/gemeinsam/ortsuche.js'));
  pruefe('6.5 Blase liest den Ort aus dem Text (App + Website)', chat.includes('OrtSuche.ausText(item.text)') && web.includes('window.OrtSuche.ausText(m.text)'));
  pruefe('6.5 Quellenangabe sichtbar (App + Website)', lies('app/components/StandortWahl.tsx').includes('OrtSuche.QUELLE') && web.includes('esc(O.QUELLE)'));

  pruefe('6.6 „Standort anfragen" nur im Zweierchat (App)', chat.includes("ohne={istKanal || !chat.userId ? ['standortAnfragen'] : []}"));
  pruefe('6.6 „Standort anfragen" nur im Zweierchat (Website)', web.includes("ohne: chat.userId ? [] : ['standortAnfragen'],"));
  pruefe('6.6 ein Blatt für alle Chats (App: genau eine Verwendung)', (chat.match(/<AnhangSheet/g) || []).length === 1);
}

/* ------------------------------------------------------- B/C Website + DB */
async function direkt(zugang) {
  const client = createClient(URL, KEY);
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

async function teilBC() {
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(10000);
  const jsFehler = [];
  page.on('pageerror', (e) => jsFehler.push(e.message));

  // Nominatim abfangen: kein Netzverkehr zum echten Dienst.
  let ortsAnfragen = 0;
  await page.route('https://nominatim.openstreetmap.org/**', (route) => {
    ortsAnfragen++;
    const body = route.request().url().includes('/reverse') ? ORT : [ORT];
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  if (!(await vorbereiten(page, BASIS))) await beenden(browser, 1);
  await page.waitForSelector('[data-area]', { timeout: 20000 });

  let pruefer = null;
  let fremder = null;
  try {
    pruefer = await direkt(PRUEFER);
    fremder = await direkt(FREMDER);
  } catch (e) {
    pruefe('Beide Konten melden sich an', false, e.message);
  }

  const aufraeumen = () =>
    page.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
    });
  const kachelTexte = () => page.$$eval('.anhangraster__text', (els) => els.map((e) => e.textContent.trim()));

  /* ------------------------------------------------ Zweierchat mit @test */
  console.log('\nB  Website — Zweierchat mit @test');
  let chatId = null;
  if (pruefer && fremder) {
    const { data: meine } = await pruefer.client.from('chat_members').select('chat_id, chats(is_group)').eq('user_id', pruefer.id);
    const ids = (meine || []).filter((m) => m.chats && !m.chats.is_group).map((m) => m.chat_id);
    if (ids.length) {
      const { data: andere } = await pruefer.client.from('chat_members').select('chat_id').in('chat_id', ids).eq('user_id', fremder.id);
      chatId = andere?.[0]?.chat_id || null;
    }
  }
  pruefe('Zweierchat @prueflauf ↔ @test vorhanden (Testbestand)', !!chatId);

  if (chatId) {
    await page.evaluate((id) => window.openChat(id), chatId);
    await page.waitForSelector('#attach');

    await pruefeAsync('6.1/6.2 Anhang-Blatt im Zweierchat: Raster ohne Kamera/GIF/Sticker', async () => {
      await page.click('#attach');
      await page.waitForSelector('.anhangraster__kachel');
      const t = await kachelTexte();
      const soll = ['Galerie', 'Dokument', 'Standort', 'Standort anfragen', 'Kontakt'];
      if (JSON.stringify(t) !== JSON.stringify(soll)) throw new Error(t.join(' | '));
      const runde = await page.$eval('.anhangraster__kreis', (e) => getComputedStyle(e).borderRadius);
      if (!/50%|29px/.test(runde)) throw new Error('Symbol nicht rund: ' + runde);
      await aufraeumen();
    });

    await pruefeAsync('6.1 Kamera-Knopf im Eingabefeld vorhanden', async () => {
      if (!(await page.$('#camBtn'))) throw new Error('#camBtn fehlt');
    });

    await pruefeAsync('6.3 GIF/Sticker-Knopf öffnet Reiter, Sticker landet im Chat', async () => {
      const vorher = await page.$$eval('.msg__sticker', (e) => e.length);
      await page.click('#gifStickerBtn');
      await page.waitForSelector('[data-reiter="gif"]');
      await page.click('[data-reiter="gif"]');
      if (!(await page.isVisible('[data-gifwahl]'))) throw new Error('GIF-Reiter zeigt keinen Galerie-Knopf');
      await page.click('[data-reiter="sticker"]');
      await page.click('[data-sticker]');
      await page.waitForFunction((n) => document.querySelectorAll('.msg__sticker').length > n, vorher);
    });

    await pruefeAsync('6.5 Standort über die Suche senden → Karte in der Blase', async () => {
      await page.click('#attach');
      await page.click('[data-anhang="standort"]');
      await page.waitForSelector('#ortSucheFeld');
      await page.fill('#ortSucheFeld', 'Prüfplatz München');
      await page.click('#ortSucheKnopf');
      await page.waitForSelector('[data-treffer="0"]');
      await page.click('[data-treffer="0"]');
      await page.click('#ortSenden');
      await page.waitForSelector('.msg__standort[data-msglat]');
      const name = await page.$eval('.msg__standort[data-msglat]:last-of-type .msg__standortName', (e) => e.textContent.trim());
      if (name !== 'Prüfplatz') throw new Error('Name in der Blase: ' + name);
    });
    pruefe('6.5 Ortssuche abgefangen, nicht am echten Dienst', ortsAnfragen >= 1, String(ortsAnfragen));

    await pruefeAsync('6.5 Antippen öffnet die Karte des Ortes', async () => {
      await page.click('.msg__standort[data-msglat]');
      await page.waitForSelector('#ortAnsichtKarte');
      await aufraeumen();
    });

    console.log('\nC  Wirkung — @test liest den Standort');
    await pruefeAsync('6.5 @test sieht den Standort (Klartext mit geo:-Zeile oder Chiffre mit Kuvert für @test)', async () => {
      const { data, error } = await fremder.client
        .from('messages')
        .select('id, text, krypto, place_id, sender_id')
        .eq('chat_id', chatId)
        .eq('sender_id', pruefer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) throw error;
      if (data.place_id) throw new Error('place_id gesetzt — frei gewählter Ort gehört in den Text');
      if (Number(data.krypto) > 0) {
        if (data.text) throw new Error('verschlüsselt, aber Klartext in text');
        const { data: schluessel } = await fremder.client.from('krypto_schluessel').select('id').eq('user_id', fremder.id);
        const ids = (schluessel || []).map((s) => s.id);
        if (!ids.length) throw new Error('@test hat kein Gerät — Kuvert nicht prüfbar');
        const { count } = await fremder.client.from('message_keys').select('*', { count: 'exact', head: true }).eq('message_id', data.id).in('schluessel_id', ids);
        if (!count) throw new Error('kein Kuvert für @test');
      } else {
        const ort = OrtSuche.ausText(data.text);
        if (!ort || ort.name !== 'Prüfplatz' || Math.abs(ort.lat - 48.137154) > 1e-5) throw new Error('Text: ' + JSON.stringify(data.text));
      }
    });
  }

  /* ---------------------------------------------- Unterthema (Prüfcommunity) */
  console.log('\nB  Website — Unterthema einer Prüfcommunity');
  const neu = await page.evaluate(async (name) =>
    (await fetch('/api/communities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, thema: 'Prüflauf', sichtbarkeit: 'private' }),
    })).json(), 'Prüfanhang ' + Date.now().toString(36));
  const communityId = neu.community?.id;
  pruefe('Prüfcommunity angelegt (zuruecksetzen() räumt sie ab)', !!communityId, neu.error || '');

  if (communityId && pruefer) {
    const { data: kanal } = await pruefer.client.from('community_channels').select('id, name').eq('community_id', communityId).limit(1).single();
    pruefe('Unterthema vorhanden', !!kanal?.id);
    if (kanal?.id) {
      await page.evaluate(
        ({ c, k }) => {
          const community = ((typeof state !== 'undefined' && state.communities) || []).find((x) => x.id === c) || { id: c, name: 'Prüfanhang' };
          return window.renderCommunityChat(community, k, k.name);
        },
        { c: communityId, k: kanal }
      );
      await page.waitForSelector('#commAttach');

      await pruefeAsync('6.6 Unterthema: dasselbe Raster, ohne „Standort anfragen"', async () => {
        await page.click('#commAttach');
        await page.waitForSelector('.anhangraster__kachel');
        const t = await kachelTexte();
        const soll = ['Galerie', 'Dokument', 'Standort', 'Kontakt'];
        if (JSON.stringify(t) !== JSON.stringify(soll)) throw new Error(t.join(' | '));
        await aufraeumen();
      });
      await pruefeAsync('6.1/6.3 Unterthema: Kamera und GIF/Sticker im Eingabefeld', async () => {
        if (!(await page.$('#commKamera'))) throw new Error('#commKamera fehlt');
        await page.click('#commGifSticker');
        await page.waitForSelector('[data-sticker]');
        await page.click('[data-sticker]');
        await page.waitForSelector('#commMsgs .msg__sticker');
      });
      await pruefeAsync('6.5 Unterthema: Standort senden → Zeile in community_channel_messages', async () => {
        await page.click('#commAttach');
        await page.click('[data-anhang="standort"]');
        await page.fill('#ortSucheFeld', 'Prüfplatz');
        await page.click('#ortSucheKnopf');
        await page.click('[data-treffer="0"]');
        await page.click('#ortSenden');
        await page.waitForSelector('#commMsgs .msg__standort[data-msglat]');
        const { data } = await pruefer.client
          .from('community_channel_messages')
          .select('text, place_id')
          .eq('channel_id', kanal.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        const ort = OrtSuche.ausText(data?.text);
        if (!ort || ort.name !== 'Prüfplatz' || data.place_id) throw new Error(JSON.stringify(data));
      });
    }
  }

  pruefe('Keine Skriptfehler auf der Seite', jsFehler.length === 0, jsFehler.slice(0, 3).join(' | '));
  await schliesse(browser);
}

(async () => {
  teilA();
  if (process.env.OHNE_BROWSER) {
    console.log('\nB/C übersprungen (OHNE_BROWSER).');
  } else if (!URL || !KEY) {
    pruefe('SUPABASE_URL/ANON_KEY vorhanden', false);
  } else {
    try {
      await teilBC();
    } catch (e) {
      pruefe('Lauf B/C ohne Abbruch', false, e.message);
    }
  }
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
