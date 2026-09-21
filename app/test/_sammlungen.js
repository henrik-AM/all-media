// Prueft die Sammlungen — Playlists und Highlights (SUPABASE_SCHEMA_46).
//
// Warum es diesen Test gibt: bis zum 20.09.2026 waren `profiles.highlights`
// und `profiles.playlists` Textlisten, also nur Namen. Anlegen ging; das
// Angelegte blieb leer, weil es gar keine Zuordnung gab. Im Profil stand
// deshalb ein Kreis ohne Bild, und Antippen antwortete mit einer Meldung.
//
// Geprueft wird hier nicht, DASS es die Tabellen gibt — das sagt schon
// test:schema. Geprueft wird, dass sie das Richtige zulassen und das Falsche
// ablehnen. Besonders das Ablehnen: ein Auslöser, den niemand ausloest, ist
// keiner.
//
// Start: node test/_sammlungen.js

const fs = require('fs');
const path = require('path');

const UMGEBUNG = fs.existsSync(path.join(__dirname, '..', '.env.local'))
  ? fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
  : '';
const wert = (name) => (UMGEBUNG.match(new RegExp('^' + name + '=(.*)$', 'm')) || [])[1] || '';

const URL = process.env.SUPABASE_URL || wert('EXPO_PUBLIC_SUPABASE_URL');
const KEY = process.env.SUPABASE_ANON_KEY || wert('EXPO_PUBLIC_SUPABASE_ANON_KEY');

// Dasselbe Konto wie in SUPABASE_SCHEMA_7_testkonto.sql.
const KONTO = { email: 'test@all-media.app', passwort: 'AllMedia2026!' };

let gut = 0;
let schlecht = 0;
function pruefe(name, bedingung, hinweis = '') {
  if (bedingung) gut++;
  else schlecht++;
  console.log(`${bedingung ? 'PASS' : 'FAIL'}  ${name}${hinweis ? `  — ${hinweis}` : ''}`);
}

/** Ein Aufruf an PostgREST mit angemeldetem Token. */
async function rest(token, pfad, optionen = {}) {
  const antwort = await fetch(`${URL}/rest/v1/${pfad}`, {
    ...optionen,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(optionen.headers || {}),
    },
  });
  const text = await antwort.text();
  let daten = null;
  try {
    daten = JSON.parse(text);
  } catch {
    /* leere Antwort ist kein Fehler */
  }
  return { status: antwort.status, daten, text };
}

async function main() {
  if (!URL || !KEY) {
    console.log('FAIL  Zugangsdaten fehlen — app/.env.local anlegen');
    process.exit(1);
  }

  console.log('\nSammlungen');

  const anmeldung = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: KONTO.email, password: KONTO.passwort }),
  });
  const sitzung = await anmeldung.json();
  const token = sitzung.access_token;
  const ichId = sitzung.user?.id;
  pruefe('Testkonto angemeldet', Boolean(token && ichId), sitzung.error_description || '');
  if (!token) return ende();

  // ---------------------------------------------------------------------
  //  Die alten Namenslisten sind angekommen
  // ---------------------------------------------------------------------
  const vorhanden = await rest(token, `sammlungen?select=id,art,name&user_id=eq.${ichId}`);
  const namen = (vorhanden.daten || []).map((s) => s.name);
  pruefe(
    'Die alten Namen sind Sammlungen geworden',
    namen.length > 0,
    `${namen.length} gefunden: ${namen.slice(0, 4).join(', ')}`
  );

  const profil = await rest(token, `profiles?select=highlights,playlists&id=eq.${ichId}`);
  const alteNamen = [
    ...((profil.daten?.[0]?.highlights) || []),
    ...((profil.daten?.[0]?.playlists) || []),
  ].filter((n) => String(n).trim());
  const fehlend = alteNamen.filter((n) => !namen.includes(String(n).trim()));
  pruefe(
    'Kein alter Name ist unterwegs verloren gegangen',
    fehlend.length === 0,
    fehlend.length ? `fehlt: ${fehlend.join(', ')}` : `${alteNamen.length} geprueft`
  );

  // ---------------------------------------------------------------------
  //  Anlegen
  // ---------------------------------------------------------------------
  const marke = `Pruefung ${Date.now()}`;
  const angelegt = await rest(token, 'sammlungen', {
    method: 'POST',
    body: JSON.stringify({ user_id: ichId, art: 'playlist', name: marke }),
  });
  const playlistId = angelegt.daten?.[0]?.id;
  pruefe('Eine Playlist laesst sich anlegen', Boolean(playlistId), `HTTP ${angelegt.status}`);

  const nochmal = await rest(token, 'sammlungen', {
    method: 'POST',
    body: JSON.stringify({ user_id: ichId, art: 'playlist', name: marke }),
  });
  pruefe(
    'Derselbe Name ein zweites Mal wird abgelehnt',
    nochmal.status >= 400,
    `HTTP ${nochmal.status}`
  );

  const highlightAngelegt = await rest(token, 'sammlungen', {
    method: 'POST',
    body: JSON.stringify({ user_id: ichId, art: 'highlight', name: marke }),
  });
  pruefe(
    'Derselbe Name als andere Gattung geht',
    highlightAngelegt.status < 400,
    `HTTP ${highlightAngelegt.status}`
  );
  const highlightId = highlightAngelegt.daten?.[0]?.id;

  if (!playlistId) return aufraeumen(token, [playlistId, highlightId]).then(ende);

  // ---------------------------------------------------------------------
  //  Einsortieren — und das Falsche ablehnen
  // ---------------------------------------------------------------------
  const beitrag = await rest(token, `posts?select=id&user_id=eq.${ichId}&limit=1`);
  const postId = beitrag.daten?.[0]?.id;
  const story = await rest(token, `stories?select=id&user_id=eq.${ichId}&limit=1`);
  const storyId = story.daten?.[0]?.id;
  pruefe('Es gibt einen eigenen Beitrag zum Einsortieren', Boolean(postId));

  if (postId) {
    const rein = await rest(token, 'sammlung_inhalte', {
      method: 'POST',
      body: JSON.stringify({ sammlung_id: playlistId, post_id: postId }),
    });
    pruefe('Ein Beitrag laesst sich in die Playlist legen', rein.status < 400, `HTTP ${rein.status}`);

    const zweimal = await rest(token, 'sammlung_inhalte', {
      method: 'POST',
      body: JSON.stringify({ sammlung_id: playlistId, post_id: postId }),
    });
    pruefe(
      'Derselbe Beitrag zweimal wird abgelehnt',
      zweimal.status >= 400,
      `HTTP ${zweimal.status}`
    );
  }

  if (storyId) {
    // Der Auslöser aus Schema 46: in eine Playlist gehoert ein Beitrag.
    const falsch = await rest(token, 'sammlung_inhalte', {
      method: 'POST',
      body: JSON.stringify({ sammlung_id: playlistId, story_id: storyId }),
    });
    pruefe(
      'Eine Story in einer Playlist wird abgelehnt',
      falsch.status >= 400,
      `HTTP ${falsch.status} ${String(falsch.text).slice(0, 60)}`
    );

    if (highlightId) {
      const richtig = await rest(token, 'sammlung_inhalte', {
        method: 'POST',
        body: JSON.stringify({ sammlung_id: highlightId, story_id: storyId }),
      });
      pruefe(
        'Eine Story laesst sich in ein Highlight legen',
        richtig.status < 400,
        `HTTP ${richtig.status}`
      );
    }
  }

  // Weder Beitrag noch Story: die CHECK-Bedingung muss das abfangen.
  const leer = await rest(token, 'sammlung_inhalte', {
    method: 'POST',
    body: JSON.stringify({ sammlung_id: playlistId }),
  });
  pruefe('Ein Eintrag ohne Inhalt wird abgelehnt', leer.status >= 400, `HTTP ${leer.status}`);

  // ---------------------------------------------------------------------
  //  Lesen
  // ---------------------------------------------------------------------
  const inhalt = await rest(
    token,
    `sammlung_inhalte?select=post_id,story_id&sammlung_id=eq.${playlistId}`
  );
  pruefe(
    'Der Inhalt der Playlist ist abrufbar',
    Array.isArray(inhalt.daten) && inhalt.daten.length === (postId ? 1 : 0),
    `${inhalt.daten?.length ?? 0} Eintraege`
  );

  // ---------------------------------------------------------------------
  //  Herausnehmen — und gegenpruefen
  // ---------------------------------------------------------------------
  //  Bei Row Level Security loescht ein abgelehntes DELETE null Zeilen und
  //  meldet trotzdem Erfolg. Gezaehlt wird deshalb danach.
  if (postId) {
    await rest(token, `sammlung_inhalte?sammlung_id=eq.${playlistId}&post_id=eq.${postId}`, {
      method: 'DELETE',
    });
    const danach = await rest(token, `sammlung_inhalte?select=id&sammlung_id=eq.${playlistId}`);
    pruefe(
      'Herausgenommen heisst wirklich weg',
      (danach.daten?.length ?? -1) === 0,
      `${danach.daten?.length ?? '?'} uebrig`
    );
  }

  // ---------------------------------------------------------------------
  //  Fremde Sammlungen
  // ---------------------------------------------------------------------
  const fremd = await rest(
    token,
    `sammlungen?select=id&user_id=neq.${ichId}&limit=1`
  );
  const fremdId = fremd.daten?.[0]?.id;
  if (fremdId && postId) {
    const rein = await rest(token, 'sammlung_inhalte', {
      method: 'POST',
      body: JSON.stringify({ sammlung_id: fremdId, post_id: postId }),
    });
    pruefe(
      'In eine fremde Sammlung laesst sich nichts legen',
      rein.status >= 400,
      `HTTP ${rein.status}`
    );
  }

  await aufraeumen(token, [playlistId, highlightId]);
  ende();
}

/** Der Lauf muss sich wiederholen lassen, ohne Spuren zu hinterlassen. */
async function aufraeumen(token, ids) {
  for (const id of ids.filter(Boolean)) {
    await rest(token, `sammlungen?id=eq.${id}`, { method: 'DELETE' });
  }
  const rest_ = await rest(token, `sammlungen?select=id&id=in.(${ids.filter(Boolean).join(',')})`);
  pruefe(
    'Die Pruefsammlungen sind wieder weg',
    (rest_.daten?.length ?? -1) === 0,
    `${rest_.daten?.length ?? '?'} uebrig`
  );
}

function ende() {
  console.log(`\n${gut} von ${gut + schlecht} Pruefungen bestanden`);
  process.exit(schlecht ? 1 : 0);
}

main().catch((fehler) => {
  console.log(`FAIL  Unerwarteter Abbruch — ${fehler.message || fehler}`);
  process.exit(1);
});
