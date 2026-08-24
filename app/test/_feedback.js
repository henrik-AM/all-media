// Prueft Henriks Rueckmeldungen einzeln nach - im iPhone-Format.
//
// Start:  node test/_feedback.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

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
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
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
  await page.waitForTimeout(500);
  pruefe('Chat laesst sich oeffnen', !!(await page.$('.chathead')),
         await page.$eval('.chathead__name', (e) => e.textContent).catch(() => ''));

  // Antwort richtet sich nach dem Text
  await page.fill('#msgInput', 'Wann treffen wir uns?');
  await page.click('#sendBtn');
  await page.waitForTimeout(2200);
  const texte = await page.$$eval('.msg--in', (n) => n.map((x) => x.textContent));
  const letzte = texte[texte.length - 1] || '';
  pruefe('Antwort passt zur Frage nach dem Termin',
         /Uhr|Nachmittag|passt|flexibel/i.test(letzte), letzte.trim().slice(0, 60));

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
  pruefe('Zoomknoepfe sind da', !!(await page.$('#zoomIn')) && !!(await page.$('#zoomOut')));
  pruefe('Standort-Freigabe ist da', !!(await page.$('#standortAn')));

  const vorher = await page.$eval('#mapFlaeche', (e) => getComputedStyle(e).transform);
  await page.click('#zoomIn');
  await page.waitForTimeout(500);
  const nachher = await page.$eval('#mapFlaeche', (e) => getComputedStyle(e).transform);
  pruefe('Zoom veraendert die Karte', vorher !== nachher);

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
  await page.waitForTimeout(800);
  const gesperrt = await page.$('.anfrage');
  pruefe('Anfrage per Nummer angelegt', !!gesperrt);
  if (gesperrt) {
    const eingabeGesperrt = await page.$eval('#msgInput', (e) => e.disabled);
    pruefe('Weitere Nachrichten gesperrt bis zur Annahme', eingabeGesperrt);
    await page.click('#anfrageOk');
    await page.waitForTimeout(800);
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
  await page.waitForTimeout(500);
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

  const vorRepost = await page.$eval('[data-paction="repost"]', (e) => e.className);
  await page.click('[data-paction="repost"]');
  await page.waitForTimeout(700);
  const nachRepost = await page.$eval('[data-paction="repost"]', (e) => e.className);
  pruefe('Repost schaltet um', vorRepost !== nachRepost && /is-reposted/.test(nachRepost));
  pruefe('Repost meldet sich', /Repostet/i.test(await page.$eval('#toast', (e) => e.textContent)));

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
  pruefe('Aufnahme wird übernommen',
         /Story ist online/i.test(await page.$eval('#toast', (e) => e.textContent)));

  await page.click('[data-sub="chats"]');
  await page.waitForTimeout(700);
  const ring = await page.$eval('[data-story="s0"] .story__ring', (e) => e.className);
  pruefe('Eigene Story zeigt keinen Plus-Knopf mehr', !/story__add/.test(ring), ring.trim());

  await page.click('[data-story="s0"]');
  await page.waitForTimeout(900);
  pruefe('Eigene Story lässt sich ansehen', !!(await page.$('.viewer__bild')));
  pruefe('Ansichten statt Antwortfeld', !!(await page.$('#storyViews')) && !(await page.$('#storyReply')));
  await page.click('#storyClose').catch(() => {});
  await page.waitForTimeout(400);

  console.log('\nKonsolenfehler: ' + (konsolenfehler.length ? konsolenfehler.join(' | ') : 'keine'));
  if (konsolenfehler.length) fehlgeschlagen++;

  // Aufraeumen, damit der naechste Lauf sauber startet.
  await page.evaluate(() => fetch('/api/reset', { method: 'POST' }));
  await page.evaluate(() => {
    try { localStorage.removeItem('allmedia.eigeneStory'); } catch {}
  });

  await browser.close();

  console.log(fehlgeschlagen ? `\n${fehlgeschlagen} Punkt(e) offen` : '\nAlles gruen');
  process.exit(fehlgeschlagen ? 1 : 0);
})();
