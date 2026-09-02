// Prueft die Punkte aus Henriks Rueckmeldung vom 25.08. einzeln nach.
// Jede Pruefung nennt den Punkt, damit man beim Lesen sieht, was gemeint war.
//
//   node test/_henrik.js

const { chromium } = require('playwright-core');
const { anmelden } = require('./_konto');

const { chatOffen } = require('./_warten');
const ADRESSE = process.env.AM_URL || 'http://localhost:3000';

let bestanden = 0;
let gefallen = 0;
const fehlend = [];

function ok(name, bedingung, zusatz = '') {
  if (bedingung) {
    bestanden++;
    console.log(`  OK   ${name}${zusatz ? `  — ${zusatz}` : ''}`);
  } else {
    gefallen++;
    fehlend.push(name);
    console.log(`  FEHLT ${name}${zusatz ? `  — ${zusatz}` : ''}`);
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chromium-headless-shell' });
  const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const konsole = [];
  seite.on('console', (m) => m.type() === 'error' && konsole.push(m.text()));

  await seite.goto(ADRESSE);

  // Ohne Anmeldung ist die Seite leer: die Regeln der Datenbank lassen

  // anonyme Zugriffe nicht zu. Siehe test/_konto.js.

  const angemeldet = await anmelden(seite);
  if (!angemeldet.ok) {

    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');

    process.exit(1);

  }

  await seite.reload({ waitUntil: 'networkidle' });

  await seite.evaluate(() => window.Anmeldung?.bereit?.catch(() => null));
  await seite.waitForSelector('.navbtn');

  /*
   * Zu einem Bildschirm wechseln und warten, bis er wirklich dasteht.
   *
   * 220 ms reichten, solange die Inhalte im Arbeitsspeicher des Servers
   * lagen. Jetzt kommen sie aus der Datenbank — und der Prueflauf sah einen
   * halb aufgebauten Bildschirm: kein Follower-Knopf, kein "Bearbeiten",
   * kein Bio-Link. Lauter Fehler, die keine waren.
   */
  const geheZu = async (bereich, unterpunkt) => {
    await seite.evaluate(() => {
      document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove());
      const o = document.querySelector('#overlay');
      if (o && !o.hidden) { o.hidden = true; o.innerHTML = ''; }
    });
    await seite.click(`[data-area="${bereich}"]`);
    await seite.waitForTimeout(200);
    if (unterpunkt) {
      await seite.click(`[data-sub="${unterpunkt}"]`);
      await seite.waitForFunction(
        () => (document.querySelector('#main')?.textContent || '').trim().length > 0,
        null, { timeout: 10000 }
      ).catch(() => {});
      await seite.waitForTimeout(400);
    }
  };

  /* ---------------------------------------------------------- Videos */
  console.log('\nVideos — Home');
  await geheZu('videos', 'home');

  // "Kommentaranzahl korrigieren: Wenn nur 4 Kommentare vorhanden sind,
  //  darf nicht 'Alle 28 Kommentare ansehen' stehen."
  const kommentarText = await seite.locator('.post__comments').first().textContent();
  const genannt = Number((kommentarText.match(/\d+/) || [0])[0]);
  // Die Kennung des Beitrags stand hier fest als "p1" — Beiträge bekommen sie
  // jetzt beim Anlegen in der Datenbank. Also die des ersten im Feed nehmen,
  // denn genau dessen Zahl steht oben.
  const beitragId = await seite.locator('.post__comments').first().getAttribute('data-pid');
  const echt = await seite.evaluate(async (id) => {
    const r = await fetch(`/api/comments/${id}`);
    return (await r.json()).length;
  }, beitragId);
  ok('Kommentarzahl stimmt mit der Liste ueberein', genannt === echt, `genannt ${genannt}, echt ${echt}`);

  // "Der blaue Story-Kreis links oben bei Beitraegen muss anklickbar sein"
  ok('Story-Ring ist ein Knopf', (await seite.locator('.story-ring-btn, button.story').count()) > 0);

  // "Glocke: aktiviert = blau leuchtend; deaktiviert = grau mit
  //  durchgestrichenem Symbol."
  const glocke = seite.locator('[data-paction="notify"]').first();
  ok('Glocke vorhanden', (await glocke.count()) > 0);
  if (await glocke.count()) {
    const vorher = await glocke.getAttribute('class');
    await glocke.click();
    // Das Umschalten geht in die Datenbank und kommt zurueck.
    await seite.waitForFunction(
      (alt) => document.querySelector('[data-paction="notify"]')?.className !== alt,
      vorher, { timeout: 10000 }
    ).catch(() => {});
    const nachher = await glocke.getAttribute('class');
    ok('Glocke schaltet sichtbar um', vorher !== nachher, `${vorher} -> ${nachher}`);
  }

  /* --------------------------------------------------------- Kurzformat */
  console.log('\nVideos — Kurzformat');
  await geheZu('videos', 'portrait');

  // "'Merken' in 'Speichern' umbenennen."
  const kurzText = await seite.locator('.main').textContent();
  ok('Kein "Merken" mehr im Kurzformat', !kurzText.includes('Merken'));

  // "Beim Druecken von Like ... darf sich die rechte Seitenleiste nicht
  //  verschieben."
  const leiste = seite.locator('.slide__rail').first();
  if (await leiste.count()) {
    const vorher = await leiste.boundingBox();
    await seite.locator('[data-vaction="like"]').first().click();
    await seite.waitForTimeout(300);
    const nachher = await leiste.boundingBox();
    ok(
      'Seitenleiste bleibt beim Liken an ihrer Stelle',
      vorher && nachher && Math.abs(vorher.y - nachher.y) < 2 && Math.abs(vorher.x - nachher.x) < 2,
      vorher && nachher ? `y ${vorher.y.toFixed(0)} -> ${nachher.y.toFixed(0)}` : 'nicht messbar'
    );
  } else {
    ok('Seitenleiste bleibt beim Liken an ihrer Stelle', false, 'Leiste nicht gefunden');
  }

  /* --------------------------------------------------------- Querformat */
  console.log('\nVideos — Querformat');
  await geheZu('videos', 'landscape');
  /*
   * Die Filterleiste selbst ansehen, nicht den Text der ganzen Seite.
   *
   * Vorher wurde in `.main` nach den Wörtern gesucht. Das ging schief, sobald
   * der Bildschirm beim Nachsehen noch nicht fertig war — und sagte auch
   * nichts darüber, ob es wirklich Knöpfe sind: "Live" steht auch auf jeder
   * Videokachel.
   */
  await seite.waitForSelector('[data-clipfilter]', { timeout: 10000 }).catch(() => {});
  const filterKnoepfe = await seite.$$eval('[data-clipfilter]', (n) => n.map((x) => x.textContent.trim()));
  // "Zusaetzlich die Buttons 'Alle', 'Standard', '360 Grad' und 'Live'."
  for (const knopf of ['Alle', 'Standard', '360', 'Live']) {
    ok(`Querformat-Filter "${knopf}"`, filterKnoepfe.some((t) => t.includes(knopf)),
      filterKnoepfe.join(' | '));
  }

  /* ------------------------------------------------------------- Suche */
  console.log('\nVideos — Suche');
  await geheZu('videos', 'search');

  // "Unter jedem Video Profilbild, Name sowie ggf. Standort und Musik."
  const kachel = seite.locator('.exp__card').first();
  ok('Reels-Kachel mit Bildunterschrift', (await kachel.count()) > 0);
  if (await kachel.count()) {
    ok('Kachel zeigt ein Profilbild', (await kachel.locator('.exp__card-avatar').count()) > 0);
    const t = await kachel.textContent();
    ok('Kachel nennt Ort oder Musik', /·/.test(t), t.trim().slice(0, 40));
  }

  // "Die Kategorien muessen jeweils auf eigene Uebersichtsseiten fuehren."
  const ueberschrift = seite.locator('.exp__head').first();
  ok('Abschnitts-Ueberschrift ist anklickbar', await ueberschrift.evaluate((e) =>
    e.tagName === 'BUTTON' || e.onclick !== null || e.style.cursor === 'pointer' ||
    getComputedStyle(e).cursor === 'pointer'
  ).catch(() => false));

  /* ----------------------------------------------------------- Profil */
  console.log('\nProfil');
  await geheZu('videos', 'profile');

  // "Eigene Follower und Gefolgte einsehbar machen."
  // Auf den Profilkopf warten, bevor irgendetwas darin gesucht wird.
  await seite.waitForSelector('#followerBtn', { timeout: 10000 }).catch(() => {});
  const follower = seite.locator('#followerBtn, #followingBtn').first();
  ok('Followerzahl ist anklickbar', (await follower.count()) > 0);

  // "Profilbild, Name, Info/Bio, Link usw. ueber eine Bearbeitungseinstellung."
  const profilText = await seite.locator('.main').textContent();
  ok('Profil bearbeiten erreichbar', /[Bb]earbeiten/.test(profilText));

  // "Links in Profilbeschreibungen muessen anklickbar sein."
  ok('Bio-Link ist ein Link', (await seite.locator('.prof__link[href^="http"]').count()) > 0);

  /* ------------------------------------------------------- Communitys */
  console.log('\nCommunitys');
  await geheZu('communities', 'home');
  const commText = await seite.locator('.main').textContent();

  // "Home zeigt nur Communitys, denen der Nutzer bereits beigetreten ist.
  //  Noch nicht beigetretene unter 'Entdecken'."
  ok('Entdecken-Bereich vorhanden', /[Ee]ntdecken/.test(commText));

  /* ---------------------------------------------------- Einstellungen */
  console.log('\nEinstellungen');
  await geheZu('settings', null);
  const setText = await seite.locator('.main').textContent();

  // "'Konto wechseln oder hinzufuegen' vollstaendig sichtbar machen."
  ok('Kontowechsel steht in den Einstellungen', /[Kk]onto wechseln/.test(setText));

  // "Insbesondere einen Messenger-Unterpunkt ergaenzen, analog zu Videos
  //  und Communitys."
  ok('Messenger-Abschnitt vorhanden', /Messenger/.test(setText));

  // "In den Einstellungen muss man sehen koennen, wem man folgt."
  ok('Gefolgte in den Einstellungen', /Wem ich folge|[Gg]efolgt|Abonniert/.test(setText));

  /* --------------------------------------------------------- Messenger */
  console.log('\nMessenger');
  await geheZu('messenger', 'chats');

  // "Beim Tippen auf den Namen einer Person im Chat nicht auf deren
  //  Video-Profil, sondern auf die Chat-Einstellungen."
  await seite.locator('[data-chat]').first().click();
  await chatOffen(seite);
  const kopf = seite.locator('.chathead__name, .chatkopf__name, [data-chatsettings]').first();
  ok('Chat-Kopf ist anklickbar', (await kopf.count()) > 0);
  if (await kopf.count()) {
    await kopf.click();
    await seite.waitForSelector('.kp__zeileText', { timeout: 10000 }).catch(() => {});
    await seite.waitForTimeout(300);
    const offen = await seite.locator('.sheet, .overlay:not([hidden])').textContent().catch(() => '');
    ok('Fuehrt zu den Chat-Einstellungen', /[Ee]instellung|Benachrichtigung|Stumm/.test(offen),
      offen.trim().slice(0, 45));
  }

  await browser.close();

  console.log(`\n  ${bestanden} von ${bestanden + gefallen} Punkten erfuellt`);
  if (fehlend.length) {
    console.log('\n  Noch offen:');
    fehlend.forEach((f) => console.log(`    - ${f}`));
  }
  console.log(konsole.length ? `\n  Konsolenfehler: ${konsole.length}` : '\n  Keine Konsolenfehler');
})();
