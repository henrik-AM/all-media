// Prueft Playlists und Highlights auf der WEBSITE — anlegen, fuellen, oeffnen.
//
// WARUM ES DIESEN LAUF GIBT
//
// test/_sammlungen.js prueft die Datenbank direkt: Tabellen, Ausloeser,
// Rechte. Gruen ist er auch dann, wenn die Website davon nichts mitbekommt.
// Genau das war bis zum 20.09.2026 der Fall, gleich dreifach:
//
//   1. Die Seite zeigte als Inhalt einer Playlist eine ERFUNDENE Liste:
//
//        const liste = quelle.filter((_, i) => i % 2 === (name.length % 2));
//
//      Jede zweite Kachel aus dem allgemeinen Bestand, ausgewaehlt nach der
//      Laenge des Namens. Auf dem Bildschirm sah das aus wie ein Inhalt.
//
//   2. "Hinzufuegen zu" schrieb nach public.sammlung_beitraege — eine
//      Tabelle, die nur Beitraege kannte, die Sammlung als Text fuehrte und
//      die der App voellig unbekannt war.
//
//   3. Eine neu angelegte Playlist entstand nur als Name in
//      profiles.playlists, nicht als Zeile in sammlungen.
//
// Dieser Lauf geht deshalb den ganzen Weg: anlegen, einen eigenen Beitrag
// hineinlegen, wieder oeffnen und nachsehen, ob DERSELBE Beitrag darin liegt
// — und nur der.
//
// Start: node test/_sammlungenweb.js (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden, MAIL, PASS } = require('./_konto');
const fs = require('fs');
const path = require('path');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';
const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

/** Angemeldet gegen PostgREST — mit demselben Konto wie die Seite. */
async function kopfZeilen() {
  const anmeldung = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: MAIL, password: PASS }),
  }).then((r) => r.json());
  const token = anmeldung.access_token;
  if (!token) throw new Error(anmeldung.error_description || 'keine Anmeldung');
  return { kopf: { apikey: KEY, Authorization: `Bearer ${token}` }, ichId: anmeldung.user.id };
}

/**
 * Die Sammlungen eines FREMDEN Kontos. Lesen darf sie jeder Angemeldete
 * (Regel `sammlungen_lesen`), loeschen nur der Besitzer — und genau das ist
 * hier zu pruefen.
 */
async function zaehleFremde() {
  const { kopf, ichId } = await kopfZeilen();
  const liste = await fetch(
    `${URL}/rest/v1/sammlungen?user_id=neq.${ichId}&select=art,name,user_id`,
    { headers: kopf }
  ).then((r) => r.json());
  return Array.isArray(liste) ? liste : [];
}

/**
 * Die Sammlungen eines Namens loeschen und nachzaehlen, was uebrig blieb.
 * Gibt die Zahl der uebrig gebliebenen Zeilen zurueck.
 */
async function ohneSeiteLoeschen(name) {
  const { kopf } = await kopfZeilen();
  const pfad = `sammlungen?name=eq.${encodeURIComponent(name)}`;
  await fetch(`${URL}/rest/v1/${pfad}`, { method: 'DELETE', headers: kopf });
  const rest = await fetch(`${URL}/rest/v1/${pfad}&select=id`, { headers: kopf }).then((r) =>
    r.json()
  );
  return Array.isArray(rest) ? rest.length : -1;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });

  const browserFehler = [];
  page.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));
  page.on('console', (m) => m.type() === 'error' && browserFehler.push('Konsole: ' + m.text()));

  await page.goto(ZIEL, { waitUntil: 'load' });

  const angemeldet = await anmelden(page);
  if (!angemeldet.ok) {
    console.error('Prüfkonto konnte sich nicht anmelden: ' + angemeldet.fehler);
    console.error('Ohne Anmeldung ist die Seite leer — dieser Lauf würde nichts prüfen.');
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

  /** Ein Aufruf an den eigenen Server, aus der angemeldeten Seite heraus. */
  const api = (pfad, optionen) =>
    page.evaluate(
      ([p, o]) =>
        fetch(p, o ? { ...o, headers: { 'Content-Type': 'application/json' } } : undefined).then(
          (r) => r.json()
        ),
      [pfad, optionen || null]
    );

  const NAME = `Prueflauf ${Date.now()}`;

  console.log('\nSammlungen auf der Website');

  await pruefe('Eine Playlist laesst sich anlegen', async () => {
    const res = await api('/api/eigene/playlist', {
      method: 'POST',
      body: JSON.stringify({ name: NAME }),
    });
    if (!res.ok) throw new Error(res.error || JSON.stringify(res));
  });

  let sammlungId = null;

  await pruefe('Sie ist danach eine echte Sammlung, nicht nur ein Name', async () => {
    // Genau der Punkt, an dem es vorher auseinanderlief: der Name stand in
    // profiles.playlists, die Sammlung gab es nicht.
    const liste = await api('/api/sammlungen?art=playlist');
    if (!Array.isArray(liste)) throw new Error(JSON.stringify(liste));
    const meine = liste.find((s) => s.name === NAME);
    if (!meine) throw new Error(`${liste.length} Sammlungen, keine heisst „${NAME}"`);
    if (!meine.id) throw new Error('ohne id');
    sammlungId = meine.id;
  });

  await pruefe('Frisch angelegt ist sie leer — und sagt das auch', async () => {
    const inhalt = await api(`/api/sammlung/${sammlungId}`);
    if (!Array.isArray(inhalt)) throw new Error(JSON.stringify(inhalt));
    if (inhalt.length !== 0) throw new Error(`${inhalt.length} Eintraege statt 0`);
  });

  await pruefe('Eine leere Sammlung hat kein Bild', async () => {
    // Ein Kreis mit fremdem Bild waere schlimmer als ein grauer Kreis.
    const liste = await api('/api/sammlungen?art=playlist');
    const meine = liste.find((s) => s.id === sammlungId);
    if (meine.bild !== null) throw new Error(`bild = ${meine.bild}`);
    if (meine.anzahl !== 0) throw new Error(`anzahl = ${meine.anzahl}`);
  });

  let beitragId = null;

  await pruefe('Es gibt einen eigenen Beitrag zum Einsortieren', async () => {
    const boot = await api('/api/bootstrap');
    const eigene = [...(boot.posts || []), ...(boot.videos || [])].filter((b) => b.userId === 'me');
    if (!eigene.length) throw new Error('keiner');
    beitragId = eigene[0].id;
  });

  await pruefe('Der Beitrag laesst sich hineinlegen', async () => {
    const res = await api(`/api/eigene/${beitragId}/sammlung`, {
      method: 'POST',
      body: JSON.stringify({ art: 'playlist', name: NAME }),
    });
    if (!res.ok) throw new Error(res.error || JSON.stringify(res));
  });

  await pruefe('Derselbe Beitrag ein zweites Mal wird abgelehnt', async () => {
    const res = await api(`/api/eigene/${beitragId}/sammlung`, {
      method: 'POST',
      body: JSON.stringify({ art: 'playlist', name: NAME }),
    });
    if (res.ok) throw new Error('doppelt angenommen');
    // Nicht nur "nicht ok": ein Absturz waere auch nicht ok. Es muss die
    // richtige Ablehnung sein.
    if (!/enthält das schon/.test(res.error || '')) throw new Error(res.error);
  });

  await pruefe('Darin liegt genau dieser eine Beitrag', async () => {
    // Die Kernpruefung. Vorher kam hier eine erfundene Liste zurueck —
    // fremde Beitraege, nach Namenslaenge ausgewaehlt.
    const inhalt = await api(`/api/sammlung/${sammlungId}`);
    if (inhalt.length !== 1) throw new Error(`${inhalt.length} Eintraege statt 1`);
    if (inhalt[0].eintrag.id !== beitragId) {
      throw new Error(`${inhalt[0].eintrag.id} statt ${beitragId}`);
    }
  });

  await pruefe('Die Kachel bringt eine unterschriebene Adresse mit', async () => {
    // Der Medieneimer ist seit Schema 23 nicht mehr oeffentlich. Eine rohe
    // Adresse fuehrt ins Leere, ohne Fehlermeldung.
    const inhalt = await api(`/api/sammlung/${sammlungId}`);
    const e = inhalt[0].eintrag;
    const adresse = e.thumbnail || e.mediaUrl;
    if (!adresse) return; // Ein Beitrag ohne Medium ist kein Fehler.
    if (!String(adresse).includes('token=')) throw new Error(String(adresse).slice(0, 80));
  });

  await pruefe('Jetzt hat die Sammlung ein Bild', async () => {
    const liste = await api('/api/sammlungen?art=playlist');
    const meine = liste.find((s) => s.id === sammlungId);
    if (meine.anzahl !== 1) throw new Error(`anzahl = ${meine.anzahl}`);
    // bild darf null sein, wenn der Beitrag selbst keins hat — dann muss
    // aber auch der Beitrag keins haben.
    const inhalt = await api(`/api/sammlung/${sammlungId}`);
    const hatMedium = Boolean(inhalt[0].eintrag.thumbnail || inhalt[0].eintrag.mediaUrl);
    if (hatMedium && !meine.bild) throw new Error('Beitrag hat ein Medium, die Sammlung kein Bild');
  });

  await pruefe('In ein Highlight kommt kein Beitrag', async () => {
    const angelegt = await api('/api/eigene/highlight', {
      method: 'POST',
      body: JSON.stringify({ name: NAME }),
    });
    if (!angelegt.ok) throw new Error(angelegt.error);
    // Gleicher Name, andere Gattung — erlaubt. Ein Beitrag darin nicht.
    const res = await api(`/api/eigene/${beitragId}/sammlung`, {
      method: 'POST',
      body: JSON.stringify({ art: 'highlight', name: NAME }),
    });
    if (res.ok) throw new Error('angenommen');
    // Bis zum 20.09.2026 kam hier ein Fehler 500 aus der Datenbank
    // ("multiple rows returned"), und diese Pruefung war trotzdem gruen.
    if (!/gehören Storys/.test(res.error || '')) throw new Error(res.error);
  });

  console.log('\nAuf dem Bildschirm');

  await pruefe('Die Kreise stehen im eigenen Profil', async () => {
    await page.click('[data-area="videos"]');
    await page.waitForTimeout(300);
    await page.click('[data-sub="profile"]');
    /*
     * Auf die echten Sammlungen warten, nicht auf die Uhr. Die Kreise stehen
     * sofort da — erst aus der Namensliste, danach ersetzt `ladeSammlungen`
     * sie durch die Zeilen aus der Datenbank. Nur die zweiten tragen eine
     * `data-sammlung-id`; die ersten sehen genauso aus.
     *
     * Hier standen 1200 ms. Einzeln reichten sie, im Gesamtlauf vom
     * 20.09.2026 nicht: gemeldet wurde „data-sammlung-id ist leer", und die
     * beiden Pruefungen danach fanden folgerichtig ein leeres Raster.
     */
    await page
      .waitForFunction(
        (name) => {
          const k = document.querySelector(
            `.highlight[data-sammlung-name="${name}"][data-sammlung="playlist"]`
          );
          return !!(k && k.dataset.sammlungId);
        },
        NAME,
        { timeout: 15000 }
      )
      .catch(() => {});
    const treffer = await page.$$eval('.highlight__label', (els) =>
      els.map((e) => e.textContent.trim())
    );
    if (!treffer.includes(NAME)) throw new Error(treffer.join(' | ') || 'keine Kreise');
  });

  await pruefe('Der Kreis traegt die id seiner Sammlung', async () => {
    // Ohne id ist der Kreis nur die Rueckfalltuer und laesst sich nicht
    // oeffnen — er saehe aber genauso aus.
    const id = await page.$eval(
      `.highlight[data-sammlung-name="${NAME}"][data-sammlung="playlist"]`,
      (e) => e.dataset.sammlungId
    );
    if (!id) throw new Error('data-sammlung-id ist leer');
  });

  await pruefe('Antippen zeigt den Inhalt, nicht eine Meldung', async () => {
    await page.click(`.highlight[data-sammlung-name="${NAME}"][data-sammlung="playlist"]`);
    await page.waitForSelector('.pagehead__title', { timeout: 8000 });
    const titel = await page.$eval('.pagehead__title', (e) => e.textContent.trim());
    if (titel !== NAME) throw new Error(titel);
  });

  await pruefe('Im Raster liegt genau eine Kachel', async () => {
    // Die erfundene Liste hatte hier je nach Namenslaenge ein halbes Dutzend.
    const anzahl = await page.$$eval('.exp__grid .griditem', (els) => els.length);
    if (anzahl !== 1) throw new Error(`${anzahl} Kacheln statt 1`);
  });

  await pruefe('Der Zaehler im Kopf nennt dieselbe Zahl', async () => {
    const text = await page.$eval('.pagehead__sub', (e) => e.textContent);
    if (!/(^|\D)1(\D|$)/.test(text)) throw new Error(text);
  });

  console.log('\nLoeschen');

  await pruefe('Der Loeschknopf steht im Kopf der eigenen Sammlung', async () => {
    // Er darf NUR im eigenen Profil stehen und nur bei einer echten Zeile.
    if (!(await page.$('#sammlungLoeschen'))) throw new Error('kein Loeschknopf');
  });

  await pruefe('Die Rueckfrage sagt, dass die Beitraege bleiben', async () => {
    await page.click('#sammlungLoeschen');
    await page.waitForSelector('#nachfrageJa', { timeout: 8000 });
    const text = await page.$eval('.sheet__hint', (e) => e.textContent);
    if (!/bleiben erhalten/.test(text)) throw new Error(text);
  });

  await pruefe('Nach dem Loeschen ist der Kreis weg, der gleichnamige Highlight-Kreis bleibt', async () => {
    await page.click('#nachfrageJa');
    /*
     * Zwei Fallen auf einmal, beide am 20.09.2026 gestellt:
     *
     * 1. Gewartet wird auf ein ANWESENDES Profil, nicht nur auf einen
     *    fehlenden Kreis. Hier stand zuerst allein „kein Kreis mit dem
     *    Namen" — und das war sofort wahr: nach dem Klick steht noch die
     *    Detailseite der Sammlung da, und auf der gibt es ueberhaupt keine
     *    Kreise. Gruen, bevor das DELETE beim Server war.
     *
     * 2. Gesucht wird nur unter den PLAYLISTS. Weiter oben legt der Lauf
     *    absichtlich ein Highlight mit demselben Namen an ("In ein Highlight
     *    kommt kein Beitrag"). Ein Blick auf alle Namen fand dieses
     *    Highlight und meldete „der Kreis steht noch da" — obwohl geloescht
     *    wurde, was geloescht werden sollte.
     *
     * Dass das Highlight stehen BLEIBT, ist damit die eigentliche Aussage:
     * geloescht wird eine Zeile, nicht ein Name.
     */
    const lesen = () =>
      page.$$eval('.highlight', (n) =>
        n.map((x) => ({
          name: x.querySelector('.highlight__label')?.textContent?.trim() || '',
          art: x.dataset.sammlung,
        }))
      );

    await page
      .waitForFunction(
        (name) => {
          const kreise = [...document.querySelectorAll('.highlight')];
          if (!kreise.length) return false;
          return !kreise.some(
            (x) =>
              x.dataset.sammlung === 'playlist' &&
              x.querySelector('.highlight__label')?.textContent?.trim() === name
          );
        },
        NAME,
        { timeout: 15000 }
      )
      .catch(() => {});

    const kreise = await lesen();
    if (!kreise.length) throw new Error('das Profil zeigt gar keine Kreise mehr');
    if (kreise.some((k) => k.art === 'playlist' && k.name === NAME)) {
      throw new Error('die Playlist steht noch da');
    }
    if (!kreise.some((k) => k.art === 'highlight' && k.name === NAME)) {
      throw new Error('das gleichnamige Highlight ist mit verschwunden');
    }
  });

  await pruefe('Sie ist auch in der Datenbank weg, nicht nur auf dem Schirm', async () => {
    const liste = await api('/api/sammlungen?art=playlist');
    const namen = (Array.isArray(liste) ? liste : []).map((s) => s.name);
    if (namen.includes(NAME)) throw new Error('steht noch in der Datenbank');
  });

  await pruefe('Den Beitrag darin gibt es weiterhin', async () => {
    /*
     * Das ist der Punkt, den die Rueckfrage verspricht. Faellt er um, hat das
     * Loeschen mehr mitgenommen als die Zuordnung — und der Hinweistext
     * waere eine Luege.
     */
    const boot = await api('/api/bootstrap');
    const eigene = [...(boot.posts || []), ...(boot.videos || [])];
    if (!eigene.some((b) => b.id === beitragId)) throw new Error('der Beitrag ist mit weg');
  });

  await pruefe('Loeschen trifft nur die eigene Sammlung, nicht die gleichnamige fremde', async () => {
    /*
     * Die scharfe Fassung dieser Gegenprobe.
     *
     * Ein Name, den NUR jemand anderes hat, waere zu leicht: die Route faende
     * nichts und meldete brav „gibt es nicht mehr" — bestanden, ohne dass
     * jemals ein DELETE eine fremde Zeile auch nur gestreift haette.
     *
     * Genommen wird deshalb ein Name, den BEIDE haben („Test", „Reisen",
     * „Technik" hat jedes Konto aus dem Testbestand). Danach muss die eigene
     * Zeile weg sein UND die fremde noch da. Gezaehlt, nicht gehofft: bei
     * Row Level Security loescht ein abgelehntes DELETE null Zeilen und
     * meldet keinen Fehler.
     */
    const fremdeAlle = await zaehleFremde();
    const meine = await api('/api/sammlungen?art=highlight');
    const meineNamen = (Array.isArray(meine) ? meine : []).map((s) => s.name);

    const ziel = fremdeAlle.find((f) => f.art === 'highlight' && meineNamen.includes(f.name));
    if (!ziel) throw new Error('kein gleichnamiges Paar im Bestand');

    const fremdeMitNamen = (liste) =>
      liste.filter((f) => f.art === ziel.art && f.name === ziel.name).length;
    const vorher = fremdeMitNamen(fremdeAlle);

    const res = await api(
      `/api/eigene/sammlung/${ziel.art}/${encodeURIComponent(ziel.name)}`,
      { method: 'DELETE' }
    );
    if (!res.ok) throw new Error('die eigene wurde nicht geloescht: ' + (res.error || ''));

    const nachher = fremdeMitNamen(await zaehleFremde());
    if (nachher !== vorher) throw new Error(`${vorher} fremde vorher, ${nachher} nachher`);

    const meineDanach = await api('/api/sammlungen?art=highlight');
    if ((Array.isArray(meineDanach) ? meineDanach : []).some((s) => s.name === ziel.name)) {
      throw new Error('die eigene steht noch da');
    }
  });

  console.log('\nAufraeumen');

  await pruefe('Die Pruefsammlungen sind wieder weg', async () => {
    /*
     * Direkt gegen PostgREST und nicht ueber die Seite: das Highlight
     * `HL_NAME` wurde nie geoeffnet, und der Lauf soll auch dann sauber
     * hinterlassen, wenn eine der Pruefungen oben unterwegs gescheitert ist.
     */
    const geloescht = await ohneSeiteLoeschen(NAME);
    // Gezaehlt, nicht gehofft: bei Row Level Security loescht ein
    // abgelehntes DELETE null Zeilen und meldet trotzdem Erfolg.
    if (geloescht !== 0) throw new Error(`${geloescht} uebrig`);
  });

  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length ? 1 : 0);
})();
