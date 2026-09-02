// Prueft Henriks Rueckmeldungen einzeln nach - im iPhone-Format.
//
// Start:  node test/_feedback.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen } = require('./_konto');
const K = require('./_kennungen');
const fs = require('fs');
const path = require('path');

const { chatOffen } = require('./_warten');
// Kleines Testbild fuer die Story-Aufnahme.
const BILD = path.join(__dirname, '_teststory.png');
if (!fs.existsSync(BILD)) {
  fs.writeFileSync(
    BILD,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVQIW2P8z8Dwn4EIwDiqkL4hRQAAAP//AwDPUAX3rN6iSwAAAABJRU5ErkJggg==',
      'base64'
    )
  );
}

let fehlgeschlagen = 0;

/** Alle offenen Blaetter schliessen - sonst fangen sie die naechsten Klicks ab. */
const blaetterZu = async (page) => {
  await page.evaluate(() => {
    document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
  });
  await page.waitForTimeout(200);
};

const pruefe = (was, ok, zusatz = '') => {
  if (!ok) fehlgeschlagen++;
  console.log((ok ? '  OK   ' : '  FEHL ') + was + (zusatz ? '  — ' + zusatz : ''));
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  const konsolenfehler = [];
  page.on('console', (m) => { if (m.type() === 'error') konsolenfehler.push(m.text()); });
  page.on('pageerror', (e) => konsolenfehler.push('pageerror: ' + e.message));

  const ziel = process.env.ZIEL || 'http://localhost:3000/';

  // Der Server haelt alles im Speicher. Ohne Ruecksetzen waeren Kontakte und
  // Gruppen aus dem vorigen Lauf noch da und der Test schluege zu Unrecht fehl.
  await page.goto(ziel, { waitUntil: 'networkidle' });
  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen
  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.
  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
    process.exit(1);
  }
  await page.reload({ waitUntil: 'networkidle' });
  await page.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await zuruecksetzen(page);
  await page.evaluate(() => {
    try { localStorage.removeItem('allmedia.eigeneStory'); } catch {}
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // ---------------------------------------------------------------- Chats
  console.log('\nChats');
  const zeilen = await page.$$('[data-chat]');
  pruefe('Chatliste hat Eintraege', zeilen.length > 0, `${zeilen.length} Zeilen`);

  await zeilen[0].click();
  // Auf den Chatkopf warten statt auf die Uhr: eine halbe Sekunde reichte,
  // solange der Lauf allein lief, und nicht mehr, sobald ein voller
  // Durchgang davor lag.
  await page.waitForSelector('.chathead', { timeout: 8000 }).catch(() => null);
  pruefe('Chat laesst sich oeffnen', !!(await page.$('.chathead')),
         await page.$eval('.chathead__name', (e) => e.textContent).catch(() => ''));

  /*
   * Die eigene Nachricht landet im Verlauf.
   *
   * Hier stand bis zum 31.08.2026: "Antwort passt zur Frage nach dem Termin".
   * Der Server antwortete automatisch, mit einem Satz, der zum Stichwort im
   * eigenen Text passte. Das kam aus den Beispieldaten und taeuschte ein
   * Gegenueber vor, das es nicht gab. Seit die Nachrichten in der Datenbank
   * stehen, antwortet niemand mehr von selbst — und das ist richtig so.
   */
  const vorher = await page.$$eval('.msg', (n) => n.length);
  await page.fill('#msgInput', 'Wann treffen wir uns?');
  await page.click('#sendBtn');
  await page.waitForTimeout(1500);
  const nachher = await page.$$eval('.msg', (n) => n.length);
  const eigene = await page.$$eval('.msg--out', (n) => n.map((x) => x.textContent));
  pruefe('Eigene Nachricht landet im Verlauf',
         nachher > vorher && (eigene[eigene.length - 1] || '').includes('Wann treffen wir uns?'));

  await page.click('#chatBack');
  await page.waitForTimeout(300);

  // --------------------------------------------------------- Filter-Pills
  console.log('\nFilter');
  const pills = await page.$$eval('.pill', (n) =>
    n.map((p) => {
      const r = p.getBoundingClientRect();
      const s = getComputedStyle(p);
      return { text: p.textContent.trim(), h: Math.round(r.height), unten: Math.round(r.bottom),
               display: s.display, align: s.alignItems, justify: s.justifyContent };
    })
  );
  pruefe('Pills sind vollstaendig hoch', pills.every((p) => p.h >= 30),
         pills.map((p) => `${p.text}:${p.h}px`).join(' '));
  // Hinweis: In einem Flex-Container wird inline-flex laut CSS-Standard zu
  // flex - entscheidend ist die Zentrierung, nicht der display-Wert.
  pruefe('Text sitzt mittig in der Pille',
         pills.every((p) => p.align === 'center' && p.justify === 'center'),
         pills[0] ? `${pills[0].display}/${pills[0].align}/${pills[0].justify}` : '');

  const behaelter = await page.$eval('.pills', (e) => Math.round(e.getBoundingClientRect().bottom));
  pruefe('Pills werden unten nicht abgeschnitten',
         pills.every((p) => p.unten <= behaelter), `Pills bis ${Math.max(...pills.map((p) => p.unten))}, Rahmen ${behaelter}`);

  // ------------------------------------------------------------ Vollbild
  console.log('\nVollbild / PWA');
  const pwa = await page.evaluate(() => ({
    standalone: !!document.querySelector('meta[name="apple-mobile-web-app-capable"]'),
    manifest: !!document.querySelector('link[rel="manifest"]'),
    statusbar: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.content,
    topbarPad: getComputedStyle(document.querySelector('.topbar')).paddingTop,
  }));
  pruefe('Als App startbar (Homescreen)', pwa.standalone);
  pruefe('Manifest verlinkt', pwa.manifest);
  pruefe('Statusleiste durchsichtig', pwa.statusbar === 'black-translucent', pwa.statusbar);

  const manifest = await page.evaluate(async () => {
    const r = await fetch('/manifest.webmanifest');
    return r.ok ? (await r.json()).display : null;
  });
  pruefe('Manifest sagt standalone', manifest === 'standalone', String(manifest));

  // ---------------------------------------------------------- Friend-Map
  console.log('\nFriend-Map');
  await page.click('[data-sub="friendmap"]').catch(() => {});
  await page.waitForTimeout(600);
  pruefe('Karte ist da', !!(await page.$('#mapFlaeche')));
  // Plus und Minus sind auf Henriks Wunsch weg - an ihrer Stelle stehen der
  // Vollbild-Pfeil und der Umschalter fuer die Kartenansicht.
  pruefe('Kein Plus/Minus mehr', !(await page.$('#zoomIn')) && !(await page.$('#zoomOut')));
  pruefe('Vollbild-Pfeil ist da', !!(await page.$('[data-mapfull]')));
  pruefe('Ansicht-Umschalter ist da', !!(await page.$('[data-mapstil]')));
  pruefe('Standort-Freigabe ist da', !!(await page.$('#standortAn')));

  await page.click('[data-mapfull]');
  await page.waitForTimeout(500);
  pruefe('Vollbild schaltet um', !!(await page.$('.map--voll')));
  await page.click('[data-mapfull]');
  await page.waitForTimeout(500);
  pruefe('Vollbild laesst sich verlassen', !(await page.$('.map--voll')));

  const vorherStil = await page.$eval('#map', (e) => e.className);
  await page.click('[data-mapstil]');
  await page.waitForTimeout(400);
  pruefe('Kartenansicht wechselt', vorherStil !== (await page.$eval('#map', (e) => e.className)));

  // Kontakt antippen zoomt, statt wegzunavigieren
  const reihe = await page.$('[data-zoom]');
  if (reihe) {
    await reihe.click();
    await page.waitForTimeout(600);
    pruefe('Kontakt-Tippen bleibt auf der Karte', !!(await page.$('#mapFlaeche')) && !(await page.$('.prof__stats')));
    pruefe('Kontakt ist hervorgehoben', !!(await page.$('.map__pin.is-aktiv')));
  }

  // ------------------------------------------------------ Kontakt + Gruppe
  console.log('\nKontakt hinzufuegen');
  await page.click('[data-sub="chats"]').catch(() => {});
  await page.waitForTimeout(400);
  await page.click('#newChat');
  await page.waitForTimeout(400);
  await page.click('[data-new="contact"], .item:has-text("Kontakt hinzufügen")').catch(() => {});
  await page.waitForTimeout(400);

  const hatNummerFeld = await page.$eval('#contactHandle', (e) => e.placeholder).catch(() => '');
  pruefe('Feld nimmt auch Telefonnummern', /Telefonnummer/i.test(hatNummerFeld), hatNummerFeld);
  pruefe('Nachricht vor Annahme moeglich', !!(await page.$('#contactMsg')));

  // Suche per Nummer
  await page.fill('#contactHandle', '+49 174 8901234');   // Greta - noch kein Kontakt
  await page.fill('#contactMsg', 'Hi, hier ist Henrik!');
  await page.click('#contactAdd');
  // Die Anfrage geht jetzt in die Datenbank — 800 ms reichten dafuer nicht
  // zuverlaessig, und der Prueflauf meldete einen Fehler, den es nicht gab.
  await page.waitForSelector('.anfrage', { timeout: 8000 }).catch(() => {});
  const gesperrt = await page.$('.anfrage');
  pruefe('Anfrage per Nummer angelegt', !!gesperrt);
  if (gesperrt) {
    const eingabeGesperrt = await page.$eval('#msgInput', (e) => e.disabled);
    pruefe('Weitere Nachrichten gesperrt bis zur Annahme', eingabeGesperrt);
    await page.click('#anfrageOk');
    // Die Annahme aendert den Kontaktstatus in der Datenbank; danach wird der
    // Chat neu aufgebaut. 800 ms waren dafuer zu knapp.
    await page.waitForFunction(
      () => { const f = document.querySelector('#msgInput'); return f && !f.disabled; },
      null, { timeout: 10000 }
    ).catch(() => {});
    const frei = await page.$eval('#msgInput', (e) => !e.disabled).catch(() => false);
    pruefe('Nach Annahme wieder frei', frei);
    await page.click('#chatBack').catch(() => {});
    await page.waitForTimeout(400);
  }

  console.log('\nGruppe erstellen');
  await page.click('#newChat');
  await page.waitForTimeout(400);
  await page.click('[data-new="group"], .item:has-text("Neue Gruppe")').catch(() => {});
  await page.waitForTimeout(400);
  pruefe('Schritt 1 zeigt Personen, nicht den Namen',
         !!(await page.$('#groupNext')) && !(await page.$('#groupName')));
  pruefe('Nicht-Kontakte per Nummer moeglich', !!(await page.$('#groupPhone')));

  await page.click('[data-member]');
  await page.waitForTimeout(300);
  await page.click('#groupNext');
  await page.waitForTimeout(400);
  pruefe('Schritt 2 fragt Name und Info', !!(await page.$('#groupName')) && !!(await page.$('#groupInfo')));
  pruefe('Gruppenbild anlegbar', !!(await page.$('#groupPic')));
  // Klick neben das Blatt schliesst es.
  await page.click('.sheet-backdrop', { position: { x: 10, y: 10 } }).catch(() => {});
  await page.waitForTimeout(400);
  pruefe('Blatt schliesst per Klick daneben', !(await page.$('.sheet-backdrop')));
  await blaetterZu(page);

  // ----------------------------------------------------------- Konto
  console.log('\nKonto wechseln');
  await page.click('[data-sub="profile"]').catch(() => {});
  await page.waitForTimeout(500);
  await page.click('#switchProfile').catch(() => {});
  // Die Kontoliste kommt aus der Datenbank, nicht mehr aus dem Quelltext.
  await page.waitForSelector('[data-konto]', { timeout: 8000 }).catch(() => {});
  const kontoDialog = await page.$('[data-konto]');
  pruefe('Profil wechseln fuehrt zur Kontoliste', !!kontoDialog);
  pruefe('Zweites Konto anlegbar', !!(await page.$('[data-konto-neu="neu"]')));
  await blaetterZu(page);

  // ------------------------------------------------------ Repost + Story
  console.log('\nRepost');
  await page.click('[data-area="videos"]').catch(() => {});
  await page.waitForTimeout(600);
  await page.click('[data-sub="home"]').catch(() => {});
  await page.waitForTimeout(600);

  /*
   * Einen Beitrag nehmen, der noch NICHT repostet ist.
   *
   * Der erste im Feed war frueher immer frisch. Jetzt bekommt jedes Konto
   * beim Anlegen schon einen Repost mit (SUPABASE_SCHEMA_7_testkonto.sql) —
   * war das ausgerechnet der erste, nahm der Klick den Repost zurueck, und
   * der Prueflauf meldete einen Fehler, obwohl alles richtig lief.
   */
  const frisch = await page.$$eval('[data-paction="repost"]', (knoten) => {
    const treffer = knoten.find((n) => !n.className.includes('is-reposted'));
    return treffer ? treffer.getAttribute('data-pid') : null;
  });
  pruefe('Ein noch nicht repposteter Beitrag im Feed', !!frisch);

  if (frisch) {
    const waehler = `[data-paction="repost"][data-pid="${frisch}"]`;
    await page.click(waehler);
    await page.waitForFunction(
      (w) => document.querySelector(w)?.classList.contains('is-reposted') === true,
      waehler, { timeout: 8000 }
    ).catch(() => {});
    pruefe('Repost schaltet um',
           /is-reposted/.test(await page.$eval(waehler, (e) => e.className)));
    pruefe('Repost meldet sich', /Repostet/i.test(await page.$eval('#toast', (e) => e.textContent)));
  }

  await page.click('[data-sub="profile"]');
  await page.waitForTimeout(800);
  await page.click('[data-otab="repost"]');
  await page.waitForTimeout(800);
  const repostKacheln = await page.$$eval('.prof__grid .griditem', (n) => n.length);
  pruefe('Repost erscheint im Profil', repostKacheln > 0, `${repostKacheln} Kachel(n)`);

  console.log('\nEigene Story');
  await page.click('[data-area="messenger"]');
  await page.waitForTimeout(600);
  await page.click('[data-sub="camera"]');
  await page.waitForTimeout(600);

  const [auswahl] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#camShutter'),
  ]);
  await auswahl.setFiles(BILD);
  await page.waitForTimeout(1200);

  // Punkt 17: die Aufnahme landet nicht mehr stillschweigend in der Story -
  // erst fragt die Kamera, wohin damit.
  pruefe('Kamera fragt, was mit der Aufnahme geschehen soll',
         !!(await page.$('[data-verwenden="story"]')));
  pruefe('Die Aufnahme steht als Vorschau darüber',
         !!(await page.$('.aufnahme__vorschau')));
  pruefe('Chat und Beitrag stehen als Ziel zur Wahl',
         !!(await page.$('[data-verwenden="chat"]')) && !!(await page.$('[data-verwenden="beitrag"]')));

  await page.click('[data-verwenden="story"]');
  await page.waitForTimeout(900);
  pruefe('Aufnahme wird übernommen',
         /Story ist online/i.test(await page.$eval('#toast', (e) => e.textContent)));

  await page.click('[data-sub="chats"]');
  await page.waitForTimeout(700);
  // "s0" war die feste Kennung der eigenen Story in den Beispieldaten. Storys
  // bekommen ihre Kennung jetzt beim Anlegen in der Datenbank — gesucht wird
  // deshalb an der Beschriftung. Siehe test/_kennungen.js.
  const eigeneStory = await K.waehlerStory(page, 'Deine Story');
  const ring = await page.$eval(`${eigeneStory} .story__ring`, (e) => e.className);
  pruefe('Eigene Story zeigt keinen Plus-Knopf mehr', !/story__add/.test(ring), ring.trim());

  await page.click(eigeneStory);
  await page.waitForTimeout(900);
  pruefe('Eigene Story lässt sich ansehen', !!(await page.$('.viewer__bild')));
  pruefe('Ansichten statt Antwortfeld', !!(await page.$('#storyViews')) && !(await page.$('#storyReply')));
  await page.click('#storyClose').catch(() => {});
  await page.waitForTimeout(400);

  console.log('\nAnruf');
  await page.click('[data-area="messenger"]').catch(() => {});
  await page.waitForTimeout(500);
  await page.click('[data-sub="chats"]').catch(() => {});
  await page.waitForTimeout(500);
  await page.click(await K.waehlerChat(page, 'Anna Schmidt'));
  await chatOffen(page, 8000);
  await page.click('[data-call="audio"]');
  await page.waitForTimeout(800);

  pruefe('Anruf öffnet sich', !!(await page.$('.anruf')));
  pruefe('Zeigt zuerst "Klingelt"',
         /Klingelt|Videoanruf/.test(await page.$eval('#anrufStatus', (e) => e.textContent)));

  await page.waitForTimeout(3000);
  const laufend = await page.$eval('#anrufStatus', (e) => e.textContent);
  pruefe('Verbindet und zählt die Dauer', /^\d{2}:\d{2}$/.test(laufend.trim()), laufend.trim());

  await page.click('[data-anruf="stumm"]');
  await page.waitForTimeout(400);
  pruefe('Stummschalten wirkt',
         await page.$eval('[data-anruf="stumm"]', (e) => e.className.includes('is-an')));

  await page.click('[data-anruf="auflegen"]');
  await page.waitForTimeout(1100);
  pruefe('Auflegen nennt die Dauer',
         /Anruf beendet · \d{2}:\d{2}/.test(await page.$eval('#toast', (e) => e.textContent)));
  pruefe('Anruf schließt sich', !(await page.$('.anruf')));
  await page.click('#chatBack').catch(() => {});
  await page.waitForTimeout(400);

  console.log('\nKonsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehlgeschlagen++;

  // Aufraeumen, damit der naechste Lauf sauber startet.
  await zuruecksetzen(page);
  await page.evaluate(() => {
    try { localStorage.removeItem('allmedia.eigeneStory'); } catch {}
  });

  await browser.close();

  console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Punkt(e) offen` : '\nAlles gruen');
  process.exit(fehlgeschlagen ? 1 : 0);
})();
