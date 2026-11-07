#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Kästen 4 und 7 — Agent „Chatblase".
 *
 *   4.1  Nachricht nach rechts ziehen → Antwort, unter Communitys → Chats
 *   4.2  Dasselbe im Chat eines Unterthemas (neu: reply_to, Schema XX)
 *   4.3  Dasselbe in Chats, die aus Videos geöffnet werden
 *   4.4  Website: Ziehen mit der Maus und Antworten-Knopf beim Überfahren
 *   7.1  Geteilter Beitrag als große Karte mit Vorschaubild
 *   7.2  Darunter Name (posts.title) und Beschreibung (posts.description)
 *   7.3  Antippen öffnet den Beitrag
 *   7.4  In allen Chats: Messenger, Communitys, Unterthema
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Netz: der gemeinsame Baustein gemeinsam/chatblase.js (Schwelle,
 *      Weg, Bezug, Karte, „nicht mehr verfügbar") und die Verdrahtung beider
 *      Seiten im Quelltext — dieselbe Komponente in jedem App-Chat, beide
 *      Website-Listen gebunden, Baustein in UMD_BAUSTEINE und index.html.
 *   B  Wirkung mit zwei Konten direkt an Supabase (Unterthema, 4.2):
 *      @prueflauf legt eine Prüfcommunity mit zwei Unterthemen an und
 *      schreibt; @test tritt bei und antwortet mit reply_to. @prueflauf
 *      liest den Bezug. Eine Antwort über Unterthemen hinweg wird abgewiesen
 *      (Regel „Antwort nur im selben Unterthema"). @test teilt einen eigenen
 *      Beitrag hinein (Kasten 7, Unterthema).
 *   C  Website (Playwright gegen Port 3000, @prueflauf): der Server liefert
 *      im Unterthema antwortAuf und die Karte (titel/beschreibung/kind);
 *      die Seite zeichnet Bezug, Antworten-Knopf und Karte; Ziehen mit der
 *      Maus setzt die Leiste „Antworten"; Senden schickt reply_to, das @test
 *      über Supabase liest; Klick auf die Karte öffnet den Beitrag.
 *   Am Ende löscht @prueflauf die Prüfcommunity (cascade) und prüft nach.
 *
 * WAS ER NICHT ZEIGT: die App-Oberfläche. Im Simulator „All-Media Test"
 * (siehe Bericht): Ziehen kann mac:tippen nicht — Antworten dort über langes
 * Drücken → „Antworten" oder die VoiceOver-Aktion „Antworten".
 *
 * UNGETESTET geschrieben am 10.10.2026 (Supabase gesperrt, 402). Teil A lief
 * ohne Netz grün (OHNE_NETZ=1).
 *
 * Start:  node test/k28-chatblase.js   (npm run test:k28-chatblase)
 *         OHNE_NETZ=1 nur Teil A.  OHNE_BROWSER=1 überspringt C.
 */

const fs = require('fs');
const path = require('path');

const WURZEL = path.join(__dirname, '..', '..');
const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
const Chatblase = require('../../gemeinsam/chatblase');

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

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log('\nA  Baustein und Verdrahtung (ohne Netz)');
  const C = Chatblase;
  pruefe('Ziehen: waagrecht nach rechts zählt', C.istZug(30, 5));
  pruefe('Ziehen: schräg/senkrecht gehört dem Bildlauf', !C.istZug(30, 20) && !C.istZug(5, 40));
  pruefe('Ziehen: nach links nie', !C.istZug(-40, 0) && C.zugWeg(-40) === 0);
  pruefe('Ziehen: unter der Schwelle kein Antworten', !C.ausgeloest(C.ZIEH_SCHWELLE - 1));
  pruefe('Ziehen: ab der Schwelle Antworten', C.ausgeloest(C.ZIEH_SCHWELLE));
  pruefe('Ziehen: Weg gedeckelt', C.zugWeg(1000) === C.ZIEH_MAX);

  const alle = [
    { id: 'a', sender_id: 'u1', text: 'Original' },
    { id: 'b', sender_id: 'me', text: 'Antwort', reply_to: 'a' },
    { id: 'c', sender_id: 'u1', text: 'auf Alt', reply_to: 'weg' },
  ];
  const b = C.kanalBezug(alle[1], alle, 'me', { u1: 'Anna' });
  pruefe('4.2 Bezug: Autor und Text aus dem Original', b && b.id === 'a' && b.autor === 'Anna' && b.text === 'Original');
  const c = C.kanalBezug(alle[2], alle, 'me', {});
  pruefe('4.2 Bezug: Original nicht geladen → ehrlich markiert, kein erfundener Text', c && c.fehlt === true && c.text === '');
  pruefe('4.2 Ohne reply_to kein Bezug', C.kanalBezug(alle[0], alle, 'me', {}) === undefined);
  pruefe('Fehlende Spalte wird erkannt (42703 / PGRST204)',
    C.fehltSpalte({ code: '42703', message: 'column community_channel_messages.reply_to does not exist' }, 'reply_to') &&
      C.fehltSpalte({ code: 'PGRST204', message: "Could not find the 'reply_to' column" }, 'reply_to') &&
      !C.fehltSpalte({ code: '42501', message: 'row-level security' }, 'reply_to'));

  const g = C.geteiltAus('p1', {
    id: 'p1', kind: 'clip', title: 'Titel', description: 'Beschreibung', thumbnail_url: 'https://x/t.jpg',
    media_url: 'https://x/v.mp4', profiles: { name: 'Anna', handle: 'anna' },
  });
  pruefe('7.1 Karte: Vorschaubild bevorzugt thumbnail_url', g.bild === 'https://x/t.jpg');
  pruefe('7.2 Karte: Name = posts.title, Beschreibung = posts.description', g.titel === 'Titel' && g.beschreibung === 'Beschreibung');
  pruefe('7.3 Karte: kind zum Öffnen (clip/reel/post)', g.kind === 'clip' && g.art === 'video');
  const ohneTitel = C.geteiltAus('p2', { id: 'p2', kind: 'post', title: '', description: 'Nur Text' });
  pruefe('7.2 Ohne Titel steht die Beschreibung einmal, nichts erfunden', ohneTitel.titel === '' && ohneTitel.beschreibung === 'Nur Text');
  pruefe('7.x Nicht sichtbarer Beitrag → „Beitrag nicht mehr verfügbar"',
    C.geteiltAus('p3', null).weg === true && C.GETEILT_WEG === 'Beitrag nicht mehr verfügbar');
  pruefe('Keine Karte ohne geteilten Beitrag', C.geteiltAus(null, null) === undefined);

  const chat = lies('app/screens/messenger/ChatDetailScreen.tsx');
  const appTsx = lies('app/App.tsx');
  const daten = lies('app/lib/daten.ts');
  const akt = lies('app/lib/aktionen.ts');
  const web = lies('web/public/app.js');
  const css = lies('web/public/styles.css');
  const html = lies('web/public/index.html');
  const api = lies('web/server/supabase-api.js');
  const sync = lies('web/server/sync-handlers.js');
  const srv = lies('web/server/app.js');

  pruefe('4.1/4.2/4.3 App: jede Blase steckt in ZiehZumAntworten (ein Bildschirm für alle Chats)',
    /<ZiehZumAntworten[\s\S]*setBezug\(\{ art: 'antwort', nachricht: item \}\)/.test(chat));
  pruefe('4.x App: Ziehen über PanResponder (Expo Go, kein neues Paket)',
    /PanResponder\.create/.test(lies('app/components/ZiehZumAntworten.tsx')));
  pruefe('4.x App: VoiceOver-Aktion „Antworten" als zweiter Weg',
    /accessibilityActions=.*antworten/.test(lies('app/components/ZiehZumAntworten.tsx')));
  pruefe('4.x App: Zitat antippen springt zum Original', /onPress=\{\(\) => zuNachricht\(item\.antwortAuf!\.id\)\}/.test(chat));
  pruefe('4.2 App: Kanalnachricht schickt reply_to mit', /kanalNachricht\(supabase, ichId, chat\.id, text, \{\}, bezug \?/.test(chat) && /zeile\.reply_to = antwortAuf/.test(akt));
  pruefe('4.2 App: Kanal lädt reply_to und baut den Bezug', /zusatz = \['reply_to'/.test(daten) && /Chatblase\.kanalBezug\(m, alleZeilen/.test(daten));
  pruefe('4.2 Server: dasselbe beim Laden und Schreiben',
    /Chatblase\.kanalBezug\(m, alleZeilen/.test(api) && /zeile\.reply_to = antwortAuf/.test(sync) && /req\.body\?\.antwortAuf/.test(srv));
  pruefe('4.4 Website: Chat und Unterthema binden Ziehen/Knopf/Sprung',
    (web.match(/antwortenBinden\(/g) || []).length >= 3 && /data-ziehbar/.test(web) && /msg__antworten/.test(css));
  pruefe('4.4 Website: Knopf nur beim Überfahren, ohne Maus wird gezogen', /@media \(hover: none\) \{ \.msg__antworten \{ display: none; \} \}/.test(css));
  pruefe('4.4 Website: Ziehen bricht das lange Drücken ab', /addEventListener\('ziehstart', ende\)/.test(web));

  pruefe('7.x App + Server: dieselbe Abbildung (geteiltAus) in Chat UND Unterthema',
    (daten.match(/Chatblase\.geteiltAus\(/g) || []).length === 2 && (api.match(/Chatblase\.geteiltAus\(/g) || []).length === 2);
  pruefe('7.2 Name/Konto: Einbettung holt name und handle', /profiles!posts_user_id_fkey\(name, handle\)/.test(lies('gemeinsam/spalten.js')));
  pruefe('7.3 App: Karte öffnet den Beitrag (onOpenBeitrag → kachelOeffnen)',
    /onOpenBeitrag=\{\(b\) => kachelOeffnen\(b\)\}/.test(appTsx) && /onOpenBeitrag\(\{ id: g\.id, kind: g\.kind/.test(chat));
  pruefe('7.3 Website: Karte öffnet den Beitrag in Chat und Unterthema',
    /beitragOeffnen\(b\.dataset\.beitragkind, b\.dataset\.beitrag\)/.test(web) && (web.match(/geteiltBinden\(/g) || []).length >= 2);
  pruefe('7.1 Großes Vorschaubild auf beiden Seiten', /geteiltBild: \{ width: 248, height: 310 \}/.test(chat) && /\.msg__geteiltRahmen \{[^}]*aspect-ratio: 4 \/ 5/.test(css));

  pruefe('Baustein in UMD_BAUSTEINE', /\['chatblase', 'Chatblase'\]/.test(lies('app/test/_modulquelle.js')));
  pruefe('Baustein in index.html', /<script src="\/gemeinsam\/chatblase\.js"><\/script>/.test(html));
  pruefe('Baustein hat .d.ts', fs.existsSync(path.join(WURZEL, 'gemeinsam/chatblase.d.ts')));
  pruefe('Schema-Entwurf: Spalte + einschränkende Regel',
    (() => {
      const f = fs.readdirSync(WURZEL).find((n) => /^SUPABASE_SCHEMA_\w+_antworten_im_unterthema\.sql$/.test(n));
      if (!f) return false;
      const sql = lies(f);
      return /add column if not exists reply_to/.test(sql) && /as restrictive/.test(sql);
    })());
}

/* ---------------------------------------------- B + C mit zwei Konten */
async function teilBC() {
  const { createClient } = require('@supabase/supabase-js');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const { nurTestkonto } = require('./_nur_testkonten');

  const UMG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
    : '';
  const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
  const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
  const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  const BASIS = process.env.BASIS || 'http://localhost:3000';
  if (!URL || !KEY) {
    pruefe('Supabase-Zugang aus app/.env.local', false, 'EXPO_PUBLIC_SUPABASE_URL/ANON_KEY fehlen');
    return;
  }

  console.log('\nB  Unterthema mit zwei Konten (Supabase)');
  const pr = createClient(URL, KEY);
  const te = createClient(URL, KEY);
  const a1 = await pr.auth.signInWithPassword({
    email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
    password: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
  });
  const a2 = await te.auth.signInWithPassword({ email: nurTestkonto('test@all-media.app'), password: TESTKONTO_PASS });
  pruefe('Beide Testkonten melden sich an', !a1.error && !a2.error, (a1.error || a2.error)?.message);
  if (a1.error || a2.error) return;
  const prId = a1.data.user.id;
  const teId = a2.data.user.id;

  let communityId = null;
  let kanal1 = null;
  let kanal2 = null;
  let original = null;
  let antwortVonTest = null;
  let beitrag = null;

  try {
    await pruefeAsync('Prüfcommunity mit zwei Unterthemen anlegen (@prueflauf)', async () => {
      const { data, error } = await pr.from('communities')
        .insert({ name: 'Prüfcommunity Chatblase ' + Date.now(), topic: 'Prüflauf k28', visibility: 'public', created_by: prId })
        .select('id').single();
      if (error) throw error;
      communityId = data.id;
      const m = await pr.from('community_members').insert({ community_id: communityId, user_id: prId });
      if (m.error) throw m.error;
      const k = await pr.from('community_channels')
        // slug ist Pflicht (wie aktionen.ts/Server beim Anlegen).
        .insert([{ community_id: communityId, slug: 'eins', name: 'Eins', position: 0 }, { community_id: communityId, slug: 'zwei', name: 'Zwei', position: 1 }])
        .select('id, name');
      if (k.error) throw k.error;
      kanal1 = k.data.find((x) => x.name === 'Eins').id;
      kanal2 = k.data.find((x) => x.name === 'Zwei').id;
    });
    if (!communityId) return;

    await pruefeAsync('@test tritt bei', async () => {
      const { error } = await te.from('community_members').insert({ community_id: communityId, user_id: teId });
      if (error) throw error;
    });

    await pruefeAsync('@prueflauf schreibt das Original', async () => {
      const { data, error } = await pr.from('community_channel_messages')
        .insert({ channel_id: kanal1, sender_id: prId, text: 'Original k28' }).select('id').single();
      if (error) throw error;
      original = data.id;
    });

    await pruefeAsync('4.2 @test antwortet mit reply_to (Schema XX eingespielt?)', async () => {
      const { data, error } = await te.from('community_channel_messages')
        .insert({ channel_id: kanal1, sender_id: teId, text: 'Antwort k28', reply_to: original }).select('id').single();
      if (error) throw new Error(error.message + (Chatblase.fehltSpalte(error, 'reply_to') ? ' — Schema XX fehlt' : ''));
      antwortVonTest = data.id;
    });

    await pruefeAsync('4.2 Wirkung: @prueflauf liest den Bezug der fremden Antwort', async () => {
      const { data, error } = await pr.from('community_channel_messages').select('id, reply_to').eq('id', antwortVonTest).single();
      if (error) throw error;
      if (data.reply_to !== original) throw new Error('reply_to = ' + data.reply_to);
    });

    await pruefeAsync('4.2 Regel: Antwort über Unterthemen hinweg wird abgewiesen', async () => {
      const { error } = await te.from('community_channel_messages')
        .insert({ channel_id: kanal2, sender_id: teId, text: 'falscher Kanal', reply_to: original });
      if (!error) throw new Error('wurde angenommen');
    });

    // Kasten 7 im Unterthema: @test teilt einen eigenen Beitrag.
    const { data: posts } = await te.from('posts').select('id, kind, title, description').eq('user_id', teId)
      .order('created_at', { ascending: false }).limit(1);
    beitrag = (posts || [])[0] || null;
    pruefe('7.x @test hat einen eigenen Beitrag zum Teilen', !!beitrag, 'Testbestand ohne Beitrag von @test');
    if (beitrag) {
      await pruefeAsync('7.4 @test teilt den Beitrag ins Unterthema', async () => {
        const { error } = await te.from('community_channel_messages')
          .insert({ channel_id: kanal1, sender_id: teId, text: 'Beitrag geteilt', shared_post_id: beitrag.id });
        if (error) throw error;
      });
    }

    /* ------------------------------------------------------- C Website */
    if (process.env.OHNE_BROWSER) return;
    console.log('\nC  Website (Port 3000, @prueflauf)');
    const { chromium } = require('playwright-core');
    const { vorbereiten, schliesse } = require('./_konto');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
      const ok = await vorbereiten(page, BASIS);
      if (ok === false) {
        pruefe('Website-Anmeldung', false);
        return;
      }
      const holen = () =>
        page.evaluate(([c, k]) => fetch(`/api/communities/${c}/channels/${k}`).then((r) => r.json()), [communityId, kanal1]);
      let kanalDaten = null;
      await pruefeAsync('4.2 Server liefert antwortAuf mit Autor und Text des Originals', async () => {
        kanalDaten = await holen();
        const m = (kanalDaten.messages || []).find((x) => x.id === antwortVonTest);
        if (!m?.antwortAuf) throw new Error('kein antwortAuf');
        if (m.antwortAuf.id !== original || m.antwortAuf.text !== 'Original k28' || m.antwortAuf.autor !== 'Du')
          throw new Error(JSON.stringify(m.antwortAuf));
      });
      if (beitrag) {
        await pruefeAsync('7.2 Server liefert die Karte mit Titel/Beschreibung/kind', async () => {
          const m = (kanalDaten?.messages || []).find((x) => x.geteilt && x.geteilt.id === beitrag.id);
          if (!m) throw new Error('keine Karte');
          const g = m.geteilt;
          if (g.titel !== String(beitrag.title || '').trim()) throw new Error('titel ' + g.titel);
          if (!g.kind) throw new Error('kein kind');
        });
      }

      // Seite zeichnen: Unterthema öffnen über die Funktion der Seite.
      await page.evaluate(async ([c, k]) => {
        await bootstrap();
        const community = state.communities.find((x) => x.id === c);
        const kanal = community.channels.find((x) => x.id === k);
        await renderCommunityChat(community, kanal, kanal.name);
      }, [communityId, kanal1]);
      await page.waitForSelector('#commMsgs', { timeout: 15000 });

      await pruefeAsync('4.2 Seite zeigt den Bezug über der fremden Antwort', async () => {
        const t = await page.textContent(`[data-msgid="${antwortVonTest}"] .msg__bezug`);
        if (!/Original k28/.test(t || '')) throw new Error(t);
      });
      await pruefeAsync('4.4 Antworten-Knopf erscheint beim Überfahren', async () => {
        const blase = page.locator(`[data-msgid="${antwortVonTest}"]`);
        await blase.hover();
        const o = await blase.locator('.msg__antworten').evaluate((el) => getComputedStyle(el).opacity);
        if (Number(o) < 0.9) throw new Error('opacity ' + o);
      });
      await pruefeAsync('4.4 Ziehen mit der Maus setzt die Leiste „Antworten"', async () => {
        const box = await page.locator(`[data-msgid="${antwortVonTest}"]`).boundingBox();
        await page.mouse.move(box.x + 20, box.y + box.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + 20 + i * 12, box.y + box.height / 2);
        await page.mouse.up();
        await page.waitForSelector('.msgbezug', { timeout: 3000 });
        const t = await page.textContent('.msgbezug');
        if (!/Antworten/.test(t) || !/Antwort k28/.test(t)) throw new Error(t);
      });
      await pruefeAsync('4.2 Senden aus der Website trägt reply_to — @test liest es', async () => {
        await page.fill('#commMsgInput', 'Website-Antwort k28');
        await page.click('#commSend');
        await page.waitForTimeout(1500);
        const { data, error } = await te.from('community_channel_messages')
          .select('id, reply_to, text').eq('channel_id', kanal1).eq('text', 'Website-Antwort k28').maybeSingle();
        if (error) throw error;
        if (!data || data.reply_to !== antwortVonTest) throw new Error(JSON.stringify(data));
      });
      await pruefeAsync('4.x Bezug antippen hebt das Original hervor', async () => {
        await page.locator(`[data-msgid="${antwortVonTest}"] .msg__bezug`).click();
        await page.waitForSelector(`[data-msgid="${original}"].is-hervor`, { timeout: 3000 });
      });
      if (beitrag) {
        await pruefeAsync('7.1 Seite zeigt die große Karte mit Vorschau', async () => {
          await page.waitForSelector(`[data-beitrag="${beitrag.id}"] .msg__geteiltRahmen`, { timeout: 5000 });
          const breite = await page.locator(`[data-beitrag="${beitrag.id}"]`).evaluate((el) => el.getBoundingClientRect().width);
          if (breite < 200) throw new Error('Breite ' + breite);
        });
        await pruefeAsync('7.3 Klick auf die Karte öffnet den Beitrag', async () => {
          await page.locator(`[data-beitrag="${beitrag.id}"]`).click();
          await page.waitForTimeout(800);
          const ort = await page.evaluate(() => ({ area: state.area, kanal: !!document.querySelector('#commMsgs') }));
          // Beitrag/Reel → Bereich Videos; Querformat → Player über dem Kanal.
          if (ort.area !== 'videos' && ort.kanal) throw new Error(JSON.stringify(ort));
        });
      }
      await schliesse(browser);
    } catch (e) {
      pruefe('Website-Teil', false, e.message);
      try { await browser.close(); } catch { /* egal */ }
    }
  } finally {
    if (communityId) {
      await pr.from('communities').delete().eq('id', communityId);
      const { data } = await pr.from('communities').select('id').eq('id', communityId).maybeSingle();
      pruefe('Aufräumen: Prüfcommunity gelöscht (gegengeprüft)', !data);
    }
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_NETZ) await teilBC();
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
