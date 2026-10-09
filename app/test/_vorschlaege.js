#!/usr/bin/env node
/**
 * Kasten 23 — „Personen, die du kennen könntest" (Henrik 06.10.2026: „wie z. B.
 * bei Instagram … nur unter Videos und Communitys").
 *
 * WAS DIESER LAUF ZEIGT — die WIRKUNG, nicht das Vorhandensein
 *
 *   A  Datenbank, mit beiden Testkonten (@test = T, @prueflauf = P), ohne
 *      /api/reset. Alles, was der Lauf setzt, stellt er am Ende zurück und
 *      prüft, dass das Löschen gegriffen hat (abgelehntes DELETE meldet unter
 *      RLS Erfolg mit null Zeilen).
 *        1. Freund von Freund: P folgt T, T folgt @greta und @hakan →
 *           P bekommt @greta mit „Gefolgt von @test" (Videos UND Communitys).
 *        2. „Folgt dir": T folgt P nicht, P folgt T → bei T steht P mit
 *           „Folgt dir" (Videos).
 *        3. Niemand, dem man schon folgt; man selbst nie.
 *        4. Nur die eigene Welt: in keiner Liste ein echtes Konto.
 *        5. Folgen entfernt die Person (P folgt @hakan → weg).
 *        6. Blockieren: P blockiert @hakan → weg, auch nach dem Entfolgen.
 *        7. Entfernen dauerhaft: P entfernt @greta → weg, auch in einer
 *           frischen Sitzung; T kann P's Zeile nicht lesen.
 *        8. Blockieren in Gegenrichtung: T blockiert P → T und P sehen sich
 *           gegenseitig nicht.
 *        9. Ohne Anmeldung: Funktion nicht aufrufbar.
 *
 *   B  Nur mit SUPABASE_TOKEN (Management-API):
 *        10. Sicht eines ECHTEN Kontos — in einer READ-ONLY-Transaktion: kein
 *            Testkonto, kein Beispielprofil in seiner Liste.
 *        11. Minderjährige und Messenger-Kontakte — in einer Transaktion, die
 *            mit einer absichtlichen Ausnahme endet und damit vollständig
 *            ZURÜCKGEROLLT wird (es bleibt nichts, auch keine Mitteilung):
 *            @ida bekommt ein Geburtsdatum unter 18 → nie vorgeschlagen;
 *            @clara und P führen sich gegenseitig als Kontakt → „Aus deinem
 *            Messenger"; einseitig → kein Messenger-Grund; @ida selbst
 *            bekommt keine Vorschläge.
 *
 *   C  Website (Playwright gegen Port 3000, Anmeldung als P OHNE Reset):
 *        12. Videos → Home zeigt den Abschnitt mit @greta und Begründung.
 *        13. Communitys → Home zeigt den Abschnitt.
 *        14. Messenger → Chats zeigt KEINEN Abschnitt.
 *        15. Klick auf „Folgen" nimmt die Karte weg und schreibt `follows`;
 *            Klick auf × nimmt sie weg und schreibt `vorschlag_entfernt`.
 *
 *   D  Quelltext beider Seiten: Abschnitt genau in Videos-Feed und
 *      Communitys-Startseite, nicht im Messenger; gleiche Überschrift.
 *
 * WAS ER NICHT ZEIGT: das Bild in der App. Dafür im Simulator „All-Media
 * Test" Videos → Home (nach dem zweiten Beitrag) und Communitys → Home ansehen.
 *
 * Voraussetzung: SUPABASE_SCHEMA_<n>_personen_vorschlaege.sql eingespielt;
 * für C der Server auf Port 3000.
 *
 * Start:  node test/_vorschlaege.js   (npm run test:vorschlaege)
 *         SUPABASE_TOKEN=sbp_… für Teil B; OHNE_BROWSER=1 überspringt Teil C.
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
const PROJEKT = (URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1] || 'ijztosbjfybdgotpdixw';
const TOKEN = process.env.SUPABASE_TOKEN || '';
const BASIS = process.env.BASIS || 'http://localhost:3000';

const TESTKONTO = { email: 'test@all-media.app', passwort: TESTKONTO_PASS, rufname: '@test' };
const PRUEFKONTO = {
  email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
  passwort: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
  rufname: '@prueflauf',
};

// Die Testwelt: Claudes Testkonten und die Beispielprofile (Schema 62/7).
const TESTWELT = new Set(['@test', '@prueflauf', '@anna', '@bob', '@clara', '@david', '@elif', '@finn', '@greta', '@hakan', '@ida']);

let fehler = 0;
let pruefungen = 0;
const pruefe = (name, wahr, zusatz = '') => {
  pruefungen++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

const mitFrist = (versprechen, was, ms = 20000) =>
  Promise.race([
    versprechen,
    new Promise((_, nein) => setTimeout(() => nein(new Error(`Zeitgrenze: ${was}`)), ms)),
  ]);

async function anmelden(zugang) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id, rufname: zugang.rufname };
}

async function vorschlaege(konto, bereich) {
  const { data, error } = await mitFrist(
    konto.client.rpc('personen_vorschlaege', { p_bereich: bereich, p_anzahl: 30 }),
    `Vorschläge ${konto.rufname} ${bereich}`
  );
  if (error) throw new Error(`personen_vorschlaege (${konto.rufname}, ${bereich}): ${error.message}`);
  return data || [];
}

const handles = (liste) => liste.map((v) => v.handle).join(', ') || '(leer)';
const finde = (liste, id) => liste.find((v) => v.id === id);

// ---------------------------------------------------------------- Zeilen ---
// Jede gesetzte Zeile wird gemerkt und am Ende entfernt — nur, wenn sie vorher
// nicht da war.
const aufraeumen = [];

async function gibt(konto, tabelle, schluessel) {
  let q = konto.client.from(tabelle).select('*', { count: 'exact', head: true });
  for (const [k, w] of Object.entries(schluessel)) q = q.eq(k, w);
  const { count, error } = await q;
  if (error) throw new Error(`${tabelle} lesen: ${error.message}`);
  return (count || 0) > 0;
}

async function setze(konto, tabelle, schluessel) {
  if (await gibt(konto, tabelle, schluessel)) return;
  const { error } = await konto.client.from(tabelle).insert(schluessel);
  if (error && error.code !== '23505') throw new Error(`${tabelle} setzen: ${error.message}`);
  aufraeumen.push({ konto, tabelle, schluessel });
}

async function nimm(konto, tabelle, schluessel, merken = true) {
  if (!(await gibt(konto, tabelle, schluessel))) return;
  let q = konto.client.from(tabelle).delete({ count: 'exact' });
  for (const [k, w] of Object.entries(schluessel)) q = q.eq(k, w);
  const { error, count } = await q;
  if (error) throw new Error(`${tabelle} löschen: ${error.message}`);
  if (!count) throw new Error(`${tabelle}: Löschen griff nicht (RLS?)`);
  // Was vorher da war, kommt am Ende wieder hin.
  if (merken) aufraeumen.push({ konto, tabelle, schluessel, wiederherstellen: true });
}

async function zurueckstellen() {
  for (const z of aufraeumen.reverse()) {
    try {
      if (z.wiederherstellen) {
        if (!(await gibt(z.konto, z.tabelle, z.schluessel))) {
          await z.konto.client.from(z.tabelle).insert(z.schluessel);
        }
        pruefe(`Aufräumen: ${z.tabelle} wiederhergestellt`, await gibt(z.konto, z.tabelle, z.schluessel));
      } else {
        await nimm(z.konto, z.tabelle, z.schluessel, false);
        pruefe(`Aufräumen: ${z.tabelle} ${JSON.stringify(z.schluessel)} entfernt`, !(await gibt(z.konto, z.tabelle, z.schluessel)));
      }
    } catch (e) {
      pruefe(`Aufräumen ${z.tabelle}`, false, e.message);
    }
  }
}

// ------------------------------------------------------ Management-API ---
async function sql(abfrage) {
  const r = await mitFrist(
    fetch(`https://api.supabase.com/v1/projects/${PROJEKT}/database/query`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: abfrage }),
    }),
    'Management-API',
    30000
  );
  return { status: r.status, text: await r.text() };
}

/**
 * Führt `koerper` in einer Transaktion aus, die am Ende mit einer
 * absichtlichen Ausnahme abbricht → alles zurückgerollt. Das Ergebnis steht in
 * der Fehlermeldung (ERGEBNIS {...}).
 */
async function zurueckgerollt(koerper) {
  const { text } = await sql(`begin;\n${koerper}\nselect 1/0;`);
  let meldung = text;
  try { meldung = JSON.parse(text).message || text; } catch { /* roh lassen */ }
  const treffer = meldung.match(/ERGEBNIS (\{[\s\S]*\})\s*(?:CONTEXT:|$)/);
  if (!treffer) throw new Error('Kein Ergebnis aus der Transaktion: ' + meldung.slice(0, 300));
  return JSON.parse(treffer[1]);
}

const sichtSql = (uid, bereich) => `
  (select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'handle', t.handle, 'grund', t.grund)), '[]'::jsonb)
     from public.personen_vorschlaege('${bereich}', 30) t)`;

const alsKonto = (uid) => `
  perform set_config('request.jwt.claims', json_build_object('sub', '${uid}', 'role', 'authenticated')::text, true);
  set local role authenticated;`;

// =================================================================== Lauf ===
(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }

  // ------------------------------------------------------------- Teil D --
  console.log('\nD  Quelltext: nur Videos und Communitys, gleiche Überschrift');
  const WURZEL = path.join(__dirname, '..', '..');
  const lies = (rel) => fs.readFileSync(path.join(WURZEL, rel), 'utf8');
  const FEED = lies('app/screens/home/HomeFeedScreen.tsx');
  const KOMM = lies('app/screens/communities/CommunitiesScreen.tsx');
  const LIB = lies('app/lib/vorschlaege.ts');
  const WEB = lies('web/public/app.js');
  const titelApp = (LIB.match(/VORSCHLAG_TITEL = '([^']+)'/) || [])[1];
  const titelWeb = (WEB.match(/const VORSCHLAG_TITEL = '([^']+)'/) || [])[1];
  pruefe('Überschrift in App und Website gleich', titelApp && titelApp === titelWeb, `${titelApp} | ${titelWeb}`);
  pruefe('App: Videos-Feed zeigt den Abschnitt', /<PersonenVorschlaege bereich="videos"/.test(FEED));
  pruefe('App: Communitys-Startseite zeigt den Abschnitt', /<PersonenVorschlaege bereich="communitys"/.test(KOMM));
  const messengerDateien = fs
    .readdirSync(path.join(WURZEL, 'app/screens/messenger'))
    .map((d) => lies('app/screens/messenger/' + d));
  pruefe('App: kein Messenger-Bildschirm nutzt den Abschnitt', !messengerDateien.some((q) => /PersonenVorschlaege/.test(q)));
  const appTsx = lies('app/App.tsx');
  pruefe('App: Abschnitt nicht direkt in App.tsx (nur über Feed/Communitys)', !/<PersonenVorschlaege/.test(appTsx));
  const webAufrufe = [...WEB.matchAll(/vorschlaegeHtml\('(\w+)'\)/g)].map((m) => m[1]).sort();
  pruefe('Website: Abschnitt genau in Videos und Communitys', JSON.stringify(webAufrufe) === '["communitys","videos"]', webAufrufe.join(','));
  const renderChats = (WEB.match(/function renderChats\(\)[\s\S]*?\n}\n/) || [''])[0];
  pruefe('Website: Chatliste ohne Abschnitt', renderChats.length > 0 && !/vorschlaege/i.test(renderChats));

  // ------------------------------------------------------------- Teil A --
  console.log('\nA  Datenbank mit beiden Testkonten');
  const T = await mitFrist(anmelden(TESTKONTO), 'Anmeldung @test');
  const P = await mitFrist(anmelden(PRUEFKONTO), 'Anmeldung @prueflauf');

  const { data: bsp, error: bspFehler } = await P.client
    .from('profiles')
    .select('id, handle')
    .in('handle', ['@greta', '@hakan', '@ida', '@clara']);
  if (bspFehler) throw bspFehler;
  const id = Object.fromEntries((bsp || []).map((z) => [z.handle, z.id]));
  if (!id['@greta'] || !id['@hakan']) {
    console.error('FEHLER  Beispielprofile @greta/@hakan fehlen — ohne sie misst der Lauf nichts.');
    process.exit(1);
  }

  // Grundzustand: keine Blocks/Entfernt zwischen den Beteiligten, P folgt
  // weder @greta noch @hakan, T folgt P nicht.
  for (const ziel of [id['@greta'], id['@hakan']]) {
    await nimm(P, 'follows', { follower_id: P.id, followee_id: ziel });
    await nimm(P, 'blocks', { user_id: P.id, blocked_user_id: ziel });
    await nimm(P, 'vorschlag_entfernt', { user_id: P.id, ziel_id: ziel });
  }
  await nimm(T, 'follows', { follower_id: T.id, followee_id: P.id });
  await nimm(T, 'blocks', { user_id: T.id, blocked_user_id: P.id });
  await nimm(P, 'blocks', { user_id: P.id, blocked_user_id: T.id });
  await nimm(T, 'vorschlag_entfernt', { user_id: T.id, ziel_id: P.id });
  await nimm(P, 'vorschlag_entfernt', { user_id: P.id, ziel_id: T.id });

  // Beziehungen
  await setze(P, 'follows', { follower_id: P.id, followee_id: T.id });
  await setze(T, 'follows', { follower_id: T.id, followee_id: id['@greta'] });
  await setze(T, 'follows', { follower_id: T.id, followee_id: id['@hakan'] });

  try {
    // 1 Freund von Freund
    let pv = await vorschlaege(P, 'videos');
    const pk = await vorschlaege(P, 'communitys');
    const greta = finde(pv, id['@greta']);
    pruefe('1 @greta bei @prueflauf (Videos)', !!greta, handles(pv));
    pruefe('1 Begründung „Gefolgt von @test…"', /^Gefolgt von @test( und |$)/.test(greta?.grund || ''), greta?.grund);
    pruefe('1 @greta bei @prueflauf (Communitys)', !!finde(pk, id['@greta']), handles(pk));
    pruefe('1 @hakan bei @prueflauf (Videos)', !!finde(pv, id['@hakan']));
    pruefe('1 jede Zeile hat eine Begründung', pv.every((v) => typeof v.grund === 'string' && v.grund.length > 3));
    pruefe('1 keine Telefonnummer in der Antwort', pv.every((v) => !('phone' in v) && !/\+?\d[\d\s/-]{6,}/.test(v.grund)));

    // 2 Folgt dir
    const tv = await vorschlaege(T, 'videos');
    const tk = await vorschlaege(T, 'communitys');
    const pBeiT = finde(tv, P.id);
    pruefe('2 @prueflauf bei @test mit „Folgt dir" (Videos)', pBeiT?.grund === 'Folgt dir', pBeiT?.grund || handles(tv));
    const pBeiTk = finde(tk, P.id);
    pruefe('2 Communitys: eigener Grund erlaubt (Gewichte), Person trotzdem da', !!pBeiTk, pBeiTk?.grund || handles(tk));

    // 3 schon gefolgt / man selbst
    const { data: pFolgt } = await P.client.from('follows').select('followee_id').eq('follower_id', P.id);
    const gefolgtP = new Set((pFolgt || []).map((f) => f.followee_id));
    pruefe('3 niemand, dem @prueflauf schon folgt', pv.every((v) => !gefolgtP.has(v.id)) && pk.every((v) => !gefolgtP.has(v.id)));
    pruefe('3 @test nicht bei @prueflauf (schon gefolgt)', !finde(pv, T.id) && !finde(pk, T.id));
    pruefe('3 nie man selbst', !finde(pv, P.id) && !finde(tv, T.id) && !finde(pk, P.id) && !finde(tk, T.id));

    // 4 Testwelt
    const fremd = [...pv, ...pk, ...tv, ...tk].filter((v) => !TESTWELT.has(v.handle));
    pruefe('4 kein echtes Konto in den Listen der Testkonten', fremd.length === 0, handles(fremd));

    // 5 Folgen nimmt die Person heraus
    await setze(P, 'follows', { follower_id: P.id, followee_id: id['@hakan'] });
    pv = await vorschlaege(P, 'videos');
    pruefe('5 nach dem Folgen: @hakan weg', !finde(pv, id['@hakan']), handles(pv));
    await nimm(P, 'follows', { follower_id: P.id, followee_id: id['@hakan'] }, false);
    pv = await vorschlaege(P, 'videos');
    pruefe('5 nach dem Entfolgen: @hakan wieder da (Gegenprobe)', !!finde(pv, id['@hakan']));

    // 6 Blockieren
    await setze(P, 'blocks', { user_id: P.id, blocked_user_id: id['@hakan'] });
    pv = await vorschlaege(P, 'videos');
    pruefe('6 blockiert: @hakan weg', !finde(pv, id['@hakan']), handles(pv));

    // 7 Entfernen dauerhaft
    await setze(P, 'vorschlag_entfernt', { user_id: P.id, ziel_id: id['@greta'] });
    pv = await vorschlaege(P, 'videos');
    pruefe('7 entfernt: @greta weg (Videos)', !finde(pv, id['@greta']));
    pruefe('7 entfernt: @greta weg (Communitys)', !finde(await vorschlaege(P, 'communitys'), id['@greta']));
    const P2 = await mitFrist(anmelden(PRUEFKONTO), 'zweite Anmeldung @prueflauf');
    pruefe('7 frische Sitzung: @greta bleibt weg', !finde(await vorschlaege(P2, 'videos'), id['@greta']));
    const { data: fremdZeilen } = await T.client.from('vorschlag_entfernt').select('ziel_id').eq('user_id', P.id);
    pruefe('7 @test liest die Entfernt-Zeilen von @prueflauf nicht', (fremdZeilen || []).length === 0);
    const { error: fremdSchreiben } = await T.client.from('vorschlag_entfernt').insert({ user_id: P.id, ziel_id: id['@hakan'] });
    pruefe('7 @test kann für @prueflauf nichts eintragen', !!fremdSchreiben);

    // 8 Blockieren in Gegenrichtung
    await setze(T, 'blocks', { user_id: T.id, blocked_user_id: P.id });
    const tv8 = await vorschlaege(T, 'videos');
    const pv8 = await vorschlaege(P, 'communitys');
    pruefe('8 @test blockiert @prueflauf: bei @test weg', !finde(tv8, P.id) && !finde(await vorschlaege(T, 'communitys'), P.id));
    pruefe('8 … und @test bei @prueflauf ebenfalls weg', !finde(pv8, T.id));
    await nimm(T, 'blocks', { user_id: T.id, blocked_user_id: P.id }, false);

    // 9 ohne Anmeldung
    const anon = createClient(URL, KEY, { auth: { persistSession: false } });
    const { error: anonFehler } = await anon.rpc('personen_vorschlaege', { p_bereich: 'videos', p_anzahl: 5 });
    pruefe('9 ohne Anmeldung nicht aufrufbar', !!anonFehler, anonFehler?.message);
    const { error: falsch } = await P.client.rpc('personen_vorschlaege', { p_bereich: 'messenger', p_anzahl: 5 });
    pruefe('9 Bereich „messenger" abgewiesen', !!falsch, falsch?.message);

    // ----------------------------------------------------------- Teil B --
    if (!TOKEN) {
      console.log('\nB  übersprungen (kein SUPABASE_TOKEN) — Minderjährige, Messenger, echtes Konto ungeprüft');
    } else {
      console.log('\nB  Management-API: echtes Konto, Minderjährige, Messenger');
      // 10 echtes Konto — read only
      const echt = await sql(`
        select p.id from public.profiles p
         where not public.ist_testkonto(p.id) and not coalesce(p.demo, false)
         order by p.created_at limit 1`);
      const echtId = (JSON.parse(echt.text)[0] || {}).id;
      if (!echtId) {
        pruefe('10 echtes Konto gefunden', false);
      } else {
        const r = await sql(`
          begin transaction read only;
          select set_config('request.jwt.claims', json_build_object('sub', '${echtId}', 'role', 'authenticated')::text, true);
          set local role authenticated;
          select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'handle', t.handle)), '[]'::jsonb) as z
            from (select * from public.personen_vorschlaege('videos', 30)
                  union all select * from public.personen_vorschlaege('communitys', 30)) t;`);
        let liste = [];
        try { liste = JSON.parse(r.text)[0]?.z || []; } catch { /* unten gemeldet */ }
        pruefe('10 Sicht eines echten Kontos abgefragt', r.status < 300, r.text.slice(0, 200));
        pruefe('10 echtes Konto bekommt kein Testkonto/Beispielprofil', liste.every((v) => !TESTWELT.has(v.handle)), handles(liste));
      }

      // 11 Minderjährige + Messenger — zurückgerollt
      if (!id['@ida'] || !id['@clara']) {
        pruefe('11 @ida/@clara vorhanden', false);
      } else {
        const erg = await zurueckgerollt(`
          create temp table erg (k text, z jsonb);
          grant all on erg to authenticated;
          -- P folgt T, T folgt @ida (minderjährig) und @clara
          insert into public.follows (follower_id, followee_id) values
            ('${T.id}', '${id['@ida']}'), ('${T.id}', '${id['@clara']}')
            on conflict do nothing;
          insert into public.konto_alter (user_id, geburtsdatum, land, mindestalter, status)
            values ('${id['@ida']}', current_date - interval '15 years', 'DE', 16, 'frei')
            on conflict (user_id) do update set geburtsdatum = excluded.geburtsdatum, status = 'frei';
          do $$ begin ${alsKonto(P.id)} insert into erg select 'vorher', ${sichtSql(P.id, 'videos')}; reset role; end $$;
          -- einseitiger Kontakt: kein Messenger-Grund
          alter table public.contacts disable trigger user;
          insert into public.contacts (user_id, contact_id, status, herkunft)
            values ('${P.id}', '${id['@clara']}', 'friend', 'nummer')
            on conflict (user_id, contact_id) do update set status = 'friend';
          do $$ begin ${alsKonto(P.id)} insert into erg select 'einseitig', ${sichtSql(P.id, 'videos')}; reset role; end $$;
          insert into public.contacts (user_id, contact_id, status, herkunft)
            values ('${id['@clara']}', '${P.id}', 'friend', 'nummer')
            on conflict (user_id, contact_id) do update set status = 'friend';
          do $$ begin ${alsKonto(P.id)} insert into erg select 'gegenseitig', ${sichtSql(P.id, 'videos')}; reset role; end $$;
          do $$ begin ${alsKonto(id['@ida'])} insert into erg select 'ida', ${sichtSql(id['@ida'], 'videos')}; reset role; end $$;
          do $$ begin raise exception 'ERGEBNIS %', (select jsonb_object_agg(k, z) from erg); end $$;`);
        const hat = (k, wer) => (erg[k] || []).find((v) => v.id === wer);
        pruefe('11 @clara als Freund von Freund da (Gegenprobe)', !!hat('vorher', id['@clara']), handles(erg.vorher || []));
        pruefe('11 minderjährige @ida nie vorgeschlagen', !hat('vorher', id['@ida']) && !hat('gegenseitig', id['@ida']));
        pruefe('11 einseitiger Kontakt: kein „Aus deinem Messenger"', hat('einseitig', id['@clara'])?.grund !== 'Aus deinem Messenger', hat('einseitig', id['@clara'])?.grund);
        pruefe('11 gegenseitiger Kontakt: „Aus deinem Messenger"', hat('gegenseitig', id['@clara'])?.grund === 'Aus deinem Messenger', hat('gegenseitig', id['@clara'])?.grund);
        pruefe('11 minderjähriges Konto selbst bekommt keine Vorschläge', (erg.ida || []).length === 0, handles(erg.ida || []));
        // Gegenprobe: wirklich nichts geblieben
        const rest = await sql(`select (select count(*) from public.konto_alter where user_id = '${id['@ida']}') a,
                                       (select count(*) from public.contacts where user_id = '${id['@clara']}' and contact_id = '${P.id}') b`);
        const z = (JSON.parse(rest.text)[0]) || {};
        pruefe('11 Transaktion hat nichts hinterlassen', Number(z.a) === 0 && Number(z.b) === 0, rest.text);
      }
    }

    // ----------------------------------------------------------- Teil C --
    if (process.env.OHNE_BROWSER) {
      console.log('\nC  übersprungen (OHNE_BROWSER)');
    } else {
      console.log('\nC  Website, angemeldet als @prueflauf ohne Reset');
      // Für die Oberfläche: @greta wieder vorschlagbar, @hakan entblockt.
      await nimm(P, 'vorschlag_entfernt', { user_id: P.id, ziel_id: id['@greta'] }, false);
      await nimm(P, 'blocks', { user_id: P.id, blocked_user_id: id['@hakan'] }, false);
      await websitePruefen(P, id);
    }
  } finally {
    console.log('\nAufräumen');
    await zurueckstellen();
  }

  console.log(`\n${pruefungen - fehler}/${pruefungen} Prüfungen bestanden.`);
  process.exit(fehler ? 1 : 0);
})().catch(async (e) => {
  console.error('ABBRUCH  ' + e.message);
  try { await zurueckstellen(); } catch { /* gemeldet */ }
  process.exit(1);
});

// ------------------------------------------------------------ Website ---
async function websitePruefen(P, id) {
  const { chromium } = require('playwright-core');
  const { mitZeitgrenze, MAIL, PASS } = require('./_konto');
  const browser = await chromium.launch();
  const fehlerImBrowser = [];
  try {
    const kontext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
    const seite = await kontext.newPage();
    seite.on('pageerror', (e) => fehlerImBrowser.push(e.message));
    mitZeitgrenze(seite);

    // Anmelden OHNE /api/reset (siehe _uebernacht.js): der Reset würde die
    // eben gesetzten Beziehungen wieder abräumen.
    await seite.goto(BASIS, { waitUntil: 'load' });
    await seite.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
    await seite.evaluate(() => window.Anmeldung.bereit?.catch(() => null));
    const an = await seite.evaluate(({ m, p }) => window.Anmeldung.anmelden(m, p), { m: MAIL, p: PASS });
    pruefe('12 Anmeldung ohne Reset', !!an?.ok, an?.fehler);
    if (!an?.ok) return;
    await seite.reload({ waitUntil: 'load' });
    await seite.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));

    const bereich = async (area) => {
      await seite.locator(`#bottomnav [data-area="${area}"]`).click();
      await seite.waitForTimeout(300);
    };

    // 12 Videos → Home
    await bereich('videos');
    const abschnittV = seite.locator('[data-testid="vorschlaege-videos"]');
    await abschnittV.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    pruefe('12 Videos: Abschnitt sichtbar', await abschnittV.isVisible());
    const titel = await abschnittV.locator('.vorschlaege__titel').textContent().catch(() => '');
    pruefe('12 Videos: Überschrift', titel === 'Personen, die du kennen könntest', titel);
    const karteGreta = abschnittV.locator(`[data-vorschlag="${id['@greta']}"]`);
    pruefe('12 Videos: Karte @greta', (await karteGreta.count()) === 1);
    const grund = await karteGreta.locator('.vorschlag__grund').textContent().catch(() => '');
    pruefe('12 Videos: Begründung auf der Karte', /^Gefolgt von @test/.test(grund || ''), grund);
    const hdl = await karteGreta.locator('.vorschlag__handle').textContent().catch(() => '');
    pruefe('12 Videos: @handle auf der Karte', hdl === '@greta', hdl);

    // 13 Communitys → Home
    await bereich('communities');
    const abschnittK = seite.locator('[data-testid="vorschlaege-communitys"]');
    await abschnittK.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    pruefe('13 Communitys: Abschnitt sichtbar', await abschnittK.isVisible());

    // 14 Messenger → Chats
    await bereich('messenger');
    await seite.waitForTimeout(1500);
    pruefe('14 Messenger: kein Abschnitt', (await seite.locator('.vorschlaege').count()) === 0);

    // 15 Folgen und Entfernen
    await bereich('videos');
    await abschnittV.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    await abschnittV.locator(`[data-vorschlag-folgen="${id['@hakan']}"]`).click().catch(() => {});
    await seite.waitForTimeout(2500);
    pruefe('15 nach „Folgen": Karte @hakan weg', (await seite.locator(`[data-vorschlag="${id['@hakan']}"]`).count()) === 0);
    const folgtJetzt = await gibt(P, 'follows', { follower_id: P.id, followee_id: id['@hakan'] });
    pruefe('15 nach „Folgen": follows-Zeile da', folgtJetzt);
    if (folgtJetzt) aufraeumen.push({ konto: P, tabelle: 'follows', schluessel: { follower_id: P.id, followee_id: id['@hakan'] } });

    await seite.locator(`[data-vorschlag-weg="${id['@greta']}"]`).first().click().catch(() => {});
    await seite.waitForTimeout(2500);
    pruefe('15 nach ×: Karte @greta weg', (await seite.locator(`[data-vorschlag="${id['@greta']}"]`).count()) === 0);
    const entfernt = await gibt(P, 'vorschlag_entfernt', { user_id: P.id, ziel_id: id['@greta'] });
    pruefe('15 nach ×: vorschlag_entfernt-Zeile da', entfernt);
    if (entfernt) aufraeumen.push({ konto: P, tabelle: 'vorschlag_entfernt', schluessel: { user_id: P.id, ziel_id: id['@greta'] } });

    await seite.reload({ waitUntil: 'load' });
    await bereich('videos');
    await seite.waitForTimeout(4000);
    pruefe('15 nach Neuladen: @greta bleibt weg', (await seite.locator(`[data-vorschlag="${id['@greta']}"]`).count()) === 0);

    pruefe('Keine JS-Fehler im Browser', fehlerImBrowser.length === 0, fehlerImBrowser.slice(0, 3).join(' | '));
  } finally {
    await browser.close().catch(() => {});
  }
}
