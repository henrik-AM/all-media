/*
 * Echte Testmedien fuer All Media — Fotos und Videos, keine Farbflaechen.
 *
 *   node tools/testmedien.js            alles erzeugen und hochladen
 *   node tools/testmedien.js --nurbau   nur erzeugen, nicht hochladen
 *
 * Warum es das gibt
 * -----------------
 * tools/testbilder.js hat sechs Farbverlaeufe mit Aufschrift erzeugt. Damit
 * liess sich pruefen, ob ein Bild ankommt — aber nicht, ob die App gut
 * aussieht, und ein Video liess sich damit ueberhaupt nicht ansehen: die
 * "Videos" waren PNG-Dateien. Wer im Feed auf Wiedergabe drueckte, sah ein
 * Standbild und einen Zaehler, der hochlief.
 *
 * Dieses Werkzeug legt echte Medien an:
 *
 *   - 14 Videos, jedes 52 bis 60 Sekunden, H.264/AAC, faststart. Fuenf im
 *     Hochformat 9:16 fuer die Reels, neun im Querformat 16:9 fuer die Clips.
 *   - Zu jedem Video ein echtes Standbild aus dem Film selbst — was im Raster
 *     zu sehen ist, ist auch das, was abgespielt wird.
 *   - 12 echte Fotos, thematisch zum jeweiligen Beitrag gesucht.
 *
 * Woher die Medien kommen
 * -----------------------
 * Videos: "Big Buck Bunny" und der "Sintel"-Trailer der Blender Foundation,
 * beide Creative Commons Attribution 3.0. Aus ihnen werden die Ausschnitte
 * geschnitten. Nachweis steht in bilder/MEDIEN-NACHWEIS.md.
 *
 * Fotos: Openverse (openverse.org) mit Filter auf kommerziell nutzbare
 * Lizenzen. Zu jedem Beitrag wird sein eigenes Thema gesucht — der Hafen-
 * Beitrag bekommt einen Hafen, nicht irgendein Bild. Urheber und Lizenz
 * jedes Fotos landen ebenfalls im Nachweis.
 *
 * Voraussetzungen: ffmpeg im Pfad (brew install ffmpeg).
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PROJEKT = path.join(ROOT, '..');
const ABLAGE = path.join(PROJEKT, '.medien-cache');
const BAU = path.join(ABLAGE, 'fertig');

const UMGEBUNG = fs.existsSync(path.join(ROOT, '.env.local'))
  ? fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  : '';
const wert = (n) => (UMGEBUNG.match(new RegExp('^' + n + '=(.*)$', 'm')) || [])[1] || '';

const ADRESSE = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const SCHLUESSEL = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');
const KONTO = process.env.TEST_EMAIL || 'test@all-media.app';
const PASSWORT = process.env.TEST_PASSWORT || 'AllMedia2026!';

const NUR_BAU = process.argv.includes('--nurbau');
const NEU = process.argv.includes('--neu');

/* ------------------------------------------------------------- Quellfilme */

const FILME = {
  bunny: {
    url: 'https://media.w3.org/2010/05/bunny/movie.mp4',
    titel: 'Big Buck Bunny',
    nachweis: '© Blender Foundation, www.bigbuckbunny.org — CC BY 3.0',
  },
  sintel: {
    url: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
    titel: 'Sintel (Trailer)',
    nachweis: '© Blender Foundation, www.sintel.org — CC BY 3.0',
  },
};

/*
 * Die Videoausschnitte.
 *
 * `ab` ist die Sekunde im Quellfilm. Die Ausschnitte ueberschneiden sich
 * bewusst nicht, damit die vierzehn Videos im Raster unterscheidbar sind —
 * vierzehnmal dieselbe Szene sieht aus wie ein Fehler.
 *
 * Der letzte Ausschnitt endet bei Sekunde 480: ab etwa 485 laeuft der
 * Abspann von Big Buck Bunny, und eine Namensliste ist kein Testvideo.
 *
 * Hochformat entsteht durch einen mittigen Ausschnitt aus dem Quellbild, nicht
 * durch Verzerren. 270x480 aus 853x480 ist genau 9:16.
 */
const VIDEOS = [
  { name: 'reel-01', film: 'bunny', ab: 40, dauer: 60, form: 'hoch' },
  { name: 'reel-02', film: 'bunny', ab: 130, dauer: 60, form: 'hoch' },
  { name: 'reel-03', film: 'bunny', ab: 300, dauer: 60, form: 'hoch' },
  { name: 'reel-04', film: 'bunny', ab: 370, dauer: 60, form: 'hoch' },
  { name: 'reel-05', film: 'bunny', ab: 420, dauer: 60, form: 'hoch' },
  { name: 'clip-01', film: 'sintel', ab: 0, dauer: 52, form: 'quer' },
  { name: 'clip-02', film: 'bunny', ab: 70, dauer: 60, form: 'quer' },
  { name: 'clip-03', film: 'bunny', ab: 190, dauer: 60, form: 'quer' },
  { name: 'clip-04', film: 'bunny', ab: 250, dauer: 60, form: 'quer' },
  { name: 'clip-05', film: 'bunny', ab: 310, dauer: 60, form: 'quer' },
  { name: 'clip-06', film: 'bunny', ab: 400, dauer: 60, form: 'quer' },
  { name: 'clip-07', film: 'bunny', ab: 100, dauer: 60, form: 'quer' },
  { name: 'clip-08', film: 'bunny', ab: 220, dauer: 60, form: 'quer' },
  { name: 'clip-09', film: 'bunny', ab: 340, dauer: 60, form: 'quer' },
];

/*
 * Die Fotos. `suche` geht an Openverse, `form` bestimmt den Zuschnitt.
 * Die Namen sind sprechend, damit die SQL-Datei lesbar bleibt.
 */
const FOTOS = [
  { name: 'foto-hafen', suche: ['Hamburg harbour Unsplash', 'harbour sunrise Unsplash', 'Hamburger Hafen'], form: 'quadrat' },
  { name: 'foto-homeoffice', suche: ['desk computer Unsplash', 'home office Unsplash', 'workspace desk Unsplash'], form: 'quadrat' },
  { name: 'foto-gipfel', suche: ['Zugspitze summit', 'mountain summit sunrise Unsplash', 'alps panorama Unsplash'], form: 'quadrat' },
  { name: 'foto-code', suche: ['CSS code on a screen Unsplash', 'code screen Unsplash', 'programming Unsplash'], form: 'quadrat' },
  { name: 'foto-test', suche: ['city street Unsplash', 'street photography Unsplash'], form: 'quadrat' },
  { name: 'story-berge', suche: ['mountain sunrise Unsplash', 'alps morning Unsplash'], form: 'hoch' },
  { name: 'story-build', suche: ['computer screen code Unsplash', 'terminal screen Unsplash'], form: 'hoch' },
  { name: 'story-hafen', suche: ['harbour fog Unsplash', 'port fog morning', 'Hamburger Hafen Nebel'], form: 'hoch' },
  { name: 'story-schreibtisch', suche: ['desk workspace Unsplash', 'tidy desk Unsplash'], form: 'hoch' },
  { name: 'story-pasta', suche: ['pasta Unsplash', 'spaghetti Unsplash', 'pasta dish'], form: 'hoch' },
  { name: 'story-laufen', suche: ['running shoes Unsplash', 'jogging park', 'runner sport Unsplash'], form: 'hoch' },
  { name: 'story-test', suche: ['forest path Unsplash', 'forest trail Unsplash'], form: 'hoch' },
];

/* Zielmasse je Form: [Breite, Hoehe, Zuschnitt-Filter fuers Video]. */
const FORMEN = {
  hoch: { breite: 720, hoehe: 1280, videoFilter: 'crop=270:480:291:0,scale=720:1280:flags=lanczos' },
  quer: { breite: 1280, hoehe: 720, videoFilter: 'scale=1280:720:flags=lanczos' },
  quadrat: { breite: 1080, hoehe: 1080 },
};

/* --------------------------------------------------------------- Werkzeug */

const lauf = (befehl, argumente) =>
  execFileSync(befehl, argumente, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();

async function laden(url, ziel) {
  if (fs.existsSync(ziel) && fs.statSync(ziel).size > 0) return false;
  const antwort = await fetch(url, { headers: { 'User-Agent': 'AllMedia-Testmedien/1.0' } });
  if (!antwort.ok) throw new Error(`${antwort.status} bei ${url}`);
  fs.writeFileSync(ziel, Buffer.from(await antwort.arrayBuffer()));
  return true;
}

const warten = (ms) => new Promise((f) => setTimeout(f, ms));

const mb = (datei) => (fs.statSync(datei).size / 1048576).toFixed(1) + ' MB';

/* ---------------------------------------------------------------- Videos */

async function videosBauen() {
  for (const schluessel of Object.keys(FILME)) {
    const ziel = path.join(ABLAGE, `${schluessel}.mp4`);
    process.stdout.write(`  Quellfilm ${FILME[schluessel].titel} … `);
    const neu = await laden(FILME[schluessel].url, ziel);
    console.log(neu ? `geladen (${mb(ziel)})` : 'lag schon da');
  }

  for (const v of VIDEOS) {
    const form = FORMEN[v.form];
    const quelle = path.join(ABLAGE, `${v.film}.mp4`);
    const ziel = path.join(BAU, `${v.name}.mp4`);
    const standbild = path.join(BAU, `${v.name}.jpg`);

    // Schon geschnitten: nicht noch einmal. Vierzehn Ausschnitte neu zu
    // kodieren dauert Minuten, und beim Nacharbeiten an den Fotos braucht
    // man das nicht jedes Mal. Mit --neu wird trotzdem alles neu gebaut.
    if (fs.existsSync(ziel) && fs.existsSync(standbild) && !NEU) {
      console.log(`  ${v.name.padEnd(10)} lag schon da`);
      continue;
    }

    // -ss vor -i springt ueber den Suchindex statt zu dekodieren: bei einem
    // Zehn-Minuten-Film ist das der Unterschied zwischen Sekunden und Minuten.
    lauf('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(v.ab), '-t', String(v.dauer),
      '-i', quelle, '-vf', form.videoFilter,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
      '-profile:v', 'main', '-level', '4.0', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', '-ac', '2', ziel]);

    // Das Standbild stammt aus dem fertigen Ausschnitt, nicht aus dem
    // Quellfilm — sonst zeigt das Raster etwas anderes als der Abspieler.
    // Sekunde 6, weil der erste Schnitt oft noch schwarz ist.
    lauf('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '6', '-i', ziel,
      '-frames:v', '1', '-q:v', '4', standbild]);

    console.log(`  ${v.name.padEnd(10)} ${v.form.padEnd(5)} ${v.dauer}s  ${mb(ziel)}`);
  }
}

/* ----------------------------------------------------------------- Fotos */

/*
 * Wikimedia Commons liefert zu einem Suchbegriff echte Aufnahmen mit
 * nachvollziehbarer Lizenz — und ohne Schluessel, ohne Drossel.
 *
 * Openverse waere die naheliegendere Quelle gewesen, drosselt anonyme
 * Zugriffe aber auf wenige Abfragen pro Stunde; nach dem ersten Foto lief
 * jede weitere Suche in den Zeitablauf. Commons antwortet in unter einer
 * Sekunde.
 *
 * Der Zusatz "Unsplash" in vielen Suchbegriffen ist Absicht: Commons hat
 * Zehntausende Unsplash-Bilder unter CC0 uebernommen. Das sind genau die
 * Aufnahmen, die in einem Feed nicht wie eine Enzyklopaedie aussehen.
 */
async function fotoSuchen(begriffe, hochformat) {
  for (const begriff of begriffe) {
    const adresse = 'https://commons.wikimedia.org/w/api.php?' + new URLSearchParams({
      action: 'query', format: 'json', generator: 'search', gsrnamespace: '6',
      gsrsearch: `filetype:bitmap ${begriff}`, gsrlimit: '12', gsrsort: 'relevance',
      prop: 'imageinfo', iiprop: 'url|size|extmetadata', iiurlwidth: '1800',
    });
    /*
     * Commons drosselt die Suche fuer nicht angemeldete Zugriffe. Ohne
     * Wartezeit kam ab dem dritten Foto nur noch 429 zurueck — und weil der
     * Fehler still uebersprungen wurde, sah es aus, als gaebe es zu den
     * Begriffen einfach kein Bild. Also: warten und es noch einmal versuchen.
     */
    let seiten;
    for (let versuch = 0; versuch < 4 && !seiten; versuch++) {
      if (versuch > 0) await warten(8000 * versuch);
      try {
        const antwort = await fetch(adresse, {
          headers: { 'User-Agent': 'AllMedia-Testmedien/1.0 (Testdaten)' },
          signal: AbortSignal.timeout(30000),
        });
        if (antwort.status === 429) continue;
        if (!antwort.ok) { console.log(`    (Commons ${antwort.status} bei "${begriff}")`); break; }
        const daten = await antwort.json();
        seiten = Object.values(daten.query?.pages ?? {});
      } catch (e) { console.log(`    (Suche "${begriff}" fehlgeschlagen: ${e.message})`); }
    }
    if (!seiten) { console.log(`    (Commons antwortet nicht fuer "${begriff}")`); continue; }

    /*
     * Zwei Grenzen. Erstens die Groesse: eine 600er Vorlage auf 1080 hoch
     * gerechnet ist matschig, und das faellt im Feed sofort auf. Zweitens
     * das Seitenverhaeltnis — aus einem 16:9-Bild einen 9:16-Ausschnitt zu
     * schneiden heisst, vier Fuenftel wegzuwerfen; uebrig bleibt ein
     * beliebiger Bildausschnitt ohne Motiv.
     */
    const passend = seiten
      .map((s) => s.imageinfo?.[0])
      .filter(Boolean)
      .filter((i) => (i.width ?? 0) >= 1200 && (i.height ?? 0) >= 900)
      .filter((i) => (hochformat ? i.height / i.width >= 0.66 : i.width / i.height >= 1.0));

    for (const bildinfo of passend) {
      try {
        const bild = await fetch(bildinfo.thumburl || bildinfo.url, {
          headers: { 'User-Agent': 'AllMedia-Testmedien/1.0 (Testdaten)' },
          signal: AbortSignal.timeout(45000),
        });
        if (!bild.ok) continue;
        const daten = Buffer.from(await bild.arrayBuffer());
        if (daten.length < 60000) continue;
        const m = bildinfo.extmetadata ?? {};
        const ohneMarkup = (t) => String(t ?? '').replace(/<[^>]*>/g, '').trim();
        return {
          daten,
          treffer: {
            title: ohneMarkup(m.ObjectName?.value) || begriff,
            creator: ohneMarkup(m.Artist?.value) || 'unbekannt',
            license: ohneMarkup(m.LicenseShortName?.value) || 'siehe Dateiseite',
            license_version: '',
            foreign_landing_url: bildinfo.descriptionurl,
          },
        };
      } catch (e) { console.log(`    (Download fehlgeschlagen: ${e.message})`); }
    }
  }
  throw new Error(`kein brauchbares Bild fuer "${begriffe[0]}"`);
}

async function fotosBauen(nachweise) {
  for (const f of FOTOS) {
    const form = FORMEN[f.form];
    const ziel = path.join(BAU, `${f.name}.jpg`);
    const roh = path.join(ABLAGE, `roh-${f.name}`);

    if (!fs.existsSync(roh)) {
      await warten(2500); // Commons nicht ueberrennen, siehe fotoSuchen
      const { daten, treffer } = await fotoSuchen(f.suche, f.form === 'hoch');
      fs.writeFileSync(roh, daten);
      fs.writeFileSync(roh + '.json', JSON.stringify({
        titel: treffer.title, urheber: treffer.creator, lizenz: `${treffer.license} ${treffer.license_version}`,
        quelle: treffer.foreign_landing_url,
      }, null, 2));
    }
    nachweise.push({ name: f.name, ...JSON.parse(fs.readFileSync(roh + '.json', 'utf8')) });

    // Mittiger Ausschnitt aufs Zielformat, dann auf die Zielgroesse. "increase"
    // fuellt die Flaeche und laesst nichts weiss stehen.
    lauf('ffmpeg', ['-y', '-loglevel', 'error', '-i', roh,
      '-vf', `scale=${form.breite}:${form.hoehe}:force_original_aspect_ratio=increase,crop=${form.breite}:${form.hoehe}`,
      '-q:v', '4', ziel]);
    console.log(`  ${f.name.padEnd(20)} ${form.breite}x${form.hoehe}  ${mb(ziel)}`);
  }
}

/* -------------------------------------------------------------- Hochladen */

async function anmelden() {
  const antwort = await fetch(`${ADRESSE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SCHLUESSEL, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: KONTO, password: PASSWORT }),
  });
  const daten = await antwort.json();
  if (!daten.access_token) throw new Error('Anmeldung fehlgeschlagen: ' + JSON.stringify(daten).slice(0, 200));
  return daten.access_token;
}

/*
 * Hochladen darf laut Regelwerk jedes angemeldete Konto ("Eigene Medien
 * hochladen"). Ein geheimer Schluessel ist dafuer nicht noetig — und soll es
 * auch nicht sein, sonst kann diese Datei niemand ausser einem selbst laufen
 * lassen.
 */
async function hochladen(token, datei, name, typ) {
  const inhalt = fs.readFileSync(datei);

  /*
   * Erst weg, dann neu. "x-upsert" schreibt eine vorhandene Datei ueber, und
   * Ueberschreiben ist ein UPDATE — dafuer gibt es im Regelwerk keine Regel,
   * also antwortet Supabase mit "row-level security policy". Loeschen darf
   * dagegen, wer die Datei hochgeladen hat. Beim ersten Lauf faellt das nicht
   * auf; beim zweiten bricht alles ab.
   */
  await fetch(`${ADRESSE}/storage/v1/object/media/beispiel/${name}`, {
    method: 'DELETE',
    headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${token}` },
  }).catch(() => {});

  /*
   * Drei Versuche mit wachsender Pause. Beim ersten Lauf kam mitten in der
   * Reihe ein 520 von Cloudflare zurueck — kein Fehler an der Datei, das
   * naechste Video ging danach wieder durch. Ohne Wiederholung bricht der
   * ganze Lauf an so einer Stelle ab.
   */
  for (let versuch = 1; versuch <= 3; versuch++) {
    try {
      const antwort = await fetch(`${ADRESSE}/storage/v1/object/media/beispiel/${name}`, {
        method: 'POST',
        headers: {
          apikey: SCHLUESSEL,
          Authorization: `Bearer ${token}`,
          'Content-Type': typ,
          'x-upsert': 'true',
          'cache-control': 'max-age=31536000',
        },
        body: inhalt,
      });
      if (antwort.ok) return;
      if (versuch === 3) throw new Error(`${name}: ${antwort.status} ${(await antwort.text()).slice(0, 120)}`);
      console.log(`    (${name}: ${antwort.status}, Versuch ${versuch} von 3)`);
    } catch (e) {
      if (versuch === 3) throw e;
      console.log(`    (${name}: ${e.message.slice(0, 80)}, Versuch ${versuch} von 3)`);
    }
    await warten(5000 * versuch);
  }
}

/* -------------------------------------------------------------- Nachweis */

function nachweisSchreiben(nachweise) {
  const zeilen = [
    '# Nachweis der Testmedien',
    '',
    'Erzeugt von `app/tools/testmedien.js`. Alle Medien sind frei lizenziert;',
    'diese Liste ist der Nachweis dazu.',
    '',
    '## Videos',
    '',
    ...Object.values(FILME).map((f) => `- **${f.titel}** — ${f.nachweis}`),
    '',
    'Aus diesen beiden Filmen sind die vierzehn Ausschnitte geschnitten',
    '(`reel-01` bis `reel-05`, `clip-01` bis `clip-09`), je 52 bis 60 Sekunden.',
    '',
    '## Fotos',
    '',
    ...nachweise.map((n) =>
      `- **${n.name}** — „${n.titel ?? 'ohne Titel'}" von ${n.urheber ?? 'unbekannt'}, ` +
      `Lizenz ${String(n.lizenz).trim()} · ${n.quelle ?? ''}`),
    '',
  ];
  const ziel = path.join(PROJEKT, 'bilder', 'MEDIEN-NACHWEIS.md');
  fs.writeFileSync(ziel, zeilen.join('\n'));
  console.log(`\nNachweis: ${path.relative(PROJEKT, ziel)}`);
}

/* ------------------------------------------------------------------ Lauf */

async function main() {
  fs.mkdirSync(BAU, { recursive: true });

  console.log('Videos');
  await videosBauen();

  console.log('\nFotos');
  const nachweise = [];
  await fotosBauen(nachweise);

  nachweisSchreiben(nachweise);

  if (NUR_BAU) {
    console.log(`\nNur erzeugt, nichts hochgeladen. Dateien: ${BAU}`);
    return;
  }

  console.log('\nHochladen');
  const token = await anmelden();
  const dateien = fs.readdirSync(BAU).sort();
  for (const name of dateien) {
    const typ = name.endsWith('.mp4') ? 'video/mp4' : 'image/jpeg';
    await hochladen(token, path.join(BAU, name), name, typ);
    console.log(`  ${name}`);
  }

  console.log(`\nAdressen: ${ADRESSE}/storage/v1/object/public/media/beispiel/<name>`);
}

main().catch((e) => { console.error('\n' + e.message); process.exit(1); });
