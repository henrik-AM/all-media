#!/usr/bin/env node
/**
 * Feedback 28.09.2026, Nachtrag 12.10.2026 (3) — Agent „Community-Profilbilder".
 *
 *   11.3  Im Unterthema-Chat und im Community-Gruppenchat steht unten links
 *         neben jeder fremden Blase das Profilbild der Person (Video-Profil =
 *         profiles.avatar_url, Schema 69), bei eigenen unten rechts das eigene.
 *         Nur an der letzten Blase einer Folge derselben Person. Community-
 *         Einzelchat und Messenger ohne Bilder. Nie das Messenger-Kontaktbild.
 *   11.4  Profilbild antippen öffnet das Community-Profil der Person.
 *
 * WAS DIESER LAUF ZEIGT
 *
 *   A  Ohne Netz: die Regel in gemeinsam/chatblase.js (profilbilderImChat,
 *      blasenAbsender, profilbildAn) und die Verdrahtung beider Seiten im
 *      Quelltext (App: ChatDetailScreen + App.tsx; Website: kanalNachricht,
 *      messageBubble, oeffneCommunityProfilVon, CSS).
 *   B  Mit zwei Konten an Supabase: @prueflauf legt eine Prüfcommunity mit
 *      Unterthema an, @test tritt bei; Verlauf pr, pr, te, pr. @test liest
 *      avatar_url von @prueflauf (das Bild ist für andere Mitglieder lesbar).
 *   C  Website (Port 3000, @prueflauf): Unterthema zeichnen → genau drei
 *      Bilder (an Blase 2, 3, 4), zwei eigene rechts, eines fremd links mit
 *      data-commprofil = @test. Ein gesetztes Messenger-Kontaktbild für @test
 *      erscheint im Unterthema NICHT. Klick aufs fremde Bild → öffentliches
 *      Profil von @test; Klick aufs eigene → Communitys → Profil.
 *      messageBubble: Community-Gruppe mit Bild, Community-Einzelchat und
 *      Messenger-Gruppe ohne.
 *   Am Ende löscht @prueflauf die Prüfcommunity (cascade) und prüft nach.
 *
 * WAS ER NICHT ZEIGT: die App-Oberfläche. Im Simulator „All-Media Test"
 * ansehen (siehe Bericht): Beschriftung „Community-Profil von <Name>".
 *
 * UNGETESTET geschrieben am 12.10.2026 (Supabase gesperrt, 402). Teil A lief
 * ohne Netz (OHNE_NETZ=1); Gegenprobe mit WURZEL=<Ordner mit Stand 786b6c1>.
 *
 * Start:  node test/k28-commbild.js   (npm run test:k28-commbild)
 *         OHNE_NETZ=1 nur Teil A.  OHNE_BROWSER=1 überspringt C.
 *         WURZEL=… prüft einen anderen Stand (nur Teil A).
 */

const fs = require('fs');
const path = require('path');

const WURZEL = process.env.WURZEL ? path.resolve(process.env.WURZEL) : path.join(__dirname, '..', '..');
const lies = (rel) => {
  try {
    return fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  } catch {
    return '';
  }
};
const lade = (rel) => {
  try {
    return require(path.join(WURZEL, rel));
  } catch {
    return {};
  }
};

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
const sicher = (fn) => {
  try {
    return fn();
  } catch {
    return false;
  }
};
const abschnitt = (text, von, bis) => {
  const a = text.indexOf(von);
  if (a < 0) return '';
  const b = bis ? text.indexOf(bis, a + von.length) : -1;
  return text.slice(a, b < 0 ? a + 8000 : b);
};

/* ------------------------------------------------------------- A ohne Netz */
function teilA() {
  console.log('\nA  Regel und Verdrahtung (ohne Netz)' + (process.env.WURZEL ? '  [Stand: ' + WURZEL + ']' : ''));
  const C = lade('gemeinsam/chatblase.js');

  console.log('\nA1  gemeinsam/chatblase.js');
  pruefe('Unterthema zeigt Bilder', sicher(() => C.profilbilderImChat({ kanal: true })) === true);
  pruefe('Community-Gruppenchat zeigt Bilder', sicher(() => C.profilbilderImChat({ gruppe: true, community: true })) === true);
  pruefe('Community-Einzelchat ohne Bilder (Prototyp CC + Chat)',
    typeof C.profilbilderImChat === 'function' && C.profilbilderImChat({ gruppe: false, community: true }) === false);
  pruefe('Messenger-Gruppe ohne Bilder',
    typeof C.profilbilderImChat === 'function' && C.profilbilderImChat({ gruppe: true, community: false }) === false);
  const absender = ['a', 'a', 'me', null, 'me', 'a', 'b'];
  const an = sicher(() => absender.map((_, i) => C.profilbildAn(absender, i)));
  pruefe('Bild nur an der letzten Blase einer Folge',
    Array.isArray(an) && JSON.stringify(an) === JSON.stringify([false, true, true, false, true, true, true]),
    JSON.stringify(an));
  pruefe('Anruf-, PTT- und Hinweiszeilen unterbrechen die Folge',
    sicher(() => C.blasenAbsender({ anruf: {} }, 'a')) === null &&
      sicher(() => C.blasenAbsender({ pttSitzung: true }, 'a')) === null &&
      sicher(() => C.blasenAbsender({ hinweis: 'story_markierung' }, 'a')) === null &&
      sicher(() => C.blasenAbsender({ text: 'x' }, 'a')) === 'a');
  pruefe('Bildgröße gemeinsam festgelegt', typeof C.PROFILBILD_GROESSE === 'number' && C.PROFILBILD_GROESSE > 0);
  const DTS = lies('gemeinsam/chatblase.d.ts');
  pruefe('Typen in chatblase.d.ts', /profilbilderImChat/.test(DTS) && /profilbildAn/.test(DTS) && /blasenAbsender/.test(DTS));

  console.log('\nA2  App');
  const CHAT = lies('app/screens/messenger/ChatDetailScreen.tsx');
  const APP = lies('app/App.tsx');
  pruefe('ChatDetailScreen fragt die gemeinsame Regel (Unterthema + Community-Chats)',
    /Chatblase\.profilbilderImChat\(\{\s*kanal: istKanal,\s*gruppe: chat\.isGroup,\s*community: communityChats\.some/.test(CHAT));
  pruefe('Bild nur an der letzten Blase (profilbildAn mit Absenderliste)',
    /Chatblase\.blasenAbsender\(m, m\.senderId\)/.test(CHAT) && /Chatblase\.profilbildAn\(absender, index\)/.test(CHAT));
  pruefe('Fremd links, eigen rechts (vor bzw. nach der Blase)',
    /mitProfilbild && !out \? blasenBild\(item, index\)/.test(CHAT) && /mitProfilbild && out \? blasenBild\(item, index\)/.test(CHAT));
  const zieh = abschnitt(CHAT, '<ZiehZumAntworten', '</ZiehZumAntworten>');
  pruefe('Bildzeile liegt IN ZiehZumAntworten (Geste bleibt)', /styles\.bildZeile/.test(zieh) && /blasenBild\(item, index\)/.test(zieh));
  pruefe('Nie das Messenger-Kontaktbild (KontaktBildBereich = false am Bild)',
    /<KontaktBildBereich\.Provider value=\{false\}>\s*<Avatar id=\{item\.senderId\}/.test(CHAT));
  pruefe('Antippen → onOpenCommunityProfil, Beschriftung für mac:tippen',
    /onOpenCommunityProfil \?\? onOpenProfile\)\(item\.senderId\)/.test(CHAT) && /accessibilityLabel=\{`Community-Profil von \$\{name\}`\}/.test(CHAT));
  pruefe('App.tsx: fremd → öffentliches Profil, eigen → Communitys → Profil',
    /onOpenCommunityProfil=\{\(id\) => \{[\s\S]{0,200}id === 'me'[\s\S]{0,120}switchArea\('communities'\)[\s\S]{0,80}openPublicProfile\(id\)/.test(APP));

  console.log('\nA3  Website');
  const WEB = lies('web/public/app.js');
  const CSS = lies('web/public/styles.css');
  const kanal = abschnitt(WEB, 'function kanalNachricht(', '\n}\n');
  pruefe('kanalNachricht: Bildzeile mit gemeinsamer Regel',
    /window\.Chatblase\.profilbildAn\(absender, i\)/.test(kanal) && /inBildZeile\(/.test(kanal));
  pruefe('Unterthema übergibt die Absenderliste', /kanalNachricht\(m, i, absender\)[\s\S]{0,40}\(blasenAbsenderListe\(nachrichten\)\)/.test(WEB));
  const bubble = abschnitt(WEB, 'function messageBubble(', '\nfunction groesseText');
  pruefe('messageBubble: nur Community-Gruppe mit Bild',
    /profilbilderImChat\(\{\s*gruppe: Boolean\(chat && chat\.isGroup\),\s*community: \(state\.communityChats \|\| \[\]\)\.some/.test(bubble) &&
      /if \(!mitBild\) return blase;/.test(bubble));
  const bild = abschnitt(WEB, 'function blasenBild(', '\n}\n');
  pruefe('Bild aus dem Profil (personenAvatar/eigenerAvatar), nicht avatarForUser',
    /personenAvatar\(u, 28\)/.test(bild) && /eigenerAvatar\(u, 28\)/.test(bild) && !/avatarForUser/.test(bild));
  pruefe('Klick → oeffneCommunityProfilVon (fremd öffentlich, eigen Communitys → Profil)',
    /data-commprofil/.test(bild) &&
      /function oeffneCommunityProfilVon\(id\) \{\s*if \(id !== 'me'\) return openProfile\(id, 'oeffentlich'\);[\s\S]{0,200}state\.area = 'communities';\s*state\.sub\.communities = 'profile';/.test(WEB));
  pruefe('Klick ist an Unterthema und Chat gebunden',
    /blasenBildBinden\(liste\);/.test(WEB) && /blasenBildBinden\(box\);/.test(WEB));
  pruefe('CSS: eigene Zeile rechts, Bild als Knopf', /\.msgzeile--out \{ align-self: flex-end; \}/.test(CSS) && /\.msgzeile__bild \{/.test(CSS));
  pruefe('Alte Initialen-Blase im Unterthema ist weg', !/msgzeile__avatar/.test(WEB));
}

/* --------------------------------------------- B + C mit zwei Konten */
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
  const pr = createClient(URL, KEY, { auth: { persistSession: false } });
  const te = createClient(URL, KEY, { auth: { persistSession: false } });
  const a1 = await pr.auth.signInWithPassword({
    email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
    password: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
  });
  const a2 = await te.auth.signInWithPassword({ email: nurTestkonto('test@all-media.app'), password: TESTKONTO_PASS });
  pruefe('Beide Testkonten melden sich an', !a1.error && !a2.error, (a1.error || a2.error)?.message);
  if (a1.error || a2.error) return;
  const prId = a1.data.user.id;
  const teId = a2.data.user.id;

  /*
   * Paket 5 (09.11.2026): Die Prüf-Anmeldung der Website ruft /api/reset, und
   * zuruecksetzen() löscht die Communitys des Prüfkontos — also auch die
   * Prüfcommunity aus Teil B, wenn sie vorher angelegt wurde (Teil C fand sie
   * nie). Deshalb zuerst im Browser anmelden, danach aufbauen.
   */
  let browser = null;
  let page = null;
  let angemeldet = null;
  if (!process.env.OHNE_BROWSER) {
    const { chromium } = require('playwright-core');
    browser = await chromium.launch();
    page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
    angemeldet = await require('./_konto').vorbereiten(page, BASIS).catch((e) => (console.error(e.message), false));
  }

  let communityId = null;
  let kanalId = null;
  const ids = [];

  try {
    await pruefeAsync('Prüfcommunity mit Unterthema anlegen (@prueflauf)', async () => {
      const { data, error } = await pr.from('communities')
        .insert({ name: 'Prüfcommunity Profilbild ' + Date.now(), topic: 'Prüflauf k28-commbild', visibility: 'public', created_by: prId })
        .select('id').single();
      if (error) throw error;
      communityId = data.id;
      const m = await pr.from('community_members').insert({ community_id: communityId, user_id: prId });
      if (m.error) throw m.error;
      const k = await pr.from('community_channels').insert({ community_id: communityId, slug: 'bilder', name: 'Bilder', position: 0 }).select('id').single();
      if (k.error) throw k.error;
      kanalId = k.data.id;
    });
    if (!communityId || !kanalId) return;

    await pruefeAsync('@test tritt bei', async () => {
      const { error } = await te.from('community_members').insert({ community_id: communityId, user_id: teId });
      if (error) throw error;
    });

    // Verlauf: pr, pr, te, pr — erwartet: Bild an Blase 2, 3 und 4.
    const folge = [[pr, prId, 'eins'], [pr, prId, 'zwei'], [te, teId, 'drei'], [pr, prId, 'vier']];
    await pruefeAsync('Verlauf pr, pr, te, pr schreiben', async () => {
      for (const [c, id, text] of folge) {
        const { data, error } = await c.from('community_channel_messages')
          .insert({ channel_id: kanalId, sender_id: id, text: 'k28-commbild ' + text }).select('id').single();
        if (error) throw error;
        ids.push(data.id);
        await new Promise((r) => setTimeout(r, 30));
      }
    });

    await pruefeAsync('11.3 @test darf avatar_url von @prueflauf lesen (Schema 69)', async () => {
      const { error } = await te.from('profiles').select('id, avatar_url').eq('id', prId).single();
      if (error) throw new Error(error.message + ' — Schema 69 eingespielt?');
    });

    /* ------------------------------------------------------- C Website */
    if (process.env.OHNE_BROWSER) return;
    console.log('\nC  Website (Port 3000, @prueflauf)');
    const { schliesse } = require('./_konto');
    try {
      const ok = angemeldet;
      if (ok === false) {
        pruefe('Website-Anmeldung', false);
        return;
      }
      const zeichnen = () =>
        page.evaluate(async ([c, k]) => {
          await bootstrap();
          const community = state.communities.find((x) => x.id === c);
          const kanal = community.channels.find((x) => x.id === k);
          await renderCommunityChat(community, kanal, kanal.name);
        }, [communityId, kanalId]);
      await zeichnen();
      await page.waitForSelector('#commMsgs', { timeout: 15000 });

      await pruefeAsync('11.3 Genau drei Bilder: an Blase 2, 3, 4', async () => {
        const stand = await page.evaluate((nachrichten) =>
          nachrichten.map((id) => {
            const blase = document.querySelector(`[data-msgid="${id}"]`);
            const zeile = blase && blase.closest('.msgzeile');
            return zeile ? !!zeile.querySelector('.msgzeile__bild') : null;
          }), ids);
        if (JSON.stringify(stand) !== JSON.stringify([false, true, true, true])) throw new Error(JSON.stringify(stand));
      });
      await pruefeAsync('11.3 Eigene Blasen: Bild rechts (msgzeile--out, Bild nach der Blase)', async () => {
        const r = await page.evaluate((id) => {
          const zeile = document.querySelector(`[data-msgid="${id}"]`).closest('.msgzeile');
          return { out: zeile.classList.contains('msgzeile--out'), letztes: zeile.lastElementChild.classList.contains('msgzeile__bild') };
        }, ids[3]);
        if (!r.out || !r.letztes) throw new Error(JSON.stringify(r));
      });
      await pruefeAsync('11.3 Fremde Blase: Bild links mit data-commprofil = @test', async () => {
        const r = await page.evaluate((id) => {
          const zeile = document.querySelector(`[data-msgid="${id}"]`).closest('.msgzeile');
          const b = zeile.firstElementChild;
          return { bild: b.classList.contains('msgzeile__bild'), wer: b.dataset.commprofil };
        }, ids[2]);
        if (!r.bild || r.wer !== teId) throw new Error(JSON.stringify(r));
      });
      await pruefeAsync('11.3 Nie das Messenger-Kontaktbild im Unterthema', async () => {
        const falsch = 'https://example.invalid/kontaktbild-k28.jpg';
        await page.evaluate(([t, f]) => {
          state.kontaktBilder = { ...(state.kontaktBilder || {}), [t]: f };
        }, [teId, falsch]);
        await page.evaluate(async ([c, k]) => {
          const community = state.communities.find((x) => x.id === c);
          const kanal = community.channels.find((x) => x.id === k);
          await renderCommunityChat(community, kanal, kanal.name);
        }, [communityId, kanalId]);
        const n = await page.locator(`#commMsgs img[src="${falsch}"]`).count();
        if (n) throw new Error(n + ' Bild(er) mit dem Kontaktbild');
      });
      await pruefeAsync('11.4 Klick aufs fremde Bild → öffentliches Profil von @test', async () => {
        const anfragen = [];
        page.on('request', (r) => anfragen.push(r.url()));
        await page.locator(`.msgzeile__bild[data-commprofil="${teId}"]`).first().click();
        await page.waitForTimeout(1500);
        if (!anfragen.some((u) => u.includes('/api/profile/' + teId))) throw new Error('kein /api/profile/' + teId);
      });
      // Paket 5: das öffentliche Profil liegt heute als Overlay über #main — erst schließen.
      await page.evaluate(() => typeof closeOverlay === 'function' && closeOverlay());
      await zeichnen();
      await page.waitForSelector('#commMsgs', { timeout: 15000 });
      // Nach dem Overlay blendet die Seite ein; vorher hängt der Klick bis zur Zeitgrenze.
      await page.waitForTimeout(800);
      await pruefeAsync('11.4 Klick aufs eigene Bild → Communitys → Profil', async () => {
        await page.locator('.msgzeile__bild[data-commprofil="me"]').first().click();
        await page.waitForTimeout(800);
        const r = await page.evaluate(() => ({ area: state.area, sub: state.sub.communities }));
        if (r.area !== 'communities' || r.sub !== 'profile') throw new Error(JSON.stringify(r));
      });
      await pruefeAsync('11.3 messageBubble: Community-Gruppe mit Bild, Einzelchat und Messenger ohne', async () => {
        const r = await page.evaluate(() => {
          const m = { id: 'x', from: 'u-fremd', text: 'Hallo', time: '12:00' };
          const vorher = state.communityChats;
          state.communityChats = [...(vorher || []), { id: 'k28-cg', isGroup: true }, { id: 'k28-ce', isGroup: false, userId: 'u-fremd' }];
          const gruppe = messageBubble(m, { id: 'k28-cg', isGroup: true }, 0, ['u-fremd']);
          const einzel = messageBubble(m, { id: 'k28-ce', isGroup: false, userId: 'u-fremd' }, 0, ['u-fremd']);
          const messenger = messageBubble(m, { id: 'k28-mg', isGroup: true }, 0, ['u-fremd']);
          state.communityChats = vorher;
          return [gruppe, einzel, messenger].map((h) => h.includes('msgzeile__bild'));
        });
        if (JSON.stringify(r) !== '[true,false,false]') throw new Error(JSON.stringify(r));
      });
      await schliesse(browser);
    } catch (e) {
      pruefe('Website-Teil', false, e.message);
      try { await browser.close(); } catch { /* egal */ }
    }
  } finally {
    if (browser) { try { await browser.close(); } catch { /* schon zu */ } }
    if (communityId) {
      await pr.from('communities').delete().eq('id', communityId);
      const { data } = await pr.from('communities').select('id').eq('id', communityId).maybeSingle();
      pruefe('Aufräumen: Prüfcommunity gelöscht (gegengeprüft)', !data);
    }
  }
}

(async () => {
  teilA();
  if (!process.env.OHNE_NETZ && !process.env.WURZEL) await teilBC();
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
