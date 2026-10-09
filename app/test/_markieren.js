/**
 * @-Markierungen wirken? — Kasten 25 (Schema 86_markierungen)
 *
 * UNGETESTET: geschrieben vom Unteragenten, der keine Prüfläufe gegen
 * Supabase und Port 3000 ausführen darf. Der Hauptagent spielt das Schema
 * ein und lässt den Lauf dann zum ersten Mal laufen.
 *
 * Zwei Testkonten, A = test@all-media.app, B = Prüfkonto. Gezählt wird nie
 * „es gibt eine Mitteilung", sondern der Zuwachs seit einem Zeitstempel vor
 * der Handlung (wie _mitteilungen.js) — und jede Gegenprobe (Block, „niemand",
 * sich selbst) fragt dasselbe, damit sie nicht aus falschem Grund grün ist.
 *
 *  Teil 1 — Website (Port 3000, angemeldet als B):
 *    1. markierterText macht aus @<A> einen Link, ein erfundener Name bleibt Text
 *    2. Klick auf den Link öffnet das Profil von A
 *    3. markierungsEingabe zeigt beim Tippen von @ eine Liste mit A
 *  Teil 2 — Datenbank (beide Konten, ohne Oberfläche):
 *    4. A markiert B in einer Beschreibung → post_tags, markierungen,
 *       genau eine Mitteilung „mention/post" bei B
 *    5. Bearbeiten: B bleibt drin → keine zweite Mitteilung; B fällt raus →
 *       Markierung und Mitteilung weg
 *    6. A markiert B in einem Kommentar → Mitteilung „mention/comment"
 *    7. Chat: A erwähnt B in einem gemeinsamen Chat → markierungen-Zeile,
 *       im Messenger „@" (meine_chat_erwaehnungen), im Community-Chat Glocke
 *    8. markierungen_melden: nur der Absender, Klartext gibt 0
 *    9. Sich selbst markieren → keine Mitteilung
 *   10. B blockiert A → keine Markierung, keine Mitteilung, nicht in Vorschlägen
 *   11. B stellt „Wer darf mich markieren" auf niemand → keine Markierung
 *   12. Gelöschter Beitrag nimmt die Mitteilung mit
 *   13. Minderjährige wie Volljährige (Schema 87): markierbar und in der
 *       @-Liste auch über die freie Suche — zurückgerollte Transaktion über
 *       die Management-API, nur mit SUPABASE_TOKEN
 *
 * Start:  node test/_markieren.js   (Server auf 3000 für Teil 1; ohne Server
 *         nur Teil 2 mit OHNE_WEB=1)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { nurTestkonto } = require('./_nur_testkonten');
const { TESTKONTO_PASS, PRUEFKONTO_PASS } = require('./_testpasswoerter');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

const A_ZUGANG = { email: 'test@all-media.app', passwort: TESTKONTO_PASS };
const B_ZUGANG = {
  email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
  passwort: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
};

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

async function anmeldenDb(zugang) {
  const client = createClient(URL, KEY);
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  const { data: p } = await client.from('profiles').select('handle, name').eq('id', data.user.id).single();
  return { client, id: data.user.id, handle: p.handle, name: p.name };
}

const jetzt = () => new Date(Date.now() - 1000).toISOString();

const PROJEKT = (URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'ijztosbjfybdgotpdixw';
const sqlWert = (t) => `'${String(t).replace(/'/g, "''")}'`;

/**
 * Schema 87: B wird in einer Transaktion minderjährig, A markiert B. Die
 * Transaktion endet mit einer Ausnahme, die das Ergebnis trägt — es bleibt
 * nichts, auch keine Mitteilung.
 */
async function teilMinderjaehrig(a, b) {
  console.log('\nMinderjährig (Schema 87)');
  if (!process.env.SUPABASE_TOKEN) {
    console.log('  übersprungen (kein SUPABASE_TOKEN)');
    return;
  }
  const als = (uid) => `
    perform set_config('request.jwt.claims', json_build_object('sub', '${uid}', 'role', 'authenticated')::text, true);
    set local role authenticated;`;
  const suche = sqlWert(b.handle.slice(1, 5));
  const r = await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `begin;
      create temp table erg (k text, z jsonb);
      grant all on erg to authenticated;
      insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
        values ('${b.id}', current_date - interval '15 years', 'DE', 16, 'frei')
        on conflict (user_id) do update set geburtsdatum = excluded.geburtsdatum, status = 'frei';
      delete from public.follows where (follower_id = '${a.id}' and followee_id = '${b.id}') or (follower_id = '${b.id}' and followee_id = '${a.id}');
      delete from public.contacts where (user_id = '${a.id}' and contact_id = '${b.id}') or (user_id = '${b.id}' and contact_id = '${a.id}');
      delete from public.blocks where (user_id = '${a.id}' and blocked_user_id = '${b.id}') or (user_id = '${b.id}' and blocked_user_id = '${a.id}');
      delete from public.visibility_settings where user_id = '${b.id}' and bereich = 'markierung';
      insert into erg select 'minderjaehrig', to_jsonb(public.ist_minderjaehrig('${b.id}'));
      do $$ declare pid uuid; begin ${als(a.id)}
        insert into public.posts (user_id, kind, description) values ('${a.id}', 'post', 'Prüflauf ' || ${sqlWert(b.handle)}) returning id into pid;
        insert into erg select 'markiert', to_jsonb(exists (select 1 from public.markierungen m where m.quelle_id = pid and m.markiert_id = '${b.id}'));
        insert into erg select 'suche', coalesce((select jsonb_agg(v.rang) from public.markierung_vorschlaege(${suche}) v where v.id = '${b.id}'), '[]'::jsonb);
        insert into erg select 'story_suche', to_jsonb(exists (select 1 from public.story_markierbar(${suche}) v where v.id = '${b.id}'));
        reset role; end $$;
      insert into public.follows (follower_id, followee_id) values ('${a.id}', '${b.id}');
      do $$ begin ${als(a.id)}
        insert into erg select 'nah', coalesce((select jsonb_agg(v.rang) from public.markierung_vorschlaege(${suche}) v where v.id = '${b.id}'), '[]'::jsonb);
        reset role; end $$;
      do $$ begin raise exception 'ERGEBNIS %', (select jsonb_object_agg(k, z) from erg); end $$;` }),
  });
  const text = await r.text();
  let meldung = text;
  try { meldung = JSON.parse(text).message || text; } catch { /* roh lassen */ }
  const treffer = meldung.match(/ERGEBNIS (\{[\s\S]*\})\s*(?:CONTEXT:|$)/);
  if (!treffer) return pruefe('Transaktion lieferte ein Ergebnis', false, meldung.slice(0, 300));
  const erg = JSON.parse(treffer[1]);
  pruefe('B ist in der Transaktion minderjährig (Gegenprobe)', erg.minderjaehrig === true);
  pruefe('Minderjähriges B wird markiert, obwohl A kein Kontakt ist', erg.markiert === true);
  pruefe('@-Liste: B auch über die freie Suche', JSON.stringify(erg.suche) === '["suche"]', JSON.stringify(erg.suche));
  pruefe('Story-Liste: B auch über die freie Suche', erg.story_suche === true);
  pruefe('@-Liste: B, sobald A ihm folgt (Nähe)', JSON.stringify(erg.nah) === '["nah"]', JSON.stringify(erg.nah));
  const [{ n } = {}] = JSON.parse((await (await fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.SUPABASE_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `select count(*)::int as n from public.posts where user_id = '${a.id}' and description = 'Prüflauf ' || ${sqlWert(b.handle)}` }),
  })).text()) || '[]');
  pruefe('Transaktion hat nichts hinterlassen', n === 0, String(n));
}

// ---------------------------------------------------------------- Teil 1 --
async function teilWebsite(a) {
  console.log('\nWebsite (angemeldet als Prüfkonto)');
  const { chromium } = require('playwright-core');
  const { anmelden, beenden } = require('./_konto');
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    page.setDefaultTimeout(10000);
    const jsFehler = [];
    page.on('pageerror', (e) => jsFehler.push(e.message));
    await page.goto(ZIEL, { waitUntil: 'load' });
    const an = await anmelden(page);
    if (!an.ok) {
      pruefe('Prüfkonto auf der Website angemeldet', false, an.fehler);
      return;
    }
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('[data-area]', { timeout: 20000 });

    pruefe('window.Markierung ist geladen', await page.evaluate(() => Boolean(window.Markierung)));

    // 1. Link und erfundener Name.
    await page.evaluate((handle) => {
      const box = document.createElement('div');
      box.id = 'markierprobe';
      box.style.cssText = 'position:fixed;top:60px;left:10px;z-index:99999;background:#fff;padding:8px';
      box.innerHTML = markierterText(`Hallo ${handle} und @gibtesnicht_xyz123`);
      document.body.appendChild(box);
    }, a.handle);
    await page.waitForSelector('#markierprobe [data-markierung]', { timeout: 6000 }).catch(() => null);
    const probe = await page.evaluate(() => {
      const box = document.getElementById('markierprobe');
      return {
        links: [...box.querySelectorAll('[data-markierung]')].map((n) => ({ text: n.textContent, id: n.dataset.markierung })),
        text: box.textContent,
      };
    });
    pruefe('@A wird ein Link mit der Kennung von A',
      probe.links.length === 1 && probe.links[0].id === a.id, JSON.stringify(probe.links));
    pruefe('Erfundener Name bleibt Text (kein zweiter Link), Text unverändert',
      probe.text === `Hallo ${a.handle} und @gibtesnicht_xyz123`);

    // 2. Klick öffnet das Profil.
    await page.click('#markierprobe [data-markierung]');
    // Auf das Ergebnis warten, nicht fest: openProfile holt erst zwei Antworten.
    const profilOffen = await page.waitForFunction((name) => {
      const ov = document.getElementById('overlay');
      return Boolean(ov && !ov.hidden && ov.textContent.includes(name));
    }, a.name, { timeout: 15000 }).then(() => true).catch(() => false);
    pruefe('Klick auf @A öffnet das Profil von A', profilOffen);
    await page.evaluate(() => document.getElementById('markierprobe')?.remove());
    await page.keyboard.press('Escape').catch(() => {});

    // 3. Vorschlagsliste.
    await page.evaluate(() => {
      const t = document.createElement('textarea');
      t.id = 'markiereingabe';
      t.style.cssText = 'position:fixed;top:400px;left:10px;width:300px;height:40px;z-index:99999';
      document.body.appendChild(t);
      markierungsEingabe(t);
    });
    await page.click('#markiereingabe');
    await page.keyboard.type('Hi @' + a.handle.replace(/^@/, '').slice(0, 3));
    await page.waitForSelector('.markierliste [data-mwahl]', { timeout: 6000 }).catch(() => null);
    const liste = await page.evaluate(() => [...document.querySelectorAll('.markierliste__namen span')].map((n) => n.textContent));
    pruefe('Beim Tippen von @ steht A in der Liste', liste.includes(a.handle), JSON.stringify(liste));
    await page.keyboard.press('Enter');
    const nachWahl = await page.evaluate(() => document.getElementById('markiereingabe').value);
    pruefe('Enter setzt den vollen Namen ein', nachWahl === `Hi ${a.handle} `, JSON.stringify(nachWahl));

    pruefe('Keine JS-Fehler auf der Seite', jsFehler.length === 0, jsFehler.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------- Teil 2 --
async function teilDatenbank(a, b) {
  const wegRaeumen = [];
  const neueBei = async (konto, seit, ziel) => {
    const { data, error } = await konto.client
      .from('notifications')
      .select('id, art, actor_id, target_type, target_id, created_at')
      .eq('art', 'mention')
      .gt('created_at', seit);
    if (error) throw error;
    return (data || []).filter((n) => (!ziel.typ || n.target_type === ziel.typ) && (!ziel.id || n.target_id === ziel.id)
      && !(ziel.ausser && ziel.ausser.has(n.id)));
  };
  const beitrag = async (text) => {
    const { data, error } = await a.client.from('posts')
      .insert({ user_id: a.id, kind: 'post', description: text }).select('id').single();
    if (error) throw error;
    wegRaeumen.push(() => a.client.from('posts').delete().eq('id', data.id));
    return data.id;
  };
  const markiertIn = async (art, id) => {
    const { data } = await b.client.from('markierungen').select('markiert_id').eq('quelle_art', art).eq('quelle_id', id);
    return (data || []).some((z) => z.markiert_id === b.id);
  };

  try {
    // Ausgangslage: keine Blockierung, Markieren erlaubt.
    await b.client.from('blocks').delete().eq('user_id', b.id).eq('blocked_user_id', a.id);
    await a.client.from('blocks').delete().eq('user_id', a.id).eq('blocked_user_id', b.id);
    await b.client.from('visibility_settings').delete().eq('user_id', b.id).eq('bereich', 'markierung');

    console.log('\nBeschreibung');
    let seit = jetzt();
    const p1 = await beitrag(`Prüflauf Markierung mit ${b.handle} am Hafen.`);
    const { data: tags } = await a.client.from('post_tags').select('user_id').eq('post_id', p1);
    pruefe('post_tags: B ist markiert (Reiter „Markiert")', (tags || []).some((t) => t.user_id === b.id));
    pruefe('markierungen: Zeile für B, B kann sie lesen', await markiertIn('post', p1));
    let n = await neueBei(b, seit, { typ: 'post', id: p1 });
    pruefe('B hat genau eine Mitteilung „mention/post"', n.length === 1 && n[0].actor_id === a.id, `${n.length} Stück`);

    console.log('\nBearbeiten');
    // Nicht nach Uhrzeit allein: jetzt() liegt eine Sekunde zurück, die
    // Mitteilung vom Anlegen eben fiele sonst als „neu" mit hinein.
    const schonDa = new Set(n.map((x) => x.id));
    seit = jetzt();
    const { error: eUpd } = await a.client.from('posts')
      .update({ description: `Neu: ${b.handle} immer noch dabei` }).eq('id', p1);
    pruefe('A darf die eigene Beschreibung ändern', !eUpd, eUpd?.message);
    n = await neueBei(b, seit, { typ: 'post', id: p1, ausser: schonDa });
    pruefe('B bleibt markiert → keine zweite Mitteilung', n.length === 0, `${n.length} neu`);
    await a.client.from('posts').update({ description: 'Ohne Namen' }).eq('id', p1);
    pruefe('B fällt aus dem Text → Markierung weg', !(await markiertIn('post', p1)));
    const { data: rest } = await b.client.from('notifications').select('id')
      .eq('art', 'mention').eq('target_type', 'post').eq('target_id', p1);
    pruefe('… und die Mitteilung auch', (rest || []).length === 0, `${(rest || []).length} übrig`);

    console.log('\nKommentar');
    const p2 = await beitrag('Prüflauf Beitrag für Kommentar');
    seit = jetzt();
    const { data: k, error: eK } = await a.client.from('comments')
      .insert({ post_id: p2, user_id: a.id, text: `Schau mal ${b.handle}!` }).select('id').single();
    pruefe('Kommentar angelegt', !eK, eK?.message);
    if (k) {
      n = await neueBei(b, seit, { typ: 'comment', id: k.id });
      pruefe('B hat eine Mitteilung „mention/comment"', n.length === 1, `${n.length} Stück`);
      pruefe('markierungen: Kommentar-Zeile für B', await markiertIn('comment', k.id));
    }

    // Chat: beide Bereiche mit eigenen Prüfchats, nicht „falls zufällig einer
    // da ist" — sonst bliebe der Teil still übersprungen.
    for (const bereich of ['community', 'messenger']) {
      console.log(`\nChat (${bereich})`);
      const { data: chat, error: eC } = await a.client.from('chats')
        .insert({ name: 'Prüflauf Kasten 25', is_group: false, bereich, created_by: a.id }).select('id').single();
      pruefe(`${bereich}-Prüfchat angelegt`, !eC, eC?.message);
      if (!chat) continue;
      wegRaeumen.push(async () => {
        await a.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', a.id);
        await b.client.from('messages').delete().eq('chat_id', chat.id).eq('sender_id', b.id);
        await b.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', b.id);
        await a.client.from('chat_members').delete().eq('chat_id', chat.id).eq('user_id', a.id);
        await a.client.from('chats').delete().eq('id', chat.id);
      });
      await a.client.from('chat_members').insert({ chat_id: chat.id, user_id: a.id });
      // Im Messenger darf A einen Fremden nicht eintragen (Schema 57); B tritt
      // selbst bei, wie nach einer angenommenen Anfrage.
      const { error: eMb } = await (bereich === 'messenger' ? b : a).client
        .from('chat_members').insert({ chat_id: chat.id, user_id: b.id });
      pruefe('B ist Mitglied', !eMb, eMb?.message);
      const vorhanden = new Set((await neueBei(b, new Date(Date.now() - 3600000).toISOString(), {})).map((x) => x.id));
      seit = jetzt();
      const { data: m, error: eM } = await a.client.from('messages')
        .insert({ chat_id: chat.id, sender_id: a.id, text: `Prüflauf ${b.handle} hallo` })
        .select('id').single();
      pruefe('Klartext-Nachricht angelegt', !eM, eM?.message);
      if (!m) continue;
      pruefe('markierungen: Nachricht-Zeile für B', await markiertIn('message', m.id));
      if (bereich === 'community') {
        n = await neueBei(b, seit, { typ: 'chat', id: chat.id });
        pruefe('Community-Chat: B hat eine Mitteilung „mention/chat"', n.length === 1, `${n.length} Stück`);
      } else {
        n = await neueBei(b, seit, { ausser: vorhanden });
        pruefe('Messenger: KEINE Glocke (strikte Trennung)', n.length === 0, `${n.length} Stück`);
        const { data: chats } = await b.client.rpc('meine_chat_erwaehnungen');
        pruefe('Messenger: „@" in der Chatliste von B', (chats || []).some((z) => z.chat_id === chat.id));
      }
      const { error: eFremd } = await b.client.rpc('markierungen_melden', { p_nachricht: m.id, p_ids: [a.id] });
      pruefe('markierungen_melden: Fremde Nachricht wird abgelehnt', Boolean(eFremd));
      const { data: null0, error: eEigen } = await a.client.rpc('markierungen_melden', { p_nachricht: m.id, p_ids: [b.id] });
      pruefe('markierungen_melden: Klartext gibt 0 (löst der Auslöser)', !eEigen && Number(null0) === 0, eEigen?.message);
    }

    console.log('\nSich selbst markieren');
    seit = jetzt();
    const p3 = await beitrag(`Ich bin ${a.handle}`);
    n = await neueBei(a, seit, { typ: 'post', id: p3 });
    pruefe('A bekommt keine Mitteilung über sich selbst', n.length === 0, `${n.length} Stück`);

    console.log('\nBlockiert');
    const { data: vorher } = await a.client.rpc('markierung_vorschlaege', { p_suche: b.handle.slice(1, 5) });
    pruefe('Ohne Blockierung steht B in den Vorschlägen von A', (vorher || []).some((p) => p.id === b.id));
    const { error: eBlock } = await b.client.from('blocks').insert({ user_id: b.id, blocked_user_id: a.id });
    pruefe('B blockiert A', !eBlock, eBlock?.message);
    if (!eBlock) {
      wegRaeumen.push(() => b.client.from('blocks').delete().eq('user_id', b.id).eq('blocked_user_id', a.id));
      seit = jetzt();
      const p4 = await beitrag(`Trotzdem ${b.handle}`);
      n = await neueBei(b, seit, { typ: 'post', id: p4 });
      pruefe('Blockiert: keine Mitteilung', n.length === 0, `${n.length} Stück`);
      pruefe('Blockiert: keine Markierung', !(await markiertIn('post', p4)));
      const { data: nachher } = await a.client.rpc('markierung_vorschlaege', { p_suche: b.handle.slice(1, 5) });
      pruefe('Blockiert: B fehlt in den Vorschlägen', !(nachher || []).some((p) => p.id === b.id));
      await b.client.from('blocks').delete().eq('user_id', b.id).eq('blocked_user_id', a.id);
    }

    console.log('\n„Wer darf mich markieren": niemand');
    const { error: eStufe } = await b.client.from('visibility_settings')
      .upsert({ user_id: b.id, bereich: 'markierung', stufe: 'niemand' }, { onConflict: 'user_id,bereich' });
    pruefe('B stellt auf niemand', !eStufe, eStufe?.message);
    wegRaeumen.push(() => b.client.from('visibility_settings').delete().eq('user_id', b.id).eq('bereich', 'markierung'));
    seit = jetzt();
    const p5 = await beitrag(`Wieder ${b.handle}`);
    n = await neueBei(b, seit, { typ: 'post', id: p5 });
    pruefe('„niemand": keine Mitteilung', n.length === 0, `${n.length} Stück`);
    pruefe('„niemand": keine Markierung', !(await markiertIn('post', p5)));
    await b.client.from('visibility_settings').delete().eq('user_id', b.id).eq('bereich', 'markierung');

    console.log('\nGelöscht');
    seit = jetzt();
    const p6 = await beitrag(`Kurz ${b.handle}`);
    n = await neueBei(b, seit, { typ: 'post', id: p6 });
    pruefe('Vor dem Löschen: Mitteilung da', n.length === 1, `${n.length} Stück`);
    await a.client.from('posts').delete().eq('id', p6);
    n = await neueBei(b, seit, { typ: 'post', id: p6 });
    pruefe('Nach dem Löschen: Mitteilung weg', n.length === 0, `${n.length} Stück`);
  } finally {
    for (const f of wegRaeumen.reverse()) await Promise.resolve(f()).catch(() => {});
  }
}

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }
  const a = await anmeldenDb(A_ZUGANG);
  const b = await anmeldenDb(B_ZUGANG);

  // Website zuerst: anmelden() setzt den Bestand des Prüfkontos zurück.
  if (!process.env.OHNE_WEB) await teilWebsite(a);
  await teilDatenbank(a, b);
  await teilMinderjaehrig(a, b);

  console.log(`\n${geprueft - fehler}/${geprueft} Prüfungen bestanden`);
  process.exit(fehler ? 1 : 0);
})().catch((e) => {
  console.error('ABBRUCH', e.message || e);
  process.exit(1);
});
