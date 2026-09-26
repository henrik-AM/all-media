// Prueft den Teilen-Dialog (Feedback 21.09.2026, Kasten 4).
//
// Henrik: oben eine Suchleiste — Kontakte, Communitys, gefolgte Profile und
// Fremde über den genauen Nutzernamen. Unten ein Senden-Knopf, der die Auswahl
// bestätigt. Fremde bekommen nur ein Video, bis sie die Anfrage annehmen —
// die Regel steht in der Datenbank (Schema 21). Und der Knopf geht auch im
// Querformat und im Live.
//
// Vorher schickte jedes Antippen sofort, und unter "Weitere Vorschläge"
// standen alle Profile der Datenbank.
//
// Der Fremde ist @test, das zweite Testkonto. Echte Konten werden nie
// angeschrieben. Den Zweierchat zwischen @prueflauf und @test räumt der Lauf
// am Ende selbst weg — zuruecksetzen() fasst nur Zeilen des Prüfkontos an.
//
// Start:  node test/_teilen.js   (Server muss laufen)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { createClient } = require('@supabase/supabase-js');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');
const K = require('./_kennungen');

const { chatOffen } = require('./_warten');
const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const SB_URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const SB_KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

const FREMDER = { email: 'test@all-media.app', passwort: 'AllMedia2026!', handle: '@test' };
const PRUEFER = {
  email: process.env.AM_TEST_MAIL || 'all.media.prueflauf@web.de',
  passwort: process.env.AM_TEST_PASS || 'PruefLauf2026!',
};

async function direkt(zugang) {
  const client = createClient(SB_URL, SB_KEY);
  const { data, error } = await client.auth.signInWithPassword({ email: zugang.email, password: zugang.passwort });
  if (error) throw new Error(`${zugang.email}: ${error.message}`);
  return { client, id: data.user.id };
}

/** Alle Zweierchats zwischen den beiden Konten, egal in welchem Bereich. */
async function gemeinsameChats(a, b) {
  const { data: meine } = await a.client.from('chat_members').select('chat_id, chats(is_group)').eq('user_id', a.id);
  const ids = (meine || []).filter((m) => m.chats && !m.chats.is_group).map((m) => m.chat_id);
  if (!ids.length) return [];
  const { data: andere } = await a.client.from('chat_members').select('chat_id').in('chat_id', ids).eq('user_id', b.id);
  return (andere || []).map((z) => z.chat_id);
}

async function abraeumen(a, b) {
  for (const chatId of await gemeinsameChats(a, b)) {
    await a.client.from('messages').delete().eq('chat_id', chatId).eq('sender_id', a.id);
    await b.client.from('messages').delete().eq('chat_id', chatId).eq('sender_id', b.id);
    await b.client.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', b.id);
    await a.client.from('chat_members').delete().eq('chat_id', chatId).eq('user_id', a.id);
    await a.client.from('chats').delete().eq('id', chatId);
    await b.client.from('chats').delete().eq('id', chatId);
  }
  // Ein abgelehntes DELETE meldet keinen Fehler — also nachsehen.
  return (await gemeinsameChats(a, b)).length;
}

(async () => {
  if (!SB_URL || !SB_KEY) {
    console.error('FEHLER  SUPABASE_URL/SUPABASE_ANON_KEY fehlen.');
    process.exit(1);
  }
  const pruefer = await direkt(PRUEFER);
  const fremder = await direkt(FREMDER);
  if (await abraeumen(pruefer, fremder)) {
    console.error('Alter Chat zwischen @prueflauf und @test ließ sich nicht entfernen.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen
  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.
  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    // Ohne diesen Schluss lebt das chrome-headless-shell weiter, haelt die
    // geerbte Ausgabe-Pipe offen und laesst den Gesamtlauf haengen (09.09.2026).
    await beenden(browser, 1);
  }

  await page.reload({ waitUntil: 'load' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);

  const ergebnisse = [];
  const pruefe = async (name, fn) => {
    try {
      await fn();
      ergebnisse.push(true);
      console.log('  OK   ' + name);
    } catch (e) {
      ergebnisse.push(false);
      console.log('  FEHL ' + name + ' — ' + (e.message || 'kein Treffer'));
    }
  };

  const gehe = async (area, sub) => {
    await page.click(`[data-area="${area}"]`);
    await page.waitForTimeout(300);
    if (sub) {
      await page.click(`[data-sub="${sub}"]`);
      await page.waitForTimeout(400);
    }
  };

  const knopfText = () => page.$eval('#teilenSenden', (b) => b.textContent.trim());
  const namen = () => page.$$eval('.teilen__name', (els) => els.map((e) => e.textContent));
  const tippen = async (text) => {
    await page.fill('#teilenSuche', text);
    await page.waitForTimeout(150);
  };
  // Mit BILDER=ordner legt der Lauf die drei Zustände des Blatts als Bild ab.
  const bild = async (name) => {
    if (!process.env.BILDER) return;
    fs.mkdirSync(process.env.BILDER, { recursive: true });
    await page.screenshot({ path: path.join(process.env.BILDER, `teilen-${name}.png`) });
  };
  const warteAufSchliessen = () =>
    page.waitForSelector('.teilen', { state: 'detached', timeout: 15000 });

  console.log('\nBlatt: Suche oben, Senden unten');
  await gehe('videos', 'home');

  await pruefe('Der Teilen-Knopf oeffnet das Blatt mit Suchleiste', async () => {
    await page.waitForSelector('[data-paction="share"]', { timeout: 10000 });
    await page.click('[data-paction="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });
    const platzhalter = await page.getAttribute('#teilenSuche', 'placeholder');
    if (platzhalter !== 'Name oder @nutzername') throw new Error('Suchfeld: ' + platzhalter);
    // Die Suche steht über der Liste, der Knopf darunter.
    const [suche, liste, knopf] = await Promise.all(
      ['#teilenSuche', '#teilenListe', '#teilenSenden'].map((s) => page.$eval(s, (e) => e.getBoundingClientRect().top))
    );
    if (!(suche < liste && liste < knopf)) throw new Error(`Reihenfolge ${suche}/${liste}/${knopf}`);
  });

  await pruefe('Gruppen: Kontakte zuerst, dann Communitys — keine fremden Vorschlaege', async () => {
    const koepfe = await page.$$eval('.teilen__kopf', (els) => els.map((e) => e.textContent));
    if (koepfe[0] !== 'Deine Kontakte') throw new Error(koepfe.join(' | '));
    if (!koepfe.includes('Communitys')) throw new Error(koepfe.join(' | '));
    if (koepfe.includes('Weitere Vorschläge')) throw new Error('alle Profile stehen wieder drin');
    const liste = await namen();
    if (!liste.includes('Anna Schmidt')) throw new Error(liste.join(' | '));
    if (liste.includes('Test Nutzer')) throw new Error('Fremder steht ohne Suche in der Liste');
  });

  await pruefe('Ohne Auswahl ist Senden aus', async () => {
    const aus = await page.$eval('#teilenSenden', (b) => b.disabled);
    if (!aus) throw new Error('Knopf ist bedienbar');
    if ((await knopfText()) !== 'Senden') throw new Error(await knopfText());
  });

  await pruefe('Antippen waehlt aus und sendet noch nicht', async () => {
    await page.click(`[data-teilen="${K.person('u1')}"]`);
    await page.click(`[data-teilen="${K.person('u2')}"]`);
    if ((await knopfText()) !== 'An 2 Personen senden') throw new Error(await knopfText());
    await page.click(`[data-teilen="${K.person('u2')}"]`);
    if ((await knopfText()) !== 'An 1 Person senden') throw new Error(await knopfText());
    const gewaehlt = await page.$$eval('.teilen__kachel.is-gewaehlt', (els) => els.length);
    const gesendet = await page.$$eval('.teilen__kachel.is-gesendet', (els) => els.length);
    if (gewaehlt !== 1 || gesendet !== 0) throw new Error(`${gewaehlt} gewählt, ${gesendet} gesendet`);
    await bild('1-auswahl');
  });

  await pruefe('Die Suche filtert nach Name', async () => {
    await tippen('anna');
    const liste = await namen();
    if (liste.length < 1 || liste.some((n) => !/anna/i.test(n))) throw new Error(liste.join(' | '));
  });

  await pruefe('Ein halber Nutzername findet keinen Fremden', async () => {
    await tippen('tes');
    await page.waitForTimeout(800);
    const liste = await namen();
    if (liste.includes('Test Nutzer')) throw new Error('@test über "tes" gefunden');
  });

  await pruefe('Der genaue Nutzername findet den Fremden', async () => {
    await tippen('@test');
    await page.waitForFunction(
      () => [...document.querySelectorAll('.teilen__name')].some((e) => e.textContent === 'Test Nutzer'),
      null, { timeout: 8000 }
    );
    const kopf = await page.$$eval('.teilen__kopf', (els) => els.map((e) => e.textContent));
    if (!kopf.includes('Nutzername')) throw new Error(kopf.join(' | '));
    await bild('2-nutzername');
  });

  await pruefe('Die Auswahl bleibt beim Suchen erhalten', async () => {
    await tippen('');
    const gewaehlt = await page.$$eval('.teilen__kachel.is-gewaehlt .teilen__name', (els) => els.map((e) => e.textContent));
    if (gewaehlt.join() !== 'Anna Schmidt') throw new Error(gewaehlt.join(' | ') || 'nichts gewählt');
  });

  await pruefe('Senden schickt die Auswahl ab und schliesst das Blatt', async () => {
    await page.click('#teilenSenden');
    await warteAufSchliessen();
  });

  await pruefe('Der Beitrag liegt als Karte im Chat', async () => {
    await gehe('messenger', 'chats');
    await page.click(await K.waehlerChat(page, 'Anna Schmidt'));
    await chatOffen(page);
    await page.waitForSelector('.msg__geteilt', { timeout: 10000 }).catch(() => {});
    const karten = await page.$$eval('.msg__geteilt', (els) =>
      els.map((e) => e.querySelector('.msg__geteiltText strong')?.textContent?.trim() ?? '')
    );
    if (!karten.length) throw new Error('keine Karte im Chat');
    if (!karten[karten.length - 1]) throw new Error('Karte ohne Autor');
  });

  await pruefe('Die Chatliste zeigt "Beitrag geteilt" als Vorschau', async () => {
    // Nicht page.goBack(): das führt aus der Einseiten-App auf about:blank.
    await page.click('#chatBack').catch(() => {});
    await page.waitForSelector('#chatSearch', { timeout: 10000 }).catch(() => {});
    const text = await page.$eval('#main', (e) => e.textContent);
    if (!text.includes('Beitrag geteilt')) throw new Error('Vorschau fehlt');
  });

  console.log('\nFremde: ein Video bis zur Annahme');

  await pruefe('Hochformat: ein Video an den Fremden geht durch und zaehlt mit', async () => {
    await gehe('videos', 'portrait');
    await page.waitForSelector('[data-vaction="share"]', { timeout: 10000 });
    const vid = await page.getAttribute('[data-vaction="share"]', 'data-vid').catch(() => null);
    const zaehler = async () => {
      const boot = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()));
      const v = (boot.videos || []).find((x) => x.id === vid) || boot.videos[0];
      return v ? v.shares : null;
    };
    const vorher = await zaehler();

    await page.click('[data-vaction="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });
    const titel = await page.$eval('.sheet__titel-mitte', (e) => e.textContent);
    if (titel !== 'Video teilen') throw new Error(titel);
    await tippen('@test');
    await page.waitForSelector(`[data-teilen="${fremder.id}"]`, { timeout: 8000 });
    await page.click(`[data-teilen="${fremder.id}"]`);
    await page.click('#teilenSenden');
    await warteAufSchliessen();

    // Gewartet wird auf den neuen Stand, nicht auf die Uhr.
    let nachher = vorher;
    for (let i = 0; i < 20 && nachher !== vorher + 1; i++) {
      await page.waitForTimeout(500);
      nachher = await zaehler();
    }
    if (nachher !== vorher + 1) throw new Error(`${vorher} -> ${nachher}`);
  });

  await pruefe('Der Fremde landet unter Communitys, nicht im Messenger', async () => {
    const ids = await gemeinsameChats(pruefer, fremder);
    if (ids.length !== 1) throw new Error(ids.length + ' Chats');
    const { data } = await pruefer.client.from('chats').select('bereich, anfrage_zustand').eq('id', ids[0]).single();
    if (data.bereich !== 'community') throw new Error('Bereich ' + data.bereich);
    if (data.anfrage_zustand !== 'wartet') throw new Error('Anfrage ' + data.anfrage_zustand);
  });

  await pruefe('Querformat: der Fremde ist gesperrt und sagt warum', async () => {
    await gehe('videos', 'landscape');
    await page.waitForSelector('[data-clip]', { timeout: 10000 });
    await page.click('[data-clip]');
    await page.waitForSelector('[data-clipact="share"]', { timeout: 10000 });
    await page.click('[data-clipact="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });
    await tippen('@test');
    const kachel = `[data-teilen="${fremder.id}"]`;
    await page.waitForSelector(kachel, { timeout: 8000 });
    const zustand = await page.$eval(kachel, (b) => ({
      aus: b.disabled,
      gesperrt: b.classList.contains('is-gesperrt'),
      text: b.querySelector('.teilen__sperre')?.textContent || '',
    }));
    if (!zustand.aus || !zustand.gesperrt) throw new Error(JSON.stringify(zustand));
    if (zustand.text !== 'Wartet auf Annahme') throw new Error(zustand.text);
    await bild('3-gesperrt');
  });

  await pruefe('Querformat: an einen Kontakt geht es durch', async () => {
    await tippen('');
    await page.click(`[data-teilen="${K.person('u2')}"]`);
    await page.click('#teilenSenden');
    await warteAufSchliessen();
  });

  await pruefe('Die Datenbank laesst kein zweites Video durch — mit Grund', async () => {
    // Am Blatt vorbei: die Sperre darf nicht nur in der Oberflaeche stehen.
    const clip = await page.evaluate(async () => (await (await fetch('/api/bootstrap')).json()).clips?.[0]?.id);
    const antwort = await page.evaluate(
      async ({ id, an }) =>
        (await fetch('/api/teilen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ art: 'clip', id, empfaenger: [an], bereich: 'community' }),
        })).json(),
      { id: clip, an: fremder.id }
    );
    if ((antwort.gesendet || []).length) throw new Error('zweites Video ging durch');
    const grund = (antwort.fehlgeschlagen || [])[0]?.grund;
    if (grund !== 'Bis zur Annahme geht nur ein Beitrag') throw new Error(JSON.stringify(antwort.fehlgeschlagen));
    const { count } = await fremder.client
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .in('chat_id', await gemeinsameChats(pruefer, fremder));
    if (count !== 1) throw new Error(count + ' Nachrichten beim Fremden');
  });

  console.log('\nLive');

  await pruefe('Live: der Teilen-Knopf oeffnet das Blatt und sendet', async () => {
    await page.click('[data-close], #clipBack, .clip__zurueck').catch(() => {});
    await gehe('videos', 'landscape');
    await page.click('[data-clipfilter="live"]');
    await page.waitForTimeout(300);
    await page.waitForSelector('[data-clip]', { timeout: 10000 });
    await page.click('[data-clip]');
    await page.waitForSelector('#liveKlappe, #liveSchreiben', { timeout: 10000 });
    await page.click('[data-clipact="share"]');
    await page.waitForSelector('.teilen', { timeout: 8000 });
    await page.click(`[data-teilen="${K.person('u1')}"]`);
    await page.click('#teilenSenden');
    await warteAufSchliessen();
  });

  await zuruecksetzen(page);
  const rest = await abraeumen(pruefer, fremder);
  if (rest) console.log(`  WARNUNG ${rest} Chat(s) zwischen @prueflauf und @test blieben stehen`);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length || rest ? 1 : 0);
})();
