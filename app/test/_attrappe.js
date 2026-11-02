/*
 * Die Website ohne Supabase ansehen.
 *
 * Seit dem 10.10.2026 ist Supabase gesperrt (Cached Egress): Niemand kann
 * sich anmelden, und ohne Anmeldung zeigt die Website nur ihre Startmaske.
 * Gebaut wurde trotzdem, aber Kästen blieben auf „[u]“, weil sich kein
 * einziger Bildschirm ansehen ließ.
 *
 * Diese Attrappe beantwortet die /api-Aufrufe der Seite im Prüfbrowser selbst:
 * /api/bootstrap mit einem kleinen, festen Bestand, alles Übrige mit `{}`
 * oder dem, was ein Lauf über `antworten` vorgibt. So lassen sich Aufbau,
 * Knöpfe und Wege der Oberfläche prüfen.
 *
 * Was sie NICHT prüft: Speichern, Regeln der Datenbank, zweites Konto. Ein
 * Lauf mit Attrappe belegt Stufe 1 und 2 (Gegenstand, bedienbar), nie Stufe 3
 * und 4. Kästen bleiben danach „[u]“, bis der echte Lauf nachgeholt ist.
 *
 * Benutzung:
 *   const { attrappe, bestand } = require('./_attrappe');
 *   const daten = bestand({ communities: [...] });
 *   await attrappe(page, daten, { '/api/communities/c1/channels/k1': { messages: [] } });
 */

// Das eigene Konto heißt in den Startdaten immer 'me' (supabase-api.js, ladeNutzer).
const ICH = 'me';

/** Eine Community in der Form, die bootstrapData liefert (supabase-api.js). */
function community(id, name, felder = {}) {
  return {
    id,
    name,
    topic: `${name} – Thema`,
    bio: '',
    link: '',
    visibility: 'public',
    members: 12,
    eigen: false,
    joined: true,
    stumm: false,
    pttBenachrichtigung: false,
    unread: 0,
    channels: [{ id: `${id}-k1`, slug: 'allgemein', name: 'Allgemein', topics: ['Allgemein'] }],
    ...felder,
  };
}

/** Startdaten wie /api/bootstrap, mit allen Feldern, die die Seite liest. */
function bestand(teile = {}) {
  return {
    angemeldet: true,
    users: {
      [ICH]: { id: ICH, name: 'Test Konto', handle: 'test', initials: 'TK' },
      'u-anna': { id: 'u-anna', name: 'Anna Schmidt', handle: 'anna', initials: 'AS' },
    },
    contacts: [],
    chats: [],
    archiviert: [],
    communityChats: [],
    stories: [],
    storiesVideos: [],
    storiesVideosAlle: [],
    posts: [],
    videos: [],
    clips: [],
    communities: [],
    hashtags: [],
    sounds: [],
    places: [],
    friends: [],
    gefolgt: {},
    blockiert: [],
    stummgeschaltet: [],
    keinInteresse: [],
    kontaktBilder: {},
    insights: [],
    insightStreaks: {},
    insightZiele: {},
    sichtbarkeit: {},
    privateProfile: [],
    ungelesen: { videos: 0, communities: 0 },
    eigenesProfil: { bio: '', link: '', pronomen: '', links: [], highlights: [], playlists: [] },
    currentUserId: ICH,
    quelle: 'attrappe',
    ...teile,
  };
}

/**
 * Pfade, deren Antwort keine Sache ist, sondern eine Liste. `{}` würde dort
 * die Seite selbst zum Absturz bringen („nachrichten is not iterable“) —
 * ein Fehler der Attrappe, nicht der Website.
 */
function grundantwort(pfad, methode) {
  if (methode === 'GET' && /^\/api\/messages\/[^/]+$/.test(pfad)) return [];
  if (methode === 'GET' && /^\/api\/chats\/[^/]+\/medien$/.test(pfad)) return { medien: [], markiert: [], gesamt: 0 };
  return undefined;
}

/**
 * Hängt die Attrappe in eine Seite. `antworten` ordnet Pfaden (ohne
 * Abfrageteil) eine Antwort zu; ein Wert kann auch eine Funktion
 * `(anfrage) => antwort` sein. Unbekannte Pfade bekommen `{}`.
 * Zurück kommt die Liste der Aufrufe, damit ein Lauf prüfen kann, was die
 * Seite geschickt hätte.
 */
async function attrappe(page, daten, antworten = {}) {
  const aufrufe = [];
  await page.route('**/api/**', (route) => {
    const anfrage = route.request();
    const pfad = new URL(anfrage.url()).pathname;
    aufrufe.push({ methode: anfrage.method(), pfad, body: anfrage.postData() });
    if (pfad === '/api/bootstrap') return route.fulfill({ json: daten });
    // GET /api/communities/:id liefert dieselbe Form wie die Liste (app.js).
    const com = pfad.match(/^\/api\/communities\/([^/]+)$/);
    const gefunden = com && (daten.communities || []).find((c) => c.id === com[1]);
    if (gefunden && anfrage.method() === 'GET' && antworten[pfad] === undefined) {
      return route.fulfill({ json: gefunden });
    }
    const vorgabe = antworten[pfad] !== undefined ? antworten[pfad] : grundantwort(pfad, anfrage.method());
    if (vorgabe !== undefined) {
      return route.fulfill({ json: typeof vorgabe === 'function' ? vorgabe(anfrage) : vorgabe });
    }
    return route.fulfill({ json: {} });
  });
  return aufrufe;
}

module.exports = { attrappe, bestand, community, ICH };
