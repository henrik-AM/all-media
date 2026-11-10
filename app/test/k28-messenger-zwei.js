#!/usr/bin/env node
/**
 * Kasten 28/12.4 mit zwei Konten und zwei Geräten (10.11.2026).
 *
 *   Website (Prüfbrowser, @prueflauf) schickt aus der Chat-Info die
 *   Messenger-Anfrage; die App (Simulator „All-Media Test“, @test) nimmt sie
 *   in ihrer Chat-Info an. Der App-Teil wird von Hand im Simulator getippt
 *   (npm run mac:tippen), darum zwei Phasen:
 *
 *     node test/k28-messenger-zwei.js aufbau   Chat + Austausch, Website fragt
 *     … App: Communitys → Chats → Chat → Kopf → „Messenger-Anfrage annehmen“
 *     node test/k28-messenger-zwei.js pruefen  Datenbank nach dem Annehmen
 *     node test/k28-messenger-zwei.js abbau    alles weg, Gegenprobe
 *
 * Abbau IMMER laufen lassen: ein stehender Testpaar-Chat kippt sonst
 * test:messengeranfrage im Gesamtlauf (Erinnerung „Prüf-Aufbau ganz lösen“).
 * Braucht die Belegung „testbestand“ und einen Prüfserver (BASE, Vorgabe 3250).
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright-core');
const { nurTestkonto } = require('./_nur_testkonten');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');
const { vorbereiten } = require('./_konto');

const PHASE = process.argv[2];
const BASE = process.env.BASE || 'http://localhost:3250';
const ZUSTAND = path.join(require('os').homedir(), 'allmedia-wt', '.k28-messenger-zwei.json');
const BILDER = process.env.BILDER || path.join(require('os').homedir(), 'allmedia-wt', 'BILDER-paket-5');

const UMGEBUNG = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8');
const wert = (n) => (UMGEBUNG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';
const URL_ = wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const APPKONTO = { email: nurTestkonto('test@all-media.app'), passwort: TESTKONTO_PASS };
const WEBKONTO = { email: nurTestkonto('all.media.prueflauf@web.de'), passwort: PRUEFKONTO_PASS };

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz && !wahr ? '  — ' + zusatz : ''));
};

async function anmelden(zugang) {
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

async function verbindung(app, web) {
  const [{ data: a }, { data: b }] = await Promise.all([
    app.client.from('contacts').select('status').eq('user_id', app.id).eq('contact_id', web.id),
    web.client.from('contacts').select('status').eq('user_id', web.id).eq('contact_id', app.id),
  ]);
  const zweier = async (bereich) => {
    const { data: meine } = await app.client.from('chat_members').select('chat_id, chats(is_group, bereich)').eq('user_id', app.id);
    const ids = (meine || []).filter((m) => m.chats && !m.chats.is_group && m.chats.bereich === bereich).map((m) => m.chat_id);
    if (!ids.length) return [];
    const { data: andere } = await app.client.from('chat_members').select('chat_id').in('chat_id', ids).eq('user_id', web.id);
    return (andere || []).map((z) => z.chat_id);
  };
  return { kontaktApp: (a || [])[0], kontaktWeb: (b || [])[0], messenger: await zweier('messenger'), community: await zweier('community') };
}

async function aufbau(app, web) {
  const vorher = await verbindung(app, web);
  if (vorher.kontaktApp || vorher.kontaktWeb || vorher.messenger.length || vorher.community.length) {
    throw new Error('@test und @prueflauf sind schon verbunden — erst „abbau“ laufen lassen. ' + JSON.stringify(vorher));
  }
  const browser = await chromium.launch();
  try {
    const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });
    const seitenfehler = [];
    seite.on('pageerror', (e) => seitenfehler.push(e.message));
    // Erst anmelden (ruft /api/reset), dann den Chat anlegen — sonst räumt der Reset ihn weg.
    if (!(await vorbereiten(seite, BASE))) throw new Error('Website-Anmeldung @prueflauf fehlgeschlagen');

    const { data: chat, error } = await web.client
      .from('chats')
      .insert({ name: 'Prüflauf 12.4', is_group: false, bereich: 'community', created_by: web.id })
      .select('id')
      .single();
    if (error) throw error;
    fs.writeFileSync(ZUSTAND, JSON.stringify({ chatId: chat.id }));
    await web.client.from('chat_members').insert({ chat_id: chat.id, user_id: web.id });
    const { error: rein } = await web.client.from('chat_members').insert({ chat_id: chat.id, user_id: app.id });
    pruefe('Community-Chat @prueflauf ↔ @test angelegt', !rein, rein?.message);
    const s1 = await web.client.from('messages').insert({ chat_id: chat.id, sender_id: web.id, text: 'Hallo aus dem Prüflauf 12.4' });
    const s2 = await app.client.from('messages').insert({ chat_id: chat.id, sender_id: app.id, text: 'Hallo zurück' });
    pruefe('Austausch in beide Richtungen', !s1.error && !s2.error, s1.error?.message || s2.error?.message);

    await seite.reload({ waitUntil: 'domcontentloaded' });
    await seite.waitForSelector('[data-area="communities"]', { timeout: 30000 });
    await seite.click('[data-area="communities"]');
    await seite.click('[data-sub="chats"]').catch(() => {});
    await seite.waitForTimeout(800);
    await seite.evaluate((id) => openChat(id), chat.id);
    await seite.waitForSelector('.chathead__body[data-chatinfo]', { timeout: 15000 });
    await seite.click('.chathead__body[data-chatinfo]');
    await seite.waitForSelector('[data-kp-messenger="fragen"]', { timeout: 15000 }).catch(() => {});
    pruefe('Website-Chat-Info: „In den Messenger wechseln anfragen“', !!(await seite.$('[data-kp-messenger="fragen"]')));
    await seite.screenshot({ path: path.join(BILDER, 'k28-124-web-vorher.png') });
    const t0 = Date.now();
    await seite.click('[data-kp-messenger="fragen"]');
    // Die Info zeichnet sich erst nach bootstrap() neu — im Prüf-Chromium
    // dauert das Sekunden (Erinnerung „16 s pro Navigation“).
    await seite.waitForFunction(() => /Messenger-Anfrage läuft/.test(document.querySelector('#overlay')?.textContent || ''), null, { timeout: 30000 }).catch(() => {});
    const info = (await seite.locator('#overlay').textContent()) || '';
    pruefe('Website: Info zeigt danach „Messenger-Anfrage läuft“', /Messenger-Anfrage läuft/.test(info), info.slice(0, 160));
    console.log(`  (Info nach ${((Date.now() - t0) / 1000).toFixed(1)} s neu gezeichnet)`);
    await seite.screenshot({ path: path.join(BILDER, 'k28-124-web-gesendet.png') });

    const { data: z } = await app.client.from('chats').select('messenger_anfrage, messenger_anfrage_von').eq('id', chat.id).single();
    pruefe('Datenbank: Anfrage wartet, von @prueflauf', z?.messenger_anfrage === 'wartet' && z?.messenger_anfrage_von === web.id, JSON.stringify(z));
    pruefe('Website ohne Seitenfehler', seitenfehler.length === 0, seitenfehler.join(' | '));
  } finally {
    await browser.close();
  }
}

async function pruefen(app, web) {
  const { chatId } = JSON.parse(fs.readFileSync(ZUSTAND, 'utf8'));
  const { data: z } = await app.client.from('chats').select('messenger_anfrage').eq('id', chatId).single();
  pruefe('Datenbank: angenommen', z?.messenger_anfrage === 'angenommen', JSON.stringify(z));
  const v = await verbindung(app, web);
  pruefe('Beide sind jetzt Kontakte', v.kontaktApp?.status === 'friend' && v.kontaktWeb?.status === 'friend', JSON.stringify(v));
  pruefe('Genau ein Messenger-Chat', v.messenger.length === 1, JSON.stringify(v.messenger));
}

async function abbau(app, web) {
  const v = await verbindung(app, web);
  const chats = [...v.community, ...v.messenger];
  for (const chatId of chats) {
    for (const wer of [app, web]) {
      await wer.client.from('notifications').delete().eq('target_id', chatId);
      await wer.client.from('messages').delete().eq('chat_id', chatId).eq('sender_id', wer.id);
    }
    await web.client.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', web.id);
    await app.client.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', app.id);
    await app.client.from('chats').delete().eq('id', chatId);
    await web.client.from('chats').delete().eq('id', chatId);
  }
  await app.client.from('contacts').delete().eq('user_id', app.id).eq('contact_id', web.id);
  await web.client.from('contacts').delete().eq('user_id', web.id).eq('contact_id', app.id);
  // Gegenprobe: ein verbotenes DELETE meldet unter RLS keinen Fehler.
  const n = await verbindung(app, web);
  pruefe('Aufgeräumt: kein Kontakt', !n.kontaktApp && !n.kontaktWeb, JSON.stringify(n));
  pruefe('Aufgeräumt: kein Messenger-Chat', n.messenger.length === 0, JSON.stringify(n.messenger));
  pruefe('Aufgeräumt: kein Community-Zweierchat', n.community.length === 0, JSON.stringify(n.community));
  fs.rmSync(ZUSTAND, { force: true });
}

(async () => {
  if (!['aufbau', 'pruefen', 'abbau'].includes(PHASE)) throw new Error('Phase: aufbau | pruefen | abbau');
  if (require('./_ki_belegung').pruefeBelegung) require('./_ki_belegung').pruefeBelegung('testbestand');
  const app = await anmelden(APPKONTO);
  const web = await anmelden(WEBKONTO);
  if (PHASE === 'aufbau') await aufbau(app, web);
  if (PHASE === 'pruefen') await pruefen(app, web);
  if (PHASE === 'abbau') await abbau(app, web);
  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('FEHLER  ' + (e?.message ?? e));
  process.exit(1);
});
