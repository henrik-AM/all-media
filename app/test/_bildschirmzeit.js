/**
 * Eigene Bildschirmzeit — die Wirkung (Kasten 22).
 *
 * WAS GEPRÜFT WIRD
 *
 *   1. Datenbank: Limit setzen → Nutzung hochzählen (mit Obergrenze) → der
 *      Stand, den App und Website lesen, sperrt GENAU den Bereich; „Immer
 *      erlaubt" bleibt offen; gesperrter Bereich nur mit Code.
 *   2. Website (Port 3000): die Sperrseite steht statt der Videos, Messenger
 *      und Querformat bleiben offen; „15 Min. mehr" öffnet wieder, ein
 *      zweites Mal gibt es nicht; der Hinweis kurz vor dem Limit kommt.
 *   3. App-Logik: dieselbe Rechnung (gemeinsam/bildschirmzeit.js) mit
 *      demselben Stand; App.tsx hängt die Sperrseite an Bereich und
 *      Vollbildansicht. Das Bild im Simulator muss der Hauptagent ansehen.
 *   4. Entsperrcode: nur als Hash, falscher Code abgelehnt, richtiger öffnet.
 *   5. Eltern: ein Kind (per SQL, wie _minderjaehrig.js) bekommt Limits vom
 *      Prüfkonto; es kann sie nicht lockern, nur strenger machen; entsperren
 *      nur mit dem Code des Elternteils.
 *   6. lockerer() in JS und bildschirmzeit_lockerer() in SQL rechnen gleich.
 *
 * Elternteil ist das PRÜFKONTO, nie @test (gehört dem Simulator). Am Ende
 * werden das Kind gelöscht und die Bildschirmzeit des Prüfkontos geleert.
 *
 * Start:  SUPABASE_TOKEN=… node test/_bildschirmzeit.js   (Server auf Port 3000)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { chromium } = require('playwright-core');
const { frage } = require('./_aufraeumen');
const { schliesse } = require('./_konto');
const { nurTestkonto } = require('./_nur_testkonten');
const { PRUEFKONTO_PASS } = require('./_testpasswoerter');
const B = require('../../gemeinsam/bildschirmzeit');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

const PRUEFER = {
  email: nurTestkonto(process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de'),
  passwort: process.env.AM_TEST_PASS || PRUEFKONTO_PASS,
};
const KENNUNG = Date.now().toString(36);
const KIND_MAIL = `pruef.kind.bz.${KENNUNG}@example.com`;
const KIND_PASS = 'KindPruef2026!';
const ELTERN_CODE = '4711';
const KIND_CODE = '1357';

let fehler = 0;
let geprueft = 0;
const pruefe = (name, wahr, zusatz = '') => {
  geprueft++;
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};
const sql = (t) => `'${String(t).replace(/'/g, "''")}'`;

function geborenVor(jahre) {
  const d = new Date();
  d.setFullYear(d.getFullYear() - jahre);
  d.setDate(d.getDate() - 10);
  return d.toISOString().slice(0, 10);
}

async function anmelden(email, passwort) {
  const client = createClient(URL, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password: passwort });
  if (error) throw new Error(`${email}: ${error.message}`);
  return { client, id: data.user.id };
}

const rpc = async (c, fn, args) => {
  const { data, error } = await c.client.rpc(fn, args);
  if (error) return { ok: false, grund: 'fehler', meldung: error.message };
  return data;
};

/** Die Bildschirmzeit des Prüfkontos leeren (nur Testkonto, nur diese Tabellen). */
async function leeren(id) {
  await frage(`
    delete from public.bildschirmzeit_regeln    where user_id = ${sql(id)};
    delete from public.bildschirmzeit_nutzung   where user_id = ${sql(id)};
    delete from public.bildschirmzeit_freigaben where user_id = ${sql(id)};
    delete from public.bildschirmzeit_takt      where user_id = ${sql(id)};
    delete from public.entsperrcodes            where user_id = ${sql(id)};
    delete from public.entsperrcode_versuche    where user_id = ${sql(id)};`);
}

/** Den Takt zurückstellen, damit der nächste Aufruf bis 120 s zählen darf. */
const taktZurueck = (id) =>
  frage(`update public.bildschirmzeit_takt set zuletzt = now() - interval '5 minutes' where user_id = ${sql(id)}`);

const statusAus = (stand, bereich) =>
  B.status({ regeln: stand.regeln, nutzung: stand.nutzung, freigaben: stand.freigaben, zeitzone: stand.zeitzone, tag: stand.tag }, bereich);

async function seiteAngemeldet(browser) {
  const page = await browser.newPage({ viewport: { width: 430, height: 900 } });
  await page.goto(ZIEL, { waitUntil: 'load' });
  await page.waitForFunction(() => Boolean(window.Anmeldung), null, { timeout: 15000 });
  await page.evaluate(() => window.Anmeldung.bereit?.catch(() => null));
  // Die echte Anmeldung der Seite — ohne /api/reset.
  const an = await page.evaluate(([m, p]) => window.Anmeldung.anmelden(m, p), [PRUEFER.email, PRUEFER.passwort]);
  if (!an.ok) throw new Error(`${PRUEFER.email}: ${an.fehler}`);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof bzBereit === 'function' && bzBereit(), null, { timeout: 20000 });
  return page;
}

/** In einen Bereich wechseln und die Seite neu zeichnen lassen. */
const gehe = (page, area, unter) =>
  page.evaluate(([a, s]) => {
    verlasseExplorer();
    state.area = a;
    state.sub[a] = s;
    render();
  }, [area, unter]);

(async () => {
  if (!URL || !KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }
  if (!process.env.SUPABASE_TOKEN) {
    console.error('FEHLER  SUPABASE_TOKEN fehlt — Kind, Takt und Aufräumen gehen per SQL.');
    process.exit(1);
  }

  const schema = await frage(`select to_regprocedure('public.bildschirmzeit_stand(uuid)') is not null as da`);
  if (!schema?.[0]?.da) {
    console.error('FEHLER  Schema „bildschirmzeit" ist nicht eingespielt.');
    process.exit(1);
  }

  const p = await anmelden(PRUEFER.email, PRUEFER.passwort);
  await leeren(p.id);
  let browser = null;

  try {
    console.log('\n1. Datenbank: Limit setzen, zählen, Stand');

    const regeln = {
      bereiche: {
        videos: { modus: 'limit', werktag: 1, wochenende: 1 },
        chats: { modus: 'immer' },
        live: { modus: 'gesperrt' },
        querformat: { modus: 'limit', werktag: 6, wochenende: 6 },
      },
    };
    let a = await rpc(p, 'bildschirmzeit_setzen', { p_regeln: regeln, p_zeitzone: 'Europe/Berlin', p_ziel: null });
    pruefe('Regeln speichern', a?.ok, JSON.stringify(a));

    await rpc(p, 'bildschirmzeit_zaehlen', { p_stuecke: [{ bereich: 'chats', sekunden: 1 }] }); // legt den Takt an
    await taktZurueck(p.id);
    a = await rpc(p, 'bildschirmzeit_zaehlen', { p_stuecke: [{ bereich: 'videos', sekunden: 90 }] });
    pruefe('90 s Videos gezählt', a?.ok && a.gezaehlt === 90, JSON.stringify(a));
    a = await rpc(p, 'bildschirmzeit_zaehlen', { p_stuecke: [{ bereich: 'videos', sekunden: 100 }] });
    pruefe('gleich danach nimmt die Obergrenze fast nichts an', a?.ok && a.gezaehlt <= 3, JSON.stringify(a));
    await taktZurueck(p.id);
    a = await rpc(p, 'bildschirmzeit_zaehlen', { p_stuecke: [{ bereich: 'querformat', sekunden: 90 }] });
    pruefe('90 s Querformat gezählt', a?.ok && a.gezaehlt === 90);
    a = await rpc(p, 'bildschirmzeit_zaehlen', { p_stuecke: [{ bereich: 'erfunden', sekunden: 5 }] });
    pruefe('ein erfundener Bereich zählt nicht', a?.ok && a.gezaehlt === 0);

    let stand = await rpc(p, 'bildschirmzeit_stand', { p_ziel: null });
    pruefe('Stand liest die gezählte Zeit', stand?.ok && stand.nutzung.videos >= 90, JSON.stringify(stand?.nutzung));
    pruefe('Videos ist zu (Limit 1 Min.)', !statusAus(stand, 'videos').offen && statusAus(stand, 'videos').grund === 'limit');
    pruefe('Messenger-Chats bleiben offen (Immer erlaubt)', statusAus(stand, 'chats').offen);
    pruefe('Querformat offen, Hinweis fällig (4½ Min. Rest)', statusAus(stand, 'querformat').offen && statusAus(stand, 'querformat').hinweis);
    pruefe('Livestreams gesperrt, „15 Min. mehr" gibt es dort nicht', statusAus(stand, 'live').grund === 'gesperrt' && !statusAus(stand, 'live').mehrMoeglich);

    console.log('\n2. Website');

    browser = await chromium.launch();
    const page = await seiteAngemeldet(browser);
    await gehe(page, 'videos', 'home');
    await page.waitForSelector('[data-bz-sperre="videos"]', { timeout: 8000 }).catch(() => {});
    const sperre = await page.locator('[data-bz-sperre="videos"]').innerText().catch(() => '');
    pruefe('Videos: Sperrseite statt des Feeds', /Limit für Videos/.test(sperre), sperre.split('\n')[0]);
    pruefe('… mit „15 Min. mehr" und Entsperrcode', /15 Min\. mehr/.test(sperre) && /Entsperrcode/.test(sperre));
    pruefe('… untere Leiste bleibt bedienbar', await page.locator('#bottomnav, .bottomnav, nav').first().isVisible().catch(() => false));

    await gehe(page, 'messenger', 'chats');
    await page.waitForTimeout(600);
    pruefe('Messenger-Chats offen', !(await page.locator('[data-bz-sperre]').count()));

    await gehe(page, 'videos', 'landscape');
    await page.waitForTimeout(600);
    pruefe('Querformat offen (eigenes Limit noch nicht erreicht)', !(await page.locator('[data-bz-sperre]').count()));
    // Der Hinweis kommt beim nächsten Takt (alle 2 s).
    const hinweis = await page
      .waitForFunction(() => {
        const t = document.querySelector('#toast');
        return t && !t.hidden && /Noch .* für Querformat-Videos heute/.test(t.textContent) ? t.textContent : '';
      }, null, { timeout: 8000 })
      .then((h) => h.jsonValue())
      .catch(() => '');
    pruefe('Hinweis kurz vor dem Limit', Boolean(hinweis), hinweis);

    await gehe(page, 'videos', 'home');
    await page.waitForSelector('[data-bz-mehr]', { timeout: 8000 }).catch(() => {});
    await page.click('[data-bz-mehr]').catch(() => {});
    await page.waitForSelector('[data-bz-sperre]', { state: 'detached', timeout: 8000 }).catch(() => {});
    pruefe('„15 Min. mehr" öffnet Videos wieder', !(await page.locator('[data-bz-sperre]').count()));
    const [{ n: mehrZeilen }] = await frage(`select count(*)::int as n from public.bildschirmzeit_freigaben where user_id = ${sql(p.id)} and ziel = 'videos' and art = 'mehr'`);
    pruefe('… und steht in Supabase', mehrZeilen === 1, String(mehrZeilen));
    a = await rpc(p, 'bildschirmzeit_mehr', { p_ziel: 'videos' });
    pruefe('ein zweites Mal gibt es heute nicht', !a?.ok && a?.grund === 'schon_genutzt', JSON.stringify(a));

    // Die Website zählt selbst: 35 s sichtbar auf Querformat, dann Tab verstecken.
    // Erst dort stehen und abgeben, was die Seite aus den Schritten davor noch
    // hält — sonst zählt die Querformat-Zeit von oben mit (unter Last ~85 s).
    await gehe(page, 'videos', 'landscape');
    await page.evaluate(() => bzSchicken());
    await page.waitForTimeout(1500);
    await taktZurueck(p.id);
    const vorher = (await rpc(p, 'bildschirmzeit_stand', { p_ziel: null })).nutzung.querformat || 0;
    await page.waitForTimeout(35000);
    await page.evaluate(() => bzSchicken());
    await page.waitForTimeout(1500);
    const nachher = (await rpc(p, 'bildschirmzeit_stand', { p_ziel: null })).nutzung.querformat || 0;
    pruefe('die Website zählt die sichtbare Zeit nach Supabase', nachher - vorher >= 25 && nachher - vorher <= 45, `${vorher} → ${nachher}`);

    console.log('\n3. App-Logik (gleiche Rechnung, gleicher Stand)');

    stand = await rpc(p, 'bildschirmzeit_stand', { p_ziel: null });
    for (const [area, sub, overlay, soll] of [
      ['videos', 'home', null, 'videos'],
      ['videos', 'landscape', 'clip', 'querformat'],
      ['messenger', 'chats', 'chat', 'chats'],
      ['messenger', 'chats', 'call', 'anrufe'],
      ['videos', 'home', 'livestream', 'live'],
      ['settings', 'home', null, null],
    ]) {
      pruefe(`App ${area}/${sub}${overlay ? ' + ' + overlay : ''} → ${soll}`, B.bereichFuer(area, sub, overlay) === soll);
    }
    pruefe('App: Livestream-Vollbild wäre gesperrt', !statusAus(stand, B.bereichFuer('videos', 'home', 'livestream')).offen);
    const appQuelle = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');
    pruefe('App.tsx ersetzt Bereich und Vollbild durch die Sperrseite',
      /bzGesperrt && bzBereich\) return <BildschirmzeitSperre/.test(appQuelle) && /overlay && bzGesperrt && bzBereich/.test(appQuelle));
    pruefe('UMD_BAUSTEINE kennt bildschirmzeit', /\['bildschirmzeit', 'Bildschirmzeit'\]/.test(fs.readFileSync(path.join(__dirname, '_modulquelle.js'), 'utf8')));

    console.log('\n4. Entsperrcode');

    a = await rpc(p, 'entsperrcode_setzen', { p_neu: ELTERN_CODE, p_bisher: null });
    pruefe('Code setzen', a?.ok, JSON.stringify(a));
    const [{ hash }] = await frage(`select code_hash as hash from public.entsperrcodes where user_id = ${sql(p.id)}`);
    pruefe('… liegt nur als Hash', String(hash).startsWith('$2') && !String(hash).includes(ELTERN_CODE));
    a = await rpc(p, 'bildschirmzeit_entsperren', { p_ziel: 'live', p_code: '0000', p_minuten: 15 });
    pruefe('falscher Code abgelehnt', !a?.ok && a?.grund === 'falsch');
    a = await rpc(p, 'bildschirmzeit_entsperren', { p_ziel: 'live', p_code: ELTERN_CODE, p_minuten: 15 });
    pruefe('richtiger Code gibt Livestreams 15 Min. frei', a?.ok);
    stand = await rpc(p, 'bildschirmzeit_stand', { p_ziel: null });
    pruefe('… Livestreams ist jetzt offen', statusAus(stand, 'live').offen && statusAus(stand, 'live').rest > 0);

    console.log('\n5. Eltern');

    const ins = await frage(`
      insert into auth.users
        (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
         raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
         confirmation_token, email_change, email_change_token_new, recovery_token)
      values
        ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         ${sql(KIND_MAIL)}, crypt(${sql(KIND_PASS)}, gen_salt('bf')), now(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         ${sql(JSON.stringify({ handle: 'pruefkindbz' + KENNUNG, name: 'Prüfkind BZ', phone: `+49 1${String(Date.now()).slice(-8)}7`, geburtsdatum: geborenVor(12) }))}::jsonb,
         now(), now(), '', '', '', '')
      returning id`);
    const kindId = ins?.[0]?.id;
    pruefe('Kinderkonto angelegt', Boolean(kindId), JSON.stringify(ins).slice(0, 120));
    await frage(`update public.konto_alter set status = 'frei', eltern_id = ${sql(p.id)}, entschieden_am = now() where user_id = ${sql(kindId)}`);
    const k = await anmelden(KIND_MAIL, KIND_PASS);

    const elternRegeln = { gesamt: { werktag: 60 }, bereiche: { videos: { modus: 'limit', werktag: 20 } } };
    a = await rpc(p, 'bildschirmzeit_setzen', { p_regeln: elternRegeln, p_zeitzone: 'Europe/Berlin', p_ziel: kindId });
    pruefe('Elternteil legt die Limits des Kindes fest', a?.ok && a.eltern, JSON.stringify(a));
    const ps = await rpc(p, 'bildschirmzeit_stand', { p_ziel: null });
    pruefe('… und sieht das Kind in seiner Liste', (ps.kinder || []).some((x) => x.id === kindId));

    a = await rpc(k, 'bildschirmzeit_setzen', { p_regeln: { gesamt: { werktag: 60 }, bereiche: { videos: { modus: 'limit', werktag: 30 } } }, p_zeitzone: null, p_ziel: null });
    pruefe('Kind kann das Videolimit nicht erhöhen', !a?.ok && a?.grund === 'eltern', JSON.stringify(a));
    a = await rpc(k, 'bildschirmzeit_setzen', { p_regeln: {}, p_zeitzone: null, p_ziel: null });
    pruefe('Kind kann die Limits nicht löschen', !a?.ok && a?.grund === 'eltern');
    const { error: direkt } = await k.client.from('bildschirmzeit_regeln').update({ regeln: {} }).eq('user_id', kindId);
    const [{ r: nochDa }] = await frage(`select regeln as r from public.bildschirmzeit_regeln where user_id = ${sql(kindId)}`);
    pruefe('… auch nicht an der Funktion vorbei', Boolean(direkt) && nochDa?.bereiche?.videos?.werktag === 20, direkt?.message);
    a = await rpc(k, 'bildschirmzeit_setzen', { p_regeln: { gesamt: { werktag: 45 }, bereiche: { videos: { modus: 'limit', werktag: 10 } } }, p_zeitzone: null, p_ziel: null });
    pruefe('Kind darf strenger machen', a?.ok, JSON.stringify(a));
    const ks = await rpc(k, 'bildschirmzeit_stand', { p_ziel: null });
    pruefe('Kind sieht, wer die Limits gesetzt hat', ks?.eltern?.id === p.id);

    await rpc(k, 'entsperrcode_setzen', { p_neu: KIND_CODE, p_bisher: null });
    a = await rpc(k, 'bildschirmzeit_entsperren', { p_ziel: 'videos', p_code: KIND_CODE, p_minuten: 15 });
    pruefe('Kind entsperrt nicht mit dem eigenen Code', !a?.ok && a?.grund === 'falsch', JSON.stringify(a));
    a = await rpc(k, 'bildschirmzeit_entsperren', { p_ziel: 'videos', p_code: ELTERN_CODE, p_minuten: 15 });
    pruefe('… aber mit dem Code des Elternteils', a?.ok, JSON.stringify(a));

    console.log('\n6. lockerer(): JS und SQL gleich');
    const faelle = [
      [{ bereiche: { videos: { modus: 'limit', werktag: 20 } } }, { bereiche: { videos: { modus: 'limit', werktag: 30 } } }],
      [{ bereiche: { videos: { modus: 'limit', werktag: 20 } } }, { bereiche: { videos: { modus: 'gesperrt' } } }],
      [{ gesamt: { werktag: 60 } }, { gesamt: { werktag: 60, wochenende: 90 } }],
      [{ auszeit: { an: true, von: '22:00', bis: '07:00' } }, { auszeit: { an: true, von: '21:30', bis: '07:00' } }],
      [{ auszeit: { an: true, von: '22:00', bis: '07:00' } }, { auszeit: { an: true, von: '23:00', bis: '07:00' } }],
      [{ pause: 20 }, { pause: 0 }],
    ];
    for (const [alt, neu] of faelle) {
      const [{ r }] = await frage(`select public.bildschirmzeit_lockerer(${sql(JSON.stringify(alt))}::jsonb, ${sql(JSON.stringify(neu))}::jsonb) as r`);
      const js = B.lockerer(alt, neu);
      pruefe(`${JSON.stringify(alt)} → ${JSON.stringify(neu)}`, js === r, `JS ${js} | SQL ${r}`);
    }
  } catch (e) {
    fehler++;
    console.log('  FEHL ' + e.message);
  } finally {
    if (browser) await schliesse(browser);
    await leeren(p.id);
    const weg = await frage(`delete from auth.users where email = ${sql(KIND_MAIL)} returning id`);
    console.log(`\n  (Bildschirmzeit des Prüfkontos geleert, ${Array.isArray(weg) ? weg.length : 0} Kinderkonto gelöscht)`);
  }

  console.log(`\n${geprueft - fehler} von ${geprueft} Pruefungen bestanden`);
  process.exit(fehler ? 1 : 0);
})();
