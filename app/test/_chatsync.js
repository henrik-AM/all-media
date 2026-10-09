/**
 * Kasten 27 — „A schreibt ‚cxv', bei B kommt ‚cwkdew' an."
 *
 * WAS DIE URSACHE WAR (belegt am 06.10.2026)
 *
 * Nichts wurde verfälscht. In der Datenbank stand immer die richtige
 * Nachricht. B sah eine ÄLTERE, weil weder App noch Website nach dem ersten
 * Laden je wieder nachsahen:
 *   - offener Chat: einmal beim Öffnen geladen (ChatDetailScreen, Effekt auf
 *     [chat.id]; Website openChat → nachrichtenHolen), kein Abo, kein Takt;
 *   - Chatliste der App: beim Neuladen kamen nur NEUE Chats dazu
 *     (App.tsx, Effekt auf [daten.chats]) — Vorschau eines vorhandenen Chats
 *     blieb auf dem Stand des App-Starts, selbst nach Herunterziehen;
 *   - Chatliste der Website: nur beim Start geholt;
 *   - Ungelesen-Punkt: is_read wurde bei neuer Nachricht nie false.
 * Verschlüsselung scheidet als Quelle eines ANDEREN Texts aus: Poly1305
 * lässt einen falschen Schlüssel oder ein fremdes Kuvert nie als anderen
 * Text aufgehen, nur als null („Auf diesem Gerät nicht lesbar") — Teil 1.
 *
 * DREI TEILE
 *   1. Ohne Netz: Krypto-Rundreise, altes gegen neues Listenverhalten,
 *      jüngste 500, Zusammenlegen — läuft immer.
 *   2. Datenbank mit zwei Testkonten: Stand ändert sich, Ungelesen-Auslöser
 *      (Schema 81), Bearbeiten einer verschlüsselten Nachricht bleibt lesbar.
 *   3. Website (Server auf Port 3000): B hat den Chat offen, A schreibt —
 *      die Nachricht muss OHNE Neuladen bei B erscheinen. Vor Kasten 27 rot.
 *
 * Start:  node test/_chatsync.js        (Teil 3 überspringen: OHNE_BROWSER=1,
 *                                        nur Teil 1: NUR_OHNE_NETZ=1)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const Krypto = require('../../gemeinsam/krypto');
const ChatAbgleich = require('../../gemeinsam/chatabgleich');

Krypto.zufallsquelleSetzen((x, n) => {
  const b = crypto.randomBytes(n);
  for (let i = 0; i < n; i++) x[i] = b[i];
});

let fehler = 0;
let gelaufen = 0;
const pruefe = (name, wahr, zusatz = '') => {
  gelaufen++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

/* ------------------------------------------------------------------ *
 * Teil 1 — ohne Netz
 * ------------------------------------------------------------------ */

function teilEins() {
  console.log('\nVerschlüsselung kann keinen anderen Text liefern');
  const a = Krypto.schluesselpaarErzeugen();
  const b = Krypto.schluesselpaarErzeugen();
  const fremd = Krypto.schluesselpaarErzeugen();
  const an = [{ id: 'a', oeffentlich: a.oeffentlich }, { id: 'b', oeffentlich: b.oeffentlich }];

  const texte = ['cxv', 'cwkdew', 'ä', 'Grüße 🌧️👍🏽', 'x'.repeat(2000), ' führend und folgend '];
  for (const t of texte) {
    const p = Krypto.verschluesseln(t, a.geheim, an);
    pruefe(`Rundreise ${JSON.stringify(t.slice(0, 12))} (${t.length} Zeichen)`,
      Krypto.entschluesseln(p, p.kuverts[1], b.geheim) === t &&
      Krypto.entschluesseln(p, p.kuverts[0], a.geheim) === t);
  }

  const p1 = Krypto.verschluesseln('cxv', a.geheim, an);
  const p2 = Krypto.verschluesseln('cwkdew', a.geheim, an);
  pruefe('Kuvert der anderen Nachricht öffnet nichts (null, kein anderer Text)',
    Krypto.entschluesseln(p1, p2.kuverts[1], b.geheim) === null);
  pruefe('Fremder Schlüssel öffnet nichts',
    Krypto.entschluesseln(p1, p1.kuverts[1], fremd.geheim) === null);
  pruefe('Vertauschte Nonce öffnet nichts',
    Krypto.entschluesseln({ ...p1, nonce: p2.nonce }, p1.kuverts[1], b.geheim) === null);
  pruefe('Base64-Umrechnung ist umkehrbar (alle Bytewerte)', (() => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    const zurueck = Krypto.ausBase64(Krypto.zuBase64(bytes));
    return zurueck.length === 256 && zurueck.every((v, i) => v === i);
  })());

  console.log('\nBearbeiten einer verschlüsselten Nachricht');
  const neu = Krypto.umschliessen('cxv (bearbeitet)', { version: p2.version, absender: p2.absender }, p2.kuverts[0], a.geheim);
  pruefe('Absender kann neu verschließen', Boolean(neu));
  const bearbeitet = { ...p2, chiffre: neu.chiffre, nonce: neu.nonce };
  pruefe('Gegenüber liest mit dem ALTEN Kuvert den neuen Text',
    Krypto.entschluesseln(bearbeitet, p2.kuverts[1], b.geheim) === 'cxv (bearbeitet)');
  pruefe('Ohne passendes Kuvert kein Neuverschließen',
    Krypto.umschliessen('x', { version: 1, absender: p2.absender }, p2.kuverts[0], fremd.geheim) === null);

  console.log('\nChatliste der App: altes Verhalten gegen neues');
  // Wörtlich die Rechnung aus App.tsx bis 06.10.2026 (Effekt auf [daten.chats]).
  const altesVerhalten = (prev, frisch) => {
    const neuDazu = frisch.filter((c) => !prev.some((p) => p.id === c.id));
    return neuDazu.length ? [...neuDazu, ...prev] : prev;
  };
  const vorher = [{ id: 'c1', name: 'A', preview: 'cwkdew', time: '10:00', unreadCount: 0, archiviert: false }];
  const frisch = [{ id: 'c1', name: 'A', preview: 'cxv', time: '10:01', unreadCount: 1, archiviert: false }];
  const alt = altesVerhalten(vorher, frisch);
  pruefe('BELEG: das alte Verhalten zeigt bei B weiter „cwkdew"', alt[0].preview === 'cwkdew',
    `Vorschau nach Neuladen: ${alt[0].preview}`);
  const jetzt = ChatAbgleich.chatlisteAbgleichen(vorher, frisch);
  pruefe('Neu: Vorschau „cxv", Uhrzeit und Ungelesen aus der Datenbank',
    jetzt[0].preview === 'cxv' && jetzt[0].time === '10:01' && jetzt[0].unreadCount === 1);
  const lokalUmgelegt = [{ ...vorher[0], archiviert: true }];
  pruefe('Eigener, eben umgelegter Schalter springt nicht zurück',
    ChatAbgleich.chatlisteAbgleichen(lokalUmgelegt, frisch)[0].archiviert === true);
  pruefe('Unverändert: dasselbe Feld zurück (kein Neuzeichnen)',
    ChatAbgleich.chatlisteAbgleichen(jetzt, frisch) === jetzt);
  const sortiert = ChatAbgleich.chatlisteAbgleichen(
    [{ id: 'x', preview: 'alt' }, { id: 'y', preview: 'alt' }],
    [{ id: 'y', preview: 'neu' }, { id: 'x', preview: 'alt' }]
  );
  pruefe('Reihenfolge folgt der Datenbank (jüngste oben)', sortiert[0].id === 'y');

  console.log('\nOffener Chat: zusammenlegen');
  const m = (id, text, extra = {}) => ({ id, text, from: 'x', ...extra });
  const schirm = [m('1', 'cwkdew'), m('2', 'cxv', { from: 'me', lokal: true })];
  const ausDb = [m('1', 'cwkdew')];
  const zus = ChatAbgleich.nachrichtenAbgleichen(schirm, ausDb);
  pruefe('Eben gesendete (lokal) bleibt stehen, bis die DB sie liefert', zus.length === 2 && zus[1].id === '2');
  const mitNeuer = ChatAbgleich.nachrichtenAbgleichen(schirm, [m('1', 'cwkdew'), m('2', 'cxv', { from: 'me' }), m('3', 'neu von A')]);
  pruefe('Neue fremde Nachricht kommt dazu, lokale wird durch die DB-Fassung ersetzt',
    mitNeuer.length === 3 && !mitNeuer[1].lokal && mitNeuer[2].text === 'neu von A');
  pruefe('neueFremde erkennt genau die neue fremde',
    ChatAbgleich.neueFremde(schirm, mitNeuer, (x) => x.from === 'me').map((x) => x.id).join() === '3');
  pruefe('Unverändert: dasselbe Feld zurück', ChatAbgleich.nachrichtenAbgleichen(ausDb, [m('1', 'cwkdew')]) === ausDb);
  pruefe('Bearbeiteter Text wird erkannt',
    ChatAbgleich.nachrichtenAbgleichen(ausDb, [m('1', 'cxv', { bearbeitet: true })])[0].text === 'cxv');

  console.log('\nJüngste 500 statt älteste 500');
  const alle = Array.from({ length: 501 }, (_, i) => ({ id: String(i), created_at: i }));
  const altGeholt = alle.slice().sort((x, y) => x.created_at - y.created_at).slice(0, 500);
  pruefe('BELEG: altes `ascending … limit(500)` verliert die 501. Nachricht', altGeholt.at(-1).id === '499');
  const neuGeholt = ChatAbgleich.chronologisch(alle.slice().sort((x, y) => y.created_at - x.created_at).slice(0, 500));
  pruefe('Neu: absteigend holen + umdrehen endet mit der jüngsten', neuGeholt.at(-1).id === '500' && neuGeholt[0].id === '1');

  console.log('\nStand');
  const s1 = ChatAbgleich.stand([{ id: '1' }]);
  pruefe('Neue Nachricht ändert den Stand', s1 !== ChatAbgleich.stand([{ id: '2' }, { id: '1' }]));
  pruefe('Bearbeiten ändert den Stand', s1 !== ChatAbgleich.stand([{ id: '1', edited_at: 't' }]));
  pruefe('Lesebestätigung ändert den Stand', s1 !== ChatAbgleich.stand([{ id: '1', read_at: 't' }]));
}

/* ------------------------------------------------------------------ *
 * Teil 2 — Datenbank, zwei Testkonten
 * ------------------------------------------------------------------ */

async function teilZwei() {
  const { createClient } = require('@supabase/supabase-js');
  const { nurTestkonto } = require('./_nur_testkonten');
  const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
  const UMG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
    ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8') : '';
  const wert = (n) => (UMG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
  const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
  const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  if (!URL || !KEY) { pruefe('Supabase-Zugang vorhanden', false); return null; }

  const anmelden = async (email, passwort) => {
    const client = createClient(URL, KEY);
    const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
    if (error) throw new Error(`${email}: ${error.message}`);
    return { client, id: data.user.id };
  };
  const A = await anmelden('test@all-media.app', TESTKONTO_PASS);
  const B = await anmelden(nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
    process.env.AM_TEST_PASS || PRUEFKONTO_PASS);

  console.log('\nDatenbank: Stand, Ungelesen, Bearbeiten');
  const { data: chat, error } = await A.client.from('chats')
    .insert({ name: 'Prüflauf Kasten 27', is_group: false, bereich: 'community', created_by: A.id })
    .select('id').single();
  if (error) throw error;
  const aufraeumen = async () => {
    await A.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', A.id);
    await B.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', B.id);
    await A.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', A.id);
    await A.client.from('chats').delete().eq('id', chat.id);
  };
  try {
    await A.client.from('chat_members').insert({ chat_id: chat.id, user_id: A.id });
    const { error: em } = await A.client.from('chat_members').insert({ chat_id: chat.id, user_id: B.id });
    if (em) throw em;

    const standVon = async (c) => {
      const { data } = await c.from('messages').select(ChatAbgleich.STAND_SPALTEN)
        .eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(ChatAbgleich.STAND_ZEILEN);
      return ChatAbgleich.stand(data || []);
    };
    const vorher = await standVon(B.client);
    await B.client.from('chat_members').update({ is_read: true }).eq('chat_id', chat.id).eq('user_id', B.id);

    const text = 'cxv-' + Date.now();
    const { data: n, error: en } = await A.client.from('messages')
      .insert({ chat_id: chat.id, sender_id: A.id, text }).select('id').single();
    if (en) throw en;

    pruefe('B sieht am Stand, dass etwas Neues da ist', (await standVon(B.client)) !== vorher);
    const { data: bLiest } = await B.client.from('messages').select('text')
      .eq('chat_id', chat.id).order('created_at', { ascending: false }).limit(1);
    pruefe('In der Datenbank steht für B genau A\'s Text', bLiest?.[0]?.text === text, bLiest?.[0]?.text);

    const { data: mit } = await B.client.from('chat_members').select('is_read')
      .eq('chat_id', chat.id).eq('user_id', B.id).single();
    pruefe('Schema 81: neue Nachricht macht den Chat bei B ungelesen', mit?.is_read === false,
      'is_read = ' + mit?.is_read + (mit?.is_read ? ' (Schema 81 noch nicht eingespielt?)' : ''));
    const { data: mitA } = await A.client.from('chat_members').select('is_read')
      .eq('chat_id', chat.id).eq('user_id', A.id).single();
    pruefe('… beim Absender selbst nicht', mitA?.is_read !== false);

    // Bearbeiten einer verschlüsselten Nachricht — mit eigenen Wegwerf-Schlüsseln.
    // Der neue Chat ist eine Anfrage („wartet", Schema 21): A darf erst wieder
    // schreiben, wenn B geantwortet hat. Die Antwort ist die Annahme.
    const { error: eAntwort } = await B.client.from('messages')
      .insert({ chat_id: chat.id, sender_id: B.id, text: 'ok' });
    if (eAntwort) throw eAntwort;
    const pa = Krypto.schluesselpaarErzeugen();
    const pb = Krypto.schluesselpaarErzeugen();
    const gA = 'prueflauf-k27-' + crypto.randomUUID();
    const gB = 'prueflauf-k27-' + crypto.randomUUID();
    const { data: kA } = await A.client.from('krypto_schluessel')
      .insert({ user_id: A.id, geraet: gA, art: 'web', oeffentlich: pa.oeffentlich }).select('id').single();
    const { data: kB } = await B.client.from('krypto_schluessel')
      .insert({ user_id: B.id, geraet: gB, art: 'web', oeffentlich: pb.oeffentlich }).select('id').single();
    try {
      const paket = Krypto.verschluesseln('cwkdew', pa.geheim,
        [{ id: kA.id, oeffentlich: pa.oeffentlich }, { id: kB.id, oeffentlich: pb.oeffentlich }]);
      const { data: vn, error: ev } = await A.client.from('messages').insert({
        chat_id: chat.id, sender_id: A.id, text: '', krypto: paket.version, chiffre: paket.chiffre,
        krypto_nonce: paket.nonce, absender_schluessel: paket.absender,
      }).select('id').single();
      if (ev) throw ev;
      await A.client.from('message_keys').insert(paket.kuverts.map((k) => ({
        message_id: vn.id, schluessel_id: k.schluesselId, nonce: k.nonce, chiffre: k.chiffre })));

      const neu = Krypto.umschliessen('cxv', { version: paket.version, absender: paket.absender }, paket.kuverts[0], pa.geheim);
      const { data: getroffen, error: eu } = await A.client.from('messages')
        .update({ chiffre: neu.chiffre, krypto_nonce: neu.nonce, edited_at: new Date().toISOString() })
        .eq('id', vn.id).eq('sender_id', A.id).select('id');
      pruefe('Bearbeiten trifft die Zeile', !eu && getroffen?.length === 1, eu?.message);

      const { data: z } = await B.client.from('messages').select('krypto, chiffre, krypto_nonce, absender_schluessel').eq('id', vn.id).single();
      const { data: kv } = await B.client.from('message_keys').select('nonce, chiffre').eq('message_id', vn.id).eq('schluessel_id', kB.id).single();
      const klar = Krypto.entschluesseln({ version: z.krypto, chiffre: z.chiffre, nonce: z.krypto_nonce, absender: z.absender_schluessel }, kv, pb.geheim);
      pruefe('B liest nach dem Bearbeiten „cxv" mit seinem alten Kuvert', klar === 'cxv', String(klar));
    } finally {
      await A.client.from('krypto_schluessel').delete().eq('id', kA.id);
      await B.client.from('krypto_schluessel').delete().eq('id', kB.id);
    }
    return { A, chatId: chat.id, aufraeumen };
  } catch (e) {
    await aufraeumen();
    throw e;
  }
}

/* ------------------------------------------------------------------ *
 * Teil 3 — Website: B hat den Chat offen, A schreibt
 * ------------------------------------------------------------------ */

async function teilDrei(db) {
  const { chromium } = require('playwright-core');
  const { beenden } = require('./_konto');
  const { nurTestkonto } = require('./_nur_testkonten');
  const ZIEL = process.env.ZIEL || 'http://localhost:3000/';
  console.log('\nWebsite: Nachricht erscheint ohne Neuladen');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  const konsole = [];
  page.on('pageerror', (e) => konsole.push(e.message));
  try {
    await page.goto(ZIEL, { waitUntil: 'load' });
    // Ohne anmelden() aus _konto.js: das ruft /api/reset und löscht dabei
    // genau den Prüfchat, den Teil 2 eben angelegt hat.
    await page.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
    await page.evaluate(() => window.Anmeldung.bereit?.catch(() => null));
    const { PRUEFKONTO_PASS: PASS } = require('./_testpasswoerter');
    const an = await page.evaluate(({ mail, pass }) => window.Anmeldung.anmelden(mail, pass),
      { mail: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'), pass: process.env.AM_TEST_PASS || PASS });
    if (!an.ok) { pruefe('Prüfkonto angemeldet', false, an.fehler); return; }
    await page.reload({ waitUntil: 'load' });

    const geoeffnet = await page.evaluate(async (chatId) => {
      const d = await (await fetch('/api/bootstrap')).json();
      state.chats = d.chats || [];
      state.communityChats = d.communityChats || [];
      await openChat(chatId);
      return state.openChatId === chatId;
    }, db.chatId);
    pruefe('B hat den Prüfchat offen', geoeffnet);

    const text = 'cxv-live-' + Date.now();
    const { error } = await db.A.client.from('messages').insert({ chat_id: db.chatId, sender_id: db.A.id, text });
    pruefe('A schreibt', !error, error?.message);

    const erschienen = await page.waitForFunction(
      (t) => (document.querySelector('#messages')?.textContent || '').includes(t),
      text, { timeout: 15000 }
    ).then(() => true).catch(() => false);
    pruefe('… und bei B steht genau dieser Text, ohne Neuladen (≤ 15 s)', erschienen);

    await page.evaluate(() => closeChat());
    const inListe = await page.waitForFunction(
      (t) => [...(state.communityChats || []), ...(state.chats || [])].some((c) => c.preview === t),
      text, { timeout: 15000 }
    ).then(() => true).catch(() => false);
    pruefe('Die Chatliste zeigt danach A\'s Text als Vorschau', inListe);
    pruefe('Keine Seitenfehler', konsole.length === 0, konsole.join(' | '));
  } finally {
    await browser.close().catch(() => {});
    void beenden;
  }
}

(async () => {
  teilEins();
  if (process.env.NUR_OHNE_NETZ) {
    console.log(`\n${gelaufen - fehler} von ${gelaufen} Prüfungen bestanden (nur Teil 1)`);
    process.exit(fehler ? 1 : 0);
  }
  let db = null;
  try {
    db = await teilZwei();
    if (db && !process.env.OHNE_BROWSER) await teilDrei(db);
  } catch (e) {
    pruefe('Lauf ohne Abbruch', false, e?.message || String(e));
  } finally {
    if (db) await db.aufraeumen().catch(() => {});
  }
  console.log(`\n${gelaufen - fehler} von ${gelaufen} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
