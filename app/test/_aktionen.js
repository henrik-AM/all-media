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

  /* ====================================================================== *
   *  Der zweite Teil: Chats, Kontakte, Storys, Kommentare, Communitys
   *
   *  Alles darueber war am 01.09.2026 schon nachgezogen. Alles hier unten
   *  nicht: die Oberflaeche der App konnte es, geschrieben wurde nichts.
   *  Ein archivierter Chat war nach dem Neustart wieder da, eine angelegte
   *  Gruppe weg, eine Story-Antwort kam bei niemandem an.
   *
   *  Jede Pruefung hier schreibt mit dem Code der App und sieht danach ueber
   *  /api/bootstrap nach — das ist die Website, also die zweite Meinung.
   *  Danach wird aufgeraeumt, damit der Testbestand so bleibt, wie er war.
   * ====================================================================== */

  /** Was die Website ueber diesen Chat sagt. */
  const chatAusWebsite = (id) =>
    seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return [...(boot.chats || []), ...(boot.communityChats || [])].find((c) => c.id === id) || null;
    }, id);

  console.log('\nChats');

  // Ein vorhandener Zweierchat aus dem Testbestand.
  const chat = await seite.evaluate(
    async (bob) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.chats || []).find((c) => c.userId === bob) || (boot.chats || [])[0] || null;
    },
    K_BOB
  );

  if (!chat) {
    console.error('FEHLER  Kein Chat im Testbestand — die Chat-Pruefungen wuerden nichts pruefen.');
    process.exitCode = 1;
  } else {
    await pruefe('Stummschalten aus der App steht in der Datenbank', await (async () => {
      const gesetzt = await app('chatEinstellung', chat.id, 'stumm');
      const nach = await chatAusWebsite(chat.id);
      const ok = gesetzt === true && nach && nach.muted === true;
      await app('chatEinstellung', chat.id, 'stumm', false);
      return ok;
    })());

    await pruefe('Und laesst sich auch wieder aufheben', await (async () => {
      // Der Umschalter war auf der Website lange eine Einbahnstrasse. In der
      // App darf das nicht wieder passieren.
      await app('chatEinstellung', chat.id, 'stumm', true);
      const gesetzt = await app('chatEinstellung', chat.id, 'stumm');
      const nach = await chatAusWebsite(chat.id);
      return gesetzt === false && nach && !nach.muted;
    })());

    await pruefe('Archivieren aus der App steht in der Datenbank', await (async () => {
      const gesetzt = await app('chatEinstellung', chat.id, 'archiv');
      const drin = await seite.evaluate(async (id) => {
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        const { data } = await client
          .from('chat_members')
          .select('is_archived')
          .eq('chat_id', id)
          .eq('user_id', ich)
          .maybeSingle();
        return Boolean(data && data.is_archived);
      }, chat.id);
      await app('chatEinstellung', chat.id, 'archiv', false);
      return gesetzt === true && drin === true;
    })());

    await pruefe('Als gelesen markieren aus der App steht in der Datenbank', await (async () => {
      // Der dritte Punkt aus dem Optionen-Blatt. In der Datenbank steht er
      // andersherum: is_read true heisst gelesen.
      await app('chatEinstellung', chat.id, 'gelesen', false);
      const ungelesen = await chatAusWebsite(chat.id);
      await app('chatEinstellung', chat.id, 'gelesen', true);
      const gelesen = await chatAusWebsite(chat.id);
      return ungelesen && ungelesen.unread === 1 && gelesen && gelesen.unread === 0;
    })());

    await pruefe('Eine Nachricht aus der App liegt danach im Chat', await (async () => {
      const text = 'Prüflauf ' + Date.now();
      const nachricht = await app('nachrichtSenden', chat.id, text);
      const nach = await chatAusWebsite(chat.id);
      return Boolean(nachricht && nachricht.id) && nach && nach.preview === text;
    })());
  }

  await pruefe('Eine Gruppe aus der App steht danach auf der Website', await (async () => {
    const name = 'Prüfgruppe ' + Date.now();
    const id = await app('gruppeAnlegen', name, [K_BOB]);
    const nach = await chatAusWebsite(id);
    const ok = Boolean(id) && nach && nach.name === name && nach.isGroup === true;

    /*
     * Wieder abraeumen — und dabei gleich chatVerlassen mitpruefen.
     *
     * Bleibt die Gruppe stehen, fehlt in der Datenbank die Regel zum Loeschen
     * auf chat_members: SUPABASE_SCHEMA_9_loeschen.sql ist dann noch nicht
     * eingespielt. chatVerlassen meldet das seit dem 01.09.2026 als Fehler,
     * statt Erfolg zu behaupten.
     */
    let weg = false;
    try {
      await app('chatVerlassen', id);
      weg = (await chatAusWebsite(id)) === null;
    } catch (e) {
      console.log('       Grund: ' + (e.message || e));
    }
    return ok && weg;
  })());

  console.log('\nKontakte');

  await pruefe('Ein Kontakt aus der App steht danach auf der Website', await (async () => {
    /*
     * Eine Person, die noch nicht in den Kontakten steht. Das Pruefkonto
     * bringt sechs mit (SUPABASE_SCHEMA_7_testkonto.sql) — welche, steht
     * nicht fest, also wird gesucht statt geraten.
     */
    const boot = await seite.evaluate(async () => (await (await fetch('/api/bootstrap')).json()));
    const drin = new Set((boot.contacts || []).map((c) => c.id));
    const ich = boot.ichId;
    const frei = Object.keys(boot.users || {}).find((id) => id !== ich && id !== 'me' && !drin.has(id));
    if (!frei) return false;

    const ergebnis = await app('kontaktHinzufuegen', frei, true);
    const nachAnfrage = await seite.evaluate(
      async (id) => {
        const boot = await (await fetch('/api/bootstrap')).json();
        return (boot.contacts || []).find((c) => c.id === id) || null;
      },
      frei
    );

    // Und annehmen: aus "pending" wird "friend".
    await app('anfrageAnnehmen', frei);
    const nachAnnahme = await seite.evaluate(
      async (id) => {
        const boot = await (await fetch('/api/bootstrap')).json();
        return (boot.contacts || []).find((c) => c.id === id) || null;
      },
      frei
    );

    return (
      Boolean(ergebnis && ergebnis.chatId) &&
      ergebnis.status === 'pending' &&
      Boolean(nachAnfrage) &&
      Boolean(nachAnnahme) &&
      nachAnnahme.status === 'friend'
    );
  })());

  console.log('\nStorys und Kommentare');

  await pruefe('Eine Story aus der App steht danach auf der Website', await (async () => {
    const text = 'Prüflauf ' + Date.now();
    const id = await app('storyAnlegen', { text, mediaTyp: 'image' });
    const nach = await seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.stories || []).find((s) => s.id === id) || null;
    }, id);

    await app('storyLoeschen', id);
    const weg = await seite.evaluate(async (id) => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return !(boot.stories || []).some((s) => s.id === id);
    }, id);

    return Boolean(id) && Boolean(nach) && nach.caption === text && weg;
  })());

  await pruefe('Ein Story-Herz aus der App steht in der Datenbank', await (async () => {
    const story = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.stories || []).find((s) => !s.own) || (boot.stories || [])[0] || null;
    });
    if (!story) return false;

    const gesetzt = await app('storyLike', story.id);
    const drin = await seite.evaluate(async (id) => {
      const client = await window.Anmeldung.aufbauen();
      const ich = window.Anmeldung.nutzer().id;
      const { count } = await client
        .from('story_likes')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', id)
        .eq('user_id', ich);
      return count;
    }, story.id);

    await app('storyLike', story.id);
    return gesetzt === true && drin === 1;
  })());

  await pruefe('Eine Story-Antwort landet im Chat mit dieser Person', await (async () => {
    const story = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.stories || []).find((s) => !s.own && s.userId) || null;
    });
    if (!story) return false;

    const text = 'Schöne Story ' + Date.now();
    const chatId = await app('storyAntwort', story.id, text);
    const nach = await chatAusWebsite(chatId);
    return Boolean(chatId) && Boolean(nach) && nach.preview === text;
  })());

  await pruefe('Ein Kommentar aus der App steht danach am Beitrag', await (async () => {
    const text = 'Prüflauf ' + Date.now();
    const vor = await ausWebsite(beitrag.id);
    const kommentar = await app('kommentarAnlegen', beitrag.id, text);
    const nach = await ausWebsite(beitrag.id);
    const ok = Boolean(kommentar && kommentar.id) && nach.comments === vor.comments + 1;

    await app('kommentarLoeschen', kommentar.id);
    const zurueck = await ausWebsite(beitrag.id);
    return ok && zurueck.comments === vor.comments;
  })());

  console.log('\nCommunitys und eigenes Profil');

  await pruefe('Ein Unterthema aus der App steht danach auf der Website', await (async () => {
    const community = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.communities || []).find((c) => c.joined) || (boot.communities || [])[0] || null;
    });
    if (!community) return false;

    const name = 'Prüfthema ' + Date.now();
    const kanalId = await app('kanalAnlegen', community.id, name);
    if (!kanalId) return false;

    // Und wirklich hineinschreiben — genau das ging in der App nicht: sie
    // schrieb Kanalnachrichten nach `messages` und las sie nie wieder.
    const text = 'Prüflauf ' + Date.now();
    const nachricht = await app('kanalNachricht', kanalId, text);

    const drin = await seite.evaluate(async (id) => {
      const client = await window.Anmeldung.aufbauen();
      const { data } = await client
        .from('community_channel_messages')
        .select('text')
        .eq('channel_id', id);
      return (data || []).map((z) => z.text);
    }, kanalId);

    return Boolean(nachricht && nachricht.id) && drin.includes(text);
  })());

  await pruefe('Ein Highlight aus der App steht danach im eigenen Profil', await (async () => {
    const name = 'Prüflauf ' + Date.now();
    const liste = await app('profilListe', 'highlights', name);
    const nach = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.eigenesProfil || {}).highlights || [];
    });
    return Array.isArray(liste) && liste.includes(name) && nach.includes(name);
  })());

  await pruefe('Ein Spendenziel aus der App steht danach auf der Website', await (async () => {
    const ziel = { titel: 'Prüflauf', gesammelt: 5, ziel: 100 };
    await app('spendeSetzen', ziel);
    const nach = await seite.evaluate(async () => {
      const boot = await (await fetch('/api/bootstrap')).json();
      return (boot.eigenesProfil || {}).spende || null;
    });
    await app('spendeSetzen', null);
    return Boolean(nach) && nach.titel === 'Prüflauf';
  })());

  await pruefe('Ein Livestream aus der App steht danach im eigenen Profil', await (async () => {
    await app('livestreamSetzen', 'Prüflauf');
    const an = await seite.evaluate(async () => {
      const client = await window.Anmeldung.aufbauen();
      const ich = window.Anmeldung.nutzer().id;
      const { data } = await client.from('profiles').select('live').eq('id', ich).maybeSingle();
      return data && data.live;
    });

    await app('livestreamSetzen', null);
    const aus = await seite.evaluate(async () => {
      const client = await window.Anmeldung.aufbauen();
      const ich = window.Anmeldung.nutzer().id;
      const { data } = await client.from('profiles').select('live').eq('id', ich).maybeSingle();
      return data && data.live;
    });

    return an === 'Prüflauf' && !aus;
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
