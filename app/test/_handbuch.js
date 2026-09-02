/**
 * Kommt an, was am 01.09.2026 nach dem Handbuch dazugebaut wurde?
 *
 * WARUM ES DAS GIBT
 *
 * Das Handbuch wurde Punkt für Punkt gegen App und Website gehalten, und ein
 * gutes Dutzend beschriebener Funktionen fehlte auf beiden Seiten: Insight
 * Time, Nachrichten bearbeiten und zurücknehmen, Reaktionen, Umfragen,
 * Sichtbarkeit, Altersfreigabe, Wortfilter, Push-to-Talk, Stream-Kommentare,
 * Spenden, Standortanfragen. Sie wurden gebaut — 21 Aktionen in der App, 21
 * Handler auf der Website, dazu SUPABASE_SCHEMA_11_handbuch.sql.
 *
 * Geprüft hat sie nichts.
 *
 * Was das kostet, zeigte sich sofort: zwei Leseregeln aus Schema 11 lasen
 * sich gegenseitig, `insights` und `insight_recipients` antworteten jedem
 * angemeldeten Nutzer mit
 *
 *     HTTP 500  42P17  infinite recursion detected in policy
 *
 * Die halbe Insight Time war damit unbenutzbar, und gemerkt hat es niemand —
 * es gab ja keinen Lauf, der sie einmal wirklich benutzt hätte. Behoben in
 * SUPABASE_SCHEMA_12_insight_rekursion.sql.
 *
 * Dieser Lauf schließt die Lücke, nach demselben Muster wie test/_aktionen.js:
 * er führt app/lib/aktionen.ts aus — den echten Code der App, übersetzt und
 * gegen dieselbe Datenbank — und sieht danach nach, ob wirklich etwas steht.
 *
 * Start:  node test/_handbuch.js   (Server muss laufen)
 */

const { chromium } = require('playwright-core');
const { anmelden, MAIL, zuruecksetzen } = require('./_konto');
const K = require('./_kennungen');

const BASIS = process.env.AM_URL || 'http://localhost:3000';
const K_BOB = K.person('u2');
const K_ANNA = K.person('u1');

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
  await zuruecksetzen(seite);

  // --- app/lib/aktionen.ts übersetzen und im Browser laden ----------------
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const { execFileSync } = require('child_process');

  const bauOrdner = fs.mkdtempSync(path.join(os.tmpdir(), 'all-media-handbuch-'));
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

  /**
   * Führt eine Funktion aus aktionen.ts im Browser aus.
   *
   * Wirft sie, kommt der Fehlertext zurück statt eines Absturzes — sonst
   * bricht der ganze Lauf beim ersten Stolperer ab und die zwanzig Prüfungen
   * dahinter laufen nie. Genau so ist am 01.09.2026 die halbe Suite
   * unbemerkt liegen geblieben.
   */
  const app = (name, ...args) =>
    seite.evaluate(
      async ({ quelltext, name, args }) => {
        if (!window.__handbuch) {
          const url = URL.createObjectURL(new Blob([quelltext], { type: 'text/javascript' }));
          window.__handbuch = await import(url);
          URL.revokeObjectURL(url);
        }
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        try {
          return { ok: true, wert: await window.__handbuch[name](client, ich, ...args) };
        } catch (e) {
          return { ok: false, fehler: e?.message || String(e) };
        }
      },
      { quelltext, name, args }
    );

  /** Eine Abfrage in der Datenbank, mit dem Zugang des angemeldeten Nutzers. */
  const db = (fn, ...args) =>
    seite.evaluate(
      async ({ fn, args }) => {
        const client = await window.Anmeldung.aufbauen();
        const ich = window.Anmeldung.nutzer().id;
        return new Function('client', 'ich', 'args', `return (${fn})(client, ich, ...args)`)(
          client,
          ich,
          args
        );
      },
      { fn: fn.toString(), args }
    );

  // ======================================================== Insight Time ==
  console.log('\nInsight Time');

  const insight = await app('insightSenden', [K_BOB], {
    mediaUrl: 'https://example.invalid/pruef.jpg',
    mediaTyp: 'image',
    einmal: true,
  });

  pruefe(
    'Ein Insight aus der App landet in der Datenbank',
    insight.ok && Boolean(insight.wert?.id),
    insight.ok ? '' : insight.fehler
  );

  const insightId = insight.wert?.id;

  if (insightId) {
    pruefe('Der Empfänger steht dabei', await (async () => {
      const zeilen = await db(
        async (client, ich, id) =>
          (await client.from('insight_recipients').select('user_id').eq('insight_id', id)).data,
        insightId
      );
      return Array.isArray(zeilen) && zeilen.some((z) => z.user_id === K_BOB);
    })());

    pruefe('Die Insight-Kette wird fortgeschrieben', await (async () => {
      /*
       * Die Zahl rechnet die Datenbank aus (insight_streak_fortschreiben).
       * Beim ersten Insight an jemanden, der noch nichts zurückgeschickt hat,
       * darf sie 0 sein — geprüft wird, dass die Funktion überhaupt antwortet
       * und eine Zeile entsteht.
       */
      const streaks = insight.wert?.streaks || {};
      return Object.prototype.hasOwnProperty.call(streaks, K_BOB);
    })());

    const gespeichert = await app('insightSpeichern', insightId, true);
    pruefe('Einen Insight behalten', gespeichert.ok, gespeichert.ok ? '' : gespeichert.fehler);

    pruefe('Und das steht auch so in der Datenbank', await (async () => {
      const zeile = await db(
        async (client, ich, id) =>
          (await client.from('insights').select('gespeichert').eq('id', id).maybeSingle()).data,
        insightId
      );
      return zeile?.gespeichert === true;
    })());

    const wieder = await app('insightWiederholen', insightId, [K_ANNA]);
    pruefe(
      'Einen Insight wiederholen legt einen neuen an',
      wieder.ok && Boolean(wieder.wert),
      wieder.ok ? '' : wieder.fehler
    );
  }

  const ziel = await app('insightZiel', K_BOB);
  pruefe('Eine feste Empfängerliste lässt sich merken', ziel.ok, ziel.ok ? '' : ziel.fehler);

  // ================================================== Nachrichten im Chat ==
  console.log('\nNachrichten');

  const chat = await seite.evaluate(async (bob) => {
    const boot = await (await fetch('/api/bootstrap')).json();
    return (boot.chats || []).find((c) => c.userId === bob) || (boot.chats || [])[0] || null;
  }, K_BOB);

  if (!chat) {
    console.error('FEHLER  Kein Chat im Testbestand — die Nachrichten-Prüfungen fielen aus.');
    fehler++;
  } else {
    const gesendet = await app('nachrichtSenden', chat.id, 'Prüflauf Handbuch ' + Date.now());
    const nachrichtId = gesendet.wert?.id;
    pruefe('Eine Nachricht zum Arbeiten steht bereit', Boolean(nachrichtId));

    if (nachrichtId) {
      const neuerText = 'Geändert ' + Date.now();
      const bearbeitet = await app('nachrichtBearbeiten', nachrichtId, neuerText);
      pruefe(
        'Eine eigene Nachricht bearbeiten',
        bearbeitet.ok,
        bearbeitet.ok ? '' : bearbeitet.fehler
      );

      pruefe('Der neue Text steht in der Datenbank', await (async () => {
        const zeile = await db(
          async (client, ich, id) =>
            (await client.from('messages').select('text').eq('id', id).maybeSingle()).data,
          nachrichtId
        );
        return zeile?.text === neuerText;
      })());

      const reaktion = await app('nachrichtReaktion', nachrichtId, '👍');
      pruefe('Eine Reaktion setzen', reaktion.ok, reaktion.ok ? '' : reaktion.fehler);

      pruefe('Die Reaktion steht am richtigen Platz', await (async () => {
        const zeilen = await db(
          async (client, ich, id) =>
            (await client.from('message_reactions').select('emoji').eq('message_id', id)).data,
          nachrichtId
        );
        return Array.isArray(zeilen) && zeilen.some((z) => z.emoji === '👍');
      })());

      const nochmal = await app('nachrichtReaktion', nachrichtId, '👍');
      pruefe(
        'Dieselbe Reaktion noch einmal nimmt sie zurück',
        nochmal.ok && nochmal.wert === null,
        nochmal.ok ? String(nochmal.wert) : nochmal.fehler
      );

      const weiter = await app('nachrichtWeiterleiten', nachrichtId, [chat.id]);
      pruefe('Eine Nachricht weiterleiten', weiter.ok, weiter.ok ? '' : weiter.fehler);

      const zurueck = await app('nachrichtZuruecknehmen', nachrichtId);
      pruefe(
        'Eine Nachricht zurücknehmen',
        zurueck.ok,
        zurueck.ok ? '' : zurueck.fehler
      );
    }

    // ------------------------------------------------- Standortanfragen --
    console.log('\nStandort');

    const anfrage = await app('standortAnfragen', chat.id, K_BOB);
    pruefe(
      'Einen Standort anfragen',
      anfrage.ok && Boolean(anfrage.wert),
      anfrage.ok ? '' : anfrage.fehler
    );
  }

  // ============================================================ Umfragen ==
  console.log('\nUmfragen');

  /*
   * Ein eigener Beitrag, kein fremder.
   *
   * Vorher nahm der Lauf den neuesten Beitrag aus dem Bootstrap. Einzeln ging
   * das gut, im Gesamtlauf nicht: dort steht an der Stelle, was ein früherer
   * Lauf hinterlassen hat — und was dessen Aufräumen gleich wieder mitnimmt.
   * Die Umfrage merkte davon nichts (polls.traeger_id hat bewusst keinen
   * Fremdschlüssel, weil sie auch an Storys und Kanälen hängen kann), aber
   * Streamkommentar und Spende zeigen auf public.posts und fielen mit einer
   * Fremdschlüsselverletzung um. Ein selbst angelegter Beitrag gehört diesem
   * Lauf, existiert sicher, und `zuruecksetzen()` räumt ihn mit ab.
   */
  const eigeneId = await app('beitragAnlegen', {
    titel: 'Prüfbeitrag Handbuch',
    beschreibung: 'Träger für Umfrage, Streamkommentar und Spende',
    art: 'post',
  });
  const beitrag = eigeneId.ok && eigeneId.wert ? { id: eigeneId.wert } : null;

  if (!beitrag) {
    console.error('FEHLER  Der Prüfbeitrag ließ sich nicht anlegen — die Umfrage-Prüfungen fielen aus.');
    fehler++;
  } else {
    const umfrage = await app(
      'umfrageAnlegen',
      { art: 'post', id: beitrag.id },
      { frage: 'Prüflauf?', antworten: ['Ja', 'Nein'] }
    );
    pruefe(
      'Eine Umfrage an einen Beitrag hängen',
      umfrage.ok && Boolean(umfrage.wert),
      umfrage.ok ? '' : umfrage.fehler
    );

    if (umfrage.ok && umfrage.wert) {
      const optionen = await db(
        async (client, ich, id) =>
          (await client.from('poll_options').select('id, text').eq('poll_id', id)).data,
        umfrage.wert
      );
      pruefe(
        'Beide Antworten stehen dabei',
        Array.isArray(optionen) && optionen.length === 2,
        `${optionen?.length ?? 0} Antworten`
      );

      if (optionen?.length) {
        const stimme = await app('umfrageStimmen', umfrage.wert, optionen[0].id);
        pruefe('Abstimmen', stimme.ok, stimme.ok ? '' : stimme.fehler);

        pruefe('Die Stimme ist gezählt', await (async () => {
          const zeilen = await db(
            async (client, ich, id) =>
              (await client.from('poll_votes').select('option_id').eq('poll_id', id)).data,
            umfrage.wert
          );
          return Array.isArray(zeilen) && zeilen.length === 1;
        })());
      }
    }
  }

  // ================================================ Sichtbarkeit und Alter ==
  console.log('\nSichtbarkeit, Alter, Wortfilter');

  const sicht = await app('sichtbarkeitSetzen', 'story', 'alle_bis_auf');
  pruefe('Die Sichtbarkeit einer Story einstellen', sicht.ok, sicht.ok ? '' : sicht.fehler);

  const ausnahme = await app('sichtbarkeitAusnahme', 'story', K_BOB);
  pruefe('Eine Person davon ausnehmen', ausnahme.ok, ausnahme.ok ? '' : ausnahme.fehler);

  pruefe('Die Stufe steht in der Datenbank', await (async () => {
    const zeile = await db(async (client, ich) =>
      (
        await client
          .from('visibility_settings')
          .select('stufe')
          .eq('user_id', ich)
          .eq('bereich', 'story')
          .maybeSingle()
      ).data
    );
    return zeile?.stufe === 'alle_bis_auf';
  })());

  pruefe('Und die ausgenommene Person auch', await (async () => {
    const zeilen = await db(async (client, ich) =>
      (
        await client
          .from('visibility_exceptions')
          .select('target_id')
          .eq('user_id', ich)
          .eq('bereich', 'story')
      ).data
    );
    return Array.isArray(zeilen) && zeilen.some((z) => z.target_id === K_BOB);
  })());

  // Volljährig — ein Datum, das nicht mitwandert.
  const alter = await app('altersangabe', '1990-01-01');
  pruefe(
    'Eine Altersangabe wird angenommen und gerechnet',
    alter.ok && alter.wert?.alter >= 18 && alter.wert?.brauchtFreigabe === false,
    alter.ok ? `Alter ${alter.wert?.alter}` : alter.fehler
  );

  const filterTreffer = await app('wortfilter', 'Du bist ein Idiot');
  pruefe(
    'Der Wortfilter greift bei einem gelisteten Wort',
    filterTreffer.ok && filterTreffer.wert?.wort === 'idiot',
    filterTreffer.ok ? String(filterTreffer.wert?.wort ?? 'kein Treffer') : filterTreffer.fehler
  );

  const filterFrei = await app('wortfilter', 'Schönen guten Tag');
  pruefe(
    'Und lässt einen harmlosen Satz durch',
    filterFrei.ok && filterFrei.wert === null,
    filterFrei.ok ? String(filterFrei.wert) : filterFrei.fehler
  );

  // ================================== Push-to-Talk, Stream, Spenden ==
  console.log('\nCommunity, Stream, Spenden');

  const community = await seite.evaluate(async () => {
    const boot = await (await fetch('/api/bootstrap')).json();
    return (boot.communities || []).find((c) => c.joined) || null;
  });

  if (community) {
    const ptt = await app('pttSenden', community.id, 'https://example.invalid/ton.m4a', 3);
    pruefe('Eine Sprachnachricht in die Community', ptt.ok, ptt.ok ? '' : ptt.fehler);
  } else {
    pruefe('Eine Sprachnachricht in die Community', false, 'keine eigene Community');
  }

  if (beitrag) {
    const kommentar = await app('streamKommentar', beitrag.id, 'Prüflauf ' + Date.now());
    pruefe('Ein Kommentar am Livestream', kommentar.ok, kommentar.ok ? '' : kommentar.fehler);

    const spende = await app('spenden', K_ANNA, 250, beitrag.id, 'Prüflauf');
    pruefe('Eine Spende an eine Person', spende.ok, spende.ok ? '' : spende.fehler);
  }

  await zuruecksetzen(seite);

  console.log(
    browserFehler.length ? '\nKonsolenfehler:\n' + browserFehler.join('\n') : '\nKonsolenfehler: keine'
  );
  console.log(
    fehler === 0
      ? 'Alles aus dem Handbuch kommt in der Datenbank an.'
      : `${fehler} Funktionen aus dem Handbuch kommen nicht an.`
  );

  await browser.close();
  process.exit(fehler || browserFehler.length ? 1 : 0);
})();
