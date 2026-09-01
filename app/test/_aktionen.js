/**
 * Kommt an, was die App tut?
 *
 * WARUM ES DAS GIBT
 *
 * Bis zum 01.09.2026 waren Like, Speichern, Repost, Folgen und Teilen in der
 * App reine Anzeige: der Bildschirm schaltete um, und das war alles. Nichts
 * davon erreichte die Datenbank, also erschien nichts davon auf der Website,
 * und nach einem Neustart der App war es wieder weg.
 *
 * Auffallen konnte das keinem Prüflauf. Die einen prüfen die Website — die
 * hat es die ganze Zeit richtig gemacht. Die anderen prüfen die Oberfläche
 * der App — und die schaltete ja um. Zwischen "es sieht richtig aus" und "es
 * steht in der Datenbank" lag genau diese Lücke.
 *
 * Dieser Lauf schließt sie: er führt app/lib/aktionen.ts aus, so wie es in
 * der App läuft, und sieht danach in der Datenbank nach.
 *
 * Start:  node test/_aktionen.js   (Server muss laufen)
 */

const { chromium } = require('playwright-core');
const { anmelden, MAIL } = require('./_konto');
const K = require('./_kennungen');

const BASIS = process.env.AM_URL || 'http://localhost:3000';
const K_BOB = K.person('u2');

let fehler = 0;
const pruefe = (name, wahr, zusatz = '') => {
  if (!wahr) fehler++;
  console.log((wahr ? '  OK   ' : '  FEHL ') + name + (zusatz ? '  — ' + zusatz : ''));
};

(async () => {
  const browser = await chromium.launch();
  const seite = await browser.newPage({ viewport: { width: 400, height: 860 } });

  const browserFehler = [];
  seite.on('pageerror', (e) => browserFehler.push('JS-Fehler: ' + e.message));

  await seite.goto(BASIS, { waitUntil: 'networkidle' });
  const an = await anmelden(seite);
  if (!an.ok) {
    console.error(`FEHLER  Prüfkonto ${MAIL} konnte sich nicht anmelden: ${an.fehler}`);
    await browser.close();
    process.exit(1);
  }
  await seite.evaluate(() => fetch('/api/reset', { method: 'POST' }));

  /*
   * app/lib/aktionen.ts ist TypeScript und läuft sonst in Expo. Hier wird es
   * übersetzt und im Browser ausgeführt — gegen dieselbe Datenbank, mit
   * demselben Zugangstoken. Genau wie in test/_gleichstand.js: geprüft wird
   * damit wirklich der Code der App und keine Nachbildung davon.
   */
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');

  const bauOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'all-media-aktionen-'));
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, '..', 'node_modules', 'typescript', 'bin', 'tsc'),
      path.join(__dirname, '..', 'lib', 'aktionen.ts'),
      '--ignoreConfig', '--target', 'es2020', '--module', 'es2020',
      '--skipLibCheck', '--outDir', bauOrdner,
    ],
    { stdio: 'pipe' }
  );
  /*
   * Wo die uebersetzte Datei landet, haengt davon ab, wie weit tsc das
   * gemeinsame Wurzelverzeichnis hochzieht — bei daten.ts ist es "lib/",
   * bei aktionen.ts der Ordner selbst. Also suchen statt raten.
   */
  const finde = (ordner) =>
    fs.readdirSync(ordner, { withFileTypes: true }).flatMap((e) => {
      const voll = path.join(ordner, e.name);
      return e.isDirectory() ? finde(voll) : e.name === 'aktionen.js' ? [voll] : [];
    });

  const [datei] = finde(bauOrdner);
  if (!datei) {
    console.error('FEHLER  aktionen.ts liess sich nicht uebersetzen.');
    await browser.close();
    process.exit(1);
  }
  const quelltext = fs.readFileSync(datei, 'utf8');
  fs.rmSync(bauOrdner, { recursive: true, force: true });

  /** Führt eine Funktion aus aktionen.ts im Browser aus. */
  const app = (name, ...args) =>
    seite.evaluate(
      async ({ quelltext, name, args }) => {
        if (!window.__aktionen) {
          const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
          window.__aktionen = await import(url);
          URL.revokeObjectURL(url);
        }
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        return window.__aktionen[name](client, ich, ...args);
      },
      { quelltext, name, args }
    );

  /** Was die Website über diesen Beitrag sagt — die zweite Meinung. */
  const ausWebsite = (id) =>
    seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      const alle = [...(boot.posts || []), ...(boot.videos || []), ...(boot.clips || [])];
      return alle.find((b) => b.id === id) || null;
    }, id);

  // Ein Beitrag, der nicht von mir ist — an eigenen Beiträgen sagt "folgen"
  // nichts aus.
  const beitrag = await seite.evaluate(async () => {
    const boot = await (await fetch('/api/bootstrap')).json();
    return (boot.posts || []).find((p) => p.userId !== 'me') || (boot.posts || [])[0];
  });

  if (!beitrag) {
    console.error('FEHLER  Kein Beitrag in der Datenbank — der Lauf würde nichts prüfen.');
    await browser.close();
    process.exit(1);
  }

  console.log('\nWas die App schreibt, sieht die Website');

  const vorher = await ausWebsite(beitrag.id);

  await pruefe('Like aus der App zählt auf der Website mit', await (async () => {
    const gesetzt = await app('like', beitrag.id);
    const nach = await ausWebsite(beitrag.id);
    return gesetzt === true && nach.likes === vorher.likes + 1 && nach.liked === true;
  })());

  await pruefe('Noch einmal antippen nimmt es zurück', await (async () => {
    const gesetzt = await app('like', beitrag.id);
    const nach = await ausWebsite(beitrag.id);
    return gesetzt === false && nach.likes === vorher.likes && nach.liked === false;
  })());

  await pruefe('Speichern aus der App steht auf der Website', await (async () => {
    await app('speichern', beitrag.id);
    const nach = await ausWebsite(beitrag.id);
    const ok = nach.saved === true;
    await app('speichern', beitrag.id);
    return ok;
  })());

  await pruefe('Repost aus der App steht auf der Website', await (async () => {
    await app('repost', beitrag.id);
    const nach = await ausWebsite(beitrag.id);
    const ok = nach.reposted === true;
    await app('repost', beitrag.id);
    return ok;
  })());

  await pruefe('Beitragshinweis aus der App steht auf der Website', await (async () => {
    await app('beitragshinweis', beitrag.id);
    const nach = await ausWebsite(beitrag.id);
    const ok = nach.notify === true;
    await app('beitragshinweis', beitrag.id);
    return ok;
  })());

  await pruefe('Folgen aus der App steht auf der Website', await (async () => {
    const ziel = beitrag.userId === 'me' ? K.person('u1') : beitrag.userId;

    /*
     * Nicht "danach folge ich" pruefen, sondern "es hat sich umgedreht".
     * Das Pruefkonto folgt einigen Personen schon von Haus aus
     * (SUPABASE_SCHEMA_7_testkonto.sql) — wer das nicht beachtet, prueft je
     * nach Beitrag mal das eine und mal das andere.
     */
    const folgeIch = () =>
      seite.evaluate(async (ziel) => {
        const boot = await (await fetch('/api/bootstrap')).json();
        return Boolean((boot.gefolgt || {})[ziel]);
      }, ziel);

    const vorZustand = await folgeIch();
    const gesetzt = await app('folgen', ziel);
    const nachZustand = await folgeIch();

    await app('folgen', ziel); // wieder auf Anfang
    return gesetzt === !vorZustand && nachZustand === !vorZustand;
  })());

  await pruefe('Community-Beitritt aus der App steht auf der Website', await (async () => {
    const gemeinschaft = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.communities || [])[0] || null;
    });
    if (!gemeinschaft) return false;

    const mitglied = () =>
      seite.evaluate(async (id) => {
        const boot = await (await fetch('/api/bootstrap')).json();
        return Boolean((boot.communities || []).find((c) => c.id === id)?.joined);
      }, gemeinschaft.id);

    const vorZustand = await mitglied();
    const gesetzt = await app('communityBeitritt', gemeinschaft.id);
    const nachZustand = await mitglied();

    await app('communityBeitritt', gemeinschaft.id); // wieder auf Anfang
    return gesetzt === !vorZustand && nachZustand === !vorZustand;
  })());

  await pruefe('Eine gesehene Story bleibt gesehen — auch beim zweiten Mal', await (async () => {
    /*
     * Der Fall, der im iOS-Simulator aufflog: das zweite Ansehen derselben
     * Story lief in "new row violates row-level security policy for table
     * story_views". Ein upsert wird bei vorhandener Zeile zu einem UPDATE,
     * und dafuer gibt es keine Regel. Zweimal aufrufen ist deshalb die
     * eigentliche Pruefung — einmal allein wuerde immer durchgehen.
     */
    const story = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.stories || []).find((s) => !s.own) || null;
    });
    if (!story) return false;

    const erste = await app('storyGesehen', story.id);
    const zweite = await app('storyGesehen', story.id);
    return erste === true && zweite === true;
  })());

  console.log('\nEigene Inhalte anlegen');

  await pruefe('Ein Beitrag aus der App steht danach auf der Website', await (async () => {
    /*
     * Der Beitrag wurde in der App bis zum 01.09.2026 nur in den Zustand des
     * Bildschirms gelegt, mit einer selbst ausgedachten Kennung. Auf der
     * Website tauchte er nie auf, und unter dieser Kennung liess er sich
     * weder liken noch loeschen.
     */
    const id = await app('beitragAnlegen', {
      art: 'post',
      beschreibung: 'Prüflauf-Beitrag',
      ort: 'Prüfstand',
      musik: 'Originalton',
    });
    if (typeof id !== 'string' || !id) return false;

    const daWebsite = await seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.posts || []).some((p) => p.id === id && p.description === 'Prüflauf-Beitrag');
    }, id);

    await app('beitragLoeschen', id);
    return daWebsite;
  })());

  await pruefe('Gelöscht ist danach auch wirklich weg', await (async () => {
    const id = await app('beitragAnlegen', { art: 'reel', beschreibung: 'Prüflauf-Video' });
    await app('beitragLoeschen', id);
    const nochDa = await seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      const alle = [...(boot.posts || []), ...(boot.videos || []), ...(boot.clips || [])];
      return alle.some((p) => p.id === id);
    }, id);
    return nochDa === false;
  })());

  await pruefe('Eine geänderte Bio steht danach auf der Website', await (async () => {
    /*
     * Henrik hatte das Bearbeiten des eigenen Profils ausdruecklich verlangt.
     * Das Formular gab es — gespeichert wurde bis zum 01.09.2026 nichts.
     */
    const alt = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return boot.eigenesProfil?.bio ?? '';
    });

    const neuText = `Prüflauf ${Date.now()}`;
    await app('profilAendern', { bio: neuText });

    const jetzt = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return boot.eigenesProfil?.bio ?? '';
    });

    await app('profilAendern', { bio: alt || '' });
    return jetzt === neuText;
  })());

  await pruefe('Eine angelegte Community steht danach auf der Website', await (async () => {
    const name = `Prüflauf ${Date.now()}`;
    const id = await app('communityAnlegen', name, 'Zum Prüfen', true);
    if (typeof id !== 'string' || !id) return false;

    const gefunden = await seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      const c = (boot.communities || []).find((x) => x.id === id);
      // Wer sie anlegt, ist ihr erstes Mitglied — sonst stuende sie unter
      // "Erstellt", aber nicht unter "Meine".
      return Boolean(c && c.joined);
    }, id);

    await seite.evaluate(async (id) => {
      const client = await window.Anmeldung.aufbauen();
      await client.from('communities').delete().eq('id', id);
    }, id);

    return gefunden;
  })());

  console.log('\nBlockieren, stummschalten, melden');

  await pruefe('Blockieren aus der App steht auf der Website', await (async () => {
    const ziel = K.person('u3');
    const blockiert = () =>
      seite.evaluate(async (ziel) => {
        const boot = await (await fetch('/api/bootstrap')).json();
        return (boot.blockiert || []).includes(ziel);
      }, ziel);

    const vorZustand = await blockiert();
    const gesetzt = await app('blockieren', ziel);
    const nachZustand = await blockiert();
    await app('blockieren', ziel);
    return gesetzt === !vorZustand && nachZustand === !vorZustand;
  })());

  await pruefe('Stummschalten aus der App steht auf der Website', await (async () => {
    const ziel = K.person('u4');
    const stumm = () =>
      seite.evaluate(async (ziel) => {
        const boot = await (await fetch('/api/bootstrap')).json();
        return (boot.stummgeschaltet || []).includes(ziel);
      }, ziel);

    const vorZustand = await stumm();
    const gesetzt = await app('stummschalten', ziel);
    const nachZustand = await stumm();
    await app('stummschalten', ziel);
    return gesetzt === !vorZustand && nachZustand === !vorZustand;
  })());

  await pruefe('Eine Meldung aus der App nimmt die Datenbank an', await (async () => {
    /*
     * Meldungen kann niemand zurueck:lesen — das ist Absicht (die Regeln der
     * Datenbank lassen nur das Abschicken zu). Geprueft wird deshalb, dass
     * das Abschicken durchgeht und keinen Fehler wirft.
     */
    const e = await seite.evaluate(
      async ({ quelltext, ziel }) => {
        if (!window.__aktionen) {
          const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
          window.__aktionen = await import(url);
        }
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        try {
          await window.__aktionen.melden(client, ich, ziel, 'Prüflauf', 'user');
          return null;
        } catch (fehler) {
          return fehler.message;
        }
      },
      { quelltext, ziel: K.person('u5') }
    );
    return e === null;
  })());

  console.log('\nTeilen');

  await pruefe('Geteilter Beitrag zählt bei den Weiterleitungen mit', await (async () => {
    const start = await ausWebsite(beitrag.id);
    await app('teilen', beitrag.id, [K.person('u2')], 'Beitrag geteilt');
    const nach = await ausWebsite(beitrag.id);
    // Bildbeiträge zeigen die Weiterleitungen als "reposts", Videos als
    // "shares" — beide kommen aus derselben Spalte.
    const vorZahl = start.shares ?? start.reposts ?? 0;
    const nachZahl = nach.shares ?? nach.reposts ?? 0;
    return nachZahl === vorZahl + 1;
  })());

  await pruefe('Der geteilte Beitrag liegt im Chat des Empfängers', await (async () => {
    const liste = await seite.evaluate(
      async () => (await (await fetch('/api/bootstrap')).json()).chats || []
    );
    const bob = liste.find((c) => c.userId === K_BOB);
    return Boolean(bob && /geteilt/i.test(bob.preview || ''));
  })());

  await pruefe('Ohne Empfänger passiert nichts', await (async () => {
    const e = await seite.evaluate(
      async ({ quelltext, id }) => {
        if (!window.__aktionen) {
          const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
          window.__aktionen = await import(url);
        }
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        try {
          await window.__aktionen.teilen(client, ich, id, []);
          return null;
        } catch (fehler) {
          return fehler.message;
        }
      },
      { quelltext, id: beitrag.id }
    );
    return typeof e === 'string' && e.length > 0;
  })());

  await seite.evaluate(() => fetch('/api/reset', { method: 'POST' }));

  console.log(browserFehler.length ? '\nKonsolenfehler:\n' + browserFehler.join('\n') : '\nKonsolenfehler: keine');
  console.log(
    fehler === 0
      ? 'Alles, was die App schreibt, kommt in der Datenbank an.'
      : `${fehler} Aktionen der App kommen nicht an.`
  );

  await browser.close();
  process.exit(fehler || browserFehler.length ? 1 : 0);
})();
