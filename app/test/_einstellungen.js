// Prueft, dass in den Einstellungen kein Punkt mehr nur einen Hinweis
// ausgibt: Auswahl, Formular, Liste, Erklaertext und Nachfrage.
//
// Start:  node test/_einstellungen.js   (Server muss laufen)

const { chromium } = require('playwright-core');
const { anmelden, zuruecksetzen, beenden } = require('./_konto');

const ZIEL = process.env.ZIEL || 'http://localhost:3000/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  page.setDefaultTimeout(8000);

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
  await page.evaluate(() => localStorage.removeItem('am-einstellungen'));
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

  const zuDenEinstellungen = async () => {
    await page.click('[data-area="settings"]');
    await page.waitForTimeout(600);
  };

  const blattZu = async () => {
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(300);
  };

  await zuDenEinstellungen();

  console.log('\nEinstellungen');

  await pruefe('Die Sprungleiste zeigt alle neun Abschnitte', async () => {
    const pillen = await page.$$eval('.pill', (els) => els.map((e) => e.textContent));
    if (pillen.length !== 9) throw new Error(pillen.join(' | '));
    if (pillen[0] !== 'Allgemein') throw new Error(pillen.join(' | '));
  });

  await pruefe('Auswahlpunkte zeigen ihren Stand gleich in der Liste', async () => {
    const werte = await page.$$eval('.item__value', (els) => els.map((e) => e.textContent));
    if (werte.length < 10) throw new Error('nur ' + werte.length + ' Werte');
  });

  /*
   * Hier stand bis zum 03.09.2026 "Zuletzt online" — und der Lauf sicherte
   * damit einen Fehler ab: die Einstellung gab es zweimal. Unter Datenschutz
   * als Dreier-Wahl, die nur im Bildschirmzustand lag, und unter Messenger
   * als vier Stufen mit Ausnahmeliste, die in die Datenbank gingen. Zwei
   * Orte, dieselbe Frage, verschiedene Antworten. Geprueft wird die
   * Dreier-Wahl deshalb jetzt an einem Punkt, der wirklich einer ist.
   */
  await pruefe('Eine Auswahl lässt sich ändern und bleibt stehen', async () => {
    await page.click('[data-setting="Profilbild sichtbar für"]');
    await page.waitForSelector('[data-wahl]');
    const moeglich = await page.$$eval('[data-wahl]', (els) => els.map((e) => e.dataset.wahl));
    if (moeglich.length !== 3) throw new Error(moeglich.join(' | '));
    await page.click('[data-wahl="Niemand"]');
    await page.waitForTimeout(700);
    const jetzt = await page.$eval(
      '[data-setting="Profilbild sichtbar für"] .item__value',
      (e) => e.textContent
    );
    if (jetzt !== 'Niemand') throw new Error(jetzt);
  });

  await pruefe('Die Auswahl übersteht einen Neustart der Seite', async () => {
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    await zuDenEinstellungen();
    const jetzt = await page.$eval(
      '[data-setting="Profilbild sichtbar für"] .item__value',
      (e) => e.textContent
    );
    if (jetzt !== 'Niemand') throw new Error(jetzt);
  });

  /*
   * Und die Gegenprobe zum aufgeloesten Doppel: "Zuletzt online" fuehrt
   * jetzt ueberall auf dieselben vier Stufen mit Ausnahmeliste, nicht mehr
   * auf eine eigene Dreier-Wahl.
   */
  await pruefe('„Zuletzt online" führt auf die vier Sichtbarkeitsstufen', async () => {
    await page.click('[data-setting="Zuletzt online"] >> nth=0');
    await page.waitForSelector('[data-stufe]');
    const stufen = await page.$$eval('[data-stufe]', (els) => els.map((e) => e.dataset.stufe));
    if (stufen.length !== 4) throw new Error(stufen.join(' | '));
    const wahl = await page.$$eval('[data-wahl]', (els) => els.length);
    if (wahl !== 0) throw new Error('daneben steht noch eine eigene Wahl');
    // Wie ueberall sonst in diesem Lauf: ueber den Zurueck-Knopf des Blattes.
    // Escape schliesst es nicht, und das offene Blatt faengt danach jeden
    // Klick der folgenden Pruefungen ab.
    await page.click('[data-sheet-close]').catch(() => {});
    await page.waitForTimeout(400);
  });

  await pruefe('Ein Formular prüft seine Eingaben', async () => {
    await page.click('[data-setting="Sicherheits-/Entsperrcode"]');
    await page.waitForSelector('#f_code');
    await page.fill('#f_code', '12');
    await page.fill('#f_wdh', '12');
    await page.click('#formOk');
    await page.waitForTimeout(400);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('4 bis 8')) throw new Error(hinweis);
  });

  await pruefe('Zwei verschiedene Eingaben werden abgelehnt', async () => {
    await page.fill('#f_code', '1234');
    await page.fill('#f_wdh', '5678');
    await page.click('#formOk');
    await page.waitForTimeout(400);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('überein')) throw new Error(hinweis);
  });

  await pruefe('Ein richtiger Code wird angenommen', async () => {
    await page.fill('#f_code', '1234');
    await page.fill('#f_wdh', '1234');
    await page.click('#formOk');
    await page.waitForTimeout(600);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (hinweis !== 'Code gesetzt') throw new Error(hinweis);
  });

  await pruefe('Ein Listenpunkt zeigt echte Einträge', async () => {
    await page.click('[data-setting="Speicher verwalten"]');
    await page.waitForTimeout(600);
    const zeilen = await page.$$eval('.sheet .item__label', (els) => els.map((e) => e.textContent));
    if (!zeilen.includes('Chats')) throw new Error(zeilen.join(' | '));
    await blattZu();
  });

  /*
   * Henrik am 18.09.2026: „Likes ... werden nicht synchronisiert (unter
   * Videos/Profil kann ich sie nicht sehen)." Sie standen nirgends: post_likes
   * wurde einzig gelesen, um das Herz im Feed rot zu faerben.
   *
   * Geprueft wird nicht, ob der Punkt da ist, sondern ob echte Zeilen
   * herauskommen — die Stufe, an der „Einstellung ohne Wirkung" scheitert.
   * „Wird geladen ..." gilt deshalb ausdruecklich NICHT als bestanden.
   */
  await pruefe('Gelikte Beiträge zeigen echte Zeilen', async () => {
    await page.click('[data-setting="Gelikte Beiträge"]');
    await page.waitForTimeout(1200);
    const zeilen = await page.$$eval('.sheet .item__label', (els) => els.map((e) => e.textContent.trim()));
    if (zeilen.some((z) => z.startsWith('Wird geladen'))) throw new Error('bleibt beim Ladetext stehen');
    if (!zeilen.length) throw new Error('keine Zeile');
    await blattZu();
  });

  /*
   * Dieselbe Meldung, die vierte Gattung: „Kommentare ... unter Videos/Profil
   * kann ich sie nicht sehen." Bis zum 21.09.2026 gab es dafuer nirgends eine
   * Ansicht — weder in der App noch hier.
   *
   * Schaerfer als bei den Likes, und zwar mit Absicht: „irgendeine Zeile"
   * waere auch dann erfuellt, wenn dort nur ein Datum oder ein Ersatztext
   * staende. Verlangt wird das Muster aus gemeinsam/kommentar.js — der
   * eigene Text UND der Beitrag, unter dem er steht. Sonst weiss man zwar,
   * dass man etwas geschrieben hat, aber nicht wo.
   *
   * Gewartet wird auf die Zeile, nicht auf die Uhr: feste Wartezeiten sind in
   * diesem Projekt schon dreimal der Grund fuer falsche Fehler gewesen.
   */
  await pruefe('Meine Kommentare zeigen Text und Beitrag', async () => {
    await page.click('[data-setting="Meine Kommentare"]');
    await page.waitForFunction(
      () => {
        const zeilen = [...document.querySelectorAll('.sheet .item__label')];
        return zeilen.length > 0 && !zeilen.some((e) => e.textContent.trim().startsWith('Wird geladen'));
      },
      { timeout: 8000 }
    );
    const zeilen = await page.$$eval('.sheet .item__label', (els) => els.map((e) => e.textContent.trim()));
    if (!zeilen.length) throw new Error('keine Zeile');
    const mitBeitrag = zeilen.find((z) => z.startsWith('„') && z.includes('" · '));
    if (!mitBeitrag) throw new Error('keine Zeile im Muster „Kommentar" · Beitrag: ' + zeilen.join(' | '));
    // Der Teil hinter dem Trenner ist der Beitrag — leer waere er wertlos.
    const beitrag = mitBeitrag.split('" · ')[1] || '';
    if (beitrag.trim().length < 3) throw new Error('Beitrag fehlt in: ' + mitBeitrag);
    await blattZu();
  });

  await pruefe('Ein Erklärtext geht auf', async () => {
    await page.click('[data-setting="Datenschutzerklärung"]');
    await page.waitForSelector('.sheet__text');
    const text = await page.$eval('.sheet__text', (e) => e.textContent);
    if (text.length < 60) throw new Error('Text zu kurz: ' + text);
    await blattZu();
  });

  await pruefe('Konto löschen fragt erst nach', async () => {
    await page.click('[data-setting="Konto löschen"]');
    await page.waitForSelector('#loeschJa');
    await page.click('#loeschJa');
    await page.waitForTimeout(500);
    const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
    if (!hinweis.includes('vorgemerkt')) throw new Error(hinweis);
  });

  /*
   * Die Telefonnummer.
   *
   * Bis zum 07.09.2026 meldete dieses Formular "Wir haben dir einen
   * Bestaetigungscode geschickt" und tat nichts. Geprueft wird deshalb nicht
   * die Meldung, sondern was danach in der Datenbank steht — genau der
   * Unterschied, den die alte Fassung verwischt hat.
   */
  await pruefe('Die Telefonnummer kommt in der Datenbank an', async () => {
    const nummer = '+49 151 9900110';
    const antwort = await page.evaluate(async (n) => {
      const res = await fetch('/api/eigene/telefon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nummer: n }),
      });
      return res.json();
    }, nummer);
    if (!antwort?.ok) throw new Error(antwort?.error || 'abgelehnt');
    // Gespeichert wird die Eingabe, nicht eine umgeschriebene Fassung.
    if (antwort.nummer !== nummer) throw new Error('gespeichert als ' + antwort.nummer);

  });

  /*
   * Die Personensuche rechnet dieselbe Vergleichsform. Anna steht mit
   * "+49 152 3456789" im Bestand; wer "0152 3456789" eintippt, muss sie
   * genauso finden. Vorher fand die Datenbank nur die zeichengleiche Fassung.
   */
  await pruefe('Zwei Schreibweisen finden dieselbe Person', async () => {
    const suche = (n) =>
      page.evaluate(async (eingabe) => {
        const res = await fetch('/api/personen/suche', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eingabe }),
        });
        return res.json();
      }, n);

    const mitVorwahl = await suche('+49 152 3456789');
    const mitNull = await suche('0152 3456789');
    if (!mitVorwahl?.person) throw new Error('mit +49 nichts gefunden');
    if (!mitNull?.person) throw new Error('mit fuehrender 0 nichts gefunden');
    if (mitVorwahl.person.id !== mitNull.person.id) {
      throw new Error('zwei verschiedene Personen: ' + mitVorwahl.person.id + ' / ' + mitNull.person.id);
    }
  });

  await pruefe('Eine zu kurze Nummer wird abgelehnt', async () => {
    const antwort = await page.evaluate(async () => {
      const res = await fetch('/api/eigene/telefon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nummer: '123' }),
      });
      return res.json();
    });
    if (antwort?.ok) throw new Error('durchgelassen');
    if (!/zu kurz/i.test(antwort?.error || '')) throw new Error(antwort?.error || 'kein Grund');
  });

  /*
   * Der eigentliche Fund vom 07.09.2026: die Datenbank rechnete eine andere
   * Vergleichsform als die App. "0152 3456789" ging als freie Nummer durch,
   * obwohl sie als "+49 152 3456789" schon Anna gehoerte. Seit
   * SUPABASE_SCHEMA_24_telefon.sql rechnen beide dasselbe.
   */
  await pruefe('Dieselbe Nummer anders geschrieben faellt als Dopplung auf', async () => {
    const antwort = await page.evaluate(async () => {
      const res = await fetch('/api/eigene/telefon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nummer: '0152 3456789' }),
      });
      return res.json();
    });
    if (antwort?.ok) throw new Error('durchgelassen — die Nummer gehoert schon jemandem');
    if (!/anderen Konto/i.test(antwort?.error || '')) throw new Error(antwort?.error || 'kein Grund');
  });

  await pruefe('Kein Punkt gibt mehr "folgt mit dem Backend" aus', async () => {
    const knoepfe = await page.$$eval('[data-setting]', (els) => els.map((e) => e.dataset.setting));
    const uebrig = [];

    for (const label of knoepfe) {
      if (label === 'Abmelden') continue;
      await page.evaluate(() => {
        const t = document.querySelector('#toast');
        if (t) { t.textContent = ''; t.hidden = true; }
      });
      await page.click(`[data-setting="${label}"]`);
      await page.waitForTimeout(350);
      const hinweis = await page.$eval('#toast', (e) => (e.hidden ? '' : e.textContent));
      if (/\bfolgt\b|\bfolgen\b|Phase 3/i.test(hinweis)) uebrig.push(`${label}: ${hinweis}`);

      await page.evaluate(() => document.querySelectorAll('.sheet-backdrop').forEach((e) => e.remove()));
      await page.waitForTimeout(120);
    }

    if (uebrig.length) throw new Error(uebrig.join(' | '));
  });

  await page.evaluate(() => localStorage.removeItem('am-einstellungen'));
  await zuruecksetzen(page);

  const fehler = ergebnisse.filter((ok) => !ok).length;
  const eindeutig = [...new Set(browserFehler)];
  console.log(`\n${ergebnisse.length - fehler} von ${ergebnisse.length} Pruefungen bestanden`);
  console.log(eindeutig.length ? 'Konsolenfehler:\n' + eindeutig.join('\n') : 'Konsolenfehler: keine');

  await beenden(browser, fehler || eindeutig.length ? 1 : 0);
})();
